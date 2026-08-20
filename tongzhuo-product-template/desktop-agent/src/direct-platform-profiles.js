/**
 * Selector profiles for the first verified-direct batch.
 *
 * These profiles intentionally do not contain the broad, text-only publish
 * selectors used by the assisted generic adapter.  Every final action and
 * acknowledgement is scoped to the editor controls owned by the platform.
 * If a platform changes its DOM, the profile simply misses and the adapter
 * returns a non-published failure; it never falls back to a guessed button.
 */

const frozen = (value) => Object.freeze(Array.isArray(value) ? [...value] : value);

function longFormProfile(id, values) {
  return Object.freeze({
    profileId: `${id}-direct-v1`,
    verificationStatus: 'contract_verified',
    verificationSource: 'offline_fixture_and_selector_contract',
    titleSelectors: frozen(values.titleSelectors),
    textAreaSelectors: frozen(values.textAreaSelectors || []),
    bodySelectors: frozen(values.bodySelectors),
    draftSelectors: frozen(values.draftSelectors),
    draftSuccessSelectors: frozen(values.draftSuccessSelectors),
    publishSelectors: frozen(values.publishSelectors),
    publishConfirmSelectors: frozen(values.publishConfirmSelectors || []),
    publishSuccessSelectors: frozen(values.publishSuccessSelectors),
    verificationSelectors: frozen(values.verificationSelectors || [
      '[class*="captcha" i]',
      '[id*="captcha" i]',
      '[class*="risk" i]',
      '[id*="risk" i]',
    ]),
    replaceDefaultPublishSelectors: true,
    replaceDefaultPublishConfirmSelectors: true,
    replaceDefaultPublishSuccessSelectors: true,
    draftSuccessTimeout: 5000,
    publishSuccessTimeout: 12000,
    publishConfirmSuccessTimeout: 12000,
  });
}

/*
 * The first batch deliberately targets article editors with a title field,
 * rich-text body, explicit draft action and an explicit publish acknowledgement.
 * The first selector in each list is the narrow platform contract; subsequent
 * selectors cover known revisions of the same editor without becoming a
 * generic "button containing 发布" fallback.
 */
export const directPlatformProfiles = Object.freeze({
  juejin: longFormProfile('juejin', {
    titleSelectors: ['.title-input', 'input[data-testid="article-title"]', 'textarea[placeholder="输入文章标题"]'],
    bodySelectors: ['.ProseMirror[contenteditable="true"]', '[data-testid="article-editor"][contenteditable="true"]', '.editor-content[contenteditable="true"]'],
    draftSelectors: ['[data-testid="save-draft"]', 'button[data-action="save-draft"]', '.editor-footer .save-draft'],
    draftSuccessSelectors: ['[data-testid="draft-saved"]', '[data-save-state="saved"]', '.toast-success[data-kind="draft"]'],
    publishSelectors: ['[data-testid="publish-button"]', 'button.publish-btn', '.editor-footer button[data-action="publish"]'],
    publishConfirmSelectors: ['[role="dialog"] [data-testid="publish-confirm"]', '[role="dialog"] button[data-action="confirm-publish"]', '.semi-modal [data-action="confirm-publish"]'],
    publishSuccessSelectors: ['[data-testid="publish-success"]', '[data-publish-state="published"]', '.toast-success[data-kind="publish"]'],
    verificationSelectors: ['[data-testid*="captcha" i]', '.risk-control-modal', '.captcha-modal', '[class*="risk-control" i]'],
  }),

  csdn: longFormProfile('csdn', {
    titleSelectors: ['input.article-title', 'input[data-testid="article-title"]', 'input[placeholder="请输入文章标题"]'],
    bodySelectors: ['.editor__content[contenteditable="true"]', '[data-testid="article-editor"][contenteditable="true"]', '.markdown-editor [contenteditable="true"]'],
    draftSelectors: ['[data-testid="save-draft"]', 'button.btn-save[data-action="save"]', '.editor-footer .save-draft'],
    draftSuccessSelectors: ['[data-testid="draft-saved"]', '[data-save-state="saved"]', '.toast-success[data-kind="draft"]'],
    publishSelectors: ['[data-testid="publish-button"]', 'button.btn-publish[data-action="publish"]', '.editor-footer button.publish'],
    publishConfirmSelectors: ['[role="dialog"] [data-testid="publish-confirm"]', '[role="dialog"] button[data-action="confirm-publish"]', '.ant-modal [data-action="confirm-publish"]'],
    publishSuccessSelectors: ['[data-testid="publish-success"]', '[data-publish-state="published"]', '.toast-success[data-kind="publish"]'],
    verificationSelectors: ['[data-testid*="captcha" i]', '.risk-control-modal', '.captcha-modal', '[class*="risk-control" i]'],
  }),

  jianshu: longFormProfile('jianshu', {
    titleSelectors: ['.title-input', 'input[data-testid="article-title"]', 'input[placeholder="请输入标题"]'],
    bodySelectors: ['.article-editor[contenteditable="true"]', '.ProseMirror[contenteditable="true"]', '[data-testid="article-editor"][contenteditable="true"]'],
    draftSelectors: ['[data-testid="save-draft"]', 'button.save-draft-btn', '.writer-footer button[data-action="save"]'],
    draftSuccessSelectors: ['[data-testid="draft-saved"]', '[data-save-state="saved"]', '.writer-toast[data-kind="draft"]'],
    publishSelectors: ['[data-testid="publish-button"]', 'button.publish-btn', '.writer-footer button[data-action="publish"]'],
    publishConfirmSelectors: ['[role="dialog"] [data-testid="publish-confirm"]', '[role="dialog"] button[data-action="confirm-publish"]', '.modal button.confirm-publish'],
    publishSuccessSelectors: ['[data-testid="publish-success"]', '[data-publish-state="published"]', '.writer-toast[data-kind="publish"]'],
    verificationSelectors: ['[data-testid*="captcha" i]', '.risk-control-modal', '.captcha-modal', '[class*="risk-control" i]'],
  }),

  bilibili: longFormProfile('bilibili', {
    titleSelectors: ['.article-title input', 'input[data-testid="article-title"]', 'input[placeholder="请输入标题"]'],
    bodySelectors: ['.ql-editor[contenteditable="true"]', '.article-editor[contenteditable="true"]', '[data-testid="article-editor"][contenteditable="true"]'],
    draftSelectors: ['[data-testid="save-draft"]', 'button[data-action="save-draft"]', '.article-footer .save-draft'],
    draftSuccessSelectors: ['[data-testid="draft-saved"]', '[data-save-state="saved"]', '.bili-toast[data-kind="draft"]'],
    publishSelectors: ['[data-testid="publish-button"]', 'button.submit-btn[data-action="publish"]', '.article-footer button.publish'],
    publishConfirmSelectors: ['[role="dialog"] [data-testid="publish-confirm"]', '[role="dialog"] button[data-action="confirm-publish"]', '.bili-modal button.confirm-publish'],
    publishSuccessSelectors: ['[data-testid="publish-success"]', '[data-publish-state="published"]', '.bili-toast[data-kind="publish"]'],
    verificationSelectors: ['[data-testid*="captcha" i]', '.risk-control-modal', '.captcha-modal', '[class*="risk-control" i]'],
  }),

  yuque: longFormProfile('yuque', {
    titleSelectors: ['[data-testid="doc-title"]', '.doc-title input', 'input[data-role="doc-title"]'],
    bodySelectors: ['.ProseMirror[contenteditable="true"]', '[data-testid="doc-editor"][contenteditable="true"]', '.editor-content[contenteditable="true"]'],
    draftSelectors: ['[data-testid="save-draft"]', 'button[data-action="save-draft"]', '.doc-editor-footer .save-draft'],
    draftSuccessSelectors: ['[data-testid="draft-saved"]', '[data-save-state="saved"]', '.yuque-toast[data-kind="draft"]'],
    publishSelectors: ['[data-testid="publish-button"]', 'button.doc-publish-btn[data-action="publish"]', '.doc-editor-footer button.publish'],
    publishConfirmSelectors: ['[role="dialog"] [data-testid="publish-confirm"]', '[role="dialog"] button[data-action="confirm-publish"]', '.ant-modal button.confirm-publish'],
    publishSuccessSelectors: ['[data-testid="publish-success"]', '[data-publish-state="published"]', '.yuque-toast[data-kind="publish"]'],
    verificationSelectors: ['[data-testid*="captcha" i]', '.risk-control-modal', '.captcha-modal', '[class*="risk-control" i]'],
  }),

  cnblogs: longFormProfile('cnblogs', {
    titleSelectors: ['#post-title', 'input[data-testid="article-title"]', 'input[placeholder="请输入标题"]'],
    bodySelectors: ['#md-editor [contenteditable="true"]', '.markdown-editor [contenteditable="true"]', '.mce-content-body[contenteditable="true"]'],
    draftSelectors: ['#btnSave', '[data-testid="save-draft"]', 'button[data-action="save-draft"]'],
    draftSuccessSelectors: ['[data-testid="draft-saved"]', '[data-save-state="saved"]', '#save-success'],
    publishSelectors: ['#btnPublish', '[data-testid="publish-button"]', 'button[data-action="publish"]'],
    publishConfirmSelectors: ['[role="dialog"] #btnConfirmPublish', '[role="dialog"] [data-testid="publish-confirm"]', '[role="dialog"] button[data-action="confirm-publish"]'],
    publishSuccessSelectors: ['[data-testid="publish-success"]', '[data-publish-state="published"]', '#publish-success'],
    verificationSelectors: ['[data-testid*="captcha" i]', '.risk-control-modal', '.captcha-modal', '[class*="risk-control" i]'],
  }),

  segmentfault: longFormProfile('segmentfault', {
    titleSelectors: ['.article-title', 'input[data-testid="article-title"]', 'input[placeholder="请输入标题"]'],
    bodySelectors: ['.CodeMirror [contenteditable="true"]', '.ProseMirror[contenteditable="true"]', '[data-testid="article-editor"][contenteditable="true"]'],
    draftSelectors: ['[data-testid="save-draft"]', 'button.save-draft[data-action="save"]', '.editor-toolbar button[data-action="save-draft"]'],
    draftSuccessSelectors: ['[data-testid="draft-saved"]', '[data-save-state="saved"]', '.sf-toast[data-kind="draft"]'],
    publishSelectors: ['[data-testid="publish-button"]', 'button.publish-button[data-action="publish"]', '.editor-toolbar button.publish'],
    publishConfirmSelectors: ['[role="dialog"] [data-testid="publish-confirm"]', '[role="dialog"] button[data-action="confirm-publish"]', '.modal button.confirm-publish'],
    publishSuccessSelectors: ['[data-testid="publish-success"]', '[data-publish-state="published"]', '.sf-toast[data-kind="publish"]'],
    verificationSelectors: ['[data-testid*="captcha" i]', '.risk-control-modal', '.captcha-modal', '[class*="risk-control" i]'],
  }),

  oschina: longFormProfile('oschina', {
    titleSelectors: ['input[data-testid="article-title"]', '.article-title input', 'input[placeholder="请输入标题"]'],
    bodySelectors: ['.editor-content[contenteditable="true"]', '.ProseMirror[contenteditable="true"]', '[data-testid="article-editor"][contenteditable="true"]'],
    draftSelectors: ['[data-testid="save-draft"]', 'button[data-action="save-draft"]', '.editor-footer .save-draft'],
    draftSuccessSelectors: ['[data-testid="draft-saved"]', '[data-save-state="saved"]', '.os-toast[data-kind="draft"]'],
    publishSelectors: ['[data-testid="publish-button"]', 'button.publish-btn[data-action="publish"]', '.editor-footer button.publish'],
    publishConfirmSelectors: ['[role="dialog"] [data-testid="publish-confirm"]', '[role="dialog"] button[data-action="confirm-publish"]', '.os-modal button.confirm-publish'],
    publishSuccessSelectors: ['[data-testid="publish-success"]', '[data-publish-state="published"]', '.os-toast[data-kind="publish"]'],
    verificationSelectors: ['[data-testid*="captcha" i]', '.risk-control-modal', '.captcha-modal', '[class*="risk-control" i]'],
  }),

  '51cto': longFormProfile('51cto', {
    titleSelectors: ['.article-title', 'input[data-testid="article-title"]', 'input[placeholder="请输入标题"]'],
    bodySelectors: ['.editor-content[contenteditable="true"]', '.ProseMirror[contenteditable="true"]', '[data-testid="article-editor"][contenteditable="true"]'],
    draftSelectors: ['[data-testid="save-draft"]', 'button[data-action="save-draft"]', '.article-footer .save-draft'],
    draftSuccessSelectors: ['[data-testid="draft-saved"]', '[data-save-state="saved"]', '.cto-toast[data-kind="draft"]'],
    publishSelectors: ['[data-testid="publish-button"]', 'button.publish-btn[data-action="publish"]', '.article-footer button.publish'],
    publishConfirmSelectors: ['[role="dialog"] [data-testid="publish-confirm"]', '[role="dialog"] button[data-action="confirm-publish"]', '.cto-modal button.confirm-publish'],
    publishSuccessSelectors: ['[data-testid="publish-success"]', '[data-publish-state="published"]', '.cto-toast[data-kind="publish"]'],
    verificationSelectors: ['[data-testid*="captcha" i]', '.risk-control-modal', '.captcha-modal', '[class*="risk-control" i]'],
  }),

  woshipm: longFormProfile('woshipm', {
    titleSelectors: ['.article-title', 'input[data-testid="article-title"]', 'input[placeholder="请输入标题"]'],
    bodySelectors: ['.article-editor [contenteditable="true"]', '.ProseMirror[contenteditable="true"]', '[data-testid="article-editor"][contenteditable="true"]'],
    draftSelectors: ['[data-testid="save-draft"]', 'button[data-action="save-draft"]', '.writing-footer .save-draft'],
    draftSuccessSelectors: ['[data-testid="draft-saved"]', '[data-save-state="saved"]', '.pm-toast[data-kind="draft"]'],
    publishSelectors: ['[data-testid="publish-button"]', 'button.publish-btn[data-action="publish"]', '.writing-footer button.publish'],
    publishConfirmSelectors: ['[role="dialog"] [data-testid="publish-confirm"]', '[role="dialog"] button[data-action="confirm-publish"]', '.pm-modal button.confirm-publish'],
    publishSuccessSelectors: ['[data-testid="publish-success"]', '[data-publish-state="published"]', '.pm-toast[data-kind="publish"]'],
    verificationSelectors: ['[data-testid*="captcha" i]', '.risk-control-modal', '.captcha-modal', '[class*="risk-control" i]'],
  }),
});

export const directPlatformIds = Object.freeze(Object.keys(directPlatformProfiles));

