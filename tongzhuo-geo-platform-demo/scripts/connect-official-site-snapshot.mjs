import path from "node:path";
import { fileURLToPath } from "node:url";
import { ProductionDatabase } from "../production-database.mjs";
import { productionConfig } from "../production-config.mjs";
import { WorkspaceStore } from "../workspace-store.mjs";

const SNAPSHOT_PAGES = Object.freeze([
  { id: "home", type: "首页", title: "首页", path: "/", description: "企业定位、核心服务、案例与咨询入口" },
  { id: "about", type: "关于页", title: "关于我们", path: "/about.html", description: "企业主体、团队与发展信息" },
  { id: "services", type: "服务页", title: "产品中心", path: "/products.html", description: "服务能力、适用对象与交付边界" },
  { id: "cases", type: "案例页", title: "服务案例", path: "/cases.html", description: "经过审核的客户案例与实施结果" },
  { id: "team", type: "团队页", title: "创始团队", path: "/team.html", description: "企业团队与专业背景" },
  { id: "honors", type: "资质页", title: "荣誉资质", path: "/honors.html", description: "企业资质、荣誉与公开证明" },
  { id: "insights", type: "资讯列表", title: "行业资讯", path: "/insights", description: "已审核并公开发布的行业文章" },
  { id: "issues", type: "FAQ 页", title: "常见问题", path: "/issues.html", description: "企业 GEO 服务常见问题与直接答案" },
  { id: "careers", type: "招聘页", title: "加入我们", path: "/careers.html", description: "招聘信息与团队机会" },
  { id: "contact", type: "联系页", title: "联系方式", path: "/contact.html", description: "咨询表单、服务区域与联系方式" },
  { id: "product-website", type: "产品详情", title: "GEO 优化", path: "/product-website.html", description: "企业 GEO 优化服务说明" },
  { id: "product-content-platform", type: "产品详情", title: "短视频运营", path: "/product-content-platform.html", description: "内容与短视频运营服务说明" },
  { id: "product-distribution", type: "产品详情", title: "企业 AI 落地", path: "/product-distribution.html", description: "企业 AI 落地服务说明" },
  { id: "geo-source", type: "知识页", title: "GEO 知识", path: "/article-geo-source.html", description: "企业 GEO 公开信源建设说明" }
]);

const SNAPSHOT_NAV = Object.freeze([
  ["home", "首页", "/"],
  ["about", "关于我们", "/about.html"],
  ["products", "产品中心", "/products.html"],
  ["cases", "服务案例", "/cases.html"],
  ["team", "创始团队", "/team.html"],
  ["honors", "荣誉资质", "/honors.html"],
  ["insights", "行业资讯", "/insights"],
  ["issues", "常见问题", "/issues.html"],
  ["careers", "加入我们", "/careers.html"],
  ["contact", "联系方式", "/contact.html"]
]);

function argumentsFrom(values) {
  const result = { databasePath: productionConfig.databasePath, workspaceId: "default", dryRun: false, publicAddress: "" };
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--dry-run") result.dryRun = true;
    else if (value === "--database") result.databasePath = path.resolve(values[++index] || "");
    else if (value === "--workspace") result.workspaceId = values[++index] || "default";
    else if (value === "--public-address") result.publicAddress = values[++index] || "";
    else throw new Error(`Unknown argument: ${value}`);
  }
  return result;
}

function mergePage(existing, snapshot, timestamp) {
  return {
    ...(existing || {}),
    ...snapshot,
    status: "published",
    schemaEnabled: existing?.schemaEnabled !== false,
    sitemapEnabled: existing?.sitemapEnabled !== false,
    version: Math.max(1, Number(existing?.version) || 1),
    versions: Array.isArray(existing?.versions) ? existing.versions : [],
    savedAt: existing?.savedAt || timestamp,
    publishedAt: existing?.publishedAt || timestamp,
    seoDescription: existing?.seoDescription || snapshot.description
  };
}

export function connectOfficialSiteSnapshot(state, options = {}) {
  const timestamp = options.timestamp || new Date().toISOString();
  const output = structuredClone(state || {});
  output.site = output.site && typeof output.site === "object" ? output.site : {};
  output.site.cms = output.site.cms && typeof output.site.cms === "object" ? output.site.cms : {};
  const currentPages = Array.isArray(output.site.cms.pages) ? output.site.cms.pages : [];
  const pagesById = new Map(currentPages.filter((item) => item?.id).map((item) => [String(item.id), item]));
  const managedIds = new Set(SNAPSHOT_PAGES.map((item) => item.id));
  const managedPages = SNAPSHOT_PAGES.map((item) => mergePage(pagesById.get(item.id), item, timestamp));
  const remainingPages = currentPages.filter((item) => !managedIds.has(String(item?.id || "")));
  output.site.cms.pages = [...managedPages, ...remainingPages];
  output.site.cms.navItems = SNAPSHOT_NAV.map(([id, label, navPath]) => ({ id: `nav-${id}`, label, path: navPath, type: id === "insights" ? "资讯列表" : "固定页面", visible: true }));
  output.site.cms.settings = { ...(output.site.cms.settings || {}), updatedAt: timestamp };
  output.site.status = "online";
  if (options.publicAddress) output.site.domain = options.publicAddress;
  output.site.deployment = {
    ...(output.site.deployment || {}),
    mode: "容器部署",
    environment: "production",
    rootPath: "/opt/tongzhuo-geo/official-site-static",
    status: "online",
    lastDeployAt: timestamp
  };
  return output;
}

async function main() {
  const options = argumentsFrom(process.argv.slice(2));
  const database = new ProductionDatabase({ databasePath: options.databasePath });
  try {
    const workspaces = new WorkspaceStore(database);
    const workspace = workspaces.get(options.workspaceId);
    if (!workspace.state) throw new Error(`Workspace ${options.workspaceId} is not initialized.`);
    const next = connectOfficialSiteSnapshot(workspace.state, options);
    const summary = { dryRun: options.dryRun, workspaceId: options.workspaceId, previousRevision: workspace.revision, nextRevision: workspace.revision + 1, pages: next.site.cms.pages.length, navigationItems: next.site.cms.navItems.length, domain: next.site.domain || "" };
    if (!options.dryRun) workspaces.save(options.workspaceId, next, { expectedRevision: workspace.revision, reason: "official-site-snapshot-connection" });
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    database.close();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
