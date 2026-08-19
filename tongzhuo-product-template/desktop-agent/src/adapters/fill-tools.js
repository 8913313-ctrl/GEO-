const verificationUrlPattern = /(?:login|signin|passport|auth|verify|captcha)/i;
const verificationTextPattern = /请先登录|立即登录|重新登录|扫码登录|(?:手机|手机号|账号|账户|密码|验证码)登录|登录后(?:继续|发布)|验证码|人机验证|安全验证|身份验证|账户验证|账号验证|风险(?:验证|提示|控制)|访问(?:受限|异常)|操作(?:过于频繁|频繁)|账号(?:异常|受限)|请完成验证/;
const verificationSelectors = [
  '[class*="captcha" i]',
  '[id*="captcha" i]',
  '[class*="verify" i]',
  '[id*="verify" i]',
  '[class*="risk" i]',
  '[id*="risk" i]',
  '[data-testid*="captcha" i]',
  '[data-testid*="verify" i]',
];

export const defaultDraftSuccessSelectors = Object.freeze([
  '[data-save-state="saved"]',
  '[data-draft-state="saved"]',
  '[role="status"]:has-text("保存成功")',
  '[role="alert"]:has-text("保存成功")',
  ':text("草稿保存成功")',
  ':text("保存成功")',
  ':text("已保存")',
]);

export const defaultPublishSuccessSelectors = Object.freeze([
  '[data-publish-state="published"]',
  '[data-publish-state="submitted"]',
  '[data-publish-state="sent"]',
  '[role="status"]:has-text("发布成功")',
  '[role="alert"]:has-text("发布成功")',
  ':text("发布成功")',
  ':text("发表成功")',
  ':text("提交成功")',
  ':text("提交审核成功")',
  ':text("审核已提交")',
  ':text("已提交审核")',
  ':text("已发布")',
  ':text("发布已提交")',
  ':text("Your post was sent")',
  ':text("Your Tweet was sent")',
  ':text("帖子已发送")',
  ':text("你的帖子已发送")',
  '[role="status"]:has-text("发布成功")',
  '[role="alert"]:has-text("发布成功")',
  ':text("发布成功")',
  ':text("提交成功")',
  ':text("审核已提交")',
]);

export const defaultPublishSelectors = Object.freeze([
  '[data-testid*="publish" i]',
  '[data-action*="publish" i]',
  '[data-testid="tweetButton"]',
  '[data-testid="tweetButtonInline"]',
  'button:has-text("发布文章")',
  'button:has-text("立即发布")',
  'button:has-text("提交发布")',
  'button:has-text("提交审核")',
  'button:has-text("确认发布")',
  'button:has-text("发布")',
  'button:has-text("发表")',
  'button:has-text("群发")',
  'button:has-text("发帖")',
  'button:has-text("Publish")',
  'button:has-text("Post")',
  'a:has-text("发布文章")',
  'a:has-text("立即发布")',
  'a:has-text("提交发布")',
  'a:has-text("提交审核")',
  'a:has-text("发布")',
  'a:has-text("发表")',
  '[role="button"]:has-text("发布文章")',
  '[role="button"]:has-text("立即发布")',
  '[role="button"]:has-text("提交发布")',
  '[role="button"]:has-text("提交审核")',
  '[role="button"]:has-text("发布")',
  '[role="button"]:has-text("发表")',
  '[role="button"]:has-text("Post")',
]);

export const defaultPublishConfirmSelectors = Object.freeze([
  '[role="dialog"] button:has-text("确认发布")',
  '[role="dialog"] button:has-text("确定发布")',
  '[role="dialog"] button:has-text("确认提交")',
  '[role="dialog"] button:has-text("继续发布")',
  '[role="dialog"] button:has-text("提交审核")',
  '[role="dialog"] button:has-text("发布")',
  '[role="dialog"] button:has-text("发表")',
  '[role="dialog"] button:has-text("确定")',
  '[role="dialog"] button:has-text("确认")',
  '[role="dialog"] button:has-text("Publish")',
  '[role="dialog"] button:has-text("Post")',
  '.ant-modal button:has-text("确认发布")',
  '.ant-modal button:has-text("确定发布")',
  '.ant-modal button:has-text("确定")',
  '.el-dialog button:has-text("确认发布")',
  '.el-dialog button:has-text("确定发布")',
  '.el-dialog button:has-text("确定")',
  '.semi-modal button:has-text("确认发布")',
  '.semi-modal button:has-text("确定")',
  '.arco-modal button:has-text("确认发布")',
  '.arco-modal button:has-text("确定")',
]);

function selectorCandidates(selectors) {
  const values = Array.isArray(selectors) ? selectors : [selectors];
  return [...new Set(values.map((selector) => String(selector || '').trim()).filter(Boolean))];
}

function numericOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function selectorAttempt(ok, candidates, candidateIndex = -1, attempted = 0, extra = {}) {
  return {
    ok,
    selector: candidateIndex >= 0 ? candidates[candidateIndex] || null : null,
    // Candidate indexes are zero-based; `attempted` is the total number of
    // visibility probes, so backend health reports can also show retry cost.
    candidate_index: candidateIndex >= 0 ? candidateIndex : null,
    attempted,
    candidate_count: candidates.length,
    ...extra,
  };
}

function clickFailureMetadata(error, selector, candidateIndex) {
  const message = String(error?.message || '').toLowerCase();
  const reason = message.includes('disabled')
    ? 'disabled'
    : /intercept|pointer|overlay|obscur/.test(message)
      ? 'intercepted'
      : message.includes('timeout')
        ? 'timeout'
        : 'click_failed';
  return {
    selector,
    candidate_index: candidateIndex,
    reason,
    error_name: String(error?.name || 'Error'),
  };
}

function preferredSelectorDetail(value) {
  if (!value || typeof value !== 'object') return value;
  // `fillRichContent` may make a text fallback after an HTML pass. A later
  // success must retain the original selector match instead of hiding it.
  if (value.initial_attempt?.ok) return value.initial_attempt;
  return value;
}

/**
 * Adapt low-level selector operation results to the stable result contract
 * consumed by platform-result.js. Adapter results expose metadata, not the
 * complete fallback selector lists, to keep job telemetry compact.
 */
export function selectorDetails(steps = {}) {
  return Object.fromEntries(Object.entries(steps).flatMap(([name, value]) => {
    const step = preferredSelectorDetail(Array.isArray(value) ? value.at(-1) : value);
    if (!step || typeof step !== 'object') return [];
    const hasMetadata = ['candidate_index', 'candidateIndex', 'attempted', 'candidate_count', 'candidateCount']
      .some((key) => Object.prototype.hasOwnProperty.call(step, key));
    if (!hasMetadata) return [];
    const clickFailures = Array.isArray(step.click_failures)
      ? step.click_failures.map((failure) => ({
        selector: String(failure?.selector || ''),
        candidate_index: numericOrNull(failure?.candidate_index ?? failure?.candidateIndex),
        reason: String(failure?.reason || 'click_failed'),
        error_name: String(failure?.error_name || failure?.errorName || 'Error'),
      }))
      : [];
    return [[name, {
      candidate_index: numericOrNull(step.candidate_index ?? step.candidateIndex),
      attempted: numericOrNull(step.attempted),
      candidate_count: numericOrNull(step.candidate_count ?? step.candidateCount),
      ...(clickFailures.length ? { click_failures: clickFailures } : {}),
    }]];
  }));
}

export async function fillFirstVisible(page, selectors, value, options = {}) {
  const candidates = selectorCandidates(selectors);
  let attempted = 0;
  for (const [candidateIndex, selector] of candidates.entries()) {
    attempted += 1;
    const locator = page.locator(selector).first();
    if (!await locator.isVisible({ timeout: options.timeout || 1200 }).catch(() => false)) continue;
    await locator.click({ timeout: 3000 }).catch(() => {});
    await locator.fill(value, { timeout: 5000 }).catch(async () => {
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
      await page.keyboard.type(value, { delay: options.delay || 0 });
    });
    return selectorAttempt(true, candidates, candidateIndex, attempted);
  }
  return selectorAttempt(false, candidates, -1, attempted);
}

export async function typeIntoFirstVisible(page, selectors, value, options = {}) {
  const candidates = selectorCandidates(selectors);
  let attempted = 0;
  for (const [candidateIndex, selector] of candidates.entries()) {
    attempted += 1;
    const locator = page.locator(selector).first();
    if (!await locator.isVisible({ timeout: options.timeout || 1200 }).catch(() => false)) continue;
    await locator.click({ timeout: 3000 });
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A').catch(() => {});
    await page.keyboard.type(value, { delay: options.delay || 0 });
    return selectorAttempt(true, candidates, candidateIndex, attempted);
  }
  return selectorAttempt(false, candidates, -1, attempted);
}

function sanitizeRichHtml(value = '') {
  return String(value || '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '')
    .replace(/\son\w+\s*=\s*(["']).*?\1/gi, '')
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, '')
    .replace(/\s(?:href|src)\s*=\s*(["'])\s*javascript:[\s\S]*?\1/gi, '');
}

function imageDataUrl(asset = {}) {
  const content = String(asset.content_base64 || asset.base64 || '').trim();
  const mime = String(asset.mime_type || asset.mimeType || '').trim();
  if (!content || !/^image\/(?:png|jpeg|gif|webp|svg\+xml)$/i.test(mime)) return '';
  return `data:${mime};base64,${content}`;
}

export function articleRichHtml(article = {}) {
  let html = sanitizeRichHtml(article.html || article.content_html || '');
  const images = Array.isArray(article.images) ? article.images : (Array.isArray(article?.assets?.images) ? article.assets.images : []);
  for (const asset of images) {
    const source = String(asset?.source_url || asset?.url || '').trim();
    const replacement = imageDataUrl(asset);
    if (!source || !replacement) continue;
    html = html.split(source).join(replacement);
  }
  return html.trim();
}

export async function setContentEditable(page, selectors, value, options = {}) {
  const mode = options.mode === 'html' ? 'html' : 'text';
  const content = mode === 'html' ? sanitizeRichHtml(value) : String(value || '');
  const candidates = selectorCandidates(selectors);
  let attempted = 0;
  for (const [candidateIndex, selector] of candidates.entries()) {
    attempted += 1;
    const locator = page.locator(selector).first();
    if (!await locator.isVisible({ timeout: 1200 }).catch(() => false)) continue;
    await locator.evaluate((element, payload) => {
      element.focus();
      if (payload.mode === 'html') element.innerHTML = payload.content;
      else element.innerText = payload.content;
      element.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        inputType: payload.mode === 'html' ? 'insertFromPaste' : 'insertText',
        data: payload.mode === 'html' ? null : payload.content,
      }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    }, { mode, content });
    return selectorAttempt(true, candidates, candidateIndex, attempted, { format: mode });
  }
  return selectorAttempt(false, candidates, -1, attempted);
}

export async function fillRichContent(page, selectors, article = {}) {
  const html = articleRichHtml(article);
  if (html) {
    const rich = await setContentEditable(page, selectors, html, { mode: 'html' });
    if (rich.ok) {
      const images = await page.locator(rich.selector).first().locator('img').count().catch(() => 0);
      return { ...rich, images };
    }
    const text = String(article.text || article.excerpt || '').trim();
    const fallback = await setContentEditable(page, selectors, text, { mode: 'text' });
    if (fallback.ok) {
      return { ...fallback, format: 'text', images: 0, initial_attempt: rich };
    }
    return { ...fallback, initial_attempt: rich };
  }
  const text = String(article.text || article.excerpt || '').trim();
  const fallback = await setContentEditable(page, selectors, text, { mode: 'text' });
  return fallback.ok ? { ...fallback, format: 'text', images: 0 } : fallback;
}

export async function clickFirstVisible(page, selectors, options = {}) {
  const candidates = selectorCandidates(selectors);
  let attempted = 0;
  const clickFailures = [];
  for (const [candidateIndex, selector] of candidates.entries()) {
    attempted += 1;
    const locator = page.locator(selector).first();
    if (!await locator.isVisible({ timeout: 1200 }).catch(() => false)) continue;
    const enabled = await locator.isEnabled({ timeout: 600 }).catch(() => true);
    if (!enabled) {
      clickFailures.push({ selector, candidate_index: candidateIndex, reason: 'disabled', error_name: 'DisabledElement' });
      continue;
    }
    try {
      const clickTimeout = Math.max(5000, Number(options.clickTimeout) || 5000);
      await locator.click({ timeout: clickTimeout });
      return selectorAttempt(true, candidates, candidateIndex, attempted, { click_failures: clickFailures });
    } catch (error) {
      const failure = clickFailureMetadata(error, selector, candidateIndex);
      clickFailures.push(failure);
      // A visible, enabled control can briefly fail Playwright's actionability
      // stability check while an editor finishes its transition. Retry only
      // when the control is still the topmost element at its center; this
      // avoids force-clicking through an overlay or clicking a hidden action.
      const retryable = failure.reason === 'timeout';
      if (retryable) {
        try {
          await locator.click({ timeout: Math.max(1000, clickTimeout) });
          return selectorAttempt(true, candidates, candidateIndex, attempted, { click_failures: clickFailures });
        } catch (retryError) {
          clickFailures.push(clickFailureMetadata(retryError, selector, candidateIndex));
        }
      }
    }
  }
  return selectorAttempt(false, candidates, -1, attempted, { click_failures: clickFailures });
}

async function createVisibleSignalBaseline(page, selectors) {
  const candidates = selectorCandidates(selectors);
  if (!candidates.length) return null;
  const token = `baseline-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const visibleCounts = [];
  for (const selector of candidates) {
    const visibleCount = await page.locator(selector).evaluateAll((elements, baselineToken) => {
      const scope = globalThis;
      if (!(scope.__tongzhuoAgentVisibleSignalBaselines instanceof Map)) scope.__tongzhuoAgentVisibleSignalBaselines = new Map();
      let baseline = scope.__tongzhuoAgentVisibleSignalBaselines.get(baselineToken);
      if (!baseline) {
        baseline = new WeakSet();
        scope.__tongzhuoAgentVisibleSignalBaselines.set(baselineToken, baseline);
      }
      let count = 0;
      for (const element of elements) {
        const style = getComputedStyle(element);
        const visible = !element.closest('[hidden], [aria-hidden="true"]')
          && style.display !== 'none'
          && style.visibility !== 'hidden'
          && element.getClientRects().length > 0;
        if (!visible) continue;
        baseline.add(element);
        count += 1;
      }
      return count;
    }, token).catch(() => 0);
    visibleCounts.push(visibleCount);
  }
  return { token, visibleCounts };
}

async function clearVisibleSignalBaseline(page, baseline) {
  if (!baseline?.token) return;
  await page.locator('html').evaluate((_, baselineToken) => {
    globalThis.__tongzhuoAgentVisibleSignalBaselines?.delete?.(baselineToken);
  }, baseline.token).catch(() => {});
}

/**
 * A visible success signal is required before a local action is reported as
 * saved or published.  A click alone is never proof that the remote editor
 * accepted the content.
 */
export async function waitForAnyVisible(page, selectors, options = {}) {
  const candidates = selectorCandidates(selectors);
  const timeout = Math.max(0, Number(options.timeout) || 0);
  const interval = Math.max(50, Number(options.interval) || 125);
  const deadline = Date.now() + timeout;
  let attempted = 0;
  let polls = 0;

  if (!candidates.length) return selectorAttempt(false, candidates, -1, attempted, { poll_count: polls });

  do {
    polls += 1;
    for (const [candidateIndex, selector] of candidates.entries()) {
      attempted += 1;
      const locator = page.locator(selector);
      if (options.visibleBaseline?.token) {
        const newlyVisible = await locator.evaluateAll((elements, baselineToken) => {
          const baseline = globalThis.__tongzhuoAgentVisibleSignalBaselines?.get?.(baselineToken);
          return elements.some((element) => {
            const style = getComputedStyle(element);
            const visible = !element.closest('[hidden], [aria-hidden="true"]')
              && style.display !== 'none'
              && style.visibility !== 'hidden'
              && element.getClientRects().length > 0;
            return visible && (!baseline || !baseline.has(element));
          });
        }, options.visibleBaseline.token).catch(() => false);
        if (newlyVisible) {
          return selectorAttempt(true, candidates, candidateIndex, attempted, {
            poll_count: polls,
            baseline_visible_count: options.visibleBaseline.visibleCounts?.[candidateIndex] || 0,
          });
        }
      } else if (await locator.first().isVisible({ timeout: Math.min(600, interval) }).catch(() => false)) {
        return selectorAttempt(true, candidates, candidateIndex, attempted, { poll_count: polls });
      }
    }
    if (Date.now() >= deadline) break;
    await page.waitForTimeout(Math.min(interval, Math.max(0, deadline - Date.now()))).catch(() => {});
  } while (Date.now() < deadline);

  return selectorAttempt(false, candidates, -1, attempted, { poll_count: polls });
}

export async function clickAndConfirm(page, actionSelectors, successSelectors, options = {}) {
  const successCandidates = selectorCandidates(successSelectors || []);
  const visibleBaseline = await createVisibleSignalBaseline(page, successCandidates);
  try {
    const action = await clickFirstVisible(page, actionSelectors || [], { clickTimeout: options.actionClickTimeout });
    if (!action.ok) return { ok: false, reason: 'action_not_found', action };

    const blocked = await detectAccessBlocked(page);
    if (blocked.blocked) return { ok: false, reason: 'verification_required', action, blocked };

    const confirmSelectors = options.confirmSelectors || [];
    const confirmActions = [];
    if (confirmSelectors.length) {
      const initial = await waitForAnyVisible(page, successCandidates, {
        timeout: options.initialSuccessTimeout ?? Math.min(800, options.timeout ?? 2200),
        interval: options.interval ?? 125,
        visibleBaseline,
      });
      if (initial.ok) return { ok: true, action, confirmation: initial, confirmActions };

      const attempts = Math.max(1, Number(options.confirmAttempts) || 1);
      for (let index = 0; index < attempts; index += 1) {
        const confirmAction = await clickFirstVisible(page, confirmSelectors, { clickTimeout: options.confirmClickTimeout });
        if (!confirmAction.ok) break;
        confirmActions.push(confirmAction);

        const afterConfirmBlocked = await detectAccessBlocked(page);
        if (afterConfirmBlocked.blocked) {
          return { ok: false, reason: 'verification_required', action, confirmActions, blocked: afterConfirmBlocked };
        }

        const confirmed = await waitForAnyVisible(page, successCandidates, {
          timeout: options.confirmSuccessTimeout ?? options.timeout ?? 2200,
          interval: options.interval ?? 125,
          visibleBaseline,
        });
        if (confirmed.ok) return { ok: true, action, confirmation: confirmed, confirmActions };
      }
    }

    const confirmation = await waitForAnyVisible(page, successCandidates, {
      timeout: options.timeout ?? 2200,
      interval: options.interval ?? 125,
      visibleBaseline,
    });
    if (!confirmation.ok) return { ok: false, reason: 'success_not_confirmed', action, confirmation, confirmActions };
    return { ok: true, action, confirmation, confirmActions };
  } finally {
    await clearVisibleSignalBaseline(page, visibleBaseline);
  }
}

/**
 * Detect blocks that should stop automation immediately.  It deliberately
 * checks verification overlays even when an editor is also visible: a captcha
 * on top of an editor is not a valid logged-in publishing session.
 */
export async function detectAccessBlocked(page) {
  const url = page.url();
  if (verificationUrlPattern.test(url)) {
    return { blocked: true, reason: 'login_or_verification_url', url };
  }

  for (const selector of verificationSelectors) {
    const visible = await page.locator(selector).first().isVisible({ timeout: 500 }).catch(() => false);
    if (visible) return { blocked: true, reason: 'verification_overlay', selector, url };
  }

  // Exclude editor contents so an article that happens to discuss "验证码"
  // cannot be mistaken for a platform verification challenge.
  const text = await page.locator('body').evaluate((body) => {
    const chunks = [];
    const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const parent = node.parentElement;
      if (!parent || parent.closest('input, textarea, [contenteditable="true"], script, style, [hidden], [aria-hidden="true"]')) continue;
      const style = getComputedStyle(parent);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      if (!parent.getClientRects().length) continue;
      const value = String(node.nodeValue || '').trim();
      if (value) chunks.push(value);
    }
    return chunks.join(' ');
  }).catch(() => '');
  if (verificationTextPattern.test(text)) {
    return { blocked: true, reason: 'verification_message', url };
  }
  return { blocked: false, url };
}

export async function detectLoginRequired(page) {
  return (await detectAccessBlocked(page)).blocked;
}

export function adapterResult(platformId, state, message, page, extra = {}) {
  return {
    platformId,
    state,
    remote_url: page.url(),
    message,
    ...extra,
  };
}
