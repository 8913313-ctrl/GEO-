import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const dataDir = await mkdtemp(path.join(os.tmpdir(), "tongzhuo-publisher-contract-"));
process.env.TZ_PUBLISHER_DATA_DIR = dataDir;

try {
  const moduleUrl = pathToFileURL(path.resolve("publisher-store.mjs"));
  moduleUrl.searchParams.set("direct-contract-check", String(Date.now()));
  const { PublisherStore } = await import(moduleUrl.href);
  const store = new PublisherStore();
  await store.load();

  const platformIds = ["wechat_mp", "zhihu", "toutiao", "baijiahao"];
  const accounts = Object.fromEntries(platformIds.map((platformId) => [platformId, {
    platformId,
    name: `${platformId}-test`,
    accountName: `${platformId}-test`,
    status: "online",
    profileKey: `group-contract--${platformId}`
  }]));
  const device = {
    id: "device-contract-check",
    name: "发布契约测试设备",
    status: "online",
    capabilities: platformIds,
    sessions: {},
    accountGroups: [{ id: "group-contract", name: "契约测试账号组", accounts }]
  };
  store.state.devices = [device];
  await store.save();

  const direct = await store.createJobs({
    accountGroupId: "group-contract",
    article: { id: "article-direct", title: "direct", version: "v1" },
    platforms: ["wechat_mp", "zhihu", "toutiao"],
    publish_mode: "direct"
  });
  assert.equal(direct.publish_mode, "direct");
  assert.equal(direct.manual_confirmation, false);
  assert.equal(direct.supports_direct_publish, true);
  assert.deepEqual(direct.platform_details.map((item) => item.publish_mode), ["direct", "direct", "direct"]);
  assert.ok(direct.platform_details.every((item) => item.supports_direct_publish && item.manual_confirmation === false));

  // Every catalog platform now carries the verified direct contract, so a
  // mixed request resolves to all-direct unless an explicit manual
  // confirmation is requested for the whole job.
  const mixed = await store.createJobs({
    accountGroupId: "group-contract",
    article: { id: "article-mixed", title: "mixed", version: "v1" },
    platforms: ["zhihu", "baijiahao"],
    publish_mode: "direct"
  });
  assert.equal(mixed.publish_mode, "direct");
  assert.equal(mixed.manual_confirmation, false);
  assert.equal(mixed.supports_direct_publish, true);
  assert.equal(mixed.platform, null);
  assert.deepEqual(mixed.platform_details.map((item) => item.publish_mode), ["direct", "direct"]);
  assert.ok(mixed.platform_details.every((item) => item.supports_direct_publish && item.manual_confirmation === false));

  const manuallyRequested = await store.createJobs({
    accountGroupId: "group-contract",
    article: { id: "article-manual", title: "manual", version: "v1" },
    platforms: ["zhihu"],
    publish_mode: "direct",
    manual_confirmation: true
  });
  assert.equal(manuallyRequested.publish_mode, "draft");
  assert.equal(manuallyRequested.manual_confirmation, true);
  assert.equal(manuallyRequested.platform_details[0].publish_mode, "draft");

  const scheduled = await store.createJobs({
    accountGroupId: "group-contract",
    article: { id: "article-scheduled", title: "scheduled", version: "v1" },
    platforms: ["toutiao"],
    mode: "scheduled",
    scheduledAt: new Date(Date.now() + 60_000).toISOString()
  });
  assert.equal(scheduled.publish_mode, "direct", "scheduled is a scheduling trigger, not a worker publish mode");
  assert.equal(scheduled.scheduledAt.length > 0, true);

  store.state.jobs.push({ id: 9001, targetPlatforms: ["zhihu"], workerPlatforms: ["zhihu"], status: "queued", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  const legacy = (await store.overview()).jobs.find((job) => job.id === 9001);
  assert.equal(legacy.publish_mode, "draft", "legacy jobs without an explicit mode must never become direct after upgrade");
  assert.equal(legacy.manual_confirmation, true);
  assert.equal(legacy.supports_direct_publish, true);

  const web = (await store.overview()).platforms.find((platform) => platform.id === "web");
  assert.equal(web.supports_scheduled, true);
  assert.equal(web.supports_direct_publish, true);
  const x = (await store.overview()).platforms.find((platform) => platform.id === "x");
  assert.equal(x?.enabled, true, "X stays enabled in the backend catalog");
  assert.equal(x?.support, "ready", "X carries the verified direct contract");

  console.log("publisher direct contract check passed");
} finally {
  await rm(dataDir, { recursive: true, force: true });
}
