import assert from 'node:assert/strict';
import { serializePlatformResult } from '../src/platform-result.js';

const result = serializePlatformResult({
  state: 'draft_saved',
  message: '草稿已保存并收到平台成功信号',
  execution_mode: 'automated',
  next_action: 'none',
  selectors: { title: '#title', body: '.editor', draft: '#save-draft' },
  fill: { title: true, body: true, draft_save_clicked: true, draft_save_verified: true },
});

assert.deepEqual(result, {
  state: 'draft_saved',
  message: '草稿已保存并收到平台成功信号',
  execution_mode: 'automated',
  next_action: 'none',
  selectors: { title: '#title', body: '.editor', draft: '#save-draft' },
  fill: { title: true, body: true, draft_save_clicked: true, draft_save_verified: true },
});

const published = serializePlatformResult({
  state: 'published',
  message: '平台已返回发布成功信号',
  execution_mode: 'automated',
  next_action: 'none',
  remote_url: 'https://example.com/article/123',
});

assert.deepEqual(published, {
  state: 'published',
  message: '平台已返回发布成功信号',
  execution_mode: 'automated',
  next_action: 'none',
  remote_url: 'https://example.com/article/123',
});

const awaitingLogin = serializePlatformResult({
  state: 'awaiting_login',
  message: '请完成验证码或风控验证',
  execution_mode: 'automated',
  next_action: 'operator_login_or_verify_platform',
});

assert.deepEqual(awaitingLogin, {
  state: 'awaiting_login',
  message: '请完成验证码或风控验证',
  execution_mode: 'automated',
  next_action: 'operator_login_or_verify_platform',
});

console.log('Agent result serialization passed.');
