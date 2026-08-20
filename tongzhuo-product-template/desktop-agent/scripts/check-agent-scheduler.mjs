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

scheduler.config = {
  capabilities: ['zhihu', 'wechat_mp', 'toutiao'],
  enabledPlatforms: [],
  platformFilterMode: 'none',
  maxJobAttempts: 2,
};
assert.deepEqual(
  scheduler.choosePlatforms({ platforms: ['zhihu', 'wechat_mp', 'toutiao'] }, []),
  [],
  'an explicit empty remote allowlist must stop every remote platform',
);
assert.equal(scheduler.isPlatformEnabled('zhihu'), false);
const skippedByPolicy = await scheduler.runPlatformWithRetry('zhihu', {}, 41, { id: 'group-a' });
assert.equal(skippedByPolicy.state, 'skipped');
assert.equal(skippedByPolicy.failure_category, 'platform_disabled_by_policy');

scheduler.config = {
  capabilities: ['zhihu', 'wechat_mp', 'toutiao'],
  enabledPlatforms: [],
  platformFilterMode: 'unrestricted',
};
assert.deepEqual(
  scheduler.choosePlatforms({ platforms: ['zhihu', 'wechat_mp', 'toutiao'] }, []),
  ['zhihu', 'wechat_mp', 'toutiao'],
);

const directJob = {
  publish_mode: 'direct',
  manual_confirmation: false,
  platform: { supports_direct_publish: true },
  payload: { article: { title: 'mode safety', text: 'body' } },
};
assert.equal(scheduler.allowsFinalSubmit('zhihu', directJob), true);
assert.equal(scheduler.allowsFinalSubmit('zhihu', { ...directJob, publish_mode: 'draft' }), false);
assert.equal(scheduler.allowsFinalSubmit('zhihu', { ...directJob, publish_mode: 'scheduled' }), false);
assert.equal(scheduler.allowsFinalSubmit('zhihu', { ...directJob, publish_mode: 'DIRECT' }), true);
assert.equal(scheduler.allowsFinalSubmit('zhihu', { ...directJob, manual_confirmation: true }), false);
assert.equal(scheduler.allowsFinalSubmit('zhihu', { ...directJob, platform: { supports_direct_publish: false } }), false);
assert.equal(scheduler.allowsFinalSubmit('baijiahao', directJob), true, 'a locally automated adapter may final-submit when the task contract agrees');
assert.equal(scheduler.allowsFinalSubmit('unlisted_platform', directJob), false, 'a platform outside the local autoSubmit allowlist must never final-submit');

const perPlatformDirectJob = {
  // Platform-level contracts are authoritative over conservative task fields.
  publish_mode: 'draft',
  manual_confirmation: true,
  platform_details: [
    { id: 'zhihu', publish_mode: 'direct', manual_confirmation: false, supports_direct_publish: true },
    { id: 'wechat_mp', publish_mode: 'direct', manual_confirmation: false, supports_direct_publish: true },
    { id: 'toutiao', publish_mode: 'direct', manual_confirmation: false, supports_direct_publish: true },
    // A backend capability mistake must never override the local adapter gate,
    // but every catalog platform now carries the local automated contract.
    { id: 'baijiahao', publish_mode: 'direct', manual_confirmation: false, supports_direct_publish: true },
  ],
  payload: { article: { title: 'per-platform mode safety', text: 'body' } },
};
for (const platformId of ['zhihu', 'wechat_mp', 'toutiao', 'baijiahao']) {
  assert.equal(
    scheduler.allowsFinalSubmit(platformId, perPlatformDirectJob),
    true,
    `${platformId} per-platform direct contract should allow final submit`,
  );
}
assert.equal(scheduler.allowsFinalSubmit('unlisted_platform', perPlatformDirectJob), false,
  'a platform outside the local autoSubmit allowlist must never final-submit');

const executor = Object.create(TongzhuoDesktopAgent.prototype);
executor.config = {
  capabilities: ['zhihu', 'wechat_mp', 'toutiao', 'baijiahao'],
  enabledPlatforms: [],
  platformFilterMode: 'unrestricted',
  maxJobAttempts: 1,
  platformPolicy: {},
};
executor.publishPolicy = {
  acquireProfile: () => ({ allowed: true }),
  waitBeforePublish: async () => 0,
  recordOutcome: () => ({}),
  releaseProfile: () => {},
};
const finalSubmitOptions = [];
executor.browser = {
  openEditor: async (_platformId, _payload, options) => {
    finalSubmitOptions.push(options.allowFinalSubmit);
    return { state: options.allowFinalSubmit ? 'published' : 'draft_saved', message: 'ok', windowId: 'test-window' };
  },
};
executor.syncPlatformSession = async () => {};
executor.log = () => {};
executor.persistPublishPolicy = () => {};
await executor.runPlatformWithRetry('zhihu', directJob, 51, { id: 'group-a' });
await executor.runPlatformWithRetry('zhihu', { ...directJob, publish_mode: 'draft' }, 52, { id: 'group-a' });
assert.deepEqual(finalSubmitOptions, [true, false], 'runPlatformWithRetry must pass the task-level final-submit gate to the browser');

const perPlatformSubmitOptions = [];
executor.browser.openEditor = async (platformId, _payload, options) => {
  perPlatformSubmitOptions.push([platformId, options.allowFinalSubmit]);
  return { state: options.allowFinalSubmit ? 'published' : 'draft_saved', message: 'ok', windowId: 'test-window' };
};
for (const platformId of ['zhihu', 'wechat_mp', 'toutiao', 'baijiahao']) {
  await executor.runPlatformWithRetry(platformId, perPlatformDirectJob, 53, { id: 'group-a' });
}
assert.deepEqual(
  perPlatformSubmitOptions,
  [['zhihu', true], ['wechat_mp', true], ['toutiao', true], ['baijiahao', true]],
  'runPlatformWithRetry must enforce local autoSubmit for each platform detail',
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

const nestedResumed = scheduler.completedPlatformResults({
  platform_results: {},
  assistant: {
    platform_results: {
      zhihu: { state: 'published', remote_url: 'https://example.test/assistant/zhihu' },
    },
  },
  remote_meta: {
    publisher_assistant: {
      platform_results: {
        wechat_mp: { state: 'draft_saved', remote_url: 'https://example.test/assistant/wechat' },
      },
    },
  },
}, ['zhihu', 'wechat_mp']);
assert.deepEqual(Object.keys(nestedResumed), ['zhihu', 'wechat_mp'],
  'empty top-level results must not hide persisted assistant platform outcomes');

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
