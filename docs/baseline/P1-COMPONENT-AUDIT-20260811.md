# P1 组件审计记录（2026-08-11）

## 结论

现有项目已经具备产品化所需的主要组件边界，但目前仍是多个可独立运行的组件，尚未完成面向各行业客户的统一配置契约和端到端动态闭环。P1 审计通过，允许进入 P2：先统一客户配置，再做行业适配。

## 组件职责与验证入口

| 组件 | 职责 | 本次验证 |
| --- | --- | --- |
| `tongzhuo-geo-platform-demo` / GEOFlow | 企业知识、文章、审核、分发任务、线索及 GEO 运营工作台 | `43128`，`/health/live` 与 `/health/ready` 返回 200 |
| `tongzhuo-geo-platform-demo/public-site` | 企业官网与 AI 可读入口，后续应读取同一客户工作区的已发布内容 | `18080`，`/health/live` 与 `/health/ready` 返回 200 |
| `geo-data-hub-demo` | 中央中转、检测运行、积分账本、任务交付和多租户运营 | `43281`，`/health/live` 与 `/health/ready` 返回 200 |
| `publisher-assistant` | 旧版本地发布助手，保留作兼容迁移路径 | `18182`，`/healthz` 返回 200 |
| `tongzhuo-product-template/desktop-agent` | 新版 Windows 本地发布执行器，保存本机平台登录态并回写结果 | `18282`，`/healthz` 返回 200；新实例未配对 |

## 限制与边界

- GEOFlow 的 Citation Lab SQLite 数据库在本次隔离运行中仍为可选未就绪状态（`citationResearch.state=not_ready`）；系统可在受限模式下提供确定性研究文档，不能将该状态误报为完整生产研究能力。
- 平台账号、Cookie、验证码和浏览器 Profile 必须留在客户运营电脑，不进入服务器、模板包或审计报告。
- 当前交付模型仍按“一企业一部署”执行；`tenant_id`/工作区隔离必须在后续通用配置和接口测试中持续保留。

## 本次修复

1. `tongzhuo-product-template/scripts/Test-Template.ps1`：测试时将 Node 组件复制到临时目录并安装运行时依赖；使用当前 PowerShell 可执行文件，避免依赖不存在的 `powershell.exe`。
2. `tongzhuo-product-template/scripts/New-ProductFirstTwoStagesPreview.ps1`：通过导入 `platforms.js` 调用 `platformSupport(id)` 判断平台能力，修复旧的源码字面量匹配导致的错误未就绪判断。

## 临时运行资源

本次审计启动的临时服务已停止：`43128`、`43281`、`18182`、`18282`。用户现有官网 `18080`（PID `23668`）未停止。临时依赖和运行数据位于系统 Temp 下的带 `20260811-p1` 标识目录，仅用于审计，不属于产品源码。

## P1 验收命令

以下检查均已通过：

```powershell
npm run check:site
node scripts/check-ai-generation-service.mjs
node scripts/check-planning-generation-flow.mjs
node scripts/check-citation-visibility.mjs
npm run check:relay
.\Test-ProductFirstTwoStagesPreview.ps1
.\Test-Template.ps1
git diff --check
```

下一阶段从 `tongzhuo-product-template/config/client-config.example.json` 开始，拆分 GEO 核心能力、行业适配标识、客户企业资料和方法论/提示词版本引用；在契约测试通过前不新增具体行业实现。
