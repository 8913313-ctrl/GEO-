import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const desktopDirectory = path.resolve(import.meta.dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(desktopDirectory, relativePath), 'utf8');
const electronSource = read('electron-main.mjs');
const preloadSource = read('preload.cjs');
const serviceSource = read('src/main.js');

// Per-run local API authentication stays in the Electron main process and is
// attached at the session boundary. The renderer must never receive the raw
// token or any child-process environment value.
assert.match(electronSource, /const localToken = crypto\.randomBytes\(32\)\.toString\('hex'\)/);
assert.match(electronSource, /TZ_AGENT_LOCAL_TOKEN: localToken/);
assert.match(electronSource, /TZ_AGENT_REQUIRE_LOCAL_TOKEN: '1'/);
assert.match(electronSource, /onBeforeSendHeaders/);
assert.match(electronSource, /requestHeaders\['X-Agent-Token'\] = localToken/);
assert.doesNotMatch(preloadSource, /process\.env|TZ_AGENT_LOCAL_TOKEN|ipcRenderer/,
  'preload must not expose the runtime token or an environment bridge');
assert.match(serviceSource, /crypto\.timingSafeEqual/);
assert.match(serviceSource, /app\.listen\(port, '127\.0\.0\.1'/,
  'the protected API must remain loopback-only');

const healthRoute = serviceSource.indexOf("app.get('/healthz'");
const authBoundary = serviceSource.indexOf('app.use(requireLocalToken)');
const jsonParser = serviceSource.indexOf('app.use(express.json');
const staticAssets = serviceSource.indexOf('app.use(express.static');
assert.ok(healthRoute >= 0 && healthRoute < authBoundary,
  'healthz is the only route intentionally placed before local authentication');
assert.ok(authBoundary >= 0 && authBoundary < jsonParser && authBoundary < staticAssets,
  'authentication must run before request-body parsing and static diagnostic assets');
assert.match(serviceSource, /Content-Security-Policy/);
assert.match(serviceSource, /default-src 'self'/);
assert.match(serviceSource, /object-src 'none'/);
assert.match(serviceSource, /frame-ancestors 'none'/);

// Renderer isolation and navigation boundaries ensure an external page cannot
// turn the automatic local header injection into a privileged API bridge.
assert.match(electronSource, /contextIsolation: true/);
assert.match(electronSource, /sandbox: true/);
assert.match(electronSource, /nodeIntegration: false/);
assert.match(electronSource, /preload: path\.join\(__dirname, 'preload\.cjs'\)/);
assert.match(electronSource, /setWindowOpenHandler\(\(\) => \(\{ action: 'deny' \}\)\)/);
assert.match(electronSource, /will-navigate/);

// The child receives a per-user DPAPI-protected master key in memory. There is
// no production fallback when safeStorage is unavailable or the key is lost.
assert.match(electronSource, /safeStorage\.isEncryptionAvailable\(\)/);
assert.match(electronSource, /master\.key\.enc/);
assert.match(electronSource, /safeStorage\.encryptString/);
assert.match(electronSource, /safeStorage\.decryptString/);
assert.match(electronSource, /TZ_AGENT_MASTER_KEY: masterKey\?\.toString\('base64'\)/);
assert.match(electronSource, /fs\.renameSync\(temporaryPath, keyPath\)/,
  'the DPAPI envelope must be installed atomically');

// A bounded five-minute crash window restarts the Node child with backoff and
// exposes the failure in the tray once the limit is exhausted.
assert.match(electronSource, /const MAX_RESTARTS = 5/);
assert.match(electronSource, /const RESTART_WINDOW_MS = 5 \* 60 \* 1000/);
assert.match(electronSource, /child\.once\('error'/);
assert.match(electronSource, /child\.once\('exit'/);
assert.match(electronSource, /restartTimer = setTimeout/);
assert.match(electronSource, /setServiceTrayState\('recovering'\)/);
assert.match(electronSource, /重新启动本地服务/);
assert.match(electronSource, /TZ_AGENT_CRASH_COUNT/);
assert.match(electronSource, /TZ_AGENT_CRASH_TIMESTAMPS: restartAttempts\.join/,
  'crash telemetry must carry timestamps so the reported rolling count can expire');

console.log('Desktop shell security and crash-recovery contract passed.');
