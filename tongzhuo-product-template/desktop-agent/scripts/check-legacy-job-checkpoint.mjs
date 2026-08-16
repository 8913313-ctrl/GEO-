import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { TongzhuoDesktopAgent } from '../src/agent.js';
import { LegacyJobCheckpointStore } from '../src/legacy-job-checkpoint.js';

const checkpointDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'tongzhuo-legacy-job-checkpoint-'));
let now = Date.UTC(2026, 7, 15, 8, 0, 0);
const config = {
  geoflowBaseUrl: 'https://geo.example.test/api/',
  deviceId: 'device-checkpoint-test',
};

try {
  const store = new LegacyJobCheckpointStore({ directory: checkpointDirectory, now: () => now });
  assert.deepEqual(store.completed(config, 101, ['zhihu']), {}, 'a new checkpoint store must be empty');
  assert.equal(store.record(config, 101, { platform: 'zhihu', state: 'failed' }), false,
    'only terminal successful platform outcomes may become a V1 checkpoint');
  assert.equal(store.record(config, 101, {
    platform: 'zhihu',
    state: 'published',
    message: 'published safely',
    remote_url: 'https://zhihu.example.test/posts/101?token=checkpoint-secret#oauth-state',
    fill: { html: '<p>private article body</p>' },
    selectors: { body: '#editor' },
  }), true);
  assert.equal(store.record(config, 101, {
    platform: 'wechat_mp',
    state: 'draft_saved',
    remote_url: 'https://mp.weixin.qq.com/draft/101',
  }), true);

  const onDisk = fs.readFileSync(store.filePath, 'utf8');
  assert.doesNotMatch(onDisk, /private article body|#editor|checkpoint-secret|oauth-state/,
    'a checkpoint must contain only outcome metadata, never article payloads or selectors');

  const restarted = new LegacyJobCheckpointStore({ directory: checkpointDirectory, now: () => now });
  const restoredZhihu = restarted.completed(config, 101, ['zhihu']).zhihu;
  assert.equal(restoredZhihu.remote_url, 'https://zhihu.example.test/posts/101',
    'checkpoint URLs must drop query credentials and fragments before storage');
  assert.deepEqual(Object.keys(restarted.completed(config, 101, ['zhihu', 'toutiao'])), ['zhihu'],
    'a restarted node must restore only requested completed platforms');
  assert.equal(restarted.completed({ ...config, deviceId: 'different-device' }, 101, ['zhihu']).zhihu, undefined,
    'checkpoints must never cross device identities');
  assert.equal(restarted.completed({ ...config, geoflowBaseUrl: 'https://other.example.test' }, 101, ['zhihu']).zhihu, undefined,
    'checkpoints must never cross GEOFlow endpoints');
  assert.equal(restarted.clear(config, 101), true, 'a delivered aggregate result must clear its checkpoint');
  assert.deepEqual(restarted.completed(config, 101, ['zhihu', 'wechat_mp']), {}, 'cleared checkpoints must not resume later jobs');

  assert.equal(restarted.record(config, 102, { platform: 'zhihu', state: 'published' }), true);
  now += 15 * 24 * 60 * 60 * 1000;
  assert.deepEqual(restarted.completed(config, 102, ['zhihu']), {}, 'stale checkpoints must expire instead of applying to a future job id reuse');
} finally {
  fs.rmSync(checkpointDirectory, { recursive: true, force: true });
}

// V1: a checkpoint created before a process crash must skip that platform on
// the next aggregate claim.  A claim can also resolve a different account
// group than its queue hint; release the originally acquired permit.
{
  const agent = Object.create(TongzhuoDesktopAgent.prototype);
  const acquiredGroups = [];
  const releasedGroups = [];
  const executedPlatforms = [];
  const recordedCheckpoints = [];
  const clearedCheckpoints = [];
  const reports = [];
  agent.config = { activeGroupId: 'hinted-group', deviceId: 'device-checkpoint-test' };
  agent.jobs = [];
  agent.activeJobs = new Map();
  agent.activeJobId = null;
  agent.publishPolicy = {
    acquireGroup(groupId) {
      acquiredGroups.push(groupId);
      return { allowed: true, groupId };
    },
    releaseGroup(groupId) { releasedGroups.push(groupId); },
  };
  agent.legacyJobCheckpoints = {
    completed: () => ({ zhihu: { platform: 'zhihu', state: 'published', remote_url: 'https://zhihu.example.test/posts/101' } }),
    record: (...args) => recordedCheckpoints.push(args),
    clear: (...args) => clearedCheckpoints.push(args),
  };
  agent.client = {
    claimJob: async () => ({ id: 77, group_id: 'claimed-group', platforms: ['zhihu', 'toutiao'], payload: {} }),
    reportResult: async (...args) => { reports.push(args); return { ok: true }; },
  };
  agent.log = () => {};
  agent.heartbeat = async () => {};
  agent.poll = async () => [];
  agent.persistPublishPolicy = () => {};
  agent.accountGroupById = (id) => (id === 'claimed-group' ? { id, accounts: {} } : null);
  agent.choosePlatforms = (job) => job.platforms;
  agent.runPlatformWithRetry = async (platformId) => {
    executedPlatforms.push(platformId);
    return { platform: platformId, state: 'published', remote_url: `https://example.test/${platformId}` };
  };

  const result = await agent.runJob(77, [], { automatic: true, jobHint: { group_id: 'hinted-group' } });
  assert.deepEqual(acquiredGroups, ['hinted-group']);
  assert.deepEqual(releasedGroups, ['hinted-group'], 'V1 must release the permit it acquired before claim, not a later claimed group');
  assert.deepEqual(executedPlatforms, ['toutiao'], 'V1 restart must skip a locally checkpointed terminal platform');
  assert.equal(result.platformResults.zhihu.state, 'published');
  assert.equal(result.platformResults.toutiao.state, 'published');
  assert.equal(recordedCheckpoints.length, 1, 'only the newly completed platform should be persisted');
  assert.equal(recordedCheckpoints[0][2].platform, 'toutiao');
  assert.deepEqual(clearedCheckpoints.map((args) => args[1]), [77], 'successful aggregate report must clear its checkpoint');
  assert.equal(reports[0][3].platform_results.zhihu.state, 'published', 'V1 report must retain resumed platform results');
  assert.equal(agent.activeJobs.size, 0, 'V1 must release its active job entry after reporting');
}

// A mixed V1 aggregate failure must retain the successful platform checkpoint.
// Otherwise a normal retry of the failed platform would publish the successful
// platform for a second time.
{
  const agent = Object.create(TongzhuoDesktopAgent.prototype);
  const releasedGroups = [];
  const reports = [];
  let checkpointClearCalls = 0;
  agent.config = { activeGroupId: 'hinted-group', deviceId: 'device-checkpoint-test' };
  agent.jobs = [];
  agent.activeJobs = new Map();
  agent.activeJobId = null;
  agent.publishPolicy = {
    acquireGroup: (groupId) => ({ allowed: true, groupId }),
    releaseGroup: (groupId) => releasedGroups.push(groupId),
  };
  agent.legacyJobCheckpoints = {
    completed: () => ({ zhihu: { platform: 'zhihu', state: 'published', remote_url: 'https://example.test/zhihu' } }),
    record: () => false,
    clear: () => { checkpointClearCalls += 1; },
  };
  agent.client = {
    claimJob: async () => ({ id: 78, group_id: 'claimed-group', platforms: ['zhihu', 'toutiao'], payload: {} }),
    reportResult: async (...args) => { reports.push(args); return { ok: true }; },
  };
  agent.log = () => {};
  agent.heartbeat = async () => {};
  agent.poll = async () => [];
  agent.persistPublishPolicy = () => {};
  agent.accountGroupById = (id) => (id === 'claimed-group' ? { id, accounts: {} } : null);
  agent.choosePlatforms = (job) => job.platforms;
  agent.runPlatformWithRetry = async (platformId) => ({
    platform: platformId,
    state: 'failed',
    message: 'temporary publish failure',
    failure_category: 'transient_runtime_error',
  });

  const result = await agent.runJob(78, [], { automatic: true, jobHint: { group_id: 'hinted-group' } });
  assert.equal(result.state, 'failed');
  assert.equal(result.platformResults.zhihu.state, 'published');
  assert.equal(result.platformResults.toutiao.state, 'failed');
  assert.equal(checkpointClearCalls, 0,
    'mixed V1 failure must retain terminal platform checkpoints for the next retry');
  assert.equal(reports[0][1], 'failed');
  assert.equal(reports[0][3].platform_results.zhihu.state, 'published');
  assert.deepEqual(releasedGroups, ['hinted-group']);
}

// V2 has server leases, but it uses the same queue-hint group permit. Verify
// that a changed group id in the lease response also releases the original one.
{
  const agent = Object.create(TongzhuoDesktopAgent.prototype);
  const acquiredGroups = [];
  const releasedGroups = [];
  agent.config = { activeGroupId: 'hinted-group' };
  agent.activeJobs = new Map();
  agent.publishPolicy = {
    acquireGroup(groupId) {
      acquiredGroups.push(groupId);
      return { allowed: true, groupId };
    },
    releaseGroup(groupId) { releasedGroups.push(groupId); },
  };
  agent.client = {
    claimPlatformJob: async () => ({ id: 88, lease_token: 'lease-88', group_id: 'claimed-group', platform_id: 'zhihu', payload: {} }),
    heartbeatPlatformJob: async () => ({ ok: true }),
    reportPlatformJobResult: async () => ({ ok: true }),
  };
  agent.log = () => {};
  agent.heartbeat = async () => {};
  agent.persistPublishPolicy = () => {};
  agent.accountGroupById = (id) => (id === 'claimed-group' ? { id, accounts: {} } : null);
  agent.runPlatformWithRetry = async () => ({ platform: 'zhihu', state: 'published', remote_url: 'https://example.test/zhihu' });

  const result = await agent.runPlatformJob({ id: 88, group_id: 'hinted-group' }, { automatic: true });
  assert.equal(result.state, 'published');
  assert.deepEqual(acquiredGroups, ['hinted-group']);
  assert.deepEqual(releasedGroups, ['hinted-group'], 'V2 must release the permit it acquired before claim, not a later claimed group');
  assert.equal(agent.activeJobs.size, 0, 'V2 must release its active job entry after reporting');
}

console.log('Legacy job checkpoint and group permit lifecycle checks passed.');
