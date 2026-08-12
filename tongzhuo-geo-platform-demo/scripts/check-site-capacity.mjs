import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { ProductionDatabase } from "../production-database.mjs";
import { WorkspaceStore } from "../workspace-store.mjs";
import { createSiteRuntime } from "../site-server.mjs";

const requestedCounts = String(process.env.TZ_CAPACITY_ARTICLE_COUNTS || "100,1000,10000").split(",").map(Number).filter((value) => Number.isInteger(value) && value > 0);
const counts = [...new Set(requestedCounts)].sort((a, b) => a - b);
const largestCount = counts.at(-1) || 10_000;
const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "tongzhuo-site-capacity-"));
const databasePath = path.join(temporaryDirectory, "capacity.sqlite");
const workspaceId = "capacity-enterprise";
const timestamp = new Date().toISOString();
let database;
let runtime;

function hash(value) { return createHash("sha256").update(value).digest("hex"); }
function percentile(values, ratio) { const sorted = [...values].sort((a, b) => a - b); return sorted[Math.max(0, Math.ceil(sorted.length * ratio) - 1)] || 0; }
async function timedRequest(base, pathname) {
  const start = performance.now();
  const response = await fetch(`${base}${pathname}`);
  const body = await response.text();
  return { status: response.status, bytes: Buffer.byteLength(body), durationMs: performance.now() - start, body };
}

try {
  database = new ProductionDatabase({ databasePath });
  new WorkspaceStore(database).save(workspaceId, {
    articles: [],
    site: { cms: {
      settings: { siteName: "容量测试企业", companyName: "容量测试企业有限公司", description: "容量测试官网", allowAiCrawl: true },
      categories: [{ id: "knowledge", name: "行业知识", slug: "knowledge", status: "active", navVisible: true }],
      pages: [{ id: "home", title: "首页", path: "/", status: "published", sitemapEnabled: true }, { id: "insights", title: "行业资讯", path: "/insights/", status: "published", sitemapEnabled: true }],
      navItems: [{ id: "home", label: "首页", path: "/", visible: true }, { id: "insights", label: "行业资讯", path: "/insights/", visible: true }],
      theme: { key: "industrial", cta: "预约咨询" }
    } }
  }, { expectedRevision: 0 });

  const insertArticle = database.connection.prepare("INSERT INTO content_articles (id, workspace_id, title, category, status, current_version_id, approved_version_id, revision, metadata_json, created_at, updated_at) VALUES (?, ?, ?, '行业知识', 'published', NULL, NULL, 1, ?, ?, ?)");
  const insertVersion = database.connection.prepare("INSERT INTO content_article_versions (id, article_id, version_number, title, content_html, content_text, excerpt, content_hash, source, review_status, risk_status, metadata_json, frozen_at, created_at) VALUES (?, ?, 1, ?, ?, ?, ?, ?, 'human', 'approved', 'passed', '{}', ?, ?)");
  const pointArticle = database.connection.prepare("UPDATE content_articles SET current_version_id = ?, approved_version_id = ? WHERE id = ?");
  database.transaction(() => {
    for (let index = 1; index <= largestCount; index += 1) {
      const id = `CAP-${String(index).padStart(6, "0")}`;
      const versionId = `${id}-V1`;
      const title = `工业产品选型知识 ${index}`;
      const body = `<h2>直接回答</h2><p>${title}：先确认工况、规格、交付条件和验收标准。</p>`;
      const metadata = JSON.stringify({ siteSlug: `industrial-selection-${index}`, siteCategory: "行业知识", siteCategoryId: "knowledge", sitePublishedAt: timestamp });
      insertArticle.run(id, workspaceId, title, metadata, timestamp, timestamp);
      insertVersion.run(versionId, id, title, body, `${title}：先确认工况、规格、交付条件和验收标准。`, `${title} 摘要`, hash(body), timestamp, timestamp);
      pointArticle.run(versionId, versionId, id);
    }
  });

  runtime = createSiteRuntime({ database, host: "127.0.0.1", port: 0, baseUrl: "https://capacity.example", workspaceId, logger: { info() {}, warn() {}, error() {} } });
  const address = await runtime.listen(0, "127.0.0.1");
  const base = `http://127.0.0.1:${address.port}`;
  const scenarios = ["/", "/insights/", "/insights/industrial-selection-1/", "/sitemap.xml", "/feed.xml", "/llms-full.txt"];
  const metrics = {};
  for (const pathname of scenarios) {
    const samples = [];
    let final = null;
    for (let iteration = 0; iteration < 5; iteration += 1) { final = await timedRequest(base, pathname); samples.push(final.durationMs); }
    assert.equal(final.status, 200, `${pathname} must remain available at ${largestCount} articles`);
    metrics[pathname] = { p50Ms: Number(percentile(samples, 0.5).toFixed(2)), p95Ms: Number(percentile(samples, 0.95).toFixed(2)), bytes: final.bytes };
  }
  assert.match((await timedRequest(base, "/sitemap.xml")).body, /industrial-selection-10000/);
  assert.match((await timedRequest(base, "/llms-full.txt")).body, /工业产品选型知识 10000/);
  console.log(JSON.stringify({ ok: true, articles: largestCount, requestedCounts: counts, environment: { node: process.version, platform: process.platform, arch: process.arch }, metrics }, null, 2));
} finally {
  if (runtime) await runtime.close();
  if (database) database.close();
  await rm(temporaryDirectory, { recursive: true, force: true, maxRetries: 2, retryDelay: 50 });
}
