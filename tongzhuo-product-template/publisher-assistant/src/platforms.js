export const platformCatalog = [
  { id: 'wechat_mp', extensionId: 'weixin', name: '微信公众号', group: '主流内容', url: 'https://mp.weixin.qq.com/' },
  { id: 'zhihu', name: '知乎', group: '主流内容', url: 'https://zhuanlan.zhihu.com/write' },
  { id: 'weibo', name: '微博', group: '主流内容', url: 'https://card.weibo.com/article/v5/editor' },
  { id: 'xiaohongshu', name: '小红书', group: '主流内容', url: 'https://creator.xiaohongshu.com/new/home' },
  { id: 'toutiao', name: '头条号', group: '主流内容', url: 'https://mp.toutiao.com/profile_v4/graphic/publish' },
  { id: 'douyin', name: '抖音图文', group: '主流内容', url: 'https://creator.douyin.com/' },
  { id: 'bilibili', name: 'B站专栏', group: '主流内容', url: 'https://member.bilibili.com/platform/upload/text' },
  { id: 'baijiahao', name: '百家号', group: '主流内容', url: 'https://baijiahao.baidu.com/builder/rc/edit?type=news' },
  { id: 'sohu', name: '搜狐号', group: '主流内容', url: 'https://mp.sohu.com/' },
  { id: 'douban', name: '豆瓣', group: '主流内容', url: 'https://www.douban.com/note/create' },
  { id: 'jianshu', name: '简书', group: '主流内容', url: 'https://www.jianshu.com/writer#/articles/new' },
  { id: 'dayu', name: '大鱼号', group: '主流内容', url: 'https://mp.dayu.com/' },
  { id: 'yidian', name: '一点号', group: '主流内容', url: 'https://mp.yidianzixun.com/' },
  { id: 'netease', name: '网易号', group: '主流内容', url: 'https://mp.163.com/' },
  { id: 'smzdm', name: '什么值得买', group: '主流内容', url: 'https://post.smzdm.com/' },
  { id: 'sohufocus', name: '搜狐焦点', group: '主流内容', url: 'https://mp.sohu.com/' },
  { id: 'x', name: 'X（Twitter）', group: '主流内容', url: 'https://x.com/compose/post' },
  { id: 'juejin', name: '掘金', group: '技术知识', url: 'https://juejin.cn/editor/drafts/new' },
  { id: 'csdn', name: 'CSDN', group: '技术知识', url: 'https://mp.csdn.net/mp_blog/creation/editor' },
  { id: 'yuque', name: '语雀', group: '技术知识', url: 'https://www.yuque.com/dashboard' },
  { id: '51cto', name: '51CTO', group: '技术知识', url: 'https://blog.51cto.com/blogger' },
  { id: 'imooc', name: '慕课网', group: '技术知识', url: 'https://www.imooc.com/u/center/article' },
  { id: 'oschina', name: '开源中国', group: '技术知识', url: 'https://my.oschina.net/u/' },
  { id: 'segmentfault', name: 'SegmentFault', group: '技术知识', url: 'https://segmentfault.com/write' },
  { id: 'cnblogs', name: '博客园', group: '技术知识', url: 'https://i.cnblogs.com/posts/edit' },
  { id: 'xueqiu', name: '雪球', group: '财经研究', url: 'https://mp.xueqiu.com/writeV2' },
  { id: 'eastmoney', name: '东方财富', group: '财经研究', url: 'https://mp.eastmoney.com/' },
  { id: 'woshipm', name: '人人都是产品经理', note: '产品运营社区', group: '产品运营', url: 'https://www.woshipm.com/writing' },
  { id: 'zip-download', name: 'Markdown / ZIP 导出', note: '不需要登录', group: '内容工具', mode: 'export' },
];

export function findPlatform(id) {
  return platformCatalog.find((platform) => platform.id === id || platform.extensionId === id) || null;
}

export function extensionPlatformId(id) {
  return findPlatform(id)?.extensionId || id;
}
