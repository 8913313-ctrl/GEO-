const DEFAULT_CAPABILITIES = Object.freeze({
  version: "aidso-capability-snapshot-v2",
  provider: "aidso",
  syncedAt: null,
  source: "development-capability-book",
  platforms: [
    { code: "DB", name: "豆包", terminals: ["web", "mobile"], modes: ["fast", "expert"] },
    { code: "DS", name: "DeepSeek", terminals: ["web", "mobile"], modes: ["fast", "deep"] },
    { code: "YB", name: "腾讯元宝", terminals: ["web", "mobile", "commerce"], modes: ["fast", "deep"] },
    { code: "QW", name: "通义千问", terminals: ["web", "mobile", "commerce"], modes: ["fast", "deep"] },
    { code: "BD", name: "百度 AI", terminals: ["web"], modes: ["fast"] },
    { code: "WX", name: "文心一言", terminals: ["web"], modes: ["fast", "deep"] },
    { code: "KIMI", name: "Kimi", terminals: ["web"], modes: ["fast", "thinking"] },
    { code: "DYAI", name: "AI 抖音", terminals: ["web"], modes: ["fast", "deep"] },
    { code: "RED", name: "红书问一问", terminals: ["mobile"], modes: ["fast"] }
  ]
});

const PRICE_MATRIX = Object.freeze([
  ["DB", "web", "fast", 2, 1], ["DB", "mobile", "fast", 2, 1], ["DB", "web", "expert", 5, 3],
  ["DS", "web", "fast", 2, 1], ["DS", "mobile", "fast", 2, 1], ["DS", "web", "deep", 5, 3], ["DS", "mobile", "deep", 5, 3],
  ["YB", "web", "fast", 2, 1], ["YB", "mobile", "fast", 2, 1], ["YB", "commerce", "fast", 2, 1], ["YB", "web", "deep", 5, 3], ["YB", "mobile", "deep", 5, 3],
  ["QW", "web", "fast", 2, 1], ["QW", "mobile", "fast", 2, 1], ["QW", "commerce", "fast", 2, 1], ["QW", "web", "deep", 5, 3], ["QW", "mobile", "deep", 5, 3],
  ["BD", "web", "fast", 2, 1], ["WX", "web", "fast", 2, 1], ["WX", "web", "deep", 5, 3], ["KIMI", "web", "fast", 2, 1], ["KIMI", "web", "thinking", 5, 3],
  ["DYAI", "web", "fast", 2, 1], ["DYAI", "web", "deep", 5, 3], ["RED", "mobile", "fast", 2, 1]
]);

function hasRow(store, table, id) {
  return Boolean(store.db.prepare(`SELECT 1 FROM ${table} WHERE id = ?`).get(id));
}

function parseJson(value, fallback = {}) {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return parsed === undefined || parsed === null ? fallback : parsed;
  } catch {
    return fallback;
  }
}

function seedEnabled(options = {}) {
  if (options.seedDemo !== undefined) return Boolean(options.seedDemo);
  if (process.env.TZ_RELAY_SEED_DEMO !== undefined) return process.env.TZ_RELAY_SEED_DEMO !== "0";
  return process.env.NODE_ENV !== "production";
}

export function bootstrapRelay(store, options = {}) {
  const now = new Date().toISOString();
  const production = options.production === true
    || (options.production === undefined && String(process.env.NODE_ENV || "").trim().toLowerCase() === "production");
  const providerAccountId = "provider_aidso_central";
  const capabilitySnapshot = { ...DEFAULT_CAPABILITIES, syncedAt: now };
  const existingProvider = store.db.prepare("SELECT * FROM relay_provider_accounts WHERE id = ?").get(providerAccountId);
  const configuredAidsoToken = String(options.aidsoToken ?? process.env.AIDSO_TOKEN ?? "").trim();
  const executionMode = String(options.aidsoMode || process.env.TZ_RELAY_AIDSO_MODE || process.env.AIDSO_MODE || (configuredAidsoToken ? "real" : "mock")).trim().toLowerCase();
  const existingCapabilities = parseJson(existingProvider?.capabilities_json, null);
  const developmentCapabilities = existingCapabilities?.source === "development-capability-book"
    || (!production && existingCapabilities?.version === "aidso-capability-snapshot-v1")
    ? { ...DEFAULT_CAPABILITIES, syncedAt: now }
    : existingCapabilities;
  const existingMetadata = parseJson(existingProvider?.metadata_json, {});
  const providerInput = {
    providerAccountId,
    providerCode: "aidso",
    displayName: existingProvider?.display_name || "爱搜 GEO OpenAPI（桐灼统一账号）",
    // A fresh production tenant has no verified capability or commercial price
    // data yet. Do not advertise a sample price book as an AIDSO integration:
    // an operator must save the approved capability snapshot and prices before
    // the worker becomes ready for customer traffic.
    status: existingProvider?.status || (production ? "degraded" : "active"),
    isDefault: existingProvider ? Boolean(existingProvider.is_default) : true,
    tokenReference: existingProvider?.token_envelope_json
      ? (existingProvider.token_reference || "database:encrypted")
      : (configuredAidsoToken ? "env:AIDSO_TOKEN" : "未配置：使用本地模拟适配器"),
    capabilities: developmentCapabilities && Object.keys(developmentCapabilities).length
      ? developmentCapabilities
      : (production
          ? { version: "unconfigured", provider: "aidso", syncedAt: null, platforms: [], source: "operator_required" }
          : capabilitySnapshot),
    lastKnownBalance: existingProvider?.last_known_balance === null || existingProvider?.last_known_balance === undefined
      ? (Number(process.env.AIDSO_INITIAL_BALANCE || 0) || null)
      : Number(existingProvider.last_known_balance),
    maxInFlight: Number(existingProvider?.max_in_flight || process.env.AIDSO_MAX_IN_FLIGHT || 8) || 8,
    metadata: { ...existingMetadata, managedBy: "tongzhuo-central", executionMode }
  };
  // Once an administrator has rotated the encrypted database token, a restart
  // must not silently overwrite it with a stale AIDSO_TOKEN from the process
  // environment. The env token is only the first-boot seed.
  if (!existingProvider?.token_envelope_json && configuredAidsoToken) providerInput.token = configuredAidsoToken;
  store.upsertProviderAccount(providerInput);
  if (!production) {
    for (const [platform, terminal, mode, customerCredits, estimatedUpstreamCredits] of PRICE_MATRIX) {
      const existingPrice = store.db.prepare(`
        SELECT 1 FROM relay_price_rules
        WHERE provider_account_id = ? AND platform = ? AND terminal = ? AND mode = ? AND version = 'central-v1'
      `).get(providerAccountId, platform, terminal, mode);
      if (existingPrice) continue;
      store.upsertPriceRule({
        providerAccountId,
        platform,
        terminal,
        mode,
        customerCredits,
        estimatedUpstreamCredits,
        version: "central-v1",
        metadata: { source: "development-price-book", configuredAt: now }
      });
    }
  }

  const seeded = { providerAccountId, demoInstance: null };
  if (!seedEnabled(options)) return seeded;
  if (hasRow(store, "relay_tenants", "tenant_demo_jingjin")) {
    if (!production && hasRow(store, "relay_instances", "instance_demo_jingjin_prod")) {
      store.db.prepare(`UPDATE relay_instances SET allowed_capabilities_json = ?, updated_at = ? WHERE id = ?`).run(
        JSON.stringify({ allowedPlatforms: DEFAULT_CAPABILITIES.platforms.map((platform) => platform.code) }),
        now,
        "instance_demo_jingjin_prod"
      );
    }
    return seeded;
  }

  const tenant = store.createTenant({
    tenantId: "tenant_demo_jingjin",
    displayName: "精进供应链（本地演示客户）",
    initialCredits: 10_000,
    initialCreditNote: "中央中转平台本地演示初始积分",
    metadata: { plan: "企业专业版", demo: true }
  });
  const clientSecret = process.env.TZ_RELAY_DEMO_CLIENT_SECRET || "tz-local-demo-client-secret-change-before-production";
  const provisioned = store.provisionInstance({
    instanceId: "instance_demo_jingjin_prod",
    tenantId: tenant.tenantId,
    providerAccountId,
    displayName: "精进供应链私有化生产实例（演示）",
    clientId: "tz-demo-jingjin-prod",
    clientSecret,
    allowedCapabilities: { allowedPlatforms: ["DB", "DS", "YB", "QW", "BD", "WX", "KIMI", "DYAI", "RED"] },
    maxInFlight: 2,
    dailyCreditLimit: 2_000,
    monthlyCreditLimit: 20_000,
    metadata: { demo: true, environment: "production-like" }
  });
  seeded.demoInstance = {
    tenantId: tenant.tenantId,
    instanceId: provisioned.instance.instanceId,
    clientId: provisioned.instance.clientId,
    clientSecret: provisioned.clientSecret
  };
  return seeded;
}

export { DEFAULT_CAPABILITIES, PRICE_MATRIX };
