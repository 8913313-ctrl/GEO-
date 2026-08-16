import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { dataDir } from './config-store.js';

const schemaVersion = 1;
const checkpointFilename = 'legacy-job-checkpoints.json';
const maximumEntries = 200;
const maximumAgeMs = 14 * 24 * 60 * 60 * 1000;
const terminalStates = new Set(['published', 'draft_saved']);

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function boundedText(value, length = 4096) {
  return String(value ?? '').trim().slice(0, length);
}

function checkpointUrl(value) {
  const text = boundedText(value, 4096);
  if (!text) return '';
  try {
    const url = new URL(text);
    // Editor URLs can carry one-time signatures, OAuth state or account ids.
    // A checkpoint needs only enough location context for diagnostics.
    url.search = '';
    url.hash = '';
    return boundedText(url.toString(), 4096);
  } catch {
    return boundedText(text.replace(/[?#].*$/, ''), 4096);
  }
}

function timeValue(value) {
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function scopeKey(config = {}) {
  const endpoint = boundedText(config.geoflowBaseUrl, 2048).replace(/\/+$/, '').toLowerCase();
  const deviceId = boundedText(config.deviceId, 256);
  return crypto.createHash('sha256').update(`${endpoint}\u0000${deviceId}`, 'utf8').digest('hex');
}

function checkpointKey(config, jobId) {
  return `${scopeKey(config)}:${boundedText(jobId, 128)}`;
}

function checkpointResult(result = {}) {
  const platform = boundedText(result.platform || result.platform_id || result.platformId, 128);
  const state = boundedText(result.state, 64).toLowerCase();
  if (!platform || !terminalStates.has(state)) return null;
  const stored = {
    platform,
    state,
  };
  const remoteUrl = checkpointUrl(result.remote_url || result.remoteUrl);
  if (remoteUrl) stored.remote_url = remoteUrl;
  for (const field of ['execution_mode', 'next_action']) {
    const value = boundedText(result[field], 256);
    if (value) stored[field] = value;
  }
  return stored;
}

function normalizeStore(value, now) {
  const source = asObject(value);
  const checkpoints = {};
  for (const [key, value] of Object.entries(asObject(source.checkpoints))) {
    const entry = asObject(value);
    const updatedAt = timeValue(entry.updated_at);
    if (!updatedAt || updatedAt < now - maximumAgeMs) continue;
    const jobId = boundedText(entry.job_id, 128);
    const scope = boundedText(entry.scope, 128);
    if (!jobId || !scope) continue;
    const platformResults = {};
    for (const [platformId, result] of Object.entries(asObject(entry.platform_results))) {
      const normalized = checkpointResult({ ...asObject(result), platform: platformId });
      if (normalized) platformResults[normalized.platform] = normalized;
    }
    if (!Object.keys(platformResults).length) continue;
    checkpoints[key] = {
      scope,
      job_id: jobId,
      updated_at: new Date(updatedAt).toISOString(),
      platform_results: platformResults,
    };
  }
  const retained = Object.entries(checkpoints)
    .sort(([, left], [, right]) => timeValue(right.updated_at) - timeValue(left.updated_at))
    .slice(0, maximumEntries);
  return { schema_version: schemaVersion, checkpoints: Object.fromEntries(retained) };
}

/**
 * Persists only already-successful V1 aggregate-job platform outcomes. V2
 * platform jobs have server leases and are intentionally not stored here.
 * Keeping this compact file separate from configuration avoids repeatedly
 * rewriting credentials while a multi-platform legacy job is in progress.
 */
export class LegacyJobCheckpointStore {
  constructor(options = {}) {
    this.directory = path.resolve(options.directory || dataDir);
    this.now = typeof options.now === 'function' ? options.now : () => Date.now();
  }

  get filePath() {
    return path.join(this.directory, checkpointFilename);
  }

  read() {
    if (!fs.existsSync(this.filePath)) return { schema_version: schemaVersion, checkpoints: {} };
    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8').replace(/^\uFEFF/, ''));
    } catch (error) {
      throw new Error(`Unable to read legacy job checkpoints: ${error.message}`);
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Unable to read legacy job checkpoints: root value must be an object');
    }
    return normalizeStore(parsed, this.now());
  }

  write(store) {
    fs.mkdirSync(this.directory, { recursive: true });
    const temporaryPath = `${this.filePath}.tmp-${process.pid}-${crypto.randomBytes(6).toString('hex')}`;
    fs.writeFileSync(temporaryPath, JSON.stringify(normalizeStore(store, this.now()), null, 2), { encoding: 'utf8', mode: 0o600 });
    try {
      fs.renameSync(temporaryPath, this.filePath);
    } catch (error) {
      fs.rmSync(temporaryPath, { force: true });
      throw error;
    }
  }

  completed(config, jobId, targetPlatforms = []) {
    const store = this.read();
    const entry = store.checkpoints[checkpointKey(config, jobId)];
    if (!entry) return {};
    const target = new Set((Array.isArray(targetPlatforms) ? targetPlatforms : []).map((item) => boundedText(item, 128)));
    return Object.fromEntries(Object.entries(entry.platform_results)
      .filter(([platformId, result]) => (!target.size || target.has(platformId)) && terminalStates.has(String(result.state || '').toLowerCase()))
      .map(([platformId, result]) => [platformId, { platform: platformId, ...result }]));
  }

  record(config, jobId, result) {
    const normalized = checkpointResult(result);
    if (!normalized) return false;
    const store = this.read();
    const key = checkpointKey(config, jobId);
    const scope = scopeKey(config);
    const previous = asObject(store.checkpoints[key]);
    const platformResults = {
      ...asObject(previous.platform_results),
      [normalized.platform]: normalized,
    };
    store.checkpoints[key] = {
      scope,
      job_id: boundedText(jobId, 128),
      updated_at: new Date(this.now()).toISOString(),
      platform_results: platformResults,
    };
    this.write(store);
    return true;
  }

  clear(config, jobId) {
    const store = this.read();
    const key = checkpointKey(config, jobId);
    if (!store.checkpoints[key]) return false;
    delete store.checkpoints[key];
    this.write(store);
    return true;
  }
}

export const legacyJobCheckpointStates = terminalStates;
