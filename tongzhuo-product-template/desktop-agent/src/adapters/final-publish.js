import {
  adapterResult,
  clickAndConfirm,
  defaultPublishConfirmSelectors,
  defaultPublishSelectors,
  defaultPublishSuccessSelectors,
  selectorDetails,
} from './fill-tools.js';

export function selectorList(primary, fallback) {
  const items = Array.isArray(primary) ? primary : [];
  return [...new Set([...items, ...fallback].filter(Boolean))];
}

export function publishSelectors(platform = {}) {
  return selectorList(platform.editorHints?.publishSelectors, defaultPublishSelectors);
}

export function publishConfirmSelectors(platform = {}) {
  return selectorList(platform.editorHints?.publishConfirmSelectors, defaultPublishConfirmSelectors);
}

export function publishSuccessSelectors(platform = {}) {
  return selectorList(platform.editorHints?.publishSuccessSelectors, defaultPublishSuccessSelectors);
}

function mergedSelectorDetails(base, extra) {
  return { ...(base || {}), ...selectorDetails(extra) };
}

export async function submitFinalPublish(adapter, page, base = {}) {
  const platform = adapter.platform;
  const hints = platform.editorHints || {};
  const submitted = await clickAndConfirm(page, publishSelectors(platform), publishSuccessSelectors(platform), {
    timeout: hints.publishSuccessTimeout ?? 5000,
    confirmSelectors: publishConfirmSelectors(platform),
    confirmAttempts: hints.publishConfirmAttempts ?? 1,
    confirmSuccessTimeout: hints.publishConfirmSuccessTimeout ?? hints.publishSuccessTimeout ?? 5000,
  });

  if (!submitted.ok) {
    if (submitted.reason === 'verification_required') {
      return adapterResult(platform.id, 'awaiting_login', `${platform.name} 需要先在本地完成登录、验证码或安全验证。`, page, {
        execution_mode: platform.execution?.mode || base.execution_mode || 'automated',
        verification_reason: submitted.blocked?.reason || 'verification_after_submit',
        next_action: 'operator_login_or_verify_platform',
        selector_details: mergedSelectorDetails(base.selector_details, { publish: submitted.action }),
      });
    }
    return adapterResult(platform.id, 'failed', `${platform.name} 未取得发布成功信号，未将任务标记为已发布。`, page, {
      execution_mode: platform.execution?.mode || base.execution_mode || 'automated',
      failure_category: `publish_${submitted.reason || 'submit_failed'}`,
      retryable: false,
      next_action: 'operator_inspect_failed_platforms',
      ...base,
      selectors: {
        ...(base.selectors || {}),
        publish: submitted.action?.selector || null,
        publish_confirm: submitted.confirmActions?.map((item) => item.selector) || [],
      },
      selector_details: mergedSelectorDetails(base.selector_details, { publish: submitted.action, publish_confirm: submitted.confirmActions, publish_success: submitted.confirmation }),
    });
  }

  return adapterResult(platform.id, 'published', `${platform.name} 已自动提交并确认平台返回成功。`, page, {
    execution_mode: platform.execution?.mode || base.execution_mode || 'automated',
    next_action: 'none',
    ...base,
    selectors: {
      ...(base.selectors || {}),
      publish: submitted.action.selector,
      publish_confirm: submitted.confirmActions?.map((item) => item.selector) || [],
      publish_success: submitted.confirmation.selector,
    },
    selector_details: mergedSelectorDetails(base.selector_details, { publish: submitted.action, publish_confirm: submitted.confirmActions, publish_success: submitted.confirmation }),
    fill: { ...(base.fill || {}), published: true },
  });
}
