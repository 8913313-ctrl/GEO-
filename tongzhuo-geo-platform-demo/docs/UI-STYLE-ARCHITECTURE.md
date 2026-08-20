# 后台 UI 样式架构规范（CSS Architecture）

> 适用范围：`tongzhuo-geo-platform-demo/public/` 下的后台界面（管理端，不含官网静态站模板）。
> 本文是「高内聚、低耦合」改造的规范和迁移路线。改代码前先读这里。

## 0. 总原则

**CSS 文件加载顺序不代表职责优先级。**

- `styles.css` 是组件结构的**唯一来源**；
- `product-ui.css` 管理页面布局；
- `geo-dashboard.css` 只管理首页布局；
- `design-tokens.css` 只提供主题变量与视觉 token。
- **任何层不得通过加载顺序或提高选择器优先级来覆盖其他层的职责。**

## 1. 现状与问题（2026-08-20 盘点）

| 组件 | styles.css | product-ui.css | design-tokens.css | 问题 |
|---|---|---|---|---|
| `.select` | 21 条 | 6 条 | 9 条 | 同一组件结构定义散落 3 个文件，靠加载顺序互相覆盖 |
| `.tabs` / `.tab-button` | 24 条 | 13 条 | 12 条 | 同上 |
| 按钮（primary/secondary/icon/link/text/danger/ghost） | 55 条 | 29 条 | 47 条 | 同上 |
| `.card-header` | 18 条 | 8 条 | 8 条 | 同上 |

- 模板内联样式约 60 处：`style="margin-top:13px"` ×20、`margin-top:14/16px` ×10、`display:block;color:var(--muted-2);margin-top:4px` ×7 等。
- 曾发生的事故：`.compact-search .input { padding-left:31px }` 被 `#view .input { padding:8px 12px }` 静默覆盖，导致搜索图标与文字重叠；问题词库 `card-header` 漏闭合 `</div>` 导致表格被 flex 挤到右侧留白。

## 2. 文件职责（分层，唯一权威）

CSS 加载顺序（见 `public/index.html`）：`styles.css` → `product-ui.css` → `geo-dashboard.css` → `design-tokens.css`。**加载顺序只用于同优先级规则的新旧覆盖，不是职责划分依据。**

| 层 | 文件 | 职责 | 写什么 / 不写什么 |
|---|---|---|---|
| 组件结构 | `styles.css` | 通用组件结构唯一来源（卡片、表格、表单、页签、按钮、弹窗、select、input） | 写 display / height / padding / gap / border 结构 / 布局；**不写**颜色值（引用变量） |
| 页面布局 | `product-ui.css` | 页面级网格与布局（选题中心、发布、官网 CMS、AI 创作台等） | 只写**页面级** grid/flex/间距，必须带 `.route-*` 作用域（见 §7）；不改组件结构 |
| 首页布局 | `geo-dashboard.css` | 仅工作台（首页）版面 | 只写 `.route-dashboard` 作用域 |
| 主题变量 | `design-tokens.css` | `:root` 变量 + 视觉主题（颜色、圆角、阴影、字体） | 只写**值引用变量的视觉规则**；**禁止**结构规则（display/height/padding/appearance 一律不写） |

**结构 / 视觉分离**：组件结构归 styles.css，色彩圆角走变量。这是深色模式 / 主题切换的前提——主题层改结构会让主题切换直接失效。

## 3. 通用组件清单（结构归 styles.css，视觉走变量）

| 组件 | 类名 | 结构（styles.css） | 视觉（design-tokens 变量） |
|---|---|---|---|
| 页签 | `.tabs` / `.tab-button` | flex 布局、min-height、padding、底部指示线结构 | `--line` 边框、激活色 `--blue`、文字色 `--ink/--muted` |
| 下拉选择 | `.select` | `height`、`padding`（右侧 ≥32px）、`appearance:none`、内置箭头背景图 | 边框色 `--line-strong`、圆角、focus 色 |
| 文本输入 | `.input` / `.textarea` / `.field` | 尺寸、padding、间距 | 同上 |
| 按钮 | `.primary-button` / `.secondary-button` / `.icon-button` / `.link-button` / `.text-button` / `.danger-button` / `.ghost-button` + `.button-small` | 高度、padding、圆角结构、布局 | 背景/边框/文字色（`--blue`、`--panel` 等） |
| 卡片 | `.card` / `.card-header` / `.card-body` / `.card-footer` | grid/flex 布局、min-height、padding | 边框 `--line`、圆角、阴影 |
| 卡片头工具区 | `.card-header-tools` | flex、gap、内部 `.input` 默认宽 | — |
| 表格 | `.data-table` / `.table-scroll` / `.table-card` | 表格布局、行高、滚动容器 | 表头底色、分隔线 |
| 搜索框 | `.compact-search` | 图标定位、`padding-left:31px` | 图标色 `--muted-2` |
| 徽章 | `.small-tag` / `.status-badge` / `.source-tag` | 尺寸结构 | 语义色（blue/teal/amber/green/red） |
| 全选行 | `.bulk-select-row` / `.table-select-row` / `.select-all-control` | flex、margin、边框 | `--line` 边框、底色 |
| 弹窗 | `.modal-dialog` / `.modal-head` / `.modal-body` / `.modal-foot` | 定位、flex 布局、滚动 | 边框、圆角、阴影 |
| 空状态 | `.empty-state` / `.empty-copy` | 布局、间距 | 文字色、图标色 |

**不要**给通用组件加页面级类来绕过统一样式（如 `.publish-page .card-header {}`）——组件一旦被页面覆盖就失去复用价值。

## 4. 命名规范

- 组件类：语义命名，如 `.publish-platform-card`；禁止拼音、缩写；按钮统一 `-button` 后缀。
- 状态修饰：`.active` / `.selected` / `.disabled` / `.error`，与组件类连用：`.tab-button.active`。
- 行为与样式解耦：`data-action` 只表达行为，不做 CSS 选择器依赖。

## 5. 共享间距与文本辅助类

在 styles.css 定义，**只允许三档语义档位**：

| 类 | 用途 |
|---|---|
| `.gap-sm`（4px）/ `.gap-md`（8px）/ `.gap-lg`（12px） | flex/grid 子项间距 |
| `.mt-sm`（8px）/ `.mt-md`（12px）/ `.mt-lg`（16px） | 区块上间距 |
| `.text-muted` / `.text-muted-2` | 文本辅助色 |
| `.block-subtext` | `display:block;margin-top:4px;color:var(--muted-2)` 复合（表格小字） |

**禁止**：
- 自定义数值类（`.mt-13` / `.mt-22`）——需要别的间距说明布局该进组件规则，不是加工具类；
- 语义混搭类（`.mt-card`）；
- 模板内联样式 `style="margin-top:..."` / `style="width:..."` / `style="color:..."`（运行时动态值除外，如进度条 `width:${percent}%`）。

## 6. CSS 禁止项（Anti-Pattern）

1. **禁止页面覆盖组件**：不写 `.publish-page .button {}`、`.publish-page .card-header span {}`；组件变化改组件本身。
2. **禁止深层选择器**：最多两级（`.component .sub`），不写 `#view .page .card div span` 链式深挖。
3. **禁止新增重复组件类**：已有 `.primary-button` 就不允许再出现 `.new-button` / `.action-btn` / `.submit-btn`；先查 §3 清单。
4. **禁止 `!important`**：优先级不够说明规则放错了层，不是加 `!important`。
5. **禁止非主题层写死颜色**：styles.css / product-ui.css 里的色值必须引用 `var(--blue)` 等变量；design-tokens 定义变量本身可以写十六进制。
6. **禁止模板内联样式**（见 §5）。
7. **禁止主题层写结构**：design-tokens.css 不得出现 display / height / padding / appearance 等结构声明。

## 7. 页面作用域协议（CSS Contract）

所有页面级样式必须挂在路由作用域下。路由容器由渲染器自动生成：`view.className = "route-view route-${ui.route}"`。

| 路由 id | 页面 | 作用域 |
|---|---|---|
| `dashboard` | 工作台 | `.route-dashboard` |
| `planning` | 选题中心 | `.route-planning` |
| `content` | 内容生产 | `.route-content` |
| `publish` | 发布运营 | `.route-publish` |
| `assets` | 内容资产 | `.route-assets` |
| `monitoring` | 运营诊断 | `.route-monitoring` |
| `site` | 官网运营 | `.route-site` |
| `knowledge` | 企业知识 | `.route-knowledge` |
| `assistant` | 发布助手 | `.route-assistant` |
| `settings` | 系统设置 | `.route-settings` |

规则：
- 页面级 CSS 必须写成 `.route-publish .publish-config-grid {}`，禁止裸 `.publish-config-grid {}`；
- 历史遗留的裸页面类（product-ui.css 中大量存在）在阶段 B 逐个补作用域，防止跨页污染。

## 8. 迁移路线

### 阶段 A（低风险，先做）
1. 抽共享间距/文本类（§5），替换 app.js 中约 60 处内联样式。
2. 每替换一处，浏览器实测对应页面（DOM 尺寸对比）确认无视觉变化。
3. 产出：app.js 中除动态值外无内联样式。

### 阶段 B（中风险，逐组件做，每个组件独立提交）

**每组件迁移流程（必须遵守）**：
1. 搜索该组件在所有 CSS 文件中的全部定义；
2. 标记每条规则的来源与用途；
3. 保留视觉基准截图；
4. 结构规则合并进 styles.css、视觉规则改为变量引用；
5. 删除其他文件的重复定义；
6. 全页面回归（工作台 / 选题中心四页签 / 内容生产 / 内容资产 / 发布运营 / 官网运营 / 企业知识 / 运营诊断 / 发布助手 / 设置）；
7. 单独 commit，一个组件一次提交，失败可单独回滚。

**组件内部也要拆**：按钮族按 `primary → secondary → icon → link → text → danger → ghost` 顺序逐个迁移，不要一次清完。

**第 0 步（反向清理，先做）**：design-tokens.css 中现存的结构规则（如 `.select` 的 `appearance/padding`、`.tabs` 指示线、`.compact-search .input` 的 `padding-left`）迁回 styles.css；design-tokens 只保留变量与值引用变量的视觉规则。

### 阶段 C
1. 本规范持续维护；新样式按 §2/§3/§7 落位。
2. 清理 `#view` 前缀滥用：视觉主题规则保留 `#view`，产品层页面级样式不加 `#view`。

## 9. 修改流程（日常遵守）

1. 改通用组件 → 先查 §3 确认结构归 styles.css、视觉走变量，**不要**另写新类覆盖。
2. 页面级新布局 → product-ui.css，必须带 `.route-*` 作用域。
3. 任何视觉变更 → `public/index.html` 中 CSS 版本号 `?v=...` +1，否则浏览器缓存旧样式。
4. 主题色值一律走 design-tokens 的 `--blue / --ink / --muted / --line` 等变量。
5. 新组件入库：在 §3 登记类名、结构与视觉归属，再开始写。

## 10. 已知待办

- ~~阶段 A（内联样式抽类）~~ 已完成（2026-08-20）。
- ~~阶段 B：`.select` / `.tabs` / 按钮族 / `.card-header` / `.card` 组件收敛~~ 已完成（2026-08-20）。`.select` 结构与箭头、`.tabs` 页签、`.card` 系列均已在 styles.css 唯一定义；design-tokens 保留视觉（值引用变量）。
- product-ui.css 裸页面类待补 `.route-*` 作用域（渐进式：每次改页面顺手补，不批量改）。
- styles.css 后半段旧主题区（topbar / 侧边栏 / 工作台指标等页面级规则）仍在原处，未迁移到对应层；其中 design-tokens 无对应定义的规则（dashboard-grid / metric-grid / metric-top / nav-count / todo-list 等）是唯一来源，改动时注意。
- `index.html` 版本号目前手改，后续可考虑构建时注入。
- app.js 存在个别重复模板片段（如 `lightPaged(filteredLeads, "siteLeads")` 调用两次），与样式无关，另行处理。
