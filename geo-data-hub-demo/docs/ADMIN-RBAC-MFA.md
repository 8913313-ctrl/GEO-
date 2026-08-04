# 中央后台管理员、角色与高风险控制

中央后台的日常登录使用命名管理员账号，不再把 `TZ_RELAY_ADMIN_TOKEN` 当作浏览器登录凭证。根 Token 只用于首次初始化和灾难恢复：

```text
POST /api/v1/admin/bootstrap
Authorization: Bearer <TZ_RELAY_ADMIN_TOKEN>
{
  "username": "admin",
  "displayName": "中央平台主管",
  "password": "至少 12 位的强密码"
}
```

初始化接口只在 `relay_admin_users` 为空时成功一次。生产环境应在初始化后立刻登录并绑定 TOTP MFA，然后将根 Token 放回服务器密钥管理系统。

## 登录与会话

```text
POST /api/v1/admin/login
{
  "username": "admin.ops",
  "password": "...",
  "totp": "123456"
}
```

密码使用 scrypt 哈希保存；连续 5 次失败会临时锁定 15 分钟。浏览器只收到 HttpOnly、SameSite=Strict 的短期会话 Cookie，数据库只保存会话摘要。停用账号、重置密码、角色变化、MFA 停用和服务重启都会撤销相关会话。

管理员本人可以调用：

- `POST /api/v1/admin/me/mfa/enroll`
- `POST /api/v1/admin/me/mfa/confirm`

TOTP 密钥使用中转站主密钥 AES-256-GCM 加密保存，不会写入前端或明文数据库。

## 角色

| 角色 | 权限 |
| --- | --- |
| `super_admin` | 全部权限，负责管理员、生产配置和高风险操作 |
| `operations` | 客户、实例、上游、价格、任务重试和运营设置 |
| `finance` | 充值入账、支付订单、发票和对账 |
| `support` | 只读运营数据和安全重试 |
| `auditor` | 只读数据与审计日志 |

所有角色的服务端权限均不依赖前端隐藏按钮。充值确认、退款/对账、实例密钥轮换/吊销、上游 Token、价格发布、管理员账号变更和数据清理等高风险写操作必须使用已经通过 MFA 的命名管理员会话。根 Token 应急会话可用于恢复，但每次操作仍会写入审计事件。
