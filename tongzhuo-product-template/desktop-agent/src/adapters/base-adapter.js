import { adapterResult, detectAccessBlocked } from './fill-tools.js';

export class BaseAdapter {
  constructor(platform) {
    this.platform = platform;
  }

  async prepare(page) {
    if (!this.platform?.editorUrl || this.platform.editorUrl === 'about:blank') {
      throw new Error(`${this.platform?.name || '该平台'}没有可打开的编辑器地址。`);
    }
    await page.goto(this.platform.editorUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(1500);
    await page.bringToFront().catch(() => {});
  }

  async publishDraft(page, article) {
    await this.prepare(page, article);
    const blocked = await detectAccessBlocked(page);
    if (blocked.blocked) {
      return adapterResult(this.platform.id, 'awaiting_login', `${this.platform.name} 需要先在本地完成登录、验证码或安全验证。`, page, {
        execution_mode: this.platform.execution?.mode || 'unknown',
        verification_reason: blocked.reason,
        next_action: 'operator_login_or_verify_platform',
      });
    }
    return adapterResult(this.platform.id, 'failed', `${this.platform.name} 没有可验证的自动编辑适配器，已停止执行。`, page, {
      execution_mode: this.platform.execution?.mode || 'unknown',
      failure_category: 'adapter_not_available',
      retryable: false,
      next_action: 'operator_inspect_failed_platforms',
    });
  }
}
