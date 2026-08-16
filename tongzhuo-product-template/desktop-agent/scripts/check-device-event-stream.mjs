import assert from 'node:assert/strict';
import { consumeSseResponse } from '../src/device-event-stream.js';
import { TongzhuoDesktopAgent } from '../src/agent.js';
import { GeoFlowClient, GeoFlowRequestError } from '../src/geoflow-client.js';

function responseFromChunks(chunks) {
  const encoder = new TextEncoder();
  return new Response(new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  }), { headers: { 'Content-Type': 'text/event-stream' } });
}

const parsed = [];
await consumeSseResponse(responseFromChunks([
  ': proxy keepalive\r\n',
  'event: jobs_avail',
  'able\r\nid: 41\r\ndata: {"queued":2}\r\n\r\n',
  'event: diagnostic\ndata: first line\ndata: second line\n\n',
]), (event) => parsed.push(event));

assert.equal(parsed.length, 2, 'comments must not create events');
assert.deepEqual(parsed[0], {
  event: 'jobs_available',
  id: '41',
  data: { queued: 2 },
  rawData: '{"queued":2}',
});
assert.equal(parsed[1].event, 'diagnostic');
assert.equal(parsed[1].data, 'first line\nsecond line');

const eofEvents = [];
await consumeSseResponse(
  responseFromChunks(['event: jobs_changed\ndata: {"queued":1}']),
  (event) => eofEvents.push(event),
);
assert.equal(eofEvents.length, 1, 'a final event must be dispatched even without a trailing blank line');
assert.deepEqual(eofEvents[0].data, { queued: 1 });

let streamCancelled = false;
const abortController = new AbortController();
const pendingResponse = new Response(new ReadableStream({
  start() {},
  cancel() {
    streamCancelled = true;
  },
}), { headers: { 'Content-Type': 'text/event-stream' } });
const pendingConsumption = consumeSseResponse(pendingResponse, () => {}, { signal: abortController.signal });
abortController.abort(new Error('shutdown'));
await pendingConsumption;
assert.equal(streamCancelled, true, 'shutdown must cancel a pending stream read');

const calls = [];
const agentStub = {
  lastEventAt: null,
  log: (...args) => calls.push(['log', ...args]),
  poll: async () => calls.push(['poll']),
  heartbeat: async () => calls.push(['heartbeat']),
  processCommands: async () => calls.push(['commands']),
};
await TongzhuoDesktopAgent.prototype.handleDeviceEvent.call(agentStub, { event: 'jobs_available' });
await TongzhuoDesktopAgent.prototype.handleDeviceEvent.call(agentStub, { event: 'desired_state_changed' });
await TongzhuoDesktopAgent.prototype.handleDeviceEvent.call(agentStub, { event: 'commands_available' });
await TongzhuoDesktopAgent.prototype.handleDeviceEvent.call(agentStub, { event: 'keepalive' });
assert.equal(calls.filter(([name]) => name === 'poll').length, 1);
assert.equal(calls.filter(([name]) => name === 'heartbeat').length, 1);
assert.equal(calls.filter(([name]) => name === 'commands').length, 1);
assert.ok(agentStub.lastEventAt, 'actionable events should update lastEventAt');

const unavailable = {
  client: {
    deviceEvents: async () => {
      throw new GeoFlowRequestError('not available', { status: 404 });
    },
  },
  eventStreamSupported: null,
  eventStreamConnected: false,
  eventStreamRetryAttempt: 0,
  eventStreamController: null,
  log: (...args) => calls.push(['log', ...args]),
  scheduleEventStreamRetry: () => calls.push(['retry']),
  handleDeviceEvent: async () => {},
};
const unavailableController = new AbortController();
unavailable.eventStreamController = unavailableController;
await TongzhuoDesktopAgent.prototype.runEventStream.call(unavailable, unavailableController);
assert.equal(unavailable.eventStreamSupported, false, '404 event endpoint must fall back to polling');
assert.equal(calls.filter(([name]) => name === 'retry').length, 0, 'unsupported endpoint must not reconnect forever');

const originalFetch = globalThis.fetch;
let captured = null;
globalThis.fetch = async (url, options) => {
  captured = { url, options };
  return responseFromChunks(['event: ready\ndata: {}\n\n']);
};
try {
  const client = new GeoFlowClient({
    geoflowBaseUrl: 'https://geo.example',
    deviceId: 'device one',
    pairingToken: 'secret-token',
    connectionMode: 'paired',
  });
  const response = await client.deviceEvents();
  assert.equal(response.headers.get('content-type'), 'text/event-stream');
  assert.equal(captured.url, 'https://geo.example/api/v1/publisher/devices/device%20one/events');
  assert.equal(captured.options.headers.Accept, 'text/event-stream');
  assert.equal(captured.options.headers.Authorization, 'Bearer secret-token');
} finally {
  globalThis.fetch = originalFetch;
}
let releasePreviousStream;
const previousStream = new Promise((resolve) => { releasePreviousStream = resolve; });
let restartedStreams = 0;
const restartStub = {
  config: { loginCheckSeconds: 300, pollSeconds: 20 },
  pollTimer: null,
  heartbeatTimer: null,
  loginSyncTimer: null,
  stopEventStream: () => previousStream,
  startEventStream: () => { restartedStreams += 1; },
  syncLoginStates: async () => [],
  listAccountGroups: () => [],
  hasCredential: () => true,
  poll: async () => [],
  heartbeat: async () => ({}),
  log: () => {},
};
TongzhuoDesktopAgent.prototype.restartTimers.call(restartStub);
assert.equal(restartedStreams, 0, 'restart must wait until the aborted SSE task releases its slot');
releasePreviousStream();
await previousStream;
await Promise.resolve();
assert.equal(restartedStreams, 1, 'restart must open exactly one replacement SSE stream after cleanup');
clearInterval(restartStub.pollTimer);
clearInterval(restartStub.heartbeatTimer);
clearInterval(restartStub.loginSyncTimer);


let watchdogRetries = 0;
const silentStream = new Response(new ReadableStream({
  start() {},
  cancel() {},
}), { headers: { 'Content-Type': 'text/event-stream' } });
const watchdogController = new AbortController();
const watchdogAgent = {
  client: { deviceEvents: async () => silentStream },
  eventStreamController: watchdogController,
  eventStreamSupported: null,
  eventStreamConnected: false,
  eventStreamRetryAttempt: 0,
  eventStreamIdleTimeoutMs: 1000,
  log: () => {},
  scheduleEventStreamRetry: () => { watchdogRetries += 1; },
  handleDeviceEvent: async () => {},
};
let watchdogDeadline;
try {
  await Promise.race([
    TongzhuoDesktopAgent.prototype.runEventStream.call(watchdogAgent, watchdogController),
    new Promise((_, reject) => {
      watchdogDeadline = setTimeout(() => reject(new Error('SSE idle watchdog did not reconnect in time')), 5000);
    }),
  ]);
} finally {
  clearTimeout(watchdogDeadline);
}
assert.equal(watchdogController.signal.aborted, true, 'a silent half-open stream must be aborted by the idle watchdog');
assert.equal(watchdogRetries, 1, 'an idle-watchdog abort must schedule exactly one reconnection');
assert.equal(watchdogAgent.eventStreamConnected, false, 'an idle stream must no longer be reported as connected');

console.log('Device event stream contract passed.');
