# 全局 UI / CSS 一致性审查报告（2026-08-24）

> 审查方法：浏览器逐页采集 13 个路由的真实计算样式（computed style）+ CSS 静态重复定义扫描。
> 权威基线：`design-tokens.css` 的 :root 变量与组件规范。

## 一、根因（为什么「局部好、全局乱」）

### 1. 核心组件类在多个文件重复定义，互相覆盖
| 组件类 | 跨文件数 | 总定义次数 | 主要分布 |
|---|---|---|---|
| `.card` | 5 | **48** | styles/product-ui/geo-dashboard/design-tokens/effect-ui |
| `.primary-button` | 5 | 32 | 五文件全有 |
| `.link-button` | 5 | 29 | 五文件全有 |
| `.sidebar` | 5 | 61 | 五文件全有 |
| `.topbar` | 4 | 31 | styles/product-ui/geo-dashboard/design-tokens |
| `.data-table` | 4 | 29 | styles/product-ui/geo-dashboard/design-tokens |
| `.page-head` | 5 | 17 | 五文件全有 |
| `.status-badge` | 3 | 34 | styles/product-ui/design-tokens |
| `.effect-relay-status` | 3 | 24 | product-ui/design-tokens/effect-ui |

**结论**：同一个类被 3-5 个文件多次声明，CSS 层叠顺序（文件加载顺序）决定谁生效。
改 A 页时只动了 A 文件的覆盖，B 页没被覆盖到 → 页面间样式漂移。

### 2. 死文件未被清理
- `premium-theme.css`（350 行）：**未被 index.html 引用**，纯垃圾，还包含覆盖 `.nav-main a.active` 的规则（潜在隐患）。

### 3. 版本号未随改动同步（缓存击穿风险）
- `design-tokens.css` 版本号 `v=20260821-logo-cleanup-v18`，但文件 mtime 是 08-22 22:30；
- `app.js` 版本号 `v=20260824-no-kickers-v2`，文件 mtime 08-24 13:37 —— **不一致**；
- 部分 CSS 引用 `?v=20260821-logo-cleanup-v18`，说明最近改动有文件没同步版本号，浏览器可能读旧缓存。

## 二、跨页实测不一致清单（浏览器逐页采集的真实渲染值）

### A. 主按钮 `.primary-button` —— 三套尺寸并存
| 页面 | 字号 | 高 | 圆角 | 形态 |
|---|---|---|---|---|
| dashboard / site / settings | 12px | 32px | 8px | 紧凑（button-small 落到了默认） |
| knowledge / monitoring / planning / content / publish / assets / assistant / effect-monitor | 14px | 40px | 10px | 标准 |
| effect-diagnostic | 14px | **48px** | 8px | 偏大 |

→ 同一个主按钮，三个高度（32/40/48），三个圆角（8/10/8）。

### B. 次按钮 `.secondary-button`
- 标准 14px/40px/10px：9 个页面；
- 紧凑 12px/32px/8px：dashboard / settings；
- site 页采集到 32px（部分按钮），同页其他次按钮 40px —— **页内都不一致**。

### C. 卡片 `.card` —— 圆角与底色混乱
| 页面 | 圆角 | 背景 | 边框 |
|---|---|---|---|
| dashboard/site/monitoring/effect-diagnostic/effect-monitor/settings | 11px | #fff | 标准 |
| knowledge | 0px | transparent | 无边框 |
| content/publish/assets | 0px | transparent | 无边框（数据类卡片） |
| planning | **14px** | #fff | 蓝调 |
| assistant | **14px** | #f7f9fc（蓝灰） | 蓝调 |

→ 卡片圆角 0/11/14 三种，底色白/透明/蓝灰三种，边框线风格三套（暖灰/蓝灰）。

### D. 下拉框 `.select` —— 四套
| 页面 | 字号 | 字重 | 高 |
|---|---|---|---|
| monitoring | 14px | 700 | 34px |
| planning | 11.5px | 400 | 42px |
| assistant | 11px | 550 | 42px |

### E. 链接按钮 `.link-button`
- dashboard: 11px；site: **13px**；assistant: 11px；effect-search: 12px（带白底边框！）；effect-diagnostic: 12px
- 五个页面五种字号，effect-search 的 link 还带边框底色（非 link 语义）。

### F. 输入框 `.input`
- monitoring 42px vs planning/assets/assistant 40px —— 高度差 2px。

## 三、静态代码里确认的「明知不一致」隐患

- `design-tokens.css` 第 20 节登录界面、21 节布局重做、22 节工作台组件、24 节 Demo 一比一 —— 大量 demo 定制选择器与 tokens 混写在同一文件，越写越长（2128 行）；
- `effect-ui.css` 内部有「精致版（A/B/C/D）」「demo 对齐」「任务卡」多轮叠加痕迹，同一区块 3 轮定义（如 148/1091/2682 行处重复覆盖）；
- `.nav-effect-item.active` 用 `linear-gradient(90deg, var(--blue-soft), rgba(184,68,47,.04))`（effect-ui.css:3157），而 `.nav-item.active` 用纯色 `rgba(168,80,58,.08)` —— **同是侧边栏激活态，两条实现**。

## 四、建议（按优先级）

1. **拆分 CSS**（本轮做）：tokens / base / ui-components + 每模块一个文件，静态归位，视觉零变化；
2. **统一按钮体系**：`.primary-button` 只保留一个标准尺寸（建议 40px/14px），`button-small` 单独一个修饰类，消除 32/48 漂移；
3. **统一卡片体系**：`.card` 定一个标准（11px / #fff / 暖灰细边），数据类卡用 `card--flat` 修饰；
4. **统一 select/input**：高度统一 40px，字号统一 14px；
5. **清理死代码**：删 premium-theme.css；收敛重复定义到单一权威文件；
6. **版本号纪律**：CSS/JS 改动必须同步 index.html 版本号（CLAUDE.md 规矩再次确认失效了一次）。

## 五、已排除的假警报
- 侧边栏激活态背景「透明」：实为 transition 动画起点帧被采集，最终态正常（`rgba(168,80,58,.08)` 红底红字），**无问题**。
