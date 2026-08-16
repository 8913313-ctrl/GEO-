import assert from 'node:assert/strict';
import { PublishPolicy } from '../src/publish-policy.js';

const start = Date.parse('2026-08-12T09:00:00Z');
let now = start;
const waits = [];
const policy = new PublishPolicy({
  now: () => now,
  random: () => 0.5,
  sleep: async (milliseconds) => waits.push(milliseconds),
  policy: {
    maxConcurrentGroups: 2,
    defaultDailyQuota: 2,
    defaultMinDelaySeconds: 10,
    defaultMaxDelaySeconds: 30,
    riskPauseThreshold: 2,
    riskPauseMinutes: 60,
  },
});

assert.equal(policy.acquireGroup('group-a', true).allowed, true);
assert.equal(policy.acquireGroup('group-a', true).reason, 'group_busy');
assert.equal(policy.acquireGroup('group-b', true).allowed, true);
assert.equal(policy.acquireGroup('group-c', true).reason, 'concurrency_limit');
policy.releaseGroup('group-a');
assert.equal(policy.acquireGroup('group-c', true).allowed, true);

assert.equal(policy.acquireProfile({ groupId: 'group-b', profileKey: 'profile-b', platformId: 'zhihu' }).allowed, true);
assert.equal(policy.acquireProfile({ groupId: 'group-b', profileKey: 'profile-b', platformId: 'zhihu' }).reason, 'profile_busy');
policy.releaseProfile({ groupId: 'group-b', profileKey: 'profile-b', platformId: 'zhihu' });

assert.equal(await policy.waitBeforePublish('zhihu'), 20_000);
assert.deepEqual(waits, [20_000]);
assert.equal(await policy.waitBeforePublish('zhihu', {}, { automatic: false }), 0);

policy.recordOutcome('zhihu', { state: 'published' });
assert.equal(policy.canStartProfile({ groupId: 'group-b', profileKey: 'profile-b', platformId: 'zhihu' }).allowed, true);
policy.recordOutcome('zhihu', { state: 'draft_saved' });
assert.equal(policy.canStartProfile({ groupId: 'group-b', profileKey: 'profile-b', platformId: 'zhihu' }).reason, 'daily_quota_exhausted');

policy.recordOutcome('wechat_mp', { state: 'failed', message: 'captcha verification required' });
assert.equal(policy.canStartProfile({ groupId: 'group-b', profileKey: 'profile-c', platformId: 'wechat_mp' }).allowed, true);
policy.recordOutcome('wechat_mp', { state: 'failed', message: 'risk verification required' });
assert.equal(policy.canStartProfile({ groupId: 'group-b', profileKey: 'profile-c', platformId: 'wechat_mp' }).reason, 'risk_cooldown');
now += 61 * 60 * 1000;
assert.equal(policy.canStartProfile({ groupId: 'group-b', profileKey: 'profile-c', platformId: 'wechat_mp' }).allowed, true);

// The strike before a cooldown must survive a normal node restart. Otherwise
// restarting the publisher would bypass the consecutive-risk pause threshold.
const firstRiskPolicy = new PublishPolicy({
  now: () => now,
  policy: { riskPauseThreshold: 2, riskPauseMinutes: 60 },
});
firstRiskPolicy.recordOutcome('toutiao', { state: 'failed', message: 'captcha verification required' });
const resumedRiskPolicy = new PublishPolicy({
  now: () => now,
  policy: { riskPauseThreshold: 2, riskPauseMinutes: 60 },
  state: firstRiskPolicy.snapshot(),
});
resumedRiskPolicy.recordOutcome('toutiao', { state: 'failed', message: 'risk verification required' });
assert.equal(
  resumedRiskPolicy.canStartProfile({ groupId: 'group-b', profileKey: 'profile-toutiao', platformId: 'toutiao' }).reason,
  'risk_cooldown',
  'a restart must not erase an unpaused consecutive risk strike',
);

assert.equal(policy.shouldRetry(new Error('network timeout')), true);
assert.equal(policy.shouldRetry(new Error('login verification required')), false);

console.log('publish policy checks passed');
