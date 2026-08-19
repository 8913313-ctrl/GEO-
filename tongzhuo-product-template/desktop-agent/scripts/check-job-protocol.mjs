import assert from 'node:assert/strict';
import { TongzhuoDesktopAgent, normalizeJobProtocol } from '../src/agent.js';

assert.equal(normalizeJobProtocol('v1'), 'legacy');
assert.equal(normalizeJobProtocol('platform_jobs'), 'platform-jobs');
assert.equal(normalizeJobProtocol('V2'), 'platform-jobs');
assert.equal(normalizeJobProtocol('unknown', null), null);

function pollFixture(mode, { platformItems = [], legacyItems = [], platformError = null, legacyError = null } = {}) {
  const calls = [];
  const agent = Object.create(TongzhuoDesktopAgent.prototype);
  Object.assign(agent, {
    config: { apiToken: 'test-token', autoRun: false, activeGroupId: 'group-a' },
    jobProtocol: mode,
    platformJobsSupported: null,
    lastPollProtocols: [],
    jobs: [],
    activeJobs: new Map(),
    lastError: null,
    lastPollAt: null,
    client: {
      async platformJobs() {
        calls.push('platform-jobs');
        if (platformError) throw platformError;
        return { data: { items: platformItems } };
      },
      async jobs() {
        calls.push('legacy');
        if (legacyError) throw legacyError;
        return { data: { items: legacyItems } };
      },
    },
  });
  agent.log = () => {};
  agent.loadSessions = async () => [];
  agent.processCommands = async () => [];
  return { agent, calls };
}

{
  const { agent, calls } = pollFixture('legacy', { legacyItems: [{ id: 1, status: 'queued' }] });
  const jobs = await agent.pollOnce();
  assert.deepEqual(calls, ['legacy']);
  assert.equal(jobs[0].job_protocol, 'legacy');
  assert.equal(jobs[0].task_key, 'legacy:1');
}

{
  const { agent, calls } = pollFixture('platform-jobs', { platformItems: [{ id: 2, status: 'queued', platform_id: 'zhihu', article: { id: 9, title: 'V2 article' } }] });
  const jobs = await agent.pollOnce();
  assert.deepEqual(calls, ['platform-jobs']);
  assert.equal(jobs[0].job_protocol, 'platform-jobs');
  assert.deepEqual(jobs[0].platforms, ['zhihu']);
  assert.equal(jobs[0].payload.article.title, 'V2 article');
}

{
  const { agent, calls } = pollFixture('dual', {
    platformItems: [{ id: 3, status: 'queued' }],
    legacyItems: [{ id: 3, status: 'queued' }],
  });
  const jobs = await agent.pollOnce();
  assert.deepEqual(calls, ['platform-jobs', 'legacy']);
  assert.deepEqual(jobs.map((job) => job.task_key), ['platform:3', 'legacy:3']);
}

{
  const { agent, calls } = pollFixture('auto', { platformItems: [{ id: 4, status: 'queued' }], legacyItems: [{ id: 5 }] });
  await agent.pollOnce();
  assert.deepEqual(calls, ['platform-jobs']);
}

{
  const { agent, calls } = pollFixture('auto', { platformItems: [], legacyItems: [{ id: 5, status: 'queued' }] });
  const jobs = await agent.pollOnce();
  assert.deepEqual(calls, ['platform-jobs', 'legacy']);
  assert.equal(jobs[0].job_protocol, 'legacy');
}

{
  const unsupported = Object.assign(new Error('missing'), { status: 404 });
  const { agent, calls } = pollFixture('auto', { platformError: unsupported, legacyItems: [{ id: 6, status: 'queued' }] });
  const jobs = await agent.pollOnce();
  assert.deepEqual(calls, ['platform-jobs', 'legacy']);
  assert.equal(jobs[0].id, 6);
}

{
  let heartbeatReport;
  let heartbeatMeta;
  const agent = Object.create(TongzhuoDesktopAgent.prototype);
  Object.assign(agent, {
    config: { apiToken: 'test-token', desiredStateVersion: 0, appliedStateVersion: 0, localOverride: false, autoRun: false },
    jobProtocol: 'auto',
    lastPollProtocols: [],
    activeJobs: new Map(),
    activeJobId: null,
    platformJobsSupported: null,
    publishPolicy: { snapshot: () => ({}) },
    client: {
      async shadowHeartbeat(report, meta) {
        heartbeatReport = report;
        heartbeatMeta = meta;
        return { data: { job_protocol: 'dual', desired_state: { version: 0 } } };
      },
    },
  });
  agent.log = () => {};
  agent.applyDesiredState = async () => null;
  const result = await agent.heartbeat();
  assert.ok(result);
  assert.equal(heartbeatReport.job_protocol, 'auto');
  assert.equal(heartbeatMeta.job_protocol, 'auto');
  assert.equal(agent.jobProtocol, 'dual');
}

{
  const { agent } = pollFixture('legacy', { legacyItems: [] });
  let commandCalls = 0;
  agent.processCommands = async () => {
    commandCalls += 1;
    return [];
  };
  await agent.pollOnce();
  assert.equal(commandCalls, 1,
    'remote device commands must be polled even while auto publishing is disabled');
  await agent.pollOnce({ skipCommands: true });
  assert.equal(commandCalls, 1,
    'the command-originated poll guard must prevent recursive command processing');
}


{
  // Old Node deployments may route the unknown V2 endpoint through browser
  // session auth. Its exact SESSION_INVALID response means V2 is unavailable,
  // not that this paired device lost its credentials.
  const sessionBoundary = Object.assign(new Error('browser session required'), {
    status: 401,
    code: 'SESSION_INVALID',
  });
  const { agent, calls } = pollFixture('auto', {
    platformError: sessionBoundary,
    legacyItems: [{ id: 7, status: 'queued' }],
  });
  const jobs = await agent.pollOnce();
  assert.deepEqual(calls, ['platform-jobs', 'legacy']);
  assert.equal(agent.platformJobsSupported, false);
  assert.deepEqual(agent.lastPollProtocols, ['legacy']);
  assert.equal(jobs[0].id, 7);
  assert.equal(jobs[0].job_protocol, 'legacy');
}

{
  // Do not mask a real device-authentication failure by silently reading V1.
  const deviceAuthFailure = Object.assign(new Error('device credential expired'), {
    status: 401,
    code: 'DEVICE_AUTH_FAILED',
  });
  const { agent, calls } = pollFixture('auto', {
    platformError: deviceAuthFailure,
    legacyItems: [{ id: 8, status: 'queued' }],
  });
  await assert.rejects(agent.pollOnce(), (error) => error === deviceAuthFailure);
  assert.deepEqual(calls, ['platform-jobs']);
  assert.equal(agent.platformJobsSupported, null);
}

console.log('job protocol checks passed');
