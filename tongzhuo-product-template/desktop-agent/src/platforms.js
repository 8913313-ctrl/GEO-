const fallbackUrl = 'about:blank';

// Login detection is a separate capability from editor automation.  Keep the
// positive account markers beside the platform catalog so the native-browser
// observer, post-close profile probe and future extension bridge all consume
// the same contract. Presence selectors are limited to account-only controls
// such as logout links; visible selectors target the global account area, not
// article-author avatars in the page body.
const defaultSessionPresenceSelectors = Object.freeze([
  'a[href*="logout" i]',
  'a[href*="signout" i]',
  'a[href*="log-out" i]',
  'form[action*="logout" i]',
]);

const platformLoginSignals = Object.freeze({
  wechat_mp: {
    // .weui-desktop-layout is also present on the unauthenticated QR/login
    // shell, so it must never be used as a positive account signal.
    visible: ['#js_home', '.weui-desktop-account'],
    // The login shell and /cgi-bin/bizlogin are unauthenticated. Only the
    // concrete home path is a positive URL signal.
    urlPrefixes: ['https://mp.weixin.qq.com/cgi-bin/home'],
  },
  zhihu: { visible: ['[data-za-detail-view-element_name="Avatar"]', '.AppHeader-profile'] },
  toutiao: { visible: ['.user-panel .user-auth-avator', '.user-auth-avator', '.article-title input', '.title-input'] },
  baijiahao: {
    visible: ['[class*="client-user" i]', '[class*="user-info" i] [class*="avatar" i]', 'a[href*="/builder/rc/edit"]'],
    urlPrefixes: ['https://baijiahao.baidu.com/builder/'],
  },
  xiaohongshu: { visible: ['[class*="user-info" i] [class*="avatar" i]', '[class*="header" i] [class*="avatar" i]', 'a[href*="/new/"]'] },
  weibo: { visible: ['header [class*="avatar" i]', '[class*="woo-avatar" i]', 'a[href*="/u/"][title]'] },
  juejin: { visible: ['header [class*="avatar" i]', '.user-action [class*="avatar" i]', 'a[href*="/user/"] [class*="avatar" i]'] },
  csdn: { visible: ['#toolbar-remind', '.toolbar-avatar', '#csdn-toolbar [class*="avatar" i]'] },
  jianshu: { visible: ['nav .user .avatar', '.user .avatar img', 'a[href="/writer"]'] },
  douyin: { visible: ['[class*="header" i] [class*="avatar" i]', '[class*="user-info" i] [class*="avatar" i]', 'a[href*="content/upload"]'] },
  bilibili: {
    visible: ['.header a.avatar.el-popover__reference', '.header-avatar-wrap', '.bili-header .bili-avatar', 'a[href*="/platform/home"]'],
    present: ['.header .logout'],
  },
  yuque: { visible: ['[data-testid*="avatar" i]', 'header .ant-avatar', 'a[href*="/dashboard"]'] },
  douban: { visible: ['.nav-user-account', '#db-global-nav .bn-more', 'a[href*="/mine/"]'] },
  sohu: { visible: ['#header-user .user-pic', '#header-user', '.user-wrap .user-head', '[class*="header" i] [class*="avatar" i]', '[class*="user-info" i] [class*="avatar" i]', 'a[href*="/mpfe/v3/"]'] },
  xueqiu: { visible: ['.nav__user', '[class*="user-name" i]', 'header a[href*="/u/"]'] },
  woshipm: {
    visible: ['.pm--metabar__dropdown > img.avatar', '.pm--userCard__dropdown .userCard--avatar'],
    present: ['.pm--userCard__dropdown a[href="/user/exit"]', 'a[href="/me/posts"]'],
  },
  dayu: { visible: ['[class*="header" i] [class*="avatar" i]', '[class*="user-info" i] [class*="avatar" i]', 'a[href*="/dashboard"]'] },
  yidian: { visible: ['[class*="header" i] [class*="avatar" i]', '[class*="user-info" i] [class*="avatar" i]', 'a[href*="Writing" i]'] },
  '51cto': { visible: ['[class*="user-head" i]', '[class*="user_avatar" i]', 'header a[href*="/user/"]'] },
  imooc: { visible: ['.g-user-card', '.user-card-box', '#header-avator'] },
  oschina: { visible: ['header [class*="avatar" i]', '.user-info [class*="avatar" i]', 'a[href*="/u/"] [class*="avatar" i]'] },
  segmentfault: { visible: ['[class*="global-nav" i] [class*="avatar" i]', '.user-avatar', 'header a[href*="/u/"]'] },
  cnblogs: { visible: ['.top-nav', '.nav-header', '#user_nav_blog_link', '#user_nav_newpost', '#user_nav_logout'] },
  sohufocus: { visible: ['[class*="header" i] [class*="avatar" i]', '[class*="user-info" i] [class*="avatar" i]', 'a[href*="/user/"]'] },
  x: { visible: ['[data-testid="SideNav_AccountSwitcher_Button"]', '[data-testid="tweetTextarea_0"]'] },
  eastmoney: { visible: ['#topnav_login', '#topnavi_unick', '#ul_userimg', '#userInfo', '[class*="header" i] [class*="avatar" i]', 'a[href*="caifuhao.eastmoney.com"] [class*="avatar" i]'] },
  smzdm: {
    visible: ['.J_user_info', '[class*="user_info" i] [class*="avatar" i]', 'header a[href*="/user/"]'],
    probeMode: 'native_window_only',
  },
  netease: {
    visible: ['[class*="header" i] [class*="avatar" i]', '[class*="user-info" i] [class*="avatar" i]', 'a[href*="article-publish" i]'],
    // NetEase redirects saved sessions to /login.html under headless Chromium
    // even when the same dedicated profile is authenticated in normal Chrome.
    // Observe the operator's visible window instead of manufacturing a logout.
    probeMode: 'native_window_only',
  },
});

// Final-publication selectors are intentionally platform-scoped. Generic
// text selectors such as button:has-text("发布") can also match preview,
// schedule, or settings actions in these editors, so direct jobs must opt in
// to this narrower list and require a fresh success signal.
const dedicatedEditorHints = Object.freeze({
  wechat_mp: Object.freeze({
    publishSelectors: Object.freeze([
      '#js_submit',
      '#js_publish',
      '[data-action="publish"][data-platform="wechat"]',
      'button:has-text("群发")',
      '#publish-article',
    ]),
    publishConfirmSelectors: Object.freeze([
      '#js_publish_confirm',
      '[data-action="confirm-publish"]',
      '[role="dialog"] [data-testid="publish-confirm"]',
    ]),
    publishSuccessSelectors: Object.freeze([
      '#js_publish_success',
      '[data-testid="publish-success"]',
      '[data-publish-state="published"]',
      '.weui-desktop-toast:has-text("群发成功")',
      '.weui-desktop-toast:has-text("发布成功")',
      '#publish-success',
    ]),
    replaceDefaultPublishSelectors: true,
    replaceDefaultPublishSuccessSelectors: true,
    publishSuccessTimeout: 15000,
  }),
  zhihu: Object.freeze({
    publishSelectors: Object.freeze([
      '[data-za-detail-view-element_name="PublishButton"]',
      '[data-testid="publish-button"]',
      'button.PublishPanel-button',
      '.PublishPanel button[type="button"]:not([aria-label*="定时"])',
      '.PublishPanel button:has-text("发布"):not(:has-text("定时")):not(:has-text("设置"))',
      '[role="button"]:has-text("发布"):not(:has-text("定时")):not(:has-text("设置"))',
      '#publish-article',
    ]),
    publishConfirmSelectors: Object.freeze([
      '[role="dialog"] [data-testid="publish-confirm"]',
      '[role="dialog"] [data-za-detail-view-element_name="PublishButton"]',
      '#publish-confirm',
    ]),
    publishSuccessSelectors: Object.freeze([
      '[data-testid="publish-success"]',
      '[data-publish-state="published"]',
      '[data-publish-state="submitted"]',
      '.ant-message-success:has-text("发布成功")',
      '.Message--success:has-text("发布成功")',
      '#publish-success',
    ]),
    replaceDefaultPublishSelectors: true,
    replaceDefaultPublishSuccessSelectors: true,
    publishSuccessTimeout: 15000,
  }),
  toutiao: Object.freeze({
    publishSelectors: Object.freeze([
      '[data-testid="publish-button"]',
      '[data-action="publish-article"]',
      '.article-publish-btn',
      '.publish-btn',
      'button:has-text("预览并发布")',
      '#publish-article',
    ]),
    publishConfirmSelectors: Object.freeze([
      '[role="dialog"] [data-testid="publish-confirm"]',
      '[role="dialog"] [data-action="confirm-publish"]',
      '[role="dialog"] button:has-text("确认发布")',
      '.semi-modal button:has-text("确认发布")',
      '#confirm-dialog button',
    ]),
    publishSuccessSelectors: Object.freeze([
      '[data-testid="publish-success"]',
      '[data-publish-state="published"]',
      '.publish-success',
      '.semi-toast-success:has-text("发布成功")',
      '#publish-success',
    ]),
    replaceDefaultPublishSelectors: true,
    replaceDefaultPublishSuccessSelectors: true,
    publishSuccessTimeout: 15000,
  }),
});

/*
 * Every platform listed as `ready` can receive a job directly from GEOFlow
 * after a local account profile has been confirmed.  The execution mode tells
 * the local agent how much of the editor is selector-tested:
 *
 * - dedicated: a platform-specific adapter owns the selectors;
 * - automated: a live-verified adapter may submit a final publish action;
 * - assisted: the generic adapter may fill and save a draft, but never clicks
 *   a final public-publish action until that platform has passed real E2E
 *   verification and receives a dedicated/verified adapter;
 * - planned: do not advertise or execute it yet.
 *
 * `autoSubmit` enables the final public publish/submit-review step.  The
 * adapters still require a visible platform success signal before reporting a
 * job as published, so a button click alone is never treated as publication.
 */
const dedicatedExecution = Object.freeze({
  mode: 'dedicated',
  login: 'local_profile',
  editor: 'open_and_fill',
  draft: 'auto_save_and_verify',
  publish: 'auto_submit_when_verified',
  autoSubmit: true,
});

const automatedExecution = Object.freeze({
  mode: 'automated',
  login: 'local_profile',
  editor: 'open_and_fill',
  draft: 'auto_save_and_verify',
  publish: 'auto_submit_when_verified',
  autoSubmit: true,
});
// A generic selector contract is useful for local draft preparation, but it is
// not proof that a third-party editor will accept a final public submission.
// Keep unverified channels in this mode so an editor redesign cannot turn a
// broad action selector into an unintended public post.
const assistedExecution = Object.freeze({
  mode: 'assisted',
  login: 'native_profile_preferred',
  editor: 'open_and_fill',
  draft: 'auto_save_and_verify',
  publish: 'operator_confirm_required_until_live_verified',
  autoSubmit: false,
  liveVerification: 'required',
});

const plannedExecution = Object.freeze({
  mode: 'planned',
  login: 'not_available',
  editor: 'not_available',
  draft: 'not_available',
  publish: 'not_available',
});

function publishingPlatform(id, name, loginUrl, editorUrl, mode = 'assisted', extra = {}) {
  const execution = mode === 'dedicated'
    ? { ...dedicatedExecution }
    : mode === 'automated'
      ? { ...automatedExecution }
      : mode === 'assisted'
        ? { ...assistedExecution }
        : { ...plannedExecution };

  const loginSignals = platformLoginSignals[id] || {};
  return {
    id,
    name,
    // The backend selects a platform only after its local account has a ready
    // session.  It should not use a static "manual" platform category.
    support: mode === 'planned' ? 'planned' : 'ready',
    loginUrl,
    editorUrl,
    sessionSelectors: [...(loginSignals.visible || [])],
    sessionPresenceSelectors: [...defaultSessionPresenceSelectors, ...(loginSignals.present || [])],
    sessionProbeMode: loginSignals.probeMode || 'headless_profile',
    sessionUrlPrefixes: [...(loginSignals.urlPrefixes || [])],
    execution,
    ...extra,
  };
}

export const platforms = [
  publishingPlatform('wechat_mp', '微信公众号', 'https://mp.weixin.qq.com/', 'https://mp.weixin.qq.com/', 'dedicated', { editorHints: dedicatedEditorHints.wechat_mp }),
  publishingPlatform('zhihu', '知乎', 'https://www.zhihu.com/signin?next=%2F', 'https://zhuanlan.zhihu.com/write', 'dedicated', { editorHints: dedicatedEditorHints.zhihu }),
  publishingPlatform('toutiao', '头条号', 'https://mp.toutiao.com/', 'https://mp.toutiao.com/profile_v4/graphic/publish', 'dedicated', { editorHints: dedicatedEditorHints.toutiao }),

  // These channels use the generic local editor pipeline. They remain
  // executable for login and verified draft saving, but final public submit is
  // deliberately held for operator confirmation until each platform has a
  // real-account E2E sign-off and a verified adapter profile.
  publishingPlatform('baijiahao', '百家号', 'https://baijiahao.baidu.com/', 'https://baijiahao.baidu.com/builder/rc/edit?type=news'),
  publishingPlatform('xiaohongshu', '小红书', 'https://creator.xiaohongshu.com/', 'https://creator.xiaohongshu.com/new/home'),
  publishingPlatform('weibo', '微博', 'https://weibo.com/', 'https://weibo.com/'),
  publishingPlatform('juejin', '掘金', 'https://juejin.cn/', 'https://juejin.cn/editor/drafts/new'),
  publishingPlatform('csdn', 'CSDN', 'https://passport.csdn.net/', 'https://editor.csdn.net/md/'),
  publishingPlatform('jianshu', '简书', 'https://www.jianshu.com/sign_in', 'https://www.jianshu.com/writer'),
  publishingPlatform('douyin', '抖音图文', 'https://creator.douyin.com/', 'https://creator.douyin.com/creator-micro/content/upload'),
  publishingPlatform('bilibili', 'B站专栏', 'https://passport.bilibili.com/', 'https://member.bilibili.com/platform/upload/text/edit'),
  publishingPlatform('yuque', '语雀', 'https://www.yuque.com/login', 'https://www.yuque.com/dashboard'),
  publishingPlatform('douban', '豆瓣', 'https://www.douban.com/', 'https://www.douban.com/'),
  publishingPlatform('sohu', '搜狐号', 'https://mp.sohu.com/', 'https://mp.sohu.com/'),
  publishingPlatform('xueqiu', '雪球', 'https://xueqiu.com/', 'https://xueqiu.com/'),
  publishingPlatform('woshipm', '人人都是产品经理', 'https://www.woshipm.com/', 'https://www.woshipm.com/'),
  publishingPlatform('dayu', '大鱼号', 'https://mp.dayu.com/', 'https://mp.dayu.com/'),
  publishingPlatform('yidian', '一点号', 'https://mp.yidianzixun.com/', 'https://mp.yidianzixun.com/'),
  publishingPlatform('51cto', '51CTO', 'https://blog.51cto.com/', 'https://blog.51cto.com/'),
  publishingPlatform('imooc', '慕课网', 'https://www.imooc.com/', 'https://www.imooc.com/'),
  publishingPlatform('oschina', '开源中国', 'https://www.oschina.net/', 'https://my.oschina.net/'),
  publishingPlatform('segmentfault', 'SegmentFault', 'https://segmentfault.com/user/login', 'https://segmentfault.com/write'),
  publishingPlatform('cnblogs', '博客园', 'https://account.cnblogs.com/signin', 'https://i.cnblogs.com/posts/edit'),
  publishingPlatform('sohufocus', '搜狐焦点', 'https://mp.focus.cn/', 'https://mp.focus.cn/'),
  // Keep the adapter definition for a future re-enable, but exclude X from
  // the customer-visible catalog and runnable capabilities for now.
  publishingPlatform('x', 'X（Twitter）', 'https://x.com/login', 'https://x.com/compose/post', 'assisted', { hidden: true }),
  publishingPlatform('eastmoney', '东方财富', 'https://www.eastmoney.com/', 'https://www.eastmoney.com/'),
  publishingPlatform('smzdm', '什么值得买', 'https://www.smzdm.com/', 'https://post.smzdm.com/'),
  publishingPlatform('netease', '网易号', 'https://mp.163.com/', 'https://mp.163.com/'),
  {
    id: 'zip-download',
    name: 'Markdown / ZIP 导出',
    support: 'export',
    loginUrl: fallbackUrl,
    editorUrl: fallbackUrl,
    execution: { mode: 'export', editor: 'local_file', publish: 'not_applicable' },
  },
];

export const visiblePlatforms = platforms.filter((platform) => platform.hidden !== true);
export const hiddenPlatformIds = platforms.filter((platform) => platform.hidden === true).map((platform) => platform.id);
export const readyPlatformIds = visiblePlatforms.filter((platform) => platform.support === 'ready').map((platform) => platform.id);
export const automatedPlatformIds = visiblePlatforms.filter((platform) => platform.execution?.mode === 'automated').map((platform) => platform.id);
export const assistedPlatformIds = visiblePlatforms.filter((platform) => platform.execution?.mode === 'assisted').map((platform) => platform.id);
export const executablePlatformIds = platforms
  .filter((platform) => platform.hidden !== true && ['dedicated', 'automated', 'assisted'].includes(platform.execution?.mode))
  .map((platform) => platform.id);
export const directPublishPlatformIds = platforms
  .filter((platform) => platform.hidden !== true && platform.execution?.autoSubmit === true)
  .map((platform) => platform.id);
export const exportPlatformIds = platforms.filter((platform) => platform.execution?.mode === 'export').map((platform) => platform.id);
export const runnablePlatformIds = [...executablePlatformIds, ...exportPlatformIds];

export function findPlatform(id) {
  return platforms.find((platform) => platform.id === id) || null;
}

export function platformSupport(id) {
  return findPlatform(id)?.support || 'unknown';
}
