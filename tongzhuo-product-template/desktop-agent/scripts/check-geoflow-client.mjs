import assert from 'node:assert/strict';
import { TongzhuoDesktopAgent } from '../src/agent.js';
import { GeoFlowClient } from '../src/geoflow-client.js';

const originalFetch = globalThis.fetch;
const config = {
  geoflowBaseUrl: 'https://flow.example.test',
  pairingToken: 'test-token',
  deviceId: 'device-test',
  connectionMode: 'paired',
  requestTimeoutMs: 25,
  requestRetryCount: 2,
  capabilities: [],
  accountGroups: [],
};
const client = new GeoFlowClient(config);

function response(status, body = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  };
}

try {
  {
    let calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      if (calls === 1) throw new TypeError('socket reset');
      return response(200, { ok: true });
    };
    const result = await client.request('/recover-network', { retries: 2, retryBaseDelayMs: 0 });
    assert.deepEqual(result, { ok: true });
    assert.equal(calls, 2, 'safe GET requests should retry transient network failures');
  }

  {
    let calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      return calls === 1
        ? response(503, { message: 'temporarily unavailable' })
        : response(200, { recovered: true });
    };
    assert.deepEqual(await client.request('/recover-503', { retries: 1, retryBaseDelayMs: 0 }), { recovered: true });
    assert.equal(calls, 2, 'HTTP 5xx responses should be retried');
  }

  {
    let calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      return response(401, { code: 'TOKEN_REJECTED', message: 'unauthorized' });
    };
    await assert.rejects(
      client.request('/auth-failure', { retries: 5, retryBaseDelayMs: 0 }),
      (error) => error.status === 401 && error.code === 'TOKEN_REJECTED',
    );
    assert.equal(calls, 1, 'authentication failures must not be retried');
  }

  {
    let calls = 0;
    globalThis.fetch = () => {
      calls += 1;
      return new Promise(() => {});
    };
    await assert.rejects(
      client.request('/timeout', { timeoutMs: 5, retries: 1, retryBaseDelayMs: 0 }),
      (error) => error.code === 'PUBLISHER_REQUEST_TIMEOUT',
    );
    assert.equal(calls, 2, 'timed out safe requests should stop after the configured retry limit');
  }

  {
    let calls = 0;
    globalThis.fetch = () => {
      calls += 1;
      return new Promise(() => {});
    };
    const controller = new AbortController();
    const pending = client.request('/cancel', {
      signal: controller.signal,
      timeoutMs: 1000,
      retries: 5,
      retryBaseDelayMs: 0,
    });
    controller.abort();
    await assert.rejects(pending, (error) => error.code === 'PUBLISHER_REQUEST_ABORTED');
    assert.equal(calls, 1, 'explicit cancellation must never be retried');
  }

  {
    let calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      throw new TypeError('write connection failed');
    };
    await assert.rejects(client.request('/unsafe-write', {
      method: 'POST',
      body: { value: 1 },
      retries: 5,
      retryBaseDelayMs: 0,
    }), (error) => error.code === 'PUBLISHER_NETWORK_ERROR');
    assert.equal(calls, 1, 'unsafe writes require an explicit retryUnsafe opt-in');
  }

  {
    const scheduler = Object.create(TongzhuoDesktopAgent.prototype);
    scheduler.pollInFlight = null;
    globalThis.fetch = () => new Promise(() => {});
    scheduler.pollOnce = () => client.request('/poll-timeout', { timeoutMs: 5, retries: 0 });
    await assert.rejects(scheduler.poll(), (error) => error.code === 'PUBLISHER_REQUEST_TIMEOUT');
    assert.equal(scheduler.pollInFlight, null, 'a timeout must release the poll single-flight guard');

    globalThis.fetch = async () => response(200, { jobs: [] });
    scheduler.pollOnce = () => client.request('/poll-recovered', { timeoutMs: 50, retries: 0 });
    assert.deepEqual(await scheduler.poll(), { jobs: [] });
    assert.equal(scheduler.pollInFlight, null);
  }

  {
    const crashEnvironment = {
      count: process.env.TZ_AGENT_CRASH_COUNT,
      timestamps: process.env.TZ_AGENT_CRASH_TIMESTAMPS,
      window: process.env.TZ_AGENT_CRASH_WINDOW_SECONDS,
    };
    const now = Date.now();
    try {
      process.env.TZ_AGENT_CRASH_COUNT = '9';
      process.env.TZ_AGENT_CRASH_WINDOW_SECONDS = '300';
      process.env.TZ_AGENT_CRASH_TIMESTAMPS = [now - 1000, now - 301000].join(',');
      const meta = client.meta();
      assert.equal(meta.crash_count_last_window, 1,
        'crash telemetry must discard timestamps older than its advertised rolling window');
      assert.equal(meta.crash_window_seconds, 300);
    } finally {
      const restore = {
        TZ_AGENT_CRASH_COUNT: crashEnvironment.count,
        TZ_AGENT_CRASH_TIMESTAMPS: crashEnvironment.timestamps,
        TZ_AGENT_CRASH_WINDOW_SECONDS: crashEnvironment.window,
      };
      for (const [name, value] of Object.entries(restore)) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
    }
  }

  console.log('GEOFlow timeout and retry checks passed.');
} finally {
  globalThis.fetch = originalFetch;
}
