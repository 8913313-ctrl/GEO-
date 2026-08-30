# Google AI Studio 指令：11 套企业官网模板接入同一后台

你要处理的是 11 套企业官网模板的工程化接入，不是重新设计一个后台，也不是为某一个行业单独写一套数据库。

## 目标

在保留每套官网现有页面结构、样式、字体、图片、动画、滚动效果、交互组件和响应式行为的前提下，把每套模板改造成可被同一个企业官网后台切换和供数的 React 前端。模板可以有完全不同的视觉表现，但必须遵守同一份数据接口和构建协议。

11 个模板 key 如下：

```text
01-industry
02-construction
03-software-ai
04-logistics
05-business-services
06-finance
07-healthcare
08-education
09-travel-hotel
10-food-consumer
11-ups
```

## 后台接口契约

正式官网使用同源接口，不要把 API 地址写死成 localhost，也不要在前端保存账号、密码、Token 或数据库连接信息。

```text
GET  /api/v1/site-public/bootstrap
POST /api/v1/leads
```

`bootstrap` 返回以下结构：

```ts
type SiteContentItem = {
  id: string;
  kind: 'offering' | 'proof' | 'credential' | 'partner' | 'testimonial' | 'person' | 'scene' | 'faq' | 'media';
  title: string;
  subtitle?: string;
  label?: string;
  summary?: string;
  description?: string;
  content?: string;
  image?: string;
  imageAlt?: string;
  gallery?: string[];
  tags?: string[];
  facts?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  status?: string;
  order?: number;
};

type SiteBootstrap = {
  site?: {
    siteName?: string;
    companyName?: string;
    description?: string;
    cta?: string;
    settings?: Record<string, unknown>;
    assets?: Record<string, unknown>;
    footer?: Record<string, unknown>;
    navItems?: Array<Record<string, unknown>>;
  };
  templateKey?: string;
  theme?: Record<string, unknown>;
  pages?: Array<Record<string, unknown>>;
  blocks?: Array<Record<string, unknown>>;
  contentItems?: SiteContentItem[];
  assets?: Record<string, unknown>;
  articles?: Array<Record<string, unknown>>;
  problemGroups?: Array<Record<string, unknown>>;
};
```

页面模板只读取自己需要的 `kind` 和 `facts`，不要新增数据库列、行业专用表或行业专用 API。一个案例可以携带不同企业需要的事实，例如：

```json
{
  "kind": "proof",
  "title": "某数据中心 UPS 项目",
  "facts": {
    "credential": "国家一级资质",
    "certification": "LEED 认证",
    "client": "客户名称",
    "area": "工程面积",
    "amount": "项目金额",
    "duration": "项目周期",
    "customerReview": "客户评价",
    "constructionLog": "模拟施工日志"
  }
}
```

这些只是可选事实键，不是数据库字段。前端必须对缺失事实优雅降级，不显示 `undefined`、空卡片或虚构数据；未经后台发布的数据不能显示。

## 前端实现要求

1. 新增 `src/api/siteClient.ts`，请求同源 `/api/v1/site-public/bootstrap`，将响应类型化；请求失败时保留当前源码中的演示内容作为明确的本地 fallback。
2. 新增 `src/data/siteAdapter.ts`，只负责把通用 `SiteBootstrap` 映射为当前模板已有的数据对象。不要把 API 请求、业务判断和页面视觉组件混在一起。
3. 在应用根组件挂载时只请求一次 bootstrap；成功后更新现有数据源，不能破坏现有动画初始化、滚动观察器、弹窗、计算器、筛选器、轮播和移动端菜单。
4. 站点名称、公司名称、电话、邮箱、地址、主题色、导航和 CTA 优先读取 `bootstrap.site`；缺失时使用当前模板已有 fallback。
5. `offering` 映射到现有产品/服务列表，`proof` 映射到现有案例/项目列表，`credential` 映射到资质区，`partner` 映射到合作品牌，`testimonial` 映射到客户评价；`scene`、`faq`、`person`、`media` 按模板已有模块接入，没有对应模块时保留数据但不要硬塞进不合适的视觉区域。
6. 所有咨询表单统一 POST 到 `/api/v1/leads`，字段使用 `name`、`phone`、`company`、`service`、`message`、`source_url`。提交前做前端校验，提交后显示成功/失败状态，不能把表单内容发送到第三方。
7. 不修改现有内容文案、视觉排版和动画的意图；后台内容接入是数据替换层。除非当前模板已有对应位置，不要为了展示一个字段强行新增一块视觉区域。
8. 图片必须沿用当前资源路径或 bootstrap 返回的图片地址；不要引用不可部署的本机绝对路径。

## 构建与挂载协议

每套模板都必须能独立执行：

```text
npm run lint
npm run build
```

构建输出为 `dist/`，Vite `base` 使用 `/`，入口 HTML 能直接从站点根路径运行，资源使用 `/assets/...`。不要把开发服务器配置写进生产入口。后端会把 `dist/` 作为只读静态根目录，并启用 HTML 路由回退到 `index.html`；缺失的 JS、CSS、图片仍必须返回 404。

## 禁止事项

- 不要删除或覆盖现有动画、交互、组件和图片资源。
- 不要创建 `ups_cases`、`construction_projects` 等行业专用表或字段。
- 不要把国家资质、LEED、客户名称、金额、周期等事实写死在模板源码中。
- 不要把 demo 数据伪装成后台正式数据；fallback 必须只在接口不可用或对应集合为空时使用。
- 不要把公司长介绍直接当作行业文章；公司基础信息和文章内容分开处理。
- 不要改动后台认证、发布、审核和回滚规则。

## 验收标准

- 每个模板保留原有视觉效果和交互行为，桌面端与移动端均可运行。
- API 可用时，后台发布的站点信息、产品/服务、案例、资质、品牌、评价和可选 facts 能在合适的原有模块中出现。
- API 不可用时，模板仍能以原有 fallback 启动，不白屏。
- 表单成功进入后台的 `site_contact_leads`，错误时有可理解提示。
- `npm run lint` 和 `npm run build` 通过。
- 构建后的 `dist/` 可被后端以 `TZ_SITE_STATIC_ROOT` 挂载；深层 HTML 路由刷新不白屏，静态资源路径正确。
- 不出现行业专用 API、数据库列、绝对本机路径、账号密码或密钥。

完成后请输出：修改文件清单、接口调用位置、数据映射表、构建命令、已验证项目和仍需人工确认的内容，不要只给截图。
