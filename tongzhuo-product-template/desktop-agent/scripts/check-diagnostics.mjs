import assert from 'node:assert/strict';
import { buildLocalDiagnostics, buildSupportBundle, sanitizeStatus } from '../src/diagnostics.js';
import { platforms } from '../src/platforms.js';

const healthy = buildLocalDiagnostics({
  geoflowBaseUrl: 'https://flow.example.com',
  hasToken: true,
  deviceId: 'tz-device-test',
  port: 19380,
  capabilities: ['zhihu', 'wechat_mp', 'toutiao', 'zip-download'],
  lastHeartbeatAt: new Date().toISOString(),
}, platforms);

assert.equal(healthy.summary, 'ok');
assert.equal(healthy.checks.find((item) => item.id === 'capabilities').state, 'ok');

const broken = buildLocalDiagnostics({
  geoflowBaseUrl: 'flow.example.com',
  hasToken: false,
  capabilities: [],
}, platforms);

assert.equal(broken.summary, 'error');
assert.equal(broken.checks.find((item) => item.id === 'geoflow_url').state, 'error');
assert.equal(broken.checks.find((item) => item.id === 'api_token').state, 'warn');

const sanitized = sanitizeStatus({
  geoflowBaseUrl: 'https://flow.example.com/',
  hasToken: true,
  apiToken: 'must-not-leak',
  jobs: [{ id: 1 }],
  logs: [{ message: 'debug' }],
});
assert.equal(sanitized.geoflowBaseUrl, 'https://flow.example.com');
assert.equal(sanitized.hasToken, true);
assert.equal('apiToken' in sanitized, false);
assert.equal(sanitized.jobCount, 1);
assert.equal('logs' in sanitized, false);

const bundle = buildSupportBundle({
  ...sanitized,
  logs: [{
    at: '2026-01-01T00:00:00.000Z',
    level: 'info',
    event: 'test',
    message: 'ok',
    context: {
      token: 'not-a-real-token',
      nested: { cookie: 'cookie-value', ok: true },
      remote_url: 'https://example.test/x?token=abc&safe=1#secret',
    },
  }],
}, healthy, platforms);
assert.equal(bundle.security.excludesApiToken, true);
assert.equal(bundle.status.hasToken, true);
assert.equal('apiToken' in bundle.status, false);
assert.ok(Array.isArray(bundle.logs));
assert.equal(bundle.logs[0].context.token, '[redacted]');
assert.equal(bundle.logs[0].context.nested.cookie, '[redacted]');
assert.equal(bundle.logs[0].context.nested.ok, true);
assert.equal(bundle.logs[0].context.remote_url.includes('token=abc'), false);
assert.equal(bundle.logs[0].context.remote_url.includes('safe=1'), true);
assert.equal(bundle.logs[0].context.remote_url.includes('#'), false);

console.log('Diagnostics behavior passed.');
