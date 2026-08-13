import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { ProductionDatabase } from "../production-database.mjs";
import { WorkspaceStore } from "../workspace-store.mjs";
import { createSiteRuntime } from "../site-server.mjs";

const durationMs = Number(process.env.TZ_ENDURANCE_DURATION_MS || 30 * 60_000);
const sampleIntervalMs = Number(process.env.TZ_ENDURANCE_SAMPLE_INTERVAL_MS || 10_000);
const reportIntervalMs = Number(process.env.TZ_ENDURANCE_REPORT_INTERVAL_MS || 60_000);
const articleCount = Number(process.env.TZ_ENDURANCE_ARTICLES || 1_000);
assert.ok(durationMs >= 10_000 && durationMs <= 4 * 60 * 60_000, "endurance duration must be between 10 seconds and 4 hours");

const root = await mkdtemp(path.join(os.tmpdir(), "tongzhuo-runtime-endurance-"));
const databasePath = path.join(root, "endurance.sqlite");
const workspaceId = "endurance-enterprise";
const timestamp = new Date().toISOString();
const latencies = [];
const samples = [];
let errors = 0;
let requests = 0;
let database;
let runtime;

function hash(value) { return createHash("sha256").update(value).digest("hex"); }
function percentile(values, ratio) { const sorted = [...values].sort((a, b) => a - b); return sorted[Math.max(0, Math.ceil(sorted.length * ratio) - 1)] || 0; }
async function fileBytes(file) { try { return (await stat(file)).size; } catch { return 0; } }
async function hit(base, pathname) {
  const started = performance.now();
  try {
    const response = await fetch(`${base}${pathname}`);
    await response.arrayBuffer();
    if (response.status !== 200) errors += 1;
  } catch { errors += 1; }
  latencies.push(performance.now() - started); requests += 1;
}

try {
  database = new ProductionDatabase({ databasePath });
  new WorkspaceStore(database).save(workspaceId, { articles: [], site: { cms: {
    settings: { siteName: "长稳测试企业", companyName: "长稳测试企业有限公司", officialDomain: "endurance.example", description: "长稳测试官网", allowAiCrawl: true },
    categories: [{ id: "knowledge", name: "行业知识", slug: "knowledge", status: "active", navVisible: true }],
    pages: [{ id: "home", title: "首页", path: "/", status: "published", sitemapEnabled: true }, { id: "insights", title: "行业资讯", path: "/insights/", status: "published", sitemapEnabled: true }],
    navItems: [{ id: "home", label: "首页", path: "/", visible: true }, { id: "insights", label: "行业资讯", path: "/insights/", visible: true }], theme: { key: "industrial", cta: "预约咨询" }
  } } }, { expectedRevision: 0 });
  const article = database.connection.prepare("INSERT INTO content_articles (id, workspace_id, title, category, status, current_version_id, approved_version_id, revision, metadata_json, created_at, updated_at) VALUES (?, ?, ?, '行业知识', 'published', NULL, NULL, 1, ?, ?, ?)");
  const version = database.connection.prepare("INSERT INTO content_article_versions (id, article_id, version_number, title, content_html, content_text, excerpt, content_hash, source, review_status, risk_status, metadata_json, frozen_at, created_at) VALUES (?, ?, 1, ?, ?, ?, ?, ?, 'human', 'approved', 'passed', '{}', ?, ?)");
  const point = database.connection.prepare("UPDATE content_articles SET current_version_id = ?, approved_version_id = ? WHERE id = ?");
  database.transaction(() => {
    for (let index = 1; index <= articleCount; index += 1) {
      const id = `END-${index}`; const versionId = `${id}-V1`; const title = `长稳知识 ${index}`; const body = `<p>${title} 的公开正文。</p>`;
      article.run(id, workspaceId, title, JSON.stringify({ siteSlug: `endurance-${index}`, siteCategoryId: "knowledge", siteCategory: "行业知识" }), timestamp, timestamp);
      version.run(versionId, id, title, body, `${title} 的公开正文。`, `${title} 摘要`, hash(body), timestamp, timestamp); point.run(versionId, versionId, id);
    }
  });
  runtime = createSiteRuntime({ database, host: "127.0.0.1", port: 0, baseUrl: "https://endurance.example", workspaceId, logger: { info() {}, warn() {}, error() {} } });
  const address = await runtime.listen(0, "127.0.0.1"); const base = `http://127.0.0.1:${address.port}`;
  const startedAt = Date.now(); let lastReport = startedAt;
  const paths = ["/health/ready", "/", "/insights/", "/insights/endurance-1/", "/feed.xml", "/llms-full.txt"];
  while (Date.now() - startedAt < durationMs) {
    await Promise.all(paths.map((pathname) => hit(base, pathname)));
    const memory = process.memoryUsage(); const elapsedMs = Date.now() - startedAt;
    samples.push({ elapsedMs, rss: memory.rss, heapUsed: memory.heapUsed, walBytes: await fileBytes(`${databasePath}-wal`), databaseBytes: await fileBytes(databasePath) });
    if (Date.now() - lastReport >= reportIntervalMs) {
      console.log(JSON.stringify({ type: "progress", elapsedSeconds: Math.round(elapsedMs / 1000), requests, errors, rssMb: Number((memory.rss / 1048576).toFixed(1)), walMb: Number((samples.at(-1).walBytes / 1048576).toFixed(2)), p95Ms: Number(percentile(latencies, 0.95).toFixed(2)) }));
      lastReport = Date.now();
    }
    await new Promise((resolve) => setTimeout(resolve, Math.min(sampleIntervalMs, Math.max(0, durationMs - elapsedMs))));
  }
  const steady = samples.slice(Math.floor(samples.length / 2)); const first = steady[0]; const last = steady.at(-1);
  const rssGrowthRatio = first?.rss ? (last.rss - first.rss) / first.rss : 0;
  const result = { ok: errors === 0 && rssGrowthRatio <= 0.2, durationSeconds: Math.round((Date.now() - startedAt) / 1000), articleCount, requests, errors, latency: { p50Ms: Number(percentile(latencies, 0.5).toFixed(2)), p95Ms: Number(percentile(latencies, 0.95).toFixed(2)), p99Ms: Number(percentile(latencies, 0.99).toFixed(2)) }, memory: { firstSteadyRssMb: Number((first.rss / 1048576).toFixed(1)), finalRssMb: Number((last.rss / 1048576).toFixed(1)), steadyGrowthPercent: Number((rssGrowthRatio * 100).toFixed(2)) }, storage: { databaseBytes: last.databaseBytes, finalWalBytes: last.walBytes, maxWalBytes: Math.max(...samples.map((sample) => sample.walBytes)) }, assumptions: { maxSteadyRssGrowthPercent: 20, expectedHttpErrors: 0 } };
  assert.equal(errors, 0, JSON.stringify(result)); assert.ok(rssGrowthRatio <= 0.2, JSON.stringify(result));
  console.log(JSON.stringify(result, null, 2));
} finally {
  if (runtime) await runtime.close();
  if (database) database.close();
  await rm(root, { recursive: true, force: true, maxRetries: 2, retryDelay: 50 });
}
