import { BaseAdapter } from './base-adapter.js';
import {
  adapterResult,
  clickAndConfirm,
  defaultDraftSuccessSelectors,
  detectAccessBlocked,
  fillFirstVisible,
  fillRichContent,
  selectorDetails,
} from './fill-tools.js';
import { submitFinalPublish } from './final-publish.js';

function failed(adapter, page, message, category, extra = {}) {
  return adapterResult(adapter.platform.id, 'failed', message, page, {
    execution_mode: 'dedicated',
    failure_category: category,
    retryable: false,
    next_action: 'operator_inspect_failed_platforms',
    ...extra,
  });
}

function loginRequired(adapter, page, reason = '') {
  return adapterResult(adapter.platform.id, 'awaiting_login', '知乎需要先在本地完成登录、验证码或安全验证。', page, {
    execution_mode: 'dedicated',
    verification_reason: reason,
    next_action: 'operator_login_or_verify_platform',
  });
}

export class ZhihuAdapter extends BaseAdapter {
  async publishDraft(page, article) {
    await this.prepare(page, article);
    const blocked = await detectAccessBlocked(page);
    if (blocked.blocked) return loginRequired(this, page, blocked.reason);

    const title = await fillFirstVisible(page, [
      'textarea[placeholder*="标题"]',
      'textarea[aria-label*="标题"]',
      'input[placeholder*="标题"]',
      '.Input[placeholder*="标题"]',
    ], article.title);
    const body = await fillRichContent(page, [
      '[contenteditable="true"][data-placeholder*="正文"]',
      '[contenteditable="true"][aria-label*="正文"]',
      '.DraftEditor-editorContainer [contenteditable="true"]',
      '.ProseMirror[contenteditable="true"]',
      '[contenteditable="true"]',
    ], article);

    if (!title.ok || !body.ok) {
      return failed(this, page, '知乎未识别到可靠的标题或正文输入区，已停止自动执行。', 'editor_fields_not_recognized', {
        selectors: { title: title.selector || null, body: body.selector || null, draft: null },
        fill: { title: Boolean(title.ok), body: Boolean(body.ok), draft_saved: false },
        selector_details: selectorDetails({ title, body }),
      });
    }

    const saved = await clickAndConfirm(page, [
      'button:has-text("保存草稿")',
      'button:has-text("存草稿")',
    ], defaultDraftSuccessSelectors, { timeout: 2200 });
    const platformAutoSaved = saved.reason === 'action_not_found';
    const draftAction = saved.action || null;
    const draftConfirmation = saved.confirmation || null;
    if (!saved.ok && !platformAutoSaved) {
      if (saved.reason === 'verification_required') return loginRequired(this, page, saved.blocked?.reason || 'verification_after_save');
      return failed(this, page, '知乎未取得草稿保存成功信号，未将任务标记为成功。', `draft_${saved.reason || 'save_failed'}`, {
        selectors: { title: title.selector, body: body.selector, draft: saved.action?.selector || null },
        fill: { title: true, body: true, draft_saved: false },
        selector_details: selectorDetails({ title, body, draft: draftAction, draft_success: draftConfirmation }),
      });
    }

    if (platformAutoSaved && this.platform.execution?.autoSubmit !== true) {
      return failed(this, page, '平台未提供可验证的保存草稿按钮，已按平台自动保存处理但安全停止（未点击最终发布）。', 'draft_action_not_found', {
        selectors: { title: title.selector, body: body.selector, draft: null },
        fill: { title: true, body: true, draft_saved: false, draft_auto_saved: true },
        selector_details: selectorDetails({ title, body, draft: draftAction, draft_success: draftConfirmation }),
      });
    }

    const base = {
      execution_mode: 'dedicated',
      next_action: 'none',
      selectors: {
        title: title.selector,
        body: body.selector,
        draft: draftAction?.selector,
        draft_success: draftConfirmation?.selector,
      },
      fill: { title: true, body: true, body_format: body.format || 'text', images: body.images || 0, draft_saved: !platformAutoSaved, ...(platformAutoSaved ? { draft_auto_saved: true } : {}), draft_save_method: platformAutoSaved ? 'platform_auto_save' : 'explicit_action' },
      selector_details: selectorDetails({ title, body, draft: draftAction, draft_success: draftConfirmation }),
    };

    if (this.platform.execution?.autoSubmit === true) {
      return submitFinalPublish(this, page, base);
    }

    return adapterResult(this.platform.id, 'draft_saved', '知乎已自动填写并确认保存草稿。', page, {
      execution_mode: 'dedicated',
      next_action: 'none',
      selectors: {
        title: title.selector,
        body: body.selector,
        draft: draftAction?.selector,
        draft_success: draftConfirmation?.selector,
      },
      fill: { title: true, body: true, body_format: body.format || 'text', images: body.images || 0, draft_saved: !platformAutoSaved, ...(platformAutoSaved ? { draft_auto_saved: true } : {}), draft_save_method: platformAutoSaved ? 'platform_auto_save' : 'explicit_action' },
      selector_details: selectorDetails({ title, body, draft: draftAction, draft_success: draftConfirmation }),
    });
  }
}
