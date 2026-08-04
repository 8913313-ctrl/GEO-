const fallbackUrl = 'about:blank';

/*
 * Every platform listed as `ready` can receive a job directly from GEOFlow
 * after a local account profile has been confirmed.  The execution mode tells
 * the local agent how much of the editor is selector-tested:
 *
 * - dedicated: a platform-specific adapter owns the selectors;
 * - automated: the generic adapter fills and verifies a draft automatically;
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

const plannedExecution = Object.freeze({
  mode: 'planned',
  login: 'not_available',
  editor: 'not_available',
  draft: 'not_available',
  publish: 'not_available',
});

function publishingPlatform(id, name, loginUrl, editorUrl, mode = 'automated', extra = {}) {
  const execution = mode === 'dedicated'
    ? { ...dedicatedExecution }
    : mode === 'automated'
      ? { ...automatedExecution }
      : { ...plannedExecution };

  return {
    id,
    name,
    // The backend selects a platform only after its local account has a ready
    // session.  It should not use a static "manual" platform category.
    support: mode === 'planned' ? 'planned' : 'ready',
    loginUrl,
    editorUrl,
    execution,
    ...extra,
  };
}

export const platforms = [
  publishingPlatform('wechat_mp', '微信公众号', 'https://mp.weixin.qq.com/', 'https://mp.weixin.qq.com/', 'dedicated'),
  publishingPlatform('zhihu', '知乎', 'https://www.zhihu.com/signin?next=%2F', 'https://zhuanlan.zhihu.com/write', 'dedicated'),
  publishingPlatform('toutiao', '头条号', 'https://mp.toutiao.com/', 'https://mp.toutiao.com/profile_v4/graphic/publish', 'dedicated'),

  // These channels use the verified generic local editor pipeline.  They are
  // executable after login; they are not "manual" channels.  If the editor
  // changes or shows a verification challenge, the job reports an explicit
  // failure/login-needed result instead of asking the backend for confirmation.
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
  publishingPlatform('x', 'X（Twitter）', 'https://x.com/login', 'https://x.com/compose/post'),
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

export const readyPlatformIds = platforms.filter((platform) => platform.support === 'ready').map((platform) => platform.id);
export const automatedPlatformIds = platforms.filter((platform) => platform.execution?.mode === 'automated').map((platform) => platform.id);
// Compatibility export for integrations that used the former name.  These are
// now direct automated channels, not channels waiting for an operator.
export const assistedPlatformIds = automatedPlatformIds;
export const executablePlatformIds = platforms
  .filter((platform) => ['dedicated', 'automated'].includes(platform.execution?.mode))
  .map((platform) => platform.id);
export const exportPlatformIds = platforms.filter((platform) => platform.execution?.mode === 'export').map((platform) => platform.id);
export const runnablePlatformIds = [...executablePlatformIds, ...exportPlatformIds];

export function findPlatform(id) {
  return platforms.find((platform) => platform.id === id) || null;
}

export function platformSupport(id) {
  return findPlatform(id)?.support || 'unknown';
}
