import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const temporaryDataDir = await mkdtemp(path.join(os.tmpdir(), "tongzhuo-publisher-session-"));
process.env.TZ_PUBLISHER_DATA_DIR = temporaryDataDir;

try {
  const moduleUrl = pathToFileURL(path.resolve("publisher-store.mjs"));
  moduleUrl.searchParams.set("session-sync-check", String(Date.now()));
  const { PublisherStore } = await import(moduleUrl.href);
  const store = new PublisherStore();
  await store.load();

  store.state.devices = [{
    id: "device-session-check",
    name: "同步校验设备",
    status: "online",
    capabilities: ["baijiahao"],
    accountGroups: [
      {
        id: "group-a",
        name: "账号组 A",
        accounts: {
          baijiahao: {
            platformId: "baijiahao",
            name: "账号 A",
            accountName: "账号 A",
            status: "needs_login",
            profileKey: "group-a--baijiahao"
          }
        }
      },
      {
        id: "group-b",
        name: "账号组 B",
        accounts: {
          baijiahao: {
            platformId: "baijiahao",
            name: "账号 B",
            accountName: "账号 B",
            status: "online",
            profileKey: "group-b--baijiahao"
          }
        }
      },
      {
        id: "group-c",
        name: "账号组 C",
        accounts: {
          baijiahao: {
            platformId: "baijiahao",
            name: "账号 C",
            accountName: "账号 C",
            // Stale cache says online, but the live assistant probe did not
            // establish a session. The live state must win.
            status: "online",
            profileKey: "group-c--baijiahao"
          }
        }
      }
    ],
    sessions: {
      "baijiahao:group-a--baijiahao": {
        platform_id: "baijiahao",
        profile_key: "group-a--baijiahao",
        account_name: "账号 A",
        login_state: "ready",
        auto_allowed: true,
        meta: { group_id: "group-a" },
        updated_at: "2026-07-24T12:00:00.000Z"
      },
      "baijiahao:group-b--baijiahao": {
        platform_id: "baijiahao",
        profile_key: "group-b--baijiahao",
        account_name: "账号 B",
        login_state: "needs_verification",
        auto_allowed: false,
        meta: { group_id: "group-b" },
        updated_at: "2026-07-24T12:01:00.000Z"
      },
      "baijiahao:group-c--baijiahao": {
        platform_id: "baijiahao",
        profile_key: "group-c--baijiahao",
        account_name: "账号 C",
        login_state: "unknown",
        auto_allowed: false,
        meta: { group_id: "group-c" },
        updated_at: "2026-07-24T12:02:00.000Z"
      }
    }
  }];
  store.state.nextJobId = 1;
  await store.save();

  const overview = await store.overview();
  const groupA = overview.accountGroups.find((group) => group.id === "group-a");
  const groupB = overview.accountGroups.find((group) => group.id === "group-b");
  const groupC = overview.accountGroups.find((group) => group.id === "group-c");

  assert.equal(overview.platforms.find((platform) => platform.id === "baijiahao")?.support, "ready");
  assert.equal(overview.platforms.find((platform) => platform.id === "baijiahao")?.requiresManualConfirmation, false);
  assert.equal(overview.platforms.find((platform) => platform.id === "baijiahao")?.supports_direct_publish, true);
  assert.equal(groupA?.accounts?.baijiahao?.status, "online");
  assert.equal(groupB?.accounts?.baijiahao?.status, "needs_verification");
  assert.equal(groupC?.accounts?.baijiahao?.status, "unknown");
  assert.equal(overview.sessions.find((session) => session.profile_key === "group-a--baijiahao")?.device_id, "device-session-check");

  const job = await store.createJobs({
    accountGroupId: "group-a",
    article: { id: "article-a", title: "会话同步文章", version: "v1" },
    platforms: ["baijiahao"]
  });
  assert.deepEqual(job.platforms, ["baijiahao"]);
  assert.equal(job.publish_mode, "direct");
  assert.equal(job.manual_confirmation, false);
  assert.equal(job.supports_direct_publish, true);
  assert.equal(job.platform_details[0].publish_mode, "direct");
  assert.equal(job.platform_details[0].manual_confirmation, false);

  await assert.rejects(
    () => store.createJobs({
      accountGroupId: "group-b",
      article: { id: "article-b", title: "未验证文章", version: "v1" },
      platforms: ["baijiahao"]
    }),
    /未在本地发布器完成登录或能力同步/
  );

  await assert.rejects(
    () => store.createJobs({
      accountGroupId: "group-c",
      article: { id: "article-c", title: "状态待检测文章", version: "v1" },
      platforms: ["baijiahao"]
    }),
    /未在本地发布器完成登录或能力同步/
  );

  console.log("publisher session sync check passed");
} finally {
  await rm(temporaryDataDir, { recursive: true, force: true });
}
