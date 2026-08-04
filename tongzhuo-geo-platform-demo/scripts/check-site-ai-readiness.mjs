import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ProductionDatabase } from "../production-database.mjs";
import { PublicSiteStore } from "../public-site/site-store.mjs";
import { SiteCmsStore } from "../site-cms-store.mjs";
import { createSiteRuntime } from "../site-server.mjs";
import { WorkspaceStore } from "../workspace-store.mjs";

const workspaceId = "default";
const officialOrigin = "https://ai-ready.example.test";
const publicArticleSlug = "ai-readable-enterprise-source";
const publicArticleTitle = "AI 如何读取企业官网中的可信信源";
const publicArticleBodyMarker = "正文中的错误一级标题";
const publicQuestionSlug = "ai-crawl-structure";
const publicQuestionTitle = "企业官网怎样组织内容才便于 AI 抓取？";
const draftArticleSlug = "internal-draft-article";
const draftArticleTitle = "内部草稿文章绝不能公开";
const draftQuestionSlug = "internal-draft-question";
const draftQuestionTitle = "内部草稿问题绝不能公开？";
const draftPagePath = "/internal-draft-page/";
const citationUrl = "https://schema.org/Article";
const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "tongzhuo-site-ai-readiness-"));
const databasePath = path.join(temporaryDirectory, "site-ai-readiness.sqlite");
const staticRoot = path.join(temporaryDirectory, "static-site");
const previousEnvironment = {
  TZ_SITE_BASE_URL: process.env.TZ_SITE_BASE_URL,
  TZ_SITE_FRONTEND_DEMO: process.env.TZ_SITE_FRONTEND_DEMO,
  NODE_ENV: process.env.NODE_ENV
};

let database;
let runtime;

function iso(minutesAgo = 0) {
  return new Date(Date.now() - minutesAgo * 60_000).toISOString();
}

function contentHash(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function articleMetadata({ slug, publishedAt, featured = false } = {}) {
  return {
    siteSlug: slug,
    siteCategory: "GEO 方法",
    siteCategoryId: "geo",
    siteCategorySlug: "geo",
    siteAuthor: "测试企业内容团队",
    sitePublishedAt: publishedAt,
    siteUpdatedAt: publishedAt,
    keywords: featured ? ["AI 抓取", "GEO", "可信信源"] : ["GEO", "AI 搜索"],
    about: featured ? ["AI 抓取", "企业可信信源"] : ["GEO"],
    citation: featured ? [citationUrl] : [],
    citations: featured ? [{ url: citationUrl, name: "Schema.org Article" }] : []
  };
}

function insertArticle({
  id,
  slug,
  title,
  contentHtml,
  excerpt,
  publishedAt,
  status = "published",
  reviewStatus = "approved",
  riskStatus = "passed",
  frozenAt = publishedAt,
  approved = true,
  featured = false
}) {
  const versionId = `${id}-V1`;
  const createdAt = publishedAt || iso();
  const metadata = articleMetadata({ slug, publishedAt: createdAt, featured });
  const contentText = String(contentHtml || "")
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  database.connection.prepare(`
    INSERT INTO content_articles (
      id, workspace_id, title, category, status, current_version_id,
      approved_version_id, revision, metadata_json, created_at, updated_at
    ) VALUES (?, ?, ?, 'GEO 方法', ?, NULL, NULL, 1, ?, ?, ?)
  `).run(id, workspaceId, title, status, JSON.stringify(metadata), createdAt, createdAt);

  database.connection.prepare(`
    INSERT INTO content_article_versions (
      id, article_id, version_number, title, content_html, content_text,
      excerpt, content_hash, source, review_status, risk_status,
      metadata_json, frozen_at, created_at
    ) VALUES (?, ?, 1, ?, ?, ?, ?, ?, 'human', ?, ?, ?, ?, ?)
  `).run(
    versionId,
    id,
    title,
    contentHtml,
    contentText,
    excerpt,
    contentHash(contentHtml),
    reviewStatus,
    riskStatus,
    JSON.stringify(metadata),
    frozenAt,
    createdAt
  );

  database.connection.prepare(`
    UPDATE content_articles
    SET current_version_id = ?, approved_version_id = ?
    WHERE id = ?
  `).run(versionId, approved ? versionId : null, id);
}

async function request(base, pathname, options = {}) {
  const response = await fetch(`${base}${pathname}`, { redirect: "manual", ...options });
  return { response, text: await response.text() };
}

function attribute(tag, name) {
  const pattern = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i");
  const match = String(tag).match(pattern);
  return match?.[1] ?? match?.[2] ?? match?.[3] ?? "";
}

function headLink(html, relation) {
  for (const match of String(html).matchAll(/<link\b[^>]*>/gi)) {
    if (attribute(match[0], "rel").split(/\s+/).includes(relation)) return attribute(match[0], "href");
  }
  return "";
}

function elementCount(html, tagName) {
  return [...String(html).matchAll(new RegExp(`<${tagName}\\b`, "gi"))].length;
}

function sitemapLocations(xml) {
  return [...String(xml).matchAll(/<loc>([\s\S]*?)<\/loc>/gi)].map((match) => match[1]
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'"));
}

function schemaNodes(html) {
  const nodes = [];
  for (const match of String(html).matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    const value = JSON.parse(match[1]);
    if (Array.isArray(value?.["@graph"])) nodes.push(...value["@graph"]);
    else if (Array.isArray(value)) nodes.push(...value);
    else if (value && typeof value === "object") nodes.push(value);
  }
  return nodes;
}

function hasType(node, type) {
  const types = Array.isArray(node?.["@type"]) ? node["@type"] : [node?.["@type"]];
  return types.includes(type);
}

function schemaNode(nodes, type, message) {
  const node = nodes.find((candidate) => hasType(candidate, type));
  assert.ok(node, message || `JSON-LD should contain ${type}`);
  return node;
}

function assertPublicHtml(html, pathname) {
  assert.equal(elementCount(html, "h1"), 1, `${pathname} must expose exactly one H1`);
  assert.equal(elementCount(html, "main"), 1, `${pathname} must not contain a nested or second main element`);
}

function assertNotExposed(text, markers, endpoint) {
  for (const marker of markers) assert.doesNotMatch(text, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), `${endpoint} leaked ${marker}`);
}

const bootstrapCms = {
  schemaVersion: 2,
  settings: {
    siteName: "AI 抓取验收官网",
    companyName: "AI 抓取验收企业有限公司",
    description: "经过审核的企业事实、服务与行业内容。",
    officialDomain: "ai-ready.example.test",
    industryRegion: "中国",
    serviceArea: "全国",
    phone: "400-800-2026",
    email: "source@ai-ready.example.test",
    address: "山东省淄博市测试路 1 号",
    logoUrl: "/assets/company-logo.png",
    sameAs: ["https://www.zhihu.com/org/ai-ready-enterprise"],
    allowAiCrawl: true
  },
  pages: [
    { id: "home", type: "首页", title: "首页", path: "/", status: "published", sitemapEnabled: true, schemaEnabled: true },
    { id: "services", type: "服务页", title: "产品与服务", path: "/services/", status: "published", sitemapEnabled: true, schemaEnabled: true },
    { id: "cases", type: "案例页", title: "服务案例", path: "/cases/", status: "published", sitemapEnabled: true, schemaEnabled: true },
    { id: "insights", type: "资讯列表", title: "行业资讯", path: "/insights/", status: "published", sitemapEnabled: true, schemaEnabled: true },
    { id: "problem-map", type: "问题地图", title: "问题地图", path: "/problem-map/", status: "published", sitemapEnabled: true, schemaEnabled: true },
    { id: "about", type: "关于页", title: "关于我们", path: "/about/", status: "published", sitemapEnabled: true, schemaEnabled: true },
    { id: "contact", type: "联系页", title: "联系我们", path: "/contact/", status: "published", sitemapEnabled: true, schemaEnabled: true },
    { id: "draft-secret", type: "专题页", title: "内部草稿页面", path: draftPagePath, status: "draft", sitemapEnabled: true, schemaEnabled: true }
  ],
  categories: [{ id: "geo", name: "GEO 方法", slug: "geo", description: "AI 搜索与企业信源建设。", status: "active", navVisible: true }],
  services: [{ id: "geo", title: "GEO 服务", description: "建设企业公开可信信源。", audience: "制造业与中小企业", status: "published", order: 1 }],
  cases: [],
  problemGroups: [{
    id: "geo",
    title: "AI 抓取与信源问题",
    service: "GEO 服务",
    description: "企业官网结构与 AI 抓取。",
    status: "published",
    order: 1,
    questions: [
      {
        id: "question-public",
        slug: publicQuestionSlug,
        title: publicQuestionTitle,
        answer: "使用服务端完整 HTML、清晰标题层级、稳定规范地址和可验证的结构化数据。",
        industries: ["制造业", "中小企业"],
        relatedArticleIds: ["ART-AI-READY"],
        status: "published",
        order: 1
      },
      {
        id: "question-draft",
        slug: draftQuestionSlug,
        title: draftQuestionTitle,
        answer: "这条内部答案不允许出现在正式官网。",
        industries: ["内部"],
        status: "draft",
        order: 2
      }
    ]
  }]
};

try {
  process.env.TZ_SITE_BASE_URL = "";
  process.env.TZ_SITE_FRONTEND_DEMO = "false";
  process.env.NODE_ENV = "test";
  await mkdir(staticRoot, { recursive: true });

  database = new ProductionDatabase({ databasePath });
  const workspaceStore = new WorkspaceStore(database);
  workspaceStore.save(workspaceId, { site: { cms: bootstrapCms } }, { expectedRevision: 0 });

  insertArticle({
    id: "ART-AI-READY",
    slug: publicArticleSlug,
    title: publicArticleTitle,
    excerpt: "说明企业官网如何成为客户与 AI 都能理解的正式信源。",
    contentHtml: `<h1>${publicArticleBodyMarker}</h1><p>正文必须保留，但正文自己的 H1 必须在公开页面降为 H2。</p><h2>直接回答</h2><p>完整 HTML、规范地址、语义结构与发布门槛共同决定内容是否适合抓取。</p><p>规范依据：<a href="${citationUrl}">Schema.org Article</a>。</p>`,
    publishedAt: iso(1),
    featured: true
  });

  // Twenty-four additional public records make page 2 have both a previous
  // and a next page (25 records / 12 per page = 3 pages).
  for (let index = 2; index <= 25; index += 1) {
    const suffix = String(index).padStart(2, "0");
    insertArticle({
      id: `ART-PAGE-${suffix}`,
      slug: `pagination-article-${suffix}`,
      title: `分页验收正式文章 ${suffix}`,
      excerpt: `用于官网分页自动验收的第 ${suffix} 篇正式文章。`,
      contentHtml: `<h2>直接回答</h2><p>这是第 ${suffix} 篇经过审核、冻结并正式发布的测试文章。</p>`,
      publishedAt: iso(index)
    });
  }

  insertArticle({
    id: "ART-DRAFT",
    slug: draftArticleSlug,
    title: draftArticleTitle,
    excerpt: "内部草稿摘要。",
    contentHtml: "<h2>内部草稿</h2><p>不能进入任何公开入口。</p>",
    publishedAt: iso(60),
    status: "draft",
    reviewStatus: "draft",
    riskStatus: "not_scanned",
    frozenAt: null,
    approved: false
  });

  const cmsStore = new SiteCmsStore(database, { workspaceId });
  const publicStore = new PublicSiteStore({ database, cmsStore, workspaceId });
  runtime = createSiteRuntime({
    store: publicStore,
    staticRoot,
    host: "127.0.0.1",
    port: 0,
    workspaceId,
    production: false,
    flushIntervalMs: 60_000,
    logger: { info() {}, warn() {}, error() {} }
  });
  const address = await runtime.listen(0, "127.0.0.1");
  const localBase = `http://127.0.0.1:${address.port}`;

  console.log("[AI readiness] official origin and crawler entry points");
  let result = await request(localBase, "/", { headers: { Host: "untrusted-request-host.invalid" } });
  assert.equal(result.response.status, 200);
  assert.equal(headLink(result.text, "canonical"), `${officialOrigin}/`, "CMS officialDomain must own the public canonical origin");
  assert.equal(result.response.headers.get("link"), `<${officialOrigin}/>; rel="canonical"`);
  assert.doesNotMatch(result.text, /127\.0\.0\.1|untrusted-request-host\.invalid/);

  const robots = await request(localBase, "/robots.txt");
  assert.equal(robots.response.status, 200);
  assert.match(robots.text, new RegExp(`Sitemap: ${officialOrigin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/sitemap\\.xml`));
  for (const userAgent of ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "PerplexityBot"]) {
    assert.match(robots.text, new RegExp(`User-agent: ${userAgent.replace("-", "\\-")}\\r?\\nAllow: /`, "i"), `${userAgent} should be explicitly allowed`);
  }
  assert.doesNotMatch(robots.text, /127\.0\.0\.1|untrusted-request-host\.invalid/);

  const llms = await request(localBase, "/llms.txt");
  const llmsFull = await request(localBase, "/llms-full.txt");
  assert.equal(llms.response.status, 200);
  assert.equal(llmsFull.response.status, 200);
  assert.match(llms.text, new RegExp(`${officialOrigin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/insights/${publicArticleSlug}/`));
  assert.match(llmsFull.text, /完整 HTML、规范地址、语义结构与发布门槛/);
  assert.doesNotMatch(`${llms.text}\n${llmsFull.text}`, /127\.0\.0\.1/);

  console.log("[AI readiness] sitemap completeness, uniqueness and reachability");
  const sitemap = await request(localBase, "/sitemap.xml");
  assert.equal(sitemap.response.status, 200);
  const locations = sitemapLocations(sitemap.text);
  assert.ok(locations.length > 0, "sitemap must contain public URLs");
  assert.equal(new Set(locations).size, locations.length, "sitemap must not contain duplicate URLs");
  for (const expected of [
    `${officialOrigin}/`,
    `${officialOrigin}/about/`,
    `${officialOrigin}/insights/`,
    `${officialOrigin}/insights/${publicArticleSlug}/`,
    `${officialOrigin}/problem-map/`,
    `${officialOrigin}/problem-map/${publicQuestionSlug}/`
  ]) assert.ok(locations.includes(expected), `sitemap is missing ${expected}`);
  assert.ok(locations.every((url) => url.startsWith(`${officialOrigin}/`)), "every sitemap URL must use CMS officialDomain");
  for (const location of locations) {
    const url = new URL(location);
    const reachable = await request(localBase, `${url.pathname}${url.search}`);
    assert.equal(reachable.response.status, 200, `sitemap URL must resolve directly without redirect/404: ${location}`);
  }

  console.log("[AI readiness] semantic HTML and article heading normalization");
  for (const pathname of ["/", "/about/", "/insights/", `/insights/${publicArticleSlug}/`, "/problem-map/", `/problem-map/${publicQuestionSlug}/`]) {
    const page = await request(localBase, pathname);
    assert.equal(page.response.status, 200, `${pathname} should be public`);
    assertPublicHtml(page.text, pathname);
  }
  const articlePage = await request(localBase, `/insights/${publicArticleSlug}/`);
  assert.match(articlePage.text, new RegExp(`<h2\\b[^>]*>${publicArticleBodyMarker}</h2>`, "i"), "article-body H1 must be downgraded to H2");
  assert.doesNotMatch(articlePage.text, new RegExp(`<h1\\b[^>]*>${publicArticleBodyMarker}</h1>`, "i"));

  console.log("[AI readiness] paginated canonical and discovery links");
  const secondPage = await request(localBase, "/insights/?page=2");
  assert.equal(secondPage.response.status, 200);
  assert.equal(headLink(secondPage.text, "canonical"), `${officialOrigin}/insights/?page=2`);
  assert.equal(headLink(secondPage.text, "prev"), `${officialOrigin}/insights/`);
  assert.equal(headLink(secondPage.text, "next"), `${officialOrigin}/insights/?page=3`);
  assert.equal((await request(localBase, "/insights/?page=4")).response.status, 404, "out-of-range pagination must be a 404");
  assert.equal((await request(localBase, "/insights/?page=0")).response.status, 404, "invalid pagination must be a 404");

  console.log("[AI readiness] stable Organization, Article and FAQ JSON-LD graph");
  const articleCanonical = `${officialOrigin}/insights/${publicArticleSlug}/`;
  const articleNodes = schemaNodes(articlePage.text);
  const organization = schemaNode(articleNodes, "Organization");
  assert.equal(organization["@id"], `${officialOrigin}/#organization`);
  assert.equal(organization.url, `${officialOrigin}/`);
  assert.equal(organization.name, bootstrapCms.settings.companyName);
  assert.equal(organization.telephone, bootstrapCms.settings.phone);
  assert.equal(organization.email, bootstrapCms.settings.email);
  assert.equal(organization.address?.streetAddress, bootstrapCms.settings.address);
  assert.equal(organization.logo, `${officialOrigin}${bootstrapCms.settings.logoUrl}`);
  assert.deepEqual(organization.sameAs, bootstrapCms.settings.sameAs);
  assert.deepEqual(new Set((organization.areaServed || []).map((area) => area.name)), new Set(["中国", "全国"]));

  const articleWebPage = articleNodes.find((node) => node?.["@id"] === `${articleCanonical}#webpage`);
  assert.ok(articleWebPage && hasType(articleWebPage, "WebPage"), "article WebPage node needs a stable #webpage ID");
  const articleSchema = schemaNode(articleNodes, "Article");
  assert.equal(articleSchema["@id"], `${articleCanonical}#article`);
  assert.equal(articleSchema.url, articleCanonical);
  assert.equal(articleSchema.headline, publicArticleTitle);
  assert.equal(articleSchema.articleSection, "GEO 方法");
  assert.ok(Number(articleSchema.wordCount) > 0, "Article wordCount must be a positive number");
  assert.ok(articleSchema.about && (Array.isArray(articleSchema.about) ? articleSchema.about.length : true), "Article must describe its subject with about");
  assert.match(JSON.stringify(articleSchema.citation), /schema\.org\/Article/, "Article must expose its public citation metadata");
  assert.equal(articleSchema.publisher?.["@id"], organization["@id"]);
  assert.equal(articleSchema.mainEntityOfPage?.["@id"], articleWebPage["@id"]);
  assert.ok(new Set(articleNodes.map((node) => node?.["@id"]).filter(Boolean)).has(articleSchema.mainEntityOfPage["@id"]), "Article must reference an existing WebPage node");

  const problemMapPage = await request(localBase, "/problem-map/");
  const problemMapNodes = schemaNodes(problemMapPage.text);
  const problemMapFaq = schemaNode(problemMapNodes, "FAQPage");
  assert.equal(problemMapFaq["@id"], `${officialOrigin}/problem-map/#webpage`);
  const mapQuestions = Array.isArray(problemMapFaq.mainEntity) ? problemMapFaq.mainEntity : [problemMapFaq.mainEntity].filter(Boolean);
  assert.equal(mapQuestions.length, 1, "FAQPage must contain only the one published question");
  assert.equal(mapQuestions[0]["@id"], `${officialOrigin}/problem-map/${publicQuestionSlug}/#question`);
  assert.equal(mapQuestions[0].name, publicQuestionTitle);
  assert.equal(mapQuestions[0].acceptedAnswer?.["@type"], "Answer");
  if (mapQuestions[0].acceptedAnswer?.["@id"]) {
    assert.equal(mapQuestions[0].acceptedAnswer["@id"], `${officialOrigin}/problem-map/${publicQuestionSlug}/#answer`);
  }
  assert.ok(mapQuestions[0].acceptedAnswer?.text);

  const problemDetailPage = await request(localBase, `/problem-map/${publicQuestionSlug}/`);
  const problemDetailNodes = schemaNodes(problemDetailPage.text);
  const problemCanonical = `${officialOrigin}/problem-map/${publicQuestionSlug}/`;
  const problemDetailWebPage = problemDetailNodes.find((node) => node?.["@id"] === `${problemCanonical}#webpage`);
  assert.ok(problemDetailWebPage && (hasType(problemDetailWebPage, "WebPage") || hasType(problemDetailWebPage, "FAQPage")), "problem detail needs a stable WebPage/FAQPage node");
  assert.equal(problemDetailWebPage.url, problemCanonical);
  assert.equal(problemDetailWebPage.mainEntity?.["@id"], `${problemCanonical}#question`);
  assert.equal(problemDetailWebPage.mainEntity?.["@type"], "Question");
  assert.equal(problemDetailWebPage.mainEntity?.acceptedAnswer?.["@type"], "Answer");
  if (problemDetailWebPage.mainEntity?.acceptedAnswer?.["@id"]) {
    assert.equal(problemDetailWebPage.mainEntity.acceptedAnswer["@id"], `${problemCanonical}#answer`);
  }
  assert.equal(problemDetailWebPage.mainEntity?.acceptedAnswer?.text, bootstrapCms.problemGroups[0].questions[0].answer);
  assert.equal(problemDetailNodes.find((node) => hasType(node, "Organization"))?.["@id"], organization["@id"], "all pages must reuse one Organization ID");

  console.log("[AI readiness] draft and unpublished-section isolation");
  const draftMarkers = [draftArticleSlug, draftArticleTitle, draftQuestionSlug, draftQuestionTitle, draftPagePath];
  assert.equal((await request(localBase, `/insights/${draftArticleSlug}/`)).response.status, 404);
  assert.equal((await request(localBase, `/problem-map/${draftQuestionSlug}/`)).response.status, 404);
  assert.equal((await request(localBase, draftPagePath)).response.status, 404);
  const publicMachineText = `${sitemap.text}\n${(await request(localBase, "/feed.xml")).text}\n${llms.text}\n${llmsFull.text}`;
  assertNotExposed(publicMachineText, draftMarkers, "public machine endpoints");
  assertNotExposed((await request(localBase, "/insights/")).text, [draftArticleTitle], "industry listing");

  const currentDraft = cmsStore.draft(workspaceId);
  const offlineCms = structuredClone(currentDraft.snapshot);
  offlineCms.pages.find((page) => page.id === "insights").status = "draft";
  const savedOfflineDraft = cmsStore.saveDraft({ expectedRevision: currentDraft.revision, cms: offlineCms }, null, null, workspaceId);
  cmsStore.publish({ expectedDraftRevision: savedOfflineDraft.revision, note: "AI readiness: take industry section offline" }, null, null, workspaceId);

  assert.equal((await request(localBase, "/insights/")).response.status, 404);
  assert.equal((await request(localBase, `/insights/${publicArticleSlug}/`)).response.status, 404);
  const offlineSitemap = await request(localBase, "/sitemap.xml");
  const offlineFeed = await request(localBase, "/feed.xml");
  const offlineLlms = await request(localBase, "/llms.txt");
  const offlineLlmsFull = await request(localBase, "/llms-full.txt");
  for (const endpoint of [offlineSitemap, offlineFeed, offlineLlms, offlineLlmsFull]) {
    assertNotExposed(endpoint.text, [publicArticleSlug, publicArticleTitle, publicArticleBodyMarker], "offline industry machine endpoint");
  }
  const offlineLocations = sitemapLocations(offlineSitemap.text);
  assert.ok(!offlineLocations.includes(`${officialOrigin}/insights/`), "offline industry section must leave sitemap");
  assert.ok(!offlineLocations.some((url) => url.startsWith(`${officialOrigin}/insights/category/`) || url.startsWith(`${officialOrigin}/insights/${publicArticleSlug}`)), "offline industry URLs must leave sitemap");

  console.log("Official site AI-readiness check passed");
} finally {
  await runtime?.close();
  database?.close();
  await rm(temporaryDirectory, { recursive: true, force: true });
  for (const [name, value] of Object.entries(previousEnvironment)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}
