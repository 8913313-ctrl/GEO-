import { BaseAdapter } from './base-adapter.js';
import { GenericEditorAdapter } from './generic-editor-adapter.js';
import { PlatformDirectAdapter, PlatformDirectShortPostAdapter } from './platform-direct-adapter.js';
import { ShortPostAdapter } from './short-post-adapter.js';
import { ToutiaoAdapter } from './toutiao-adapter.js';
import { WechatMpAdapter } from './wechat-mp-adapter.js';
import { ZhihuAdapter } from './zhihu-adapter.js';

const adapterMap = {
  zhihu: ZhihuAdapter,
  wechat_mp: WechatMpAdapter,
  toutiao: ToutiaoAdapter,
  x: ShortPostAdapter,
};

function hasVerifiedDirectProfile(platform) {
  const hints = platform?.editorHints || {};
  return hints.replaceDefaultPublishSelectors === true && hints.replaceDefaultPublishSuccessSelectors === true;
}

export function createAdapter(platform) {
  if (!platform) throw new Error('平台配置不存在。');
  const Adapter = adapterMap[platform.id];
  if (Adapter) return new Adapter(platform);
  if (platform.execution?.mode === 'automated' || platform.execution?.mode === 'assisted' || platform.support === 'manual') {
    if (hasVerifiedDirectProfile(platform)) {
      const shortPost = Array.isArray(platform.editorHints?.postSelectors) && platform.editorHints.postSelectors.length > 0;
      return shortPost ? new PlatformDirectShortPostAdapter(platform) : new PlatformDirectAdapter(platform);
    }
    return new GenericEditorAdapter(platform);
  }
  return new BaseAdapter(platform);
}
