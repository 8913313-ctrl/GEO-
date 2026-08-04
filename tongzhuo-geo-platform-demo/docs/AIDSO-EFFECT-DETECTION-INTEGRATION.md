# 爱搜 AI 效果检测接入：三条独立产品链路

## 1. 产品模型

桐灼客户私有化后台中的 AI 效果检测不是一个“新建检测 / 任务中心 / 结果与趋势”的统一页面，也不应把三个爱搜产品混成同一种任务。它必须保留三条彼此独立的客户业务流：

| 客户路由 | 对应爱搜产品语义 | 解决的问题 | 一次运行的边界 |
| --- | --- | --- | --- |
| #effect-search | 实时搜索 /question | 运营人员现在问一个问题，查看所选 AI 平台的真实回答和引用 | 一个问题，可展开为多个获准的平台 × 终端 × 模式任务项 |
| #effect-diagnostic | 品牌诊断 /completeAnalysis | 针对一个品牌、别名、竞品和冻结的问题集，形成可复核的批量诊断 | 一个冻结问题集版本，批量展开为问题 × 平台 × 终端 × 模式任务项 |
| #effect-monitor | 品牌监测 /monitor/dashboard | 按固定口径持续重复采样，观察真实历史证据的变化 | 一个持久监测计划；每次调度都创建一条新的独立运行 |

三个路由可以共用客户私有 API、中转站、计费和交付能力，但不能互相重定向、伪装为内页签，或用一个页面的输入和结果代替另一个页面的业务含义。

爱搜的 /question、/completeAnalysis、/monitor/dashboard 在这里表示三类产品能力和交互语义，不等同于桐灼可以调用的公开 HTTP 接口。桐灼只调用双方已确认的 OpenAPI 或 MCP 契约；不得抓取爱搜页面 DOM、登录态、网页内部接口，或假定这些产品路由存在可自动化调用的未公开 API。

## 2. 共同架构与职责边界

~~~mermaid
flowchart LR
  U["客户运营人员"] --> B["客户浏览器：三个独立页面"]
  B --> P["客户私有化后台 API"]
  P -->|"实例签名、幂等键"| R["桐灼中央中转站"]
  R --> Q["租户校验、报价、账本、队列与调度"]
  Q --> A["爱搜 GEO OpenAPI"]
  A -->|"reqId 与异步结果"| Q
  Q --> O["中转站 outbox"]
  P -->|"签名拉取、ACK / release"| O
  P --> E["diagnostic_evidence（live）"]
  E --> M["可追溯指标、诊断报告或监测趋势"]
~~~

中央中转站使用桐灼统一管理的爱搜账号和 Token，统一执行能力同步、上游调用、成本核算、客户额度冻结与结算。每个客户实例仍是独立租户：任务、证据、交付、账本、额度和访问权限都必须按实例隔离。

| 组件 | 负责 | 明确不负责 |
| --- | --- | --- |
| 客户浏览器 | 展示三个产品页面；调用客户私有 API；确认本次对外数据发送范围 | 保存实例密钥、HMAC、爱搜 Token；直连中转站或爱搜 |
| 客户私有化后台 | 用户与项目权限；品牌资料；问题集冻结；签名调用；拉取交付；写入本地 live 证据 | 保存中央爱搜主 Token；直接扣上游余额 |
| 桐灼中央中转站 | 实例鉴权；能力和价格快照；排队；重试；统一爱搜调用；账本；可靠交付 | 代替客户编造品牌事实、直接修改客户内容或自动发布 |
| 爱搜适配器 | 将已获准的任务项转成已签约的爱搜请求；保存 reqId；轮询和标准化结果 | 将爱搜产品网页当成 API；生成桐灼的诊断结论 |
| 分析与报告层 | 只根据已落库且可追溯的证据生成指标、报告和 proposed 建议 | 用缺失数据补造排名、情感、推荐率或趋势 |

浏览器始终只访问客户私有化后台的 /api/v1/diagnostics/*。客户服务端才可使用实例级签名访问中央中转站的 /client/v1/*；浏览器不能跳过客户服务端。

## 3. 已确认的爱搜接入边界

当前已确认的主执行通道是异步 GEO OpenAPI：

- 任务由 POST https://openapi.aidso.com/geo_api/task_commit 提交，成功后获得上游 reqId。
- 中转站按 reqId 查询结果；处理中状态（例如 ING）不能当作完成。
- 已知任务请求至少与问题文本、爱搜支持的平台名称和思考开关有关；实际可用的平台、终端、模式、单价和限额必须来自中转站保存的账号能力与价格快照，不能由前端硬编码。
- 原始结果可能包含回答、观测时间、引用信息以及上下文等字段。引用字段的解析失败必须保留原文和错误，不得静默丢弃。

爱搜 MCP 可以作为已授权的人工助手或探针通道；它不是客户页面批量运行的默认执行通道。若未来爱搜为完整诊断或监测计划提供新的正式 API，必须在适配器中新增已验证的契约和验收，再启用；不能以产品页面路径替代接口契约。

参考：

- [爱搜 GEO API 文档](https://s12is4u3s19.feishu.cn/wiki/PN67wIpAViOE2akuUSdcytnqnUg)
- [爱搜 MCP Server 文档](https://s12is4u3s19.feishu.cn/wiki/Ivvdw2PR3iom8ykuhMUc5Izjnmd)
- [爱搜开发者服务](https://geo.aidso.com/apiService)

## 4. 三条客户产品流程

### 4.1 实时搜索：#effect-search 对应 /question

实时搜索是单问题工具，而不是小型品牌诊断或监测计划。

1. 操作员输入一个且仅一个非空问题，可填写品牌和别名作为本地查看、提及识别的上下文。
2. 页面从客户私有 API 读取当前实例可用的能力，并选择一个或多个获准的平台 × 终端 × 模式组合。
3. 页面先取得报价和外部数据发送确认；确认后由客户私有化后台创建一次实时搜索运行。
4. 运行的请求范围标记为 feature=real_time_search、aidsoProduct=question、source=effect_search、mode=single_question。这些是桐灼本地溯源字段，不是对爱搜未公开字段的假设。
5. 中转站为该一个问题的每个选中组合创建独立任务项，保存任务项状态和上游 reqId。
6. 页面仅展示这次运行的真实原始回答、引用、观测时间、任务状态、evidence ID 与上游 reqId；任务项失败须明确显示失败原因或待处理状态。

实时搜索不生成批量诊断报告、不创建周期计划，也不把单次回答中的出现位置称为平台排名。若选中多个平台，比较也只能限定为本次相同问题和相同采样条件下的原始结果。

### 4.2 品牌诊断：#effect-diagnostic 对应 /completeAnalysis

品牌诊断是有明确版本边界的批量分析，不能复用实时搜索页面的单问题状态。

1. 操作员建立或选择品牌资料：品牌名、别名、官网、行业、竞品，以及可编辑的多问题问题集。
2. 提交前，客户私有化后台冻结问题集版本和 checksum；后续编辑形成新版本，不能改变正在运行或已完成诊断的样本范围。
3. 操作员选择从能力快照中取得的平台 × 终端 × 模式组合，并确认批量报价、额度和外部数据发送范围。
4. 后台创建批量诊断运行，保存品牌快照、竞品快照、问题集版本、能力快照、价格快照和用户确认记录。建议的本地溯源字段为 feature=brand_diagnostic、aidsoProduct=completeAnalysis、source=effect_diagnostic。
5. 中转站将冻结问题集展开为独立的 问题 × 平台 × 终端 × 模式 任务项。每项独立提交、轮询、重试、结算和交付，单项异常不覆盖整批其他结果。
6. 客户私有化后台在收齐交付并写入 live 证据后，才计算诊断报告。报告必须列出样本范围、完成/失败/未验证项和引用的 evidence ID。

品牌诊断可从已验证的 live 证据计算问题覆盖、品牌提及、引用数量和失败项等确定性指标。它不得虚构情感、全网排名、平台推荐率、首次推荐名次，或把未验证交付计入分子和分母。任何优化建议必须作为 proposed，并绑定证据和指标后等待人工确认。

### 4.3 品牌监测：#effect-monitor 对应 /monitor/dashboard

品牌监测是持久的计划与历史，不是“把诊断结果换成折线图”，也不是自动操作爱搜监测看板。

创建监测计划时，客户必须明确保存：

- 品牌、别名和竞品快照；
- 已冻结的问题集版本与 checksum；
- 已获准的平台 × 终端 × 模式快照；
- 调度周期、时区、首次执行时间、启用或暂停状态；
- 每次运行的最高可接受报价/额度、计划周期的预算上限；
- 外部数据发送授权及其时间、操作者和范围。

每一个到期执行、手动补跑或恢复执行，都必须新建一条独立的诊断运行并通过同一签名中转链路提交。监测计划不能复用旧 run 作为新样本，也不能绕过报价、额度、并发、幂等和租户校验。计划运行建议带有本地溯源字段：feature=brand_monitor、aidsoProduct=monitor、source=effect_monitor。

监测页至少应提供计划列表、计划状态、下一次执行、最近一次执行、执行历史、暂停/恢复和受额度限制的手动执行。趋势只可由同一口径下的 verified live evidence 推导：相同冻结问题集、相同能力组合和可比的时间窗口。样本不足、能力快照变更、失败项过多或历史不可比时，页面应显示“样本不足”或“口径变化”，而不是绘制虚假的上升/下降趋势。

#### 客户私有 API：品牌监测计划

`#effect-monitor` 只调用客户私有化后端的以下接口；浏览器不会保存或传递中转站 HMAC、实例密钥或爱搜 Token。

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| `GET` | `/api/v1/diagnostics/monitoring-plans` | 计划列表；可用 `projectId`、`status`、`limit` 过滤 |
| `POST` | `/api/v1/diagnostics/monitoring-plans` | 保存已报价、已授权的计划 |
| `GET` | `/api/v1/diagnostics/monitoring-plans/:planId?includeRuns=true` | 计划及运行历史 |
| `GET` | `/api/v1/diagnostics/monitoring-plans/:planId/runs` | 单独读取运行历史 |
| `POST` | `/api/v1/diagnostics/monitoring-plans/:planId/pause` | 停止后续调度；不静默取消已提交的中转任务 |
| `POST` | `/api/v1/diagnostics/monitoring-plans/:planId/resume` | 恢复后续调度，正文必须为 `{"confirmExternalExecution":true}` |
| `POST` | `/api/v1/diagnostics/monitoring-plans/:planId/run` | 手动新增一次样本，正文必须为 `{"confirmExternalExecution":true}` |

创建计划的最小正文如下。`items` 是前端根据中转站 `capabilities.items` 选出的**精确任务项**，不是平台、终端、模式数组；后端不把它们做笛卡尔积。每项必须引用冻结问题集中的 `questionId`，服务端始终以冻结的问题文本覆盖浏览器提交的 `prompt`。

```json
{
  "name": "工业机器人品牌周监测",
  "projectId": "DP-...",
  "questionSetId": "DQS-...",
  "items": [
    {"itemId":"q-1-db-web-fast","questionId":"q-1","platform":"DB","terminal":"web","mode":"fast"},
    {"itemId":"q-1-qw-mobile-deep","questionId":"q-1","platform":"QW","terminal":"mobile","mode":"deep"}
  ],
  "brand": {"name":"桐灼","aliases":["桐灼科技"]},
  "competitors": ["竞品 A"],
  "analysisScope": {"needRawAnswer":true,"needQuotes":true},
  "schedule": {"cadence":"weekly","timeZone":"Asia/Shanghai","startAt":"2026-08-10T01:00:00.000Z"},
  "budget": {"maxCreditsPerRun":20,"maxMonthlyCredits":200},
  "authorization": {
    "externalDataConsent": true,
    "authorizationReference": "CONSENT-...",
    "authorizedBy": "由登录用户记录",
    "consentedAt": "2026-08-03T08:00:00.000Z",
    "method": "authenticated_ui"
  }
}
```

`cadence` 支持 `daily`、`weekly`、`monthly` 和 `interval`（后者另传 `intervalHours`）。`maxCreditsPerRun` 是必填的单次报价硬上限；`maxMonthlyCredits` 为可选的客户本地月度安全上限，`0` 表示不额外限制，中央实例自身的日/月额度仍始终生效。每次执行都重新报价；`maxCreditsPerRun` 会作为已签名的 `maxCustomerCredits` 一并传给中央中转站，中央以提交瞬间的真实价格再次校验，避免报价与创建之间的价格变动突破授权上限。计划默认只允许有限延迟（每日 6 小时、每周 24 小时、每月 72 小时，可由 `schedule.maxLatenessHours` 收紧或放宽）；服务端长时间停机后的旧周期会记录为 `skipped`，不会在恢复时突发补扣多次积分。任一上限被超过、授权过期或中转不可用时，计划运行进入 `attention`，不会创建新的付费中转任务。

每次成功提交都会使用本地溯源：`feature=aidso_brand_monitoring`、`aidsoProduct=monitor`、`source=effect_monitor`，并带上计划 ID、计划运行 ID、冻结问题集 checksum 和授权引用哈希。实际爱搜调用仍由中转站的 OpenAPI Worker 完成，计划本身不调用或模拟爱搜网页看板。

### 4.4 品牌监测分析视图与指标口径

客户前端按爱搜品牌监测产品结构提供九个独立视图：数据大盘、提及率/排名、品牌舆情追踪、AI 引用来源、AI 对话记录、作品引用追踪、导出数据与报告、品牌监测设置、AI 问题库。所有视图使用同一个客户服务器聚合接口：

`GET /api/v1/diagnostics/monitoring/analytics?planId=<planId>&range=<days>`

该接口先按当前工作区和计划 ID 校验计划，再通过 `diagnostic_monitoring_plan_runs.diagnostic_run_id` 读取每次运行，只保留 `evidenceType=live`、`verificationStatus=verified` 且在时间窗口内的证据。浏览器不直接拼接其他项目、其他客户或未验收交付。

| 爱搜页面字段 | 客户端字段 | 计算或展示边界 |
| --- | --- | --- |
| 对话次数 | `overview.dialogCount` | 时间窗口内 verified live evidence 数量 |
| 提及对话次数 | `overview.mentionDialogCount` | 有可验证提及字段且提及品牌的回答数量 |
| 提及率 | `overview.mentionRate` | 提及对话数 / 具有提及判断字段的对话数 |
| 品牌提及次数 | `overview.brandMentionCount` | 爱搜标准化结果返回的品牌和别名出现次数之和 |
| SOV | `overview.sov` | 当前适配器没有竞品份额口径，显示 `—` |
| Top1 / Top3 提及率 | `overview.top1MentionRate` / `top3MentionRate` | 仅使用爱搜明确返回的排名字段；不从回答文本位置推断 |
| 平均提及排名 | `overview.averageMentionRank` | 仅对具有上游排名字段的样本求平均 |
| 品牌提及好感度 | `overview.brandFavorability` | 仅使用爱搜标准化情感字段；没有字段显示 `—` |
| 引用文章数 / 引用次数 / 引用站点 | `citationArticleCount` / `citations` / `sourceCount` | 从 verified 回答的引用 URL、域名和引用条目去重或计数 |
| AI 对话记录 | `dialogs[]` | 保留问题、回答、平台、终端、模式、观察时间、evidence ID 和 reqId |
| AI 问题库 | `questionBank[]` | 当前计划冻结的问题集快照，不读取浏览器临时输入 |

品牌得分、热度值、SOV、排名、情感和作品归因在上游没有正式字段或双方未确认口径时一律显示 `—`，不得用示例值、文本位置或模型二次猜测填充。

## 5. 共用的中转运行与交付流程

无论来源页面是什么，中转站中的最小可执行单元均为：

~~~text
问题 × 平台 × 终端 × 模式
~~~

一个 batch 运行可以有很多任务项；一个实时搜索运行也可以因选择多个获准组合而有多个任务项，但仍只包含一个问题。每项必须有自己的 itemId、状态、尝试记录、上游 reqId、结果哈希和结算事实。

客户服务端向中央中转站发起的请求使用签名契约，例如：

~~~http
POST /client/v1/effect-runs
Authorization: Instance <client-id>
X-TZ-Timestamp: <unix-time>
X-TZ-Nonce: <one-time-random>
X-TZ-Signature: HMAC-SHA256(...)
Idempotency-Key: <tenant>/<project>/<question-set-or-search>/<run>
~~~

提交前，中转站验证实例、租户、能力、价格快照、额度、用户授权与幂等键；受理后冻结相应客户额度并异步入队。典型状态包括 pending、submitted、queued、running、completed、partial、failed、attention 与 cancelled。三个页面的运行状态应以 relay link 的状态为准，而不是只看客户本地 run 的粗略状态。

中转站提交到爱搜后保存 reqId，按受控退避策略轮询。上游摘要或部分交付到达不等于整批完成；只有任务项全部到达终态后，才可将运行判定为 completed、partial、failed 或 attention。不可恢复失败、拒绝或超时应按账本规则释放/退款，恢复后重试仍须保持幂等。

爱搜结果先在中转站进行 schema 校验、原始 payload 哈希与标准化，再写入可靠 outbox。客户私有化后台使用实例签名主动拉取交付；本地事务成功后 ACK，写入失败时 release 交付以便重新租出。客户不需要开放公网回调地址。

## 6. 客户本地证据、报告与历史

交付落地时，客户私有化后台使用 deliveryId 加 payloadHash 以及 itemId 加 upstreamReqId 的组合进行幂等保护，并将结果写入：

| 本地对象 | 用途 |
| --- | --- |
| diagnostic_projects | 品牌诊断项目或关联的品牌业务上下文；不把三个产品页强行变成同一个 UI 项目 |
| diagnostic_question_sets | 品牌诊断和品牌监测使用的版本化、可冻结问题集 |
| diagnostic_runs | 单次实时搜索、一次诊断批次或一次监测计划执行的本地运行记录 |
| diagnostic_relay_links | 客户运行与中央 relayRunId 的关联，以及面向页面的真实中转状态 |
| diagnostic_evidence | 每个任务项的原始回答、引用、溯源、观测时间和原始 payload；evidence_type 必须是 live |
| diagnostic_metrics | 仅由已验证 live 证据计算的指标；保存计算口径和样本边界 |
| diagnostic_reports | 品牌诊断报告和可追溯复测对比；不能承载实时搜索的伪报告 |

交付中的原始回答、引用原文、解析后的 URL/标题/摘要、爱搜观测时间、上游 reqId 和质量状态都应被保留。只有 schema 校验成功且具有稳定上游标识的样本才标记为 verified。解析失败、拒绝、无结果和未验证样本可以被展示为运行事实，但不能参与确定性指标。

品牌监测计划还应以持久化记录保存其快照、预算与调度状态，并关联每次新建的本地 run 和 relay run。停止计划只停止后续调度，不删除已经交付的客户证据；清理历史必须服从租户保留期和审计策略。

## 7. 指标边界

允许计算的指标必须以本次 run 或可比监测样本为分母，并能回链到 evidence ID：

| 维度 | 可计算的示例 | 条件 |
| --- | --- | --- |
| 回答 | 是否有可解析回答、回答长度 | 对应任务项为 verified |
| 品牌 | 品牌/别名是否出现、提及次数、文本内首次出现位置 | 使用版本化匹配规则，不称为平台排名 |
| 竞品 | 同一问题同一采样条件下是否出现 | 只做并列样本比较 |
| 引用 | 引用条数、唯一域名数、解析到的引用位置 | 保留 quote 原文和解析方法 |
| 覆盖与运行 | 冻结问题集覆盖率、完成率、延迟、重试次数 | 分母是本次计划快照或 run 的真实任务项 |
| 趋势 | 可比窗口内上述指标的历史变化 | 同一冻结问题集与能力快照，且有足够 verified 样本 |

在没有相应爱搜字段、充分样本或可比口径时，以下内容必须显示“不可得”：全网当前排名、全局推荐率、情感倾向、模型版本优劣、跨口径长期趋势，以及任何未被原始证据支持的结论。

## 8. 安全、可靠性与计费

- 爱搜 Token 仅存放于中央中转站的服务端密钥存储。它不得进入浏览器、客户前端配置、交付 payload、日志、报表或模型提示词。
- 客户实例与中央中转站使用 client ID/secret、时间戳、Nonce 和 HMAC。必须拒绝重放、过期签名、错误实例和跨租户 projectId。
- 同一幂等键不可重复创建或重复扣费；同一上游 reqId 只能绑定一个 relay item。
- 中转站按实例隔离额度、队列、任务、账本和交付。客户 A 不能读取、ACK、release 或引用客户 B 的任何任务或证据。
- 队列应具备并发上限、退避、熔断、死信、人工处理与重启恢复。单项失败不应覆盖同批其他成功项。
- 账本记录客户售价、冻结、结算、退回、上游实际消耗、能力/价格快照和任务引用，以支持人工对账。
- 原始回答和引用按租户隔离、脱敏日志与保留期策略管理。完整 Token、Cookie、客户 secret 和未脱敏请求头不得记录。

## 9. 验收标准

### 三个产品页

- 实时搜索只接受一个问题，并能看到该次、该问题的真实任务项、原始回答、引用、evidence ID 和 reqId。
- 品牌诊断能冻结多问题问题集；修改问题后会形成新版本，而不会篡改既有批次；其报告仅使用 verified live evidence。
- 品牌监测能持久保存计划、暂停/恢复并按期新建运行；趋势不以模拟数据或不可比样本绘制。
- 三个路由都不能被重定向到统一检测中心，也不能把另一个页面的输入、报告或计划偷偷作为自己的数据来源。

### 可靠交付与多租户

- 同一 Idempotency-Key 重试不会重复创建爱搜任务或重复扣费。
- 重复交付、重复 ACK、租约过期、客户服务端重启和中转站重启均不会重复写入 live evidence 或丢失可恢复任务。
- completed、partial、failed、attention 与 cancelled 均能真实呈现；不得把失败显示为低分或成功。
- 两个客户实例交叉测试时，签名、relay run、交付和 evidence 均不能跨租户使用。
- 爱搜不可用时，运行会进入可解释的失败/待处理状态，符合账本规则的额度会释放或退款，并可在恢复后按幂等规则重试。

## 10. 上线前清单

- 配置真实的中央主密钥、管理员令牌和爱搜 Token；关闭演示种子数据。
- 为每个客户实例签发、轮换和吊销独立密钥；启用 HTTPS、反向代理与访问控制。
- 配置中转站数据库备份、交付保留与清理、日志脱敏、告警、死信和人工对账流程。
- 用真实爱搜账号完成能力快照、报价、额度、超时、失败退款和恢复验收。
- 在完成正式接口契约与安全审查前，不启用任何通过浏览器自动化、DOM 抓取或未公开接口调用的实现。

核心原则：爱搜负责提供已签约的真实 AI 搜索任务能力；桐灼中央中转站负责统一账号下的安全调用、计费和可靠交付；客户私有化后台负责把属于该客户的 live evidence 转换为实时搜索、品牌诊断和品牌监测三种不同的业务体验。三者共用基础设施，不合并产品语义。
