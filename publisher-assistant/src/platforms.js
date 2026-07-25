/**
 * 平台目录是本地发布器与 GEOFlow 的共同协议。
 *
 * 只有 support=ready、enabled=true 的平台允许创建账号、领取任务和执行发布；
 * planned 平台仅用于展示产品路线，不能被选中或调用登录/发布接口。
 */
export const platformCatalog = [
  { id: 'wechat_mp', extensionId: 'weixin', name: '微信公众号', group: '已接入平台', support: 'ready', enabled: true, loginUrl: 'https://mp.weixin.qq.com/', editorUrl: 'https://mp.weixin.qq.com/', adapter: 'browser' },
  { id: 'zhihu', name: '知乎', group: '已接入平台', support: 'ready', enabled: true, loginUrl: 'https://www.zhihu.com/signin?next=%2F', editorUrl: 'https://zhuanlan.zhihu.com/write', adapter: 'browser' },
  { id: 'toutiao', name: '头条号', group: '已接入平台', support: 'ready', enabled: true, loginUrl: 'https://mp.toutiao.com/', editorUrl: 'https://mp.toutiao.com/profile_v4/graphic/publish', adapter: 'browser' },
  { id: 'baijiahao', name: '百家号', group: '待接入平台', support: 'planned', enabled: false, loginUrl: 'https://baijiahao.baidu.com/', editorUrl: 'https://baijiahao.baidu.com/builder/rc/edit?type=news' },
  { id: 'xiaohongshu', name: '小红书', group: '待接入平台', support: 'planned', enabled: false, loginUrl: 'https://creator.xiaohongshu.com/', editorUrl: 'https://creator.xiaohongshu.com/new/home' },
  { id: 'weibo', name: '微博', group: '待接入平台', support: 'planned', enabled: false, loginUrl: 'https://weibo.com/', editorUrl: 'https://weibo.com/' },
  { id: 'bilibili', name: 'B站专栏', group: '待接入平台', support: 'planned', enabled: false, loginUrl: 'https://passport.bilibili.com/', editorUrl: 'https://member.bilibili.com/platform/upload/text/edit' },
  { id: 'douyin', name: '抖音图文', group: '待接入平台', support: 'planned', enabled: false, loginUrl: 'https://creator.douyin.com/', editorUrl: 'https://creator.douyin.com/creator-micro/content/upload' },
  { id: 'csdn', name: 'CSDN', group: '待接入平台', support: 'planned', enabled: false, loginUrl: 'https://passport.csdn.net/', editorUrl: 'https://editor.csdn.net/md/' },
  { id: 'juejin', name: '掘金', group: '待接入平台', support: 'planned', enabled: false, loginUrl: 'https://juejin.cn/', editorUrl: 'https://juejin.cn/editor/drafts/new' },
  { id: 'jianshu', name: '简书', group: '待接入平台', support: 'planned', enabled: false, loginUrl: 'https://www.jianshu.com/sign_in', editorUrl: 'https://www.jianshu.com/writer' },
  { id: 'cnblogs', name: '博客园', group: '待接入平台', support: 'planned', enabled: false, loginUrl: 'https://account.cnblogs.com/signin', editorUrl: 'https://i.cnblogs.com/posts/edit' },
];

export function findPlatform(id) {
  return platformCatalog.find((platform) => platform.id === id || platform.extensionId === id) || null;
}

export function isPublishablePlatform(id) {
  const platform = findPlatform(id);
  return Boolean(platform?.enabled && platform.support === 'ready' && platform.adapter);
}

export function extensionPlatformId(id) {
  return findPlatform(id)?.extensionId || id;
}
