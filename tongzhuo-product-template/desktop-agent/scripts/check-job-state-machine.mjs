import assert from 'node:assert/strict';
import {
  buildResultPayload,
  classifyExecutionError,
  operatorActions,
  retryDecision,
  summarizePlatformResults,
} from '../src/job-state-machine.js';

const drafts = summarizePlatformResults({
  zhihu: { state: 'draft_saved' },
  wechat_mp: { state: 'draft_saved' },
});
assert.equal(drafts.state, 'draft_saved');
assert.equal(drafts.operator_action, operatorActions.none);
assert.deepEqual(drafts.state_counts, { draft_saved: 2 });
assert.notEqual(drafts.state, 'published', 'saving a draft must never be reported as published');

const published = summarizePlatformResults({
  zhihu: { state: 'published' },
  wechat_mp: { state: 'published' },
});
assert.equal(published.state, 'published');
assert.equal(published.operator_action, operatorActions.none);
assert.deepEqual(published.published_platforms, ['zhihu', 'wechat_mp']);

const mixedSuccess = summarizePlatformResults({
  zhihu: { state: 'published' },
  wechat_mp: { state: 'draft_saved' },
});
assert.equal(mixedSuccess.state, 'draft_saved', 'a saved draft must keep the aggregate out of published');
assert.equal(mixedSuccess.operator_action, operatorActions.none);
assert.notEqual(mixedSuccess.state, 'published');

const partial = summarizePlatformResults({
  zhihu: { state: 'draft_saved' },
  toutiao: { state: 'failed', failure_category: 'adapter_runtime_error' },
});
assert.equal(partial.state, 'failed', 'a single failed target must fail the job instead of awaiting confirmation');
assert.equal(partial.operator_action, operatorActions.inspectFailure);
assert.deepEqual(partial.failed_platforms, ['toutiao']);

const login = summarizePlatformResults({
  zhihu: { state: 'awaiting_login' },
  'zip-download': { state: 'draft_saved' },
});
assert.equal(login.state, 'failed', 'login/captcha/risk blocks must be returned to the backend as a failed job');
assert.equal(login.operator_action, operatorActions.loginRequired);
assert.deepEqual(login.login_required_platforms, ['zhihu']);

const unexpectedManualState = summarizePlatformResults({
  baijiahao: { state: 'awaiting_confirmation' },
});
assert.equal(unexpectedManualState.state, 'failed', 'the automatic path must not leave a job in awaiting_confirmation');
assert.notEqual(unexpectedManualState.state, 'awaiting_confirmation');

const failed = summarizePlatformResults({
  zhihu: { state: 'failed' },
});
assert.equal(failed.state, 'failed');
assert.equal(failed.operator_action, operatorActions.inspectFailure);

const payload = buildResultPayload({
  workerId: 'tz-device-test',
  platformResults: {
    zhihu: { state: 'draft_saved', remote_url: 'https://example.com/draft' },
  },
});
assert.equal(payload.state, 'draft_saved');
assert.equal(payload.worker_id, 'tz-device-test');
assert.equal(payload.remote_url, 'https://example.com/draft');
assert.equal(payload.platform_results.zhihu.platform, 'zhihu');
assert.equal(payload.next_operator_action, operatorActions.none);

const loginPayload = buildResultPayload({
  workerId: 'tz-device-test',
  platformResults: {
    baijiahao: {
      state: 'awaiting_login',
      message: '需要完成验证码或风控验证',
      next_action: 'operator_login_or_verify_platform',
    },
    zhihu: { state: 'draft_saved' },
  },
});
assert.equal(loginPayload.state, 'failed');
assert.equal(loginPayload.next_operator_action, operatorActions.loginRequired);
assert.deepEqual(loginPayload.state_summary.login_required_platforms, ['baijiahao']);
assert.equal(loginPayload.platform_results.baijiahao.state, 'awaiting_login');

assert.deepEqual(classifyExecutionError(new Error('Timeout 30000ms exceeded')), {
  category: 'transient_runtime_error',
  retryable: true,
});
assert.equal(retryDecision(new Error('Timeout 30000ms exceeded'), 1, 2).should_retry, true);
for (const message of [
  'captcha verification required',
  '请完成验证码验证后再试',
  '账号触发风控，请完成安全验证',
  '请先登录平台账号',
]) {
  const decision = retryDecision(new Error(message), 1, 2);
  assert.equal(decision.category, 'operator_action_required', `${message} should be routed to local login/verification`);
  assert.equal(decision.should_retry, false, `${message} must not be retried automatically`);
  assert.equal(decision.next_action, operatorActions.loginRequired);
}

console.log('Job state machine behavior passed.');
