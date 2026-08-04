import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { TongzhuoDesktopAgent } from './agent.js';
import { platforms } from './platforms.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, '..', 'public');
const agent = new TongzhuoDesktopAgent();
const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));
app.use(express.static(publicDir));

app.get('/healthz', (_request, response) => {
  response.json({ ok: true, service: 'tongzhuo-geo-desktop-agent', status: agent.publicStatus() });
});

app.get('/api/status', (_request, response) => {
  response.json({ ok: true, status: agent.publicStatus(), platforms });
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

app.get('/api/browser/windows', (_request, response) => {
  response.json({ ok: true, browser: agent.browserWindows(), status: agent.publicStatus() });
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
    const result = await agent.runJob(Number(request.params.id), request.body?.platforms || []);
    response.json({ ok: true, result });
  } catch (error) {
    response.status(409).json({ ok: false, message: error.message });
  }
});

const port = Number(agent.config.port) || 18280;
const server = app.listen(port, '127.0.0.1', () => {
  agent.restartTimers();
  if (agent.hasCredential()) {
    agent.heartbeat().catch(() => {});
    agent.poll().catch(() => {});
  }
  console.log(`Tongzhuo GEO 发布节点已启动：http://127.0.0.1:${port}`);
});

async function shutdown() {
  server.close();
  await agent.shutdown();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
