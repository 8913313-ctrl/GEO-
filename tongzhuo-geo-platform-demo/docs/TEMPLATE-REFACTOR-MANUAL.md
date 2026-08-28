# 11 套通用模板翻新手册（2026-08-27 起）

## 目标
- 每套模板视觉独立（一业一风，不对齐后台暖色调）；
- SEO 全套基础（title/desc/keywords/canonical/OG/Twitter/JSON-LD/sitemap/robots/feed/llms/语义化）；
- 公司名兜底（超长不崩）；
- 不动源壳 `.mjs` 结构，只动 CSS。

## 渲染链路事实（必须记住）
- **01 走 sourceDocumentShell**：挂 `template-01-industry.css`，body 类 `template-source-01`。
  状态：✅ 已重写为深钢蓝 #1f3a5f + 警示橙 #ea7c2c 工业风。
- **02 走混合**：首页 → sourceDocumentShell 挂 `template-02-construction.css`；服务/案例/关于/联系页 → documentShell 挂 `site-v8.css`。
  状态：✅ 首页 CSS 已重写（建筑土黄 + 深棕）；⚠️ 其余 4 页依赖 site-v8.css 里 02 路由块。
- **03-11 走 documentShell**：挂 `site-v8.css`，body 类 `site-v8 template-XX-...`。
  状态：⏳ 待重写 site-v8.css 路由块（旧 03-09 的 `0X-XXX.css` 是死代码，从未挂到线上 body 上）。

## 11 套色板与气质总表（已定稿）
| # | 行业 | 主色 | 辅色 | 气质 |
|---|------|------|------|------|
| 01 | 工业制造 | #1f3a5f 深钢蓝 | #ea7c2c 警示橙 | 冷峻、参数、车间 |
| 02 | 建筑工程 | #3a2817 深棕 | #a8753a 土黄 | 沉稳、蓝图、匠心 |
| 03 | 软件科技 | #0a0e14 深空黑 | #0d9488 极光青 | 极简、未来、终端 |
| 04 | 物流运输 | #1f2937 沥青灰 | #ea580c 公路橙 | 速度、地图、节点 |
| 05 | 企业服务 | #faf7f1 暖白 | #6d28d9 商务紫 | 期刊、留白、咨询师 |
| 06 | 金融服务 | #14532d 深松绿 | #a16207 烫金 | 克制、机构、稳重 |
| 07 | 医疗健康 | #0f766e 生命青 | #f0fdfa 柔白 | 专业、温和、安心 |
| 08 | 教育培训 | #c2410c 学府橙 | #fff7ed 米杏 | 温暖、学院、纸质 |
| 09 | 旅游酒店 | #be123c 旅途玫红 | #fff7f7 浅纱 | 明艳、画面、向往 |
| 10 | 食品餐饮 | #9a3412 烟火赤陶 | #fffaf0 米白 | 烟火气、食物质感 |
| 11 | UPS 电源 | #1e40af 电气蓝 | #d97706 工业橙 | 硬核、参数、专业级 |

## 公司名兜底规则（每套 CSS 顶部必备）
```css
.brand-text, .brand > span, .logo .brand-text, .template-brand-inline {
  display: inline-block;
  max-width: min(280px, 38vw);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: middle;
}
h1, h2, h3, h4, p, a { overflow-wrap: anywhere; word-break: break-word; }
```

## SEO 字段（每套已由 site-renderer.mjs 全套覆盖）
- 1525 行 sourceDocumentShell + 1556 行 documentShell 都注入了 title/description/keywords/canonical/OG/Twitter/JSON-LD/feed/RSS。
- 行业专属 schema 待 11 套翻新完成后一次性在 pageSchema() 加按 templateKey 区分。

## 11 套各自的「标志性视觉元素」（必须落地）
| # | 标志元素 |
|---|---------|
| 01 | 网格底纹 + 橙色 kicker 线 + 矩形小圆角 + 车间图 + 参数徽章 .param |
| 02 | 卷轴滚动提示 + 衬线字体 + 双线 border + 衬线大数字 + sepia 滤镜 |
| 03 | 终端代码 demo block + 等宽数字 + JetBrains Mono 注释 + 深空黑 |
| 04 | SVG 路线地图 + 节点标签 + 时效环 + 沥青底纹 |
| 05 | 大留白 + 编辑型排版 + 香槟金线 + 衬体副标题 |
| 06 | 极细分割线 + 烫金边框 + 衬线数字 + 合规水印 |
| 07 | 圆角双栏 + 医生头像圆框 + 问诊步骤路径 + 柔青底色 |
| 08 | 课程卡片像课程手册 + 师资头像圆框 + 报名时间线 |
| 09 | 目的地明信片卡 + 大图通栏 + 体验清单 + 玫红/暮金 |
| 10 | 食材大图 + 菜单卡纸风 + 鲜蔬绿点缀 + 赤陶色 |
| 11 | 产品矩阵 + 参数对比表 + 应用场景示意 + 电气蓝 + 工业橙 |

## 实施顺序（与哥哥确认）
1. ✅ 01（已完）
2. ✅ 02 首页（已完；服务/案例/关于/联系页依赖 site-v8.css 02 路由，待 02.5 步处理）
3. ⏳ 03 软件科技（next）
4. ⏳ 04 物流运输
5. ⏳ 05 企业服务
6. ⏳ 06 金融服务
7. ⏳ 07 医疗健康
8. ⏳ 08 教育培训
9. ⏳ 09 文旅酒店
10. ⏳ 10 食品餐饮
11. ⏳ 11 UPS 电源
12. ⏳ site-v8.css 路由块改造（02.5 步 + 03-11 覆盖）
13. ⏳ site-renderer.mjs pageSchema() 行业 schema 区分
14. ⏳ 浏览器实测 / 哥哥验收

## 关键文件状态
- `public-site/assets/template-01-industry.css`：✅ 重写完成（1531 行）
- `public-site/assets/template-02-construction.css`：✅ 重写完成（1648 行）
- `public-site/assets/site-v8.css`：⏳ 路由块待改造
- `public-site/assets/03-software-ai.css` 到 `10-food-consumer.css`：⚠️ 死代码（与 body 类不匹配），待删除或重写留作 fallback
- `public-site/assets/template-11-ups.css`：⏳ 待重写（11 特殊，body 类是 template-source-11）
- `public-site/site-renderer.mjs`：⏳ cssHref 版本号已升 20260827-tpl-01-02-refactor-v1；pageSchema 待补

## 工作笔记（沉淀）
- 03-09 的 `0X-XXX.css` 文件**从未生效**（body 选择器 `template-source-0X` 与 documentShell 实际挂的 `site-v8 template-0X-XXX` 不匹配）。它们是历史遗留，删也行留也行；建议保留为 fallback 不删。
- site-v8.css 里 03-09 的样式**只有 8 行 CSS 变量定义 + 几行 border-radius**，没有布局差异。这是「AI 味道太重」的根本原因——所有模板长得几乎一样，只是颜色变。
- 站点 44127 服务 + webbridge daemon 都没起，没法浏览器实测；本次翻新全部依赖静态校验（括号平衡 + 类名覆盖 + node --check + 版本号同步）。
