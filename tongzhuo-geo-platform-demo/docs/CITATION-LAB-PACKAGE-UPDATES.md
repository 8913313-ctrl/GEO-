# Citation Lab 数据包安全更新中心

## 目标

该模块用于企业私有化部署中的 Citation Lab 固定研究数据包升级。它解决的是“发现姚金刚官方仓库变化、验证可安装数据包、保留旧版本并安全切换”的问题，不会把一次 GitHub 提交或 Release 误报成数据已经更新。

核心边界：

- 固定上游为 `https://github.com/yaojingang/geo-citation-lab`；
- 自动任务最多执行检查，不自动下载、激活或删除版本；
- “发现上游更新”与“发现完整可安装数据包”是两个不同状态；
- 没有完整文件清单、逐文件字节数和 SHA-256 时，候选状态为 `source_update_only`，禁止安装；
- 激活必须由管理员明确确认，并提供当前版本做乐观锁校验；
- 新版本安装在独立目录，绝不覆盖现有版本；
- 回滚只移动活动版本指针，不删除新旧数据；
- 已生成的历史报告仍应记录并使用当时的数据版本，不能随活动指针重新解释。

## 模块文件

- `citation-package-update-store.mjs`：发现、状态、暂存、校验、激活、回滚与活动版本解析。
- `citation-package-update-api.mjs`：独立 API 路由处理器，等待主服务显式挂载。
- `scripts/check-citation-package-updates.mjs`：专项回归，使用小型真实 SQLite 文件测试完整生命周期。

专项测试：

```powershell
node scripts/check-citation-package-updates.mjs
```

## 状态模型

```text
官方仓库新提交或 Release
  ├─ 没有合格的数据包清单 → source_update_only（只提示，禁止安装）
  └─ 有合格的数据包清单 → installable_package_declared
       → staged
       → validated
       → activated
       → rollback（需要时）
```

`check` 会记录上游提交、Release、检查时间和失败原因，但不会改动研究数据库。发现候选后还要依次完成：

1. 重新读取官方 Release 中的包清单，并确认它在检查后没有变化；
2. 将所有文件下载到 `.updates/staging/` 的独立随机目录；
3. 校验每个文件的字节数和 SHA-256；
4. 校验许可证、CC BY 署名和第三方声明的固定哈希；
5. 以只读方式打开 SQLite，执行 `quick_check`；
6. 校验所需表、数据版本、来源仓库、来源 commit 和各表行数；
7. 人工确认后将候选目录原子移动为新版本目录；
8. 原子更新 `.updates/active.json` 活动指针，并保留上一版本。

## 可安装包契约

普通上游源码 Release、源码压缩包、GitHub 页面或仅包含原始 Parquet 的资产不属于可安装数据包。合格 Release 必须包含名称为以下之一的 JSON 资产：

- `geo-citation-lab-package-manifest.json`
- `tongzhuo-geo-citation-lab-package-manifest.json`

该清单必须是完整的 Citation Lab 运行时 `manifest.json`，并额外声明：

```json
{
  "distribution": {
    "format": "tongzhuo-citation-package-v1",
    "files": [
      {
        "path": "derived/citation-research.sqlite",
        "url": "https://github.com/yaojingang/geo-citation-lab/releases/download/vX.Y.Z/...",
        "bytes": 455598080,
        "sha256": "64-character-sha256"
      }
    ]
  }
}
```

文件 URL 只接受姚金刚官方仓库的 GitHub Release 资产。清单至少必须完整声明：

- `derived/citation-research.sqlite`
- `NOTICE-PINS.json`
- `upstream/licenses/LICENSE`
- `upstream/licenses/LICENSE-CODE`
- `upstream/licenses/LICENSE-CONTENT`
- `upstream/licenses/THIRD_PARTY_NOTICES.md`

当前官方仓库若只发布源码、研究文档或不能直接安装的 viewer 数据，系统会诚实显示“发现仓库变化，但无可安装数据包”。此时需要先在隔离构建环境运行既有确定性构建脚本，生成并人工审核上述分发包，再进入私有部署升级链路。

## API 集成建议

将 `createCitationPackageUpdateApi` 挂载到现有鉴权后的 `/api/v1` 路由。读取和检查可授予系统管理员、运维管理员；暂存、验证、激活和回滚仅授予系统管理员，并写入正式审计日志。

| 方法 | 路径 | 作用 |
|---|---|---|
| `GET` | `/api/v1/citation-package-updates/status` | 当前版本、候选、安装版本、检查状态和历史 |
| `POST` | `/api/v1/citation-package-updates/check` | 只检查官方 GitHub，不安装 |
| `POST` | `/api/v1/citation-package-updates/stage` | 显式确认后下载到隔离暂存目录 |
| `POST` | `/api/v1/citation-package-updates/validate` | 校验文件、许可、SQLite、来源与行数 |
| `POST` | `/api/v1/citation-package-updates/discard` | 显式确认后清理未激活的暂存候选 |
| `POST` | `/api/v1/citation-package-updates/activate` | 显式确认且校验当前版本后切换 |
| `POST` | `/api/v1/citation-package-updates/rollback` | 显式确认后切回已验证旧版本 |

暂存请求示例：

```json
{ "candidateId": "候选ID", "confirm": true }
```

激活请求示例：

```json
{
  "candidateId": "候选ID",
  "expectedCurrentVersion": "2.0.1",
  "confirm": true
}
```

## 运行时接入点

当前 `CitationResearchStore` 仍使用固定默认路径。主服务接入更新中心时，应在创建只读研究库连接之前调用：

```js
const selected = resolveActiveCitationResearchPackage();
const citationResearchStore = new CitationResearchStore({
  databasePath: selected.active.databasePath,
  expectedDatasetVersion: selected.active.version,
  expectedSourceCommit: selected.active.sourceCommit
});
```

切换指针不会强制关闭正在运行的 SQLite 连接。激活或回滚成功后，后台必须提示“需要重启研究分析服务”，或由受控运维流程平滑重建 `CitationResearchStore`。不要在已有报告运行期间替换连接。

私有部署推荐把包根目录放在持久卷，并配置：

```text
TZ_CITATION_PACKAGE_ROOT=/var/lib/tongzhuo/research-packages/geo-citation-lab
```

如需提高 GitHub API 限额，可在服务器安全环境中配置 `TZ_CITATION_UPDATE_GITHUB_TOKEN`。令牌不会写入状态文件或报告。定时任务建议每天一次调用 `check`；它只能检查，不应串联 `stage` 或 `activate`。

## 尚未伪装为已完成的部分

- 该独立模块尚未自动挂载到 `server.mjs`，避免与运营诊断改造并行时产生冲突；
- 尚未提供后台“数据版本更新”页面；
- 姚金刚官方仓库目前未必发布符合本系统契约的完整 SQLite 分发包，因此检查结果可能长期为 `source_update_only`；
- 模块验证的是 HTTPS 官方 Release、清单哈希和文件哈希，当前没有上游发布者数字签名。若未来提供 Sigstore/GPG 签名，应在 `validated` 之前增加签名验证。
