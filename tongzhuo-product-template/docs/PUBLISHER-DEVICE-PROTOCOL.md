# 发布节点协议

## 目标

本协议用于连接 GEOFlow 后台与 Windows 本地发布节点。后台负责设备管理、配对码生成、任务分发和结果查看；本地节点负责平台登录、验证码处理、页面发布和结果回写。

## 设计原则

- 后台不保存平台账号密码、Cookie 或浏览器 Profile。
- 普通用户只接触「生成配对码」和「绑定节点」。
- 本地节点静默运行，不要求手工输入后台 URL 或 Token。
- 设备完成首次配对后，使用本机设备秘钥作为长期凭证。
- 平台会话只保存状态，不上传敏感登录内容。

## 设备状态

- `pending`：设备已创建，尚未绑定。
- `online`：设备在线并定期心跳。
- `paired`：设备已绑定，但当前不在线。
- `offline`：超过心跳窗口未上报。
- `disabled`：后台已禁用，不能领取任务。

## 配对流程

### 1. 后台生成配对码

后台在「发布设备工作台」点击「生成配对码」，创建一条 10 分钟有效的配对记录。

### 2. 本地节点绑定

本地节点启动后只需要输入：

- 节点名称
- 后台生成的配对码

节点会把本机 `device_secret` 一并提交给后台，后台完成设备绑定后会把设备状态写成 `paired`。

### 3. 绑定后行为

绑定成功后，节点会：

- 定期发送心跳
- 拉取分发任务
- 打开平台登录窗口
- 写回平台会话状态
- 写回任务执行结果

## API

### 设备注册

`POST /api/v1/publisher/devices/register`

请求体：

```json
{
  "device_id": "tz-device-xxx",
  "name": "运营电脑",
  "device_secret": "device-secret",
  "pairing_code": "ABCD123456",
  "connection_mode": "paired",
  "capabilities": ["wechat_mp", "zhihu", "toutiao"],
  "meta": {
    "version": "1.8.10",
    "platform": "win32"
  }
}
```

说明：

- 首次绑定必须携带 `pairing_code`。
- 绑定后设备使用 `device_secret` 作为长期凭证。

### 心跳

`POST /api/v1/publisher/devices/{device}/heartbeat`

请求体：

```json
{
  "status": "online",
  "connection_mode": "paired",
  "capabilities": ["wechat_mp", "zhihu", "toutiao"],
  "meta": {
    "active_job_id": 123
  }
}
```

### 平台会话写回

`POST /api/v1/publisher/devices/{device}/sessions`

请求体：

```json
{
  "platform_id": "wechat_mp",
  "profile_key": "wechat_mp",
  "account_name": "桐灼运营号",
  "login_state": "ready",
  "last_verified_at": "2026-07-21T10:00:00Z",
  "last_error_message": "",
  "auto_allowed": true,
  "meta": {
    "event": "login_confirmed"
  }
}
```

### 平台会话查询

`GET /api/v1/publisher/devices/{device}/sessions`

返回当前设备下的平台会话列表。

### 任务接口

- `GET /api/v1/publisher/jobs`
- `POST /api/v1/publisher/jobs/{distribution}/claim`
- `POST /api/v1/publisher/jobs/{distribution}/result`

任务由 `desktop_publisher` 渠道类型调度到本地发布节点。

建议回写字段：

- `state`
- `worker_id`
- `message`
- `remote_url`
- `platform_results`
- `state_summary`
- `next_operator_action`

## 后台可见信息

后台至少应显示：

- 设备是否在线
- 设备是否已绑定
- 当前平台会话状态
- 最近心跳时间
- 最近错误
- 任务结果与失败原因

## 安全边界

- Cookie、密码、浏览器 Profile 不上云。
- 配对码过期后必须重新生成。
- 平台登录与验证码始终由本地节点和本地浏览器处理。
