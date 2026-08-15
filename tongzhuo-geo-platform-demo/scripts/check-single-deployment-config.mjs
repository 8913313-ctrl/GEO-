import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { assertProductionConfiguration, productionConfig } from "../production-config.mjs";
import { openProductionDatabase } from "../production-foundation.mjs";
import { WorkspaceStore } from "../workspace-store.mjs";

const mapped = assertProductionConfiguration({ ...productionConfig, workspaceId: "default", projectId: "example-company" });
assert.equal(mapped.workspaceId, "default", "a source deployment uses one fixed internal workspace");
assert.throws(
  () => assertProductionConfiguration({ ...productionConfig, workspaceId: "second-identity" }),
  /内部工作区必须固定为 default/,
  "a second workspace identity must be rejected"
);
assert.throws(
  () => assertProductionConfiguration({ ...productionConfig, projectId: "invalid project" }),
  /TZ_PROJECT_ID 格式不正确/,
  "unsafe project identifiers must be rejected"
);

const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "tongzhuo-deployment-config-"));
const database = openProductionDatabase({ databasePath: path.join(temporaryDirectory, "deployment.sqlite") });
try {
  const store = new WorkspaceStore(database);
  store.save("default", { articles: [{ id: "A", title: "企业内容" }] }, { expectedRevision: 0 });
  assert.equal(store.get("default").state.articles[0].id, "A");
  assert.equal(store.listBusinessRecords("default", "article")[0].recordId, "A");
} finally {
  database.close();
  await rm(temporaryDirectory, { recursive: true, force: true });
}

console.log("Single-enterprise deployment configuration checks passed.");
