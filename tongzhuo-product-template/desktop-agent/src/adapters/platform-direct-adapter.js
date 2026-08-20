import { GenericEditorAdapter } from './generic-editor-adapter.js';
import { ShortPostAdapter } from './short-post-adapter.js';
import { selectorList } from './final-publish.js';

const requiredLongFormKeys = Object.freeze(['titleSelectors', 'bodySelectors', 'publishSelectors', 'publishSuccessSelectors']);
const requiredShortPostKeys = Object.freeze(['postSelectors', 'publishSelectors', 'publishSuccessSelectors']);

function validateVerifiedProfile(platform, requiredKeys) {
  const hints = platform?.editorHints || {};
  const missing = requiredKeys.filter((key) => !Array.isArray(hints[key]) || hints[key].length === 0);
  if (missing.length) throw new Error(`${platform?.id || 'unknown'} direct adapter profile is incomplete: ${missing.join(', ')}`);
  if (hints.replaceDefaultPublishSelectors !== true || hints.replaceDefaultPublishSuccessSelectors !== true) {
    throw new Error(`${platform?.id || 'unknown'} direct adapter must replace generic final-publish selectors.`);
  }
}

export class PlatformDirectAdapter extends GenericEditorAdapter {
  titleSelectors() { return selectorList(this.platform.editorHints?.titleSelectors, [], true); }
  textAreaSelectors() { return selectorList(this.platform.editorHints?.textAreaSelectors, [], true); }
  bodySelectors() { return selectorList(this.platform.editorHints?.bodySelectors, [], true); }
  draftSelectors() { return selectorList(this.platform.editorHints?.draftSelectors, [], true); }
  draftSuccessSelectors() { return selectorList(this.platform.editorHints?.draftSuccessSelectors, [], true); }
  async publishDraft(page, article) {
    validateVerifiedProfile(this.platform, requiredLongFormKeys);
    return super.publishDraft(page, article);
  }
}

export class PlatformDirectShortPostAdapter extends ShortPostAdapter {
  postSelectors() { return selectorList(this.platform.editorHints?.postSelectors, [], true); }
  async publishDraft(page, article) {
    validateVerifiedProfile(this.platform, requiredShortPostKeys);
    return super.publishDraft(page, article);
  }
}
