import assert from 'node:assert/strict';
import { TongzhuoDesktopAgent } from '../src/agent.js';

const scheduler = Object.create(TongzhuoDesktopAgent.prototype);
scheduler.config = {
  capabilities: ['zhihu', 'wechat_mp', 'toutiao'],
  enabledPlatforms: ['zhihu', 'toutiao'],
};

assert.deepEqual(
  scheduler.choosePlatforms({ platforms: ['zhihu', 'wechat_mp', 'toutiao'] }, []),
  ['zhihu', 'toutiao'],
);
assert.deepEqual(
  scheduler.choosePlatforms({ platforms: ['zhihu', 'toutiao'] }, ['toutiao']),
  ['toutiao'],
);

const resumed = scheduler.completedPlatformResults({
  result: {
    platform_results: {
      zhihu: { state: 'published', remote_url: 'https://example.test/1' },
      wechat_mp: { state: 'failed', message: 'timeout' },
    },
  },
}, ['zhihu', 'wechat_mp']);
assert.deepEqual(Object.keys(resumed), ['zhihu']);
assert.equal(resumed.zhihu.state, 'published');

assert.equal(scheduler.platformJobStatus({ state: 'awaiting_login' }), 'login_required');
assert.equal(scheduler.platformJobStatus({ state: 'draft_saved' }), 'draft_saved');
assert.equal(scheduler.platformJobStatus({ state: 'unknown_state' }), 'failed');

scheduler.listAccountGroups = () => [{ id: 'group-a' }, { id: 'group-b' }];
assert.equal(scheduler.groupIdForProfile('group-b--zhihu'), 'group-b');
assert.equal(scheduler.groupIdForProfile('missing--zhihu'), '');

scheduler.activeJobs = new Map([
  ['platform:41', { groupId: 'group-a', protocol: 'platform-jobs' }],
  ['legacy:42', { groupId: 'group-b', protocol: 'legacy' }],
]);
assert.deepEqual(scheduler.activeJobIds(), [41, 42]);
assert.deepEqual(scheduler.activeJobRefs(), [
  { id: 41, protocol: 'platform-jobs' },
  { id: 42, protocol: 'legacy' },
]);

assert.equal(scheduler.platformJobStatus({ state: 'awaiting_confirmation' }), 'awaiting_confirmation');

const shadow = Object.create(TongzhuoDesktopAgent.prototype);
shadow.config = { localOverride: false, appliedStateVersion: 0, publishPolicy: {}, platformPolicy: {} };
shadow.client = { updateConfig() {} };
shadow.publishPolicy = { snapshot: () => ({}) };
shadow.restartTimers = () => { throw new Error('version zero must not restart timers'); };
shadow.persistPublishPolicy = () => {};
assert.deepEqual(await shadow.applyDesiredState({ version: 0, auto_run: false }), { appliedVersion: 0, status: 'unchanged' });

shadow.config = { ...shadow.config, localOverride: true, appliedStateVersion: 3 };
assert.deepEqual(await shadow.applyDesiredState({ version: 4, auto_run: true }), { appliedVersion: 3, status: 'local_override' });

console.log('agent scheduler checks passed');
