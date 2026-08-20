import { directPublishPlatformIds, executablePlatformIds, hiddenPlatformIds, platforms, readyPlatformIds, runnablePlatformIds, visiblePlatforms } from '../src/platforms.js';

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
const unexpected = ids.filter((id) => !expectedPlatformIds.includes(id));
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
  'eastmoney',
  'smzdm',
  'netease',
];
const connectedPlatformIds = ['wechat_mp', 'zhihu', 'toutiao', ...automatedPlatformIds];
const expectedRemotePlatformCount = expectedPlatformIds.length - 2;
const wrongCatalogSize = ids.length !== expectedPlatformIds.length || executablePlatformIds.length !== expectedRemotePlatformCount;
const invalidHiddenPlatforms = hiddenPlatformIds.length === 1 && hiddenPlatformIds[0] === 'x'
  && !readyPlatformIds.includes('x') && !executablePlatformIds.includes('x') && !runnablePlatformIds.includes('x')
  ? []
  : ['x'];
const invalidRemoteEndpoints = connectedPlatformIds.filter((id) => {
  const platform = platforms.find((item) => item.id === id);
  try {
    const login = new URL(platform?.loginUrl || '');
    const editor = new URL(platform?.editorUrl || '');
    return login.protocol !== 'https:' || !login.hostname
      || editor.protocol !== 'https:' || !editor.hostname
      || editor.href === 'about:blank';
  } catch {
    return true;
  }
});
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
  return platform?.support !== 'ready' || platform?.execution?.mode !== 'automated' || platform?.execution?.autoSubmit !== true;
});
// Every catalog platform is now fully automated; assisted mode is reserved for
// future platforms and must never reappear in the customer-visible catalog.
const remainingAssistedPlatforms = visiblePlatforms
  .filter((platform) => platform.execution?.mode === 'assisted')
  .map((platform) => platform.id);
const expectedDirectPublishIds = connectedPlatformIds;
const missingDirectPublish = expectedDirectPublishIds.filter((id) => !directPublishPlatformIds.includes(id));
const unexpectedDirectPublish = directPublishPlatformIds.filter((id) => !expectedDirectPublishIds.includes(id));
const unexpectedAssistedAutoSubmit = remainingAssistedPlatforms.filter((id) => {
  const platform = platforms.find((item) => item.id === id);
  return platform?.execution?.autoSubmit === true;
});
const missingSessionSignals = connectedPlatformIds.filter((id) => {
  const platform = platforms.find((item) => item.id === id);
  return !Array.isArray(platform?.sessionSelectors) || platform.sessionSelectors.length === 0
    || !Array.isArray(platform?.sessionPresenceSelectors) || platform.sessionPresenceSelectors.length === 0;
});

if (missing.length || unexpected.length || duplicated.length || wrongCatalogSize || invalidRemoteEndpoints.length
  || readyMissing.length || executableMissing.length || unexpectedExecutable.length || missingRunnable.length
  || incorrectlyPromoted.length || missingAutomatedMetadata.length || missingDirectPublish.length
  || unexpectedDirectPublish.length || unexpectedAssistedAutoSubmit.length || remainingAssistedPlatforms.length
  || missingSessionSignals.length || invalidHiddenPlatforms.length) {
  console.error({
    missing,
    unexpected,
    duplicated,
    wrongCatalogSize,
    invalidRemoteEndpoints,
    readyMissing,
    executableMissing,
    unexpectedExecutable,
    missingRunnable,
    incorrectlyPromoted,
    missingAutomatedMetadata,
    missingDirectPublish,
    unexpectedDirectPublish,
    unexpectedAssistedAutoSubmit,
    remainingAssistedPlatforms,
    missingSessionSignals,
    invalidHiddenPlatforms,
  });
  process.exit(1);
}

console.log('Platform catalog consistency passed.');
