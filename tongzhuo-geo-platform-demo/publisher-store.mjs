import crypto from "node:crypto";
import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { secretDigest, verifySecret } from "./production-secrets.mjs";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const configuredDataDir = String(process.env.TZ_PUBLISHER_DATA_DIR || "").trim();
const defaultDataDir = configuredDataDir ? path.resolve(configuredDataDir) : path.join(rootDir, "data");

/**
 * Domain errors from the publisher integration carry an HTTP status and a
 * stable code. This keeps authentication/pairing failures out of the 500
 * bucket while preserving the user-facing message.
 */
export class PublisherError extends Error {
  constructor(message, status = 400, code = "PUBLISHER_ERROR", details = undefined) {
    super(message);
    this.name = "PublisherError";
    this.status = status;
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

const PLATFORM_ALIASES = {
  wechat: "wechat_mp",
  // The browser bridge calls the WeChat adapter `weixin`, while the public
  // publisher catalog uses the canonical `wechat_mp` ID. Accept both so older
  // desktop agents cannot silently lose this capability during heartbeats.
  weixin: "wechat_mp",
  baijia: "baijiahao",
  blog: "cnblogs",
  tiktok: "douyin"
};

export const PUBLISHER_PLATFORMS = [
  { id: "web", name: "企业官网", category: "official", accountMode: "server", support: "ready", enabled: true, executionMode: "server_publish", requiresManualConfirmation: false, loginUrl: "", editorUrl: "" },
  { id: "wechat_mp", name: "微信公众号", category: "self_media", accountMode: "local", support: "ready", enabled: true, executionMode: "assistant_submit", requiresManualConfirmation: false, loginUrl: "https://mp.weixin.qq.com/", editorUrl: "https://mp.weixin.qq.com/" },
  { id: "zhihu", name: "知乎", category: "self_media", accountMode: "local", support: "ready", enabled: true, executionMode: "assistant_submit", requiresManualConfirmation: false, loginUrl: "https://www.zhihu.com/signin?next=%2F", editorUrl: "https://zhuanlan.zhihu.com/write" },
  { id: "toutiao", name: "头条号", category: "self_media", accountMode: "local", support: "ready", enabled: true, executionMode: "assistant_submit", requiresManualConfirmation: false, loginUrl: "https://mp.toutiao.com/", editorUrl: "https://mp.toutiao.com/profile_v4/graphic/publish" },
  { id: "baijiahao", name: "百家号", category: "self_media", accountMode: "local", support: "manual", enabled: true, executionMode: "assistant_confirm", requiresManualConfirmation: true, manualReason: "需在百家号后台处理验证、审核或最终确认", loginUrl: "https://baijiahao.baidu.com/", editorUrl: "https://baijiahao.baidu.com/builder/rc/edit?type=news" },
  { id: "xiaohongshu", name: "小红书", category: "self_media", accountMode: "local", support: "manual", enabled: true, executionMode: "assistant_confirm", requiresManualConfirmation: true, manualReason: "需在小红书创作中心补充素材并确认发布", loginUrl: "https://creator.xiaohongshu.com/", editorUrl: "https://creator.xiaohongshu.com/new/home" },
  { id: "weibo", name: "微博", category: "self_media", accountMode: "local", support: "manual", enabled: true, executionMode: "assistant_confirm", requiresManualConfirmation: true, manualReason: "需在微博后台处理安全验证或最终确认", loginUrl: "https://weibo.com/", editorUrl: "https://weibo.com/" },
  { id: "juejin", name: "掘金", category: "self_media", accountMode: "local", support: "manual", enabled: true, executionMode: "assistant_confirm", requiresManualConfirmation: true, manualReason: "需在掘金编辑器确认发布", loginUrl: "https://juejin.cn/", editorUrl: "https://juejin.cn/editor/drafts/new" },
  { id: "csdn", name: "CSDN", category: "self_media", accountMode: "local", support: "manual", enabled: true, executionMode: "assistant_confirm", requiresManualConfirmation: true, manualReason: "需在 CSDN 编辑器确认发布", loginUrl: "https://passport.csdn.net/", editorUrl: "https://editor.csdn.net/md/" },
  { id: "jianshu", name: "简书", category: "self_media", accountMode: "local", support: "manual", enabled: true, executionMode: "assistant_confirm", requiresManualConfirmation: true, manualReason: "需在简书编辑器确认发布", loginUrl: "https://www.jianshu.com/sign_in", editorUrl: "https://www.jianshu.com/writer" },
  { id: "douyin", name: "抖音图文", category: "self_media", accountMode: "local", support: "manual", enabled: true, executionMode: "assistant_confirm", requiresManualConfirmation: true, manualReason: "需在抖音创作服务平台补充素材并确认发布", loginUrl: "https://creator.douyin.com/", editorUrl: "https://creator.douyin.com/creator-micro/content/upload" },
  { id: "bilibili", name: "B站专栏", category: "self_media", accountMode: "local", support: "manual", enabled: true, executionMode: "assistant_confirm", requiresManualConfirmation: true, manualReason: "需在 B 站创作中心确认发布", loginUrl: "https://passport.bilibili.com/", editorUrl: "https://member.bilibili.com/platform/upload/text/edit" },
  { id: "yuque", name: "语雀", category: "self_media", accountMode: "local", support: "manual", enabled: true, executionMode: "assistant_confirm", requiresManualConfirmation: true, manualReason: "需在语雀工作台确认发布", loginUrl: "https://www.yuque.com/login", editorUrl: "https://www.yuque.com/dashboard" },
  { id: "douban", name: "豆瓣", category: "self_media", accountMode: "local", support: "manual", enabled: true, executionMode: "assistant_confirm", requiresManualConfirmation: true, manualReason: "需在豆瓣页面确认发表", loginUrl: "https://www.douban.com/", editorUrl: "https://www.douban.com/" },
  { id: "sohu", name: "搜狐号", category: "self_media", accountMode: "local", support: "manual", enabled: true, executionMode: "assistant_confirm", requiresManualConfirmation: true, manualReason: "需在搜狐号后台确认发布", loginUrl: "https://mp.sohu.com/", editorUrl: "https://mp.sohu.com/" },
  { id: "xueqiu", name: "雪球", category: "self_media", accountMode: "local", support: "manual", enabled: true, executionMode: "assistant_confirm", requiresManualConfirmation: true, manualReason: "需在雪球后台确认发表", loginUrl: "https://xueqiu.com/", editorUrl: "https://xueqiu.com/" },
  { id: "woshipm", name: "人人都是产品经理", category: "self_media", accountMode: "local", support: "manual", enabled: true, executionMode: "assistant_confirm", requiresManualConfirmation: true, manualReason: "需在人人都是产品经理后台确认投稿", loginUrl: "https://www.woshipm.com/", editorUrl: "https://www.woshipm.com/" },
  { id: "dayu", name: "大鱼号", category: "self_media", accountMode: "local", support: "manual", enabled: true, executionMode: "assistant_confirm", requiresManualConfirmation: true, manualReason: "需在大鱼号后台确认发布", loginUrl: "https://mp.dayu.com/", editorUrl: "https://mp.dayu.com/" },
  { id: "yidian", name: "一点号", category: "self_media", accountMode: "local", support: "manual", enabled: true, executionMode: "assistant_confirm", requiresManualConfirmation: true, manualReason: "需在一点号后台确认发布", loginUrl: "https://mp.yidianzixun.com/", editorUrl: "https://mp.yidianzixun.com/" },
  { id: "51cto", name: "51CTO", category: "self_media", accountMode: "local", support: "manual", enabled: true, executionMode: "assistant_confirm", requiresManualConfirmation: true, manualReason: "需在 51CTO 后台确认发布", loginUrl: "https://blog.51cto.com/", editorUrl: "https://blog.51cto.com/" },
  { id: "imooc", name: "慕课网", category: "self_media", accountMode: "local", support: "manual", enabled: true, executionMode: "assistant_confirm", requiresManualConfirmation: true, manualReason: "需在慕课网创作后台确认发布", loginUrl: "https://www.imooc.com/", editorUrl: "https://www.imooc.com/" },
  { id: "oschina", name: "开源中国", category: "self_media", accountMode: "local", support: "manual", enabled: true, executionMode: "assistant_confirm", requiresManualConfirmation: true, manualReason: "需在开源中国后台确认发布", loginUrl: "https://www.oschina.net/", editorUrl: "https://my.oschina.net/" },
  { id: "segmentfault", name: "SegmentFault", category: "self_media", accountMode: "local", support: "manual", enabled: true, executionMode: "assistant_confirm", requiresManualConfirmation: true, manualReason: "需在 SegmentFault 编辑器确认发布", loginUrl: "https://segmentfault.com/user/login", editorUrl: "https://segmentfault.com/write" },
  { id: "cnblogs", name: "博客园", category: "self_media", accountMode: "local", support: "manual", enabled: true, executionMode: "assistant_confirm", requiresManualConfirmation: true, manualReason: "需在博客园编辑器确认发布", loginUrl: "https://account.cnblogs.com/signin", editorUrl: "https://i.cnblogs.com/posts/edit" },
  { id: "sohufocus", name: "搜狐焦点", category: "self_media", accountMode: "local", support: "ready", enabled: true, executionMode: "assistant_submit", requiresManualConfirmation: false, loginUrl: "https://mp.focus.cn/", editorUrl: "https://mp.focus.cn/" },
  { id: "eastmoney", name: "东方财富", category: "self_media", accountMode: "local", support: "ready", enabled: true, executionMode: "assistant_submit", requiresManualConfirmation: false, loginUrl: "https://www.eastmoney.com/", editorUrl: "https://www.eastmoney.com/" },
  { id: "smzdm", name: "什么值得买", category: "self_media", accountMode: "local", support: "ready", enabled: true, executionMode: "assistant_submit", requiresManualConfirmation: false, loginUrl: "https://www.smzdm.com/", editorUrl: "https://post.smzdm.com/" },
  { id: "netease", name: "网易号", category: "self_media", accountMode: "local", support: "ready", enabled: true, executionMode: "assistant_submit", requiresManualConfirmation: false, loginUrl: "https://mp.163.com/", editorUrl: "https://mp.163.com/" }
];

function platformRuntimeContract(platform) {
  if (!platform || !platform.enabled || platform.accountMode !== "local") return platform;
  return {
    ...platform,
    support: "ready",
    executionMode: "assistant_submit",
    requiresManualConfirmation: false,
    manualReason: ""
  };
}

PUBLISHER_PLATFORMS.forEach((platform) => Object.assign(platform, platformRuntimeContract(platform)));

const readyPlatformIds = new Set(PUBLISHER_PLATFORMS.filter((item) => item.enabled).map((item) => item.id));
const selectablePlatformIds = new Set(PUBLISHER_PLATFORMS.filter((item) => item.enabled).map((item) => item.id));
const manualConfirmationPlatformIds = new Set();
// The desktop agent sends a heartbeat every five minutes. Keep a generous
// grace period for sleeping laptops, but never let an old heartbeat advertise
// a stopped/uninstalled publisher as online indefinitely.
export const PUBLISHER_HEARTBEAT_TTL_MS = 15 * 60 * 1000;

function platformById(id) {
  return platformRuntimeContract(PUBLISHER_PLATFORMS.find((item) => item.id === id) || null);
}

function platformDetails(ids = []) {
  return [...new Set(ids)].map((id) => platformById(id)).filter(Boolean).map((platform) => ({
    id: platform.id,
    name: platform.name,
    support: platform.support,
    executionMode: platform.executionMode,
    requiresManualConfirmation: Boolean(platform.requiresManualConfirmation),
    manualReason: platform.manualReason || ""
  }));
}

function localSelectablePlatformIds() {
  return [...selectablePlatformIds].filter((id) => platformById(id)?.accountMode === "local");
}

function accountReady(account) {
  return Boolean(account && ["online", "ready"].includes(String(account.status || "").toLowerCase()));
}

function sessionGroupId(session = {}) {
  const explicitGroupId = String(session?.meta?.group_id || session?.group_id || "").trim();
  if (explicitGroupId) return explicitGroupId;
  const profileKey = String(session?.profile_key || "").trim();
  const separator = profileKey.lastIndexOf("--");
  return separator > 0 ? profileKey.slice(0, separator) : "";
}

function sessionUpdatedAt(session = {}) {
  const value = Date.parse(session.updated_at || session.last_verified_at || "");
  return Number.isFinite(value) ? value : 0;
}

function latestSessionForGroup(device, group, platformId) {
  if (!device || !group) return null;
  const canonicalId = canonicalPlatformId(platformId);
  const account = group.accounts?.[canonicalId] || group.accounts?.[platformId];
  const profileKey = String(account?.profileKey || "").trim();
  const groupId = String(group.id || "").trim();
  return Object.values(device.sessions || {})
    .filter((session) => canonicalPlatformId(session?.platform_id) === canonicalId)
    .filter((session) => {
      const matchedGroupId = sessionGroupId(session);
      return matchedGroupId
        ? (matchedGroupId === groupId || scopedAccountGroupId(device.id, matchedGroupId) === groupId)
        : Boolean(profileKey && String(session?.profile_key || "") === profileKey);
    })
    .sort((left, right) => sessionUpdatedAt(right) - sessionUpdatedAt(left))[0] || null;
}

function accountStatusFromSession(session) {
  const state = String(session?.login_state || "").trim().toLowerCase();
  if (!state) return "";
  return state === "ready" ? "online" : state;
}

function effectiveAccountForGroup(device, group, platformId) {
  const canonicalId = canonicalPlatformId(platformId);
  const account = group?.accounts?.[canonicalId] || group?.accounts?.[platformId];
  const session = latestSessionForGroup(device, group, canonicalId);
  if (!account && !session) return null;
  const sessionStatus = accountStatusFromSession(session);
  if (!sessionStatus) return { ...(account || {}), platformId: canonicalId };
  return {
    ...(account || {}),
    platformId: canonicalId,
    name: String(session?.account_name || account?.name || account?.accountName || "").trim(),
    accountName: String(session?.account_name || account?.accountName || account?.name || "").trim(),
    status: sessionStatus,
    profileKey: String(session?.profile_key || account?.profileKey || "").trim(),
    updatedAt: session?.updated_at || session?.last_verified_at || account?.updatedAt
  };
}

function effectiveAccountGroups(device, groups = []) {
  return groups.map((group) => {
    const accounts = {};
    const sessionPlatformIds = Object.values(device.sessions || {})
      .filter((session) => {
        const matchedGroupId = sessionGroupId(session);
        const groupId = String(group.id || "").trim();
        return matchedGroupId === groupId || scopedAccountGroupId(device.id, matchedGroupId) === groupId;
      })
      .map((session) => canonicalPlatformId(session.platform_id))
      .filter(Boolean);
    const platformIds = new Set([...Object.keys(group.accounts || {}), ...sessionPlatformIds]);
    platformIds.forEach((platformId) => {
      // Historical sessions may contain platforms removed from the current
      // catalog (for example X/Twitter). Do not resurrect those records in
      // the management UI or account-group preflight view.
      if (!PUBLISHER_PLATFORMS.some((item) => item.id === canonicalPlatformId(platformId))) return;
      const account = effectiveAccountForGroup(device, group, platformId);
      if (account) accounts[canonicalPlatformId(platformId)] = account;
    });
    return { ...group, accounts };
  });
}

function accountReadyForGroup(device, group, platformId) {
  return deviceIsOnline(device) && accountReady(effectiveAccountForGroup(device, group, platformId));
}

function deviceIsOnline(device, nowMs = Date.now()) {
  if (!device || String(device.status || '').toLowerCase() !== 'online') return false;
  const heartbeatAt = Date.parse(device.lastHeartbeatAt || '');
  // Legacy device records may not have a heartbeat timestamp. Preserve their
  // explicit online state until the next heartbeat writes one.
  return !Number.isFinite(heartbeatAt) || heartbeatAt > nowMs - PUBLISHER_HEARTBEAT_TTL_MS;
}

function publicSession(device, session, nowMs = Date.now()) {
  const rawGroupId = sessionGroupId(session);
  const normalized = rawGroupId
    ? { ...session, meta: { ...(session.meta || {}), group_id: scopedAccountGroupId(device?.id, rawGroupId) } }
    : { ...session };
  if (deviceIsOnline(device, nowMs)) return normalized;
  return {
    ...normalized,
    // A session is local to the desktop. Once that desktop is stale, the
    // previous `ready` value is only a historical snapshot and must not keep
    // the GEOFlow account center showing “已登录”.
    login_state: session.login_state === 'ready' || session.login_state === 'online' ? 'unknown' : session.login_state,
    auto_allowed: false,
    last_error_message: session.last_error_message || '本地发布器已离线，等待重新连接后确认登录状态。',
  };
}

function now() {
  return new Date().toISOString();
}

function token(prefix) {
  return `${prefix}-${crypto.randomBytes(32).toString("hex")}`;
}

function canonicalPlatformId(id) {
  const value = String(id || "").trim();
  return PLATFORM_ALIASES[value] || value;
}

function defaultAccountGroupId(deviceId = "") {
  const scope = String(deviceId || "").trim();
  return scope ? `group-${scope}-default` : "group-default";
}

function scopedAccountGroupId(deviceId, groupId) {
  const value = String(groupId || "").trim();
  if (!value || value === "group-default") return defaultAccountGroupId(deviceId);
  return value;
}

function emptyState() {
  return { version: 2, nextJobId: 1, pairings: [], devices: [], jobs: [] };
}

function migrateDeviceCredentials(device) {
  if (!device || typeof device !== "object") return false;
  let changed = false;
  if (Object.prototype.hasOwnProperty.call(device, "token")) {
    const rawToken = String(device.token || "");
    if (rawToken && !device.tokenDigest) device.tokenDigest = secretDigest(rawToken);
    delete device.token;
    changed = true;
  }
  if (Object.prototype.hasOwnProperty.call(device, "deviceSecret")) {
    const rawSecret = String(device.deviceSecret || "");
    if (rawSecret && !device.deviceSecretDigest) device.deviceSecretDigest = secretDigest(rawSecret);
    delete device.deviceSecret;
    changed = true;
  }
  return changed;
}

function migratePublisherState(rawState) {
  const state = { ...emptyState(), ...(rawState && typeof rawState === "object" ? rawState : {}) };
  state.pairings = Array.isArray(state.pairings) ? state.pairings : [];
  state.devices = Array.isArray(state.devices) ? state.devices : [];
  state.jobs = Array.isArray(state.jobs) ? state.jobs : [];
  let changed = state.version !== 2;
  state.devices.forEach((device) => {
    if (migrateDeviceCredentials(device)) changed = true;
    if (!Array.isArray(device.deletedAccountGroupIds)) {
      device.deletedAccountGroupIds = [];
      changed = true;
    }
  });
  state.version = 2;
  return { state, changed };
}

function cleanAccountGroups(groups = [], deviceId = "") {
  if (!Array.isArray(groups) || !groups.length) return [{ id: defaultAccountGroupId(deviceId), name: "默认账号组", accounts: {} }];
  return groups.map((group) => {
    const accounts = {};
    Object.entries(group.accounts || {}).forEach(([rawPlatform, account]) => {
      const platformId = canonicalPlatformId(rawPlatform);
      if (!platformId || !PUBLISHER_PLATFORMS.some((item) => item.id === platformId)) return;
      accounts[platformId] = {
        platformId,
        name: String(account?.name || account?.accountName || "").trim(),
        accountName: String(account?.accountName || account?.name || "").trim(),
        status: String(account?.status || "needs_login").trim(),
        profileKey: String(account?.profileKey || "").trim(),
        updatedAt: String(account?.updatedAt || now())
      };
    });
    return {
      id: scopedAccountGroupId(deviceId, group.id || `group-${crypto.randomBytes(4).toString("hex")}`),
      name: String(group.name || "未命名账号组"),
      deviceId: String(group.deviceId || ""),
      deviceName: String(group.deviceName || ""),
      updatedAt: String(group.updatedAt || now()),
      accounts
    };
  });
}

function publicDevice(device) {
  const nowMs = Date.now();
  const online = deviceIsOnline(device, nowMs);
  const accountGroups = effectiveAccountGroups({
    ...device,
    status: online ? 'online' : 'offline',
    sessions: Object.fromEntries(Object.entries(device.sessions || {}).map(([key, session]) => [key, publicSession(device, session, nowMs)])),
  }, cleanAccountGroups(device.accountGroups, device.id)).map((group) => ({
    ...group,
    accounts: Object.fromEntries(Object.entries(group.accounts || {}).map(([platformId, account]) => [platformId, online ? account : {
      ...account,
      status: account.status === 'online' || account.status === 'ready' ? 'unknown' : account.status,
      updatedAt: account.updatedAt || device.lastHeartbeatAt,
    }]))
  }));
  return {
    id: device.id,
    name: device.name,
    status: online ? 'online' : 'offline',
    capabilities: device.capabilities,
    connectionMode: device.connectionMode,
    lastHeartbeatAt: device.lastHeartbeatAt,
    pairedAt: device.pairedAt,
    accountGroups,
    sessions: Object.values(device.sessions || {}).map((session) => publicSession(device, session, nowMs)).filter((session) =>
      PUBLISHER_PLATFORMS.some((item) => item.id === canonicalPlatformId(session?.platform_id))),
  };
}

function publicJob(job, { forWorker = false } = {}) {
  const workerPlatformIds = [...new Set((job.workerPlatforms || job.platforms || [])
    .map(canonicalPlatformId)
    .filter((platformId) => platformId && platformId !== "web"))];
  const targetPlatformIds = [...new Set((job.targetPlatforms || job.platforms || [])
    .map(canonicalPlatformId)
    .filter(Boolean))];
  const workerPlatformOrder = (job.workerPlatformOrder || job.platform_order || workerPlatformIds)
    .map(canonicalPlatformId)
    .filter((platformId) => workerPlatformIds.includes(platformId));
  const targetPlatformOrder = (job.targetPlatformOrder || job.platform_order || targetPlatformIds)
    .map(canonicalPlatformId)
    .filter((platformId) => targetPlatformIds.includes(platformId));
  const platformIds = forWorker ? workerPlatformIds : targetPlatformIds;
  return {
    id: job.id,
    articleId: job.articleId,
    localArticleId: job.localArticleId || job.payload?.article?.localArticleId || job.articleId,
    articleTitle: job.articleTitle,
    version: job.version,
    account_group_id: job.account_group_id,
    group_id: job.group_id,
    group_name: job.group_name,
    platforms: platformIds,
    platform_order: forWorker ? workerPlatformOrder : targetPlatformOrder,
    // A worker executes only `worker_platforms`, while its UI renders
    // `target_platforms` so a server-owned website target does not disappear.
    target_platforms: targetPlatformIds,
    target_platform_order: targetPlatformOrder,
    worker_platforms: workerPlatformIds,
    worker_platform_order: workerPlatformOrder,
    platform_details: platformDetails(platformIds),
    payload: job.payload,
    status: job.status,
    assistant: { state: job.status, claimedBy: job.claimedBy || null },
    results: job.results || {},
    message: job.message || "",
    state_summary: job.stateSummary || {},
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    scheduledAt: job.scheduledAt || null
  };
}

export class PublisherStore {
  constructor(options = {}) {
    this.dataDir = path.resolve(options.dataDir || defaultDataDir);
    this.statePath = path.join(this.dataDir, options.fileName || "publisher-state.json");
    this.webPublisher = typeof options.webPublisher === "function" ? options.webPublisher : null;
    this.publicationObserver = typeof options.publicationObserver === "function" ? options.publicationObserver : null;
    this.dueJobsPromise = null;
    this.state = emptyState();
    this.loaded = false;
  }

  setWebPublisher(webPublisher) {
    this.webPublisher = typeof webPublisher === "function" ? webPublisher : null;
    return this;
  }

  setPublicationObserver(publicationObserver) {
    this.publicationObserver = typeof publicationObserver === "function" ? publicationObserver : null;
    return this;
  }

  async notifyPublicationObserver(job) {
    if (!this.publicationObserver) return null;
    try {
      return await this.publicationObserver(job);
    } catch (error) {
      // Publishing has already completed at this point. Tracking failures are
      // retried by the idempotent content-asset sync path and must not turn a
      // successful external publication into a failed publisher result.
      console.error("publisher_publication_tracking_failed", { jobId: job?.id, code: error?.code || "PUBLICATION_TRACKING_FAILED", message: error?.message || String(error) });
      return null;
    }
  }

  async load() {
    if (this.loaded) return this;
    await mkdir(this.dataDir, { recursive: true });
    try {
      const { state, changed } = migratePublisherState(JSON.parse(await readFile(this.statePath, "utf8")));
      this.state = state;
      if (changed) await this.save();
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      this.state = emptyState();
      await this.save();
    }
    this.loaded = true;
    return this;
  }

  async save() {
    await mkdir(this.dataDir, { recursive: true });
    this.state.devices = Array.isArray(this.state.devices) ? this.state.devices : [];
    this.state.devices.forEach((device) => migrateDeviceCredentials(device));
    this.state.version = 2;
    const tempPath = `${this.statePath}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(tempPath, JSON.stringify(this.state, null, 2), { encoding: "utf8", mode: 0o600 });
    try {
      await chmod(tempPath, 0o600);
    } catch {
      // Windows does not implement POSIX mode bits; deployment ACLs still apply.
    }
    await rename(tempPath, this.statePath);
  }

  platforms() {
    return PUBLISHER_PLATFORMS.map((item) => ({ ...platformRuntimeContract(item) }));
  }

  async createPairing() {
    await this.load();
    const code = `TZ-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    const pairing = { code, createdAt: now(), expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(), status: "active" };
    this.state.pairings = this.state.pairings.filter((item) => item.status === "active" && new Date(item.expiresAt).getTime() > Date.now());
    this.state.pairings.push(pairing);
    await this.save();
    return { code, expiresAt: pairing.expiresAt, status: pairing.status };
  }

  async register(body = {}) {
    await this.load();
    const code = String(body.pairing_code || "").trim().toUpperCase();
    const pairing = this.state.pairings.find((item) => item.code === code && item.status === "active" && new Date(item.expiresAt).getTime() > Date.now());
    if (!pairing) throw new PublisherError("配对码无效或已过期，请从发布运营重新生成。", 409, "PAIRING_CODE_INVALID");
    const deviceId = String(body.device_id || `DEV-${crypto.randomBytes(4).toString("hex").toUpperCase()}`);
    const existing = this.state.devices.find((item) => item.id === deviceId);
    const device = existing || { id: deviceId, sessions: {}, accountGroups: [] };
    device.deletedAccountGroupIds = [];
    device.name = String(body.name || device.name || "未命名发布器");
    device.status = "online";
    device.capabilities = Array.isArray(body.capabilities)
      ? body.capabilities.map(canonicalPlatformId).filter((id) => selectablePlatformIds.has(id) && id !== "web")
      : localSelectablePlatformIds();
    device.connectionMode = String(body.connection_mode || "paired");
    device.pairedAt = now();
    device.lastHeartbeatAt = now();
    const pairingToken = token("pub");
    const deviceSecret = String(body.device_secret || token("dev"));
    device.tokenDigest = secretDigest(pairingToken);
    device.deviceSecretDigest = secretDigest(deviceSecret);
    delete device.token;
    delete device.deviceSecret;
    device.accountGroups = cleanAccountGroups(body.meta?.account_groups, deviceId);
    device.activeGroupId = scopedAccountGroupId(deviceId, body.meta?.active_group_id || device.accountGroups[0]?.id);
    if (!existing) this.state.devices.push(device);
    pairing.status = "used";
    pairing.deviceId = deviceId;
    await this.save();
    return { device_id: deviceId, pairing_token: pairingToken, device_secret: deviceSecret, paired_at: device.pairedAt };
  }

  authenticate(headers = {}) {
    const raw = String(headers.authorization || "");
    const bearer = raw.replace(/^Bearer\s+/i, "").trim();
    const workerId = String(headers["x-publisher-worker"] || "").trim();
    const device = this.state.devices.find((item) => item.id === workerId && bearer && (
      verifySecret(bearer, item.tokenDigest) || verifySecret(bearer, item.deviceSecretDigest)
    ));
    if (!device) throw new PublisherError("发布器尚未完成配对，请先在发布运营生成配对码。", 401, "PUBLISHER_AUTH_REQUIRED");
    return device;
  }

  async heartbeat(device, body = {}) {
    await this.load();
    device.name = String(body.meta?.device_name || device.name || "发布器");
    device.status = "online";
    device.lastHeartbeatAt = now();
    device.capabilities = Array.isArray(body.capabilities)
      ? body.capabilities.map(canonicalPlatformId).filter((id) => selectablePlatformIds.has(id) && id !== "web")
      : device.capabilities;
    device.connectionMode = String(body.connection_mode || device.connectionMode || "paired");
    const deletedGroupIds = new Set((device.deletedAccountGroupIds || []).map((id) => String(id)));
    if (body.meta?.account_groups) {
      device.accountGroups = effectiveAccountGroups(device, cleanAccountGroups(body.meta.account_groups, device.id)
        .filter((group) => !deletedGroupIds.has(String(group.id))));
    } else {
      device.accountGroups = effectiveAccountGroups(device, cleanAccountGroups(device.accountGroups, device.id)
        .filter((group) => !deletedGroupIds.has(String(group.id))));
    }
    if (body.meta?.active_group_id) {
      const requestedActiveGroupId = scopedAccountGroupId(device.id, body.meta.active_group_id);
      device.activeGroupId = deletedGroupIds.has(requestedActiveGroupId)
        ? (device.accountGroups[0]?.id || defaultAccountGroupId(device.id))
        : requestedActiveGroupId;
    }
    await this.save();
    return publicDevice(device);
  }

  async disconnect(device, reason = "publisher_shutdown") {
    await this.load();
    const current = this.state.devices.find((item) => item.id === device?.id) || device;
    if (!current) throw new PublisherError("发布器设备不存在。", 404, "PUBLISHER_DEVICE_NOT_FOUND");
    current.status = "offline";
    current.disconnectedAt = now();
    current.disconnectReason = String(reason || "publisher_shutdown").slice(0, 120);
    await this.save();
    return publicDevice(current);
  }

  async sessions(device) {
    await this.load();
    return Object.values(device.sessions || {});
  }

  async updateSession(device, body = {}) {
    await this.load();
    const platformId = canonicalPlatformId(body.platform_id);
    if (!selectablePlatformIds.has(platformId)) throw new Error("该平台当前不在本地发布器可用目录中。");
    const key = `${platformId}:${body.profile_key || platformId}`;
    const session = {
      id: key,
      platform_id: platformId,
      profile_key: String(body.profile_key || platformId),
      account_name: String(body.account_name || ""),
      login_state: String(body.login_state || "unknown"),
      last_verified_at: body.last_verified_at || null,
      last_error_message: String(body.last_error_message || ""),
      auto_allowed: Boolean(body.auto_allowed),
      meta: body.meta || {},
      updated_at: now()
    };
    device.sessions = device.sessions || {};
    device.sessions[key] = session;
    device.status = "online";
    const groupId = scopedAccountGroupId(device.id, session.meta.group_id || String(session.profile_key).split("--")[0]);
    session.meta = { ...session.meta, group_id: groupId };
    const groups = cleanAccountGroups(device.accountGroups, device.id);
    const deletedGroupIds = new Set((device.deletedAccountGroupIds || []).map((id) => String(id)));
    const group = deletedGroupIds.has(String(groupId)) ? null : (groups.find((item) => item.id === groupId) || groups[0]);
    if (group && platformId !== "web") {
      group.accounts[platformId] = {
        ...(group.accounts[platformId] || { platformId, profileKey: session.profile_key }),
        platformId,
        name: session.account_name || group.accounts[platformId]?.name || "未命名账号",
        accountName: session.account_name || group.accounts[platformId]?.accountName || "",
        status: session.login_state === "ready" ? "online" : session.login_state,
        profileKey: session.profile_key,
        updatedAt: now()
      };
      group.updatedAt = now();
    }
    device.accountGroups = effectiveAccountGroups(device, groups);
    device.lastHeartbeatAt = now();
    await this.save();
    return session;
  }

  async jobs(device, limit = 30) {
    await this.load();
    await this.processDueJobs();
    await this.releaseStaleJobs();
    const activeWorkerStates = new Set(["queued", "running", "processing"]);
    const terminalWorkerStates = new Set([
      "draft_saved",
      "partial_failed",
      "result_unknown",
      "awaiting_login",
      "failed",
      "cancelled"
    ]);
    const recentAfter = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return this.state.jobs
      .filter((job) => {
        if (!(job.workerPlatforms || job.platforms || []).length) return false;
        // Keep an in-flight task visible to the worker that claimed it.  A
        // processing callback changes the persisted status from running to
        // processing; hiding that state makes the task disappear from the
        // desktop queue and prevents stale recovery after a crash.
        if (activeWorkerStates.has(job.status)) return !job.claimedBy || job.claimedBy === device.id;
        if (!terminalWorkerStates.has(job.status) || job.claimedBy !== device.id) return false;
        const updatedAt = Date.parse(job.updatedAt || job.createdAt || 0);
        return Number.isFinite(updatedAt) && updatedAt >= recentAfter;
      })
      .sort((left, right) => {
        const leftActive = activeWorkerStates.has(left.status);
        const rightActive = activeWorkerStates.has(right.status);
        if (leftActive !== rightActive) return leftActive ? -1 : 1;
        return leftActive
          ? new Date(left.createdAt) - new Date(right.createdAt)
          : new Date(right.updatedAt || right.createdAt) - new Date(left.updatedAt || left.createdAt);
      })
      .slice(0, Math.max(1, Math.min(100, Number(limit) || 30)))
      .map((job) => publicJob(job, { forWorker: true }));
  }

  async releaseStaleJobs() {
    const staleAfterMs = 30 * 60 * 1000;
    const nowMs = Date.now();
    let changed = false;
    for (const job of this.state.jobs) {
      if (!["running", "processing"].includes(job.status) || !job.claimedBy) continue;
      const device = this.state.devices.find((item) => item.id === job.claimedBy);
      const deviceAlive = device && Date.parse(device.lastHeartbeatAt || 0) > nowMs - staleAfterMs;
      if (deviceAlive) continue;
      const jobAge = Date.parse(job.updatedAt || job.createdAt || 0);
      if (nowMs - jobAge < staleAfterMs) continue;
      job.status = "queued";
      job.claimedBy = null;
      job.message = "执行超时已回收，可重新领取。";
      job.updatedAt = now();
      changed = true;
    }
    if (changed) await this.save();
    return changed;
  }

  async processDueJobs() {
    if (this.dueJobsPromise) return this.dueJobsPromise;
    this.dueJobsPromise = this.processDueJobsOnce();
    try {
      return await this.dueJobsPromise;
    } finally {
      this.dueJobsPromise = null;
    }
  }

  async processDueJobsOnce() {
    const timestamp = Date.now();
    let changed = false;
    for (const job of this.state.jobs) {
      if (job.status !== "scheduled") continue;
      const dueAt = Date.parse(job.scheduledAt || job.createdAt || 0);
      if (Number.isFinite(dueAt) && dueAt > timestamp) continue;
      const targets = job.targetPlatforms || job.platforms || [];
      if (targets.includes("web")) {
        job.results = { ...(job.results || {}), web: { state: "publishing", message: "正在发布到官网", remote_url: "", updated_at: now() } };
        job.updatedAt = now();
        await this.save();
        await this.publishWebTarget(job);
      }
      const hasWorkerTargets = (job.workerPlatforms || job.platforms || []).length > 0;
      job.status = hasWorkerTargets ? "queued" : job.results?.web?.state === "published" ? "success" : "failed";
      job.updatedAt = now();
      changed = true;
    }
    if (changed) await this.save();
    return changed;
  }

  async publishWebTarget(job) {
    const updatedAt = now();
    if (!this.webPublisher) {
      job.results = {
        ...(job.results || {}),
        web: { state: "failed", code: "WEB_PUBLISHER_NOT_CONFIGURED", message: "官网发布服务尚未接通，未执行发布。", remote_url: "", updated_at: updatedAt }
      };
      return job.results.web;
    }
    try {
      const result = await this.webPublisher({
        jobId: job.id,
        articleId: job.contentArticleId || job.articleId,
        versionId: job.contentVersionId || null,
        expectedRevision: job.contentRevision,
        category: job.webPublication?.category || "",
        metadata: job.webPublication?.metadata || {},
        actor: job.webPublication?.actor || null,
        requestMetadata: job.webPublication?.requestMetadata || null
      });
      const publishedArticle = result?.article || result?.data?.article || null;
      if (publishedArticle?.status !== "published") {
        const error = new Error("官网内容服务未返回已发布状态。");
        error.code = "WEB_PUBLISH_NOT_CONFIRMED";
        throw error;
      }
      const metadata = publishedArticle.metadata || {};
      const site = metadata.site || {};
      const remoteUrl = String(result?.remoteUrl || result?.url || metadata.siteUrl || site.url || job.webUrl || "");
      job.results = {
        ...(job.results || {}),
        web: { state: "published", message: "官网内容已完成正式发布", remote_url: remoteUrl, article_id: publishedArticle.id || job.articleId, version_id: result?.version?.id || job.contentVersionId || null, published_at: metadata.sitePublishedAt || site.publishedAt || updatedAt, updated_at: updatedAt }
      };
      await this.notifyPublicationObserver(job);
    } catch (error) {
      job.results = {
        ...(job.results || {}),
        web: { state: "failed", code: String(error?.code || "WEB_PUBLISH_FAILED"), message: String(error?.message || "官网发布失败。"), remote_url: "", updated_at: updatedAt }
      };
    }
    return job.results.web;
  }

  async createJobs(body = {}, context = {}) {
    await this.load();
    const article = body.article || {};
    const rawPlatforms = [...new Set((body.platformOrder || body.platforms || []).map(canonicalPlatformId))];
    const unavailablePlatforms = rawPlatforms.filter((id) => platformById(id) && !selectablePlatformIds.has(id));
    if (unavailablePlatforms.length) {
      throw new PublisherError(
        `以下平台暂不支持创建发布任务：${unavailablePlatforms.map((id) => platformById(id)?.name || id).join("、")}`,
        422,
        "PUBLISHER_PLATFORM_UNAVAILABLE",
      );
    }
    const requestedPlatforms = rawPlatforms.filter((id) => selectablePlatformIds.has(id));
    const platforms = requestedPlatforms.filter((id) => id !== "web");
    if (!requestedPlatforms.length) throw new PublisherError("请至少选择一个可用的平台。", 422, "PUBLISHER_PLATFORM_REQUIRED");
    const requestedGroupId = String(body.accountGroupId || body.groupId || "").trim();
    let groupId = requestedGroupId || "";
    let syncedGroup = null;
    let syncedDevice = null;
    for (const device of this.state.devices) {
      const candidateId = scopedAccountGroupId(device.id, requestedGroupId || device.activeGroupId || "group-default");
      const group = cleanAccountGroups(device.accountGroups, device.id).find((item) => item.id === candidateId);
      if (group) {
        syncedDevice = device;
        syncedGroup = group;
        groupId = group.id;
        break;
      }
    }
    if (platforms.length && (!syncedDevice || !syncedGroup)) {
      throw new PublisherError(
        "账号组尚未由本地发布器同步，不能创建平台任务。请等待发布器完成一次心跳后重试。",
        409,
        "PUBLISHER_ACCOUNT_GROUP_SYNC_PENDING",
      );
    }
    if (platforms.length) {
      const capabilities = new Set((syncedDevice.capabilities || []).map(canonicalPlatformId));
      const unavailable = platforms.filter((platformId) => !capabilities.has(platformId) || !accountReadyForGroup(syncedDevice, syncedGroup, platformId));
      if (unavailable.length) {
      throw new PublisherError(
        `以下平台未在本地发布器完成登录或能力同步：${unavailable.map((id) => platformById(id)?.name || id).join("、")}`,
        409,
        "PUBLISHER_ACCOUNT_UNAVAILABLE",
        { platforms: unavailable },
      );
      }
    }
    const groupName = String(syncedGroup?.name || body.groupName || "默认账号组");
    const scheduled = body.mode === "scheduled";
    const webUrl = String(body.webUrl || article.siteUrl || "");
    const hasWeb = requestedPlatforms.includes("web");
    const job = {
      id: this.state.nextJobId++,
      articleId: String(body.articleId || article.id || ""),
      localArticleId: String(body.localArticleId || article.localArticleId || body.articleId || article.id || ""),
      articleTitle: String(body.articleTitle || article.title || "未命名文章"),
      version: String(body.version || article.version || "v1"),
      contentArticleId: String(body.contentArticleId || body.articleId || article.id || ""),
      contentVersionId: String(body.contentVersionId || body.versionId || "") || null,
      contentRevision: body.contentRevision === undefined || body.contentRevision === null || body.contentRevision === ""
        ? body.expectedRevision === undefined || body.expectedRevision === null || body.expectedRevision === "" ? null : Number(body.expectedRevision)
        : Number(body.contentRevision),
      account_group_id: groupId,
      group_id: groupId,
      group_name: groupName,
      platforms,
      workerPlatforms: platforms,
      workerPlatformOrder: platforms,
      targetPlatforms: requestedPlatforms,
      targetPlatformOrder: requestedPlatforms,
      payload: {
        article: {
          id: String(article.id || body.articleId || ""),
          localArticleId: String(body.localArticleId || article.localArticleId || body.articleId || article.id || ""),
          title: String(article.title || body.articleTitle || "未命名文章"),
          version: String(article.version || body.version || "v1"),
          excerpt: String(article.excerpt || ""),
          content: String(article.content || ""),
          meta_description: String(article.meta_description || article.excerpt || "")
        },
        account_group_id: groupId,
        group_id: groupId,
        interval_minutes: Math.max(5, Number(body.intervalMinutes || 60)),
        platform_policies: platformDetails(requestedPlatforms)
      },
      status: scheduled ? "scheduled" : platforms.length ? "queued" : hasWeb ? "publishing" : "success",
      createdAt: now(),
      updatedAt: now(),
      scheduledAt: body.scheduledAt || null,
      webUrl,
      webPublication: hasWeb ? {
        category: String(body.siteCategory || article.siteCategory || article.category || ""),
        metadata: {
          ...(body.siteMetadata && typeof body.siteMetadata === "object" ? body.siteMetadata : {}),
          siteSlug: String(body.siteSlug || article.siteSlug || ""),
          siteCategory: String(body.siteCategory || article.siteCategory || article.category || ""),
          siteCategoryId: String(body.siteCategoryId || article.siteCategoryId || ""),
          siteCategorySlug: String(body.siteCategorySlug || article.siteCategorySlug || ""),
          siteAuthor: String(body.siteAuthor || article.siteAuthor || article.author || ""),
          siteExcerpt: String(body.siteExcerpt || article.siteExcerpt || article.excerpt || "")
        },
        actor: context.actor ? { userId: context.actor.userId || context.actor.id || context.actor.user?.id || null } : null,
        requestMetadata: context.requestMetadata || null
      } : null,
      claimedBy: null,
      results: hasWeb ? { web: scheduled ? { state: "queued", message: "官网服务器发布已排期", remote_url: "" } : { state: "publishing", message: "正在发布到官网", remote_url: "", updated_at: now() } } : {}
    };
    this.state.jobs.push(job);
    await this.save();
    if (hasWeb && !scheduled) {
      await this.publishWebTarget(job);
      if (!platforms.length) job.status = job.results.web?.state === "published" ? "success" : "failed";
      job.updatedAt = now();
      await this.save();
    }
    return publicJob(job);
  }

  async cancelJob(id) {
    await this.load();
    const job = this.state.jobs.find((item) => Number(item.id) === Number(id));
    if (!job) throw new Error("发布任务不存在。");
    if (["running", "success", "published"].includes(job.status)) return publicJob(job);
    job.status = "cancelled";
    job.updatedAt = now();
    const results = { ...(job.results || {}) };
    for (const platformId of job.targetPlatforms || job.platforms || []) {
      if (["published", "success"].includes(results[platformId]?.state)) continue;
      results[platformId] = { ...(results[platformId] || {}), state: "cancelled", message: "未来排期已由后台取消", updated_at: now() };
    }
    job.results = results;
    await this.save();
    return publicJob(job);
  }

  async removeJob(id) {
    await this.load();
    const index = this.state.jobs.findIndex((item) => Number(item.id) === Number(id));
    if (index < 0) throw new PublisherError("发布任务不存在。", 404, "PUBLISHER_JOB_NOT_FOUND");
    const job = this.state.jobs[index];
    if (["running", "processing"].includes(job.status)) throw new PublisherError("正在执行的发布任务不能删除，请先等待完成或取消。", 409, "PUBLISHER_JOB_BUSY");
    this.state.jobs.splice(index, 1);
    await this.save();
    return { id: String(id), deleted: true };
  }

  async removeAccountGroup(id) {
    await this.load();
    const requestedId = String(id || "").trim();
    if (!requestedId) throw new PublisherError("账号组标识不能为空。", 422, "PUBLISHER_ACCOUNT_GROUP_ID_REQUIRED");
    for (const device of this.state.devices) {
      const groups = cleanAccountGroups(device.accountGroups, device.id);
      const group = groups.find((item) => item.id === requestedId
        || scopedAccountGroupId(device.id, requestedId) === item.id);
      if (!group) continue;
      const isDefault = group.id === defaultAccountGroupId(device.id);
      if (isDefault && groups.length <= 1) {
        throw new PublisherError("默认账号组不能删除，请先在本地发布器中新增其他账号组。", 409, "PUBLISHER_DEFAULT_ACCOUNT_GROUP_REQUIRED");
      }
      device.deletedAccountGroupIds = [...new Set([...(device.deletedAccountGroupIds || []), group.id])];
      device.accountGroups = groups.filter((item) => item.id !== group.id);
      device.sessions = Object.fromEntries(Object.entries(device.sessions || {}).filter(([, session]) => {
        const sessionGroup = scopedAccountGroupId(device.id, sessionGroupId(session));
        return sessionGroup !== group.id;
      }));
      if (device.activeGroupId === group.id) device.activeGroupId = device.accountGroups[0]?.id || defaultAccountGroupId(device.id);
      await this.save();
      return { id: group.id, deviceId: device.id, deleted: true };
    }
    throw new PublisherError("账号组不存在。", 404, "PUBLISHER_ACCOUNT_GROUP_NOT_FOUND");
  }

  async claimJob(device, id) {
    await this.load();
    const job = this.state.jobs.find((item) => Number(item.id) === Number(id));
    if (!job) throw new Error("发布任务不存在。");
    if (job.claimedBy && job.claimedBy !== device.id && job.status === "running") throw new Error("发布任务正在由其他发布器执行。");
    job.claimedBy = device.id;
    job.status = "running";
    job.updatedAt = now();
    await this.save();
    return publicJob(job, { forWorker: true });
  }

  async result(device, id, body = {}) {
    await this.load();
    const job = this.state.jobs.find((item) => Number(item.id) === Number(id));
    if (!job) throw new Error("发布任务不存在。");
    const workerPlatformIds = new Set((job.workerPlatforms || job.platforms || [])
      .map(canonicalPlatformId)
      .filter((platformId) => platformId && platformId !== "web"));
    if (!workerPlatformIds.size) {
      throw new PublisherError("官网任务不接受本地发布器回写。", 422, "PUBLISHER_WEB_ONLY_JOB");
    }
    job.claimedBy = device.id;
    const workerState = String(body.state || "result_unknown").trim().toLowerCase();
    const draftOnlyStates = new Set([
      "processing",
      "draft_saved",
      "partial_failed",
      "result_unknown",
      "awaiting_login",
      "cancelled",
      "failed"
    ]);
    if (["published", "success", "completed"].includes(workerState)) {
      throw new PublisherError("本地发布器仅允许回写草稿状态。", 422, "PUBLISHER_DRAFT_ONLY_STATE");
    }
    if (!draftOnlyStates.has(workerState)) {
      throw new PublisherError("本地发布器回写了未知状态。", 422, "PUBLISHER_UNKNOWN_STATE");
    }
    const incomingResults = body.platform_results || body.results;
    const workerResults = {};
    const ignoredPlatformIds = [];
    if (incomingResults && typeof incomingResults === "object" && !Array.isArray(incomingResults)) {
      for (const [rawPlatformId, rawResult] of Object.entries(incomingResults)) {
        const platformId = canonicalPlatformId(rawPlatformId);
        // The website is published by the server and is never worker-owned.
        if (!platformId || platformId === "web" || !workerPlatformIds.has(platformId)) {
          // `web` is intentionally server-owned; tolerate legacy clients
          // echoing it in their result map, but reject every other foreign
          // platform so a local checkbox can never redirect a task.
          if (platformId && platformId !== "web") ignoredPlatformIds.push(platformId);
          continue;
        }
        const result = rawResult && typeof rawResult === "object" && !Array.isArray(rawResult) ? { ...rawResult } : {};
        const platformState = String(result.state || "result_unknown").trim().toLowerCase();
        if (["published", "success", "completed"].includes(platformState)) {
          throw new PublisherError("本地发布器仅允许回写草稿状态。", 422, "PUBLISHER_DRAFT_ONLY_STATE", { platform: platformId, state: platformState });
        }
        if (!draftOnlyStates.has(platformState)) {
          throw new PublisherError("本地发布器回写了未知状态。", 422, "PUBLISHER_UNKNOWN_STATE", { platform: platformId, state: platformState });
        }
        if (platformState === "draft_saved") {
          const verifiableReceipt = String(
            result.post_id || result.postId || result.draft_id || result.draftId
              || result.remote_url || result.remoteUrl || result.post_url || result.postUrl || ""
          ).trim();
          if (!verifiableReceipt) {
            throw new PublisherError(
              `平台 ${platformById(platformId)?.name || platformId} 未返回可核验的草稿 ID 或链接。`,
              422,
              "PUBLISHER_DRAFT_RECEIPT_UNVERIFIABLE",
              { platform: platformId }
            );
          }
        }
        workerResults[platformId] = { ...result, state: platformState };
      }
    }
    const acceptedPlatformIds = Object.keys(workerResults);
    if (ignoredPlatformIds.length) {
      throw new PublisherError(
        `发布器回写了未分配的平台：${[...new Set(ignoredPlatformIds)].map((platformId) => platformById(platformId)?.name || platformId).join("、")}。`,
        422,
        "PUBLISHER_RESULT_PLATFORM_UNAUTHORIZED",
        { accepted_platforms: acceptedPlatformIds, ignored_platforms: [...new Set(ignoredPlatformIds)] }
      );
    }
    const missingPlatformIds = [...workerPlatformIds].filter((platformId) => !acceptedPlatformIds.includes(platformId));
    if (missingPlatformIds.length) {
      throw new PublisherError(
        `发布器回执缺少后台分配的平台：${missingPlatformIds.map((platformId) => platformById(platformId)?.name || platformId).join("、")}。`,
        422,
        "PUBLISHER_RESULT_MISSING",
        { accepted_platforms: acceptedPlatformIds, ignored_platforms: ignoredPlatformIds, missing_platforms: missingPlatformIds }
      );
    }
    job.results = { ...(job.results || {}), ...workerResults };
    const webFailed = (job.targetPlatforms || []).includes("web") && job.results?.web?.state === "failed";
    job.status = webFailed && workerState === "draft_saved" ? "partial_failed" : workerState;
    job.message = String(body.message || "");
    job.stateSummary = body.state_summary || {};
    job.updatedAt = now();
    await this.save();
    await this.notifyPublicationObserver(job);
    return {
      ...publicJob(job),
      result_receipt: {
        accepted_platforms: acceptedPlatformIds,
        ignored_platforms: [...new Set(ignoredPlatformIds)],
        missing_platforms: []
      }
    };
  }

  // Verify a worker-created draft against a publicly reachable URL.  The
  // desktop publisher is intentionally draft-only; only this server-side
  // check may promote a target to published, and only when the public page
  // responds successfully and contains the assigned article title.
  async verifyJob(id, platformId = "", options = {}) {
    await this.load();
    const job = this.state.jobs.find((item) => Number(item.id) === Number(id));
    if (!job) throw new PublisherError("发布任务不存在。", 404, "PUBLISHER_JOB_NOT_FOUND");
    const canonical = canonicalPlatformId(platformId);
    const targetPlatforms = (job.targetPlatforms || job.platforms || []).map(canonicalPlatformId);
    if (!canonical || !targetPlatforms.includes(canonical)) {
      throw new PublisherError("该平台不是当前任务的目标平台。", 422, "PUBLISHER_PLATFORM_NOT_TARGET");
    }
    const current = { ...(job.results?.[canonical] || {}) };
    const currentState = String(current.state || "").toLowerCase();
    // The local browser can observe a platform's explicit success toast even
    // when the platform does not expose a public URL immediately (Weibo is a
    // common example). Accept only that narrowly-scoped evidence marker from
    // the paired publisher, never a generic client-side status toggle.
    if (options?.observed === true && options?.evidence === "platform_success_ui") {
      current.state = "published";
      current.verified = true;
      current.verified_at = now();
      if (options.publicUrl) current.remote_url = String(options.publicUrl);
      current.message = "检测到平台发布成功提示，已更新为已发布。";
      job.results = { ...(job.results || {}), [canonical]: current };
      const states = Object.values(job.results || {}).map((item) => String(item?.state || "").toLowerCase());
      job.status = states.length && states.every((state) => ["published", "success", "completed"].includes(state)) ? "success" : "partial_failed";
      job.updatedAt = now();
      await this.save();
      await this.notifyPublicationObserver(job);
      return { job: publicJob(job), platform: canonical, result: current, verified: true };
    }
    if (canonical === "web" && ["published", "success", "completed"].includes(currentState)) {
      return { job: publicJob(job), platform: canonical, result: { ...current, state: "published", verified: true } };
    }
    if (["published", "success", "completed"].includes(currentState) && current.verified === true) {
      return { job: publicJob(job), platform: canonical, result: current };
    }
    const candidate = String(current.public_url || current.publicUrl || current.remote_url || current.remoteUrl || "").trim();
    const title = String(job.articleTitle || job.payload?.article?.title || "").trim();
    const unsupportedEditor = !candidate || /(?:mp\.|creator\.|i\.cnblogs\.|draft|edit|publish)/i.test(candidate);
    if (unsupportedEditor) {
      current.state = currentState === "draft_saved" ? "draft_saved" : "result_unknown";
      current.message = "已检查任务回执；当前链接是平台草稿/编辑地址，无法证明已公开发布。请完成平台发布后再次检查。";
      current.checked_at = now();
      job.results = { ...(job.results || {}), [canonical]: current };
      job.updatedAt = now();
      await this.save();
      return { job: publicJob(job), platform: canonical, result: current, verified: false, reason: "editor_url" };
    }
    let response = null;
    let body = "";
    try {
      response = await fetch(candidate, { redirect: "follow", signal: AbortSignal.timeout(10000), headers: { "User-Agent": "TongzhuoPublisherVerifier/1.0" } });
      body = await response.text();
    } catch (error) {
      current.state = currentState === "draft_saved" ? "draft_saved" : "result_unknown";
      current.message = `暂时无法访问公开地址，未将任务标记为已发布：${error.message || "网络请求失败"}`;
      current.checked_at = now();
      job.results = { ...(job.results || {}), [canonical]: current };
      job.updatedAt = now();
      await this.save();
      return { job: publicJob(job), platform: canonical, result: current, verified: false, reason: "network" };
    }
    const finalUrl = String(response.url || candidate);
    const titleMatch = !title || body.toLowerCase().includes(title.slice(0, 40).toLowerCase());
    const isPublic = response.ok && titleMatch && !/login|signin|passport|draft|editor/i.test(finalUrl);
    if (isPublic) {
      current.state = "published";
      current.verified = true;
      current.verified_at = now();
      current.remote_url = finalUrl;
      current.message = "已检测到公开页面，确认文章已发布。";
      job.results = { ...(job.results || {}), [canonical]: current };
      const states = Object.values(job.results || {}).map((item) => String(item?.state || "").toLowerCase());
      job.status = states.length && states.every((state) => ["published", "success", "completed"].includes(state)) ? "success" : "partial_failed";
      job.updatedAt = now();
      await this.save();
      await this.notifyPublicationObserver(job);
      return { job: publicJob(job), platform: canonical, result: current, verified: true };
    }
    current.state = currentState === "draft_saved" ? "draft_saved" : "result_unknown";
    current.message = "未检测到与文章标题匹配的公开页面，仍按未发布处理。";
    current.checked_at = now();
    job.results = { ...(job.results || {}), [canonical]: current };
    job.updatedAt = now();
    await this.save();
    return { job: publicJob(job), platform: canonical, result: current, verified: false, reason: "not_public" };
  }

  async overview() {
    await this.load();
    await this.processDueJobs();
    const devices = this.state.devices.map(publicDevice);
    const accountGroups = devices.flatMap((device) => device.accountGroups.map((group) => ({ ...group, deviceId: device.id, deviceName: device.name })));
    return {
      platforms: this.platforms(),
      devices,
      accountGroups,
      sessions: devices.flatMap((device) => (device.sessions || []).filter((session) =>
        PUBLISHER_PLATFORMS.some((item) => item.id === canonicalPlatformId(session?.platform_id))).map((session) => ({
        ...session,
        device_id: device.id,
        device_name: device.name
      }))),
      jobs: this.state.jobs.map(publicJob),
      readyPlatformIds: [...readyPlatformIds],
      selectablePlatformIds: [...selectablePlatformIds],
      manualConfirmationPlatformIds: [...manualConfirmationPlatformIds]
    };
  }
}

export const publisherStore = new PublisherStore();
