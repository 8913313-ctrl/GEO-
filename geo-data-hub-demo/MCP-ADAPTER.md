# 桐灼中央中转平台 MCP 运维适配器

`relay-mcp-server.mjs` 是一个可选的、仅供受信任运维环境使用的 stdio MCP 服务。它不直接打开 SQLite，而是用已注入的中央管理员根凭证调用既有 `/api/v1/admin/*` 接口，因此继续遵循中央 API 的鉴权、事务、审计与 Worker 唤醒流程。

项目当前没有 `@modelcontextprotocol/sdk` 依赖；该适配器实现 MCP stdio 传输所需的 JSON-RPC 2.0 兼容子集：`initialize`、`tools/list`、`tools/call`、`ping` 以及初始化通知。stdin/stdout 均为一行一个 JSON-RPC 消息，stdout 不输出日志。

## 启动

在可访问中央中转站、且受操作系统权限保护的运维主机上运行：

```powershell
npm.cmd run mcp:serve
```

适配器在启动时读取以下变量。根凭证只从进程环境或秘密文件读取，MCP 工具参数中不存在 Token、Cookie、密码或客户实例密钥字段。

```dotenv
# 若适配器与中央站不在同一进程/主机，使用反向代理后的 HTTPS 地址。
# 本地开发可省略，默认 http://127.0.0.1:43280。
TZ_RELAY_MCP_URL=https://relay.example.com
TZ_RELAY_MCP_TIMEOUT_MS=10000

# 二选一；生产推荐文件注入，不要写入 MCP 客户端配置、命令行或提示词。
TZ_RELAY_ADMIN_TOKEN_FILE=/run/secrets/tz_relay_admin_token
# TZ_RELAY_ADMIN_TOKEN=
```

非本机地址强制要求 HTTPS；适配器拒绝 URL 中的凭证、查询参数、重定向和过大的响应。它使用根凭证作为 CLI 身份调用 API，不使用浏览器 Cookie，也不会创建或持久化浏览器会话。

在 Docker/Kubernetes 中，可将中央中转站已经使用的只读 `tz_relay_admin_token` Secret 挂载给独立 MCP 容器，并仅允许受信任的 MCP 宿主进程启动该容器。不要将 stdio MCP 服务直接暴露为 HTTP 公网端点。

## 工具范围

| MCP 工具 | 作用 | 控制 |
| --- | --- | --- |
| `relay_operations_summary` | 运营摘要、上游健康状态、待人工处理任务元数据 | 只读 |
| `relay_list_customers` | 客户租户和积分钱包汇总 | 只读 |
| `relay_list_instances` | 客户实例、状态和额度 | 只读 |
| `relay_list_tasks` | 检测运行列表 | 只读 |
| `relay_get_task` | 运行与任务项状态明细 | 只读、已脱敏 |
| `relay_retry_task` | 重新入队符合条件的任务项 | 参数必须 `confirmation: "RETRY"` |
| `relay_refund_attention_task` | 对 `submission_uncertain` 项执行人工退款 | 参数必须 `confirmation: "REFUND"` 和审计说明 |
| `relay_rotate_instance_secret` | 轮换客户实例签名密钥 | 参数必须 `confirmation: "ROTATE"`，且须启用安全交付目录 |

适配器没有通用 HTTP、SQL、上游请求、Token 管理、价格修改、充值或设置修改工具。所有动作仍由中央 API 写入审计记录；退款遵循现有的 `submission_uncertain` 人工对账状态机，重试遵循既有结算状态限制。

## 密钥轮换的安全交付

MCP 不会在工具结果中返回新的 `clientSecret`。为避免“已轮换但没有安全交付新密钥”的故障，轮换工具默认拒绝执行；只有明确配置一个受 ACL 保护、由凭证交付流程消费的目录后才可执行：

```dotenv
TZ_RELAY_MCP_SECRET_HANDOFF_DIR=/srv/tongzhuo-relay/mcp-secret-handoff
```

目录必须在启动前由部署脚本创建并限制为 MCP 服务账号可读写（Linux 建议 `0700`）。轮换前，适配器会在该目录中以 `0600` 创建一个仅本地可读的 pending 交付记录；随后将同一新密钥通过 HTTPS 发给中央 API 完成轮换。工具结果只返回不含密钥的 `credentialHandoff.reference`。

交付流程应读取 `status: "ready"` 的记录，通过客户约定的安全通道交付后立即归档或删除。若返回 `pending_review`，不得猜测重试：先在中央审计日志中核对是否已轮换，再由人工完成交付或吊销/重新轮换。该目录不是通用日志目录，不得被备份到不受控位置或被 Web 服务读取。

## 数据脱敏边界

MCP 返回的是白名单化的运营字段，不返回：

- `TZ_RELAY_ADMIN_TOKEN`、AIDSO Token、浏览器会话、Cookie、客户实例密钥或密钥密文；
- 客户提示词、运行输入快照、能力/价格原始快照；
- 爱搜原始响应、标准化结果、上游请求 ID、上游载荷与上游错误正文；
- 任意中央 API 的原始错误响应。

如需查看客户最终检测证据，应由对应客户私有化后台从交付队列落库后的 `diagnostic_evidence(live)` 受控页面完成，而不是通过中央 MCP 导出。

## 离线验证

```powershell
npm.cmd run check:mcp
```

该检查启动本地模拟中央 API，验证文件注入鉴权、JSON-RPC stdio framing、工具白名单、动作确认、退款/重试/密钥轮换安全交付，以及 Token、秘密和上游内容不会出现在 MCP 输出中。
