import { executablePlatformIds, platforms, readyPlatformIds, runnablePlatformIds } from '../src/platforms.js';

const expectedPlatformIds = [
  'wechat_mp',
  'zhihu',
  'weibo',
  'xiaohongshu',
  'juejin',
  'csdn',
  'jianshu',
  'toutiao',
  'douyin',
  'bilibili',
  'baijiahao',
  'yuque',
  'douban',
  'sohu',
  'xueqiu',
  'woshipm',
  'dayu',
  'yidian',
  '51cto',
  'imooc',
  'oschina',
  'segmentfault',
  'cnblogs',
  'sohufocus',
  'x',
  'eastmoney',
  'smzdm',
  'netease',
  'zip-download',
];

const ids = platforms.map((platform) => platform.id);
const missing = expectedPlatformIds.filter((id) => !ids.includes(id));
const duplicated = ids.filter((id, index) => ids.indexOf(id) !== index);
const automatedPlatformIds = [
  'baijiahao',
  'xiaohongshu',
  'weibo',
  'juejin',
  'csdn',
  'jianshu',
  'douyin',
  'bilibili',
  'yuque',
  'douban',
  'sohu',
  'xueqiu',
  'woshipm',
  'dayu',
  'yidian',
  '51cto',
  'imooc',
  'oschina',
  'segmentfault',
  'cnblogs',
  'sohufocus',
  'x',
  'eastmoney',
  'smzdm',
  'netease',
];
const connectedPlatformIds = ['wechat_mp', 'zhihu', 'toutiao', ...automatedPlatformIds];
const readyMissing = connectedPlatformIds.filter((id) => !readyPlatformIds.includes(id));
const executableMissing = connectedPlatformIds.filter((id) => !executablePlatformIds.includes(id));
const unexpectedExecutable = ['zip-download']
  .filter((id) => executablePlatformIds.includes(id));
const missingRunnable = ['zip-download'].filter((id) => !runnablePlatformIds.includes(id));
const plannedIds = [];
const incorrectlyPromoted = plannedIds.filter((id) => {
  const platform = platforms.find((item) => item.id === id);
  return platform?.support !== 'planned' || platform?.execution?.mode !== 'planned';
});
const missingAutomatedMetadata = automatedPlatformIds.filter((id) => {
  const platform = platforms.find((item) => item.id === id);
  return platform?.support !== 'ready' || platform?.execution?.mode !== 'automated';
});
const missingAutoSubmit = connectedPlatformIds.filter((id) => {
  const platform = platforms.find((item) => item.id === id);
  return platform?.execution?.autoSubmit !== true;
});

if (missing.length || duplicated.length || readyMissing.length || executableMissing.length || unexpectedExecutable.length || missingRunnable.length || incorrectlyPromoted.length || missingAutomatedMetadata.length || missingAutoSubmit.length) {
  console.error({
    missing,
    duplicated,
    readyMissing,
    executableMissing,
    unexpectedExecutable,
    missingRunnable,
    incorrectlyPromoted,
    missingAutomatedMetadata,
    missingAutoSubmit,
  });
  process.exit(1);
}

console.log('Platform catalog consistency passed.');
