# 本地代码地图（2026-08-29）

## 目的

这份地图用于收敛 AI 多轮生成后的代码来源。整理期间先以“唯一运行入口、唯一数据来源、旧实现不参与运行”为准，不凭文件名删除代码。

## 当前运行边界

| 区域 | 当前事实 | 处理原则 |
|---|---|---|
| `tongzhuo-geo-platform-demo/` | 主应用，Node.js 24，后台 44127、官网 19080 | 第一优先级治理对象 |
| `demo-company-homepage/` | 桐灼专属官网静态源 | 只保留当前确认视觉，旧版进 Git 历史/归档 |
| `tongzhuo-geo-platform-demo/public/` | 后台 UI、脚本和样式 | 按业务模块拆分，保持入口兼容 |
| `tongzhuo-geo-platform-demo/public-site/` | CMS/模板官网渲染器与内置资源 | 与专属静态官网明确隔离 |
| `geo-data-hub-demo/` | 独立数据/中继实验项目 | 暂不与主应用混编 |
| `publisher-assistant/` | 独立发布器桌面/服务项目 | 暂不与主应用混编 |
| `server-integration-copy/` | 服务器集成副本/历史材料 | 标记为待确认，不作为运行入口 |
| `tongzhuo-product-template/` | 产品模板与桌面代理 | 标记为待确认，不作为主应用依赖 |

## 已确认的高风险复杂点

- `public/js/modules/content-review.js` 当前约 4,938 行：内容审核、直接创作、协作建议等职责仍混在一起；已先拆出风险高亮、旧知识卡兼容和发布排期三个边界模块。
- 后台前端 11 个模块均以共享全局 `state/ui/render` 协作，缺少 import/export 边界；除 `content-review.js` 外，`monitoring-analysis.js` 3,111 行、`bootstrap.js` 2,589 行、`effect.js` 2,308 行，也已超过单文件可维护范围。
- `public/styles.css` 约 5,624 行：后台全局样式与历史覆盖层混在一起。
- `public-site/site-renderer.mjs` 约 2,993 行：CMS 页面、模板、专属客户内容和导航逻辑集中在一个文件。
- 官网存在两套脚本来源：`demo-company-homepage/assets/site.js` 与 `public-site/assets/site.js`。此前已出现内置脚本覆盖专属官网脚本的真实故障；必须保留明确的路由优先级测试。
- `tongzhuo-geo-platform-demo/dist/` 是被 `.gitignore` 忽略的构建产物，包含多个重复 delivery bundle，不是源码来源。
- `tongzhuo-product-template/website/corporate.css` 与 `website/assets/corporate.css` 内容重复，需在确认引用后合并或归档。

## 第一阶段清理边界

允许先做：

1. 清理可重建且未被 Git 跟踪的 `dist/`、临时包和解压目录。
2. 为主应用补充模块依赖清单和入口测试。
3. 将 `content-review.js` 按职责拆成“状态/生成/协作/审核”模块，外部入口暂时保持不变。
4. 将官网运行时资源路由写成显式契约，禁止内置资源覆盖静态官网资源。

暂不做：

- 不删除任何业务 `.mjs/.js/.css`，除非已确认无引用并有回归测试。
- 不改数据库结构、不迁移线上数据、不重写全部官网模板。
- 不把 `dist/` 里的构建文件反向当作源码修复。

## 已完成的整理批次

- 2026-08-29：从 `public/js/modules/content-review.js` 拆出 `content-review-risk.js`，仅承载文章风险文字清理、匹配和高亮 HTML 工具函数；继续通过经典脚本暴露原有全局函数，`index.html` 保持原模块加载顺序。`node --check` 与 `check:direct-studio` 已通过，未删除业务逻辑。
- 2026-08-29：从同一文件拆出 `content-review-knowledge-legacy.js`，仅承载旧版结构化知识卡的兼容渲染、保存和同步；依赖的知识工作区全局仍由 `knowledge.js` 提供，入口在其后、主内容模块前加载。后台直接创作与官网 `check:site` 均通过。
- 2026-08-29：按源码顺序继续拆出 `content-review-publish-schedule.js`，承载发布任务聚合状态、定时排期计算/预览/提交/取消和排期列表渲染；原有 `data-action` 全局函数名保持不变。主文件降至约 4,938 行，相关语法、直接创作和官网检查通过。
- 2026-08-29：继续拆出 `content-review-article-workflow.js`，承载文章编辑弹窗、版本保存、人工审核、批量审核、即时发布和发布任务详情；原有工作流 action 名称保持不变。主文件降至约 4,283 行，语法、直接创作和官网检查通过。
- 2026-08-29：继续拆出 `content-review-shell-modals.js`，承载命令搜索、通知和发布器配对弹窗；这些函数只依赖既有全局 `state/ui/modalChrome`，原有 action 保持不变。主文件降至约 4,213 行，相关检查通过。
- 2026-08-29：继续拆出 `content-review-knowledge-library.js`，承载知识库图片批量上传、资料导入、新建知识库、知识库详情和知识条目编辑；`content-review.js` 只保留后续的知识包和生成预览等区块。`node --check`、`npm run check:direct-studio`、`npm run check:site`、`npm run check:knowledge-multimedia` 均通过。
- 2026-08-29：继续拆出 `content-review-generation-preview.js`，承载生成方案确认、证据选择、知识缺口提示和引用证据弹窗；`content-review.js` 只保留知识包、onboarding 和后续业务区块。`node --check`、`npm run check:direct-studio`、`npm run check:site`、`npm run check:knowledge-multimedia` 均通过。
- 2026-08-29：继续拆出 `content-review-question-library.js`，承载核心关键词、种子词拓展、问题词包生成、选题生成和候选维护；`content-review.js` 只保留知识包、onboarding 和后续业务区块。`node --check`、`npm run check:site` 已通过，`npm run check:direct-studio`、`npm run check:planning-generation-flow` 在本会话中曾被审批系统拦截，已如实记录。

## 验收要求

- 2026-08-29：补回 `content-review.js` 的 direct-studio 协作兼容段，恢复 `studioEvidenceFromCitation`、`aiEvidencePayload`、`applyRemoteArticleResult`、`requestAiArticle` 与 `sendStudioChat`，并把 `content-review.js` 的查询版本升到 `20260829-question-library-v2`；`node --check`、`npm run check:direct-studio`、`node scripts/check-planning-generation-flow.mjs`、`npm run check:site` 均通过。

- 修改前后记录 `git diff`，每个整理批次独立提交。
- JavaScript/MJS 运行 `node --check`。
- 后台与官网分别运行最小 smoke check。
- 官网必须验证：静态资源来源、资讯文章投影、问题地图投影、无数据兜底。
- 每批清理都保留可回滚的 Git 提交，不使用 `final/final2/v3` 文件名继续分叉。
