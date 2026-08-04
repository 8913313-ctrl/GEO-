import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PublisherStore } from "../publisher-store.mjs";

const tempRoot = await mkdtemp(path.join(os.tmpdir(), "tongzhuo-publisher-web-"));
let sequence = 0;

async function makeStore(webPublisher) {
  const dataDir = path.join(tempRoot, `case-${++sequence}`);
  const store = new PublisherStore({ dataDir, webPublisher });
  await store.load();
  return store;
}

function webJob(overrides = {}) {
  return {
    articleId: "ART-WEB-1",
    localArticleId: "LOCAL-ARTICLE-1",
    contentArticleId: "ART-WEB-1",
    contentVersionId: "VER-WEB-1",
    contentRevision: 7,
    articleTitle: "企业 GEO 官网发布测试",
    article: { id: "ART-WEB-1", title: "企业 GEO 官网发布测试", content: "<p>正式内容</p>", version: 1 },
    platforms: ["web"],
    platformOrder: ["web"],
    siteCategory: "GEO 方法",
    siteSlug: "publisher-web-test",
    siteAuthor: "企业内容团队",
    siteExcerpt: "官网发布回调测试摘要",
    mode: "immediate",
    ...overrides
  };
}

try {
  {
    const store = await makeStore();
    const job = await store.createJobs(webJob());
    assert.equal(job.status, "failed");
    assert.equal(job.results.web.state, "failed");
    assert.equal(job.results.web.code, "WEB_PUBLISHER_NOT_CONFIGURED");
    assert.notEqual(job.results.web.state, "published");
  }

  {
    const store = await makeStore(() => {
      const error = new Error("模拟官网内容服务故障");
      error.code = "CMS_WRITE_FAILED";
      throw error;
    });
    const job = await store.createJobs(webJob());
    assert.equal(job.status, "failed");
    assert.equal(job.results.web.state, "failed");
    assert.equal(job.results.web.code, "CMS_WRITE_FAILED");
    assert.match(job.results.web.message, /模拟官网内容服务故障/);
  }

  {
    const store = await makeStore(() => ({ article: { id: "ART-WEB-1", status: "approved" } }));
    const job = await store.createJobs(webJob());
    assert.equal(job.status, "failed");
    assert.equal(job.results.web.code, "WEB_PUBLISH_NOT_CONFIRMED");
  }

  {
    let callbackTarget = null;
    const store = await makeStore((target) => {
      callbackTarget = target;
      return {
        article: {
          id: target.articleId,
          status: "published",
          metadata: { siteSlug: "publisher-web-test", sitePublishedAt: "2026-07-31T08:00:00.000Z" }
        },
        version: { id: target.versionId }
      };
    });
    const job = await store.createJobs(webJob(), {
      actor: { userId: "USR-PUBLISHER" },
      requestMetadata: { ipAddress: "127.0.0.1", userAgent: "publisher-web-check" }
    });
    assert.equal(job.status, "success");
    assert.equal(job.results.web.state, "published");
    assert.equal(job.results.web.version_id, "VER-WEB-1");
    assert.equal(job.localArticleId, "LOCAL-ARTICLE-1");
    assert.equal(callbackTarget.articleId, "ART-WEB-1");
    assert.equal(callbackTarget.versionId, "VER-WEB-1");
    assert.equal(callbackTarget.expectedRevision, 7);
    assert.equal(callbackTarget.metadata.siteSlug, "publisher-web-test");
    assert.equal(callbackTarget.actor.userId, "USR-PUBLISHER");
    assert.equal(store.state.jobs[0].contentArticleId, "ART-WEB-1");
    assert.equal(store.state.jobs[0].contentVersionId, "VER-WEB-1");
  }

  {
    let calls = 0;
    const store = await makeStore((target) => {
      calls += 1;
      return { article: { id: target.articleId, status: "published", metadata: {} }, version: { id: target.versionId } };
    });
    const future = new Date(Date.now() + 60_000).toISOString();
    const scheduled = await store.createJobs(webJob({ mode: "scheduled", scheduledAt: future }));
    assert.equal(scheduled.status, "scheduled");
    assert.equal(scheduled.results.web.state, "queued");
    assert.equal(calls, 0);
    await store.processDueJobs();
    assert.equal(calls, 0);
    assert.equal(store.state.jobs[0].status, "scheduled");
    store.state.jobs[0].scheduledAt = new Date(Date.now() - 1_000).toISOString();
    await Promise.all([store.processDueJobs(), store.processDueJobs()]);
    assert.equal(calls, 1);
    assert.equal(store.state.jobs[0].status, "success");
    assert.equal(store.state.jobs[0].results.web.state, "published");
  }

  {
    const store = await makeStore(() => {
      throw Object.assign(new Error("定时官网发布失败"), { code: "SCHEDULED_WEB_FAILED" });
    });
    await store.createJobs(webJob({ mode: "scheduled", scheduledAt: new Date(Date.now() - 1_000).toISOString() }));
    await store.processDueJobs();
    assert.equal(store.state.jobs[0].status, "failed");
    assert.equal(store.state.jobs[0].results.web.state, "failed");
    assert.equal(store.state.jobs[0].results.web.code, "SCHEDULED_WEB_FAILED");
  }

  {
    const store = await makeStore(() => {
      throw Object.assign(new Error("官网失败但本地平台仍可继续"), { code: "WEB_ONLY_FAILED" });
    });
    const device = {
      id: "DEV-WEB-MIXED",
      name: "混合任务测试发布器",
      status: "online",
      capabilities: ["zhihu"],
      sessions: {},
      accountGroups: [{
        id: "group-mixed",
        name: "测试账号组",
        accounts: { zhihu: { platformId: "zhihu", name: "知乎测试账号", status: "online", profileKey: "group-mixed--zhihu" } }
      }]
    };
    store.state.devices.push(device);
    await store.save();
    const job = await store.createJobs(webJob({
      platforms: ["web", "zhihu"],
      platformOrder: ["web", "zhihu"],
      accountGroupId: "group-mixed"
    }));
    assert.equal(job.status, "queued");
    assert.equal(job.results.web.state, "failed");
    assert.deepEqual(job.platforms, ["web", "zhihu"]);
    const workerJobs = await store.jobs(device);
    assert.equal(workerJobs.length, 1);
    assert.deepEqual(workerJobs[0].platforms, ["zhihu"]);
    const completed = await store.result(device, job.id, {
      state: "success",
      platform_results: {
        web: { state: "published", remote_url: "https://invalid-worker-result.test" },
        zhihu: { state: "published", remote_url: "https://example.test/zhihu/1" }
      }
    });
    assert.equal(completed.status, "partial_failed");
    assert.equal(completed.results.web.state, "failed");
    assert.equal(completed.results.zhihu.state, "published");
  }

  console.log("publisher web publication checks passed");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
