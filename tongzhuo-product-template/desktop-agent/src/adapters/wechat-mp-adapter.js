import { BaseAdapter } from './base-adapter.js';
import {
  adapterResult,
  clickAndConfirm,
  clickFirstVisible,
  defaultDraftSuccessSelectors,
  detectAccessBlocked,
  fillFirstVisible,
  fillRichContent,
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
  return adapterResult(adapter.platform.id, 'awaiting_login', '微信公众号需要先在本地完成登录、扫码或安全验证。', page, {
    execution_mode: 'dedicated',
    verification_reason: reason,
    next_action: 'operator_login_or_verify_platform',
  });
}

export class WechatMpAdapter extends BaseAdapter {
  async prepare(page) {
    await page.goto(this.platform.editorUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(1500);
    await clickFirstVisible(page, [
      'text=新的创作',
      'text=写新图文',
      'text=图文消息',
      'a:has-text("图文消息")',
      'button:has-text("图文消息")',
    ]).catch(() => {});
    await page.waitForTimeout(1200);
  }

  async publishDraft(page, article) {
    await this.prepare(page, article);
    const blocked = await detectAccessBlocked(page);
    if (blocked.blocked) return loginRequired(this, page, blocked.reason);

    const title = await fillFirstVisible(page, [
      'textarea[placeholder*="标题"]',
      'input[placeholder*="标题"]',
      '#title',
      '.title_input',
    ], article.title);
    const body = await fillRichContent(page, [
      '#ueditor_0',
      '.rich_media_content[contenteditable="true"]',
      '[contenteditable="true"][data-placeholder*="正文"]',
      '[contenteditable="true"]',
    ], article);

    if (!title.ok || !body.ok) {
      return failed(this, page, '微信公众号未识别到可靠的标题或正文输入区，已停止自动执行。', 'editor_fields_not_recognized', {
        selectors: { title: title.selector || null, body: body.selector || null, draft: null },
        fill: { title: Boolean(title.ok), body: Boolean(body.ok), draft_saved: false },
      });
    }

    const saved = await clickAndConfirm(page, [
      'button:has-text("保存为草稿")',
      'button:has-text("保存草稿")',
      'button:has-text("保存")',
      'a:has-text("保存")',
    ], defaultDraftSuccessSelectors, { timeout: 2200 });
    if (!saved.ok) {
      if (saved.reason === 'verification_required') return loginRequired(this, page, saved.blocked?.reason || 'verification_after_save');
      return failed(this, page, '微信公众号未取得草稿保存成功信号，未将任务标记为成功。', `draft_${saved.reason || 'save_failed'}`, {
        selectors: { title: title.selector, body: body.selector, draft: saved.action?.selector || null },
        fill: { title: true, body: true, draft_saved: false },
      });
    }

    const base = {
      execution_mode: 'dedicated',
      next_action: 'none',
      selectors: {
        title: title.selector,
        body: body.selector,
        draft: saved.action.selector,
        draft_success: saved.confirmation.selector,
      },
      fill: { title: true, body: true, body_format: body.format || 'text', images: body.images || 0, draft_saved: true },
    };

    if (this.platform.execution?.autoSubmit === true) {
      return submitFinalPublish(this, page, base);
    }

    return adapterResult(this.platform.id, 'draft_saved', '微信公众号已自动填写并确认保存草稿。', page, {
      execution_mode: 'dedicated',
      next_action: 'none',
      selectors: {
        title: title.selector,
        body: body.selector,
        draft: saved.action.selector,
        draft_success: saved.confirmation.selector,
      },
      fill: { title: true, body: true, body_format: body.format || 'text', images: body.images || 0, draft_saved: true },
    });
  }
}
