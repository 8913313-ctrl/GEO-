import { app, BrowserWindow, Menu, Tray, dialog, nativeImage, safeStorage, session } from 'electron';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopPort = Number(process.env.TZ_DESKTOP_PORT || 18280);
const instanceId = crypto.randomUUID();
const localToken = crypto.randomBytes(32).toString('hex');
let masterKey = null;
let mainWindow = null;
let tray = null;
let serviceProcess = null;
let quitting = false;
let restartTimer = null;
let restartAttempts = [];
const MAX_RESTARTS = 5;
const RESTART_WINDOW_MS = 5 * 60 * 1000;

function desktopLog(message) {
  try {
    const logPath = path.join(app.getPath('userData'), 'desktop-shell.log');
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${message}\n`, 'utf8');
  } catch {}
}

const traySvg = encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" rx="16" fill="#2563eb"/><path d="M18 17h28v7H26v8h16v7H26v8h20v7H18z" fill="#fff"/></svg>');
function resourcePath(...segments) { return path.join(app.isPackaged ? process.resourcesPath : __dirname, ...segments); }
function applicationIcon() {
  const iconPath = resourcePath('assets', 'tongzhuo-geo-publisher.ico');
  if (fs.existsSync(iconPath)) { const icon = nativeImage.createFromPath(iconPath); if (!icon.isEmpty()) return icon; }
  return nativeImage.createFromDataURL(`data:image/svg+xml,${traySvg}`);
}
function trayIcon() { return applicationIcon().resize({ width: 24, height: 24 }); }
function bundledBrowserExecutable() {
  const executablePath = resourcePath('browser-runtime', 'chromium', 'chrome-win64', 'chrome.exe');
  return fs.existsSync(executablePath) ? executablePath : '';
}
function servicePath() { return path.join(app.getAppPath(), 'src', 'main.js'); }
function dataPath() { return path.join(app.getPath('userData'), 'data'); }

function loadMasterKey() {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('系统凭据保护不可用，无法安全启动本地服务');
  const keyPath = path.join(app.getPath('userData'), 'master.key.enc');
  if (fs.existsSync(keyPath)) {
    const encrypted = fs.readFileSync(keyPath);
    masterKey = Buffer.from(safeStorage.decryptString(encrypted), 'base64');
    if (masterKey.length !== 32) throw new Error('主密钥文件无效');
    return;
  }
  const configPath = path.join(dataPath(), 'config.json');
  if (fs.existsSync(configPath)) {
    const stored = JSON.parse(fs.readFileSync(configPath, 'utf8').replace(/^\uFEFF/, ''));
    const sensitiveFields = ['apiToken', 'pairingToken', 'deviceSecret', 'pairingCode'];
    const encryptedConfig = sensitiveFields.some((field) => stored?.[field] && typeof stored[field] === 'object');
    if (encryptedConfig) throw new Error('主密钥文件缺失，无法解密现有配置；已停止启动以保护账号凭据');
  }
  masterKey = crypto.randomBytes(32);
  const encrypted = safeStorage.encryptString(masterKey.toString('base64'));
  const temporaryPath = `${keyPath}.tmp-${process.pid}`;
  fs.writeFileSync(temporaryPath, encrypted, { mode: 0o600 });
  fs.renameSync(temporaryPath, keyPath);
}

function serviceEnvironment() {
  return {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
    NODE_ENV: process.env.NODE_ENV || 'production',
    TZ_AGENT_PORT: String(desktopPort),
    TZ_AGENT_DATA_DIR: dataPath(),
    TZ_AGENT_BROWSER_EXECUTABLE: process.env.TZ_AGENT_BROWSER_EXECUTABLE || '',
    TZ_AGENT_BROWSER_CHANNEL: process.env.TZ_AGENT_BROWSER_CHANNEL || '',
    TZ_AGENT_BUNDLED_BROWSER_EXECUTABLE: bundledBrowserExecutable(),
    TZ_AGENT_LOCAL_TOKEN: localToken,
    TZ_AGENT_INSTANCE_ID: instanceId,
    TZ_AGENT_MASTER_KEY: masterKey?.toString('base64') || '',
    TZ_AGENT_REQUIRE_LOCAL_TOKEN: '1',
    TZ_AGENT_CRASH_COUNT: String(restartAttempts.length),
    TZ_AGENT_CRASH_WINDOW_SECONDS: String(Math.round(RESTART_WINDOW_MS / 1000)),
  };
}

function startService() {
  if (quitting) return;
  desktopLog(`starting local service on ${desktopPort}`);
  const child = spawn(process.execPath, [servicePath()], {
    cwd: app.getPath('userData'), env: serviceEnvironment(), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  serviceProcess = child;
  child.stdout?.on('data', () => {});
  child.stderr?.on('data', (chunk) => desktopLog(`service stderr: ${String(chunk).trim()}`));
  let handled = false;
  const scheduleRecovery = (reason) => {
    if (handled || quitting) return;
    handled = true;
    desktopLog(`service recovery requested: ${reason}`);
    restartAttempts = restartAttempts.filter((time) => Date.now() - time < RESTART_WINDOW_MS);
    if (restartAttempts.length >= MAX_RESTARTS) {
      desktopLog('service recovery stopped after repeated crashes');
      tray?.setToolTip('桐灼 GEO 发布器（本地服务已停止）');
      tray?.setContextMenu(Menu.buildFromTemplate([
        { label: '重新启动本地服务', click: () => { restartAttempts = []; startService(); } },
        { label: '退出', click: () => app.quit() },
      ]));
      dialog.showErrorBox('桐灼 GEO 发布器', '本地服务连续崩溃，已停止自动恢复。可从托盘菜单重新启动本地服务。');
      return;
    }
    restartAttempts.push(Date.now());
    const delay = Math.min(15000, 1000 * (2 ** Math.min(restartAttempts.length - 1, 4)));
    restartTimer = setTimeout(() => { restartTimer = null; if (!quitting) startService(); }, delay);
  };
  child.once('error', (error) => { desktopLog('service spawn error: ' + error.message); if (serviceProcess === child) serviceProcess = null; scheduleRecovery('spawn-error'); });
  child.once('exit', (code, signal) => { desktopLog('service exited: ' + (signal || code)); if (serviceProcess === child) serviceProcess = null; scheduleRecovery('exit-' + (signal || code)); });
}

async function waitForService() {
  const url = `http://127.0.0.1:${desktopPort}/healthz`;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        const body = await response.json().catch(() => ({}));
        if (body.instanceId === instanceId) return;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('本地发布服务启动超时。');
}

function configureLocalHeaderInjection() {
  const filter = { urls: [`http://127.0.0.1:${desktopPort}/*`] };
  session.defaultSession.webRequest.onBeforeSendHeaders(filter, (details, callback) => {
    details.requestHeaders['X-Agent-Token'] = localToken;
    callback({ requestHeaders: details.requestHeaders });
  });
}
function buildTray() {
  tray = new Tray(trayIcon());
  tray.setToolTip('桐灼 GEO 发布器');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '打开发布器', click: () => showWindow() },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() },
  ]));
  tray.on('click', () => showWindow());
}
function showWindow() { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } }

async function createWindow() {
  const allowedOrigin = `http://127.0.0.1:${desktopPort}`;
  mainWindow = new BrowserWindow({
    width: 1440, height: 920, minWidth: 1080, minHeight: 680, show: false,
    title: 'Tongzhuo GEO Publisher', icon: applicationIcon(), backgroundColor: '#eef3f9', autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false, preload: path.join(__dirname, 'preload.cjs') },
  });
  mainWindow.on('close', (event) => { if (!quitting) { event.preventDefault(); mainWindow.hide(); } });
  mainWindow.on('closed', () => { mainWindow = null; });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, url) => { if (!url.startsWith(`${allowedOrigin}/`)) event.preventDefault(); });
  await mainWindow.loadURL(allowedOrigin);
  mainWindow.show();
}
function stopService() {
  if (restartTimer) { clearTimeout(restartTimer); restartTimer = null; }
  if (!serviceProcess || serviceProcess.killed) return;
  serviceProcess.kill(); serviceProcess = null;
}

const lock = app.requestSingleInstanceLock();
if (!lock) { app.quit(); } else {
  app.on('second-instance', () => showWindow());
  app.whenReady().then(async () => {
    app.setAppUserModelId('cn.tongzhuo.geo.publisher');
    try {
      loadMasterKey(); configureLocalHeaderInjection(); desktopLog(`desktop shell ready (${instanceId})`);
      startService(); await waitForService(); buildTray(); await createWindow();
    } catch (error) {
      desktopLog(`desktop startup failed: ${error.message}`);
      dialog.showErrorBox('桐灼 GEO 发布器启动失败', error.message);
      app.quit();
    }
  });
  app.on('activate', () => showWindow());
  app.on('before-quit', () => { quitting = true; stopService(); });
}
