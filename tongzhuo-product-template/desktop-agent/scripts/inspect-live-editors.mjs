import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { findPlatform, visiblePlatforms } from '../src/platforms.js';

const root = path.resolve(import.meta.dirname, '..');
const profilesRoot = path.join(root, '.data', 'profiles');
const executablePath = path.join(root, 'browser-runtime', 'chromium', 'chrome-win64', 'chrome.exe');
const requested = process.argv.slice(2).filter(Boolean);
const ids = requested.length ? requested : visiblePlatforms.map((item) => item.id);

function profileCandidates(id) {
  return [
    `group-default--${id}`,
    id,
    `group-second--${id}`,
  ].map((key) => ({ key, dir: path.join(profilesRoot, key) }))
    .filter((item) => fs.existsSync(item.dir));
}

async function inspect(id, profile) {
  const platform = findPlatform(id);
  if (!platform || platform.hidden) return { id, skipped: true, reason: 'hidden_or_missing' };
  let context;
  try {
    context = await chromium.launchPersistentContext(profile.dir, {
      headless: true,
      executablePath,
      locale: 'zh-CN',
      viewport: { width: 1440, height: 900 },
    });
    const page = context.pages()[0] || await context.newPage();
    await page.goto(platform.editorUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1500);
    const details = await page.evaluate(() => {
      const attrs = (node) => ({
        tag: node.tagName.toLowerCase(),
        id: node.id || '',
        cls: typeof node.className === 'string' ? node.className.slice(0, 180) : '',
        name: node.getAttribute('name') || '',
        type: node.getAttribute('type') || '',
        placeholder: node.getAttribute('placeholder') || node.getAttribute('data-placeholder') || '',
        aria: node.getAttribute('aria-label') || '',
        testid: node.getAttribute('data-testid') || '',
        text: (node.innerText || node.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 100),
      });
      return {
        url: location.href,
        title: document.title,
        fields: [...document.querySelectorAll('input, textarea, [contenteditable="true"]')].slice(0, 80).map(attrs),
        actions: [...document.querySelectorAll('button, [role="button"], a')]
          .filter((node) => node.offsetParent !== null)
          .slice(0, 160)
          .map(attrs),
        bodyText: (document.body?.innerText || '').slice(0, 600),
      };
    });
    return { id, profile: profile.key, ...details };
  } catch (error) {
    return { id, profile: profile.key, error: String(error?.message || error).split('\\n')[0] };
  } finally {
    await context?.close().catch(() => {});
  }
}

const output = [];
for (const id of ids) {
  const candidates = profileCandidates(id);
  if (!candidates.length) {
    output.push({ id, skipped: true, reason: 'profile_not_found' });
    continue;
  }
  output.push(await inspect(id, candidates[0]));
}
console.log(JSON.stringify(output, null, 2));
