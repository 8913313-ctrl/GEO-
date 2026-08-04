import { app, BrowserWindow, Menu, Tray, dialog, nativeImage } from 'electron';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopPort = Number(process.env.TZ_DESKTOP_PORT || 18280);
let mainWindow = null;
let tray = null;
let serviceProcess = null;
let quitting = false;

function desktopLog(message) {
  try {
    const logPath = path.join(app.getPath('userData'), 'desktop-shell.log');
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${message}\n`, 'utf8');
  } catch {
    // Logging should never prevent the desktop app from starting.
  }
}

const traySvg = encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
    <rect width="64" height="64" rx="16" fill="#2563eb"/>
    <path d="M18 17h28v7H26v8h16v7H26v8h20v7H18z" fill="#fff"/>
  </svg>
`);

function trayIcon() {
  return nativeImage.createFromDataURL(`data:image/svg+xml,${traySvg}`).resize({ width: 24, height: 24 });
}

function servicePath() {
  return path.join(app.getAppPath(), 'src', 'main.js');
}

function dataPath() {
  return path.join(app.getPath('userData'), 'data');
}

function startService() {
  desktopLog(`starting local service on ${desktopPort}`);
  serviceProcess = spawn(process.execPath, [servicePath()], {
    cwd: app.getPath('userData'),
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      TZ_AGENT_PORT: String(desktopPort),
      TZ_AGENT_DATA_DIR: dataPath(),
      TZ_AGENT_BROWSER_CHANNEL: process.env.TZ_AGENT_BROWSER_CHANNEL || 'msedge',
    },
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  serviceProcess.stdout?.on('data', () => {});
  serviceProcess.stderr?.on('data', (chunk) => {
    desktopLog(`service stderr: ${String(chunk).trim()}`);
  });
  serviceProcess.on('error', (error) => desktopLog(`service spawn error: ${error.message}`));
  serviceProcess.on('exit', (code, signal) => {
    desktopLog(`service exited: ${signal || code}`);
    if (!quitting && code !== 0) {
      dialog.showErrorBox('桐灼 GEO 发布器', `本地服务已停止（${signal || code}）。请重新启动发布器。`);
    }
  });
}

async function waitForService() {
  const url = `http://127.0.0.1:${desktopPort}/healthz`;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The local Node service may need a few seconds to start.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('本地发布服务启动超时。');
}

function buildTray() {
  tray = new Tray(trayIcon());
  tray.setToolTip('桐灼 GEO 发布器');
  const menu = Menu.buildFromTemplate([
    { label: '打开发布器', click: () => showWindow() },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() },
  ]);
  tray.setContextMenu(menu);
  tray.on('click', () => showWindow());
}

function showWindow() {
  if (!mainWindow) return;
  mainWindow.show();
  mainWindow.focus();
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1080,
    minHeight: 680,
    show: false,
    title: '桐灼 GEO 发布器',
    backgroundColor: '#eef3f9',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
    },
  });
  mainWindow.on('close', (event) => {
    if (!quitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  await mainWindow.loadURL(`http://127.0.0.1:${desktopPort}`);
  mainWindow.show();
}

function stopService() {
  if (!serviceProcess || serviceProcess.killed) return;
  serviceProcess.kill();
  serviceProcess = null;
}

const lock = app.requestSingleInstanceLock();
if (!lock) {
  app.quit();
} else {
  app.on('second-instance', () => showWindow());
  app.whenReady().then(async () => {
    app.setAppUserModelId('cn.tongzhuo.geo.publisher');
    desktopLog('desktop shell ready');
    try {
      startService();
      await waitForService();
      buildTray();
      await createWindow();
    } catch (error) {
      desktopLog(`desktop startup failed: ${error.message}`);
      dialog.showErrorBox('桐灼 GEO 发布器启动失败', error.message);
      app.quit();
    }
  });
  app.on('activate', () => showWindow());
  app.on('before-quit', () => {
    quitting = true;
    stopService();
  });
}
