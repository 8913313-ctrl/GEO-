# 效果监测底座（姚金刚源码逻辑第一阶段）

这一阶段只实现姚金刚 `GEORank` 与 `GEOFlow` 源码中能够被验证的三类能力：网站 GEO 规则诊断、AI/搜索爬虫访问统计、内容生产与发布运行状态。它不调用第三方 AI 平台提问，也不推断模型内部信源。

```text
公开页面 HTML
  └─ 确定性规则诊断（Schema / 内容 / Meta / 引用）

官网访问日志
  └─ User-Agent 分类（人类 / 搜索爬虫 / AI 爬虫 / 其他机器人 / 未知）

内容数据库 + 本地发布器任务
  └─ 文章 / 审核 / 生成 / 发布运行汇总
```

## 能力边界

- AI 爬虫访问官网，表示页面具备被该爬虫发现或抓取的机会。
- 爬虫 PV 不等于模型收录、品牌提及、推荐、排名或引用。
- 网站诊断分数只反映当前规则覆盖，不是搜索排名或 AI 引用概率。
- 第一阶段不会生成虚构的 AI 回答样本、品牌情感和信源数据。

## 网站 GEO 诊断

诊断规则移植自 GEORank 的确定性规则层，规则版本固定记录为 `yaojingang-georank-v1`。同一 HTML 和同一权重会得到同一结果，并保存 HTML SHA-256，便于判断页面是否发生变化。

综合分为：

```text
综合分 = Schema × 30% + 内容 × 30% + Meta × 20% + 引用 × 20%
```

四个分项的含义：

- `Schema`：读取 JSON-LD，检查 `WebSite`、`Organization`、`FAQPage`、`Article`、`BreadcrumbList` 等实体。
- `内容`：检查唯一 H1、至少两个 H2、首段是否有完整直达答案、正文长度、图片替代文本、FAQ 或列表结构。
- `Meta`：检查 title、description、canonical、viewport、robots、favicon、Open Graph、Twitter Card 和页面语言。
- `引用`：区分站内链接、外部链接、权威来源和社交来源；权威引用数量只是结构质量信号，不代表被对方背书。

远程 URL 诊断具有以下限制：

- 仅允许无账号密码的 HTTP/HTTPS URL；
- 默认只允许 80/443 端口；
- DNS 解析到回环、内网、链路本地或保留地址时拒绝请求，重定向后会再次校验；
- HTML 最大 5 MB，超时、非 HTML 响应和过多重定向会生成失败报告；
- 失败报告也保留状态和错误码，不能把失败当成低分或成功。

诊断服务底层也支持白名单内的本地静态官网目录。服务端会解析真实路径，阻止 `..`、软链接等方式越出允许目录；当前 HTTP 服务默认不开放本地目录入口，只有部署时显式注入 `allowedLocalRoots` 才能启用。

## 页面分析报告契约

官网页面分析采用“规则先行、建议后置”的两层流程：

```text
创建报告（pending）
  -> 抓取并解析 HTML（running）
  -> 确定性规则评分与证据归集
  -> 可选：由已明确选择的文本模型整理建议
  -> 成功完成或记录失败（completed / failed）
```

四项分数只来自确定性规则，模型不会参与评分。每个已完成报告都保存以下可追溯信息：

- `schema`：`foundTypes` / `missingRecommended` / `jsonldCount` / `schemaScore`，以及 JSON-LD 解析、`@graph` 与嵌套实体的证据；
- `content`：H1/H2/H3、首段直答信号、字符数、图片 Alt 覆盖、FAQ、列表、CTA 和分数组成；
- `meta`：`checks` / `missing` / `previewScore` / `metaScore`；
- `citation`：外部、权威、社交、内部和可识别来源链接数量，以及链接样本；
- `recommendations`：始终保留规则发现的问题和规则建议，并明确标记 `source`：`rules`、`llm` 或 `rule_fallback`。模型不可用、无可用模型或模型输出不合格时，报告仍以 `rule_fallback` 完成，不影响分数和报告可读性。

管理后台默认只运行规则建议。只有操作者勾选模型整理建议并选择已配置文本模型时，服务端才把本次结构化规则证据发送给模型；不会发送原始 HTML，也不会把模型输出作为 AI 引用、排名或效果证据。

`POST /api/v1/monitoring/diagnostics` 现在返回 `202 Accepted` 和一个 `pending` 报告。前端应轮询 `GET /api/v1/monitoring/diagnostics/:id` 直到报告进入 `completed` 或 `failed`，不能把 `pending/running` 当成 0 分。

## AI 爬虫访问分析

分类顺序与 GEOFlow 一致：

1. AI 爬虫；
2. 搜索爬虫；
3. 其他机器人；
4. 普通浏览器；
5. User-Agent 为空时归为未知。

AI 爬虫规则覆盖 `GPTBot`、`ChatGPT-User`、`OAI-SearchBot`、`ClaudeBot`、`Claude-SearchBot`、`PerplexityBot`、`CCBot`、`Google-Extended`、`Applebot-Extended`、`Bytespider`、`Meta-ExternalAgent`、`Cohere-AI` 和 `YouBot` 等。AI 规则必须先于宽泛的 `bot` 规则，否则 GPTBot 会被错误归为“其他机器人”。

访问日志采用批量导入，支持服务器、中间件或发布渠道回传。每条事件保存：

- 时间、方法、路径和 HTTP 状态码；
- User-Agent、流量类型和命中的机器人名称；
- 可选的文章 ID、渠道 ID、referer 和扩展元数据；
- HMAC 后的 IP 摘要，不保存原始访问者 IP；
- 外部事件 ID，用于幂等去重。

日常统计只按 `GET` 访问计算 PV，包括总 PV、去重 IP、AI 爬虫 PV、错误量、日期趋势、机器人分布、Top 路径和 Top 文章。页面必须同时显示“访问不是引用”的提示。

## 内容与发布运行状态

运行汇总直接读取正式内容数据库和发布器任务，不使用浏览器演示数据：

- 文章：草稿、审核中、退回、已通过、已发布、已归档；
- 当前版本审核：draft、pending、changes_requested、approved；
- 模型生成任务：queued、running、succeeded、failed、cancelled 和成功率；
- 发布任务：成功、部分成功、失败、等待、取消，以及逐平台汇总。

内容生成状态与发布状态是两套事实来源。文章生成成功不代表发布成功；单个平台失败也不能覆盖其他平台已经成功的结果。

## 正式数据表

- `monitoring_site_reports`：诊断输入类型、状态、规则版本、分项结果、建议、内容哈希和错误信息。
- `monitoring_access_logs`：逐条访问事件、分类结果和可选内容关联。
- `monitoring_log_batches`：每次导入收到、接受、重复和拒绝的数量。

诊断创建/完成和日志导入都会写入统一审计日志。

## HTTP API

| 方法 | 路径 | 权限 | 用途 |
| --- | --- | --- | --- |
| `GET` | `/api/v1/monitoring/overview?days=30` | `workspace.read` | 诊断、流量和生产发布汇总 |
| `GET` | `/api/v1/monitoring/traffic?days=30` | `workspace.read` | 爬虫访问趋势、分布与 Top 页面 |
| `GET` | `/api/v1/monitoring/diagnostics` | `workspace.read` | 历史诊断报告 |
| `GET` | `/api/v1/monitoring/diagnostics/:id` | `workspace.read` | 单份诊断报告与四项依据 |
| `POST` | `/api/v1/monitoring/diagnostics` | `workspace.write` | 运行并保存一次确定性诊断 |
| `POST` | `/api/v1/monitoring/access-logs` | `system.manage` | 批量导入官网访问日志 |

所有写请求都要求 Cookie 会话和 `X-CSRF-Token`。诊断写入支持三选一输入：远程 `url`、受信任调用方上传的 `html`、或服务内部已配置白名单的 `localDirectory`。管理后台目前只提交官网 URL。

日志导入示例：

```json
{
  "source": "server",
  "items": [
    {
      "eventId": "nginx-20260726-00001",
      "occurredAt": "2026-07-26T08:00:00.000Z",
      "method": "GET",
      "path": "/insights/geo-content",
      "statusCode": 200,
      "ipAddress": "203.0.113.20",
      "userAgent": "Mozilla/5.0 compatible; GPTBot/1.2",
      "articleId": "ART-1001"
    }
  ]
}
```

`eventId` 应由 Nginx 日志转换器或接入中间件稳定生成。重复提交相同 `source + eventId` 不会重复计数。

## 验收

运行：

```powershell
node scripts/check-monitoring.mjs
```

自检覆盖：

- 一份固定 HTML 得到可复现的四项分数与综合分；
- JSON-LD、页面结构、Meta、站内/站外/权威链接识别；
- AI、搜索、其他、人类和未知五类 User-Agent；
- 本地页面诊断、诊断记录持久化以及内网 URL 阻断；
- 日志事件去重、原始 IP 不落库、GET 统计口径和文章关联；
- 正式文章审核、模型生成任务与发布任务的状态汇总；
- 返回结果明确声明爬虫访问不能证明 AI 引用。
