import assert from "node:assert/strict";
import { AidsoClient } from "../aidso-client.mjs";
import { bootstrapRelay } from "../relay-bootstrap.mjs";
import { createManagedAidsoClient } from "../managed-aidso-client.mjs";
import { assertRelayRuntimeConfig, loadRelayRuntimeConfig } from "../relay-config.mjs";
import { RelayStore } from "../relay-store.mjs";

assert.equal(loadRelayRuntimeConfig({ NODE_ENV: "development" }).aidsoMode, "mock");
assert.throws(
  () => assertRelayRuntimeConfig(loadRelayRuntimeConfig({
    NODE_ENV: "production",
    TZ_RELAY_AIDSO_MODE: "mock",
    TZ_RELAY_SEED_DEMO: "1"
  })),
  /TZ_RELAY_ADMIN_TOKEN/
);
const productionConfig = loadRelayRuntimeConfig({
  NODE_ENV: "production",
  TZ_RELAY_ADMIN_TOKEN: "admin-token-check",
  TZ_RELAY_MASTER_KEY: Buffer.alloc(32, 7).toString("base64url"),
  TZ_RELAY_SEED_DEMO: "0",
  TZ_RELAY_AIDSO_MODE: "real",
  AIDSO_BASE_URL: "https://openapi.aidso.com/geo_api",
  TZ_RELAY_PUBLIC_ORIGIN: "https://relay.example.test",
  TZ_RELAY_TRUSTED_PROXY_ADDRESSES: "127.0.0.1"
});
assert.doesNotThrow(() => assertRelayRuntimeConfig(productionConfig));
assert.equal(productionConfig.adminSessionCookieName, "__Host-tz-relay-admin-session");
assert.equal(productionConfig.adminSessionSecureCookie, true);
assert.equal(productionConfig.adminSessionTtlSeconds, 3_600);
assert.throws(
  () => assertRelayRuntimeConfig(loadRelayRuntimeConfig({
    NODE_ENV: "production",
    TZ_RELAY_ADMIN_TOKEN: "admin-token-check",
    TZ_RELAY_MASTER_KEY: Buffer.alloc(32, 12).toString("base64url"),
    TZ_RELAY_SEED_DEMO: "0",
    TZ_RELAY_AIDSO_MODE: "real",
    TZ_RELAY_PUBLIC_ORIGIN: "https://relay.example.test",
    TZ_RELAY_TRUSTED_PROXY_ADDRESSES: "0.0.0.0/0"
  })),
  /精确 IP/
);
assert.throws(
  () => assertRelayRuntimeConfig(loadRelayRuntimeConfig({
    NODE_ENV: "production",
    TZ_RELAY_ADMIN_TOKEN: "admin-token-check",
    TZ_RELAY_MASTER_KEY: Buffer.alloc(32, 13).toString("base64url"),
    TZ_RELAY_SEED_DEMO: "0",
    TZ_RELAY_AIDSO_MODE: "real",
    TZ_RELAY_PUBLIC_ORIGIN: "https://relay.example.test",
    TZ_RELAY_TRUSTED_PROXY_ADDRESSES: "127.0.0.1",
    TZ_RELAY_ADMIN_TOKEN_FILE: "/tmp/another-admin-token"
  })),
  /同时通过环境值和文件注入/
);
assert.throws(
  () => assertRelayRuntimeConfig({
    ...productionConfig,
    masterKey: "",
    masterKeyExplicitlyConfigured: false,
    masterKeyFile: process.execPath
  }),
  /explicitly injected TZ_RELAY_MASTER_KEY/
);
assert.throws(
  () => assertRelayRuntimeConfig({
    ...productionConfig,
    databasePath: ":memory:"
  }),
  /forbids TZ_RELAY_DATABASE_PATH=:memory:/
);
assert.throws(
  () => assertRelayRuntimeConfig(loadRelayRuntimeConfig({
    NODE_ENV: "production",
    TZ_RELAY_ADMIN_TOKEN: "admin-token-check",
    TZ_RELAY_MASTER_KEY: Buffer.alloc(32, 8).toString("base64url"),
    TZ_RELAY_SEED_DEMO: "0",
    TZ_RELAY_AIDSO_MODE: "real",
    TZ_RELAY_ADMIN_SESSION_SECURE: "0",
    TZ_RELAY_PUBLIC_ORIGIN: "https://relay.example.test",
    TZ_RELAY_TRUSTED_PROXY_ADDRESSES: "127.0.0.1"
  })),
  /Secure/
);
assert.throws(
  () => assertRelayRuntimeConfig(loadRelayRuntimeConfig({
    NODE_ENV: "production",
    TZ_RELAY_ADMIN_TOKEN: "admin-token-check",
    TZ_RELAY_MASTER_KEY: Buffer.alloc(32, 9).toString("base64url"),
    TZ_RELAY_SEED_DEMO: "0",
    TZ_RELAY_AIDSO_MODE: "real"
  })),
  /PUBLIC_ORIGIN/
);
assert.throws(
  () => assertRelayRuntimeConfig(loadRelayRuntimeConfig({
    NODE_ENV: "production",
    TZ_RELAY_ADMIN_TOKEN: "admin-token-check",
    TZ_RELAY_MASTER_KEY: Buffer.alloc(32, 10).toString("base64url"),
    TZ_RELAY_SEED_DEMO: "0",
    TZ_RELAY_AIDSO_MODE: "real",
    TZ_RELAY_PUBLIC_ORIGIN: "https://relay.example.test",
    TZ_RELAY_TRUSTED_PROXY_ADDRESSES: "127.0.0.1",
    AIDSO_BASE_URL: "http://aidso-private.example.test"
  })),
  /HTTPS AIDSO_BASE_URL/
);
assert.throws(
  () => assertRelayRuntimeConfig(loadRelayRuntimeConfig({
    NODE_ENV: "production",
    TZ_RELAY_ADMIN_TOKEN: "admin-token-check",
    TZ_RELAY_MASTER_KEY: Buffer.alloc(32, 11).toString("base64url"),
    TZ_RELAY_SEED_DEMO: "0",
    TZ_RELAY_AIDSO_MODE: "real",
    TZ_RELAY_PUBLIC_ORIGIN: "https://relay.example.test",
    TZ_RELAY_TRUSTED_PROXY_ADDRESSES: "127.0.0.1",
    AIDSO_BASE_URL: "https://user:password@openapi.aidso.com/geo_api"
  })),
  /embedded credentials/
);

const requests = [];
const fetchImpl = async (url, init) => {
  requests.push({ url: String(url), headers: init.headers });
  return new Response(JSON.stringify({ error: "probe request id not found" }), { status: 404 });
};

const realClient = new AidsoClient({ token: "probe-token", fetchImpl });
const probe = await realClient.probe({ reqId: "__check_probe__" });
assert.equal(probe.status, "healthy", "a non-auth 404 proves the upstream endpoint is reachable");
assert.equal(requests[0].headers["aidso-token"], "probe-token");

const store = new RelayStore({ databasePath: ":memory:", masterKey: Buffer.alloc(32, 3) });
try {
  const provider = store.upsertProviderAccount({
    providerAccountId: "provider-managed-check",
    providerCode: "aidso",
    displayName: "AIDSO managed check",
    status: "active",
    isDefault: true,
    token: "first-token"
  });
  const managed = createManagedAidsoClient({
    store,
    providerAccountId: provider.providerAccountId,
    mode: "real",
    fetchImpl
  });
  await managed.probe({ reqId: "__managed_first__" });
  assert.equal(requests.at(-1).headers["aidso-token"], "first-token");
  store.upsertProviderAccount({
    providerAccountId: provider.providerAccountId,
    providerCode: "aidso",
    displayName: "AIDSO managed check",
    status: "active",
    isDefault: true,
    token: "rotated-token"
  });
  await managed.probe({ reqId: "__managed_rotated__" });
  assert.equal(requests.at(-1).headers["aidso-token"], "rotated-token", "worker must pick up a rotated DB token without restart");

  const bootstrap = bootstrapRelay(store, { seedDemo: false, aidsoMode: "real" });
  assert.equal(bootstrap.providerAccountId, "provider_aidso_central");

  store.upsertProviderAccount({
    providerAccountId: bootstrap.providerAccountId,
    providerCode: "aidso",
    displayName: "AIDSO central",
    status: "active",
    isDefault: true,
    tokenReference: "operator:2026-08-03",
    token: "persisted-central-token"
  });
  bootstrapRelay(store, { seedDemo: false, aidsoMode: "real" });
  const restartedProvider = store.getProviderAccount(bootstrap.providerAccountId);
  assert.equal(restartedProvider.tokenReference, "operator:2026-08-03", "bootstrap must not erase the encrypted database token reference");
  assert.equal(restartedProvider.metadata.executionMode, "real");
  assert.equal(store.getProviderToken(bootstrap.providerAccountId), "persisted-central-token");
  const previousEnvironmentToken = process.env.AIDSO_TOKEN;
  try {
    process.env.AIDSO_TOKEN = "stale-environment-token";
    bootstrapRelay(store, { seedDemo: false, aidsoMode: "real" });
    assert.equal(store.getProviderToken(bootstrap.providerAccountId), "persisted-central-token", "a restart must not overwrite an operator-rotated DB token with a stale env token");
  } finally {
    if (previousEnvironmentToken === undefined) delete process.env.AIDSO_TOKEN;
    else process.env.AIDSO_TOKEN = previousEnvironmentToken;
  }
  store.upsertProviderAccount({
    providerAccountId: bootstrap.providerAccountId,
    providerCode: "aidso",
    displayName: "Operator shared AIDSO",
    status: "degraded",
    isDefault: true,
    capabilities: { version: "operator-capability-v2", platforms: [{ code: "DB", terminals: ["web"], modes: ["fast"] }] },
    maxInFlight: 3
  });
  bootstrapRelay(store, { seedDemo: false, aidsoMode: "real" });
  const persistedOperatorConfig = store.getProviderAccount(bootstrap.providerAccountId);
  assert.equal(persistedOperatorConfig.displayName, "Operator shared AIDSO");
  assert.equal(persistedOperatorConfig.status, "degraded");
  assert.equal(persistedOperatorConfig.maxInFlight, 3);
  assert.equal(persistedOperatorConfig.capabilities.version, "operator-capability-v2");
  store.upsertPriceRule({
    providerAccountId: bootstrap.providerAccountId,
    platform: "DB",
    terminal: "web",
    mode: "fast",
    customerCredits: 99,
    estimatedUpstreamCredits: 4,
    version: "central-v1"
  });
  bootstrapRelay(store, { seedDemo: false, aidsoMode: "real" });
  const persistedPrice = store.db.prepare(`SELECT customer_credits FROM relay_price_rules WHERE provider_account_id = ? AND platform = 'DB' AND terminal = 'web' AND mode = 'fast' AND version = 'central-v1'`).get(bootstrap.providerAccountId);
  assert.equal(Number(persistedPrice.customer_credits), 99, "bootstrap must not overwrite an operator-edited price version");

  const demoTenant = store.createTenant({
    tenantId: "tenant_demo_jingjin",
    displayName: "development fixture",
    metadata: { demo: true }
  });
  assert.equal(demoTenant.tenantId, "tenant_demo_jingjin");
  assert.throws(() => store.assertNoDemoData(), /演示/);
} finally {
  store.close();
}

const developmentArtifactStore = new RelayStore({ databasePath: ":memory:", masterKey: Buffer.alloc(32, 12) });
try {
  bootstrapRelay(developmentArtifactStore, { seedDemo: false, aidsoMode: "real", production: false });
  assert.throws(
    () => developmentArtifactStore.assertNoDemoData(),
    /演示/
  );
  const cleanProductionStore = new RelayStore({ databasePath: ":memory:", masterKey: Buffer.alloc(32, 13) });
  try {
    const productionBootstrap = bootstrapRelay(cleanProductionStore, { seedDemo: false, aidsoMode: "real", production: true });
    const provider = cleanProductionStore.getProviderAccount(productionBootstrap.providerAccountId);
    assert.equal(provider.status, "degraded");
    assert.deepEqual(provider.capabilities.platforms, []);
    assert.equal(cleanProductionStore.db.prepare("SELECT COUNT(*) AS count FROM relay_price_rules").get().count, 0);
    assert.doesNotThrow(() => cleanProductionStore.assertNoDemoData());
  } finally {
    cleanProductionStore.close();
  }
} finally {
  developmentArtifactStore.close();
}

console.log("Relay production configuration and AIDSO probe checks passed.");
