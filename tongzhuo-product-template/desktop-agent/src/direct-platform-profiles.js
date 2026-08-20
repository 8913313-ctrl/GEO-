/**
 * Selector profiles for the verified-direct platform batch.
 *
 * These profiles intentionally do not contain the broad, text-only publish
 * selectors used by the assisted generic adapter.  Every final action and
 * acknowledgement is scoped to the editor controls owned by the platform.
 * If a platform changes its DOM, the profile simply misses and the adapter
 * returns a non-published failure; it never falls back to a guessed button.
 *
 * The first batch (juejin/csdn/jianshu/bilibili/yuque/cnblogs/segmentfault/
 * oschina/51cto/woshipm) was written against documented editor structures.
 * The second batch (baijiahao/xiaohongshu/douyin/douban/sohu/dayu/yidian/
 * imooc/sohufocus/eastmoney/smzdm/netease long-form plus weibo/xueqiu
 * short-post) is inferred from each platform's public editor conventions and
 * the shared editor frameworks those consoles use.  Both batches pass the
 * offline fixture contract; every platform still needs a real-account E2E
 * sign-off before it is relied on for unattended final publication.
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
    draftSelectors: frozen(values.draftSelectors || []),
    draftSuccessSelectors: frozen(values.draftSuccessSelectors || []),
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

function shortPostProfile(id, values) {
  return Object.freeze({
    profileId: `${id}-direct-v1`,
    verificationStatus: 'contract_verified',
    verificationSource: 'offline_fixture_and_selector_contract',
    postSelectors: frozen(values.postSelectors),
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

  /*
   * Second batch: long-form consoles.  Selectors are inferred from the
   * platforms' public editor conventions (title input, Quill/ProseMirror
   * contenteditable body, explicit draft/publish actions).  A miss fails
   * safely instead of guessing a public action.
   */
  baijiahao: longFormProfile('baijiahao', {
    titleSelectors: ['#articleTitle', 'input[placeholder*="标题"]', 'input[name="articleTitle"]'],
    textAreaSelectors: ['textarea[name="content"]', 'textarea#content'],
    bodySelectors: ['.article-content [contenteditable="true"]', '.ql-editor[contenteditable="true"]', '[contenteditable="true"][data-placeholder*="正文"]'],
    draftSelectors: ['button[data-action="save-draft"]', 'button:has-text("存草稿")', '.article-footer button:has-text("存草稿")'],
    draftSuccessSelectors: ['[data-testid="draft-saved"]', '[data-save-state="saved"]', '.toast-success[data-kind="draft"]'],
    publishSelectors: ['button[data-action="publish"]', 'button.publish-btn', 'button[data-testid="publish"]'],
    publishConfirmSelectors: ['[role="dialog"] button[data-action="confirm-publish"]', '[role="dialog"] [data-testid="publish-confirm"]', '.ant-modal [data-action="confirm-publish"]'],
    publishSuccessSelectors: ['[data-testid="publish-success"]', '[data-publish-state="published"]', '.toast-success[data-kind="publish"]'],
    verificationSelectors: ['[data-testid*="captcha" i]', '.risk-control-modal', '.captcha-modal', '[class*="risk-control" i]'],
  }),

  xiaohongshu: longFormProfile('xiaohongshu', {
    titleSelectors: ['#title-input', '.title-input', 'input[placeholder*="标题"]'],
    bodySelectors: ['.ql-editor[contenteditable="true"]', '.ProseMirror[contenteditable="true"]', '[contenteditable="true"][data-placeholder*="正文"]'],
    draftSelectors: [],
    draftSuccessSelectors: [],
    publishSelectors: ['.publish-btn', 'button[data-action="publish"]', 'button[data-testid="publish"]'],
    publishConfirmSelectors: ['[role="dialog"] button[data-action="confirm-publish"]', '[role="dialog"] [data-testid="publish-confirm"]', '.ant-modal [data-action="confirm-publish"]'],
    publishSuccessSelectors: ['[data-testid="publish-success"]', '[data-publish-state="published"]', '.toast-success[data-kind="publish"]'],
    verificationSelectors: ['[data-testid*="captcha" i]', '.risk-control-modal', '.captcha-modal', '[class*="risk-control" i]'],
  }),

  douyin: longFormProfile('douyin', {
    titleSelectors: ['.title-input', 'input[placeholder*="标题"]', 'input[data-testid*="title" i]'],
    bodySelectors: ['.zone-container [contenteditable="true"]', '.ProseMirror[contenteditable="true"]', '[contenteditable="true"][data-placeholder*="正文"]'],
    draftSelectors: [],
    draftSuccessSelectors: [],
    publishSelectors: ['[data-e2e="publish"]', 'button.publish-btn', 'button[data-action="publish"]'],
    publishConfirmSelectors: ['[role="dialog"] button[data-action="confirm-publish"]', '[role="dialog"] [data-testid="publish-confirm"]', '.semi-modal [data-action="confirm-publish"]'],
    publishSuccessSelectors: ['[data-testid="publish-success"]', '[data-publish-state="published"]', '.semi-toast-success:has-text("发布成功")'],
    verificationSelectors: ['[data-testid*="captcha" i]', '.risk-control-modal', '.captcha-modal', '[class*="risk-control" i]'],
  }),

  douban: longFormProfile('douban', {
    titleSelectors: ['input[name="title"]', 'input[placeholder*="标题"]', '#title'],
    textAreaSelectors: ['textarea[name="content"]', 'textarea#content'],
    bodySelectors: ['.ql-editor[contenteditable="true"]', '[contenteditable="true"][data-placeholder*="正文"]', '.note-editor [contenteditable="true"]'],
    draftSelectors: [],
    draftSuccessSelectors: [],
    publishSelectors: ['button:has-text("发布日记")', 'input[type="submit"][value*="发布"]', 'button[data-action="publish"]'],
    publishConfirmSelectors: ['[role="dialog"] button[data-action="confirm-publish"]', '[role="dialog"] [data-testid="publish-confirm"]', '.modal button:has-text("确认发布")'],
    publishSuccessSelectors: ['[data-testid="publish-success"]', '[data-publish-state="published"]', '.toast-success[data-kind="publish"]'],
    verificationSelectors: ['[data-testid*="captcha" i]', '.risk-control-modal', '.captcha-modal', '[class*="risk-control" i]'],
  }),

  sohu: longFormProfile('sohu', {
    titleSelectors: ['#articleTitle', 'input[placeholder*="标题"]', 'input[name="title"]'],
    textAreaSelectors: ['textarea[name="content"]', 'textarea#content'],
    bodySelectors: ['.ql-editor[contenteditable="true"]', '.ProseMirror[contenteditable="true"]', '[contenteditable="true"][data-placeholder*="正文"]'],
    draftSelectors: ['button[data-action="save-draft"]', 'button:has-text("保存草稿")', 'button:has-text("存草稿")'],
    draftSuccessSelectors: ['[data-testid="draft-saved"]', '[data-save-state="saved"]', '.toast-success[data-kind="draft"]'],
    publishSelectors: ['button[data-action="publish"]', 'button.publish-btn', 'button[data-testid="publish"]'],
    publishConfirmSelectors: ['[role="dialog"] button[data-action="confirm-publish"]', '[role="dialog"] [data-testid="publish-confirm"]', '.modal button:has-text("确认发布")'],
    publishSuccessSelectors: ['[data-testid="publish-success"]', '[data-publish-state="published"]', '.toast-success[data-kind="publish"]'],
    verificationSelectors: ['[data-testid*="captcha" i]', '.risk-control-modal', '.captcha-modal', '[class*="risk-control" i]'],
  }),

  dayu: longFormProfile('dayu', {
    titleSelectors: ['#articleTitle', 'input[placeholder*="标题"]', 'input[name="title"]'],
    textAreaSelectors: ['textarea[name="content"]', 'textarea#content'],
    bodySelectors: ['.ql-editor[contenteditable="true"]', '.ProseMirror[contenteditable="true"]', '.article-content [contenteditable="true"]'],
    draftSelectors: ['button[data-action="save-draft"]', 'button:has-text("存草稿")', 'button:has-text("保存草稿")'],
    draftSuccessSelectors: ['[data-testid="draft-saved"]', '[data-save-state="saved"]', '.toast-success[data-kind="draft"]'],
    publishSelectors: ['button[data-action="publish"]', 'button.publish-btn', 'button[data-testid="publish"]'],
    publishConfirmSelectors: ['[role="dialog"] button[data-action="confirm-publish"]', '[role="dialog"] [data-testid="publish-confirm"]', '.modal button:has-text("确认发布")'],
    publishSuccessSelectors: ['[data-testid="publish-success"]', '[data-publish-state="published"]', '.toast-success[data-kind="publish"]'],
    verificationSelectors: ['[data-testid*="captcha" i]', '.risk-control-modal', '.captcha-modal', '[class*="risk-control" i]'],
  }),

  yidian: longFormProfile('yidian', {
    titleSelectors: ['#articleTitle', 'input[placeholder*="标题"]', 'input[name="title"]'],
    textAreaSelectors: ['textarea[name="content"]', 'textarea#content'],
    bodySelectors: ['.ql-editor[contenteditable="true"]', '.ProseMirror[contenteditable="true"]', '[contenteditable="true"][data-placeholder*="正文"]'],
    draftSelectors: ['button[data-action="save-draft"]', 'button:has-text("保存草稿")', 'button:has-text("存草稿")'],
    draftSuccessSelectors: ['[data-testid="draft-saved"]', '[data-save-state="saved"]', '.toast-success[data-kind="draft"]'],
    publishSelectors: ['button[data-action="publish"]', 'button.publish-btn', 'button[data-testid="publish"]'],
    publishConfirmSelectors: ['[role="dialog"] button[data-action="confirm-publish"]', '[role="dialog"] [data-testid="publish-confirm"]', '.modal button:has-text("确认发布")'],
    publishSuccessSelectors: ['[data-testid="publish-success"]', '[data-publish-state="published"]', '.toast-success[data-kind="publish"]'],
    verificationSelectors: ['[data-testid*="captcha" i]', '.risk-control-modal', '.captcha-modal', '[class*="risk-control" i]'],
  }),

  imooc: longFormProfile('imooc', {
    titleSelectors: ['#articleTitle', 'input[placeholder*="标题"]', 'input[name="title"]'],
    textAreaSelectors: ['textarea[name="content"]', 'textarea#content'],
    bodySelectors: ['.ql-editor[contenteditable="true"]', '.ProseMirror[contenteditable="true"]', '[contenteditable="true"][data-placeholder*="正文"]'],
    draftSelectors: ['button[data-action="save-draft"]', 'button:has-text("保存草稿")', 'button:has-text("存草稿")'],
    draftSuccessSelectors: ['[data-testid="draft-saved"]', '[data-save-state="saved"]', '.toast-success[data-kind="draft"]'],
    publishSelectors: ['button[data-action="publish"]', 'button.publish-btn', 'button[data-testid="publish"]'],
    publishConfirmSelectors: ['[role="dialog"] button[data-action="confirm-publish"]', '[role="dialog"] [data-testid="publish-confirm"]', '.modal button:has-text("确认发布")'],
    publishSuccessSelectors: ['[data-testid="publish-success"]', '[data-publish-state="published"]', '.toast-success[data-kind="publish"]'],
    verificationSelectors: ['[data-testid*="captcha" i]', '.risk-control-modal', '.captcha-modal', '[class*="risk-control" i]'],
  }),

  sohufocus: longFormProfile('sohufocus', {
    titleSelectors: ['#articleTitle', 'input[placeholder*="标题"]', 'input[name="title"]'],
    textAreaSelectors: ['textarea[name="content"]', 'textarea#content'],
    bodySelectors: ['.ql-editor[contenteditable="true"]', '.ProseMirror[contenteditable="true"]', '[contenteditable="true"][data-placeholder*="正文"]'],
    draftSelectors: ['button[data-action="save-draft"]', 'button:has-text("保存草稿")', 'button:has-text("存草稿")'],
    draftSuccessSelectors: ['[data-testid="draft-saved"]', '[data-save-state="saved"]', '.toast-success[data-kind="draft"]'],
    publishSelectors: ['button[data-action="publish"]', 'button.publish-btn', 'button[data-testid="publish"]'],
    publishConfirmSelectors: ['[role="dialog"] button[data-action="confirm-publish"]', '[role="dialog"] [data-testid="publish-confirm"]', '.modal button:has-text("确认发布")'],
    publishSuccessSelectors: ['[data-testid="publish-success"]', '[data-publish-state="published"]', '.toast-success[data-kind="publish"]'],
    verificationSelectors: ['[data-testid*="captcha" i]', '.risk-control-modal', '.captcha-modal', '[class*="risk-control" i]'],
  }),

  eastmoney: longFormProfile('eastmoney', {
    titleSelectors: ['#articleTitle', 'input[placeholder*="标题"]', 'input[name="title"]'],
    textAreaSelectors: ['textarea[name="content"]', 'textarea#content'],
    bodySelectors: ['.ql-editor[contenteditable="true"]', '.ProseMirror[contenteditable="true"]', '[contenteditable="true"][data-placeholder*="正文"]'],
    draftSelectors: ['button[data-action="save-draft"]', 'button:has-text("保存草稿")', 'button:has-text("存草稿")'],
    draftSuccessSelectors: ['[data-testid="draft-saved"]', '[data-save-state="saved"]', '.toast-success[data-kind="draft"]'],
    publishSelectors: ['button[data-action="publish"]', 'button.publish-btn', 'button[data-testid="publish"]'],
    publishConfirmSelectors: ['[role="dialog"] button[data-action="confirm-publish"]', '[role="dialog"] [data-testid="publish-confirm"]', '.modal button:has-text("确认发布")'],
    publishSuccessSelectors: ['[data-testid="publish-success"]', '[data-publish-state="published"]', '.toast-success[data-kind="publish"]'],
    verificationSelectors: ['[data-testid*="captcha" i]', '.risk-control-modal', '.captcha-modal', '[class*="risk-control" i]'],
  }),

  smzdm: longFormProfile('smzdm', {
    titleSelectors: ['#articleTitle', 'input[placeholder*="标题"]', 'input[name="title"]'],
    textAreaSelectors: ['textarea[name="content"]', 'textarea#content'],
    bodySelectors: ['.ql-editor[contenteditable="true"]', '[contenteditable="true"][data-placeholder*="正文"]', '.ProseMirror[contenteditable="true"]'],
    draftSelectors: ['button[data-action="save-draft"]', 'button:has-text("保存草稿")', 'button:has-text("存草稿")'],
    draftSuccessSelectors: ['[data-testid="draft-saved"]', '[data-save-state="saved"]', '.toast-success[data-kind="draft"]'],
    publishSelectors: ['button[data-action="publish"]', 'button.publish-btn', 'button[data-testid="publish"]'],
    publishConfirmSelectors: ['[role="dialog"] button[data-action="confirm-publish"]', '[role="dialog"] [data-testid="publish-confirm"]', '.modal button:has-text("确认发布")'],
    publishSuccessSelectors: ['[data-testid="publish-success"]', '[data-publish-state="published"]', '.toast-success[data-kind="publish"]'],
    verificationSelectors: ['[data-testid*="captcha" i]', '.risk-control-modal', '.captcha-modal', '[class*="risk-control" i]'],
  }),

  netease: longFormProfile('netease', {
    titleSelectors: ['#articleTitle', 'input[placeholder*="标题"]', 'input[name="title"]'],
    textAreaSelectors: ['textarea[name="content"]', 'textarea#content'],
    bodySelectors: ['.ql-editor[contenteditable="true"]', '.ProseMirror[contenteditable="true"]', '[contenteditable="true"][data-placeholder*="正文"]'],
    draftSelectors: ['button[data-action="save-draft"]', 'button:has-text("存草稿")', 'button:has-text("保存草稿")'],
    draftSuccessSelectors: ['[data-testid="draft-saved"]', '[data-save-state="saved"]', '.toast-success[data-kind="draft"]'],
    publishSelectors: ['button[data-action="publish"]', 'button.publish-btn', 'button[data-testid="publish"]'],
    publishConfirmSelectors: ['[role="dialog"] button[data-action="confirm-publish"]', '[role="dialog"] [data-testid="publish-confirm"]', '.modal button:has-text("确认发布")'],
    publishSuccessSelectors: ['[data-testid="publish-success"]', '[data-publish-state="published"]', '.toast-success[data-kind="publish"]'],
    verificationSelectors: ['[data-testid*="captcha" i]', '.risk-control-modal', '.captcha-modal', '[class*="risk-control" i]'],
  }),

  /*
   * Second batch: short-post consoles.  These publish a compact text post
   * without a separate title/draft workflow.
   */
  weibo: shortPostProfile('weibo', {
    postSelectors: ['#Composer_TextArea', 'textarea[placeholder*="分享"]', '[contenteditable="true"][role="textbox"]'],
    publishSelectors: ['button.sendbtn', 'button[data-action="publish"]', 'button[data-testid="publish"]'],
    publishConfirmSelectors: ['[role="dialog"] button[data-action="confirm-publish"]', '[role="dialog"] [data-testid="publish-confirm"]', '.modal button:has-text("确认")'],
    publishSuccessSelectors: ['[data-testid="publish-success"]', '[data-publish-state="sent"]', '.woo-toast:has-text("已发布")'],
    verificationSelectors: ['[data-testid*="captcha" i]', '.risk-control-modal', '.captcha-modal', '[class*="risk-control" i]'],
  }),

  xueqiu: shortPostProfile('xueqiu', {
    postSelectors: ['textarea[placeholder*="分享"]', 'textarea[placeholder*="说点什么"]', '[contenteditable="true"][role="textbox"]'],
    publishSelectors: ['button[data-action="publish"]', 'button.publish-btn', 'button[data-testid="publish"]'],
    publishConfirmSelectors: ['[role="dialog"] button[data-action="confirm-publish"]', '[role="dialog"] [data-testid="publish-confirm"]', '.modal button:has-text("确认")'],
    publishSuccessSelectors: ['[data-testid="publish-success"]', '[data-publish-state="sent"]', '.toast-success[data-kind="publish"]'],
    verificationSelectors: ['[data-testid*="captcha" i]', '.risk-control-modal', '.captcha-modal', '[class*="risk-control" i]'],
  }),
});

export const directPlatformIds = Object.freeze(Object.keys(directPlatformProfiles));
export const directShortPostPlatformIds = Object.freeze(
  Object.entries(directPlatformProfiles)
    .filter(([, profile]) => Array.isArray(profile.postSelectors) && profile.postSelectors.length > 0)
    .map(([id]) => id),
);
