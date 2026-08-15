# GEOFlow / GEORank 源码能力映射（0.4）

本演示以 GEOFlow 为唯一后台基线，把 GEOFlow 与 GEORank 的已有能力重新编排为客户日常使用的 GEO 运营流程。凡是源码中不存在或需要重新建模的部分，均按“新增能力”处理，不能在正式方案中描述成已经具备。

| 后台模块 | GEOFlow 可复用能力 | GEORank 可复用能力 | 需要新增的能力 |
| --- | --- | --- | --- |
| 工作台 | 任务、文章、队列和分析数据 | 无 | 跨模块行动待办、五阶段闭环 |
| 选题中心 | AI 模型、提示词、知识召回 | `/api/keywords/expand`、词包和 CSV 导出 | 业务线关键词、标准问题、正式选题、内容计划、来源链和监测缺口回流 |
| 内容生产 | 文章、生成任务、知识召回、素材库、作者、分类、审核和风险门禁 | 无 | 计划级知识范围、`GenerationRun`、逐段 `ArticleCitation`、不可变文章版本快照 |
| 发布运营 | 分发通道、队列、调度、幂等、日志和远端 URL | 无 | 本地设备、账号组、平台目标、任务领取与状态回写 |
| 效果监测 | 仅可借用任务、队列和日志设计思想 | 无完整监测能力 | 监测问题、轮次、平台采样、原回答存证、引用证据和统计服务 |
| 官网运营 | 动态主题、首页模块、栏目、SEO、表单、线索和访问分析 | `/api/diagnostics/` | 将站点诊断收进低频设置、结构化官网实体引用 |
| 企业知识 / 建档 | 企业知识项目、来源、AI 初稿、校验、修订、通用 `KnowledgeBase` 和素材库 | 无 | 文档库/问答库类型、知识版本、业务线默认知识包、计划知识范围、四步建档向导、完成度及产品/案例/FAQ 实体 |
| 知识索引 | GEOFlow 现有知识召回流程可作接入点 | 无 | 当前企业 RAG 索引、混合检索、重建与删除同步；Wiki 知识图谱后续新增 |
| 发布助手 | GEOFlow Agent 和服务端分发协议可供参考 | 无 | Windows 本地登录、账号组、设备令牌、任务轮询和平台自动化 |
| 系统设置 | AI 模型、提示词、管理员和日志 | 无 | 私有化部署版本、本地助手策略 |

## 正式集成边界

- 管理界面和核心业务对象进入 GEOFlow Laravel 工程，不再建立第二套运营后台。
- GEORank FastAPI 作为内网能力服务，首期只调用关键词拓展和低频站点诊断接口。
- 企业知识对运营人员只暴露文档库和问答库两种内容类型。首期索引策略固定为 RAG；Wiki 知识图谱后续以增强索引接入，不能把“RAG / Wiki”设计成与“文档 / 问答”并列的知识内容类型。
- 业务线默认知识包、内容计划知识范围、生成记录、引用证据和文章版本快照均进入 GEOFlow 统一后台；GEORank 不参与知识管理和文章证据链。
- 所有新增模型、检索请求、对象存储路径、队列载荷和缓存键都限定在当前部署，禁止跨数据库或跨部署读取。
- 本地发布助手通过设备令牌主动领取任务并回写状态，平台会话数据始终留在本机。
- 多 AI 平台采样、证据快照、监测趋势和情感判断不是 GEOFlow/GEORank 现成功能，0.4 页面必须持续标注“演示数据 / 新增能力”。
- 原型确认后，再为新增能力设计 Laravel migration、模型、控制器、队列任务和助手通信协议。

选题中心正式数据关系为：

```text
business_line
→ managed_keyword / keyword_pack
→ question_library_item
→ topic_candidate
→ content_plan + content_plan_item + content_plan_knowledge_scope
→ article
```

GEORank 只负责产生拓展结果与词包；业务线关键词、问题去重、选题状态、内容排期以及文章来源链均属于 GEOFlow 统一后台需要新增的业务模型。

## 已核实的 GEOFlow 契约

### 文章与任务

- `Task` 是批量生成、草稿池与定时发布任务，不是选题。统一后台需新增 `BusinessLine`、`ManagedKeyword`、`QuestionLibraryItem`、`TopicCandidate`、`ContentPlan` 等产品对象。
- `Article` 的内容状态为 `draft / published / private`，审核状态为 `pending / approved / rejected / auto_approved`；两条状态轴应分开显示。
- 文章工作流已有知识库召回、风险扫描、审核和分发触发。发布前不可变的文章版本快照仍需新增。

### 内容风控

- `ArticleRiskScanner` 的扫描状态只有 `clean / warning / blocked`，不是数值分。
- `unscanned` 和 `stale` 是统一后台需要展示的界面状态：尚未扫描，或正文/词典变化导致旧结果过期。
- 每条命中可保留 `word`、`field`、`count`、`severity`、`category`、`suggestion` 和 `snippet`。
- `ArticleRiskGate` 允许管理员对 `warning` 填写原因后覆盖；`blocked` 必须修改文章，不能覆盖。
- `SensitiveWord` 是一张全局规则表，包含自由分类 `category` 和 `warning / blocked` 严重级别。“广告法规则分类”和“企业敏感规则分类”只是同一规则表的不同视图，不是两个独立模型。
- 企业“禁用表述”同时是企业知识标准稿的一部分，属于企业事实与服务边界层，不应与全局 `SensitiveWord` 规则混为一套数据。

关键源码：`app/Services/GeoFlow/ArticleRiskScanner.php`、`ArticleRiskGate.php`、`app/Models/ArticleRiskScan.php`、`SensitiveWord.php`。

### 企业知识与建档

- `EnterpriseKnowledgeProject` 的流程为 `queued → processing → reviewing → published / failed`。
- 源码已支持手动内容与文件来源、AI 初稿、草稿校验、自动保存、修订恢复，以及发布到 `KnowledgeBase`。
- 标准知识稿要求包含九部分：企业介绍、业务信息摘要、产品能力、应用场景、典型案例、FAQ、禁用表述、风险与冲突、待人工确认。
- GEOFlow 的通用知识库不能直接等同于 0.4 产品层的“文档库 / 问答库”；知识内容类型、审核发布版本、业务线知识包和计划级知识范围需要新增模型或扩展现有模型。
- 0.4 演示中的 `enterpriseProfile`、资料完成度、四步向导、官方域名、监测基线，以及结构化 Product/Case/FAQ 实体均属于新增产品能力。

关键源码：`EnterpriseKnowledgeController.php`、`EnterpriseKnowledgeDraftService.php`、`EnterpriseKnowledgeProject.php`、`EnterpriseKnowledgeRevision.php`、`EnterpriseKnowledgeSource.php`。

## 0.4 企业知识产品层（新增能力）

### 两类知识库

文档库与问答库是对客户可见的知识内容类型，首期共用 RAG 索引管道。

```text
knowledge_library（type=document|qa）
├─ knowledge_document
│    └─ knowledge_document_version
│         └─ knowledge_chunk
└─ knowledge_qa
     └─ knowledge_qa_version
```

- 文档库承载 PDF、Word、Excel、网页、产品手册、案例、资质等资料，版本发布后解析、切块并写入当前租户向量索引。
- 问答库承载标准问题、官方答案、同义问法、服务边界和人工审核状态。问答也进入 RAG，但检索返回完整问答版本，不能把答案切成失去语义的碎片。
- 知识版本状态至少区分 `draft / pending_review / published / retired`。生成只允许使用 `published` 版本；新版本发布不能覆盖历史引用。
- RAG 首期保存向量模型、解析器版本、chunk 哈希和索引时间，以支持重建和删除。Wiki 后续增加实体与关系表，每个图谱事实必须保留来源版本和证据定位。

这些模型均属于 0.4 新增产品层；GEOFlow 现有 `KnowledgeBase`、来源与知识召回可复用控制器入口、文件处理思路和生成流程，但不能描述成已经具备上述分类、版本和隔离契约。

### 业务线默认知识包与内容计划范围

```text
knowledge_package
  └─ knowledge_package_item（library|document|qa）
       ↑
business_line.default_knowledge_package_id
       ↓ 继承并允许增补 / 排除
content_plan_knowledge_scope
  └─ content_plan_knowledge_scope_item
```

- 企业公共知识包提供所有业务线共用的企业介绍、资质和对外边界；业务线默认知识包叠加该产品/服务的资料、案例和标准问答。
- 新建内容计划时生成可见的知识范围，默认继承业务线知识包。运营人员可以为这次计划增补或排除具体知识库、文档或问答，但不能选择其他租户对象。
- 知识包保存动态选择规则；生成前必须把规则解析成确切的已发布知识版本，并写入不可变的知识范围快照。这样资料更新后，历史生成结果仍能复现。

### GenerationRun、ArticleCitation 与版本快照

```text
content_plan_knowledge_scope
  → generation_run
      ├─ generation_knowledge_snapshot
      └─ article
           ├─ article_citation
           └─ article_version_snapshot（审核 / 发布冻结）
```

- `GenerationRun` 记录一次生成执行：租户、业务线、选题、内容计划、模型、提示词版本、生成参数、知识范围快照、检索片段、状态、耗时、用量和错误。重试或重新生成必须新建记录。
- `ArticleCitation` 把文章段落绑定到确切知识版本，保存引用原文、文件页码/章节/URL、chunk 或问答定位、相关度和人工核验状态。它是事实追溯数据，不是简单的引用数量。
- `ArticleVersionSnapshot` 冻结标题、摘要、正文、引用列表、知识版本、内容哈希和风控结果。提交审核、审核通过和创建发布任务都必须明确引用一个快照版本。
- 文章编辑后旧引用可标记为 `stale`，需要重新检索或人工确认；已经排队或发布的快照保持不变。
- 检索无足够证据、证据冲突或来源过期时，生成任务写入知识缺口并停止补写确定性企业事实。

以上三类对象在 GEOFlow/GEORank 当前源码中均不是完整现成功能，需要新增 migration、模型、服务、队列任务、权限策略和审计日志。

## 客户隔离的实现约束（新增能力）

- 业务表、关联表和版本快照统一包含 `tenant_id`，数据库唯一索引以租户为第一维度；外键关联必须校验两端租户一致。
- RAG 检索必须使用独立 collection / namespace 或强制租户过滤；禁止先跨租户召回再在应用层过滤。
- 上传文件、解析产物、缩略图和导出文件使用租户桶或前缀，并通过租户授权生成短时访问地址。
- 队列中的解析、嵌入、生成、发布和监测任务必须携带租户上下文；Worker 恢复失败时终止任务。
- 本地发布助手设备令牌只属于一个租户和设备，不能用账号组 ID 猜测或领取其他客户任务。
- 日志和平台运维访问同样受租户范围约束；任何显式跨租户支持操作均需授权、理由、时间范围与审计记录。

## 已核实的 GEOFlow 分发与官网契约

- 当前分发是服务端主动推送到 GEOFlow Agent、WordPress REST 或通用 HTTP，主要状态为 `queued / sending / synced / failed`。
- 幂等键、重试、远端 URL 和日志设计可以复用，但不能直接把现有分发描述成 Windows 本地发布助手。
- 官网已有动态主题、文章栏目、首页模块、SEO、表单和线索；结构化产品、案例、资质和 FAQ 实体仍需新增。

关键源码：`DistributionOrchestrator.php`、`ArticleDistribution.php`、`DistributionLog.php`、`LeadController.php`。

## 已核实的 GEORank 契约

- `POST /api/keywords/expand` 接收 `seeds: string[]`，最少 1 个、最多 8 个；输入会去空、去重，并将单词截到 40 个字符。
- 返回八个维度：`semantic`、`scenario`、`commercial`、`ranking`、`review`、`brand`、`question`、`technical`。
- 每条结果只有关键词、推荐分、商业分和原因。两个分数是模型判断或稳定模板回退分，不是搜索量、竞争度或真实排名。
- GEORank 后台已有词包保存、列表、详情、CSV 导出和删除。“勾选加入选题”“覆盖状态”“内容简报”属于统一后台新增的产品层。
- AI 失败时接口可能使用模板回退但仍返回成功。正式适配层应补充 `source=ai|fallback` 或运行元数据，避免运营人员误判来源。

关键源码：`backend/app/services/keyword_expansion.py`、`backend/app/models/keyword.py`、`backend/app/api/routes/keywords.py`、`backend/app/api/routes/admin.py`、`apps/admin/components/keywords/admin-keywords.tsx`。

## 效果监测的新增设计

GEOFlow 和 GEORank 当前源码中没有完整的多 AI 品牌监测引擎。正式版至少需要三层数据：

```text
monitor_question
  └─ monitor_run
       └─ monitor_sample
```

- `monitor_question`：问题、业务线、问题集、启停状态。
- `monitor_run`：固定问题集、平台、入口、执行时间、成功与失败数量。
- `monitor_sample`：单个问题在单个平台的一次原始回答、模型版本、提及、推荐、榜单排名、引用 URL、竞品和人工核验结果。

工作区旧产品模板中的 `TongzhuoGeoAnswerTest` 不是官方 GEOFlow/GEORank 能力，只能作为迁移参考。它把问题定义和最新采样放在同一条记录中，`sample()` 会更新原记录并覆盖上一次采样，无法支撑可信历史趋势。

正式指标只从有效样本计算，并显示分子/分母：

- 品牌提及率 = 提及品牌的有效样本 / 全部有效样本。
- 明确推荐率 = 明确推荐品牌的有效样本 / 全部有效样本。
- 官网引用率 = 引用 URL 命中企业官方域名的有效样本 / 全部有效样本。
- 排名只在回答存在明确有序榜单时记录在单个样本上，不计算没有共同口径的跨平台平均排名。
- 情感判断没有现成可靠字段；若正式新增，必须保存原回答、模型与人工核验依据。

## 0.4 演示数据说明

0.4 使用浏览器 `localStorage` 保存操作结果。企业完成度、文档/问答入库、RAG 检索、知识范围继承、引用证据、版本快照、平台采样、趋势、情感和异步执行均为界面演示，不代表服务器端接口、真实向量索引或真实 AI 平台采集已经完成。
