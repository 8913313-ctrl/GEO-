import assert from 'node:assert/strict';
import { PlatformBrowser } from '../src/platform-browser.js';

function failingBlankPage() {
  return {
    url: () => 'about:blank',
    goto: async () => { throw new Error('navigation failed'); },
    title: async () => '',
    bringToFront: async () => {},
  };
}

function browserWith(record) {
  const browser = Object.create(PlatformBrowser.prototype);
  const closed = [];
  browser.profileKey = (_platformId, profileKey = '') => profileKey || 'test-profile';
  browser.isNativeLoginActive = () => false;
  browser.managedPage = async () => record;
  browser.closePage = async (id) => { closed.push(id); return { id, closed: true }; };
  return { browser, closed };
}

{
  const record = { id: 'login-blank', page: failingBlankPage(), url: 'about:blank', title: '' };
  const { browser, closed } = browserWith(record);
  await assert.rejects(
    browser.openLogin('zhihu', { forceManaged: true, profileKey: 'group-a--zhihu' }),
    /navigation failed/,
  );
  assert.deepEqual(closed, ['login-blank'], 'failed managed login navigation must close the blank startup page');
}

{
  const record = { id: 'editor-blank', page: failingBlankPage(), url: 'about:blank', title: '' };
  const { browser, closed } = browserWith(record);
  await assert.rejects(
    browser.openEditor('zhihu', { article: { title: 'test', text: 'body' } }, { profileKey: 'group-a--zhihu' }),
    /navigation failed/,
  );
  assert.deepEqual(closed, ['editor-blank'], 'failed editor navigation must close the blank startup page');
}

console.log('Browser blank-page cleanup checks passed.');
