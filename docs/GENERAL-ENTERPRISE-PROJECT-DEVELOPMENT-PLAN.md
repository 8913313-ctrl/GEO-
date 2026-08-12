# 桐灼企业项目系统：面向低能力 AI 的详细开发计划

版本：v1.0  
日期：2026-08-11  
适用仓库：`GEO-`  
执行原则：先打通“桐灼 GEO”第一项目，再用同一母版生成“建材企业”第二项目。

> 这是一份施工说明，不是一份只讲方向的路线图。执行 AI 不需要自己猜架构；每次只能完成一个任务编号，验收通过后才能继续。

---

## 1. 项目定义：先理解对，再开始写代码

### 1.1 一句话产品定义

这是一个“可复制的 GEO 企业数字身份与内容运营系统”。每个购买 GEO 服务/系统的企业老板都有独立项目：自己的官网、GEO 运营后台、发布执行器和数据中转服务。系统把企业真实资料、产品、服务、客户问题与内容，整理为可被客户和 AI 准确理解、引用与持续更新的公开身份。

GEO 是这套产品卖给所有客户的核心能力和共同方法论，不是一个行业模板；“桐灼”只是第一个客户项目，不能成为所有客户的固定品牌。建材、机械、医疗等才是客户所属的行业适配模板。

### 1.2 正确的项目关系

~~~text
GEO 运营系统母版
├── 项目 A：桐灼 GEO
│   ├── 桐灼企业官网
│   ├── GEO 运营后台
│   ├── 发布执行器
│   └── 数据中转站
├── 项目 B：建材企业
│   ├── 建材企业官网
│   ├── GEO 运营后台
│   ├── 发布执行器
│   └── 数据中转站
└── 项目 C、D……：其他行业企业
~~~

禁止把桐灼官网复制一份后手工改成建材官网。正确方式：从母版生成新客户实例，只替换配置、品牌资源和种子数据。

### 1.3 四层边界

| 层 | 包含什么 | 例子 | 生命周期与边界 |
|---|---|---|---|
| 通用能力 | 企业身份、产品、服务、案例、问题、知识、内容、审核、发布、监测、线索 | `companyProfile`、文章审核状态 | 写通用业务规则，不能写具体企业品牌 |
| GEO 系统底层知识资产 | GEO 方法论、生成提示词、质量规则、输出结构、引用规则、评估样例 | “企业身份建设”“问题地图”“文章引用约束” | 所有购买 GEO 的客户共用；系统统一维护、版本化、审核发布 |
| 行业适配模板 | 该行业的字段、术语、默认问题、内容类型和补充规则 | `building-materials`、`machinery`、`medical` | 在 GEO 底座上补充行业差异，不存客户事实 |
| 项目数据 | 企业名称、Logo、产品、案例、联系人、企业知识和文章 | 桐灼、某建材公司 | 必须带 `tenant_id`，完全隔离 |

### 1.4 底层知识资产的正确位置

你说的“怎么做好 GEO”、文章生成提示词、内容质量标准，确实应该是所有 GEO 客户共用的系统底层资产，不能每个客户重新写，也不能直接散落在 JavaScript 字符串里。

底层资产再分两个范围：

1. **GEO 核心范围**：所有购买 GEO 系统的客户都复用的企业数字身份、问题地图、官网事实、内容与引用、发布复盘、禁止夸大、文章版本、审核和隐私规则。
2. **行业适配范围**：只给某一客户行业复用的专业补充包。例如建材工艺参数、采购问题、规格写法属于 `building-materials`；机械选型、型号参数和售后问题属于 `machinery`。

桐灼、建材、机械等每个客户项目都会使用同一套已发布的 GEO 核心方法包，再叠加各自的行业适配包和企业知识。建材项目不是“不继承 GEO”，而是必须继承 GEO 核心能力，同时不继承桐灼的品牌、知识、案例和客户数据。

### 1.5 客户实际购买的东西

每一个客户买到的都是同一套 GEO 系统，不是“某行业专用后台”：

~~~text
必选：GEO 核心能力
      企业数字身份 → 问题地图 → 企业知识 → 内容生成 → 审核 → 官网/外部发布 → 监测复盘
可选：行业适配包
      建材 / 机械 / 医疗等行业字段、术语、默认问题、内容类型
必填：客户项目配置与企业数据
      品牌、Logo、官网、产品、真实事实、案例、联系人、发布渠道
~~~

所以，建材老板买到的是“适配建材业务的 GEO 系统”，不是一个脱离 GEO 的建材管理软件；桐灼自己的官网和运营数据只是该产品的第一套示范/客户项目。

### 1.6 现阶段交付模式

正式模式是“一企业一部署”：客户服务器运行后台、数据库、官网、任务服务；运营人员的 Windows 电脑运行本地发布执行器。数据对象仍保留 `tenant_id`，为未来隔离做准备；当前不要改成共享 SaaS，不做套餐、收费、自助注册。

---

## 2. 执行 AI 的不可违反规则

1. 一次只做一个任务编号，例如 `P2-T03`，不要顺手做别的。
2. 先读任务列出的文件，再用 `rg` 确认函数、路由、字段真实存在；找不到就停止报告，不能猜。
3. 没有被任务明确列出的文件视为禁止修改；不能为了“顺便优化”改数据库、CSS、接口或依赖。
4. 不换框架、不重新初始化项目、不升级依赖、不删除已有功能；禁止 `git reset --hard`、`git checkout --` 和递归删除。
5. `localStorage` 不是正式数据源，只能作断网临时缓存。
6. 禁止把“桐灼”“灼见”或任一客户的服务文案写死到通用渲染器、通用 API、数据库规则或通用组件；GEO 的通用业务规则可以作为产品底座存在，但公开页面文案仍必须来自项目配置或行业适配数据。
7. 提示词、方法论、质量规则不得只存在代码常量或聊天记录中；必须进入版本化底层资产。已发布资产不可原地覆盖，只能创建新版本。
8. 每次文章生成必须冻结：行业方法包版本、提示词模板版本、变量渲染结果、写作智能体快照、实际模型和知识范围；历史文章不能因以后改提示词而静默变化。
9. 客户可复制系统内置提示词生成“项目自定义版本”，但不能直接改写系统已发布版本；自定义版本仍要审核、版本化和按 `tenant_id` 隔离。
10. 禁止提交截图、QA Profile、`.env`、Cookie、Token、模型 Key、浏览器 Profile、客户数据库、日志、构建产物和 `node_modules`。
11. 浏览器不能直连数据库；官网只通过服务端读取公开发布快照；后台使用受保护 API。
12. 不允许删测试、跳过审核、伪造已发布、伪造实时监测，或用 Mock 结果冒充真实结果。
13. 每 3–5 个小任务才可提交一次 Git；提交前运行任务验收和 `git diff --check`。
14. 命令或测试失败时立刻停止，保留错误、命令和修改，不得绕过后继续开发。
15. 生产部署、数据库迁移、密钥轮换、登录外部平台，都必须由负责人明确授权；本计划默认只在本地开发。

每次任务结束必须按以下格式回复：

~~~text
任务编号：P?-T??
修改文件：……
执行前检查：命令及结果
实际修改：1–3 句话
验收命令：命令及结果
未完成/风险：没有就写“无”
下一步：只建议下一个任务编号，不得自动执行
~~~

---

## 3. 当前仓库地图

| 目录 | 唯一职责 | 本计划中的定位 | 不允许做什么 |
|---|---|---|---|
| `tongzhuo-geo-platform-demo/` | GEOFlow 后台与正式业务后端 | 第一客户项目的后台、知识、审核、CMS、线索、监测、发布任务 | 不变成只服务桐灼的硬编码后台；浏览器不直连 SQLite |
| `tongzhuo-geo-platform-demo/public-site/` | 官网渲染、公开数据、官网资源与线索入口 | 桐灼官网；今后读取发布快照 | 不把 `FRONTEND_*` 演示常量当生产数据 |
| `geo-data-hub-demo/` | 中央中转站、HMAC、队列、积分、delivery/ACK | 先 Mock 验证，后接真实中转 | 浏览器不能接触中转站密钥 |
| `publisher-assistant/` | 旧版 Windows 本地发布助手 | 兼容和迁移参考 | 不上传账号、Cookie、验证码、Profile |
| `tongzhuo-product-template/` | 客户实例、桌面执行器、官网和交付包母版 | 生成桐灼、建材等客户实例 | 母版不保存客户秘密和运行数据 |
| `demo-company-homepage/` | 旧官网原型 | 仅历史参考 | 当前官网不是它渲染的，禁止误改 |
| `server-integration-copy/` | 旧服务端覆盖层 | 仅迁移参考 | 不能再启动为第二套正式业务逻辑 |
| `docs/` | 架构、部署、计划、安全 | 记录决策与验收 | 不写真实密钥与客户数据 |

### 3.1 启动命令和端口

运行任何服务前先查端口。不要结束未知进程。

~~~powershell
Get-NetTCPConnection -State Listen | Sort-Object LocalPort
~~~

| 组件 | 目录 | 命令 | 默认/当前常用端口 |
|---|---|---|---|
| GEOFlow 后台 | `tongzhuo-geo-platform-demo/` | `npm start` | `43127` |
| 官网 | 同上 | `npm run start:site` | 以 `site-server.mjs`/`.env.lan` 为准；曾用 `18080` |
| 官网 LAN | 同上 | `npm run start:site:lan` | 以 `.env.lan` 为准 |
| 数据中转站 | `geo-data-hub-demo/` | `npm start` | `43280` |
| 旧发布助手 | `publisher-assistant/` | `npm start` | `18180` |
| 旧发布服务 | `publisher-assistant/deploy/` | 依 README | `18181` |
| 新桌面执行器 | `tongzhuo-product-template/desktop-agent/` | `npm start` | `18280` |

端口冲突时只修改本地 `.env` 或已明确的配置项，并记录新端口；禁止在多处代码里替换数字。

---

## 4. 目标架构和数据权威

~~~mermaid
flowchart LR
  V["官网访客"] --> S["客户官网\n公开发布快照"]
  S --> L["预约诊断/线索 API"]
  L --> F["GEOFlow 后台\n项目数据与审核"]
  F --> K["企业知识库"]
  K --> C["内容计划和文章版本"]
  C --> R["审核/风控"]
  R --> SR["官网发布版本"]
  R --> J["外部发布任务"]
  J --> A["Windows 发布执行器\n本地浏览器 Profile"]
  A --> P["公众号、知乎、头条等"]
  A --> F
  F <-->|"HMAC + timestamp + nonce"| H["数据中转站"]
  H --> D["队列、积分、Delivery、ACK"]
~~~

权威数据来源必须固定：

- 后台数据库：业务对象的唯一权威。
- `site_release`：官网可公开内容的唯一权威。
- 中转站：跨实例任务和结果交付的权威，不负责官网和客户全量数据。
- 发布器本地 Profile：外部平台登录态的唯一存放位置。
- 浏览器缓存：不是权威数据。

---

## 5. 阶段顺序（不允许跳阶段）

| 阶段 | 目标 | 通过条件 |
|---|---|---|
| P0 | 建立规则、基线和报告格式 | 当前分支、端口、检查结果都可查 |
| P1 | 盘点并冻结工程 | 四组件启动/检查方式和唯一职责确认 |
| P2 | 抽象 GEO 核心、客户项目和行业适配 | 所有项目共用 GEO 底座，代码不依赖桐灼常量，配置可描述企业 |
| P3 | 官网数据化 | 官网读取项目公开数据，不依赖演示常量 |
| P4 | 官网版本化 | 草稿、审核、预览、发布、回滚可验收 |
| P5 | 打通官网线索 | 预约诊断进入正确项目后台 |
| P6 | 打通发布闭环 | 审核文章→任务→本机发布→结果回写 |
| P7 | 桐灼 GEO 端到端 | 一条真实项目链路有全部证据 |
| P8 | 建材第二项目 | 不复制源码、数据完全隔离 |
| P9 | 模板化交付 | 可预检、打包、验收、备份、交接 |

没有完成 P2 不得生成建材项目；没有完成 P7 不得对外说系统已打通。

---

## 6. 逐任务施工卡

每张卡可独立交给一个小白 AI。任务未写的文件都不能动。

### P0：建立规则与基线

#### P0-T01 建立工作区基线

**目标**：记录当前分支、commit、未提交改动、Node 版本和监听端口。  
**允许修改**：仅 `docs/baseline/` 中新增记录；也可以只输出报告。  
**禁止修改**：所有业务代码、配置、运行进程。  
**执行命令**：

~~~powershell
git status --short --branch
git log -1 --oneline
node --version
Get-NetTCPConnection -State Listen | Sort-Object LocalPort
~~~

**完成标准**：报告能回答“在哪个分支、当前 commit、有哪些用户改动、哪些端口已占用”。  
**失败处理**：命令失败即停，逐字报告错误。

#### P0-T02 记录检查基线

**目标**：验证已存在的重点检查。  
**允许修改**：无。  
**执行命令**：

~~~powershell
cd tongzhuo-geo-platform-demo
npm run check:site
node scripts/check-ai-generation-service.mjs
node scripts/check-planning-generation-flow.mjs
node scripts/check-citation-visibility.mjs
git diff --check
~~~

**完成标准**：每条命令的成功或失败原因都被记录。完整 `npm run check` 仅因 Citation Lab 数据库缺失而失败时，标记为 `CITATION_RESEARCH_NOT_INSTALLED`，不删除检查，不把它伪装成通过。

### P1：盘点和冻结

#### P1-T01 逐组件启动验证

**目标**：验证后台、官网、中转站、发布器的启动入口，不改代码。  
**允许修改**：无。  
**步骤**：

1. 阅读对应 README 和 `package.json` scripts。
2. 只启动本任务自己的进程，使用空闲端口或本地配置。
3. 访问健康地址或首页。
4. 记录进程 PID、端口、地址和关闭方式。
5. 关闭本任务自己启动的进程。

**验收命令**：

~~~powershell
cd tongzhuo-geo-platform-demo; npm run check:site
cd ..\geo-data-hub-demo; npm run check:relay
cd ..\publisher-assistant; npm run check
cd ..\tongzhuo-product-template; .\scripts\Test-Template.ps1
~~~

#### P1-T02 确认唯一正式后端

**目标**：正式业务后端固定为 `tongzhuo-geo-platform-demo/`。  
**允许修改**：仅架构文档。  
**完成标准**：文档写明 `demo-company-homepage/` 与 `server-integration-copy/` 只作参考，不能同时承载同一业务或同一数据库写入。

#### P1-T03 冻结可回退起点

**目标**：完成 P1 检查后留下干净可回退 commit。  
**允许修改**：无业务文件。  
**步骤**：先运行全部 P1 验收；确认没有本任务产生的未提交业务修改；由负责人决定创建 tag 或基线分支。  
**完成标准**：能用 `git show <commit>` 查看冻结点。

### P2：抽象 GEO 核心、客户项目和行业适配

当前进度（2026-08-12）：`P2-T01` 至 `P2-T07` 已完成。`P2-T06` 已完成本地资料审计、六主题切分、16 条规则来源定位/SHA-256、外部 19 来源登记、审批发布门、按任务选择方法片段和 6 类生成测试；负责人确认后已不可变发布 `MVER-GEO-CORE-V1`。`P2-T07` 已不可变发布 `PVER-GEO-ARTICLE-V1` 与 `QRULE-GEO-CONTENT-V1`；新内容计划由当前私有化部署的服务端自动冻结允许使用的已发布版本，浏览器不能指定底层版本，已绑定的历史计划不会因后续新版静默升级。外部来源重新提炼的 12 条工程治理规则仍为候选，未取得完整可复核正文定位和许可前不得并入正式方法论。

#### P2-T01 建立项目配置契约

**目标**：用配置表达“一家企业是什么、行业是什么、网站如何展示、服务如何连接”。  
**允许修改**：负责人指定的配置目录和示例配置；不改渲染器。  
**建议最小结构**：

~~~json
{
  "project": {"slug": "tongzhuo-geo", "name": "桐灼 GEO", "status": "active"},
  "tenant_id": "tenant_tongzhuo_geo",
  "product_capability": "geo",
  "industry_template": "professional-services",
  "company_profile": {"legal_name": "", "short_name": "", "description": "", "region": ""},
  "brand": {"logo_path": "", "primary_color": "", "secondary_color": "", "font_family": ""},
  "site": {"domain": "", "title": "", "navigation": [], "footer_icp": ""},
  "contact": {"email": "", "phone": "", "wechat": "", "reply_sla": "1 个工作日"},
  "integrations": {"geoflow_base_url": "", "relay_enabled": false}
}
~~~

**强制约束**：不能同时用 `customerId`、`client_id`、`tenant` 三种同义主键，选定一套命名后统一。  
**完成标准**：复制配置改值即可描述建材企业，通用代码不用改公司名。

#### P2-T02 检查并补齐 `tenant_id`

**目标**：企业、业务线、知识、内容、线索、发布任务、资产、监测等对象都能属于一个项目。  
**允许修改**：一次只处理一个对象族的模型、存储层、迁移和测试。  
**步骤**：

1. 先 `rg -n "tenant_id"` 搜索现有实现。
2. 已有字段不要擅自重命名。
3. 缺字段时先提交迁移设计，获得批准后才写迁移。
4. 加字段后，创建、列表、详情、更新、删除、导出、后台任务、索引都加项目过滤。
5. 写跨项目读取拒绝测试。

**完成标准**：仅加字段而查询不加过滤视为失败；项目 A 永远读不到项目 B 数据。

#### P2-T03 将桐灼内容迁为种子数据

**目标**：桐灼服务、案例、问题组、文章、品牌不再是通用业务常量。  
**允许修改**：项目配置、种子数据、对应测试。  
**禁止修改**：通用渲染器逻辑。  
**完成标准**：新建空项目后，不出现桐灼名、桐灼专属 GEO 服务、桐灼联系方式或桐灼案例。

#### P2-T04 定义行业适配模板接口

**目标**：行业适配模板仅提供该行业默认值，不持有客户数据，也不替代 GEO 核心能力。  
**最小字段**：`templateKey`、`displayName`、`requiredFields`、`defaultQuestionGroups`、`contentTypes`、`terminologyPack`、`promptPreset`、`navigationPreset`。  
**完成标准**：`building-materials` 和 `machinery` 能走同一注册方式；它们都继承同一 GEO 核心方法包；新增第三行业不需要复制整套后台。

#### P2-T05 建立系统底层知识资产库

**目标**：把“如何做好 GEO”、文章生成提示词、输出结构、引用规则、审核规则和质量样例，从散落的代码与文档中提取为可管理的系统资产。

**只允许修改**：负责人指定的资产目录、资产存储/API、初始化脚本与对应测试；本任务不能改官网样式、发布器或客户项目数据。

**最小对象**：

| 对象 | 必填字段 | 用途 |
|---|---|---|
| `methodology_packs` | `key`、`scope`、`industry_template`、`title`、`status` | 一套可复用的方法论，如所有客户共用的 GEO 建设方法 |
| `methodology_versions` | `pack_id`、`version`、`content`、`sources`、`checksum`、`published_at` | 发布后不可改的正文与来源 |
| `prompt_templates` | `key`、`scope`、`industry_template`、`operation`、`status` | 文章、问题、诊断等任务的提示词模板 |
| `prompt_versions` | `template_id`、`version`、`system_prompt`、`user_template`、`variables_schema`、`output_schema`、`quality_rules`、`checksum` | 一次真正可执行的提示词版本 |
| `quality_rule_packs` | `key`、`scope`、`rules`、`version`、`status` | 事实、引用、合规、结构和风控规则 |
| `prompt_test_cases` | `prompt_version_id`、输入夹具、预期规则、状态 | 防止提示词升级后输出退化 |

**作用域约束**：`scope` 只能为 `global`、`industry` 或 `project`。本产品中的 `global` 就是所有客户必用的 GEO 核心资产，不代表与 GEO 无关的通用软件；行业资产必须带 `industry_template`；项目自定义资产必须带 `tenant_id`。

**完成标准**：创建一个 `geo-core` 方法包与一个 GEO 文章提示词版本后，桐灼和建材两个内容计划都能引用同一版本 ID，而不是各自复制“如何写 GEO 文章”。

#### P2-T06 审计并导入 `ups_geo` / 既有 GEO 资料

**目标**：把现有“如何做好 GEO”的资料变成经过审查的 `geo-core` 底层方法包，而不是直接整段塞入模型提示词。

**修改前必做**：先找到资料的真实路径、文件清单、来源、作者/版权和最后修改时间。当前仓库根目录未发现名为 `ups_geo` 的目录时，必须让负责人提供准确路径；不得凭空生成或假称已导入。

**操作步骤**：

1. 列出每份源文件的路径、标题、来源和许可/使用范围。
2. 按主题切分：企业数字身份、官网事实、问题地图、内容与引用、发布与复盘、风险边界。
3. 每段保留来源定位和 SHA-256；不保留来源不明的事实结论。
4. 由负责人审核后，发布为 `geo-core-methodology-v1`，不得覆盖旧版本。
5. 写至少 5 条检索和生成测试：必须覆盖“不能编造事实”“必须引用企业审核知识”“不得把研究基线说成实时表现”等规则。

**完成标准**：每条 GEO 方法规则都能追溯到来源；模型调用只拿本次需要的片段和版本号，不盲目塞入整库。

#### P2-T07 建立提示词版本与冻结机制

**目标**：把生成文章的提示词从 `ai-generation-service.mjs` 等实现细节中抽象为“模板 + 版本 + 变量 + 质量规则”。

**变量最小集**：`company_profile`、`business_line`、`topic`、`customer_question`、`content_type`、`knowledge_scope`、`retrieved_evidence`、`methodology_version`、`output_schema`。

**禁止**：把客户所有知识全文、Token、内部日志或别的租户数据送入提示词。

**生成冻结顺序**：

~~~text
选择 GEO 核心能力
→ 选择已发布的 GEO 核心方法包版本
→ 选择可选的行业适配包版本
→ 选择已发布的提示词版本
→ 注入当前项目允许使用的企业知识
→ 渲染提示词
→ 生成
→ 保存 GenerationRun / generationSnapshot
~~~

**完成标准**：现有 `writingAgentSnapshot` 与 `GenerationRun.promptVersion` 继续保留；新增机制只补齐“方法包版本、模板版本、变量和渲染结果”，不得破坏历史记录。

**完成记录（2026-08-12）**：已发布 `PVER-GEO-ARTICLE-V1`（checksum `52395b4cb7687facb1d2c64a77ff3be439a601b5894c26b8b7aaa87f7c42d81a`）和 `QRULE-GEO-CONTENT-V1`（checksum `f6e85605ea02fa0e0705947e8835e24644ed7b1a3baf4a810ffca9bebe99fa67`），包含 6 条活动提示词测试。负责人确认后通过幂等发布命令完成正式发布；已验证已发布记录不可修改。内容计划创建、服务端版本选择与冻结、变量白名单、渲染快照、写作智能体快照、跨部署/行业边界及重复发布幂等性均已通过自动检查；浏览器请求不能指定或替换底层版本。

### P3：官网从演示数据改为项目公开数据

当前进度（2026-08-12）：`P3-T01` 至 `P3-T03` 已完成。`P3-T01` 的只读审计报告见 `docs/baseline/P3-T01-OFFICIAL-SITE-DATA-ENTRY-AUDIT-20260812.md`。`P3-T02` 已在官网渲染最终出口建立统一演示安全门：仅当非生产环境、`TZ_SITE_FRONTEND_DEMO` 显式为真且当前项目快照允许演示时，才可使用演示占位；未配置默认关闭，生产环境即使误设为真也拒绝，CMS 明确空数组不会回退，正式记录优先。`P3-T03` 已将公开官网固定到当前企业的正式 release 指针，发布快照不可修改/删除，跨企业发布指针和回滚来源由数据库拒绝，损坏指针由应用层失败关闭；官网文章继续按当前企业、已发布、已审核、已冻结且风险通过的版本读取。导航、服务、案例、问题、文章、栏目、详情查找、Sitemap 与 `llms.txt` 已纳入自动检查，`npm run check:site` 通过。

#### P3-T01 盘点官网数据入口

**目标**：确认 `site-renderer.mjs`、`site-store.mjs`、`lead-store.mjs`、CMS API 的数据流。  
**允许修改**：无，只输出报告。  
**必须搜索**：

~~~powershell
rg -n "FRONTEND_SERVICES|FRONTEND_CASES|FRONTEND_ARTICLES|FRONTEND_PROBLEM_GROUPS|frontendDemo|site_release" tongzhuo-geo-platform-demo
~~~

**完成标准**：写清每个页面当前数据来源，列出所有演示回退的位置。

#### P3-T02 把演示数据改成显式开发开关

**目标**：生产模式默认不展示演示内容；只有明确开发配置时才允许回退。  
**允许修改**：`tongzhuo-geo-platform-demo/public-site/site-renderer.mjs`、明确的配置文件、对应检查脚本。  
**禁止**：删除演示数据、把 `frontendDemo` 默认设为生产开启。  
**完成标准**：生产模式只显示审核且公开的内容；开发模式才显示演示占位。

**完成记录（2026-08-12）**：新增 `scripts/check-site-demo-fixtures.mjs`，覆盖默认关闭、显式开发开启、生产强制拒绝、空 CMS 不回退、正式内容优先、演示详情不可直接查找及机器可读输出不泄漏。部署配置样例固定 `TZ_SITE_FRONTEND_DEMO=false`；演示常量保留但不再作为隐式数据源。

#### P3-T03 官网只读公开发布快照

**目标**：官网读取当前项目最新的已发布版本，而不是草稿、未审核或跨项目数据。  
**建议对象**：`site_release`、`site_release_items`，至少记录 `tenant_id`、版本号、状态、内容快照、创建人、发布时间、回滚来源。  
**完成标准**：发布文章后官网可见；保存草稿不公开；切换项目不会混出另一企业内容。

**完成记录（2026-08-12）**：新增数据库迁移 `official_site_release_tenant_boundary`，约束 `site_cms_publications` 必须指向同一 `workspace_id`、同一版本号的 release，回滚来源必须属于同一企业，已生成 release 禁止修改和删除。`SiteCmsStore.publication()` 使用企业 + release + 版本三重 JOIN，异常记录返回 `SITE_CMS_PUBLICATION_INVALID` 并停止公开读取。新增 `scripts/check-site-public-snapshot.mjs`，在同一测试数据库创建建材和机械两家企业，验证草稿与正式 release 隔离、发布后切换、正式/草稿文章门、跨企业内容隔离、数据库拒绝篡改及旧损坏数据失败关闭。

### P4：官网版本、预览和回滚

当前进度（2026-08-12）：`P4-T01` 至 `P4-T03` 已完成。官网 CMS 整体发布流程已建立 `draft → pending_review → approved → published → unpublished` 与 `pending_review → rejected → draft` 状态机；未审核不能生成正式 release，审核中和已批准草稿锁定修改，非法跳转在存储层与真实 HTTP API 均返回 409。每次转换记录操作者、时间、原因及审计日志；下线停止公开页面但保留健康检查和不可变 release。草稿预览仅对已登录运营人员及其鉴权资产开放，页面与响应头双重 `noindex,nofollow`，不输出正式 canonical、Open Graph URL、JSON-LD 或 RSS 发现入口，不进入 Sitemap/RSS，也不改变正式官网。回滚只能选择当前企业的历史 release，必须填写原因并校验当前版本；恢复时创建版本号递增的新 release，历史行不可修改，官网立即读取新回滚版本。

#### P4-T01 发布状态机

**状态图**：

~~~text
draft → pending_review → approved → published
                  └────→ rejected
published → unpublished
~~~

每个状态变化都必须有操作者、时间、原因和审计记录。  
**允许修改**：CMS 存储/API、发布服务、测试。  
**禁止**：同一任务混入视觉样式改动。  
**完成标准**：非法跳转返回 4xx；未审核不能创建正式发布版本。

**完成记录（2026-08-12）**：新增数据库迁移 `official_site_cms_workflow_state`，新增 CMS API `submit-review`、`approve`、`reject`、`unpublish`，正式 `publish` 强制要求 `approved`。新增 `scripts/check-site-workflow-state.mjs`，覆盖全部合法/非法转换、审核锁、驳回修订、操作者、时间、原因、审计记录、正式发布和下线；真实后台 API 从 `published` 非法直达 `approved` 返回 `409 SITE_CMS_INVALID_TRANSITION`。文章发布自动同步官网行业资讯时复用同一审核链，不直接绕过发布门。

#### P4-T02 草稿预览

**目标**：运营可预览，搜索引擎不可收录。  
**要求**：预览页明确标“CMS 草稿预览”，带 `noindex,nofollow`，不写入 sitemap、RSS、正式 canonical 和正式结构化数据。  
**完成标准**：预览不会影响正式官网内容。

**完成记录（2026-08-12）**：预览页标题和顶部状态条明确标注“CMS 草稿预览”，并说明仅供已登录运营人员查看、尚未影响正式官网；HTML robots 与 `X-Robots-Tag` 同时使用 `noindex,nofollow,noarchive,nosnippet,noimageindex`，响应为 `no-store`、`no-referrer`。预览不输出 canonical、Open Graph URL、正式结构化数据和 RSS alternate；CSS、JS、GSAP 只通过相同鉴权边界的 `/api/v1/site-cms/preview/assets/*` 加载。真实会话测试验证匿名预览和资产均返回 401，草稿标记不进入正式首页、Sitemap 或 RSS。

#### P4-T03 回滚

**目标**：从旧发布快照创建新发布版本恢复，不能覆盖历史。  
**完成标准**：版本号递增；审计记录源版本与目标版本；官网展示新回滚版本。

**完成记录（2026-08-12）**：回滚拒绝当前 release、缺失原因、并发版本冲突及跨企业 release；成功操作把历史快照复制为新的 `operation=rollback` release，同步产生新草稿 revision，将 workflow 恢复为 `published`，不复用或覆盖历史记录。审计记录回滚前 release/版本、被恢复 release/版本、新 release/版本、操作者、时间和原因。新增 `scripts/check-site-rollback-http.mjs`，通过真实管理员会话完成 v1→v2→回滚新 v3，逐字段验证 v1/v2 不变、跨企业 ID 返回 404、官网从 v2 内容实时切换回 v1 内容；生产备份/恢复 v2 检查通过。

### P5：官网线索打通后台

当前进度（2026-08-12）：`P5-T01` 至 `P5-T03` 已完成。官网线索表已建立 `tenant_id + project_id` 双边界、规范字段、六状态约束、UTM、负责人和跟进时间索引；旧 `contacted/closed` 数据无损迁移为 `contacting/lost`。公开官网只返回线索 ID、状态和创建时间，不回显联系方式；后台管理员与运营可查看完整联系方式，审核员与只读账号仅能查看脱敏值。预约诊断接口要求浏览器级幂等键，同企业/项目重试只产生一条线索、同键改内容返回冲突，不同独立部署互不影响；按来源 IP 限流，前端失败不清空字段，成功明确承诺 1 个工作日内回复。后台支持服务端筛选、排他认领、六状态跟进和不可变跟进记录；CSV 由服务端固定脱敏导出，认领、状态变化、跟进和导出均进入审计。真实官网/后台运行时、双项目隔离、角色权限、生产底座及备份恢复均已通过自动检查。

#### P5-T01 线索数据结构

**最小字段**：`id`、`tenant_id`、`project_id`、`name`、`company`、`phone_or_email`、`need`、`source_page`、`utm`、`status`、`created_at`、`follow_up_at`、`owner_id`。  
**状态**：`new`、`contacting`、`qualified`、`won`、`lost`、`spam`。  
**隐私**：官网接口不能返回完整联系方式；后台按角色脱敏显示。

**完成记录（2026-08-12）**：新增数据库迁移 `official_site_lead_contract`，使用重建表方式兼容旧结构并保留既有界面字段；规范列包含任务要求的全部最小字段，状态与企业边界同时由数据库约束。`PublicLeadStore` 固定写入当前部署的企业和项目，接受规范 UTM 字段，公开响应不包含姓名、企业、电话或邮箱。后台查询同时按 `tenant_id + project_id` 过滤，新增 `leads.contact.read` 权限，管理员和运营返回原值，审核员和只读账号返回手机号/邮箱脱敏值。`scripts/check-site-lead-contract.mjs` 使用同一独立数据库启动真实官网与后台运行时，验证 v21→v22 迁移、零丢失状态映射、新写入、UTM、状态/企业约束、公开隐私和四角色显示；`npm run check:site`、生产底座及备份恢复 v2 检查通过。

#### P5-T02 预约诊断表单

**目标**：官网“预约诊断”写入正确项目的后台线索。  
**必须处理**：必填校验、幂等键、频率限制、失败后保留输入、成功提示“1 个工作日内回复”。  
**完成标准**：同一次提交只有一条线索；后台可看到来源页；另一项目无法看到。

**完成记录（2026-08-12）**：新增不可覆盖的数据库迁移 `official_site_lead_idempotency`，以 `tenant_id + project_id + idempotency_key` 建立部分唯一索引，并冻结键与提交摘要；同键同内容返回原线索，同键不同内容返回 `409 SITE_LEAD_IDEMPOTENCY_CONFLICT`。公开接口在校验请求后执行来源 IP 滑动窗口限流，超限返回 `429 SITE_LEAD_RATE_LIMITED`；CMS 与静态兼容表单均生成并在失败重试时复用幂等键，仅在成功后重置字段，采集来源页和 UTM，成功或重复响应均明确“1 个工作日内回复”。新增 `scripts/check-site-lead-form.mjs`，使用建材、机械和限流三个独立部署运行时验证必填、幂等、冲突、跨项目隔离、来源归属、频率限制、反馈文案和失败保留；已纳入 `npm run check:site`，生产底座与备份恢复 v2 检查通过。

#### P5-T03 线索跟进

**目标**：后台可筛选、认领、改状态、写跟进记录、导出脱敏数据。  
**完成标准**：所有状态变化有审计；无权限用户不能导出联系方式。

**完成记录（2026-08-12）**：新增数据库迁移 `official_site_lead_follow_up`，建立按企业、项目和线索归属的不可变跟进记录表，数据库拒绝跨项目记录及更新/删除历史。新增 `leads.manage` 与 `leads.export` 权限，仅管理员和运营可排他认领、跟进与导出；他人已认领时返回冲突，重复由本人认领幂等返回。线索列表支持状态、负责人、来源及关键词服务端筛选，跟进使用 `new/contacting/qualified/won/lost/spam` 六状态并要求记录正文；状态变化、普通跟进、认领和脱敏导出均写审计。CSV 不再由浏览器拼接，而由服务端固定脱敏并防止公式注入。新增 `scripts/check-site-lead-follow-up.mjs`，通过真实管理员、两名运营、审核员和只读账号验证竞争认领、无权限拒绝、筛选、跟进、历史不可变、跨项目边界、脱敏导出及审计；已纳入 `npm run check:site`，生产底座和备份恢复 v2 检查通过。

### P6：审核内容到外部发布闭环

当前进度（2026-08-12）：`P6-T01` 至 `P6-T03` 已完成。审核通过且冻结的文章版本在进入既有发布器前，先在当前独立部署数据库创建正式发布任务；任务固定企业、文章、版本、单一渠道、确定性 payload hash、状态、尝试次数、创建/过期时间和外部任务关联。同一企业的同一文章版本与渠道重复点击只返回原任务，不再次创建发布器任务；文章新版本即使渠道相同也产生新任务和新哈希。任务身份不可修改，跨企业文章版本绑定由数据库拒绝，创建动作进入审计。发布器领取、开始执行、成功/草稿/失败回写、三次指数退避、终态幂等和本机登录态隔离均已通过真实后台专项检查。桐灼私有端与中央中转站已通过跨进程 Mock 联调，覆盖完整 HMAC、防重放、积分冻结/结算、结果队列、ACK 和跨客户隔离；尚未接入生产 AIDSO 凭证。

#### P6-T01 创建幂等发布任务

**前置**：文章审核通过且版本已冻结。  
**任务字段**：`tenant_id`、`content_id`、`content_version_id`、`channel`、`payload_hash`、`status`、`attempts`、`created_at`、`expires_at`。  
**完成标准**：同一文章版本+同一渠道重复点击不产生重复任务；文章修改后新版本生成新哈希。

**完成记录（2026-08-12）**：新增数据库迁移 `idempotent_publication_tasks`，建立 `publication_tasks` 正式表和 `(tenant_id, content_version_id, channel)` 唯一约束；任务包含 `tenant_id`、`content_id`、`content_version_id`、`channel`、`payload_hash`、`status`、`attempts`、`created_at`、`expires_at`，并保存冻结发布载荷和既有发布器任务 ID。服务端从已通过 `ContentStore.assertCanPublish()` 的冻结版本构造规范 JSON，使用 SHA-256 生成 payload hash；浏览器传入的正文不作为正式载荷来源。创建发布器任务失败时仅回滚尚未派发的数据库预约，成功后冻结外部任务关联；任务核心身份字段不可更新，已派发任务不可删除。扩展 `scripts/check-content-api.mjs`，通过真实内容创建、风控、人工审核与冻结流程验证重复点击幂等、新版本新任务/新哈希、审核门、字段不可变、跨企业数据库拒绝和创建审计；内容发布、官网发布、内容资产、生产底座及备份恢复检查通过。

#### P6-T02 发布器领取和回写

**目标**：发布器在本机打开平台，执行“保存草稿”或“正式发布”，然后回写结果。  
**发布状态**：`queued`、`claimed`、`running`、`draft_saved`、`published`、`failed`、`expired`。  
**安全边界**：平台账号、Cookie、验证码、浏览器 Profile 只留 Windows 电脑；服务端不接收登录态。  
**完成标准**：成功写 URL；失败写错误码和可读原因；重试限次并退避；成功任务不再重复发布。

**完成记录（2026-08-12）**：新增数据库迁移 `publication_task_execution_state`，正式任务补充领取设备、领取时间、下次重试时间、外部 URL、错误码、可读错误、结果快照和完成时间。Windows 发布器执行严格走 `claim → start → result`：领取进入 `claimed`，开始后才进入 `running` 并增加尝试次数；仅原领取设备可以回写。`published` 强制 HTTPS/HTTP URL，`draft_saved` 为终态；失败最多三次，使用指数退避，第三次失败固定为 `failed` 并记录错误码及原因；成功或草稿终态的迟到回写幂等且不改变结果。任务到期自动转 `expired`。服务端拒绝 Cookie、浏览器存储和 Profile 内容，只接收本机登录状态摘要。新增 `scripts/check-publication-worker-loop.mjs` 与 `npm run check:publisher-worker`，通过真实后台进程验证成功 URL、草稿、三次失败退避、终态幂等、审计记录和凭据不出端；兼容的发布器/内容/会话专项检查均通过。

#### P6-T03 中转站联调

**目标**：先 Mock 验证 GEOFlow ↔ 中转站的队列、积分、ACK，再接生产凭证。  
**签名要求**：method、path、timestamp、nonce、body hash 均参与 HMAC；拒绝时间过期、nonce 重复、签名不匹配。  
**完成标准**：冻结积分→成功结算；失败释放；未 ACK 可重试；跨租户绝不读取。

**完成记录（2026-08-12）**：复用既有中央中转站契约，没有新建第二套协议。实例请求签名覆盖大写 HTTP method、含 query 的 request target、Unix timestamp、唯一 nonce 和原始 body SHA-256，再使用实例密钥计算 HMAC-SHA256；中央端拒绝过期时间戳、重复 nonce、错误签名和停用实例。运行创建以实例和幂等键隔离，创建事务先冻结客户积分；Mock worker 成功后结算实际积分并释放剩余冻结额，失败路径释放积分。结果通过带 payload hash 的租约交付队列返回，ACK 幂等；未 ACK 或显式 release 的交付可重试并在次数耗尽后进入死信。新增 `geo-data-hub-demo/scripts/check-relay-private-http.mjs`，启动真实临时中央中转站进程，由桐灼私有端 `DiagnosticRelayClient` 通过 HTTP 创建运行、等待 Mock worker、核对积分、拉取并 ACK 结果，同时验证过期签名、nonce 重放、签名不匹配和另一客户实例读取返回 404。专项已接入两端 `check:private-http` / `check:relay-private-http`，中央账本、跨租户及 HTTP 死信管理回归通过。生产 AIDSO Token、客户实例密钥及真实平台调用不在本任务中启用。

### P7：桐灼 GEO 第一个完整项目

#### P7-T01 桐灼项目配置与品牌

**必须录入**：正式品牌名与 Logo、企业主体、服务区域、GEO 服务线、真实案例或方法论、联系方式、ICP备案 `鲁ICP备2026021587号-2`（部署主体仍为该主体时）。  
**完成标准**：官网、后台、发布器使用同一个项目标识；无模板占位词。

**完成记录（2026-08-12）**：固化桐灼项目种子 `tongzhuo-geo`，统一 `projectId=tongzhuo-geo`、`tenantId/workspaceId=tenant_tongzhuo_geo`，正式域名 `https://tongzhuo.ink`，企业主体“桐灼（淄博）网络科技有限公司”，服务区域“山东淄博/中国”，GEO 服务线、已登记的方法与典型场景、官方 Logo 资源、公开地址及 ICP 备案 `鲁ICP备2026021587号-2`。后台启动时校验项目种子与租户/项目 ID 一致；官网从同一种子生成 CMS 公开快照；Windows 发布器保存并在请求头发送 `X-TZ-Project-ID`，后台拒绝错误项目标识。未确认的电话、邮箱不被编造，预约诊断表单作为联系方式入口。新增 `scripts/check-tongzhuo-project-identity.mjs`，并扩展发布器专项验证错误项目 ID 返回 403；官网、种子、租户边界、发布器和站点回归均通过。

#### P7-T02 跑完整链路

~~~text
创建项目
→ 企业数字身份
→ 业务线
→ 企业事实和知识
→ 客户问题/问题地图
→ 选题和内容计划
→ AI 生成或人工写作
→ 引用/风控检查
→ 人工审核
→ 官网发布
→ 创建外部平台任务
→ Windows 发布器执行
→ 结果回写
→ 官网预约诊断产生线索
→ 监测/诊断记录
→ 生成下一轮优化建议
~~~

每一步保存截图或对象 ID。一步失败先修一步，禁止跨步伪造数据。

**完成记录（2026-08-12）**：新增 `tongzhuo-geo-platform-demo/scripts/check-tongzhuo-end-to-end.mjs` 与 `npm run check:tongzhuo-e2e`，在隔离临时数据库中通过真实后台 HTTP API 顺序完成工作区企业身份/业务线/客户问题/选题、内容计划并冻结 `MVER-GEO-CORE-V1`、`PVER-GEO-ARTICLE-V1`、`QRULE-GEO-CONTENT-V1`，企业知识库文档与版本审核/检索、内容任务和人工验收稿、引用与风控扫描、提交审核/冻结、官网发布、知乎 Mock 外部任务、Windows 发布器领取/开始/结果回写、官网文章访问、预约诊断线索、监测诊断和规则建议。验收输出每一步对象 ID，并反查官网与外部发布任务均为 `published`、线索项目边界为 `tongzhuo-geo`。本地官网使用真实隔离 runtime；知乎 URL 明确为 `mock.example`，实时 AI 采样未运行，内容为人工写作验收稿。专项及 `check:tongzhuo-project`、`check:foundation-assets`、`check:site`、`check:publisher-worker`、`check:relay-private-http`、生产底座/密钥/备份回归均通过。修复了验收脚本对知识、监测、官网 runtime、线索响应契约及 Windows SQLite 清理的读取/回收问题。

#### P7-T03 真实数据边界

报告必须分别标记：研究基线、企业实测、实时采样、Mock/演示。  
**完成标准**：不能把历史研究报告说成客户实时排名，不能把 Mock 发布说成平台真实发布。

**完成记录（2026-08-12）**：诊断证据新增统一的机器可读 `dataOrigin`：`research_baseline`、`enterprise_measured`、`realtime_sampling`、`mock_demo`。历史 Citation Lab 资料默认归为研究基线，企业官网/知识/运营快照默认归为企业实测；实时指标仅允许绑定带采集时间、已验证、且明确标记为 `realtime_sampling` 的样本。Mock 证据必须同时声明 `dataOrigin=mock_demo` 与 `provenance.environment=mock`，即使核验状态为 verified 也不会计入实时指标、更不会解锁当前品牌排名或推荐率。外部发布回写会在 `publication_tasks.result_json` 固化 `dataOrigin`；`mock.example` 强制归为 `mock_demo`，而声称 Mock 的结果不能使用非 Mock URL。后台报告页面显示四层数据口径与每条证据边界。新增 `scripts/check-data-boundaries.mjs` / `npm run check:data-boundaries`，验证四类数据分层、Mock 环境门、Mock 不计入实时样本、无法用中文“当前品牌排名第一”绕过实时结论门；桐灼端到端专项同时反查官网结果为 `enterprise_measured`、知乎 Mock 结果为 `mock_demo`。已通过专项、发布器和官网回归；`npm run check:diagnostics` 的诊断基础/API/动作/分析引擎均通过，但真实研究引擎子检查需要本地安装 `research-packages/geo-citation-lab/2.0.1/derived/citation-research.sqlite`，当前环境缺失该受控数据包，故未将其作为本次通过证据。

### P8：建材第二项目

#### P8-T01 必须从母版生成

只允许优先复用：

~~~powershell
cd tongzhuo-product-template
.\scripts\New-CustomerConfig.ps1
.\scripts\Test-CustomerConfig.ps1
.\scripts\New-CustomerConfigReview.ps1
.\scripts\New-CustomerDeliveryFromConfig.ps1
~~~

新项目要有独立 slug、配置、Logo、产品、案例、客户问题和种子文章；不得复制源码。

#### P8-T02 强制隔离验收

- 建材官网不能出现桐灼名、桐灼 GEO 案例、桐灼联系方式。
- 桐灼后台不能看到建材线索、内容、知识、发布任务。
- 两个项目能分别启动、备份、恢复、发布。
- 改建材主题不会影响桐灼主题。
- 不需要改通用渲染器核心逻辑。

#### P8-T03 行业差异只放模板

建材默认产品字段、采购问题、规格参数和内容类型写入 `building-materials` 模板；其内容工作流仍使用同一套 GEO 核心方法、提示词与审核规则。禁止把大量 `if (industry === ...)` 堆到核心代码。  
**完成标准**：第三行业只新增行业适配模板和种子数据，已有 GEO 核心工作流和项目回归测试通过。

**完成记录（2026-08-12）**：新增 `project-seeds/building-materials-demo.mjs`，以“华材建材演示项目”作为明确的演示客户种子，仅包含建材选型支持、质量与标准资料、采购与交付说明、规格参数/执行标准/交付条件问题地图；未编造真实企业 Logo、电话、邮箱、地址或 ICP。`PublicSiteStore` 现将项目 ID、租户 ID、行业模板和演示边界带入运行时快照；官网 renderer 的首页、服务页、关于页、案例筛选与行业说明优先使用 CMS/行业种子数据，不再将“工业品/制造业/企业 AI 落地/短视频运营”写死为所有客户的公开文案。新增 `scripts/check-building-materials-project.mjs` 与 `npm run check:building-materials-project`，在两个独立 SQLite 数据库、两个独立运行时中检查首页、服务、案例、关于、问题地图、联系、问题详情、sitemap、llms、线索和主题切换；建材输出通过桐灼品牌/联系方式/ICP/资产/非建材服务的负向检查，桐灼输出不含建材内容；两边均复用正式 `MVER-GEO-CORE-V1`、`PVER-GEO-ARTICLE-V1`、`QRULE-GEO-CONTENT-V1`。专项还分别写入建材/桐灼知识与内容隔离标记，反查另一数据库不存在对应知识、内容、线索和发布任务；停止运行时后分别创建、校验并恢复 production backup v2，确认两套数据库独立恢复且建材线索只恢复到建材部署。平台专项已通过。

母版新增 `scripts/Test-BuildingMaterialsDemo.ps1`，在临时目录中重复执行配置生成、配置校验、交付包生成、秘密扫描、组件包验证、总包 manifest 验证，并断言 `project_id=building-materials-demo`、`tenant_id=tenant_building_materials_demo`、`industry_template=building-materials`、三项正式底层版本和无虚构身份信息。交付 manifest / deployment profile 同时固化项目、租户和行业字段，母版专项已通过。建材与桐灼的官网、线索、CMS、主题和数据库隔离验收均已通过。

机械行业已补充同构的 `machinery-demo` 演示客户种子和 `check:machinery-project`：使用独立项目/租户、机械行业模板和独立数据库运行首页、服务、案例、关于、问题地图、联系、问题详情、Sitemap 与 AI 可读文件，并验证线索归属及无桐灼/建材品牌泄漏。母版新增 `Test-MachineryDemo.ps1`，实际生成机械交付 ZIP，完成三个组件包和总包的秘密扫描/manifest 验证，冻结同一 `MVER-GEO-CORE-V1`、`PVER-GEO-ARTICLE-V1`、`QRULE-GEO-CONTENT-V1`；演示项目不虚构电话、邮箱或 ICP，生产上线继续由占位域名和真实资料缺失正确阻断。

### P9：交付和上线准备

#### P9-T01 配置审查和预检

~~~powershell
cd tongzhuo-product-template
.\scripts\Test-CustomerConfig.ps1 -ConfigPath <配置文件>
.\scripts\New-CustomerConfigReview.ps1 -ConfigPath <配置文件> -OutputPath <审查报告>
.\scripts\Test-CustomerLaunchReadiness.ps1 -ConfigPath <配置文件>
~~~

检查域名、Logo、联系方式、端口、API 地址、ICP备案、安全警告。示例配置 Token 必须为空。

**完成记录（2026-08-12）**：配置审查现同时输出 `project_id`、`tenant_id`、`industry_template`、三项正式 GEO 底层版本、Logo/ICP/联系方式完整度，以及每条警告的 `blocking_for_production` 标记。上线预检不再因“存在一份配置审查文件”就通过：它会读取配置审查的生产门，使用占位域名、本地或非 HTTPS 工作台、缺真实联系方式/地址/统一社会信用代码/Logo/ICP 都会阻断真实生产上线。`Test-CustomerConfigReview.ps1`、`Test-CustomerProjectDossier.ps1`、`Test-CustomerLaunchReadiness.ps1` 已覆盖正式就绪与阻断两条路径。

#### P9-T02 生成与验证交付包

~~~powershell
.\scripts\New-CustomerDeliveryFromConfig.ps1 -ConfigPath <配置文件> -OutputRoot <交付根目录>
.\scripts\Test-CustomerDelivery.ps1
.\scripts\Package-CustomerDelivery.ps1 -Root <客户实例目录> -OutputPath <zip路径>
.\scripts\Test-CustomerDeliveryPackage.ps1 -PackagePath <zip路径> -ExpectedVersion <版本>
~~~

交付包要有官网、后台覆盖层、桌面执行器、配置样例、安装说明、验收、备份恢复、交接清单；不得有真实 Token、Cookie、Profile、数据库、日志、`node_modules`。

**完成记录（2026-08-12）**：`New-CustomerDeliveryRelease.ps1` 的 release manifest 与项目归档索引现固化 `project_id`、`tenant_id`、`industry_template`、`MVER-GEO-CORE-V1`、`PVER-GEO-ARTICLE-V1`、`QRULE-GEO-CONTENT-V1`、构建 Git commit 及工作区是否有未提交修改。`Test-CustomerDeliveryRelease.ps1` 会反查这些字段与配置审查、归档索引一致。修复了 Git 脏状态检查遗留退出码导致后续配置校验被误判失败的问题。

#### P9-T03 交接与回滚

必须生成并人工确认：安装/启动说明、权限分工、首月运营计划、备份恢复命令、发布失败回滚说明、服务边界与变更控制、版本号、SHA256、构建时间、Git commit。

**完成记录（2026-08-12）**：新增 `Test-BuildingMaterialsLaunchReadiness.ps1`。专项实际生成建材演示客户的发布包并通过 ZIP 秘密扫描、三个组件包校验、交付 manifest/归档版本与 Git 证据校验；然后构造完整的销售、演示、接入、AI 审计、发布和后台快照证据，确认上线门仍为 `blocked`，并能定位到配置审查中的 `placeholder_site_url`。这证明演示客户可以作为可验收交付母版，但没有真实域名、企业身份、联系方式、Logo 与 ICP 前绝不标记为生产可上线；未宣称任何真实建材客户已经上线。

---

## 7. 跨行业最小数据字典

| 对象 | 关键字段 | 说明 |
|---|---|---|
| `projects` | `id`、`tenant_id`、`slug`、`name`、`product_capability`、`industry_template`、`status` | 一个购买 GEO 系统的独立企业项目 |
| `methodology_packs` / `methodology_versions` | 作用域、行业、版本、来源、校验和、发布状态 | 共享的 GEO 核心方法或行业补充“怎么做”知识；不属于任一客户 |
| `prompt_templates` / `prompt_versions` | 作用域、操作、变量契约、输出契约、质量规则、版本 | 生成策略；已发布版本不可原地修改 |
| `quality_rule_packs` / `prompt_test_cases` | 规则、适用范围、版本、测试夹具 | 防止提示词或方法论升级造成质量退化 |
| `company_profiles` | `tenant_id`、法定名称、简称、描述、地区 | 企业数字身份 |
| `brand_configs` | `tenant_id`、Logo、颜色、字体、favicon | 全站统一品牌入口 |
| `business_lines` | `tenant_id`、名称、边界、状态 | 产品/服务线 |
| `knowledge_documents` / `qa_entries` | `tenant_id`、版本、审核状态、来源 | 只有审核发布版可正式检索 |
| `problem_groups` / `questions` | `tenant_id`、问题、意图、业务线 | 真实客户问题 |
| `content_plans` | `tenant_id`、题目、来源问题、知识快照、智能体快照、状态 | 创建时冻结上下文 |
| `articles` / `article_versions` | `tenant_id`、正文、版本、审核状态 | 禁止静默覆盖 |
| `site_releases` | `tenant_id`、版本、快照、状态、发布人 | 官网只读最新 `published` |
| `leads` | `tenant_id`、来源、联系方式、状态 | 官网线索 |
| `publish_jobs` | `tenant_id`、文章版本、渠道、哈希、状态 | 幂等外部发布 |
| `content_assets` / `publications` | `tenant_id`、内容、渠道、URL、检测状态 | 内容资产追踪 |
| `diagnostic_projects` / `evidence` | `tenant_id`、问题快照、证据类型、时间 | 证据边界 |

只加 `tenant_id` 字段而没有给所有查询加过滤，视为未完成。

---

## 8. API 契约

新 API 前先搜索现有实现：`rg -n "路径或对象名"`。已有接口能满足就复用；确实不足才新增并更新 API 文档。

### 8.1 官网公开接口

- `GET /`、`GET /services/`、`GET /cases/`、`GET /insights/`：服务端渲染当前项目公开发布版本。
- `GET /feed.xml`、`GET /sitemap.xml`、`GET /llms.txt`：只含公开内容。
- `POST /api/v1/leads`：预约诊断，必须限流与幂等。
- `GET /api/v1/content-assets/:id`：只返回公开摘要，不能返回内部知识和 Token。

### 8.2 后台受保护接口

后台接口必须依次过会话、CSRF、角色、`tenant_id` 校验。资源包括企业、业务线、知识、问题、计划、文章、审核、CMS、线索、发布、资产、诊断。

### 8.3 发布器与中转站

发布器仅可读取当前设备可执行任务及内容版本快照；回写必须带任务 ID、设备 ID、渠道、状态、URL、错误码、错误信息、执行时间、payload hash，且接口幂等。

中转站用 HMAC + timestamp + nonce + body hash；它管队列、积分、delivery/ACK，不渲染官网、不读取客户全库。

### 8.4 底层资产接口

系统管理员维护 GEO 核心/行业适配方法包和提示词模板；普通客户运营人员只能查看被分配的已发布版本，并可复制成自己项目下的自定义版本。接口响应必须带 `scope`、`industryTemplate`、`tenantId`、`version`、`status`、`checksum` 和来源信息。

不允许提供“直接覆盖已发布提示词正文”的接口。更新方式永远是：新建草稿版本 → 质量测试 → 审核 → 发布 → GEO 核心或行业适配模板切换默认版本；历史内容继续指向当时版本。

---

## 9. 安全红线

- 所有秘密用环境变量、服务器秘密存储或运行时注入；示例 Token 为空。
- 底层方法论和提示词资产记录来源、使用范围、版本、校验和与审核人；来源不明或不具备使用授权的内容不得进入正式资产库。
- 账号、Cookie、验证码、浏览器 Profile 只在运营 Windows 电脑。
- 公开页不泄露数据库路径、后台接口、错误堆栈、模型 Key、实例密钥、完整联系方式。
- 线索、内容、知识、证据、任务、日志按 `tenant_id` 隔离。
- URL 健康检查只允许公开 HTTP/HTTPS，拒绝 localhost、内网 IP、文件路径和其他协议，防止 SSRF。
- 生产迁移必须先备份、先副本验证、再由负责人授权。

---

## 10. 每阶段验收顺序

按“静态检查 → API 检查 → 浏览器检查 → 隔离检查 → 回归检查”执行，不可只看截图。

### 静态检查

~~~powershell
cd tongzhuo-geo-platform-demo
npm run check:site
node --check <本任务修改的 .mjs 或 .js 文件>
git diff --check
cd ..\geo-data-hub-demo; npm run check
cd ..\publisher-assistant; npm run check
cd ..\tongzhuo-product-template; .\scripts\Test-Template.ps1
~~~

### 浏览器验收

1. 首页、服务、案例、行业观点、联系页都能打开。
2. 所有页面导航和页脚使用统一品牌、Logo、颜色、ICP。
3. 桌面和手机无水平滚动、重叠文字、无效按钮。
4. 加载动画可跳过，并支持 `prefers-reduced-motion`。
5. 预约诊断在成功、失败、重复时都有清晰反馈。
6. 预览页不收录；正式页有 canonical、sitemap、结构化数据。

### 隔离与发布验收

用项目 A 和项目 B 各建同名产品、文章、线索；任意列表和详情都不能串数据。用 Mock 发布器分别跑一次成功和失败，核对状态、重试、payload hash、URL、错误、审计和内容资产。无真实平台授权时，禁止声称“真实发布成功”。

---

## 11. Git 规则

~~~powershell
git status --short
git diff --check
git diff --stat
git add <明确列出的文件>
git commit -m "docs: add enterprise project development plan"
git push origin <当前分支>
~~~

提交消息只用 `feat:`、`fix:`、`docs:`、`test:`、`chore:`。不要 `git add .`。提交前确认 `git diff --cached --name-only` 中只有预期文件。遇到用户已有改动，不覆盖、不重置、不清理，报告重叠文件。

---

## 12. 最终交付定义

只有下列全部完成，才可说“第一版系统打通”：

- [x] 桐灼 GEO 来自配置和种子数据，不依赖通用代码中的桐灼常量。
- [x] “如何做好 GEO”、提示词、质量规则已成为所有客户共用、且有来源、有版本、可测试的 GEO 系统底层资产，而非散落代码字符串。
- [x] 每次生成都可查到行业方法包、提示词、写作智能体、模型、知识范围和渲染结果的冻结版本。
- [x] 官网、后台、发布器、中转站的职责和安全边界明确。
- [x] 官网只展示审核发布内容，支持预览、版本、回滚。
- [x] 官网线索进入正确项目并可跟进。
- [x] 内容走通：知识/问题→计划→生成→审核→官网→外部任务。
- [x] 发布器不上传 Cookie/Profile，结果能幂等回写。
- [x] 中转站 HMAC、nonce、积分、ACK 检查通过。
- [x] 研究、实测、实时、Mock 数据边界清楚。
- [x] 桐灼端到端链路有可复核记录。
- [x] 建材项目由母版生成，无源码复制，且数据/品牌/备份隔离。
- [x] 交付包预检、秘密扫描、版本一致性和解压验收均通过。
- [x] 备份、恢复、回滚、权限和交接文档齐全。

---

## 13. 第一条实际任务

下一轮只执行：

~~~text
P0-T01 建立工作区基线
~~~

完成 P0 后才做 P1-T01。P1 前不设计新接口；P2 前不生成建材项目；P7 前不对外宣称系统已经打通。执行 AI 不得自动跨任务或跨阶段。
