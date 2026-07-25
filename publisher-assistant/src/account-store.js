import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const accountStates = new Set(['new', 'ready', 'attention', 'disabled']);

function now() {
  return new Date().toISOString();
}

function normalizeLabel(value, fallback) {
  const label = String(value || '').trim().replace(/\s+/g, ' ');
  return (label || fallback).slice(0, 48);
}

function publicAccount(account) {
  return {
    id: account.id,
    platformId: account.platformId,
    label: account.label,
    state: account.state,
    createdAt: account.createdAt,
    lastAuthorizedAt: account.lastAuthorizedAt || null,
    lastUsedAt: account.lastUsedAt || null,
    lastError: account.lastError || '',
  };
}

export function createAccountStore(filePath) {
  const directory = path.dirname(filePath);
  fs.mkdirSync(directory, { recursive: true });

  let accounts = [];
  try {
    const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
    const parsed = JSON.parse(raw);
    accounts = Array.isArray(parsed?.accounts) ? parsed.accounts : [];
  } catch {
    accounts = [];
  }

  function persist() {
    const temporaryPath = `${filePath}.tmp`;
    fs.writeFileSync(temporaryPath, JSON.stringify({ version: 1, accounts }, null, 2), 'utf8');
    fs.renameSync(temporaryPath, filePath);
  }

  function get(id) {
    return accounts.find((account) => account.id === String(id || '').trim()) || null;
  }

  function list() {
    return accounts
      .slice()
      .sort((left, right) => String(right.lastUsedAt || right.createdAt).localeCompare(String(left.lastUsedAt || left.createdAt)))
      .map(publicAccount);
  }

  function create({ platformId, label, platformName }) {
    const id = `acct_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const account = {
      id,
      profileKey: id,
      platformId: String(platformId || '').trim(),
      label: normalizeLabel(label, `${platformName || platformId} 账号`),
      state: 'new',
      createdAt: now(),
      lastAuthorizedAt: null,
      lastUsedAt: null,
      lastError: '',
    };
    accounts.push(account);
    persist();
    return account;
  }

  function update(id, patch = {}) {
    const account = get(id);
    if (!account) return null;
    if (patch.label !== undefined) account.label = normalizeLabel(patch.label, account.label);
    if (patch.state !== undefined) account.state = accountStates.has(patch.state) ? patch.state : account.state;
    if (patch.lastError !== undefined) account.lastError = String(patch.lastError || '').slice(0, 600);
    if (patch.lastAuthorizedAt !== undefined) account.lastAuthorizedAt = patch.lastAuthorizedAt;
    if (patch.lastUsedAt !== undefined) account.lastUsedAt = patch.lastUsedAt;
    persist();
    return account;
  }

  function readyForPlatform(platformId) {
    return accounts
      .filter((account) => account.platformId === platformId && account.state === 'ready')
      .sort((left, right) => String(right.lastUsedAt || right.lastAuthorizedAt || right.createdAt).localeCompare(String(left.lastUsedAt || left.lastAuthorizedAt || left.createdAt)))[0] || null;
  }

  return { get, list, create, update, readyForPlatform, publicAccount };
}
