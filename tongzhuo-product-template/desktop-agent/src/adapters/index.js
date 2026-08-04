import { BaseAdapter } from './base-adapter.js';
import { GenericEditorAdapter } from './generic-editor-adapter.js';
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

export function createAdapter(platform) {
  if (!platform) throw new Error('平台配置不存在。');
  const Adapter = adapterMap[platform.id];
  if (Adapter) return new Adapter(platform);
  if (platform.execution?.mode === 'automated' || platform.execution?.mode === 'assisted' || platform.support === 'manual') {
    return new GenericEditorAdapter(platform);
  }
  return new BaseAdapter(platform);
}
