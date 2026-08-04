# 运营诊断真实分析引擎

运营诊断采用“证据先落库、模型后分析”的闭环。模型不能直接读取一堆表后自由下结论；Citation Lab、企业知识库和运营快照先被转换为带 ID 的证据，模型输出只能引用这些 ID，无证据结论会被删除或转为“证据不足”。

## 运行链路

```text
冻结客户问题集
  → Citation Lab 四平台全库确定性 FactPack
  → 可选的直接问题匹配与问题意图样本
  → 可选的企业知识库 RAG 与运营快照
  → 证据持久化
  → 已配置文本大模型结构化分析
  → 证据 ID、禁止指标与输出契约校验
  → 报告、建议和待确认回流动作落库
```

## AI 分析工作台

工作台提供面向运营人员的自然语言分析会话。用户先写清行业、目标平台、关注维度和期望输出；系统调用已配置模型把要求解析为可核对的研究计划。用户可以修改行业、豆包／DeepSeek／千问／元宝平台选择和代表问题，确认后才执行本地查询。确定性规划器只能从白名单中选择工具。模型不能直接访问数据库；工具结果会先写入 `analysis_tool_calls`，生成稳定 `evidenceId` 后才进入模型上下文。

研究计划接口：

- `POST /api/v1/analysis-plans`：解析自然语言要求并返回可编辑的行业、平台、研究维度、代表问题和受控工具计划；
- 研究计划只是查询方案，不是分析结论；
- 前端确认后的 `researchIntent` 会随会话创建请求保存，后台不会再次擅自改写用户确认的平台和问题。

正式接口：

- `GET /api/v1/analysis-sessions/options`：读取数据源、平台、深度和工具选项；
- `GET|POST /api/v1/analysis-sessions`：查询或创建分析会话；
- `GET|PATCH /api/v1/analysis-sessions/:id`：读取或更新会话；
- `DELETE /api/v1/analysis-sessions/:id`：删除报告会话及其全部版本、证据台账、运行记录和追问消息；请求体必须带 `{"confirm":true}`，运行中的会话会被拒绝删除；
- `POST /api/v1/analysis-sessions/:id/messages`：在上一版报告上下文中继续追问；
- `GET /api/v1/analysis-runs/:id`：读取工具执行进度与证据结果。

GET 接口要求 `workspace.read`；POST 和 PATCH 要求 `content.generate`。删除报告要求 `content.generate`，并且必须显式确认；删除会话会级联移除全部报告版本、证据台账、运行记录和追问消息，但保留审计日志。调用外部模型前必须显式传入 `externalDataConsent=true`，服务端只发送本次勾选的数据摘要，不发送 API Key。每次追问生成新的报告版本，旧版标记为 `superseded` 并继续保留，便于审计和回看。

工作台校验器除了拒绝不存在的 `evidenceId`，还会核对摘要、正文、结构化表格和建议中的统计数值；引用证据里找不到的数字不能进入正式报告。行业近似标签只表示可见标签匹配，不会被写成已经应用的目标行业 cohort。

Citation Lab 行业样本按以下顺序选择：

1. 精确行业标签；
2. 用户明确指定的问题 ID；
3. 代表问题的透明词法匹配；
4. 没有可靠命中时回退四平台全库历史基线。

当前数据包只有餐饮、美容美发、酒店民宿、休闲娱乐、婚庆摄影、保健养生六类直接行业样本。“GEO运营”等不在标签中的行业必须显示为“全库历史基线 + 行业策略推演”，不能伪装成行业实测。

工作台还会检索固定 commit 的 Citation Lab 仓库研究资料。仓库方法论、研究报告和数据契约使用独立的只读文档索引，返回文件路径、标题、片段、来源 URL、commit 和证据 ID；文档只补充研究口径，平台统计仍以已校验的只读 SQLite 为准。

模型最终只收到用户要求、最近会话上下文和受控工具证据摘要，不会收到 API Key、SQLite 文件或任意 SQL 权限。每个正式章节与执行建议必须引用本次运行持久化的 AFE 证据 ID。

诊断类型仍分为行业 GEO 策划、行业信源生态、官网与内容差距、综合诊断。它们使用同一证据底座，但模型根据项目类型、行业、目标和冻结问题集生成不同报告。

行业 GEO 策划和行业信源生态默认使用“研究专用模式”：只把诊断目标中的行业与分析要求，以及 Citation Lab 公开事实包交给模型；冻结问题保留在本地项目快照中但不发送，不读取企业知识库或运营快照。官网与内容差距诊断使用企业 RAG 与运营快照；综合诊断同时使用四平台事实包、逐问题研究匹配、企业 RAG 与运营快照，并在报告中分别标注证据层级。

## 四平台全库 FactPack

系统不会再先用客户问题过滤掉绝大部分研究数据。服务端先对 Citation Lab 全库执行确定性 SQL，合并网页端和移动端，生成豆包、DeepSeek、千问、元宝四个平台家族的事实包。事实包至少包含：

- 原始引用观察与 preferred 精确记录两种独立口径；
- 每平台问题数、信源数、页面数、域名数和每问均引；
- 历史样本平均引用位置及有效分母；
- 平均摘要长度、页面日期分布、信源分类和内容格式；
- 高频域名、平台独有域名和平台间域名重叠；
- 使用透明规则计算的问题类型 × 平台历史引用效率矩阵。

四目标平台家族的原始引用观察合计为 194,753 条：豆包 61,592、DeepSeek 34,767、千问 48,634、元宝 49,760。该数字由测试固定校验，模型不能重新计算或改写。

如果 Citation Lab 没有目标行业 cohort，报告仍可使用四平台全局历史基线，但必须明确写成“对目标行业的策略参考”，不得写成该行业直接实证偏好。

## Citation Lab 固定研究库

当前固定版本：

- 仓库：`yaojingang/geo-citation-lab`
- commit：`81ba1566f70f114e9202b798f8d4525a9329ebd3`
- 数据版本：`2.0.1`
- 发布日期：`2026-07-14`
- 引用观察：214,119 条
- 默认去精确重复后的研究观察：189,845 条
- 规范问题：620 个
- 平台／终端：12 个
- 信源：9,878 个
- 页面：107,659 个

运行制品是只读 SQLite：

```text
research-packages/geo-citation-lab/2.0.1/derived/citation-research.sqlite
```

客户服务器运行 Node 时直接读取该库，不依赖 Python 或 DuckDB。源 DuckDB 与 Parquet 只用于受控构建，不进入空白私有化交付包。

构建与校验：

```powershell
npm run build:citation-research
npm run check:citation-research
```

构建器会校验固定 commit、文件字节数、SHA-256、Schema、发布日期和行数，使用临时文件构建并原子替换正式制品。来源 pin 位于：

```text
research-packages/geo-citation-lab/2.0.1/upstream/.citation-research-pins.json
```

## Citation Lab 安全更新

后台“数据与规则”每天自动检查一次姚金刚官方仓库的 Release 与 commit，但不会自动覆盖当前生产版本。统计数据库和仓库研究资料采用两条独立版本链：更新研究文档不会改变固定统计数据，升级统计包也不会让文档索引失效。管理员可以分别完成检查、隔离暂存、校验、激活和回滚。

统计数据包接口：

- `GET /api/v1/citation-package-updates/status`：读取当前版本、候选版本、检查结果和回滚版本；
- `POST /api/v1/citation-package-updates/check`：立即检查官方上游；
- `POST /api/v1/citation-package-updates/stage`：显式确认后下载到隔离暂存目录；
- `POST /api/v1/citation-package-updates/validate`：校验文件字节数、SHA-256、许可、Schema、SQLite 完整性、来源 commit 和统计行数；
- `POST /api/v1/citation-package-updates/activate`：显式确认后原子切换活动版本；
- `POST /api/v1/citation-package-updates/rollback`：切回仍然保留的历史版本。

如果官方仓库只有源码 commit 变化，却没有符合数据包契约的完整 Release 资产，页面只显示“发现仓库变化、暂无可安装数据包”，禁止把源码更新伪装成研究数据升级。生产目录不会执行 `git pull`。完整更新契约见 `docs/CITATION-LAB-PACKAGE-UPDATES.md`。

仓库研究资料接口：

- `GET /api/v1/citation-document-updates/status`：读取当前文档 commit、候选快照、校验状态和回滚快照；
- `POST /api/v1/citation-document-updates/check`：检查姚金刚官方仓库 HEAD commit，并读取固定 commit 的 Git tree；
- `POST /api/v1/citation-document-updates/stage`：只下载白名单内 Markdown、HTML、JSON 和文本资料；
- `POST /api/v1/citation-document-updates/validate`：逐文件核验 Git blob SHA、SHA-256、UTF-8、许可、路径、字节数、数量和语料阈值；
- `POST /api/v1/citation-document-updates/activate`：原子切换 `document-active.json`，当前后台同时热加载新的只读索引；
- `POST /api/v1/citation-document-updates/rollback`：切回仍然保留的已验证文档快照。

文档更新不执行 Git 命令、不解压上游归档、不运行仓库脚本，也不下载论文 PDF、大型数据库或原始数据。数据报告会分别记录统计数据版本和文档来源 commit；两者不同时必须显示 `DOCUMENT_DATASET_COMMIT_DIFFER` 边界，文档观点不能改写统计事实。

## 企业知识库 RAG

非研究专用模式下，每个冻结问题会在当前业务线的已审核、已索引知识中执行语义与关键词混合检索。命中的知识片段作为企业证据写入诊断运行；未命中时写入明确的知识缺口，不由模型补写企业事实。

默认只发送本次问题命中的相关片段，不发送整个知识库。报告保留知识检索 run、文档、版本、分块、定位和相关度等来源信息。

## 大模型与数据发送确认

运营诊断必须选择已启用且保存 API Key 的文本模型。研究专用模式调用外部模型前，前端明确提示只发送：

1. 诊断目标中的行业与分析要求；
2. Citation Lab 四平台公开统计事实包。

该模式不会发送冻结问题，也不会读取或发送企业知识片段、官网运营快照、API Key 或整库资料。官网与内容诊断若启用组合证据模式，前端会另行明确提示企业数据范围。

用户确认后请求才携带 `externalDataConsent=true`。服务端没有该字段会以 `DIAGNOSTIC_EXTERNAL_MODEL_CONSENT_REQUIRED` 拒绝请求；同意时间、模型供应商和操作者随诊断运行及审计记录保存。API Key 永远只在服务端解密使用，不进入提示词或报告。

私有模型也可以通过 OpenAI Compatible 接口接入。若企业规定数据不得出网，应把模型 Base URL 指向客户内网推理服务。

## 报告契约和证据门禁

模型必须返回：

- `executiveSummary`
- `findings[]`
- `questionInsights[]`
- `sourceStrategy[]`
- `knowledgeAndSiteGaps[]`
- `roadmap[]`
- `recommendations[]`
- `limitations[]`
- `methodology`
- `model`

正式发现、问题洞察、信源策略、路线图和建议都必须引用本次运行中状态为 `supplied` 或 `verified` 的证据 ID。目录外 ID 会被移除；移除后没有有效证据的内容会转入证据缺口。

四平台 FactPack 作为结构化数据整体进入提示词，不受单条证据摘要 800 字限制；逐问题证据仍按客户问题轮询抽取。完整证据保留在数据库中，不因提示词裁剪而丢失。

## 明确禁止的推断

当前 Citation Lab 的 `responses.parquet` 为 0 行，并且缺少完整回答、可靠 `response_id`、逐回答模型版本和统一采集时间。因此本引擎禁止从固定研究包推断：

- 当前或实时品牌排名；
- 推荐率、引用率、提及率；
- 情感倾向；
- 实时趋势；
- 未经实时采样支持的当前严格引用位置；固定历史样本的平均引用位置可以作为描述性指标；
- 单次完整回答结论；
- 模型版本优劣。

校验器会扫描结构化字段和中英文文本，移除这些越界结论。研究数据中的计数只表示匹配问题下的历史引用观察，不是客户效果指标。

## 报告回流

模型建议先生成 `proposed` 状态的待确认动作，可回流问题词库、知识缺口、官网 CMS、内容计划或发布策略。用户逐项确认后才执行；报告生成不会自动修改官网、创建发布任务或对外发布内容。

## 许可与署名

- 代码：MIT。
- GEO Citation Lab 自创报告、文档和目录元数据：CC BY 4.0。
- 上游：WENDAOstudy/cn-geo-citation-dataset。
- 第三方标题、URL、站点名和摘要保留原权利与平台条款。

私有化交付包必须保留 `LICENSE`、`LICENSE-CODE`、`LICENSE-CONTENT`、`THIRD_PARTY_NOTICES.md`、`NOTICE-PINS.json`，并说明本系统执行了固定提交校验和只读 SQLite 转换。

## 验收

```powershell
npm run check:citation-research
npm run check:diagnostics
npm run check:analysis-workbench
```

其中真实引擎集成测试使用正式 Citation Lab SQLite、正式诊断数据库和研究专用模式，模型部分使用本地确定性契约实现，不会把测试资料发送到外部服务。生产页面需由用户确认数据发送范围后，才能调用配置的大模型。
