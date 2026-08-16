import { BaseAdapter } from './base-adapter.js';
import { adapterResult, detectAccessBlocked, selectorDetails, setContentEditable, typeIntoFirstVisible } from './fill-tools.js';
import { selectorList, submitFinalPublish } from './final-publish.js';

const defaultPostSelectors = [
  '[data-testid="tweetTextarea_0"]',
  '[data-testid*="tweetTextarea"]',
  '[role="textbox"][data-testid*="tweetTextarea"]',
  'div[contenteditable="true"][data-testid*="tweetTextarea"]',
  'div[aria-label*="Post text"]',
  'div[aria-label*="Tweet text"]',
  'textarea[aria-label*="Post"]',
  'textarea[aria-label*="Tweet"]',
  '[contenteditable="true"][role="textbox"]',
  '[contenteditable="true"]',
];

function compactPost(article = {}, limit = 260) {
  const title = String(article.title || '').trim();
  const body = String(article.excerpt || article.text || '').trim();
  const text = [title, body].filter(Boolean).join('\n\n').replace(/\n{3,}/g, '\n\n');
  const chars = [...text];
  return chars.length > limit ? `${chars.slice(0, Math.max(0, limit - 1)).join('')}…` : text;
}

function failed(adapter, page, message, category, extra = {}) {
  return adapterResult(adapter.platform.id, 'failed', message, page, {
    execution_mode: adapter.platform.execution?.mode || 'automated',
    failure_category: category,
    retryable: false,
    next_action: 'operator_inspect_failed_platforms',
    ...extra,
  });
}

function loginRequired(adapter, page, reason = '') {
  return adapterResult(adapter.platform.id, 'awaiting_login', `${adapter.platform.name} 需要先在本地完成登录、验证码或安全验证。`, page, {
    execution_mode: adapter.platform.execution?.mode || 'automated',
    verification_reason: reason,
    next_action: 'operator_login_or_verify_platform',
  });
}

export class ShortPostAdapter extends BaseAdapter {
  postSelectors() {
    return selectorList(this.platform.editorHints?.postSelectors || this.platform.editorHints?.bodySelectors, defaultPostSelectors);
  }

  async publishDraft(page, article) {
    await this.prepare(page, article);
    const blocked = await detectAccessBlocked(page);
    if (blocked.blocked) return loginRequired(this, page, blocked.reason);

    const value = compactPost(article, this.platform.editorHints?.postCharacterLimit ?? 260);
    if (!value) {
      return failed(this, page, `${this.platform.name} 任务缺少可发布内容，未执行自动发布。`, 'article_payload_incomplete');
    }

    const typed = await typeIntoFirstVisible(page, this.postSelectors(), value).catch(() => ({ ok: false }));
    const filled = typed.ok ? typed : await setContentEditable(page, this.postSelectors(), value);
    if (!filled.ok) {
      return failed(this, page, `${this.platform.name} 未识别到可发布的短帖输入区，已停止自动执行。`, 'editor_fields_not_recognized', {
        selectors: { body: null, publish: null },
        fill: { body: false, published: false },
        selector_details: selectorDetails({ body: filled }),
      });
    }

    const base = {
      execution_mode: this.platform.execution?.mode || 'automated',
      next_action: 'operator_confirm_publish',
      selectors: { body: filled.selector, publish: null },
      fill: { body: true, published: false, draft_saved: false },
      selector_details: selectorDetails({ body: filled }),
    };
    if (this.platform.execution?.autoSubmit !== true) {
      return adapterResult(this.platform.id, 'awaiting_confirmation', `${this.platform.name} content is ready; operator confirmation is required before public submission.`, page, base);
    }

    return submitFinalPublish(this, page, {
      execution_mode: this.platform.execution?.mode || 'automated',
      next_action: 'none',
      selectors: { body: filled.selector },
      fill: { body: true, draft_saved: false },
      selector_details: selectorDetails({ body: filled }),
    });
  }
}
