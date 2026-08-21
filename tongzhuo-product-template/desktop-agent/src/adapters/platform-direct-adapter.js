import { GenericEditorAdapter } from './generic-editor-adapter.js';
import { ShortPostAdapter } from './short-post-adapter.js';

const requiredLongFormKeys = Object.freeze(['titleSelectors', 'bodySelectors', 'publishSelectors', 'publishSuccessSelectors']);
const requiredShortPostKeys = Object.freeze(['postSelectors', 'publishSelectors', 'publishSuccessSelectors']);

function validateVerifiedProfile(platform, requiredKeys) {
  const hints = platform?.editorHints || {};
  const missing = requiredKeys.filter((key) => !Array.isArray(hints[key]) || hints[key].length === 0);
  if (missing.length) throw new Error(`${platform?.id || 'unknown'} direct adapter profile is incomplete: ${missing.join(', ')}`);
}

/**
 * Platform-scoped adapters.  The platform profile's selectors are tried first
 * for every editor step; when a live editor does not match the profile, the
 * generic editor candidates act as a safe fallback so a profile miss degrades
 * to the previous generic behavior (fill and verify) instead of failing with
 * an unclassified editor.  Final publication still requires a visible
 * platform success signal before a job is reported as published.
 */
export class PlatformDirectAdapter extends GenericEditorAdapter {
  async publishDraft(page, article) {
    validateVerifiedProfile(this.platform, requiredLongFormKeys);
    return super.publishDraft(page, article);
  }
}

export class PlatformDirectShortPostAdapter extends ShortPostAdapter {
  async publishDraft(page, article) {
    validateVerifiedProfile(this.platform, requiredShortPostKeys);
    return super.publishDraft(page, article);
  }
}
