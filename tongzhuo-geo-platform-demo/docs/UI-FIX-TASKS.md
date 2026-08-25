# UI 修复任务书（给修复 AI 的机器可读工单）

> 生成：2026-08-25，由 opencode 视觉+数据双轨审查产出
> 用法：修复 AI 按 `tasks` 逐条执行，每条含定位、期望、负责文件、验收命令。禁止越界。

## 使用规则（修复 AI 必读）

1. **只改任务指定的文件和位置**，不顺手重构、不改公共层（tokens/styles/components.css 除非任务明确要求）
2. 改 JS 模块前确认目标文件在 `public/js/modules/`，改完跑 `node --check <文件>`
3. 改 CSS 必须同步 `public/index.html` 的 `?v=` 版本号（所有 css 引用统一加一版）
4. 完成每条后跑验收命令；全部完成后跑回归护栏：`node tools/ui-audit.mjs --check`
5. 业务铁律：未返回字段保持「-」或空，不补演示数据

## tasks

### TASK-001 [pending] 死按钮：知识库「查看全部/收起」无响应
- 位置：`public/js/modules/knowledge.js:733`（`toggle-paged` 按钮渲染）
- 现状：按钮渲染了 `data-action="toggle-paged"`，但全代码（bootstrap.js 及所有模块）没有任何 `action === "toggle-paged"` 处理分支，点击无反应
- 期望：点击切换对应 `data-state` 键的展开/收起状态并重渲染
- 负责文件：`public/js/modules/bootstrap.js`（在 action 分发区新增分支）+ 参考 `knowledge.js:725-735` 的状态键约定（`ui` 上应有对应 stateKey 的展开标记，读 `knowledgePreparationEvidenceCount` 附近用法确认键名格式）
- 实现提示：处理分支里 `const key = actionElement.dataset.state;` 然后翻转 `ui[key]`（若 ui 无此键约定，则新增 `ui.pagedExpanded = ui.pagedExpanded || {}` 存布尔），最后 `render()`
- 验收：node --check 两个文件；浏览器打开 `#knowledge`，找到「查看全部」按钮点击，列表展开/收起且按钮文字切换；console 无新错误
- 禁止：不改 knowledge.js 的渲染函数签名

### TASK-002 [pending] 丢失按钮：effect-search-focus 无渲染入口
- 位置：`public/js/modules/bootstrap.js:105`（处理分支存在：跳转 effect-search 并聚焦输入框）
- 现状：全库无任何 `data-action="effect-search-focus"` 渲染点，该快捷入口成为死代码
- 期望（二选一，按产品语义选）：
  - A（推荐）：在 dashboard 的「AI 效果」状态卡或快捷区补一个入口按钮（如「发起实时搜索」），用 `data-action="effect-search-focus"`
  - B：确认产品不需要，删除 bootstrap.js:105-108 的死分支
- 负责文件：A 方案改 `public/js/modules/shell.js`（dashboard 渲染）+ bootstrap.js 不动；B 方案只改 bootstrap.js
- 验收：A 方案--dashboard 出现按钮，点击跳到 `#effect-search` 且输入框聚焦；B 方案--全库无 `effect-search-focus` 引用
- 禁止：不新增 CSS；按钮复用现有 `.link-button` / `.secondary-button` 类

### TASK-003 [pending] 采集盲区：data-nav 未纳入审计（护栏自身缺陷）
- 位置：`tools/ui-audit.mjs`（本次一并交付的护栏脚本）
- 现状：采集只抓 `data-action`，漏掉 `data-nav`（shell 大量导航按钮走 data-nav），误报「无 action 死按钮」
- 期望：采集器同时收集 `data-nav`，交叉对比逻辑不变（registered 集合补 `navigate(` 的参数白名单）
- 验收：跑 `node tools/ui-audit.mjs`，「死按钮」报告不再出现 data-nav 按钮
- 禁止：不改业务代码

## 已排查、确认不是问题（不要修）

- `secondary-button` 32px/40px 两套尺寸：`button-small` 变体语义（components.css:28），设计如此
- `--blue: #b8442f`（品牌红）与 `--red: #c24538`（错误红）并存：令牌职责不同，自洽
- tab 激活态两套样式（category-tab 描边式 vs tab-button 文字加重式）：不同组件族，各自一致
- 空态页（content/publish/assets/knowledge/settings）按钮少：业务数据为空时的正常空态，「进入内容生产」等按钮走 data-nav 正常工作
- effect-diagnostic 系列按钮（run-fast/rerun/suggest-questions 等）「未渲染」：品牌未配置时的空态分支，配置后出现；参数化拼接（`data-action="${action}"`）静态扫描不可见，非丢失

## 审查方法存档（本次产出，供复跑）

- 采集：`D:/temp/opencode/wb-collect.mjs`（13 路由按钮/样式/溢出/错误）+ `wb-deep.mjs`（色板/字号/hover/tab）
- 交叉：`D:/temp/opencode/action-cross.mjs`（action 注册 vs 渲染三方对比）
- 数据：`ui-audit-collection.json` / `ui-deep-scan.json`（2026-08-25 基线）
