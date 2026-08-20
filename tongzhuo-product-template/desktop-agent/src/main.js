import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { TongzhuoDesktopAgent } from './agent.js';
import { visiblePlatforms } from './platforms.js';
import { agentVersion } from './version.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, '..', 'public');
const agent = new TongzhuoDesktopAgent();
const app = express();
const instanceId = String(process.env.TZ_AGENT_INSTANCE_ID || crypto.randomUUID());
const localToken = String(process.env.TZ_AGENT_LOCAL_TOKEN || '').trim();
let warnedAboutUnauthenticatedApi = false;

app.disable('x-powered-by');
app.use((_request, response, next) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
  next();
});

app.get('/healthz', (_request, response) => {
  response.json({ ok: true, service: 'tongzhuo-geo-desktop-agent', version: agentVersion, instanceId });
});

function tokensMatch(expected, received) {
  if (!expected || !received) return false;
  const expectedBuffer = Buffer.from(expected, 'utf8');
  const receivedBuffer = Buffer.from(received, 'utf8');
  return expectedBuffer.length === receivedBuffer.length && crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

function requireLocalToken(request, response, next) {
  if (!localToken) {
    if (!warnedAboutUnauthenticatedApi) {
      warnedAboutUnauthenticatedApi = true;
      console.warn('[security] TZ_AGENT_LOCAL_TOKEN is not set; /api is unauthenticated development mode');
    }
    const explicitDevelopment = process.env.TZ_AGENT_ALLOW_INSECURE_DEV_API === '1'
      && ['test', 'development'].includes(String(process.env.NODE_ENV || '').toLowerCase());
    if (!explicitDevelopment) {
      response.status(503).json({ ok: false, message: 'Local API token is not configured' });
      return;
    }
    next();
    return;
  }
  if (!tokensMatch(localToken, String(request.get('X-Agent-Token') || ''))) {
    response.status(401).json({ ok: false, message: 'Unauthorized' });
    return;
  }
  next();
}

// Keep the health endpoint available to local process monitors, but require the
// per-run Electron token for every diagnostic asset and API route. In
// particular, do this before body parsing so an unauthenticated process cannot
// make the local service spend work parsing a request body.
app.use(requireLocalToken);
app.use(express.json({ limit: '2mb' }));
app.use(express.static(publicDir));

app.get('/api/status', (_request, response) => {
  response.json({ ok: true, status: agent.publicStatus(), platforms: visiblePlatforms });
});

app.get('/api/account-groups', (_request, response) => {
  response.json({ ok: true, groups: agent.listAccountGroups(), activeGroupId: agent.config.activeGroupId });
});

app.post('/api/account-groups', (request, response) => {
  try {
    response.json({ ok: true, status: agent.createAccountGroup(request.body?.name) });
  } catch (error) {
    response.status(422).json({ ok: false, message: error.message });
  }
});

app.patch('/api/account-groups/:id', (request, response) => {
  try {
    response.json({ ok: true, status: agent.renameAccountGroup(request.params.id, request.body?.name) });
  } catch (error) {
    response.status(422).json({ ok: false, message: error.message });
  }
});

app.post('/api/account-groups/:id/platforms', (request, response) => {
  try {
    response.json({ ok: true, status: agent.assignAccountToGroup(request.params.id, request.body?.platformId, request.body?.accountName) });
  } catch (error) {
    response.status(422).json({ ok: false, message: error.message });
  }
});

app.delete('/api/account-groups/:id/platforms/:platformId', (request, response) => {
  try {
    response.json({ ok: true, status: agent.removeAccountFromGroup(request.params.id, request.params.platformId) });
  } catch (error) {
    response.status(422).json({ ok: false, message: error.message });
  }
});

app.get('/api/diagnostics', async (request, response) => {
  const probe = String(request.query.probe || '0') === '1';
  response.json({ ok: true, diagnostics: await agent.diagnostics({ probe }) });
});

app.get('/api/support-bundle', async (request, response) => {
  const probe = String(request.query.probe || '0') === '1';
  const bundle = await agent.supportBundle({ probe });
  const filename = `tongzhuo-desktop-agent-support-${new Date().toISOString().slice(0, 10)}.json`;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  response.send(JSON.stringify(bundle, null, 2));
});

app.post('/api/config', (request, response) => {
  try {
    response.json({ ok: true, status: agent.configure(request.body || {}) });
  } catch (error) {
    response.status(422).json({ ok: false, message: error.message });
  }
});

app.post('/api/register', async (_request, response) => {
  try {
    response.json({ ok: true, result: await agent.register(), status: agent.publicStatus() });
  } catch (error) {
    response.status(409).json({ ok: false, message: error.message });
  }
});

app.post('/api/logs/clear', (_request, response) => {
  response.json({ ok: true, logs: agent.clearLogs(), status: agent.publicStatus() });
});

app.post('/api/poll', async (_request, response) => {
  try {
    response.json({ ok: true, jobs: await agent.poll(), status: agent.publicStatus() });
  } catch (error) {
    response.status(502).json({ ok: false, message: error.message });
  }
});

app.get('/api/sessions', async (_request, response) => {
  try {
    response.json({ ok: true, sessions: await agent.loadSessions(), status: agent.publicStatus() });
  } catch (error) {
    response.status(502).json({ ok: false, message: error.message });
  }
});

app.get('/api/browser/windows', async (_request, response) => {
  response.json({ ok: true, browser: await agent.browserWindows(), status: agent.publicStatus() });
});

app.post('/api/browser/windows/:id/focus', async (request, response) => {
  try {
    response.json({ ok: true, window: await agent.focusBrowserWindow(request.params.id), status: agent.publicStatus() });
  } catch (error) {
    response.status(409).json({ ok: false, message: error.message });
  }
});

app.delete('/api/browser/windows/:id', async (request, response) => {
  try {
    response.json({ ok: true, window: await agent.closeBrowserWindow(request.params.id), status: agent.publicStatus() });
  } catch (error) {
    response.status(409).json({ ok: false, message: error.message });
  }
});

app.post('/api/platforms/:platform/login', async (request, response) => {
  try {
    response.json({ ok: true, result: await agent.openLogin(request.params.platform, request.body || {}) });
  } catch (error) {
    response.status(409).json({ ok: false, message: error.message });
  }
});

app.post('/api/platforms/:platform/login/check', async (request, response) => {
  try {
    response.json({
      ok: true,
      result: await agent.checkLogin(request.params.platform, request.body || {}),
      status: agent.publicStatus(),
    });
  } catch (error) {
    response.status(409).json({ ok: false, message: error.message });
  }
});

app.post('/api/platforms/:platform/login/confirm', async (request, response) => {
  try {
    response.json({
      ok: true,
      // Backward-compatible alias for older clients.  It still performs a
      // real browser probe, so an API call can never mark an account logged in
      // merely because somebody clicked a confirmation button.
      result: await agent.checkLogin(request.params.platform, request.body || {}),
      status: agent.publicStatus(),
    });
  } catch (error) {
    response.status(409).json({ ok: false, message: error.message });
  }
});

app.post('/api/jobs/:id/run', async (request, response) => {
  try {
    const jobReference = String(request.params.id || '');
    const separator = jobReference.indexOf(':');
    const pathProtocol = separator > 0 ? jobReference.slice(0, separator) : '';
    const result = await agent.runQueuedJob(Number(separator > 0 ? jobReference.slice(separator + 1) : jobReference), request.body?.platforms || [], {
      jobProtocol: request.body?.jobProtocol || request.body?.job_protocol || pathProtocol,
    });
    response.json({ ok: true, result });
  } catch (error) {
    response.status(409).json({ ok: false, message: error.message });
  }
});

const port = Number(agent.config.port) || 19380;
const server = app.listen(port, '127.0.0.1', () => {
  agent.restartTimers();
  if (agent.hasCredential()) {
    agent.heartbeat().catch(() => {});
    agent.poll().catch(() => {});
  }
  console.log(`桐灼 GEO 发布节点已启动：http://127.0.0.1:${port}`);
});

async function shutdown() {
  server.close();
  await agent.shutdown();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
