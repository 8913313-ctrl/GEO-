# 桐灼 GEO 私有化产品工程

这是桐灼 GEO 运营系统的正式工程基线。产品采用“一企业一部署”的私有化交付模式：客户服务器运行管理后台、知识库、官网和任务服务；运营人员的 Windows 电脑运行本地发布助手。

## 当前工程组成

- `tongzhuo-geo-platform-demo/`：交互基线与当前可运行的私有化生产底座；登录、权限、SQLite 工作区、审计、模型凭据加密和发布器 API 已在此目录落地。
- `geo-data-hub-demo/`：桐灼中央中转平台；统一管理客户私有化实例、爱搜主账号、任务队列、积分账本和结果交付。
- `publisher-assistant/`：Windows 本地发布助手原型，负责本机平台登录态、任务领取和结果回写。
- `server-integration-copy/`：既有 GEOFlow 服务器整合模板。
- `demo-company-homepage/`：官网展示与内容信源原型。

## 正式版实施原则

- 管理后台以 GEOFlow Laravel 为正式业务后端，GEORank 只提供内部拓词和诊断能力。
- 单企业部署不做 SaaS 计费、套餐和租户自助开通；仍保留企业内部账号、角色、权限和审计。
- 运行数据、浏览器 Profile、模型 Key、发布器 Token、构建产物和本地备份不得进入 Git。
- 第一批正式支持的平台为企业官网、微信公众号、知乎和头条号；其他平台不得标记为“已接入”。

## 当前状态

第一轮生产底座已完成：数据库迁移/WAL、账号角色权限、Cookie Session/CSRF、工作区版本锁、审计日志、API Key 加密、发布器凭据摘要、健康检查、Docker/Compose、备份恢复和自动化检查。后续按业务优先级接入真实 RAG、官网 CMS、私有后台 Relay Client、实时效果证据落库和更多发布平台。

启动与交付说明见 [`tongzhuo-geo-platform-demo/README.md`](tongzhuo-geo-platform-demo/README.md) 和 [`tongzhuo-geo-platform-demo/docs/PRIVATE-DEPLOYMENT.md`](tongzhuo-geo-platform-demo/docs/PRIVATE-DEPLOYMENT.md)。

中央中转平台启动方式见 [`geo-data-hub-demo/README.md`](geo-data-hub-demo/README.md)。它默认运行在 `43280` 端口，客户私有化后台通过服务端 HMAC 请求 `/client/v1/*`，浏览器不直接接触中转站实例密钥或爱搜 Token。
