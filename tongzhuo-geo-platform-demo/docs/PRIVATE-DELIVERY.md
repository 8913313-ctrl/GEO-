# 桐灼 GEO 企业私有化交付手册

本手册用于把桐灼 GEO 运营系统交付到客户自有 Linux 服务器。部署模型是“一家企业、一套独立环境”：管理后台、业务 API、企业数据库、知识库、官网运行时和审计数据都保存在客户服务器；本地发布助手安装在运营人员 Windows 电脑，并通过 HTTPS 与后台配对。

## 1. 交付包类型

| 模式 | 用途 | 是否含客户数据 | 适用场景 |
| --- | --- | --- | --- |
| `blank` | 通用空白安装包 | 否 | 新客户、演示环境、全新服务器 |
| `migrated` | 带 backup v2 的迁移包 | 是 | 已有客户环境迁移、灾备接管 |

`blank` 采用源码白名单构建，默认不包含数据库、API Key、主密钥、发布器状态、运行日志、证书、客户官网和客户文件。不得手工把开发机的 `data`、`.env` 或客户官网目录塞入空白包。

`migrated` 必须显式提供通过校验的 backup v2、客户代号和敏感数据确认参数。它包含恢复客户数据所需的密钥，tar.gz 只压缩、不加密，必须使用受控加密通道传输。详细输入规范见 `operations/MIGRATION-INPUT.md`。

## 2. 生产架构和目录

生产环境使用 Docker Compose，默认服务为：

- `geo-admin`：后台和业务 API，仅在容器网络提供 HTTP；
- `geo-admin-tls`：后台 HTTPS 入口，默认只绑定服务器 `127.0.0.1:18183`；
- `geo-site`：企业官网，默认发布到 `19080`；
- Docker volume：持久化 SQLite、加密状态、日志和应用内备份。

标准主机目录：

```text
/opt/tongzhuo-geo/
├─ current -> releases/<当前版本>
├─ previous -> releases/<上一版本>
├─ releases/                 # 不可变应用版本
├─ shared/                   # app.env、cutover.env
├─ site/                     # 客户官网静态资源
├─ certs/                    # 后台 TLS 证书和私钥
├─ backups/                  # 宿主机备份导出
├─ state/                    # 安装、升级、回滚状态与锁
└─ tmp/                      # 受限临时目录
```

后台不能通过公网明文 HTTP 暴露。正式交付应使用后台域名和可信 HTTPS 证书；若暂时只绑定回环地址，运营人员通过 SSH 隧道访问。`TZ_COOKIE_SECURE` 必须保持为 `1`。

## 3. 服务器要求

- Linux x86_64 或 arm64；建议 4 核 CPU、8 GB 内存、100 GB SSD；
- Docker Engine 24+ 和 Docker Compose v2.20+；
- `curl`、`openssl`、`tar`、`sha256sum`、`awk`、`sed`、`grep`、`find`、`flock`、`cmp`；
- 首次构建需能拉取 `node:24-alpine` 与 `nginx:1.27-alpine`；离线网络须由交付人员预先导入并核对这两个镜像；
- 官网域名、后台域名、DNS 和可信 TLS 证书；
- 至少 2 GB 安装可用空间，生产环境还应按知识资料、图片和备份增长预留容量；
- 出站网络能够访问客户选定的模型、Embedding、OCR 和内容平台；
- 服务器防火墙只开放经过批准的官网/反向代理端口，后台应用端口不直接暴露。

所有操作应使用有 Docker 权限的受控运维账号。不要把 SSH 密码、API Key、主密钥写入脚本、Git、聊天记录或普通工单。

## 4. 校验交付包

先验证下载文件，再解压：

```bash
sha256sum -c tongzhuo-geo-private-<version>-<mode>.tar.gz.sha256
tar -xzf tongzhuo-geo-private-<version>-<mode>.tar.gz
cd tongzhuo-geo-private-<version>-<mode>
sha256sum -c SHA256SUMS
```

随后检查 `manifest.json`：

- `product` 必须是 `tongzhuo-geo-private-delivery`；
- `productVersion` 与合同/变更单版本一致；
- `deliveryMode` 与本次交付一致；
- 空白包的 `containsCustomerData` 和 `containsRecoverySecrets` 必须均为 `false`；
- 迁移包应核对 `customerId` 和内层 backup v2 的 manifest 哈希。

任何哈希不一致都应停止安装并重新获取交付包，不能跳过校验。

## 5. 配置

交付包中的 `operations/app.env.example` 和 `operations/cutover.env.example` 是安全参考模板。安装脚本会根据安装参数，在 `/opt/tongzhuo-geo/shared/` 自动生成权限为 `600` 的正式 `app.env` 和 `cutover.env`；模板本身不参与运行。安装后如需接入企业密钥平台或调整高级 RAG 配置，修改共享配置，再执行 `manage.sh config-check` 和 `manage.sh restart`。

核心配置：

| 配置 | 要求 |
| --- | --- |
| `TZ_PRODUCTION_SITE_BASE_URL` | 企业官网最终 HTTPS URL，不能填 localhost |
| `TZ_COMPOSE_PROJECT_NAME` | 当前企业部署的 Compose 隔离名称；同一服务器多套环境时必须唯一 |
| `TZ_PRODUCTION_SITE_BIND_ADDRESS` | 有宿主机反向代理时建议 `127.0.0.1` |
| `TZ_PRODUCTION_SITE_PORT` | 官网宿主机端口，默认 `19080` |
| `TZ_PRODUCTION_ADMIN_BIND_ADDRESS` | 默认且建议 `127.0.0.1` |
| `TZ_PRODUCTION_ADMIN_PORT` | 默认 `18183`，不得与现有服务冲突 |
| `TZ_ADMIN_TLS_CERT_HOST_PATH` | 证书目录的绝对路径，默认 `/opt/tongzhuo-geo/certs` |
| `TZ_COOKIE_SECURE` | 正式环境必须为 `1` |
| `TZ_TRUST_PROXY` | 只有可信本机反向代理为唯一入口时才设为 `1` |
| `TZ_MASTER_KEY` | 可以留空由系统在受限目录生成；如通过环境注入，须为独立 32 字节随机值 |
| `TZ_RELAY_CLIENT_SECRET_HOST_PATH` | 仅写入 `cutover.env` 的 Relay HMAC 宿主机文件绝对路径；未接中转站时留空 |
| `TZ_AD_HOC_DIAGNOSTIC_API_TOKEN_HOST_PATH` | 可选临时检测服务密钥的独立宿主机文件绝对路径；默认留空 |

模型 API Key、OCR Key 和向量服务 Key 优先在后台录入，由系统使用主密钥加密保存，不应直接写在通用模板中。

### 5.1 接入桐灼中央中转站（Compose Secret）

客户实例未获中转站授权时，`app.env` 中的 Relay 身份字段和 `cutover.env` 中的两个 `*_HOST_PATH` 都保持为空；交付包会挂载无内容的内部占位文件，因此空白交付无需伪造密钥，也不会启用 Relay 或临时检测服务。

获授权后，中央运营方通过受控渠道提供该客户实例的 `TZ_RELAY_BASE_URL`、`TZ_RELAY_INSTANCE_ID`、`TZ_RELAY_CLIENT_ID` 和单独的 HMAC Secret。仅把前三项身份字段写入 `/opt/tongzhuo-geo/shared/app.env`；绝不能写入 `TZ_RELAY_CLIENT_SECRET` 或 `TZ_AD_HOC_DIAGNOSTIC_API_TOKEN`。

由客户的 Secret Manager 或受控运维流程在宿主机生成 Relay HMAC 文件，例如：

```text
/opt/tongzhuo-geo/shared/relay-inputs/relay-client-secret
```

该路径必须是绝对路径、普通文件，目录应为 `0700`，文件必须为 `root:root`、`0600`，且不能被 group/other 读取或写入。Docker Compose 的本地 `file:` Secret 会以只读 bind mount 提供源文件，不能依赖 YAML 的 `uid/gid/mode` 改写权限；`geo-admin` 的 root 启动阶段会将其复制到容器内 tmpfs，再立即降权为 `node` 运行应用。不要在 shell 历史、脚本、工单或 `app.env` 中粘贴密钥。

在 `/opt/tongzhuo-geo/shared/cutover.env` 只登记源文件路径：

```dotenv
TZ_RELAY_CLIENT_SECRET_HOST_PATH=/opt/tongzhuo-geo/shared/relay-inputs/relay-client-secret
TZ_AD_HOC_DIAGNOSTIC_API_TOKEN_HOST_PATH=
```

Compose 只会把它挂载给 `geo-admin` 的原始 `/run/secrets/tz_relay_client_secret`；启动阶段将值转存到 `/run/tongzhuo-runtime-secrets/` tmpfs 并设置 `TZ_RELAY_CLIENT_SECRET_FILE`，官网容器、TLS 代理、浏览器和镜像层均不接触它。修改后执行：

```bash
sudo bash /opt/tongzhuo-geo/current/deploy/private-delivery/manage.sh restart
sudo bash /opt/tongzhuo-geo/current/deploy/private-delivery/manage.sh verify
```

`verify` 会拒绝明文环境变量、非受保护源文件、Relay 身份不完整、缺失 Secret 挂载及 Relay HMAC 与临时检测 API Token 复用。

单问题临时检测服务默认关闭。只有客户明确启用该服务时，才另外配置 `TZ_AD_HOC_DIAGNOSTIC_API_TOKEN_HOST_PATH`，并使用与 Relay HMAC 不同的随机值；不要复用、不要进入浏览器。轮换时由 Secret Manager 原子替换或切换到新的源文件路径，再重启和验收。两类外部 Secret 文件不进入交付包、应用备份或迁移包；灾备时需按客户密钥管理流程重新注入。

## 6. 空白安装

运行只读预检；`--check-ports` 会要求目标端口当前未占用：

```bash
sudo bash operations/preflight.sh \
  --source ./app \
  --site-source ./site-template \
  --install-root /opt/tongzhuo-geo \
  --check-ports
```

预检通过后安装：

```bash
sudo bash operations/install.sh \
  --source ./app \
  --site-source ./site-template \
  --site-url https://www.customer.example \
  --install-root /opt/tongzhuo-geo
```

安装脚本应完成版本目录写入、共享配置、TLS 初始化、Compose 构建启动和健康检查。它不得覆盖未知目录，也不得静默接管已被其他项目占用的端口。

首次打开后台时，系统只在空数据库状态显示“创建企业管理员”。创建完成后该入口关闭。管理员随后应：

1. 修改初始密码并创建运营、审核、只读账号；
2. 配置模型供应商并执行连接测试；
3. 建立企业知识库，上传一份测试资料、审核、索引并验证引用；
4. 配置企业资料、业务线、官网栏目和域名；
5. 安装本地发布助手，使用一次性配对码连接并验证账号状态同步。

## 7. 客户数据迁移

迁移前在源系统停止写入或进入维护窗口，执行完整 backup v2，并在另一目录运行校验。构建 `migrated` 包时必须使用绝对输入路径：

```bash
npm run delivery:build -- \
  --mode migrated \
  --migration-input /secure/export/customer-backup \
  --customer-id customer-a \
  --acknowledge-sensitive-data
```

目标服务器在首次安装时直接显式应用包内 `migration/private-backup`：

```bash
sudo bash operations/install.sh \
  --source ./app \
  --site-source ./site-template \
  --site-url https://www.customer.example \
  --migration-dir ./migration \
  --apply-migration \
  --install-root /opt/tongzhuo-geo
```

恢复必须使用同一客户的一整套 backup v2，不能从不同日期或不同客户备份中拼接数据库、主密钥和状态文件。安装脚本只在显式提供 `--apply-migration` 时接受敏感迁移载荷。

若 backup v2 的 `masterKey.activeSource` 为 `environment`，说明恢复仍依赖源环境外部注入的 `TZ_MASTER_KEY`，构建器会拒绝把它伪装成可独立恢复的迁移包。此类客户必须先完成企业密钥平台的迁移方案，或在源环境按受控流程改用数据卷密钥并重新备份。

恢复完成后应删除解压目录内的 `migration`、上传的 tar.gz 及中转副本；保留的灾备副本必须放在加密、访问受控的离线介质中。

## 8. 日常运维

统一使用管理脚本，避免直接拼写 Compose 参数：

```bash
sudo bash /opt/tongzhuo-geo/current/deploy/private-delivery/manage.sh status
sudo bash /opt/tongzhuo-geo/current/deploy/private-delivery/manage.sh verify
sudo bash /opt/tongzhuo-geo/current/deploy/private-delivery/manage.sh logs --tail 200
sudo bash /opt/tongzhuo-geo/current/deploy/private-delivery/manage.sh restart
sudo bash /opt/tongzhuo-geo/current/deploy/private-delivery/manage.sh backup
```

至少每日检查官网、后台 ready 状态、磁盘空间、错误日志和备份结果。至少保留一份异机或离线加密备份，并定期在隔离环境演练恢复。

backup v2 应同时包含：

- SQLite 数据库；
- 数据主密钥和模型配置主密钥（按实际存在）；
- 模型供应商、发布器和生成任务辅助状态；
- 兼容期 `.encryption-key`；
- 官网静态资源；
- 脱敏后的部署配置和版本元数据；
- 每个组件及整体 manifest 的 SHA-256。

恢复操作必须在服务停止后执行。恢复脚本会先校验完整性并原子替换；恢复后必须检查 `/health/ready`，再验证登录、模型解密、知识检索、官网文章和发布器配对。

## 9. 升级与回滚

升级前：

1. 核对新包外部和内部 SHA-256；
2. 确认 `manifest.json` 版本和模式；
3. 运行完整备份并验证；
4. 确认维护窗口和回滚责任人；
5. 保留当前 `current` 和 `previous` 指向。

通过当前版本的管理脚本执行升级并自动验收：

```bash
sudo bash /opt/tongzhuo-geo/current/deploy/private-delivery/manage.sh \
  --install-root /opt/tongzhuo-geo \
  upgrade ./tongzhuo-geo-private-<新版本>-blank.tar.gz --yes
sudo bash operations/verify.sh --install-root /opt/tongzhuo-geo
```

若健康检查或关键验收失败，使用：

```bash
sudo bash /opt/tongzhuo-geo/current/deploy/private-delivery/manage.sh \
  --install-root /opt/tongzhuo-geo rollback --yes
```

通过本交付脚本执行的升级会先生成完整 backup v2，再使用隔离的 Compose 项目预构建候选镜像，候选镜像不会覆盖仍在运行的正式镜像标签。若新版本启动或验收失败，脚本会同时切回旧代码并恢复升级前数据，避免旧代码读取已经迁移过的新库。人工发起的显式回滚默认只切换代码并保留当前数据库，防止覆盖升级后新增的业务数据；无论是否恢复数据，人工回滚都必须先成功生成当前状态安全备份，失败时不会停止服务或切换版本。

只有数据库迁移已经改变且旧代码不能兼容、并已明确接受覆盖升级后数据时，才执行：

```bash
sudo bash /opt/tongzhuo-geo/current/deploy/private-delivery/manage.sh \
  --install-root /opt/tongzhuo-geo rollback --restore-pre-upgrade-data --yes
```

这个选项必须先成功生成当前状态安全备份，再恢复升级事务绑定的完整 backup v2；安全备份失败时，脚本会在停止服务或替换数据前直接取消回滚。不要在脚本之外随意拼接“旧代码 + 新数据库”。所有升级、回滚和恢复均应保留时间、操作者、版本、备份和验收报告。

自动验收还会核对 `current` 链接与 `installed-release` 事务标记一致，核对三个运行容器的 Compose 项目与配置文件来源，并确认后台、官网容器当前使用的镜像 ID 与正式镜像标签一致。若升级进程被强制中断后出现“active release / running image”不一致，先保留日志和备份，再执行当前版本的 `manage.sh start` 重建并校准当前版本；不得绕过该检查直接签署验收。

## 10. 自动验收

```bash
sudo bash operations/verify.sh --install-root /opt/tongzhuo-geo
```

正式交付至少确认：

- Compose 服务 healthy，后台 `/health/live`、`/health/ready` 和官网 `/health/ready` 返回成功；
- 后台仅通过 HTTPS 访问，Secure Cookie 有效，公网不存在后台明文 HTTP；
- 首位管理员、角色权限、登录和审计日志正常；
- 模型连接测试、一次真实选题和一次真实文章生成成功；
- `/health/ready` 中 `citationResearch.state=ready`、`diagnosticAnalysis=ready`，并完成一次不出网的真实研究库诊断契约测试；
- 企业资料进入知识库后可审核、索引、检索，并在文章中返回可追溯引用；
- 文章必须提交人工审核，审核通过后才能发布；
- 官网文章发布、下线、栏目、Sitemap、RSS、robots.txt 和 llms.txt 正常；
- 本地发布助手配对、平台登录状态同步和一条测试任务回写正常；
- backup v2 创建和校验成功，并至少完成一次隔离恢复演练；
- 日志不暴露密码、完整 API Key、主密钥、Cookie、发布器 Token 或浏览器 Profile。

自动脚本负责可重复的技术检查，真实模型、真实平台登录和业务内容质量仍需要交付人员与客户共同验收。

## 11. 交接清单

客户应收到：

- 交付包、外部 SHA-256、内部 `manifest.json` 和 `SHA256SUMS`；
- 部署拓扑、域名/端口表、版本号和变更记录；
- 管理员创建记录（不包含明文密码）；
- 模型、知识库、官网、发布器和监测的验收报告；
- 备份位置、保留周期、恢复演练记录和灾备责任人；
- 升级、回滚、证书续期、密钥轮换和故障联系流程。

不得在交接文档中记录 SSH 明文密码、API Key、主密钥、会话 Cookie、发布器 Token 或平台浏览器 Profile。

## 12. 构建交付包

通用空白包：

```bash
npm run delivery:build -- --mode blank
```

覆盖本构建器生成的同名旧产物：

```bash
npm run delivery:build -- --mode blank --overwrite
```

构建结果默认位于 `dist/private-delivery/`，包括可查看目录、`.tar.gz` 和外部 `.tar.gz.sha256`。目录内 `manifest.json` 登记交付模式、安全属性和逐文件哈希，`SHA256SUMS` 用于解压后校验。构建器拒绝符号链接，防止通过链接把交付目录之外的文件带入包中。

空白交付包会包含已验证的 `research-packages/geo-citation-lab/2.0.1/derived/citation-research.sqlite` 及许可、署名和 pin 文件；不会携带构建阶段使用的上游 DuckDB、Parquet，也不会把客户生产数据库误判为研究制品带入空白包。当前研究库约 455 MB，计算交付介质和升级窗口时应计入该固定体积。
