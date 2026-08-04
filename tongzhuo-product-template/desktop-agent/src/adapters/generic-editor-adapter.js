import { BaseAdapter } from './base-adapter.js';
import {
  adapterResult,
  clickAndConfirm,
  defaultDraftSuccessSelectors,
  detectAccessBlocked,
  fillFirstVisible,
  setContentEditable,
} from './fill-tools.js';
import { selectorList, submitFinalPublish } from './final-publish.js';

const defaultTitleSelectors = [
  'input[placeholder*="标题"]',
  'textarea[placeholder*="标题"]',
  'input[aria-label*="标题"]',
  'textarea[aria-label*="标题"]',
  'input[name*="title" i]',
  'textarea[name*="title" i]',
  'input[id*="title" i]',
  'textarea[id*="title" i]',
  '[contenteditable="true"][data-placeholder*="标题"]',
  '[contenteditable="true"][aria-label*="标题"]',
  '[contenteditable="true"][placeholder*="标题"]',
  'h1[contenteditable="true"]',
];

const defaultTextAreaSelectors = [
  'textarea[placeholder*="正文"]',
  'textarea[placeholder*="内容"]',
  'textarea[placeholder*="描述"]',
  'textarea[aria-label*="正文"]',
  'textarea[aria-label*="内容"]',
  'textarea[name*="content" i]',
  'textarea[name*="body" i]',
  'textarea[name*="article" i]',
];

const defaultBodySelectors = [
  '[contenteditable="true"][data-placeholder*="正文"]',
  '[contenteditable="true"][data-placeholder*="内容"]',
  '[contenteditable="true"][data-placeholder*="文章"]',
  '[contenteditable="true"][aria-label*="正文"]',
  '[contenteditable="true"][aria-label*="内容"]',
  '.ProseMirror[contenteditable="true"]',
  '.ql-editor[contenteditable="true"]',
  '.DraftEditor-root [contenteditable="true"]',
  '.DraftEditor-editorContainer [contenteditable="true"]',
  '.CodeMirror [contenteditable="true"]',
  '.toastui-editor-ww-container [contenteditable="true"]',
  '.editor [contenteditable="true"]',
  '.article-editor [contenteditable="true"]',
  '.content-editor [contenteditable="true"]',
  '[contenteditable="true"][role="textbox"]',
  // Last-resort rich-text editor. Exclude common title contenteditables so a
  // generic adapter cannot overwrite a title with the article body.
  '[contenteditable="true"]:not(h1):not([role="heading"]):not([data-placeholder*="标题"]):not([aria-label*="标题"]):not([placeholder*="标题"])',
];

const defaultDraftSelectors = [
  'button:has-text("保存草稿")',
  'button:has-text("存草稿")',
  'button:has-text("保存为草稿")',
  'button:has-text("保存")',
  'button:has-text("暂存")',
  'button:has-text("保存文章")',
  'a:has-text("保存草稿")',
  'a:has-text("保存")',
  '[data-testid*="save" i]',
  '[data-action*="save" i]',
];

function articleBody(article = {}) {
  return String(article.text || article.excerpt || '').trim();
}

function failure(adapter, page, message, failureCategory, extra = {}) {
  return adapterResult(adapter.platform.id, 'failed', message, page, {
    execution_mode: adapter.platform.execution?.mode || 'automated',
    failure_category: failureCategory,
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

/**
 * Generic editors are a direct automation path, not an "open editor and wait"
 * path.  It reports draft_saved only after title/body and a real save-success
 * signal are observed.  Optional final auto-submit is guarded by explicit,
 * per-platform selectors and an explicit autoSubmit opt-in.
 */
export class GenericEditorAdapter extends BaseAdapter {
  titleSelectors() {
    return selectorList(this.platform.editorHints?.titleSelectors, defaultTitleSelectors);
  }

  textAreaSelectors() {
    return selectorList(this.platform.editorHints?.textAreaSelectors, defaultTextAreaSelectors);
  }

  bodySelectors() {
    return selectorList(this.platform.editorHints?.bodySelectors, defaultBodySelectors);
  }

  draftSelectors() {
    return selectorList(this.platform.editorHints?.draftSelectors, defaultDraftSelectors);
  }

  draftSuccessSelectors() {
    return selectorList(this.platform.editorHints?.draftSuccessSelectors, defaultDraftSuccessSelectors);
  }

  async fillBody(page, value) {
    const textarea = await fillFirstVisible(page, this.textAreaSelectors(), value);
    if (textarea.ok) return { ...textarea, kind: 'textarea' };

    const editable = await setContentEditable(page, this.bodySelectors(), value);
    if (editable.ok) return { ...editable, kind: 'contenteditable' };
    return { ok: false };
  }

  async publishDraft(page, article) {
    await this.prepare(page, article);
    const blocked = await detectAccessBlocked(page);
    if (blocked.blocked) return loginRequired(this, page, blocked.reason);

    const titleValue = String(article?.title || '').trim();
    const bodyValue = articleBody(article);
    if (!titleValue || !bodyValue) {
      return failure(this, page, `${this.platform.name} 任务缺少标题或正文，未执行保存。`, 'article_payload_incomplete');
    }

    const title = await fillFirstVisible(page, this.titleSelectors(), titleValue);
    const body = await this.fillBody(page, bodyValue);
    if (!title.ok || !body.ok) {
      return failure(this, page, `${this.platform.name} 未识别到可靠的标题或正文输入区，已停止自动执行。`, 'editor_fields_not_recognized', {
        selectors: { title: title.selector || null, body: body.selector || null, draft: null },
        fill: { title: Boolean(title.ok), body: Boolean(body.ok), draft_saved: false },
      });
    }

    const wantsFinalPublish = this.platform.execution?.autoSubmit === true;
    const saved = await clickAndConfirm(page, this.draftSelectors(), this.draftSuccessSelectors(), {
      timeout: this.platform.editorHints?.draftSuccessTimeout ?? 2200,
    });
    const draftIsOptional = wantsFinalPublish && ['action_not_found', 'success_not_confirmed'].includes(saved.reason);
    if (!saved.ok && !draftIsOptional) {
      if (saved.reason === 'verification_required') return loginRequired(this, page, saved.blocked?.reason || 'verification_after_save');
      return failure(this, page, `${this.platform.name} 未取得草稿保存成功信号，未将任务标记为成功。`, `draft_${saved.reason || 'save_failed'}`, {
        selectors: {
          title: title.selector,
          body: body.selector,
          draft: saved.action?.selector || null,
        },
        fill: { title: true, body: true, draft_saved: false },
      });
    }

    const base = {
      execution_mode: this.platform.execution?.mode || 'automated',
      next_action: 'none',
      selectors: {
        title: title.selector,
        body: body.selector,
        draft: saved.action?.selector || null,
        draft_success: saved.confirmation?.selector || null,
      },
      fill: { title: true, body: true, draft_saved: Boolean(saved.ok) },
    };

    if (!wantsFinalPublish) {
      return adapterResult(this.platform.id, 'draft_saved', `${this.platform.name} 已自动填写并确认保存草稿。`, page, base);
    }

    return submitFinalPublish(this, page, base);

    if (!this.hasAutoSubmitConfiguration()) {
      return failure(this, page, `${this.platform.name} 未配置已验证的自动提交选择器，草稿已保存但未冒充发布成功。`, 'auto_submit_not_configured', base);
    }

    const hints = this.platform.editorHints;
    const submitted = await clickAndConfirm(page, hints.publishSelectors, hints.publishSuccessSelectors, {
      timeout: hints.publishSuccessTimeout ?? 3000,
    });
    if (!submitted.ok) {
      if (submitted.reason === 'verification_required') return loginRequired(this, page, submitted.blocked?.reason || 'verification_after_submit');
      return failure(this, page, `${this.platform.name} 未取得发布成功信号，未将任务标记为已发布。`, `publish_${submitted.reason || 'submit_failed'}`, {
        ...base,
        selectors: { ...base.selectors, publish: submitted.action?.selector || null },
      });
    }

    return adapterResult(this.platform.id, 'published', `${this.platform.name} 已自动提交并确认平台返回成功。`, page, {
      ...base,
      selectors: {
        ...base.selectors,
        publish: submitted.action.selector,
        publish_success: submitted.confirmation.selector,
      },
      fill: { ...base.fill, published: true },
    });
  }
}
