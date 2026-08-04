import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const temporaryDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tongzhuo-agent-pairing-'));
const originalDataDir = process.env.TZ_AGENT_DATA_DIR;
const originalFetch = globalThis.fetch;
process.env.TZ_AGENT_DATA_DIR = temporaryDataDir;

try {
  const { readConfig, writeConfig } = await import('../src/config-store.js');
  writeConfig({
    geoflowBaseUrl: 'https://geo.example.com',
    connectionMode: 'paired',
    pairingToken: 'stale-pairing-token',
    pairedAt: '2026-07-01T00:00:00.000Z',
    accountGroups: [{
      id: 'group-default',
      name: '默认账号组',
      status: 'active',
      accounts: {
        baijiahao: {
          platformId: 'baijiahao',
          accountName: '测试账号',
          status: 'ready',
          profileKey: 'group-default--baijiahao',
        },
      },
    }],
  });

  const { TongzhuoDesktopAgent } = await import('../src/agent.js');
  const agent = new TongzhuoDesktopAgent();
  agent.sessions = [{ platform_id: 'baijiahao', login_state: 'ready' }];
  agent.jobs = [{ id: 1, status: 'queued' }];

  globalThis.fetch = async () => new Response(JSON.stringify({
    ok: false,
    code: 'PUBLISHER_AUTH_REQUIRED',
    message: '发布器尚未完成配对，请重新配对。',
  }), { status: 401, headers: { 'Content-Type': 'application/json' } });

  await assert.rejects(() => agent.heartbeat(), (error) => error.status === 401 && error.code === 'PUBLISHER_AUTH_REQUIRED');
  let status = agent.publicStatus();
  assert.equal(status.isPaired, false);
  assert.equal(status.hasCredential, false);
  assert.equal(status.sessions.length, 0);
  assert.equal(status.jobs.length, 0);
  assert.equal(status.accountGroups[0].accounts.baijiahao.status, 'unknown');
  assert.match(status.lastError, /重新生成配对码/);
  let stored = readConfig();
  assert.equal(stored.pairingToken, '');
  assert.equal(stored.apiToken, '');
  assert.equal(stored.pairedAt, '');
  assert.ok(stored.deviceSecret, 'stable local device identity should be retained for the next registration');

  agent.configure({
    connectionMode: 'paired',
    pairingToken: 'second-stale-token',
    pairedAt: '2026-07-02T00:00:00.000Z',
    accountGroups: [{ id: 'group-default', name: '默认账号组', status: 'active', accounts: {} }],
  });
  globalThis.fetch = async () => new Response(JSON.stringify({
    ok: false,
    code: 'PUBLISHER_DEVICE_NOT_FOUND',
    message: '发布器设备不存在。',
  }), { status: 404, headers: { 'Content-Type': 'application/json' } });
  await assert.rejects(() => agent.poll(), (error) => error.status === 404);
  status = agent.publicStatus();
  assert.equal(status.isPaired, false);
  assert.equal(status.hasCredential, false);
  assert.equal(status.sessions.length, 0);

  await agent.shutdown();
  console.log('Pairing invalidation behavior passed.');
} finally {
  globalThis.fetch = originalFetch;
  if (originalDataDir === undefined) delete process.env.TZ_AGENT_DATA_DIR;
  else process.env.TZ_AGENT_DATA_DIR = originalDataDir;
  fs.rmSync(temporaryDataDir, { recursive: true, force: true });
}
