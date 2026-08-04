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

export const configSchemaVersion = 2;
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
  capabilities: runnablePlatformIds,
  activeGroupId: 'group-default',
  accountGroups: [],
};

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
  let stored = {};

  try {
    stored = JSON.parse(fs.readFileSync(configPath, 'utf8').replace(/^\uFEFF/, ''));
  } catch {
    stored = {};
  }

  return normalizeConfig(stored);
}

export function writeConfig(next) {
  fs.mkdirSync(dataDir, { recursive: true });
  const cleaned = Object.fromEntries(Object.entries(next || {}).filter(([, value]) => value !== undefined));
  const config = normalizeConfig({ ...readConfig(), ...cleaned });
  const temporaryPath = `${configPath}.tmp`;
  fs.writeFileSync(temporaryPath, JSON.stringify(config, null, 2), 'utf8');
  fs.renameSync(temporaryPath, configPath);
  return config;
}
