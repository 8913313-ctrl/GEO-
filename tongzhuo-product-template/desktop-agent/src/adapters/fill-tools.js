const verificationUrlPattern = /(?:login|signin|passport|auth|verify|captcha)/i;
const verificationTextPattern = /(?:请先)?登录|扫码登录|登录后(?:继续|发布)|验证码|人机验证|安全验证|身份验证|账户验证|账号验证|风险(?:验证|提示|控制)|访问(?:受限|异常)|操作(?:过于频繁|频繁)|账号(?:异常|受限)|请完成验证/;
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

export async function fillFirstVisible(page, selectors, value, options = {}) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if (!await locator.isVisible({ timeout: options.timeout || 1200 }).catch(() => false)) continue;
    await locator.click({ timeout: 3000 }).catch(() => {});
    await locator.fill(value, { timeout: 5000 }).catch(async () => {
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
      await page.keyboard.type(value, { delay: options.delay || 0 });
    });
    return { ok: true, selector };
  }
  return { ok: false };
}

export async function typeIntoFirstVisible(page, selectors, value, options = {}) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if (!await locator.isVisible({ timeout: options.timeout || 1200 }).catch(() => false)) continue;
    await locator.click({ timeout: 3000 });
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A').catch(() => {});
    await page.keyboard.type(value, { delay: options.delay || 0 });
    return { ok: true, selector };
  }
  return { ok: false };
}

export async function setContentEditable(page, selectors, value) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if (!await locator.isVisible({ timeout: 1200 }).catch(() => false)) continue;
    await locator.evaluate((element, text) => {
      element.focus();
      element.innerText = text;
      element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    }, value);
    return { ok: true, selector };
  }
  return { ok: false };
}

export async function clickFirstVisible(page, selectors) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if (!await locator.isVisible({ timeout: 1200 }).catch(() => false)) continue;
    await locator.click({ timeout: 5000 });
    return { ok: true, selector };
  }
  return { ok: false };
}

/**
 * A visible success signal is required before a local action is reported as
 * saved or published.  A click alone is never proof that the remote editor
 * accepted the content.
 */
export async function waitForAnyVisible(page, selectors, options = {}) {
  const timeout = Math.max(0, Number(options.timeout) || 0);
  const interval = Math.max(50, Number(options.interval) || 125);
  const deadline = Date.now() + timeout;

  do {
    for (const selector of selectors || []) {
      const locator = page.locator(selector).first();
      if (await locator.isVisible({ timeout: Math.min(600, interval) }).catch(() => false)) {
        return { ok: true, selector };
      }
    }
    if (Date.now() >= deadline) break;
    await page.waitForTimeout(Math.min(interval, Math.max(0, deadline - Date.now()))).catch(() => {});
  } while (Date.now() < deadline);

  return { ok: false };
}

export async function clickAndConfirm(page, actionSelectors, successSelectors, options = {}) {
  const action = await clickFirstVisible(page, actionSelectors || []);
  if (!action.ok) return { ok: false, reason: 'action_not_found', action };

  const blocked = await detectAccessBlocked(page);
  if (blocked.blocked) return { ok: false, reason: 'verification_required', action, blocked };

  const confirmSelectors = options.confirmSelectors || [];
  const confirmActions = [];
  if (confirmSelectors.length) {
    const initial = await waitForAnyVisible(page, successSelectors || [], {
      timeout: options.initialSuccessTimeout ?? Math.min(800, options.timeout ?? 2200),
      interval: options.interval ?? 125,
    });
    if (initial.ok) return { ok: true, action, confirmation: initial, confirmActions };

    const attempts = Math.max(1, Number(options.confirmAttempts) || 1);
    for (let index = 0; index < attempts; index += 1) {
      const confirmAction = await clickFirstVisible(page, confirmSelectors);
      if (!confirmAction.ok) break;
      confirmActions.push(confirmAction);

      const afterConfirmBlocked = await detectAccessBlocked(page);
      if (afterConfirmBlocked.blocked) {
        return { ok: false, reason: 'verification_required', action, confirmActions, blocked: afterConfirmBlocked };
      }

      const confirmed = await waitForAnyVisible(page, successSelectors || [], {
        timeout: options.confirmSuccessTimeout ?? options.timeout ?? 2200,
        interval: options.interval ?? 125,
      });
      if (confirmed.ok) return { ok: true, action, confirmation: confirmed, confirmActions };
    }
  }

  const confirmation = await waitForAnyVisible(page, successSelectors || [], {
    timeout: options.timeout ?? 2200,
    interval: options.interval ?? 125,
  });
  if (!confirmation.ok) return { ok: false, reason: 'success_not_confirmed', action, confirmation, confirmActions };
  return { ok: true, action, confirmation, confirmActions };
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
    const clone = body.cloneNode(true);
    clone.querySelectorAll('input, textarea, [contenteditable="true"], script, style').forEach((node) => node.remove());
    return clone.innerText || clone.textContent || '';
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
