import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runnablePlatformIds } from './platforms.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const rootDir = path.resolve(__dirname, '..');
export const dataDir = path.resolve(process.env.TZ_AGENT_DATA_DIR || path.join(rootDir, '.data'));
const configPath = path.join(dataDir, 'config.json');

// Schema v3 stores credentials as field-scoped AES-256-GCM envelopes. The
// envelope is versioned so migrations stay explicit and fail safely.
export const configSchemaVersion = 3;
const sensitiveFields = Object.freeze(['apiToken', 'pairingToken', 'deviceSecret', 'pairingCode']);
const encryptionAlgorithm = 'aes-256-gcm';
const encryptionVersion = 1;
const developmentMasterKey = crypto.createHash('sha256')
  .update('tongzhuo-geo-desktop-agent-development-key-v3', 'utf8')
  .digest();
let warnedAboutDevelopmentKey = false;
// New installations must be explicitly paired with their own GEOFlow server.
// Existing local config values are preserved by normalizeConfig below.
export const defaultGeoFlowBaseUrl = 'https://geoflow.local';
const legacyManagedBaseUrls = new Set([
  'http://127.0.0.1:43127',
  'http://localhost:43127',
]);

function environmentGeoFlowBaseUrl() {
  return String(process.env.GEOFLOW_BASE_URL || '').trim().replace(/\/+$/, '');
}

const defaults = {
  schemaVersion: configSchemaVersion,
  geoflowBaseUrl: defaultGeoFlowBaseUrl,
  apiToken: '',
  pairingToken: '',
  connectionMode: 'token',
  deviceId: '',
  deviceName: '',
  deviceSecret: '',
  pairedAt: '',
  pairingCode: '',
  port: 18280,
  pollSeconds: 20,
  loginCheckSeconds: 300,
  autoRun: false,
  maxJobAttempts: 2,
  desiredStateVersion: 0,
  appliedStateVersion: 0,
  localOverride: false,
  enabledPlatforms: [],
  platformPolicy: {},
  publishPolicy: { maxConcurrentGroups: 2 },
  publishPolicyState: {},
  capabilities: runnablePlatformIds,
  activeGroupId: 'group-default',
  accountGroups: [],
};

function isEncryptedEnvelope(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value)
    && value.v === encryptionVersion
    && value.alg === encryptionAlgorithm
    && typeof value.iv === 'string'
    && typeof value.tag === 'string'
    && typeof value.ciphertext === 'string');
}

function decodeMasterKey(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  if (/^[0-9a-f]{64}$/i.test(text)) return Buffer.from(text, 'hex');
  for (const encoding of ['base64', 'base64url']) {
    try {
      const decoded = Buffer.from(text, encoding);
      if (decoded.length === 32) return decoded;
    } catch {
      // Try the next accepted encoding.
    }
  }
  throw new Error('TZ_AGENT_MASTER_KEY must be a 32-byte base64 or 64-character hex key');
}

function masterKey({ encrypted = false } = {}) {
  const configured = process.env.TZ_AGENT_MASTER_KEY;
  if (configured) return decodeMasterKey(configured);

  // Direct `node` runs are retained for deterministic repository checks.
  // Electron always sets ELECTRON_RUN_AS_NODE and injects a DPAPI-backed key,
  // so a packaged installation can never use this development-only key.
  const runtimeEnvironment = String(process.env.NODE_ENV || '').toLowerCase();
  const allowDevelopment = process.env.TZ_AGENT_ALLOW_INSECURE_DEV_KEY === '1'
    && ['test', 'development'].includes(runtimeEnvironment);
  if (allowDevelopment) {
    if (!warnedAboutDevelopmentKey) {
      warnedAboutDevelopmentKey = true;
      console.warn('[config] no TZ_AGENT_MASTER_KEY; using the development-only key (do not use in production)');
    }
    return developmentMasterKey;
  }
  if (encrypted) {
    throw new Error('Encrypted configuration requires TZ_AGENT_MASTER_KEY; refusing to continue with unreadable credentials');
  }
  throw new Error('TZ_AGENT_MASTER_KEY is required for production configuration storage');
}

function encryptField(field, value, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(encryptionAlgorithm, key, iv);
  cipher.setAAD(Buffer.from(`tongzhuo-config:${field}`, 'utf8'));
  const ciphertext = Buffer.concat([cipher.update(String(value ?? ''), 'utf8'), cipher.final()]);
  return {
    v: encryptionVersion,
    alg: encryptionAlgorithm,
    iv: iv.toString('base64url'),
    tag: cipher.getAuthTag().toString('base64url'),
    ciphertext: ciphertext.toString('base64url'),
  };
}

function decryptField(field, envelope, key) {
  if (!isEncryptedEnvelope(envelope)) {
    throw new Error(`Invalid encrypted configuration envelope for ${field}`);
  }
  try {
    const iv = Buffer.from(envelope.iv, 'base64url');
    const tag = Buffer.from(envelope.tag, 'base64url');
    const ciphertext = Buffer.from(envelope.ciphertext, 'base64url');
    if (iv.length !== 12 || tag.length !== 16) throw new Error('invalid AES-GCM envelope lengths');
    const decipher = crypto.createDecipheriv(encryptionAlgorithm, key, iv);
    decipher.setAAD(Buffer.from(`tongzhuo-config:${field}`, 'utf8'));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch (error) {
    throw new Error(`Unable to decrypt configuration field ${field}: ${error.message}`);
  }
}

function decodeStoredConfig(stored) {
  const decoded = { ...stored };
  const encryptedFields = sensitiveFields.filter((field) => isEncryptedEnvelope(stored?.[field]));
  const invalidStructuredFields = sensitiveFields.filter((field) => {
    const value = stored?.[field];
    return value && typeof value === 'object' && !isEncryptedEnvelope(value);
  });
  if (invalidStructuredFields.length) {
    throw new Error(`Invalid encrypted configuration: ${invalidStructuredFields.join(', ')}`);
  }
  if (!encryptedFields.length) return { decoded, encrypted: false };
  const key = masterKey({ encrypted: true });
  encryptedFields.forEach((field) => {
    decoded[field] = decryptField(field, stored[field], key);
  });
  return { decoded, encrypted: true };
}

function encodeStoredConfig(config) {
  const stored = { ...config, schemaVersion: configSchemaVersion };
  const key = masterKey();
  sensitiveFields.forEach((field) => {
    stored[field] = encryptField(field, config[field] || '', key);
  });
  return stored;
}

function atomicWriteConfig(config) {
  const temporaryPath = `${configPath}.tmp-${process.pid}`;
  fs.writeFileSync(temporaryPath, JSON.stringify(encodeStoredConfig(config), null, 2), { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(temporaryPath, configPath);
}

function normalizePendingSession(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const meta = value.meta && typeof value.meta === 'object' && !Array.isArray(value.meta)
    ? value.meta
    : {};
  return {
    profile_key: String(value.profile_key || '').trim(),
    account_name: String(value.account_name || '').trim(),
    login_state: String(value.login_state || 'unknown').trim(),
    last_verified_at: value.last_verified_at ? String(value.last_verified_at).trim() : null,
    last_error_message: String(value.last_error_message || '').trim(),
    auto_allowed: Boolean(value.auto_allowed),
    meta,
  };
}

function normalizeAccountGroups(value) {
  const source = Array.isArray(value) ? value : [];
  const groups = source.map((group, index) => {
    const id = String(group?.id || `group-${index + 1}`).trim();
    const name = String(group?.name || `账号组 ${index + 1}`).trim();
    const accounts = {};
    Object.entries(group?.accounts || {}).forEach(([platformId, account]) => {
      const platform = String(platformId || '').trim();
      if (!platform) return;
      accounts[platform] = {
        platformId: platform,
        accountName: String(account?.accountName || account?.name || '').trim(),
        status: String(account?.status || 'needs_login').trim(),
        profileKey: String(account?.profileKey || `${id}--${platform}`).trim(),
        lastErrorMessage: String(account?.lastErrorMessage || '').trim(),
        lastVerifiedAt: String(account?.lastVerifiedAt || '').trim(),
        syncState: String(account?.syncState || '').trim(),
        lastSyncedAt: String(account?.lastSyncedAt || '').trim(),
        lastSyncError: String(account?.lastSyncError || '').trim(),
        pendingSession: normalizePendingSession(account?.pendingSession),
        updatedAt: String(account?.updatedAt || '').trim(),
      };
    });
    return {
      id,
      name,
      status: group?.status === 'disabled' ? 'disabled' : 'active',
      accounts,
      createdAt: String(group?.createdAt || '').trim(),
      updatedAt: String(group?.updatedAt || '').trim(),
    };
  }).filter((group) => group.id && group.name);

  return groups.length ? groups : [{
    id: 'group-default',
    name: '默认账号组',
    status: 'active',
    accounts: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }];
}

function stableDeviceId() {
  const source = `${os.hostname()}-${os.userInfo().username}-${os.platform()}`;
  return `tz-device-${crypto.createHash('sha256').update(source).digest('hex').slice(0, 16)}`;
}

function stableDeviceSecret() {
  return `tz-secret-${crypto.randomBytes(16).toString('hex')}`;
}

function normalizeInteger(value, fallback, min, max) {
  const number = Number.parseInt(String(value), 10);
  if (!Number.isFinite(number)) return fallback;
  if (typeof min === 'number' && number < min) return min;
  if (typeof max === 'number' && number > max) return max;
  return number;
}

function normalizeCapabilities(value) {
  const list = Array.isArray(value) ? value : defaults.capabilities;
  const allowed = new Set(runnablePlatformIds);
  const selected = list.map((item) => String(item || '').trim()).filter((item) => item && allowed.has(item));

  // Existing installations stored only the first three dedicated adapters.
  // Merge the current direct-execution catalog so the next heartbeat advertises
  // every locally connected platform without retaining a manual-only tier.
  return [...new Set([...defaults.capabilities, ...selected])];
}

function normalizeConfig(raw = {}) {
  const merged = { ...defaults, ...raw };
  const configuredByEnvironment = environmentGeoFlowBaseUrl();
  const storedBaseUrl = String(raw.geoflowBaseUrl || '').trim().replace(/\/+$/, '');
  const storedSchemaVersion = Number(raw.schemaVersion || 0);
  merged.schemaVersion = configSchemaVersion;
  merged.geoflowBaseUrl = configuredByEnvironment
    || (storedSchemaVersion < configSchemaVersion && legacyManagedBaseUrls.has(storedBaseUrl)
      ? defaultGeoFlowBaseUrl
      : storedBaseUrl || defaultGeoFlowBaseUrl);
  merged.apiToken = String(merged.apiToken || '').trim();
  merged.pairingToken = String(merged.pairingToken || '').trim();
  merged.deviceId = String(merged.deviceId || '').trim() || stableDeviceId();
  merged.deviceName = String(merged.deviceName || '').trim() || `${os.hostname()} 发布节点`;
  merged.deviceSecret = String(merged.deviceSecret || '').trim() || stableDeviceSecret();
  merged.pairedAt = String(merged.pairedAt || '').trim();
  merged.pairingCode = String(merged.pairingCode || '').trim();
  merged.connectionMode = merged.connectionMode === 'paired' || merged.pairingToken || merged.pairedAt ? 'paired' : 'token';
  const runtimePort = process.env.TZ_AGENT_PORT ? Number(process.env.TZ_AGENT_PORT) : merged.port;
  merged.port = normalizeInteger(runtimePort, defaults.port, 1, 65535);
  merged.pollSeconds = normalizeInteger(merged.pollSeconds, defaults.pollSeconds, 10, 3600);
  merged.loginCheckSeconds = normalizeInteger(merged.loginCheckSeconds, defaults.loginCheckSeconds, 60, 3600);
  merged.maxJobAttempts = normalizeInteger(merged.maxJobAttempts, defaults.maxJobAttempts, 1, 10);
  merged.autoRun = Boolean(merged.autoRun);
  merged.publishPolicy = merged.publishPolicy && typeof merged.publishPolicy === 'object' && !Array.isArray(merged.publishPolicy)
    ? { ...defaults.publishPolicy, ...merged.publishPolicy }
    : { ...defaults.publishPolicy };
  merged.publishPolicy.maxConcurrentGroups = normalizeInteger(merged.publishPolicy.maxConcurrentGroups, defaults.publishPolicy.maxConcurrentGroups, 1, 8);
  merged.platformPolicy = merged.platformPolicy && typeof merged.platformPolicy === 'object' && !Array.isArray(merged.platformPolicy)
    ? merged.platformPolicy
    : {};
  merged.publishPolicyState = merged.publishPolicyState && typeof merged.publishPolicyState === 'object' && !Array.isArray(merged.publishPolicyState)
    ? merged.publishPolicyState
    : {};
  merged.enabledPlatforms = Array.isArray(merged.enabledPlatforms)
    ? [...new Set(merged.enabledPlatforms.map((id) => String(id || '').trim()).filter(Boolean))]
    : [];
  merged.desiredStateVersion = normalizeInteger(merged.desiredStateVersion, 0, 0, Number.MAX_SAFE_INTEGER);
  merged.appliedStateVersion = normalizeInteger(merged.appliedStateVersion, 0, 0, Number.MAX_SAFE_INTEGER);
  merged.localOverride = Boolean(merged.localOverride);
  merged.capabilities = normalizeCapabilities(merged.capabilities);
  merged.accountGroups = normalizeAccountGroups(merged.accountGroups);
  const groupIds = new Set(merged.accountGroups.map((group) => group.id));
  merged.activeGroupId = groupIds.has(String(merged.activeGroupId || ''))
    ? String(merged.activeGroupId)
    : merged.accountGroups[0].id;
  return merged;
}

export function readConfig() {
  fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(configPath)) return normalizeConfig({});
  let stored;
  try {
    stored = JSON.parse(fs.readFileSync(configPath, 'utf8').replace(/^\uFEFF/, ''));
  } catch (error) {
    throw new Error(`Unable to read configuration: ${error.message}`);
  }
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) {
    throw new Error('Unable to read configuration: root value must be an object');
  }
  const { decoded, encrypted } = decodeStoredConfig(stored);
  const config = normalizeConfig(decoded);
  const requiresMigration = !encrypted || Number(stored.schemaVersion || 0) < configSchemaVersion || sensitiveFields.some((field) => !isEncryptedEnvelope(stored[field]));
  if (requiresMigration) atomicWriteConfig(config);
  return config;
}

export function writeConfig(next) {
  fs.mkdirSync(dataDir, { recursive: true });
  const cleaned = Object.fromEntries(Object.entries(next || {}).filter(([, value]) => value !== undefined));
  const config = normalizeConfig({ ...readConfig(), ...cleaned });
  atomicWriteConfig(config);
  return config;
}
