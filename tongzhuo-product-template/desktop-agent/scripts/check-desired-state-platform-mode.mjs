import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const temporaryDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tongzhuo-shadow-test-'));
process.env.TZ_AGENT_DATA_DIR = temporaryDataDir;
process.env.NODE_ENV = 'test';
process.env.TZ_AGENT_ALLOW_INSECURE_DEV_KEY = '1';

try {
  const { TongzhuoDesktopAgent } = await import('../src/agent.js');
  const shadow = Object.create(TongzhuoDesktopAgent.prototype);
  shadow.config = {
    localOverride: false,
    appliedStateVersion: 0,
    desiredStateVersion: 0,
    publishPolicy: {},
    platformPolicy: {},
    publishPolicyState: {},
    capabilities: ['zhihu', 'wechat_mp', 'toutiao'],
    enabledPlatforms: [],
    platformFilterMode: 'none',
  };
  shadow.client = { updateConfig(config) { shadow.clientConfig = config; } };
  shadow.publishPolicy = { snapshot: () => ({}) };
  shadow.restartCount = 0;
  shadow.restartTimers = () => { shadow.restartCount += 1; };
  shadow.persistPublishPolicy = () => {};

  const applied = await shadow.applyDesiredState({
    version: 1,
    platform_filter_mode: 'all',
    enabled_platform_ids: [],
  });
  assert.deepEqual(applied, { appliedVersion: 1, status: 'applied' });
  assert.equal(shadow.config.platformFilterMode, 'unrestricted');
  assert.deepEqual(shadow.config.enabledPlatforms, []);
  assert.equal(shadow.isPlatformEnabled('zhihu'), true, 'server all mode must not become local deny-all');
  assert.equal(shadow.restartCount, 1);

  await shadow.applyDesiredState({
    version: 2,
    platform_filter_mode: 'allowlist',
    enabled_platform_ids: [],
  });
  assert.equal(shadow.config.platformFilterMode, 'none', 'empty allowlist must fail closed');
  assert.equal(shadow.isPlatformEnabled('zhihu'), false);

  await shadow.applyDesiredState({
    version: 3,
    platform_filter_mode: 'allowlist',
    enabled_platform_ids: ['zhihu'],
  });
  assert.equal(shadow.config.platformFilterMode, 'allowlist');
  assert.deepEqual(shadow.config.enabledPlatforms, ['zhihu']);
  assert.equal(shadow.isPlatformEnabled('zhihu'), true);
  assert.equal(shadow.isPlatformEnabled('toutiao'), false);

  const forced = await shadow.applyDesiredState({
    version: 4,
    takeover: true,
    auto_run: true,
    default_daily_quota: 3,
    default_min_delay_seconds: 15,
    default_max_delay_seconds: 45,
    risk_pause_threshold: 2,
    risk_pause_minutes: 120,
    platform_daily_quota: { zhihu: 1, toutiao: 2 },
  });
  assert.deepEqual(forced, { appliedVersion: 4, status: 'applied' });
  assert.equal(shadow.config.autoRun, true);
  assert.equal(shadow.config.publishPolicy.defaultDailyQuota, 3);
  assert.equal(shadow.config.publishPolicy.defaultMinDelaySeconds, 15);
  assert.equal(shadow.config.publishPolicy.defaultMaxDelaySeconds, 45);
  assert.equal(shadow.config.publishPolicy.riskPauseThreshold, 2);
  assert.equal(shadow.config.publishPolicy.riskPauseMinutes, 120);
  assert.equal(shadow.config.platformPolicy.zhihu.daily_quota, 1);
  assert.equal(shadow.config.platformPolicy.toutiao.daily_quota, 2);

  // A takeover is consumed by the version that carries it. The same old
  // desired state must not erase an operator's later local override.
  shadow.config.localOverride = true;
  assert.deepEqual(
    await shadow.applyDesiredState({ version: 4, takeover: true, auto_run: false }),
    { appliedVersion: 4, status: 'local_override' },
  );

  console.log('Desired-state platform mode contract passed.');
} finally {
  if (temporaryDataDir.startsWith(os.tmpdir())) {
    fs.rmSync(temporaryDataDir, { recursive: true, force: true });
  }
}
