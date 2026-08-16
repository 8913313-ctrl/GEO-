import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopDir = path.resolve(__dirname, '..');

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function availablePort() {
  const server = http.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  if (!port) throw new Error('Could not reserve a local test port');
  return port;
}

async function waitForHealth(baseUrl) {
  let lastError = null;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(baseUrl + '/healthz');
      if (response.ok) return;
      lastError = new Error('Health check returned HTTP ' + response.status);
    } catch (error) {
      lastError = error;
    }
    await delay(100);
  }
  throw new Error('Test server did not become healthy: ' + String(lastError?.message || lastError));
}

async function waitForExit(child) {
  if (child.exitCode !== null) return;
  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    delay(5000),
  ]);
  if (child.exitCode === null) child.kill('SIGKILL');
}

async function main() {
  const port = await availablePort();
  const dataDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'tongzhuo-agent-acceptance-'));
  const token = crypto.randomBytes(32).toString('hex');
  const child = spawn(process.execPath, ['src/main.js'], {
    cwd: desktopDir,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      TZ_AGENT_PORT: String(port),
      TZ_AGENT_DATA_DIR: dataDirectory,
      TZ_AGENT_LOCAL_TOKEN: token,
      TZ_AGENT_REQUIRE_LOCAL_TOKEN: '1',
      TZ_AGENT_MASTER_KEY: crypto.randomBytes(32).toString('base64'),
    },
    stdio: 'ignore',
    windowsHide: true,
  });

  try {
    const baseUrl = 'http://127.0.0.1:' + port;
    await waitForHealth(baseUrl);

    const health = await fetch(baseUrl + '/healthz');
    assert.equal(health.status, 200, 'health endpoint must remain available to process monitors');

    const unauthenticatedPage = await fetch(baseUrl + '/test.html');
    assert.equal(unauthenticatedPage.status, 401, 'acceptance assets must require the local token');

    const authenticatedPage = await fetch(baseUrl + '/test.html', { headers: { 'X-Agent-Token': token } });
    assert.equal(authenticatedPage.status, 200, 'Electron-injected local token must load the acceptance page');
    const contentSecurityPolicy = authenticatedPage.headers.get('content-security-policy') || '';
    assert.match(contentSecurityPolicy, /default-src 'self'/, 'diagnostic assets must receive the restrictive CSP');
    assert.match(contentSecurityPolicy, /object-src 'none'/, 'diagnostic assets must block plugin/object content');
    assert.match(contentSecurityPolicy, /frame-ancestors 'none'/, 'diagnostic assets must not be embedded by another page');
    assert.equal(authenticatedPage.headers.get('x-frame-options'), 'DENY');
    assert.match(await authenticatedPage.text(), /<script src="\/test\.js" defer><\/script>/, 'acceptance page must load its script from the protected origin');

    const authenticatedScript = await fetch(baseUrl + '/test.js', { headers: { 'X-Agent-Token': token } });
    assert.equal(authenticatedScript.status, 200, 'acceptance script must load with the local token');
    const scriptSource = await authenticatedScript.text();
    assert.equal(scriptSource.includes('1.8.18'), false, 'acceptance page must not pin an obsolete release version');
    assert.equal(scriptSource.includes("platformId === 'zhihu'"), false, 'acceptance page must not special-case Zhihu native login');
    assert.match(scriptSource, /driverMatches/, 'acceptance page must verify the returned browser driver for every platform');
    assert.match(scriptSource, /function renderSummary[\s\S]*?const versionAvailable/, 'acceptance summary must derive its version state locally');

    const status = await fetch(baseUrl + '/api/status', { headers: { 'X-Agent-Token': token } });
    assert.equal(status.status, 200, 'protected API must remain usable through the Electron-injected token');

    const workbenchSource = await fs.readFile(path.join(desktopDir, 'public', 'index.html'), 'utf8');
    assert.match(workbenchSource, /href="\/test\.html"/, 'workbench diagnostics must link to the protected acceptance page');

    const preloadSource = await fs.readFile(path.join(desktopDir, 'preload.cjs'), 'utf8');
    assert.equal(preloadSource.includes('process.env'), false, 'preload must not expose environment values to the renderer');
    const electronSource = await fs.readFile(path.join(desktopDir, 'electron-main.mjs'), 'utf8');
    assert.match(electronSource, /onBeforeSendHeaders/, 'Electron must inject the local token at the session boundary');
    assert.match(electronSource, /requestHeaders\['X-Agent-Token'\] = localToken/, 'Electron must attach the runtime token to local requests');

    console.log('Acceptance page token and cross-platform login checks passed.');
  } finally {
    child.kill('SIGTERM');
    await waitForExit(child);
    await fs.rm(dataDirectory, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error('Acceptance page check failed: ' + error.message);
  process.exitCode = 1;
});
