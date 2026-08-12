import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { assertProductionConfiguration, productionConfig } from "../production-config.mjs";
import { openProductionDatabase } from "../production-foundation.mjs";
import { WorkspaceStore } from "../workspace-store.mjs";

const tenantId = "tenant-building-materials-a";
const mapped = assertProductionConfiguration({ ...productionConfig, tenantId, workspaceId: tenantId });
assert.equal(mapped.workspaceId, tenantId, "tenant_id must map one-to-one to the existing workspace_id boundary");
assert.throws(
  () => assertProductionConfiguration({ ...productionConfig, tenantId, workspaceId: "second-identity" }),
  /workspaceId 必须与 tenantId 完全一致/,
  "a second customer identity must be rejected"
);
assert.throws(
  () => assertProductionConfiguration({ ...productionConfig, tenantId: "invalid tenant", workspaceId: "invalid tenant" }),
  /TZ_TENANT_ID 格式不正确/,
  "unsafe tenant identifiers must be rejected"
);

const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "tongzhuo-tenant-config-"));
const database = openProductionDatabase({ databasePath: path.join(temporaryDirectory, "tenant.sqlite") });
try {
  const store = new WorkspaceStore(database);
  store.save(tenantId, { articles: [{ id: "A", title: "Building materials" }] }, { expectedRevision: 0 });
  store.save("tenant-machinery-b", { articles: [{ id: "B", title: "Machinery" }] }, { expectedRevision: 0 });
  assert.equal(store.get(tenantId).state.articles[0].id, "A");
  assert.equal(store.get("tenant-machinery-b").state.articles[0].id, "B");
  assert.equal(store.listBusinessRecords(tenantId, "article")[0].recordId, "A");
  assert.equal(store.listBusinessRecords("tenant-machinery-b", "article")[0].recordId, "B");
  assert.equal(store.listBusinessRecords(tenantId, "article").some((item) => item.recordId === "B"), false, "tenant A must not read tenant B records");
} finally {
  database.close();
  await rm(temporaryDirectory, { recursive: true, force: true });
}

console.log("Tenant configuration and workspace isolation checks passed.");
