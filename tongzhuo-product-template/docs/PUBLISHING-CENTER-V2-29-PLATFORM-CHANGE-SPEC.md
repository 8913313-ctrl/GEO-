# 桐灼 GEO 发布中心 V2（29 平台）完整改造规格

> 文档用途：直接交给开发 Agent 作为改造任务书。
>
> 文档状态：方案已确认，尚未授权实现代码。
>
> 建议版本：`2.0.0`（后台主交互、设备协议和发布任务模型均发生产品级变化）。

## 1. 一句话目标

将当前“新建分发渠道 + 本地配置后台地址/Token + 手动拉取任务”的开发工具式流程，改造成：

1. 运营人员只在本地执行器登录平台账号；
2. GEO 后台自动显示本地已经登录且可发布的平台；
3. 运营人员在后台选择文章、账号组或平台，点击一次即可创建发布任务；
4. 本地执行器自动领取、分平台执行并实时回写；
5. 每个平台独立成功、失败、重试和人工确认；
6. 平台密码、Cookie、验证码和浏览器 Profile 始终留在本地电脑。

## 2. 本次改造必须解决的问题

当前分发页以“渠道”为中心，普通运营人员需要理解：

- 渠道名称；
- 目标域名；
- `desktop_publisher`；
- `wechatsync_manual`；
- 本地发布包；
- GEOFlow 地址；
- API Token；
- 设备注册；
- 手动拉取任务；
- 每次重新选择平台。

这些属于技术实现，不应出现在日常运营主流程。

改造后，普通运营人员只需要理解：

- 哪台发布电脑在线；
- 哪些平台账号已登录；
- 哪篇文章需要发布；
- 发布到哪个账号组或哪些平台；
- 立即发布、保存草稿还是定时发布；
- 哪些平台成功、失败或需要人工处理。

## 3. 已有能力盘点（开发 Agent 不得重复实现）

代码中已经存在以下基础能力，必须复用和扩展：

### 3.1 设备和配对

- `publisher_devices` 表；
- `publisher_device_pairings` 表；
- 10 分钟一次性配对码；
- `connection_mode`、`paired_at`、`public_key/device_secret`；
- 后台生成、撤销配对码；
- 执行器配对注册；
- 设备心跳、禁用、恢复和删除。

相关文件：

- `geoflow-integration/server-overrides/app/Models/PublisherDevice.php`
- `geoflow-integration/server-overrides/app/Models/PublisherDevicePairing.php`
- `geoflow-integration/server-overrides/app/Http/Controllers/Admin/PublisherDeviceController.php`
- `geoflow-integration/server-overrides/app/Http/Controllers/Api/V1/PublisherDeviceController.php`

### 3.2 平台会话

- `publisher_platform_sessions` 表；
- 平台、Profile、账号显示名；
- `login_state`；
- `last_verified_at`、`last_seen_at`；
- `auto_allowed`；
- 平台会话上报和查询接口。

相关文件：

- `geoflow-integration/server-overrides/app/Models/PublisherPlatformSession.php`
- `geoflow-integration/server-overrides/database/migrations/2026_07_21_091000_create_publisher_platform_sessions_table.php`
- `desktop-agent/src/agent.js`
- `desktop-agent/src/geoflow-client.js`

### 3.3 发布任务

- `ArticleDistribution`；
- 本地发布任务领取、认领和最终结果回写；
- `platform_results`；
- `state_summary`；
- `next_operator_action`；
- 重试、人工确认和日志；
- 设备能力过滤；
- 本地独立浏览器 Profile。

相关文件：

- `geoflow-integration/server-overrides/app/Models/ArticleDistribution.php`
- `geoflow-integration/server-overrides/app/Http/Controllers/Api/V1/PublisherAssistantController.php`
- `desktop-agent/src/job-state-machine.js`
- `desktop-agent/src/platform-browser.js`
- `desktop-agent/src/platform-result.js`

### 3.4 平台目录

当前代码已有 29 个能力项：28 个外部平台和 1 个 `zip-download` 导出能力。

已知外部平台：

1. 微信公众号 `wechat_mp`
2. 知乎 `zhihu`
3. 微博 `weibo`
4. 小红书 `xiaohongshu`
5. 掘金 `juejin`
6. CSDN `csdn`
7. 简书 `jianshu`
8. 头条号 `toutiao`
9. 抖音图文 `douyin`
10. B站专栏 `bilibili`
11. 百家号 `baijiahao`
12. 语雀 `yuque`
13. 豆瓣 `douban`
14. 搜狐号 `sohu`
15. 雪球 `xueqiu`
16. 人人都是产品经理 `woshipm`
17. 大鱼号 `dayu`
18. 一点号 `yidian`
19. 51CTO `51cto`
20. 慕课网 `imooc`
21. 开源中国 `oschina`
22. SegmentFault `segmentfault`
23. 博客园 `cnblogs`
24. 搜狐焦点 `sohufocus`
25. X/Twitter `x`
26. 东方财富 `eastmoney`
27. 什么值得买 `smzdm`
28. 网易号 `netease`

非平台能力：

- Markdown/ZIP 导出 `zip-download`

阻断项：产品口径为“29 个外部发布平台”，但当前代码只有 28 个外部平台。开发 Agent 开工前必须向产品负责人核准第 29 个平台的名称、平台 ID、登录地址和编辑器地址。不得把 `zip-download` 算作外部平台，不得自行猜测第 29 个平台。

## 4. 产品边界

### 4.1 本次必须实现

- 后台以平台账号为中心，不以渠道为中心；
- 29 平台目录；
- 平台会话和账号状态；
- 发布账号组；
- 后台快速发布；
- 一个总任务扇出成多个平台子任务；
- 分平台状态、重试和人工确认；
- 执行器自动领取任务；
- 登录、验证码和风控仍在本地处理；
- 旧渠道和旧任务兼容；
- 关键路径自动化测试。

### 4.2 本次不承诺

- 绕过验证码、扫码、短信验证或平台风控；
- 所有平台都支持最终按钮的无人值守直接发布；
- 一个内容格式无差别发布到 29 平台；
- 服务器保存平台密码、Cookie、浏览器 Profile；
- 29 个浏览器上下文同时并发运行；
- 页面结构变化后仍保证适配器永不失效。

### 4.3 “直接发布”的真实定义

后台可选三种模式：

- `direct`：适配器稳定且账号允许时，点击平台最终发布按钮；
- `draft`：保存为平台草稿，等待运营人员确认；
- `scheduled`：到期后由在线执行器执行指定模式。

当出现扫码、验证码、风控、账号权限不足或适配器不支持最终发布时，`direct` 必须自动降级为 `awaiting_confirmation`，不得伪报 `published`。

## 5. 目标用户流程

### 5.1 首次绑定发布电脑

1. 管理员进入“发布中心”；
2. 点击“添加发布电脑”；
3. 后台生成 10 分钟有效配对码；
4. 运营电脑安装执行器并输入配对码；
5. 执行器生成设备专用凭证并注册；
6. 后台显示设备“在线”；
7. 后续不再要求用户输入后台 URL、通用 API Token 或设备 ID。

### 5.2 登录平台账号

1. 运营人员在本地执行器选择平台；
2. 执行器打开该平台独立 Profile；
3. 用户在本地完成扫码、账号密码或验证码；
4. 执行器探测账号是否进入已登录页面；
5. 执行器只向后台上报平台、账号显示名、状态和验证时间；
6. 后台平台卡片变为“可发布”。

### 5.3 后台发布

1. 选择一篇已发布或审核通过的文章；
2. 选择账号组或自定义平台；
3. 系统只允许选择已登录且适配器支持的目标；
4. 选择 `立即发布 / 保存草稿 / 定时发布`；
5. 系统执行发布前检查；
6. 创建一个总任务和多个平台子任务；
7. 自动分配给具备对应平台会话的在线设备；
8. 执行器自动领取；
9. 后台实时或准实时显示进度；
10. 用户只处理需要扫码、验证或人工确认的平台。

### 5.4 失败处理

- 临时网络错误：有限重试；
- 页面加载超时：有限重试；
- 登录失效：标记 `login_required`，不重试发布；
- 验证码/扫码：标记 `verification_required`；
- 页面结构变化：标记 `adapter_error`；
- 内容不符合平台规则：标记 `content_validation_failed`；
- 单平台失败不影响其他平台；
- 支持“仅重试失败平台”。

## 6. 发布中心页面规格

### 6.1 路由和菜单

保留现有菜单名称“分发管理”作为兼容入口，但主入口改名为“发布中心”。

建议路由：

- `GET /admin/publishing-center`
- `POST /admin/publishing-center/publish`
- `GET /admin/publishing-center/batches/{distribution}`
- `POST /admin/publishing-center/items/{item}/retry`
- `POST /admin/publishing-center/items/{item}/cancel`
- `POST /admin/publishing-center/items/{item}/confirm`
- `POST /admin/publishing-center/devices/{device}/commands/open-login`

旧路由继续存在，不得破坏历史链接：

- `admin.distribution.*`
- `admin.publisher-assistant`
- `admin.publisher-devices.*`

### 6.2 页面顶部统计

必须显示：

- 在线执行器数量；
- 外部平台总数（产品口径 29，不含 ZIP 导出）；
- 已登录平台账号数；
- 可直接发布数；
- 只能保存草稿数；
- 需要登录/验证数；
- 执行中子任务数；
- 失败子任务数。

### 6.3 平台账号区域

29 平台不得无组织平铺。必须支持：

- 平台搜索；
- 按平台分类筛选；
- 只看已登录；
- 只看可直接发布；
- 只看需要处理；
- 按设备筛选；
- 按账号组筛选；
- 全选当前可用平台；
- 按组全选。

建议平台分类：

- 微信生态；
- 综合内容；
- 百度生态；
- 技术社区；
- 新闻自媒体；
- 社交平台；
- 视频/图文；
- 博客/知识库；
- 财经/消费；
- 海外平台。

每个平台卡片显示：

- 平台图标和名称；
- 账号显示名；
- 所属发布电脑；
- 登录状态；
- 最近验证时间；
- `直接发布 / 草稿 / 定时`能力；
- 当前适配器状态；
- 最近一次发布结果；
- “在本机登录/重新验证”操作。

### 6.4 快速发布区域

字段：

- 文章：只允许已发布或审核通过；
- 发布账号组：可选；
- 自定义平台：可覆盖账号组；
- 发布模式：`direct / draft / scheduled`；
- 定时时间；
- 设备策略：默认自动分配，高级模式可指定设备；
- 失败策略：默认单平台独立失败；
- 是否生成本地导出包：独立选项，不计入平台数。

提交前必须展示发布预检：

- 目标平台数；
- 已登录数；
- 可直接发布数；
- 将降级为草稿数；
- 不可发布数及原因；
- 预计需要人工确认数。

### 6.5 发布任务区域

总任务列表显示：

- 文章；
- 账号组；
- 目标平台数；
- 成功数；
- 草稿数；
- 待确认数；
- 失败数；
- 开始时间；
- 总状态。

总任务详情展开后按平台显示：

- 平台；
- 设备/账号；
- 当前状态；
- 当前步骤；
- 尝试次数；
- 发布 URL/草稿 URL；
- 错误分类；
- 下一步动作；
- 重试、取消、人工确认。

## 7. 平台目录设计

当前平台列表分别硬编码在 PHP 和 JavaScript 中，容易漂移。V2 必须建立后台主平台目录。

### 7.1 新表 `publisher_platforms`

建议字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | bigint | 主键 |
| `platform_id` | string(80), unique | 稳定平台 ID |
| `name` | string(120) | 中文显示名 |
| `group_key` | string(60), index | 平台分类 |
| `sort_order` | unsigned int | 排序 |
| `status` | string(30), index | active/paused/retired |
| `support_level` | string(30), index | direct/draft/manual/planned/export |
| `supports_draft` | bool | 是否支持草稿 |
| `supports_direct_publish` | bool | 是否支持最终发布 |
| `supports_scheduled` | bool | 是否支持定时 |
| `supports_images` | bool | 是否支持正文图片 |
| `supports_cover` | bool | 是否需要/支持封面 |
| `content_formats` | json | html/markdown/plain/richtext |
| `limits` | json | 标题、正文、标签、图片等限制 |
| `login_url` | string(500) | 登录地址 |
| `editor_url` | string(500) | 编辑器地址 |
| `adapter_min_version` | string(40) | 最低执行器版本 |
| `meta` | json | 其他平台规则 |
| timestamps | | |

平台目录由数据库和 Seeder 管理；后台是主数据源。执行器启动后拉取目录并与本地适配器清单合并。

执行器不得再把 `desktop-agent/src/platforms.js` 作为唯一权威源。该文件可保留为离线回退目录。

## 8. 平台账号组设计

### 8.1 新表 `publisher_account_groups`

字段：

- `id`
- `name`
- `slug`
- `description`
- `default_publish_mode`
- `status`
- `created_by_admin_id`
- timestamps

### 8.2 新表 `publisher_account_group_items`

字段：

- `id`
- `publisher_account_group_id`
- `platform_id`
- `publisher_device_id`
- `publisher_platform_session_id`
- `profile_key`
- `publish_mode`
- `enabled`
- `sort_order`
- `overrides` JSON
- timestamps

唯一约束建议：

`group_id + platform_id + publisher_platform_session_id`

默认内置组建议：

- 全平台组；
- 企业品牌组；
- 技术内容组；
- 新闻自媒体组；
- 财经内容组；
- 全平台草稿审核组。

内置组只作为模板，客户可以修改。

## 9. 发布任务数据模型

为兼容现有系统，继续使用 `article_distributions` 作为一次发布批次的父记录，新增平台子任务表。

### 9.1 扩展 `article_distributions`

新增字段：

- `publish_mode` string(30)，默认 `draft`；
- `publisher_account_group_id` nullable；
- `assigned_device_strategy` string(30)，默认 `auto`；
- `requested_by_admin_id` nullable；
- `scheduled_at` nullable；
- `started_at` nullable；
- `completed_at` nullable；
- `publisher_summary` JSON nullable；

保留现有：

- `distribution_channel_id`；
- `remote_meta.publisher_assistant`；
- `platform_results`；
- `state_summary`；
- `next_operator_action`。

V2 运行时以子任务表为权威，完成后同步汇总到现有 `remote_meta`，保证旧页面和旧 API 仍能读取。

### 9.2 新表 `publisher_platform_jobs`

字段：

| 字段 | 说明 |
| --- | --- |
| `id` | 主键 |
| `article_distribution_id` | 父发布批次 |
| `platform_id` | 平台 ID |
| `publisher_device_id` | 已分配设备，可空 |
| `publisher_platform_session_id` | 已分配账号会话，可空 |
| `profile_key` | 本地 Profile 标识 |
| `publish_mode` | direct/draft/scheduled |
| `status` | 子任务状态 |
| `progress_step` | 当前步骤 |
| `progress_percent` | 0-100 |
| `attempt_count` | 尝试次数 |
| `max_attempts` | 最大次数 |
| `claimed_at` | 领取时间 |
| `started_at` | 开始时间 |
| `finished_at` | 完成时间 |
| `next_retry_at` | 下次重试 |
| `remote_url` | 发布或草稿 URL |
| `error_category` | 错误分类 |
| `error_message` | 错误信息 |
| `next_operator_action` | 人工动作 |
| `payload_snapshot` | 发送给适配器的快照 |
| `result` | 平台结果 JSON |
| timestamps | |

建议唯一约束：

`article_distribution_id + platform_id + publisher_platform_session_id`

### 9.3 平台子任务状态机

允许状态：

- `queued`
- `waiting_for_device`
- `waiting_for_schedule`
- `claimed`
- `preparing`
- `uploading_images`
- `filling_content`
- `saving_draft`
- `publishing`
- `awaiting_confirmation`
- `login_required`
- `verification_required`
- `draft_saved`
- `published`
- `failed`
- `cancelled`
- `skipped`

终态：

- `draft_saved`
- `published`
- `failed`
- `cancelled`
- `skipped`

总任务状态由所有子任务计算，不允许通过一个平台结果直接覆盖总任务。

## 10. 平台会话扩展

在现有 `publisher_platform_sessions` 上新增或明确：

- `capabilities` JSON：draft/direct/scheduled/images/cover；
- `support_level` string(30)；
- `last_probe_at` timestamp；
- `adapter_version` string(40)；
- 数据库唯一索引：`publisher_device_id + platform_id + profile_key`。

现有 `login_state` 保留：

- `unknown`
- `open`
- `ready`
- `needs_verification`
- `needs_captcha`
- `expired`
- `disabled`
- `error`

后台映射为用户语言：

- 未检测；
- 登录窗口已打开；
- 可发布；
- 需要验证；
- 需要验证码；
- 登录已过期；
- 已禁用；
- 适配器异常。

## 11. 后台到本地执行器的命令机制

为了让后台可以点击“在本机登录”，新增设备命令队列。第一阶段用轮询，后续可替换 WebSocket。

### 11.1 新表 `publisher_device_commands`

字段：

- `id`
- `publisher_device_id`
- `command_type`
- `status`
- `payload` JSON
- `result` JSON
- `expires_at`
- `claimed_at`
- `completed_at`
- `error_message`
- timestamps

命令类型：

- `open_platform_login`
- `probe_platform_session`
- `run_platform_job`
- `cancel_platform_job`
- `refresh_platform_catalog`
- `run_diagnostics`
- `prepare_update`

状态：

- `queued`
- `claimed`
- `completed`
- `failed`
- `expired`
- `cancelled`

### 11.2 命令 API

- `GET /api/v1/publisher/devices/{device}/commands`
- `POST /api/v1/publisher/devices/{device}/commands/{command}/claim`
- `POST /api/v1/publisher/devices/{device}/commands/{command}/result`

执行器每次任务轮询时同时领取命令。未来切换 WebSocket 后，REST 仍作为降级方案。

## 12. 发布 API 规格

### 12.1 后台快速发布

`POST /admin/publishing-center/publish`

请求示例：

```json
{
  "article_id": 123,
  "account_group_id": 4,
  "platforms": ["wechat_mp", "zhihu", "toutiao"],
  "publish_mode": "direct",
  "scheduled_at": null,
  "include_export_bundle": false,
  "device_strategy": "auto"
}
```

校验：

- 文章存在且状态允许发布；
- 平台存在且启用；
- 每个平台存在可用会话或明确返回不可发布原因；
- `direct` 不支持时可按用户选择降级为 `draft`；
- 不允许空平台数组，除非只选择导出包；
- 同一文章、同一账号、同一平台的重复提交必须有幂等控制。

### 12.2 发布预检

`POST /admin/publishing-center/preflight`

返回：

```json
{
  "ready": ["wechat_mp", "zhihu"],
  "draft_only": ["xiaohongshu"],
  "login_required": ["toutiao"],
  "unsupported": [],
  "estimated_manual_actions": 2,
  "warnings": []
}
```

### 12.3 子任务领取

新增设备级接口，逐个平台领取：

- `GET /api/v1/publisher/platform-jobs?device_id=...`
- `POST /api/v1/publisher/platform-jobs/{job}/claim`
- `POST /api/v1/publisher/platform-jobs/{job}/progress`
- `POST /api/v1/publisher/platform-jobs/{job}/result`

保留现有批次接口：

- `/api/v1/publisher/jobs`
- `/api/v1/publisher/jobs/{distribution}/claim`
- `/api/v1/publisher/jobs/{distribution}/result`

旧执行器继续使用批次接口；V2 执行器优先使用子任务接口。

### 12.4 进度上报

请求示例：

```json
{
  "status": "filling_content",
  "progress_step": "填写正文",
  "progress_percent": 55,
  "message": "标题和正文已填入编辑器"
}
```

进度事件应写入 `DistributionLog` 或专门事件表，后台详情页可追踪。

## 13. 设备自动分配规则

平台子任务分配时依次判断：

1. 设备未禁用；
2. 最近心跳在在线窗口内；
3. 执行器版本达到平台最低要求；
4. 设备 capability 包含平台；
5. 对应平台会话为 `ready`；
6. 会话 `auto_allowed=true`，或任务允许人工确认；
7. 设备当前并发未达到上限；
8. 优先使用账号组中绑定的设备和会话；
9. 多设备同时可用时，选择活动任务更少的设备。

没有可用设备时，子任务进入 `waiting_for_device`，不得直接失败。

## 14. 并发、节流和风控

29 平台不能同时在一台电脑打开。

默认策略：

- 单设备全局并发：2；
- 同平台并发：1；
- 单任务最大自动尝试：2；
- `needs_captcha/needs_verification/login_required` 不自动重试；
- 平台级最小间隔从平台目录 `limits` 读取；
- 同一账号的任务严格串行；
- 支持多设备横向并行；
- 设备重启后，超时的 `claimed/running` 子任务可重新入队；
- claim 必须使用数据库锁和租约时间，避免双领。

建议增加：

- `lease_expires_at`；
- `last_progress_at`；
- 任务卡死回收命令。

## 15. 内容标准化与平台转换

后台先生成统一内容包：

- 标题；
- 摘要；
- HTML；
- Markdown；
- 纯文本；
- 封面；
- 正文图片；
- 标签；
- Canonical URL；
- 原创声明；
- 作者和来源信息。

平台适配器负责：

- 标题长度处理；
- 摘要生成或截断；
- HTML/Markdown/纯文本转换；
- 不支持样式清理；
- 图片本地下载和平台上传；
- 封面选择；
- 标签数量限制；
- 外链限制；
- 原创声明；
- 平台专属结尾；
- 发布前校验。

不得在任务执行过程中直接修改原文章。平台转换结果写入子任务 `payload_snapshot`。

## 16. 本地执行器改造

### 16.1 正常模式

正常运营不再需要打开 `http://127.0.0.1:18280`。

执行器应：

- 后台常驻；
- 开机启动；
- 自动心跳；
- 自动同步平台目录；
- 自动上报平台会话；
- 自动领取子任务；
- 需要人工处理时弹出 Windows 通知；
- 点击通知打开准确的平台页面；
- 完成后回写并继续队列。

本地网页保留为：

- 首次配对；
- 平台登录；
- 本机诊断；
- 支持包导出；
- 高级设置。

### 16.2 平台状态探测

每个适配器增加只读探测方法：

```js
probeSession(pageOrContext) => {
  loginState,
  accountName,
  capabilities,
  message
}
```

探测要求：

- 不读取或上传 Cookie；
- 不提交表单；
- 不触发发布；
- 只根据当前平台可见页面判断；
- 判断失败返回 `unknown/error`，不得误报 `ready`。

### 16.3 适配器接口

建议统一：

```js
{
  id,
  probeSession,
  openLogin,
  validatePayload,
  prepareContent,
  saveDraft,
  publishDirect,
  getResultUrl
}
```

不支持的方法必须明确返回 capability，不得以空实现冒充成功。

### 16.4 自动运行

V2 配对成功后默认：

- `autoRun=true`；
- `pollSeconds` 保留为断线降级；
- 有 V2 子任务接口时优先子任务；
- 旧批次接口作为兼容；
- 执行器应保存本地活动任务快照，异常退出后可恢复或安全回滚。

## 17. 安装和凭证

### 17.1 安装体验

目标：用户只双击一个安装包。

正式版本不得要求客户手工：

- 安装 Node；
- 运行 `npm install`；
- 安装 Playwright；
- 执行 PowerShell 脚本；
- 打开本地端口；
- 复制通用 API Token。

可分阶段实现：

1. 先用 NSIS/MSIX 打包现有 Node + 依赖 + 浏览器；
2. 创建托盘程序和开机启动；
3. 后续加入自动升级。

### 17.2 设备凭证

当前配对和设备 secret 已有基础实现，但最终要求：

- 配对码单次、短期有效；
- 每设备独立凭证；
- 凭证不能使用通用后台 Token；
- 凭证只允许访问本设备的任务、命令和会话；
- 后台可以吊销；
- 本地优先使用 Windows Credential Manager/DPAPI；
- 迁移完成前允许读取旧配置，成功迁移后删除明文 secret；
- `public_key` 不应长期存放明文 bearer secret，后续应拆成 `device_secret_hash` 或公钥签名。

## 18. 安全要求

必须保持：

- 平台密码不上传；
- Cookie 不上传；
- 浏览器 Profile 不上传；
- 验证码不上传；
- 扫码状态不上传；
- 支持包脱敏；
- 服务端只保存状态、账号显示名、时间、能力和结果 URL；
- 设备凭证只能访问自己的设备资源；
- 子任务 claim 必须验证设备分配和 capability；
- 后台管理员操作记录审计日志；
- 平台远程 URL 需要 URL 校验；
- 错误信息不得包含敏感请求头或页面 Cookie。

## 19. 旧数据迁移和兼容

### 19.1 渠道

- 保留所有现有 `distribution_channels`；
- 普通发布中心隐藏 `desktop_publisher` 和 `wechatsync_manual` 的技术配置；
- 系统确保存在一个启用的内部 `desktop_publisher` 渠道；
- 不删除旧渠道；
- 高级设置仍可查看和维护；
- 新发布批次统一挂到内部 `desktop_publisher` 渠道。

### 19.2 旧任务

- 旧 `ArticleDistribution` 不迁移为新子任务，继续按旧结构展示；
- 新任务创建 `publisher_platform_jobs`；
- 后台详情页同时兼容旧 `platform_results` 和新子任务；
- 汇总器把新子任务结果同步回 `remote_meta.publisher_assistant`。

### 19.3 旧执行器

- 心跳中没有 V2 capability 时标记为“兼容模式”；
- 兼容模式继续领取旧批次任务；
- 不向旧执行器分配 V2 平台子任务；
- 后台提示升级，但不能让旧任务立即中断；
- 版本门禁通过 `meta.version` 判断。

## 20. 后台代码改造清单

### 20.1 新增

- `PublisherPlatform` 模型和 Seeder；
- `PublisherAccountGroup`；
- `PublisherAccountGroupItem`；
- `PublisherPlatformJob`；
- `PublisherDeviceCommand`；
- `PublishingCenterController`；
- `PublisherAssignmentService`；
- `PublisherPreflightService`；
- `PublisherBatchSummaryService`；
- `PublisherPlatformCatalogService`；
- 发布中心 Blade 页面；
- 新迁移和测试。

### 20.2 修改

- `routes/web.php`；
- `routes/publisher-assistant.php`；
- `ArticleDistribution`；
- `PublisherDevice`；
- `PublisherPlatformSession`；
- API `PublisherDeviceController`；
- API `PublisherAssistantController`；
- Admin `DistributionController`；
- Admin `PublisherAssistantController`；
- Admin `PublisherDeviceController`；
- 后台菜单 `resources/views/admin/partials/header.blade.php`；
- 分发任务列表和详情；
- 语言文件；
- 产品架构与设备协议文档。

### 20.3 不得直接删除

- `DistributionChannel`；
- 旧渠道页面；
- 旧任务 API；
- `wechatsync_manual` 兼容；
- ZIP 导出能力；
- 现有日志和人工确认功能。

## 21. 桌面执行器代码改造清单

### 21.1 新增

- 平台目录同步；
- 设备命令轮询；
- 平台会话批量探测；
- V2 子任务领取和进度上报；
- 并发调度器；
- 活动任务本地恢复；
- Windows 通知；
- 适配器 capability 接口；
- 每个平台内容预检；
- V2 诊断项和测试。

### 21.2 修改

- `src/agent.js`；
- `src/geoflow-client.js`；
- `src/config-store.js`；
- `src/platform-browser.js`；
- `src/platforms.js`；
- `src/job-state-machine.js`；
- `src/platform-result.js`；
- `src/adapters/*`；
- `public/index.html`；
- `public/app.js`；
- 安装和升级脚本；
- `package.json` 版本和测试命令。

## 22. 分阶段实施顺序

### 阶段 A：数据模型和兼容层

1. 核准第 29 个外部平台；
2. 建平台目录表并导入平台；
3. 建账号组表；
4. 建平台子任务表；
5. 建设备命令表；
6. 扩展平台会话唯一索引和 capability；
7. 建汇总服务，将新子任务同步到旧 `remote_meta`；
8. 先不改主页面，跑模型和服务测试。

### 阶段 B：后台发布中心

1. 新发布中心页面；
2. 平台账号状态；
3. 账号组；
4. 发布预检；
5. 一次提交创建总任务和平台子任务；
6. 子任务列表、详情、重试和取消；
7. 隐藏普通渠道配置；
8. 保留高级兼容入口。

### 阶段 C：执行器 V2

1. 拉取平台目录；
2. 会话探测；
3. 命令领取；
4. V2 子任务领取；
5. 进度上报；
6. 并发和租约；
7. Windows 通知；
8. 中断恢复；
9. 旧执行器兼容测试。

### 阶段 D：29 平台适配和质量门

每个平台逐个验收：

1. 打开登录；
2. 登录状态探测；
3. 内容格式校验；
4. 标题填写；
5. 正文填写；
6. 图片上传；
7. 标签和原创声明；
8. 保存草稿；
9. 直接发布（如果允许）；
10. 获取结果 URL；
11. 登录失效；
12. 验证码/风控；
13. 页面变化错误分类。

没有完成以上验收的平台不得标记 `direct`。至少通过草稿流程后才可标记 `draft`。

### 阶段 E：安装产品化和实时连接

1. 一键安装包；
2. 托盘常驻；
3. 凭证安全迁移；
4. 自动升级；
5. WebSocket/Reverb 实时任务；
6. REST 轮询降级；
7. 客户交付包和升级文档。

## 23. 测试策略

### 23.1 后端单元测试

- 平台目录 Seeder 幂等；
- 账号组平台校验；
- 发布预检；
- 设备分配；
- 无在线设备进入等待；
- 登录过期不可领取；
- `direct` 降级；
- 幂等发布；
- 总任务汇总；
- 单平台重试；
- 旧 `remote_meta` 兼容。

### 23.2 后端功能测试

- 创建发布批次；
- 创建平台子任务；
- 设备只能领取自己的任务；
- 错误设备不能 claim；
- 进度上报；
- 最终结果；
- 人工确认；
- 取消；
- 命令领取和结果；
- 配对码过期和重复使用；
- 禁用设备拒绝访问。

### 23.3 执行器测试

- 平台目录同步；
- 会话探测 fixture；
- 登录失效 fixture；
- 子任务领取；
- 并发上限；
- 同平台串行；
- 进度事件；
- 临时错误重试；
- 验证码不重试；
- 执行器重启恢复；
- 旧批次任务兼容；
- 支持包脱敏。

### 23.4 平台适配器测试

继续保留本地 HTML fixture，不在自动测试中访问真实账号。真实账号验收作为人工签收清单。

每个平台至少需要：

- 未登录 fixture；
- 已登录 fixture；
- 编辑器 fixture；
- 内容超限 fixture；
- 页面结构异常 fixture；
- 草稿成功结果；
- 直接发布结果（如支持）。

### 23.5 端到端验收

1. 本地登录至少三个代表平台；
2. 后台 60 秒内显示可用；
3. 后台选择文章和账号组；
4. 创建三个子任务；
5. 执行器自动领取；
6. 后台显示进度；
7. 两个平台成功，一个平台需要验证；
8. 成功平台不受失败平台影响；
9. 完成验证后只重试该平台；
10. 总任务汇总正确；
11. 旧任务页面仍可读取；
12. 全链路不上传 Cookie 或密码。

## 24. 验收标准（Definition of Done）

以下全部满足才算完成：

- 普通运营人员不需要新建本地发布渠道；
- 普通运营人员不需要填写目标域名；
- 配对后不需要通用 API Token；
- 不需要打开本地页面手动拉任务；
- 后台能够按真实会话显示平台可用状态；
- 29 个外部平台均存在平台目录记录；
- ZIP 导出不计入平台数量；
- 支持账号组和自定义平台；
- 三次操作内完成一次发布：选文章、选范围、提交；
- 一次发布生成独立平台子任务；
- 单平台失败不影响其他平台；
- 支持只重试失败平台；
- `direct` 不支持或遇到风控时诚实降级；
- 后台可以看到平台级进度和 URL；
- 旧渠道、旧任务和旧执行器有兼容路径；
- 平台密码、Cookie、验证码、Profile 不进入服务端；
- 核心后端、执行器和适配器测试通过；
- 产品版本、变更日志、协议和客户交付文档同步更新。

## 25. 发布和回滚

### 25.1 灰度开关

增加：

- `PUBLISHING_CENTER_V2_ENABLED=false`
- `PUBLISHER_PLATFORM_JOBS_ENABLED=false`
- `PUBLISHER_DEVICE_COMMANDS_ENABLED=false`

灰度期间：

- 新页面仅对管理员开放；
- 旧页面仍可用；
- V2 执行器使用子任务；
- 旧执行器继续批次任务；
- 数据同时写入新表和旧 `remote_meta`。

### 25.2 回滚原则

- 关闭开关即可退回旧页面；
- 不删除新表；
- 不回滚已经完成的平台结果；
- 新子任务汇总已同步到旧结构；
- 旧执行器仍能领取后续兼容任务；
- 数据库迁移 `down()` 不应在生产直接执行，除非确认无 V2 数据。

## 26. 开发 Agent 执行规则

开发 Agent 必须遵守：

1. 先读本文件和现有设备协议；
2. 先核准第 29 个外部平台；
3. 先盘点现有配对、会话和任务代码，不得重复造表或重复造接口；
4. 先提交数据库和接口契约，再改 UI；
5. 每阶段都有测试后才能进入下一阶段；
6. 不删除旧渠道和旧 API；
7. 不把 `zip-download` 算作外部平台；
8. 不把未完成真实验收的平台标记为可直接发布；
9. 不上传平台敏感登录数据；
10. 不把整个总任务绑定为单一平台状态；
11. 不用一个巨型 JSON 代替需要查询和重试的平台子任务表；
12. 不为了追求“全自动”绕过验证码和平台风控；
13. 所有新 UI 使用中文简体；
14. 更新版本、CHANGELOG、产品架构、设备协议和交付检查；
15. 最终交付包含迁移说明、升级说明、回滚说明和测试结果。

## 27. 建议交给 Agent 的任务提示词

```text
请按照 docs/PUBLISHING-CENTER-V2-29-PLATFORM-CHANGE-SPEC.md 实施桐灼 GEO 发布中心 V2。

要求：
1. 先审计现有 publisher_devices、publisher_device_pairings、publisher_platform_sessions、ArticleDistribution、PublisherAssistant API 和 desktop-agent，复用已有能力。
2. 开工前确认代码缺少的第 29 个外部平台；zip-download 只是导出能力，不算外部平台。
3. 按阶段 A-E 实施，每阶段完成后运行对应测试并汇报。
4. 保持旧渠道、旧任务 API 和旧执行器兼容；使用功能开关灰度。
5. 后台改为平台账号和发布任务中心，普通用户不再新建本地渠道或填写目标域名。
6. 一次发布必须拆成独立平台子任务，支持分平台状态、进度、失败、重试、人工确认和 URL 回写。
7. 平台密码、Cookie、验证码、浏览器 Profile 不得上传服务端。
8. 未通过真实适配验收的平台不得标记为 direct。
9. 使用 apply_patch 修改文件，保留用户现有改动，不进行破坏性 Git 操作。
10. 最终提供变更文件清单、迁移命令、测试结果、已知限制和回滚方法。
```

## 28. 最终产品判断

本次改造的重点不是“给渠道页再加 29 个复选框”，而是完成四个产品层变化：

1. 从渠道配置转为平台账号管理；
2. 从批次黑盒转为平台子任务；
3. 从本地手动拉取转为后台调度、执行器自动领取；
4. 从静态支持列表转为真实登录状态和适配能力。

只有四层同时完成，才能达到“本地登录平台账号后，在 GEO 后台直接选择可发布平台并发布”的目标。
