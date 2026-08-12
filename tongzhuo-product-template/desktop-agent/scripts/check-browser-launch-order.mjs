import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tongzhuo-agent-browser-launch-'));
const original = {
  executable: process.env.TZ_AGENT_BROWSER_EXECUTABLE,
  channel: process.env.TZ_AGENT_BROWSER_CHANNEL,
  bundled: process.env.TZ_AGENT_BUNDLED_BROWSER_EXECUTABLE,
  localAppData: process.env.LOCALAPPDATA,
  programFiles: process.env.PROGRAMFILES,
  programFilesX86: process.env['PROGRAMFILES(X86)'],
};

function restore(name, value) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

function makeExecutable(...segments) {
  const executablePath = path.join(temporaryRoot, ...segments);
  fs.mkdirSync(path.dirname(executablePath), { recursive: true });
  fs.writeFileSync(executablePath, '');
  return executablePath;
}

try {
  const configured = makeExecutable('configured', 'browser.exe');
  const chromeRoot = path.join(temporaryRoot, 'chrome-root');
  const edgeRoot = path.join(temporaryRoot, 'edge-root');
  const bundled = makeExecutable('bundled', 'chrome.exe');
  makeExecutable('chrome-root', 'Google', 'Chrome', 'Application', 'chrome.exe');
  makeExecutable('edge-root', 'Microsoft', 'Edge', 'Application', 'msedge.exe');

  process.env.TZ_AGENT_BROWSER_EXECUTABLE = configured;
  process.env.TZ_AGENT_BROWSER_CHANNEL = '';
  process.env.TZ_AGENT_BUNDLED_BROWSER_EXECUTABLE = bundled;
  process.env.LOCALAPPDATA = chromeRoot;
  process.env.PROGRAMFILES = chromeRoot;
  process.env['PROGRAMFILES(X86)'] = edgeRoot;

  const { browserLaunchCandidatesForTesting } = await import('../src/platform-browser.js');
  const candidates = browserLaunchCandidatesForTesting();
  const labels = candidates.map((candidate) => candidate.label);
  assert.equal(labels[0], '指定浏览器');
  assert.ok(labels.indexOf('Google Chrome') > labels.indexOf('指定浏览器'));
  assert.ok(labels.indexOf('Microsoft Edge') > labels.indexOf('Google Chrome'));
  assert.ok(labels.indexOf('内置发布浏览器') > labels.indexOf('Microsoft Edge'));

  process.env.TZ_AGENT_BROWSER_EXECUTABLE = '';
  const fallbackLabels = browserLaunchCandidatesForTesting().map((candidate) => candidate.label);
  assert.equal(fallbackLabels[0], 'Google Chrome');
  assert.ok(fallbackLabels.indexOf('内置发布浏览器') > fallbackLabels.indexOf('Microsoft Edge'));

  console.log('Browser launch order behavior passed.');
} finally {
  restore('TZ_AGENT_BROWSER_EXECUTABLE', original.executable);
  restore('TZ_AGENT_BROWSER_CHANNEL', original.channel);
  restore('TZ_AGENT_BUNDLED_BROWSER_EXECUTABLE', original.bundled);
  restore('LOCALAPPDATA', original.localAppData);
  restore('PROGRAMFILES', original.programFiles);
  restore('PROGRAMFILES(X86)', original.programFilesX86);
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}