# P2-T03 桐灼项目种子与通用底座分离（2026-08-11）

## 结论

桐灼不再是新客户项目的隐式默认值。空白客户使用中性企业身份、空服务、空案例、空问题组和空内容；只有显式配置 `TZ_PROJECT_SEED=tongzhuo-geo` 时，才初始化桐灼品牌与业务种子。

## 已实现

- 新增 `project-seeds/tongzhuo-geo.mjs` 与种子注册表。
- 桐灼公司主体、品牌、服务、案例、问题组、Logo 资源和 ICP 备案进入 `tongzhuo-geo` 项目种子。
- `SiteCmsStore` 只在新工作区首次初始化时读取显式项目种子；既有草稿和正式版本不被种子覆盖。
- 公共官网默认名称改为“企业官网 / 企业”，不再把中性名称反向替换为桐灼。
- 官网 Logo、品牌图标、结构化数据 Logo、页脚栏目和 ICP 改为 CMS 设置驱动；未配置 ICP 时不输出备案链接。
- 前端演示回退仅允许 `tongzhuo-geo` 项目在非生产环境显式启用，其他项目不会继承桐灼演示内容。
- 后台首次本地启动、无效本地状态和“清空当前客户空间”统一使用 `cloneBlankState()`，不会恢复桐灼演示业务数据。

## 身份字段

CMS `settings` 新增以下可公开字段：

- `brandLogoUrl`
- `brandMarkUrl`
- `brandMarkOnDarkUrl`
- `schemaLogoUrl`
- `footerIcp`
- `footerLabel`

所有 URL 继续经过公开 URL 校验；相对资源必须以 `/` 开头，不接受带用户名或密码的远程 URL。

## 验收证据

`scripts/check-project-seeds.mjs` 同时创建空白客户与桐灼客户：

- 空白客户 CMS 不含桐灼服务、案例或问题组。
- 空白客户首页、关于页和资讯页 HTML 不含“桐灼”“灼见”、桐灼 Logo 路径或 `鲁ICP备2026021587号-2`。
- 桐灼种子首页仍包含“桐灼科技”、正式 Logo 和 ICP 备案。
- 种子初始化生成的草稿与正式版本校验和一致。

本轮通过：

```text
npm run check:workspace-seed
npm run check:site
node scripts/check-tenant-config.mjs
git diff --check
```

## 边界

共享后台仍保留 GEO 方法、内置写作助手和通用交付能力；这些属于产品底座，不属于客户业务数据。`public/app.js` 中的历史演示状态仍作为显式开发样例存在，但不再用于新客户、无本地状态或清空后的初始化。下一任务 P2-T04 将把行业术语、默认问题组、内容类型和导航预设拆成行业适配接口。
