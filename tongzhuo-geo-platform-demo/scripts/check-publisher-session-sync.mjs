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
  const { PublisherStore, PUBLISHER_HEARTBEAT_TTL_MS } = await import(moduleUrl.href);
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
  }, {
    // Two installations may both send the historical group-default id. The
    // server must scope that id by device before exposing it to the UI.
    id: "device-default-b",
    name: "另一台电脑发布器",
    status: "online",
    capabilities: ["baijiahao"],
    lastHeartbeatAt: new Date().toISOString(),
    accountGroups: [{
      id: "group-default",
      name: "默认账号组",
      accounts: {
        baijiahao: {
          platformId: "baijiahao",
          name: "另一台账号",
          accountName: "另一台账号",
          status: "online",
          profileKey: "another-local-profile"
        }
      }
    }],
    sessions: {
      "baijiahao:another-local-profile": {
        platform_id: "baijiahao",
        profile_key: "another-local-profile",
        account_name: "另一台账号",
        login_state: "ready",
        auto_allowed: true,
        meta: { group_id: "group-default" },
        updated_at: new Date().toISOString()
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
  assert.equal(groupA?.accounts?.baijiahao?.status, "online");
  assert.equal(groupB?.accounts?.baijiahao?.status, "needs_verification");
  assert.equal(groupC?.accounts?.baijiahao?.status, "unknown");
  assert.equal(overview.sessions.find((session) => session.profile_key === "group-a--baijiahao")?.device_id, "device-session-check");
  const scopedDefault = overview.accountGroups.find((group) => group.id === "group-device-default-b-default");
  assert.equal(Boolean(scopedDefault), true);
  assert.equal(overview.accountGroups.some((group) => group.id === "group-default"), false);
  assert.equal(scopedDefault?.accounts?.baijiahao?.accountName, "另一台账号");

  const job = await store.createJobs({
    accountGroupId: "group-a",
    article: { id: "article-a", title: "会话同步文章", version: "v1" },
    platforms: ["baijiahao"]
  });
  assert.deepEqual(job.platforms, ["baijiahao"]);

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

  // A stopped/uninstalled desktop must not leave an old heartbeat and ready
  // session looking online forever. The configured grace period is longer
  // than the normal five-minute heartbeat interval.
  store.state.devices[0].lastHeartbeatAt = new Date(Date.now() - PUBLISHER_HEARTBEAT_TTL_MS - 1).toISOString();
  const staleOverview = await store.overview();
  assert.equal(staleOverview.devices[0]?.status, "offline");
  assert.equal(staleOverview.sessions.find((session) => session.profile_key === "group-a--baijiahao")?.login_state, "unknown");
  assert.equal(staleOverview.accountGroups.find((group) => group.id === "group-a")?.accounts?.baijiahao?.status, "unknown");
  await assert.rejects(
    () => store.createJobs({
      accountGroupId: "group-a",
      article: { id: "article-stale", title: "离线设备文章", version: "v1" },
      platforms: ["baijiahao"]
    }),
    /未在本地发布器完成登录或能力同步/
  );

  // Registration and session updates from two fresh installations must keep
  // the same legacy payload id in separate device scopes.
  const pairingOne = await store.createPairing();
  await store.register({
    pairing_code: pairingOne.code,
    device_id: "device-register-a",
    name: "注册设备 A",
    capabilities: ["baijiahao"],
    meta: { account_groups: [{ id: "group-default", name: "默认账号组", accounts: {} }], active_group_id: "group-default" }
  });
  const pairingTwo = await store.createPairing();
  await store.register({
    pairing_code: pairingTwo.code,
    device_id: "device-register-b",
    name: "注册设备 B",
    capabilities: ["baijiahao"],
    meta: { account_groups: [{ id: "group-default", name: "默认账号组", accounts: {} }], active_group_id: "group-default" }
  });
  const registeredA = store.state.devices.find((device) => device.id === "device-register-a");
  const registeredB = store.state.devices.find((device) => device.id === "device-register-b");
  await store.updateSession(registeredA, { platform_id: "baijiahao", profile_key: "local-a", account_name: "账号 A", login_state: "ready", meta: { group_id: "group-default" } });
  await store.updateSession(registeredB, { platform_id: "baijiahao", profile_key: "local-b", account_name: "账号 B", login_state: "needs_login", meta: { group_id: "group-default" } });
  const registeredOverview = await store.overview();
  assert.equal(registeredOverview.accountGroups.find((group) => group.id === "group-device-register-a-default")?.accounts?.baijiahao?.accountName, "账号 A");
  assert.equal(registeredOverview.accountGroups.find((group) => group.id === "group-device-register-b-default")?.accounts?.baijiahao?.status, "needs_login");

  console.log("publisher session sync check passed");
} finally {
  await rm(temporaryDataDir, { recursive: true, force: true });
}
