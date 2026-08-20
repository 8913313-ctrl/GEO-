import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ProductionDatabase } from "../production-database.mjs";
import { WorkspaceStore } from "../workspace-store.mjs";
import { createSiteRuntime } from "../site-server.mjs";
import { KnowledgeStore } from "../knowledge-store.mjs";

const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "tongzhuo-site-runtime-"));
const staticRoot = path.join(temporaryDirectory, "legacy-static");
const databasePath = path.join(temporaryDirectory, "site.sqlite");
let database;
let runtime;

function iso(days = 0) { return new Date(Date.now() + days * 86_400_000).toISOString(); }
function hash(value) { return createHash("sha256").update(value).digest("hex"); }

function insertArticle({ id, title, status = "published", reviewStatus = "approved", riskStatus = "passed", frozenAt = iso(-1), approved = true, content = "" }) {
  const versionId = `${id}-V1`;
  const now = iso();
  database.connection.prepare(`INSERT INTO content_articles (id, workspace_id, title, category, status, current_version_id, approved_version_id, revision, metadata_json, created_at, updated_at)
    VALUES (?, 'default', ?, 'GEO 优化', ?, NULL, NULL, 1, '{}', ?, ?)`)
    .run(id, title, status, now, now);
  const body = content || `<h2>直接回答</h2><p>${title} 的正式正文。</p>`;
  const contentText = String(body).replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  database.connection.prepare(`INSERT INTO content_article_versions (id, article_id, version_number, title, content_html, content_text, excerpt, content_hash, source, review_status, risk_status, metadata_json, frozen_at, created_at)
    VALUES (?, ?, 1, ?, ?, ?, ?, ?, 'human', ?, ?, '{}', ?, ?)`)
    .run(versionId, id, title, body, contentText, `${title} 摘要。`, hash(body), reviewStatus, riskStatus, frozenAt, now);
  database.connection.prepare("UPDATE content_articles SET current_version_id = ?, approved_version_id = ? WHERE id = ?")
    .run(versionId, approved ? versionId : null, id);
}

async function request(base, pathname, options = {}) {
  const response = await fetch(`${base}${pathname}`, options);
  return { response, text: await response.text() };
}

try {
  await mkdir(path.join(staticRoot, "assets"), { recursive: true });
  await writeFile(path.join(staticRoot, "index.html"), "<!doctype html><html><head><title>旧官网</title><link rel=\"canonical\" href=\"https://legacy.invalid/\"><script type=\"application/ld+json\">{\"@type\":\"Organization\",\"name\":\"LegacyOrg\"}</script></head><body><h1>旧官网首页</h1></body></html>");
  await writeFile(path.join(staticRoot, "about.html"), "<!doctype html><html><head><title>关于旧官网</title></head><body><h1>关于我们</h1></body></html>");
  await writeFile(path.join(staticRoot, "cases.html"), "<!doctype html><html><head><title>服务案例</title></head><body><h1>服务案例</h1></body></html>");
  await writeFile(path.join(staticRoot, "assets", "styles.css"), "body { color: #111; }");
  await writeFile(path.join(staticRoot, "assets", "wukong-overrides.css"), "");
  await writeFile(path.join(staticRoot, "assets", "site.js"), "document.documentElement.dataset.site = 'ok';");
  await writeFile(path.join(staticRoot, "rss.xsl"), "<xsl:stylesheet version=\"1.0\" xmlns:xsl=\"http://www.w3.org/1999/XSL/Transform\" />");

  database = new ProductionDatabase({ databasePath });
  const workspaceStore = new WorkspaceStore(database);
  workspaceStore.save("default", {
    articles: [{
      id: "ART-PUBLIC", siteSlug: "public-answer", siteCategory: "GEO 优化", siteAuthor: "测试研究", siteExcerpt: "来自 CMS 的公开摘要。",
      sitePublishedAt: iso(-2), keywords: ["GEO", "AI 搜索"]
    }],
    site: {
      cms: {
        settings: { siteName: "测试企业", companyName: "测试企业有限公司", description: "测试企业的公开知识库。", allowAiCrawl: true },
        categories: [{ id: "geo", name: "GEO 优化", slug: "geo", status: "active", navVisible: true, description: "GEO 方法与信源建设。" }],
        pages: [{ id: "home", title: "首页", path: "/", status: "published", sitemapEnabled: true }, { id: "insights", title: "行业资讯", path: "/insights", status: "published", sitemapEnabled: true }],
        navItems: [{ id: "home", label: "首页", path: "/", visible: true }, { id: "insights", label: "行业资讯", path: "/insights", visible: true }],
        theme: { cta: "联系测试企业" }
      }
    }
  }, { expectedRevision: 0 });

  const knowledgeStore = new KnowledgeStore(database, { workspaceId: "default" });
  const imageLibrary = knowledgeStore.createLibrary({ name: "官网图片资料", scope: "enterprise" });
  const imageAsset = knowledgeStore.createAsset({ libraryId: imageLibrary.id, sourceName: "官网配图.png", mimeType: "image/png", contentBase64: Buffer.from("public-image-bytes").toString("base64"), metadata: { sourceRole: "test" } });
  const privateImageAsset = knowledgeStore.createAsset({ libraryId: imageLibrary.id, sourceName: "未发布配图.png", mimeType: "image/png", contentBase64: Buffer.from("private-image-bytes").toString("base64"), metadata: { sourceRole: "test" } });
  const imageHtml = `<h2>配图</h2><p>这是已经审核冻结的公开正文。</p><script>window.evil = true</script><p>正文保留，脚本必须被清除。</p><img data-asset-id="${imageAsset.id}" src="/api/v1/knowledge/assets/${imageAsset.id}/content" alt="官网配图" />`;
  insertArticle({ id: "ART-PUBLIC", title: "企业如何建立 AI 可读取的 GEO 信源", content: imageHtml });
  insertArticle({ id: "ART-DRAFT", title: "草稿文章绝不能公开", status: "draft", frozenAt: null, approved: false });
  insertArticle({ id: "ART-UNFROZEN", title: "已标记发布但未冻结的文章", frozenAt: null });

  runtime = createSiteRuntime({ database, staticRoot, host: "127.0.0.1", port: 0, baseUrl: "https://www.example.test", workspaceId: "default", flushIntervalMs: 60_000, logger: { info() {}, warn() {}, error() {} } });
  const address = await runtime.listen(0, "127.0.0.1");
  const base = `http://127.0.0.1:${address.port}`;

  let result = await request(base, "/health/ready");
  assert.equal(result.response.status, 200); assert.equal(JSON.parse(result.text).service, "official-site");

  result = await request(base, "/");
  assert.equal(result.response.status, 200); assert.match(result.text, /ENTERPRISE GEO OPERATIONS/); assert.match(result.text, /测试企业有限公司/); assert.doesNotMatch(result.text, /旧官网首页|LegacyOrg/); assert.match(result.text, /https:\/\/www\.example\.test\//);

  result = await request(base, "/about/");
  assert.equal(result.response.status, 200); assert.match(result.text, /关于我们/); assert.match(result.response.headers.get("link"), /https:\/\/www\.example\.test\/about\//);
  result = await request(base, "/cases/");
  assert.equal(result.response.status, 200); assert.match(result.text, /服务案例/); assert.doesNotMatch(result.text, /旧官网/);
  result = await request(base, "/problem-map/");
  assert.equal(result.response.status, 200); assert.match(result.text, /问题地图/);
  result = await request(base, "/problem-map/industrial-geo-start/");
  assert.equal(result.response.status, 200); assert.match(result.text, /工业品企业做 GEO 应该从哪里开始/);
  result = await request(base, "/assets/styles.css");
  assert.equal(result.response.status, 200); assert.match(result.response.headers.get("content-type"), /text\/css/);
  result = await request(base, "/site-assets/site.css");
  assert.equal(result.response.status, 200); assert.match(result.response.headers.get("content-type"), /text\/css/);

  result = await request(base, "/insights");
  assert.equal(result.response.status, 200); assert.match(result.text, /企业如何建立 AI 可读取的 GEO 信源/); assert.doesNotMatch(result.text, /草稿文章绝不能公开/); assert.doesNotMatch(result.text, /未冻结的文章/);
  result = await request(base, "/insights/category/geo");
  assert.equal(result.response.status, 200); assert.match(result.text, /GEO 优化/);

  result = await request(base, "/insights/public-answer");
  assert.equal(result.response.status, 200); assert.match(result.text, /Article/); assert.match(result.text, /BreadcrumbList/); assert.doesNotMatch(result.text, /window\.evil/); assert.match(result.text, new RegExp(`/site-assets/knowledge/${imageAsset.id}`)); assert.match(result.response.headers.get("link"), /\/insights\/public-answer/);
  result = await request(base, `/site-assets/knowledge/${imageAsset.id}`);
  assert.equal(result.response.status, 200); assert.match(result.response.headers.get("content-type"), /image\/png/); assert.equal(result.text, "public-image-bytes");
  result = await request(base, `/site-assets/knowledge/${privateImageAsset.id}`);
  assert.equal(result.response.status, 404);
  result = await request(base, "/article/public-answer");
  assert.equal(result.response.status, 200); assert.match(result.text, /企业如何建立 AI 可读取的 GEO 信源/);
  result = await request(base, "/insights/does-not-exist");
  assert.equal(result.response.status, 404);

  result = await request(base, "/sitemap.xml");
  assert.equal(result.response.status, 200); assert.match(result.text, /insights\/public-answer/); assert.match(result.text, /problem-map\/industrial-geo-start/); assert.doesNotMatch(result.text, /草稿文章绝不能公开/);
  result = await request(base, "/feed.xml");
  assert.equal(result.response.status, 200); assert.match(result.text, /<rss\b[^>]*\bversion="2\.0"/); assert.match(result.text, /企业如何建立 AI 可读取的 GEO 信源/);
  result = await request(base, "/robots.txt");
  assert.equal(result.response.status, 200); assert.match(result.text, /User-agent: GPTBot\nAllow: \//);
  result = await request(base, "/llms.txt");
  assert.equal(result.response.status, 200); assert.match(result.text, /测试企业/); assert.match(result.text, /public-answer/); assert.match(result.text, /industrial-geo-start/);
  result = await request(base, "/llms-full.txt");
  assert.equal(result.response.status, 200); assert.match(result.text, /已经审核冻结的公开正文/);

  result = await request(base, "/api/v1/leads", {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": "site-runtime-check/1.0" },
    body: JSON.stringify({ name: "测试客户", phone: "13800000000", company: "测试企业", service: "GEO优化", message: "希望了解官网信源建设。", source_url: "https://www.example.test/contact.html" })
  });
  assert.equal(result.response.status, 201);
  const leadResponse = JSON.parse(result.text);
  assert.equal(leadResponse.ok, true);
  assert.match(leadResponse.data.id, /^LEAD-/);
  const lead = database.connection.prepare("SELECT name, phone, company, service, status, source_url, user_agent FROM site_contact_leads WHERE id = ?").get(leadResponse.data.id);
  assert.deepEqual({ ...lead }, { name: "测试客户", phone: "13800000000", company: "测试企业", service: "GEO优化", status: "new", source_url: "https://www.example.test/contact.html", user_agent: "site-runtime-check/1.0" });
  result = await request(base, "/api/v1/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "缺少联系方式" }) });
  assert.equal(result.response.status, 422); assert.equal(JSON.parse(result.text).code, "SITE_LEAD_REQUIRED");
  result = await request(base, "/api/v1/leads");
  assert.equal(result.response.status, 405); assert.equal(result.response.headers.get("allow"), "POST");

  result = await request(base, "/insights", { method: "HEAD" });
  assert.equal(result.response.status, 200); assert.equal(result.text, "");
  result = await request(base, "/insights", { method: "POST" });
  assert.equal(result.response.status, 405); assert.equal(result.response.headers.get("allow"), "GET, HEAD");

  await runtime.flushAccessLogs();
  const publicLogs = database.connection.prepare("SELECT COUNT(*) AS count FROM monitoring_access_logs WHERE workspace_id = 'default' AND article_id = 'ART-PUBLIC'").get();
  assert.ok(Number(publicLogs.count) >= 2, "article requests should be captured by MonitoringStore");
  const rawIp = database.connection.prepare("SELECT ip_hash FROM monitoring_access_logs WHERE workspace_id = 'default' LIMIT 1").get();
  assert.ok(rawIp.ip_hash !== "", "MonitoringStore must persist an IP hash rather than the source IP");

  console.log("Official site runtime check passed");
} finally {
  await runtime?.close();
  database?.close();
  await rm(temporaryDirectory, { recursive: true, force: true });
}
