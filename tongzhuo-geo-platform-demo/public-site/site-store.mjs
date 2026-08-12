import path from "node:path";
import { fileURLToPath } from "node:url";
import { ProductionDatabase } from "../production-database.mjs";
import { SiteCmsStore } from "../site-cms-store.mjs";
import { slugify, truncateText } from "./site-renderer.mjs";
import { applyPublicCitationVisibility } from "../citation-visibility.mjs";
import { resolveProjectSeed } from "../project-seeds/index.mjs";
import { getSiteTemplate } from "./templates/site-template-registry.mjs";

const moduleRoot = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DATABASE_PATH = path.resolve(moduleRoot, "..", "data", "tongzhuo-production.sqlite");

function parseJson(value, fallback = {}) {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function text(value, fallback = "", maximum = 2_000) {
  const result = String(value ?? "").replace(/\u0000/g, "").trim();
  return (result || fallback).slice(0, maximum);
}

function list(value) {
  if (Array.isArray(value)) return value.map((item) => text(item, "", 120)).filter(Boolean);
  if (typeof value === "string") return value.split(/[,，、;；|]/).map((item) => text(item, "", 120)).filter(Boolean);
  return [];
}

function normalizePath(value, fallback = "/") {
  const candidate = text(value, fallback, 500);
  if (!candidate.startsWith("/") || candidate.startsWith("//") || /[\r\n]/.test(candidate)) return fallback;
  return candidate;
}

function rewritePublishedKnowledgeAssetUrls(value, basePath = "") {
  const source = String(value || "");
  const base = String(basePath || "").replace(/\/+$/, "");
  if (!base) return source;
  return source.replace(/\/api\/v1\/knowledge\/assets\/([A-Za-z0-9._:-]+)\/content\b/g, (_match, assetId) => `${base}/${encodeURIComponent(assetId)}`);
}

function nested(object, ...paths) {
  for (const dottedPath of paths) {
    const value = String(dottedPath).split(".").reduce((current, key) => current?.[key], object);
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

function defaultSite() {
  return {
    siteName: "企业官网",
    companyName: "企业",
    description: "企业公开信息、产品服务与行业内容。",
    allowAiCrawl: true,
    cta: "预约业务咨询",
    updatedAt: null,
    pages: [
      { id: "home", title: "首页", path: "/", status: "published", sitemapEnabled: true },
      { id: "services", title: "产品与服务", path: "/services/", status: "published", sitemapEnabled: true },
      { id: "cases", title: "服务案例", path: "/cases/", status: "published", sitemapEnabled: true },
      { id: "insights", title: "行业资讯", path: "/insights/", status: "published", sitemapEnabled: true },
      { id: "problem-map", title: "问题地图", path: "/problem-map/", status: "published", sitemapEnabled: true },
      { id: "about", title: "关于我们", path: "/about/", status: "published", sitemapEnabled: true },
      { id: "contact", title: "联系我们", path: "/contact/", status: "published", sitemapEnabled: true }
    ],
    navItems: [
      { id: "nav-home", label: "首页", path: "/", visible: true },
      { id: "nav-services", label: "产品与服务", path: "/services/", visible: true },
      { id: "nav-cases", label: "服务案例", path: "/cases/", visible: true },
      { id: "nav-insights", label: "行业资讯", path: "/insights/", visible: true },
      { id: "nav-problem-map", label: "问题地图", path: "/problem-map/", visible: true },
      { id: "nav-about", label: "关于我们", path: "/about/", visible: true },
      { id: "nav-contact", label: "联系我们", path: "/contact/", visible: true }
    ]
  };
}

export class PublicSiteStore {
  constructor(options = {}) {
    this.workspaceId = text(options.workspaceId || process.env.TZ_TENANT_ID, "default", 120);
    this.projectSeedKey = text(options.projectSeedKey || process.env.TZ_PROJECT_SEED, "", 120);
    this.projectSeed = resolveProjectSeed(this.projectSeedKey);
    this.database = options.database || new ProductionDatabase({ databasePath: options.databasePath || process.env.TZ_DATABASE_PATH || DEFAULT_DATABASE_PATH });
    this.ownsDatabase = !options.database;
    this.cmsStore = options.cmsStore || new SiteCmsStore(this.database, { workspaceId: this.workspaceId, projectSeedKey: this.projectSeedKey });
    // The admin editor stores authenticated knowledge-asset URLs. The public
    // runtime rewrites those URLs to its read-only media route at publication
    // time; draft preview leaves them untouched and continues using admin auth.
    this.publicKnowledgeAssetBase = String(options.publicKnowledgeAssetBase || "").trim().replace(/\/+$/, "");
    this.publicSnapshotCache = null;
    this.publicSnapshotCacheTtlMs = Math.max(100, Math.min(10_000, Number(options.publicSnapshotCacheTtlMs) || 1_000));
  }

  publicContentFingerprint() {
    const row = this.database.connection.prepare(`
      SELECT COUNT(*) AS article_count, COALESCE(MAX(a.updated_at), '') AS article_updated_at,
        COALESCE(MAX(v.frozen_at), '') AS version_frozen_at
      FROM content_articles a
      JOIN content_article_versions v ON v.id = a.approved_version_id AND v.article_id = a.id
      WHERE a.workspace_id = ? AND a.status = 'published'
        AND v.review_status = 'approved' AND v.frozen_at IS NOT NULL
        AND v.risk_status IN ('passed', 'warning')
    `).get(this.workspaceId);
    return `${Number(row?.article_count || 0)}:${row?.article_updated_at || ""}:${row?.version_frozen_at || ""}`;
  }

  workspace() {
    const row = this.database.connection.prepare("SELECT revision, state_json, updated_at FROM workspace_state WHERE workspace_id = ?").get(this.workspaceId);
    return row ? { revision: Number(row.revision), state: parseJson(row.state_json), updatedAt: row.updated_at } : { revision: 0, state: {}, updatedAt: null };
  }

  siteConfig(workspace = this.workspace(), cmsSnapshot = null) {
    const defaults = defaultSite();
    const state = workspace.state || {};
    const site = parseJson(state.site, {});
    const cms = cmsSnapshot && typeof cmsSnapshot === "object" ? cmsSnapshot : parseJson(site.cms, {});
    const settings = parseJson(cms.settings, {});
    const theme = parseJson(cms.theme, {});
    const template = getSiteTemplate(theme.key || theme.templateKey || theme.template);
    const pages = Array.isArray(cms.pages) ? cms.pages : defaults.pages;
    const navItems = Array.isArray(cms.navItems) ? cms.navItems : defaults.navItems;
    return {
      projectSeedKey: this.projectSeedKey,
      projectId: text(this.projectSeed?.projectId, this.projectSeedKey || this.workspaceId, 120),
      tenantId: text(this.projectSeed?.tenantId, this.workspaceId, 120),
      industryTemplate: text(this.projectSeed?.industryTemplate, "", 120),
      demo: this.projectSeed?.demo === true,
      siteName: text(settings.siteName, defaults.siteName, 160),
      companyName: text(settings.companyName, defaults.companyName, 300),
      officialDomain: text(settings.officialDomain, "", 300),
      logoUrl: text(settings.logoUrl, "", 1_000),
      brandLogoUrl: text(settings.brandLogoUrl, "", 1_000),
      brandMarkUrl: text(settings.brandMarkUrl, "", 1_000),
      brandMarkOnDarkUrl: text(settings.brandMarkOnDarkUrl, "", 1_000),
      schemaLogoUrl: text(settings.schemaLogoUrl, "", 1_000),
      footerIcp: text(settings.footerIcp, "", 120),
      footerLabel: text(settings.footerLabel, "企业", 120),
      leadForm: { enabled: settings.leadForm?.enabled !== false, nameLabel: text(settings.leadForm?.nameLabel, "姓名", 40), contactLabel: text(settings.leadForm?.contactLabel, "联系方式", 40), companyLabel: text(settings.leadForm?.companyLabel, "企业名称", 40), serviceLabel: text(settings.leadForm?.serviceLabel, "咨询方向", 40), websiteLabel: text(settings.leadForm?.websiteLabel, "企业官网", 40), messageLabel: text(settings.leadForm?.messageLabel, "需要解决的问题", 60), messagePlaceholder: text(settings.leadForm?.messagePlaceholder, "请描述企业现状、目标和当前遇到的问题", 200), submitLabel: text(settings.leadForm?.submitLabel, "提交咨询", 40), responsePromise: text(settings.leadForm?.responsePromise, "提交后 1 个工作日内回复", 160), privacyNotice: text(settings.leadForm?.privacyNotice, "填写内容仅用于本次业务联系", 240), showCompany: settings.leadForm?.showCompany !== false, showService: settings.leadForm?.showService !== false, showWebsite: settings.leadForm?.showWebsite === true, showMessage: settings.leadForm?.showMessage !== false },
      sameAs: Array.isArray(settings.sameAs) ? [...new Set(settings.sameAs.map((item) => text(item, "", 1_000)).filter(Boolean))].slice(0, 12) : [],
      description: text(settings.description, defaults.description, 500),
      allowAiCrawl: settings.allowAiCrawl !== false,
      cta: text(theme.cta, defaults.cta, 80),
      // Local front-end walkthroughs may show clearly marked presentation
      // fallbacks. Production deployments disable them by default; the CMS
      // publication remains the only official content source.
      frontendDemo: this.projectSeedKey === "tongzhuo-geo" && String(process.env.TZ_SITE_FRONTEND_DEMO ?? (process.env.NODE_ENV === "production" ? "false" : "true")).toLocaleLowerCase("en-US") !== "false",
      updatedAt: settings.updatedAt || workspace.updatedAt || null,
      revision: workspace.revision,
      cmsSchemaVersion: Number(cms.schemaVersion || 0),
      theme: {
        key: template.key,
        name: text(theme.name, "企业官网 · 标准版", 160),
        primaryColor: /^#[0-9a-f]{6}$/i.test(theme.primaryColor || "") ? theme.primaryColor : "#155eef",
        version: Math.max(1, Number(theme.version) || 1)
      },
      template: { key: template.key, category: template.category, variant: template.variant, name: template.name, description: template.description, color: template.color },
      modules: parseJson(cms.modules, {}),
      // Keep null distinct from an explicitly empty collection. Null means an
      // older publication did not contain this CMS capability and allows the
      // local walkthrough fallback; [] is an intentional empty publication.
      services: Array.isArray(cms.services) ? cms.services : null,
      cases: Array.isArray(cms.cases) ? cms.cases : null,
      problemGroups: Array.isArray(cms.problemGroups) ? cms.problemGroups : null,
      businessLines: Array.isArray(cms.businessLines) ? cms.businessLines : [],
      redirects: Array.isArray(cms.redirects) ? cms.redirects : [],
      contact: {
        phone: text(settings.phone, "", 80), email: text(settings.email, "", 160),
        address: text(settings.address, "", 300), serviceArea: text(settings.serviceArea, "", 200),
        industryRegion: text(settings.industryRegion, "", 200)
      },
      pages: pages.filter((item) => item && typeof item === "object").map((item, index) => ({
        id: text(item.id, `page-${index + 1}`, 160),
        type: text(item.type, "标准页", 80),
        title: text(item.title, "页面", 200),
        path: normalizePath(item.path, "/"),
        status: item.status === "published" ? "published" : "draft",
        sitemapEnabled: item.sitemapEnabled !== false,
        schemaEnabled: item.schemaEnabled !== false,
        description: text(item.description, "", 500),
        seoDescription: text(item.seoDescription, "", 500),
        publishedAt: item.publishedAt || null,
        updatedAt: item.savedAt || item.updatedAt || null
      })),
      navItems: navItems.filter((item) => item && typeof item === "object").map((item, index) => ({
        id: text(item.id, `nav-${index + 1}`, 160),
        label: text(item.label, "导航", 120),
        path: normalizePath(item.path, "/"),
        visible: item.visible !== false
      }))
    };
  }

  categories(workspace = this.workspace(), cmsSnapshot = null) {
    const cms = cmsSnapshot && typeof cmsSnapshot === "object" ? cmsSnapshot : parseJson(parseJson(workspace.state?.site, {}).cms, {});
    const raw = Array.isArray(cms.categories) ? cms.categories : [];
    const used = new Set();
    return raw.filter((item) => item && typeof item === "object" && item.status !== "archived").map((item, index) => {
      const name = text(item.name, `栏目 ${index + 1}`, 160);
      const base = slugify(item.slug || name, `category-${index + 1}`);
      let slug = base;
      let suffix = 2;
      while (used.has(slug)) { slug = `${base}-${suffix}`; suffix += 1; }
      used.add(slug);
      return {
        id: text(item.id, `category-${index + 1}`, 160), name, slug,
        description: text(item.description, "", 500), seoDescription: text(item.seoDescription, "", 500),
        status: item.status || "active", navVisible: item.navVisible !== false, updatedAt: item.updatedAt || null
      };
    });
  }

  publishedRows() {
    return this.database.connection.prepare(`
      SELECT
        a.id, a.title AS article_title, a.category, a.metadata_json AS article_metadata_json,
        a.created_at AS article_created_at, a.updated_at AS article_updated_at,
        v.id AS version_id, v.version_number, v.title AS version_title, v.content_html, v.content_text, v.excerpt,
        v.review_status, v.risk_status, v.metadata_json AS version_metadata_json, v.frozen_at, v.created_at AS version_created_at
      FROM content_articles a
      JOIN content_article_versions v ON v.id = a.approved_version_id
      WHERE a.workspace_id = ?
        AND a.status = 'published'
        AND v.article_id = a.id
        AND v.review_status = 'approved'
        AND v.frozen_at IS NOT NULL
        AND v.risk_status IN ('passed', 'warning')
      ORDER BY COALESCE(json_extract(a.metadata_json, '$.sitePublishedAt'), json_extract(a.metadata_json, '$.publishedAt'), a.updated_at) DESC, a.id DESC
    `).all(this.workspaceId);
  }

  articles(workspace = this.workspace(), categories = this.categories(workspace)) {
    const byId = new Map(categories.map((item) => [item.id, item]));
    const bySlug = new Map(categories.map((item) => [item.slug.toLocaleLowerCase("en-US"), item]));
    const byName = new Map(categories.map((item) => [item.name.toLocaleLowerCase("zh-CN"), item]));
    // The workspace state stores CMS presentation fields while the SQL content
    // tables hold the publication gate and body. It may enrich an already
    // public record, but can never make a non-published SQL article visible.
    const presentations = new Map((Array.isArray(workspace.state?.articles) ? workspace.state.articles : [])
      .filter((item) => item && typeof item === "object" && item.id)
      .map((item) => [String(item.id), item]));
    const usedSlugs = new Set();
    return this.publishedRows().map((row) => {
      const articleMetadata = parseJson(row.article_metadata_json, {});
      const versionMetadata = parseJson(row.version_metadata_json, {});
      const presentation = presentations.get(String(row.id)) || {};
      const metadata = {
        ...versionMetadata,
        ...articleMetadata,
        site: { ...parseJson(versionMetadata.site, {}), ...parseJson(articleMetadata.site, {}), ...parseJson(presentation.site, {}) },
        // Whitelist presentation-only CMS fields. In particular, never take a
        // title, body or review state from workspace JSON.
        siteSlug: presentation.siteSlug ?? articleMetadata.siteSlug ?? versionMetadata.siteSlug,
        siteCategory: presentation.siteCategory ?? articleMetadata.siteCategory ?? versionMetadata.siteCategory,
        siteCategoryId: presentation.siteCategoryId ?? articleMetadata.siteCategoryId ?? versionMetadata.siteCategoryId,
        siteCategorySlug: presentation.siteCategorySlug ?? articleMetadata.siteCategorySlug ?? versionMetadata.siteCategorySlug,
        siteAuthor: presentation.siteAuthor ?? articleMetadata.siteAuthor ?? versionMetadata.siteAuthor,
        siteExcerpt: presentation.siteExcerpt ?? articleMetadata.siteExcerpt ?? versionMetadata.siteExcerpt,
        sitePublishedAt: presentation.sitePublishedAt ?? articleMetadata.sitePublishedAt ?? versionMetadata.sitePublishedAt,
        siteUpdatedAt: presentation.siteUpdatedAt ?? articleMetadata.siteUpdatedAt ?? versionMetadata.siteUpdatedAt,
        keywords: presentation.keywords ?? articleMetadata.keywords ?? versionMetadata.keywords,
        tags: presentation.tags ?? articleMetadata.tags ?? versionMetadata.tags
      };
      const categoryValue = text(nested(metadata, "siteCategory", "site.category", "categoryName", "category") || row.category, "行业观点", 160);
      const categoryId = text(nested(metadata, "siteCategoryId", "site.categoryId", "categoryId"), "", 160);
      const categorySlugValue = text(nested(metadata, "siteCategorySlug", "site.categorySlug", "categorySlug"), "", 160);
      const category = byId.get(categoryId) || bySlug.get(slugify(categorySlugValue, "").toLocaleLowerCase("en-US")) || byName.get(categoryValue.toLocaleLowerCase("zh-CN")) || null;
      const title = text(row.version_title || row.article_title, "未命名文章", 300);
      const baseSlug = slugify(nested(metadata, "siteSlug", "site.slug", "slug") || title, slugify(row.id, "article"));
      let slug = baseSlug;
      if (usedSlugs.has(slug)) slug = `${baseSlug}-${slugify(row.id, "article").slice(-24)}`;
      let suffix = 2;
      while (usedSlugs.has(slug)) { slug = `${baseSlug}-${suffix}`; suffix += 1; }
      usedSlugs.add(slug);
      const author = text(nested(metadata, "siteAuthor", "site.author", "author"), "企业内容团队", 160);
      const excerpt = text(row.excerpt || nested(metadata, "siteExcerpt", "site.excerpt", "excerpt") || truncateText(row.content_text || row.content_html, 180), "", 2_000);
      return {
        id: row.id, versionId: row.version_id, version: Number(row.version_number), title, slug, excerpt, author,
        categoryId: category?.id || categoryId || null, categoryName: category?.name || categoryValue,
        categorySlug: category?.slug || (categorySlugValue ? slugify(categorySlugValue, "") : null),
        tags: [...new Set([...list(nested(metadata, "keywords", "site.keywords")), ...list(nested(metadata, "tags", "site.tags"))])].slice(0, 20),
        contentHtml: applyPublicCitationVisibility(rewritePublishedKnowledgeAssetUrls(row.content_html || "", this.publicKnowledgeAssetBase), metadata),
        contentText: applyPublicCitationVisibility(String(row.content_text || ""), metadata),
        publishedAt: nested(metadata, "sitePublishedAt", "site.publishedAt", "publishedAt") || row.article_updated_at || row.frozen_at || row.version_created_at,
        updatedAt: nested(metadata, "siteUpdatedAt", "site.updatedAt", "updatedAt") || row.article_updated_at || row.frozen_at,
        reviewStatus: row.review_status, riskStatus: row.risk_status, frozenAt: row.frozen_at, metadata
      };
    });
  }

  snapshot(options = {}) {
    if (!options.draft) {
      const publication = this.cmsStore.publication(this.workspaceId);
      const workspace = this.workspace();
      const cacheKey = `${publication.releaseId}:${workspace.revision}:${this.publicContentFingerprint()}:${this.publicKnowledgeAssetBase}`;
      if (this.publicSnapshotCache?.key === cacheKey && Date.now() - this.publicSnapshotCache.createdAt < this.publicSnapshotCacheTtlMs) return this.publicSnapshotCache.value;
      const site = this.siteConfig(workspace, publication.snapshot);
      site.cmsReleaseId = publication.releaseId;
      site.cmsReleaseVersion = publication.version;
      site.cmsDraftRevision = publication.sourceDraftRevision;
      site.updatedAt = publication.publishedAt;
      const categories = this.categories(workspace, publication.snapshot);
      const value = { workspaceId: this.workspaceId, workspaceRevision: workspace.revision, cms: { mode: "published", ...publication }, site, categories, articles: this.articles(workspace, categories) };
      this.publicSnapshotCache = { key: cacheKey, value, createdAt: Date.now() };
      return value;
    }
    const workspace = this.workspace();
    const cmsRecord = this.cmsStore.draft(this.workspaceId);
    const site = this.siteConfig(workspace, cmsRecord.snapshot);
    site.cmsReleaseId = null;
    site.cmsReleaseVersion = null;
    site.cmsDraftRevision = cmsRecord.revision;
    site.updatedAt = cmsRecord.updatedAt;
    const categories = this.categories(workspace, cmsRecord.snapshot);
    const articles = this.articles(workspace, categories);
    return { workspaceId: this.workspaceId, workspaceRevision: workspace.revision, cms: { mode: "draft", ...cmsRecord }, site, categories, articles };
  }

  close() { if (this.ownsDatabase) this.database.close(); }
}

export function openPublicSiteStore(options = {}) { return new PublicSiteStore(options); }
