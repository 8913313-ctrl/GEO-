import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { configSchemaVersion, dataDir, defaultGeoFlowBaseUrl, readConfig, writeConfig } from '../src/config-store.js';

const configPath = path.join(dataDir, 'config.json');
const backupPath = `${configPath}.test-backup`;
const originalEnvironmentUrl = process.env.GEOFLOW_BASE_URL;

if (fs.existsSync(configPath)) {
  fs.copyFileSync(configPath, backupPath);
}

try {
  delete process.env.GEOFLOW_BASE_URL;
  fs.mkdirSync(dataDir, { recursive: true });
  fs.rmSync(configPath, { force: true });
  assert.equal(readConfig().geoflowBaseUrl, defaultGeoFlowBaseUrl);

  fs.writeFileSync(configPath, JSON.stringify({
    geoflowBaseUrl: 'http://127.0.0.1:43127',
    apiToken: 'legacy-token',
  }), 'utf8');
  const migrated = readConfig();
  assert.equal(migrated.schemaVersion, configSchemaVersion);
  assert.equal(migrated.geoflowBaseUrl, defaultGeoFlowBaseUrl);
  assert.equal(migrated.apiToken, 'legacy-token');

  writeConfig({ apiToken: 'keep-me', geoflowBaseUrl: 'http://127.0.0.1:18080' });
  writeConfig({ apiToken: undefined, deviceName: '配置测试设备' });
  const config = readConfig();
  assert.equal(config.apiToken, 'keep-me');
  assert.equal(config.geoflowBaseUrl, 'http://127.0.0.1:18080');
  assert.equal(config.deviceName, '配置测试设备');
  assert.ok(config.capabilities.includes('baijiahao'));
  assert.ok(config.capabilities.includes('sohufocus'));
  assert.ok(config.capabilities.includes('zip-download'));

  writeConfig({ geoflowBaseUrl: 'http://127.0.0.1:43127' });
  assert.equal(readConfig().geoflowBaseUrl, 'http://127.0.0.1:43127');

  process.env.GEOFLOW_BASE_URL = 'https://customer.example.com/geo/';
  assert.equal(readConfig().geoflowBaseUrl, 'https://customer.example.com/geo');
  console.log('Config store preservation passed.');
} finally {
  if (originalEnvironmentUrl === undefined) delete process.env.GEOFLOW_BASE_URL;
  else process.env.GEOFLOW_BASE_URL = originalEnvironmentUrl;
  fs.rmSync(configPath, { force: true });
  if (fs.existsSync(backupPath)) {
    fs.renameSync(backupPath, configPath);
  } else {
    try {
      fs.rmdirSync(dataDir);
    } catch {
      // Keep the directory if another local file exists.
    }
  }
}
