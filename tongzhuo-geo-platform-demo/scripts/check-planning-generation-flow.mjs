import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AI_GENERATION_DIMENSIONS } from "../ai-generation-service.mjs";
import { ProductionDatabase } from "../production-database.mjs";
import { FoundationAssetStore } from "../foundation-asset-store.mjs";
import { ensureGeoFoundationPublishedAssets } from "../foundation-assets/bootstrap.mjs";
import { importUpsGeoCandidateRules } from "../foundation-assets/ups-geo-review-import.mjs";
import { requireIndustryTemplate } from "../industry-templates/index.mjs";

const PROVIDER_ID = "offline-fictional-e2e";
const PROVIDER_SECRET = "sk-offline-fictional-only";
const MODEL = "offline-fictional-model";
const BUSINESS_LINE_ID = "BL-OFFLINE-FICTIONAL";
const BUSINESS_LINE = {
  id: BUSINESS_LINE_ID,
  name: "虚构设备知识运营测试线",
  product: "虚构型设备知识工作台",
  description: "仅用于本地自动化验证的虚构设备资料治理与知识运营服务。",
  audience: "虚构制造企业的市场、产品和设备运营团队",
  scenario: "虚构设备资料审核、知识库维护和内容生产",
  serviceScope: "虚构资料盘点、证据审核、知识检索和内容生产"
};
const CORE_KEYWORD = "虚构工业知识运营";
const SEED_TERMS = [
  "虚构工业知识库规划", "虚构设备资料治理", "虚构知识运营流程", "虚构设备证据审核",
  "虚构工业内容生产", "虚构产品知识检索", "虚构企业资料版本", "虚构设备问答运营"
];
const QUESTION_PATTERNS = [
  (seed) => `制造企业首次采购${seed}服务前，应该核验哪些公开资料和交付边界？`,
  (seed) => `设备运营团队用${seed}搭建知识库时，如何确定资料版本、负责人和审核周期？`,
  (seed) => `市场负责人评估${seed}方案时，怎样比较数据来源、实施步骤与验收指标？`,
  (seed) => `售后团队上线${seed}系统后，遇到证据冲突时应该按什么流程复核？`,
  (seed) => `企业准备扩展${seed}应用场景时，如何判断预算条件、系统接口和服务范围？`
];

const tempDir = await mkdtemp(path.join(os.tmpdir(), "tongzhuo-planning-flow-"));
const databasePath = path.join(tempDir, "planning-flow.sqlite");
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const candidateManifest = JSON.parse(await readFile(path.join(projectRoot, "docs", "baseline", "P2-T06-UPS-GEO-RULE-CANDIDATES-20260812.json"), "utf8"));
const machineryTemplate = requireIndustryTemplate("machinery");
const machineryTemplateSnapshot = {
  templateKey: machineryTemplate.templateKey,
  version: machineryTemplate.version,
  checksum: machineryTemplate.checksum,
  promptPreset: machineryTemplate.promptPreset
};
const bootstrapDatabase = new ProductionDatabase({ databasePath });
try {
  const foundationStore = new FoundationAssetStore(bootstrapDatabase);
  const methodology = importUpsGeoCandidateRules(foundationStore, candidateManifest);
  for (const review of methodology.rules) foundationStore.upsertMethodologySourceReview({
    methodologyVersionId: methodology.version.id,
    ruleId: review.ruleId,
    theme: review.theme,
    rule: review.rule,
    source: review.source,
    classification: review.classification,
    applicability: review.applicability,
    licenseStatus: review.licenseStatus,
    reuseDecision: "approved-global",
    reviewStatus: "approved",
    reviewNote: "isolated planning-generation persistence fixture"
  });
  foundationStore.setMethodologyVersionStatus(methodology.version.id, "published");
  ensureGeoFoundationPublishedAssets(foundationStore);
} finally {
  bootstrapDatabase.close();
}
const modelCalls = [];
const callCounts = { seeds: 0, questions: 0, topics: 0, article: 0 };
let topicQuestions = [];
let articleTopic = null;
let articleEvidenceId = "";
let child = null;
let childOutput = "";

function openAiResponse(content) {
  return {
    id: `chatcmpl-offline-${Date.now().toString(36)}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: MODEL,
    choices: [{ index: 0, message: { role: "assistant", content: JSON.stringify(content) }, finish_reason: "stop" }],
    usage: { prompt_tokens: 120, completion_tokens: 80, total_tokens: 200 }
  };
}

function detectOperation(prompt) {
  if (prompt.includes('"usedEvidenceIds"') && prompt.includes('"html"')) return "article";
  if (prompt.includes('"topics"') && prompt.includes('"questionId"')) return "topics";
  if (prompt.includes('"questions"') && prompt.includes('"dimension"')) return "questions";
  if (prompt.includes('"seeds"') && prompt.includes('"sourceKeyword"')) return "seeds";
  return "unknown";
}

function modelPayload(operation) {
  if (operation === "seeds") {
    return { seeds: SEED_TERMS.map((term, index) => ({ term, sourceKeyword: CORE_KEYWORD, reason: `虚构测试种子 ${index + 1} 用于覆盖资料、流程和决策场景。` })) };
  }
  if (operation === "questions") {
    const callIndex = callCounts.questions;
    const dimension = AI_GENERATION_DIMENSIONS[callIndex];
    const seed = SEED_TERMS[callIndex % SEED_TERMS.length];
    return { questions: QUESTION_PATTERNS.map((makeQuestion) => ({ sourceKeyword: seed, question: makeQuestion(seed), dimension })) };
  }
  if (operation === "topics") {
    const batch = topicQuestions.slice(callCounts.topics * 3, callCounts.topics * 3 + 3);
    return {
      topics: batch.map((question, index) => ({
        questionId: question.id,
        coreQuestion: question.question,
        title: question.question,
        reason: `直接回答来源问题 ${index + 1}，并保留原有的虚构业务决策边界。`,
        answerPromise: "帮助读者获得资料准备、证据核验、实施顺序和下一步行动的明确判断。",
        decisionRole: "虚构企业市场与设备运营负责人",
        answerMode: "直接回答与核验清单",
        evidenceNeeds: ["虚构企业公开资料", "虚构设备服务范围与版本记录"],
        faqSeeds: [
          `围绕${question.sourceKeyword}还需要核验哪些虚构企业公开资料？`,
          `实施${question.sourceKeyword}时如何判断资料版本是否仍然有效？`
        ],
        queryRewrites: [question.question]
      }))
    };
  }
  if (operation === "article") {
    const question = articleTopic.coreQuestion;
    return {
      title: question,
      summary: "本文使用本地虚构知识证据，说明资料准备、核验边界和实施步骤。",
      html: [
        `<section id="p-intro"><h2>直接结论</h2><p>${question}应先确认资料版本、公开范围和负责人，再安排检索与内容生产。<sup data-evidence-id="${articleEvidenceId}">[K1]</sup></p></section>`,
        "<section id=\"p-scope\"><h2>适用范围</h2><p>本说明只适用于北辰虚构工业测试有限公司及其虚构型设备知识工作台，不代表任何真实企业、产品、价格或效果。</p></section>",
        "<section id=\"p-knowledge\"><h2>证据与判断</h2><p>审核资料时需要确认文档标题、当前版本、适用设备范围、维护负责人和更新时间。内容团队只能使用已经批准并可公开检索的知识。</p></section>",
        "<section id=\"p-topic\"><h2>实施步骤</h2><ol><li>登记虚构资料并提交审核。</li><li>核对版本和公开边界。</li><li>完成知识检索后生成内容。</li><li>由人工复核文章再进入发布流程。</li></ol></section>",
        "<section id=\"p-faq\"><h2>常见问题</h2><h3>资料版本变化后怎么办？</h3><p>重新提交并批准新版本，旧版本不再作为当前事实来源。</p><h3>证据不足时能否补写结论？</h3><p>不能。应标记知识缺口，补齐并审核资料后再生成内容。</p></section>",
        "<section id=\"p-boundary\"><h2>来源与边界</h2><p>本文只引用本次离线测试创建的虚构知识库，未知价格、排名、客户案例和效果承诺均未写入。</p></section>"
      ].join(""),
      usedEvidenceIds: [articleEvidenceId],
      omittedClaims: ["未提供且不应虚构的价格、排名和效果承诺"],
      warnings: ["发布前仍需人工审核虚构测试内容"]
    };
  }
  return null;
}

const modelServer = http.createServer(async (request, response) => {
  try {
    let raw = "";
    for await (const chunk of request) {
      raw += chunk.toString("utf8");
      if (Buffer.byteLength(raw, "utf8") > 2_000_000) throw new Error("offline request too large");
    }
    const body = raw ? JSON.parse(raw) : {};
    const prompt = (body.messages || []).map((message) => String(message?.content || "")).join("\n");
    const operation = detectOperation(prompt);
    if (!Object.hasOwn(callCounts, operation)) {
      response.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ error: { message: "Unknown offline generation operation" } }));
      return;
    }
    const payload = modelPayload(operation);
    modelCalls.push({ operation, body, prompt, path: request.url || "" });
    callCounts[operation] += 1;
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "X-Request-ID": `offline-${operation}-${callCounts[operation]}` });
    response.end(JSON.stringify(openAiResponse(payload)));
  } catch (error) {
    response.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ error: { message: error.message } }));
  }
});

async function listen(server, port = 0) {
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(port, "127.0.0.1", resolve); });
  return server.address().port;
}

async function freePort() {
  const probe = net.createServer();
  const port = await listen(probe, 0);
  await new Promise((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()));
  return port;
}

function cleanChildEnvironment() {
  const env = { ...process.env };
  const secretName = /(OPENAI|DEEPSEEK|DASHSCOPE|MOONSHOT|ZHIPU|ANTHROPIC|GROQ|GEMINI|GOOGLE|AZURE).*?(API[_-]?KEY|TOKEN|SECRET)|^(OPENAI|DEEPSEEK|DASHSCOPE|MOONSHOT|ZHIPU|ANTHROPIC)_API_KEY$/i;
  Object.keys(env).forEach((name) => { if (secretName.test(name)) delete env[name]; });
  return env;
}

function cookies(response) {
  const values = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [response.headers.get("set-cookie")].filter(Boolean);
  return values.map((value) => value.split(";", 1)[0]).join("; ");
}

async function request(baseUrl, pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, options);
  const raw = await response.text();
  let body = {};
  try { body = raw ? JSON.parse(raw) : {}; } catch { body = { message: raw }; }
  return { response, body };
}

async function expectRequest(baseUrl, pathname, options, status, label) {
  const result = await request(baseUrl, pathname, options);
  assert.equal(result.response.status, status, `${label} failed: ${result.response.status} ${JSON.stringify(result.body)}\n${childOutput}`);
  return result.body;
}

async function waitUntilReady(baseUrl) {
  for (let attempt = 0; attempt < 300; attempt += 1) {
    if (child?.exitCode !== null) throw new Error(`isolated server exited before readiness (code ${child.exitCode})\n${childOutput}`);
    try {
      const result = await request(baseUrl, "/health/ready");
      if (result.response.status === 200 && result.body.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`isolated server did not become ready\n${childOutput}`);
}

async function allFiles(root) {
  const files = [];
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(fullPath);
      else if (entry.isFile()) files.push(fullPath);
    }
  }
  await walk(root);
  return files;
}

async function stopChild() {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([new Promise((resolve) => child.once("exit", resolve)), new Promise((resolve) => setTimeout(resolve, 5_000))]);
  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGKILL");
    await new Promise((resolve) => child.once("exit", resolve));
  }
}

try {
  const modelPort = await listen(modelServer, 0);
  const appPort = await freePort();
  const baseUrl = `http://127.0.0.1:${appPort}`;
  const env = cleanChildEnvironment();
  Object.assign(env, {
    NODE_ENV: "test", TZ_BIND_HOST: "127.0.0.1", TZ_COOKIE_SECURE: "0", TZ_SITE_EMBED: "false",
    TZ_PROJECT_ID: "offline-machinery", TZ_INDUSTRY_TEMPLATE: "machinery",
    TZ_DATABASE_PATH: databasePath, TZ_DATA_DIR: path.join(tempDir, "data"),
    TZ_LOG_DIR: path.join(tempDir, "logs"), TZ_AI_PROVIDER_DATA_DIR: path.join(tempDir, "providers"),
    TZ_AI_GENERATION_DATA_DIR: path.join(tempDir, "generation"), TZ_PUBLISHER_DATA_DIR: path.join(tempDir, "publisher"),
    TZ_MASTER_KEY: randomBytes(32).toString("base64"), TZ_AI_GENERATION_TIMEOUT_MS: "5000",
    TZ_AI_GENERATION_MAX_ATTEMPTS: "1", TZ_AI_UPSTREAM_MAX_ATTEMPTS: "1", TZ_AI_UPSTREAM_RETRY_BASE_MS: "0",
    TZ_AI_QUESTION_DIMENSIONS_PER_BATCH: "1", TZ_AI_TOPIC_QUESTIONS_PER_BATCH: "3"
  });
  child = spawn(process.execPath, [path.resolve("server.mjs"), String(appPort)], { cwd: path.resolve("."), env, stdio: ["ignore", "pipe", "pipe"] });
  child.stdout.on("data", (chunk) => { childOutput = (childOutput + chunk.toString("utf8")).slice(-30_000); });
  child.stderr.on("data", (chunk) => { childOutput = (childOutput + chunk.toString("utf8")).slice(-30_000); });
  await waitUntilReady(baseUrl);

  const setup = await expectRequest(baseUrl, "/api/v1/auth/setup", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "offline-admin", displayName: "虚构链路管理员", password: "OfflinePlanning!2026" })
  }, 201, "admin setup");
  assert.ok(setup.data.csrfToken);
  const login = await request(baseUrl, "/api/v1/auth/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "offline-admin", password: "OfflinePlanning!2026" })
  });
  assert.equal(login.response.status, 200, JSON.stringify(login.body));
  const sessionCookie = cookies(login.response);
  const csrf = login.body.data.csrfToken;
  const auth = { Cookie: sessionCookie, "X-CSRF-Token": csrf, "Content-Type": "application/json" };

  let body = await expectRequest(baseUrl, "/api/ai/providers", {
    method: "POST", headers: auth,
    body: JSON.stringify({ id: PROVIDER_ID, name: "本地虚构 DeepSeek 兼容模型", baseUrl: `http://127.0.0.1:${modelPort}/v1`, model: MODEL, apiKey: PROVIDER_SECRET, kind: "text", status: "enabled" })
  }, 201, "provider creation");
  assert.equal(body.provider.id, PROVIDER_ID);
  assert.equal(JSON.stringify(body).includes(PROVIDER_SECRET), false);

  body = await expectRequest(baseUrl, "/api/ai/generate/seeds", {
    method: "POST", headers: auth,
    body: JSON.stringify({ providerId: PROVIDER_ID, businessLine: BUSINESS_LINE, coreKeywords: [CORE_KEYWORD], count: 8, existingSeeds: [] })
  }, 200, "keyword expansion");
  const seeds = body.data.seeds;
  assert.equal(seeds.length, 8);
  assert.ok(seeds.every((item) => item.scoreSource === "system_rules_v1"));

  body = await expectRequest(baseUrl, "/api/ai/generate/questions", {
    method: "POST", headers: auth,
    body: JSON.stringify({ providerId: PROVIDER_ID, businessLine: BUSINESS_LINE, seeds: seeds.map((item) => item.term), dimensions: AI_GENERATION_DIMENSIONS, limitPerDimension: 5, existingQuestions: [] })
  }, 200, "question library generation");
  const questions = body.data.questions;
  assert.equal(questions.length, 40, JSON.stringify(body.data.rejected || []));
  assert.deepEqual(AI_GENERATION_DIMENSIONS.map((dimension) => questions.filter((item) => item.dimension === dimension).length), Array(8).fill(5));
  assert.equal(body.data.generationRunIds.length, 8);
  assert.ok(questions.every((item) => item.scoreSource === "system_rules_v1"));
  assert.ok(new Set(questions.map((item) => item.priorityScore)).size > 1);
  assert.ok(questions.some((item) => item.priorityScore !== 78));

  topicQuestions = AI_GENERATION_DIMENSIONS.slice(0, 4).map((dimension, index) => ({ ...questions.find((item) => item.dimension === dimension), id: `Q-OFFLINE-${index + 1}` }));
  body = await expectRequest(baseUrl, "/api/ai/generate/topics", {
    method: "POST", headers: auth,
    body: JSON.stringify({ providerId: PROVIDER_ID, businessLine: BUSINESS_LINE, questions: topicQuestions, existingTopics: [] })
  }, 200, "topic library generation");
  // The browser persists each generated topic into its local library and
  // assigns the stable topic ID that later appears in plans and articles.
  const topics = body.data.topics.map((topic, index) => ({ ...topic, id: `TOP-OFFLINE-${index + 1}` }));
  assert.equal(topics.length, 4);
  assert.equal(body.data.generationRunIds.length, 2);
  assert.deepEqual(topics.map((item) => item.questionId), topicQuestions.map((item) => item.id));
  assert.ok(topics.every((item) => item.scoreSource === "system_rules_v1"));
  assert.ok(topics.some((item) => item.recommendation !== 78));

  body = await expectRequest(baseUrl, "/api/v1/knowledge/libraries", {
    method: "POST", headers: auth,
    body: JSON.stringify({ name: "北辰虚构设备公开知识库", kind: "document", businessLineId: BUSINESS_LINE_ID, description: "仅用于离线链路测试的虚构公开资料。" })
  }, 201, "knowledge library creation");
  const libraryId = body.data.library.id;
  body = await expectRequest(baseUrl, `/api/v1/knowledge/libraries/${encodeURIComponent(libraryId)}/documents`, {
    method: "POST", headers: auth,
    body: JSON.stringify({ title: "北辰虚构设备知识运营边界", sourceType: "text", content: "北辰虚构工业测试有限公司使用虚构型设备知识工作台管理公开资料。资料进入内容生产前必须记录版本、负责人、适用设备范围和更新时间，并经过人工审核。证据冲突时暂停生成，完成复核后才能继续。" })
  }, 201, "knowledge document creation");
  const knowledgeVersionId = body.data.version.id;
  body = await expectRequest(baseUrl, `/api/v1/knowledge/versions/${encodeURIComponent(knowledgeVersionId)}/approve`, { method: "POST", headers: auth, body: "{}" }, 200, "knowledge approval");
  assert.equal(body.data.version.indexStatus, "indexed");
  body = await expectRequest(baseUrl, "/api/v1/knowledge/retrieve", {
    method: "POST", headers: auth,
    body: JSON.stringify({ query: "虚构型设备知识工作台如何审核资料版本和证据冲突？", businessLineId: BUSINESS_LINE_ID, libraryIds: [libraryId], topK: 4 })
  }, 200, "knowledge retrieval");
  assert.ok(body.data.evidence.length >= 1, JSON.stringify(body));
  const retrievedEvidence = body.data.evidence[0];
  assert.equal(retrievedEvidence.versionId, knowledgeVersionId);
  articleEvidenceId = retrievedEvidence.id;

  const expectedCompletionAt = new Date(Date.now() + 7 * 86_400_000).toISOString();
  const planPayload = {
    id: "PLAN-OFFLINE-FLOW-1", businessLineId: BUSINESS_LINE_ID, name: "虚构设备知识内容计划", contentType: "深度文章",
    status: "planned", scheduledFor: expectedCompletionAt, dueAt: expectedCompletionAt, expectedCompletionAt,
    metadata: { localPlanId: "PLAN-OFFLINE-FLOW-1", topicIds: topics.map((item) => item.id || item.questionId), topicSnapshots: topics }
  };
  body = await expectRequest(baseUrl, "/api/v1/content/plans", { method: "POST", headers: auth, body: JSON.stringify(planPayload) }, 201, "content plan creation");
  const plan = body.data.plan;
  assert.equal(plan.scheduledFor, expectedCompletionAt);
  assert.deepEqual(plan.metadata.industryTemplateSnapshot, machineryTemplate, "content plan must freeze the server-selected industry template");
  body = await expectRequest(baseUrl, "/api/v1/content/plans", { method: "POST", headers: auth, body: JSON.stringify(planPayload) }, 201, "content plan replay");
  assert.equal(body.data.plan.id, plan.id);
  assert.equal(body.data.plan.revision, plan.revision);

  articleTopic = topics[0];
  const taskId = "TASK-OFFLINE-FLOW-1";
  const articleId = "ART-OFFLINE-FLOW-1";
  body = await expectRequest(baseUrl, "/api/ai/generate/article", {
    method: "POST", headers: auth,
    body: JSON.stringify({
      providerId: PROVIDER_ID, businessLine: BUSINESS_LINE, topic: articleTopic, contentType: "深度文章",
      contentPlanId: plan.id, planId: plan.id, contentTaskId: taskId, contentArticleId: articleId,
      expectedCompletionAt, idempotencyKey: "offline-fictional-article-v1", useRag: true,
      rag: { enabled: true, query: articleTopic.coreQuestion, businessLineId: BUSINESS_LINE_ID, libraryIds: [libraryId], topK: 4, minScore: 0 },
      writingAgent: { id: "AGENT-OFFLINE-FICTIONAL", name: "虚构知识编辑", version: 3, role: "虚构设备知识编辑", style: "证据优先", strictKnowledge: true, citationsRequired: true, missingEvidenceAction: "omit", minWords: 300, maxWords: 900 }
    })
  }, 200, "article generation");
  const articleResult = body.data;
  assert.equal(articleResult.contentTaskId, taskId);
  assert.equal(articleResult.contentArticleId, articleId);
  assert.ok(articleResult.articleVersionId);
  assert.equal(articleResult.contentVersion.reviewStatus, "draft");
  assert.equal(articleResult.generationJob.status, "succeeded");
  assert.equal(articleResult.generationJob.model, MODEL, "generation job must record the effective provider model");
  assert.deepEqual(articleResult.article.citations.map((item) => item.id), [retrievedEvidence.id]);
  const persistedMetadata = articleResult.contentVersion.metadata;
  assert.equal(persistedMetadata.model, MODEL);
  assert.deepEqual(persistedMetadata.industryTemplate, machineryTemplateSnapshot);
  assert.deepEqual(persistedMetadata.writingAgentSnapshot, {
    id: "AGENT-OFFLINE-FICTIONAL", name: "虚构知识编辑", version: 3,
    role: "虚构设备知识编辑", style: "证据优先", strictKnowledge: true,
    citationsRequired: true, missingEvidenceAction: "omit"
  });
  assert.equal(persistedMetadata.methodology.versionId, "MVER-GEO-CORE-V1");
  assert.match(persistedMetadata.methodology.checksum, /^[0-9a-f]{64}$/);
  assert.ok(persistedMetadata.methodology.fragmentIds.length > 0);
  assert.equal(persistedMetadata.promptFoundation.templateId, "PVER-GEO-ARTICLE-V1");
  assert.match(persistedMetadata.promptFoundation.checksum, /^[0-9a-f]{64}$/);
  assert.deepEqual(persistedMetadata.promptFoundation.variables.knowledge_scope.library_ids, [libraryId]);
  assert.ok(persistedMetadata.promptFoundation.renderedPrompt.includes(libraryId));
  assert.equal(persistedMetadata.promptFoundation.quality.packId, "QRULE-GEO-CONTENT-V1");
  assert.deepEqual(persistedMetadata.rag.libraryIds, [libraryId]);
  assert.equal(persistedMetadata.rag.businessLineId, BUSINESS_LINE_ID);
  assert.equal(articleResult.generationJob.request.writingAgentSnapshot.version, 3);
  assert.deepEqual(articleResult.generationJob.request.industryTemplate, machineryTemplate);
  assert.equal(articleResult.generationJob.request.methodology.versionId, "MVER-GEO-CORE-V1");
  assert.equal(articleResult.generationJob.request.promptFoundation.templateId, "PVER-GEO-ARTICLE-V1");

  body = await expectRequest(baseUrl, `/api/v1/content/tasks/${encodeURIComponent(taskId)}`, { headers: { Cookie: sessionCookie } }, 200, "content task detail");
  assert.equal(body.data.task.planId, plan.id);
  assert.equal(body.data.task.topicId, articleTopic.id || articleTopic.questionId);
  assert.equal(body.data.task.dueAt, expectedCompletionAt);
  assert.equal(body.data.task.status, "draft");
  assert.equal(body.data.article.id, articleId);
  assert.equal(body.data.version.id, articleResult.articleVersionId);
  assert.equal(body.data.version.evidence[0].knowledgeVersionId, knowledgeVersionId);
  assert.equal(body.data.version.evidence[0].knowledgeChunkId, retrievedEvidence.chunkId);

  body = await expectRequest(baseUrl, `/api/v1/content/tasks?planId=${encodeURIComponent(plan.id)}`, { headers: { Cookie: sessionCookie } }, 200, "content plan task list");
  assert.equal(body.data.items.length, 1);
  assert.equal(body.data.items[0].id, taskId);

  const producedPlanPayload = { ...planPayload, status: "active", metadata: { ...planPayload.metadata, localStatus: "produced", producedArticleIds: [articleId] } };
  body = await expectRequest(baseUrl, "/api/v1/content/plans", { method: "POST", headers: auth, body: JSON.stringify(producedPlanPayload) }, 201, "content plan produced sync");
  assert.equal(body.data.plan.status, "active");
  assert.equal(body.data.plan.metadata.localStatus, "produced");
  assert.ok(body.data.plan.revision > plan.revision);

  assert.deepEqual(callCounts, { seeds: 1, questions: 8, topics: 2, article: 1 });
  for (const call of modelCalls.filter((item) => ["questions", "topics", "article"].includes(item.operation))) {
    assert.equal(call.body.enable_thinking, false, `${call.operation} must disable provider thinking`);
    assert.deepEqual(call.body.thinking, { type: "disabled" }, `${call.operation} thinking contract mismatch`);
  }
  modelCalls.forEach((call) => assert.equal(/桐灼|tongzhuo/i.test(call.prompt), false, `real brand data reached the offline model during ${call.operation}`));
  for (const filePath of await allFiles(tempDir)) {
    const bytes = await readFile(filePath);
    assert.equal(bytes.includes(Buffer.from(PROVIDER_SECRET)), false, `provider secret leaked into ${path.relative(tempDir, filePath)}`);
  }
  console.log("Planning generation flow check passed");
} finally {
  await stopChild();
  if (modelServer.listening) await new Promise((resolve) => modelServer.close(resolve));
  await rm(tempDir, { recursive: true, force: true });
}
