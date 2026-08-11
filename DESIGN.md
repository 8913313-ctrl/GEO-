---
name: 桐灼 GEO 验证护照
description: 把企业事实组织成客户与 AI 都能验证的公开信源。
colors:
  oxblood: "#5e1d2e"
  oxblood-deep: "#2a1018"
  smoked-black: "#130e0f"
  old-gold: "#b89859"
  soft-gold: "#d8c08b"
  warm-ivory: "#f3ecdc"
  deep-ivory: "#e8ddc7"
  passport-sage: "#a6b9a8"
  passport-blue: "#365d71"
  ink: "#201a17"
typography:
  display:
    fontFamily: "TZ Display, Source Han Sans SC, sans-serif"
    fontSize: "clamp(2.8rem, 5.6vw, 4.75rem)"
    fontWeight: 900
    lineHeight: 1.12
    letterSpacing: "-0.045em"
  body:
    fontFamily: "MiSans, HarmonyOS Sans SC, Microsoft YaHei UI, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.8
  title:
    fontFamily: "Source Han Serif SC, Noto Serif CJK SC, Songti SC, serif"
    fontSize: "28px"
    fontWeight: 620
    lineHeight: 1.35
rounded:
  sharp: "2px"
  mark: "6px"
  seal: "50%"
spacing:
  xs: "8px"
  sm: "16px"
  md: "24px"
  lg: "48px"
  xl: "84px"
components:
  button-primary:
    backgroundColor: "{colors.oxblood}"
    textColor: "{colors.warm-ivory}"
    rounded: "{rounded.sharp}"
    padding: "0 19px"
    height: "48px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.oxblood}"
    rounded: "{rounded.sharp}"
    padding: "0 19px"
    height: "48px"
  passport-page:
    backgroundColor: "{colors.warm-ivory}"
    textColor: "{colors.ink}"
    rounded: "{rounded.mark}"
    padding: "38px"
  record-row:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "0"
    padding: "34px 0 38px"

# Design System: 桐灼 GEO 验证护照

## Overview

**Creative North Star: “The Verification Passport”**

桐灼的官网像一本由企业事实、客户问题、公开信源和人工审核共同签注的企业护照。它用档案、签注、纸张和旧金规则表达专业度，让 GEO 看起来是可追溯的长期工作，而不是一块泛化的 AI 控制台。

空间以酒红与烟黑建立安静的入口，再用暖象牙纸张承载服务、案例、问题地图和资讯。首屏的开放护照是唯一的视觉主角；其余页面沿用档案行、问题记录和建档单，保持克制、留白和真实内容边界。

**Key Characteristics:**

- 酒红 / 烟黑 / 暖象牙 / 旧金的档案材料感
- GEO 为主业务，企业 AI 与内容运营为辅助能力
- 护照内页、签注链、档案行和建档单是可复用签名组件
- 动效只服务于盖章、倾斜和页面进入，不依赖动画获取信息

## Colors

颜色像一套低饱和的档案材料：入口沉静，信息区温暖，金色只用于签注、规则和关键行动。

### Primary

- **旧酒红** (`#5e1d2e`): 主行动、活动状态、签注重点和 GEO 业务层级。
- **深酒红** (`#2a1018`): 深色英雄区和知识入口的承托色。

### Secondary

- **旧金** (`#b89859`): 规则线、状态、编号替代和按钮边界。
- **柔金** (`#d8c08b`): 深色背景上的主要行动和轻量高亮。

### Tertiary

- **护照鼠尾草** (`#a6b9a8`): 企业事实页的低对比纸面色。
- **护照蓝** (`#365d71`): 正式 Logo 与少量事实标记。

### Neutral

- **烟黑** (`#130e0f`): 页头、英雄区和页脚。
- **暖象牙** (`#f3ecdc`): 主要阅读和表单背景。
- **深象牙** (`#e8ddc7`): 分区层次、问题记录和纸张阴影。
- **墨色** (`#201a17`): 正文和标题。

**The Archive Accent Rule.** 旧金和酒红必须稀缺；它们标记可行动或可验证的地方，不做大面积装饰。

## Typography

**Display Font:** TZ Display（自托管 Smiley Sans 字体，Source Han Sans SC fallback）

**Body Font:** MiSans, HarmonyOS Sans SC, Microsoft YaHei UI

**Title Font:** Source Han Serif SC, Noto Serif CJK SC, Songti SC

**Character:** 展示字体粗重、压缩、有明确的企业档案辨识度；正文保持中性清晰；纸面标题使用衬线，制造阅读与记录的层次。

### Hierarchy

- **Display** (900, `clamp(2.8rem, 5.6vw, 4.75rem)`, 1.12): 英雄标题和主要页面宣言。
- **Headline** (620, 34–52px, 1.2): 分区主张和方法论标题。
- **Title** (620, 23–32px, 1.35): 服务、案例、问题和文章标题。
- **Body** (400, 14–16px, 1.75–1.85): 解释、摘要和表单辅助文字，正文测量保持在约 65ch 内。
- **Label** (720, 9–12px, 1.1, wide tracking): 状态、栏目、来源链和纸张元信息。

**The Two-Voice Rule.** 深色英雄区用自托管展示字体建立识别；暖象牙阅读区用衬线标题和中性正文保持耐读。

## Layout

桌面内容使用最多约 1200px 的 shell，页面英雄采用左主张 / 中央证据 / 右侧签注链的三段结构。服务、案例、问题地图和文章列表使用横向档案行，避免同尺寸卡片堆叠。联系页采用左侧沟通说明、右侧建档单的双栏布局。

移动端在 680px 以下切换为单列：导航变为可见的菜单按钮，表单和服务记录占满可用宽度，护照页按视口缩放而不是依靠横向滚动。核心内容在首屏即刻可见，滚动显现只作为增强，不是信息前提。

## Elevation & Depth

系统采用“纸张层叠 + 低强度环境阴影”的混合深度。护照封面、纸张和表单有柔和的大半径阴影；档案行和规则线保持平面。护照安全纸纹理、同心圆和压印是有语义的材质证据，不是通用网格背景。

## Shapes

控件和记录行以锐利的 2px 小圆角为主，Logo 牌使用 6px，印章使用椭圆和 50% 圆角。边框多为 1px 旧金或棕色半透明线，避免厚重彩色侧边线。表单输入保持象牙底、细线和明确焦点环。

## Components

### Buttons

- **Shape:** 几乎方正的纸张印章轮廓（2px）。
- **Primary:** 酒红底、暖象牙字，48px 高；英雄主按钮使用柔金底以形成纸张对比。
- **Hover / Focus:** 轻微上移，焦点使用 2px 旧金外环；不使用强发光。
- **Secondary:** 透明底、酒红或柔金边框，用于低风险探索动作。

### Chips

- **Style:** 轻量标签使用细线、透明或低透明纸色；服务页明确写出“灼见 GEO（主业务）”。
- **State:** 活动标签使用酒红文字和底部规则线，不使用紫色胶囊。

### Cards / Containers

- **Corner Style:** 记录容器 0–2px；护照页和表单 2–6px。
- **Background:** 暖象牙、深象牙或透明档案纸。
- **Shadow Strategy:** 只给护照、表单和纸面容器使用环境阴影；记录行默认无阴影。
- **Border:** 1px 棕色/酒红规则线，列表顶部用主酒红线。
- **Internal Padding:** 24–38px，按档案密度调整。

### Inputs / Fields

- **Style:** 象牙底、细棕线、2px 圆角；字段标签使用小号深棕字。
- **Focus:** 酒红边框 + 3px 低透明酒红环。
- **Error / Disabled:** 错误状态应说明问题和恢复方式，并保留已填内容。

### Navigation

- **Style:** 烟黑页头、正式 Logo、暖象牙字；活动项用旧金下划线和清晰文字。
- **Mobile:** 菜单按钮固定在右侧，44px 触控区域，焦点可见；打开后使用深酒红移动导航。

### Verification Passport

中央开放护照是首页签名组件：左页是企业实体档案，右页是事实 / 问题 / 信源印章；指针轻倾、印章入场、纸纹和安全线只用于说明“可验证”的工作属性。

## Do's and Don'ts

### Do:

- **Do** 让 GEO 在导航、首屏和服务列表中成为第一层级。
- **Do** 用企业事实、客户问题、公开信源和审核状态证明专业能力。
- **Do** 保持暖象牙阅读区的留白、档案行和细规则线。
- **Do** 为真实文章与演示文章提供清晰边界，演示内容必须显式标注。
- **Do** 保留减少动画支持、键盘焦点、移动端单列和无横向滚动。

### Don't:

- **Don't** 回到紫色 AI 仪表盘、通用渐变卡片或星空 SaaS 模板。
- **Don't** 把企业 AI、短视频运营与 GEO 做成平级主业务。
- **Don't** 编造客户案例、结果数字、审核状态、价格或交付承诺。
- **Don't** 使用 Unicode 箭头、厚重侧边色条或无语义装饰网格代替设计系统。
- **Don't** 让滚动动画、外部生图或未加载字体成为理解页面的前提。
