import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ContentStore } from "../content-store.mjs";
import { DiagnosticActionService } from "../diagnostic-action-service.mjs";
import { DiagnosticStore } from "../diagnostic-store.mjs";
import { ProductionDatabase } from "../production-database.mjs";
import { WorkspaceStore } from "../workspace-store.mjs";

const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "tongzhuo-diagnostic-actions-"));
let database;

try {
  database = new ProductionDatabase({ databasePath: path.join(temporaryDirectory, "actions.sqlite") });
  const workspaceStore = new WorkspaceStore(database);
  const contentStore = new ContentStore(database, { workspaceId: "default" });
  const diagnosticStore = new DiagnosticStore(database, { workspaceId: "default" });
  const actionService = new DiagnosticActionService({ diagnosticStore, workspaceStore, contentStore });

  workspaceStore.save("default", {
    businessLines: [{ id: "BL-TEST", name: "工业自动化", status: "active" }],
    questionLibrary: [],
    topics: [],
    knowledgeGaps: [],
    siteCmsTasks: [],
    contentPlans: [],
    publishSchedules: [],
    monitoring: { tasks: [] }
  }, { expectedRevision: 0, reason: "diagnostic-action-test" });

  const project = diagnosticStore.createProject({
    name: "工业自动化运营诊断",
    diagnosticType: "comprehensive",
    industry: "工业自动化",
    targetBrand: "测试企业",
    websiteUrl: "https://example.com/",
    businessLineId: "BL-TEST"
  });
  const created = diagnosticStore.createPhaseOneReport({
    projectId: project.id,
    questionSetSnapshot: [
      "工业自动化项目选型时应比较哪些参数？",
      "工业自动化供应商的交付能力如何核验？"
    ]
  });

  for (const proposed of created.actions) {
    const applied = await actionService.confirmAndApply({ actionId: proposed.id });
    assert.equal(applied.status, "applied");
    assert.ok(applied.targetEntityId);
  }

  const workspace = workspaceStore.get("default");
  assert.equal(workspace.state.questionLibrary.length, 2);
  assert.equal(workspace.state.knowledgeGaps.length, 5);
  assert.equal(workspace.state.siteCmsTasks.length, 1);
  assert.equal(workspace.state.contentPlans.length, 1);
  assert.equal(workspace.state.topics.length, 2);
  assert.equal(workspace.state.contentPlans[0].topicIds.length, 2);
  assert.ok(workspace.state.questionLibrary.every((item) => item.source.includes("运营诊断")));
  assert.ok(workspace.state.knowledgeGaps.every((item) => item.diagnosticProjectId === project.id));

  const plans = contentStore.listPlans({ workspaceId: "default" });
  assert.equal(plans.length, 1);
  assert.equal(plans[0].metadata.source, "operations_diagnostic");
  assert.equal(contentStore.listTasks({ workspaceId: "default", planId: plans[0].id }).length, 2);

  const actions = diagnosticStore.listActions({ projectId: project.id });
  assert.equal(actions.length, 4);
  assert.ok(actions.every((item) => item.status === "applied"));
  console.log("Diagnostic action backflow check passed");
} finally {
  database?.close();
  await rm(temporaryDirectory, { recursive: true, force: true });
}
