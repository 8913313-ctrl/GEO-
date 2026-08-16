import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const originalEnvironment = {
  geoflowBaseUrl: process.env.GEOFLOW_BASE_URL,
  dataDir: process.env.TZ_AGENT_DATA_DIR,
  masterKey: process.env.TZ_AGENT_MASTER_KEY,
  nodeEnv: process.env.NODE_ENV,
  allowInsecureDevKey: process.env.TZ_AGENT_ALLOW_INSECURE_DEV_KEY,
};
const testDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tongzhuo-config-store-'));
process.env.NODE_ENV = 'test';
process.env.TZ_AGENT_ALLOW_INSECURE_DEV_KEY = '1';
process.env.TZ_AGENT_DATA_DIR = testDataDir;
delete process.env.TZ_AGENT_MASTER_KEY;
const { configSchemaVersion, dataDir, defaultGeoFlowBaseUrl, readConfig, writeConfig } = await import('../src/config-store.js');

const configPath = path.join(dataDir, 'config.json');

try {
  delete process.env.GEOFLOW_BASE_URL;
  fs.mkdirSync(dataDir, { recursive: true });
  fs.rmSync(configPath, { force: true });
  assert.equal(readConfig().geoflowBaseUrl, defaultGeoFlowBaseUrl);
  assert.equal(readConfig().platformFilterMode, 'unrestricted');

  fs.writeFileSync(configPath, JSON.stringify({
    geoflowBaseUrl: 'http://127.0.0.1:43127',
    apiToken: 'legacy-token',
    enabledPlatforms: ['zhihu'],
  }), 'utf8');
  const migrated = readConfig();
  assert.equal(migrated.schemaVersion, configSchemaVersion);
  assert.equal(migrated.geoflowBaseUrl, defaultGeoFlowBaseUrl);
  assert.equal(migrated.apiToken, 'legacy-token');
  assert.equal(migrated.platformFilterMode, 'allowlist');
  assert.deepEqual(migrated.enabledPlatforms, ['zhihu']);
  const migratedOnDisk = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  for (const field of ['apiToken', 'pairingToken', 'deviceSecret', 'pairingCode']) {
    assert.equal(typeof migratedOnDisk[field], 'object');
    assert.equal(migratedOnDisk[field].alg, 'aes-256-gcm');
    assert.equal(migratedOnDisk[field].v, 1);
  }
  assert.doesNotMatch(JSON.stringify(migratedOnDisk), /legacy-token/);

  writeConfig({ enabledPlatforms: [] });
  assert.equal(readConfig().platformFilterMode, 'none');
  assert.deepEqual(readConfig().enabledPlatforms, []);

  writeConfig({ enabledPlatforms: ['zhihu', 'toutiao'] });
  assert.equal(readConfig().platformFilterMode, 'allowlist');
  assert.deepEqual(readConfig().enabledPlatforms, ['zhihu', 'toutiao']);

  writeConfig({ platformFilterMode: 'unrestricted', enabledPlatforms: [] });
  assert.equal(readConfig().platformFilterMode, 'unrestricted');


  writeConfig({
    pairingToken: 'pairing-token',
    deviceSecret: 'device-secret',
    pairingCode: 'pairing-code',
  });
  writeConfig({ apiToken: 'keep-me', geoflowBaseUrl: 'http://127.0.0.1:18080' });
  writeConfig({ apiToken: undefined, deviceName: '配置测试设备' });
  const config = readConfig();
  assert.equal(config.pairingToken, 'pairing-token');
  assert.equal(config.deviceSecret, 'device-secret');
  assert.equal(config.pairingCode, 'pairing-code');
  assert.equal(config.apiToken, 'keep-me');
  assert.equal(config.geoflowBaseUrl, 'http://127.0.0.1:18080');
  assert.equal(config.deviceName, '配置测试设备');
  assert.ok(config.capabilities.includes('baijiahao'));
  assert.ok(config.capabilities.includes('sohufocus'));
  assert.ok(config.capabilities.includes('zip-download'));

  const protectedText = fs.readFileSync(configPath, 'utf8');
  const protectedConfig = JSON.parse(protectedText);
  assert.doesNotMatch(protectedText, /keep-me|pairing-token|device-secret|pairing-code/);

  const mixedConfig = { ...protectedConfig, apiToken: 'forged-plaintext-token' };
  fs.writeFileSync(configPath, JSON.stringify(mixedConfig), 'utf8');
  assert.throws(() => readConfig(), /mixed plaintext fields/);
  fs.writeFileSync(configPath, protectedText, 'utf8');

  const swappedConfig = { ...protectedConfig, pairingToken: protectedConfig.apiToken };
  fs.writeFileSync(configPath, JSON.stringify(swappedConfig), 'utf8');
  assert.throws(() => readConfig(), /Unable to decrypt configuration field pairingToken/);
  fs.writeFileSync(configPath, protectedText, 'utf8');

  process.env.TZ_AGENT_MASTER_KEY = crypto.randomBytes(32).toString('base64');
  assert.throws(() => readConfig(), /Unable to decrypt configuration field/);
  delete process.env.TZ_AGENT_MASTER_KEY;
  assert.equal(readConfig().apiToken, 'keep-me');

  writeConfig({ geoflowBaseUrl: 'http://127.0.0.1:43127' });
  assert.equal(readConfig().geoflowBaseUrl, 'http://127.0.0.1:43127');

  process.env.GEOFLOW_BASE_URL = 'https://customer.example.com/geo/';
  assert.equal(readConfig().geoflowBaseUrl, 'https://customer.example.com/geo');
  console.log('Config store preservation passed.');
} finally {
  const restoreEnvironment = {
    GEOFLOW_BASE_URL: originalEnvironment.geoflowBaseUrl,
    TZ_AGENT_DATA_DIR: originalEnvironment.dataDir,
    TZ_AGENT_MASTER_KEY: originalEnvironment.masterKey,
    NODE_ENV: originalEnvironment.nodeEnv,
    TZ_AGENT_ALLOW_INSECURE_DEV_KEY: originalEnvironment.allowInsecureDevKey,
  };
  for (const [name, value] of Object.entries(restoreEnvironment)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  fs.rmSync(testDataDir, { recursive: true, force: true });
}
