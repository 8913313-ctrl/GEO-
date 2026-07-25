import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  AiGenerationService,
  AiGenerationRunStore,
  ContractValidationError
} from "../ai-generation-service.mjs";

const secret = "sk-real-server-only-secret-123456";
const provider = {
  id: "deepseek",
  name: "DeepSeek",
  baseUrl: "https://api.deepseek.com/v1",
  model: "deepseek-chat",
  protocol: "openai_compatible",
  kind: "text",
  status: "enabled",
  apiKey: secret
};
const providerStore = {
  async load() {},
  find(id) { return id === provider.id ? provider : null; },
  async recordConnectionTest(id, status, message, testedAt) {
    assert.equal(id, provider.id);
    return {
      id: provider.id,
      name: provider.name,
      baseUrl: provider.baseUrl,
      model: provider.model,
      kind: provider.kind,
      status: provider.status,
      connectionStatus: status,
      lastTestMessage: message,
      lastTestAt: testedAt,
      hasApiKey: true,
      apiKeyMasked: "sk-r••••••••3456"
    };
  }
};

function upstreamResponse(content, options = {}) {
  return new Response(JSON.stringify({
    id: options.id || "chatcmpl-demo",
    choices: [{ message: { role: "assistant", content: JSON.stringify(content) } }],
    usage: { prompt_tokens: 120, completion_tokens: 240, total_tokens: 360 }
  }), { status: options.status || 200, headers: { "Content-Type": "application/json", "x-request-id": "req-demo-001" } });
}

const businessLine = {
  id: "BL-GEO",
  name: "GEO 优化服务",
  product: "企业 GEO 优化与运营",
  audience: "制造业企业",
  scenario: "AI 搜索品牌发现与内容信源建设"
};

const questionResult = {
  questions: [{
    sourceKeyword: "制造业 GEO",
    question: "制造企业做 GEO 优化时，应该先整理哪些企业资料？",
    dimension: "question",
    recommendation: 55,
    business: 88,
    askability: 94,
    specificity: 86,
    businessRelevance: 95,
    evidenceReadiness: 82,
    duplicateRisk: 8
  }]
};

const topicResult = {
  topics: [{
    questionId: "Q-001",
    coreQuestion: "制造企业启动 GEO 优化前，应该优先整理并核验哪些企业资料？",
    title: "制造企业启动 GEO 优化前，应该优先整理并核验哪些企业资料？",
    reason: "直接回答启动前的资料准备问题，便于客户判断是否具备实施条件。",
    answerPromise: "给出资料类型、审核顺序和启动前核验清单。",
    decisionRole: "市场负责人和业务负责人",
    answerMode: "直接答案与准备清单",
    evidenceNeeds: ["企业主体资料", "产品与服务边界", "可公开案例"],
    faqSeeds: ["哪些制造企业更适合先做 GEO 优化？", "资料不完整时应该怎么开始做 GEO 优化？"],
    queryRewrites: ["制造企业怎么开始准备 GEO 优化资料？"],
    recommendation: 93,
    business: 89,
    questionAlignment: 98,
    customerLanguage: 96,
    evidenceReadiness: 84
  }]
};

const coreQuestion = "制造企业做 GEO 优化时，应该先整理哪些企业资料？";
const refinedCoreQuestion = "制造企业启动 GEO 优化前，应该优先整理并核验哪些企业资料？";
const articleHtml = [
  '<section id="p-intro"><h2>直接回答</h2><p><strong>结论：</strong>制造企业做 GEO 优化时，应该先整理哪些企业资料？应先统一企业主体、产品服务边界和可公开证据，再开始内容规划。</p></section>',
  '<section id="p-scope"><h2>适用对象与问题边界</h2><p>这份清单面向准备启动项目的制造企业，不替代法务、资质或技术审核。</p></section>',
  '<section id="p-knowledge"><h2>关键判断与事实依据</h2><p>企业资料需要有明确来源、版本和审核状态，才能作为文章中的企业事实。<sup data-evidence-id="CIT-1">[K1]</sup></p></section>',
  '<section id="p-topic"><h2>实施步骤或决策清单</h2><ol><li>确认企业主体与对外名称。</li><li>整理产品、服务范围和适用场景。</li><li>审核案例、问答与禁用表达。</li></ol></section>',
  '<section id="p-faq"><h2>常见追问</h2><h3>资料不完整时应该怎么开始？</h3><p>先处理会影响核心答案的资料，再把缺口列入补证计划。</p><h3>哪些资料不能直接对外使用？</h3><p>未获授权、没有来源或尚未审核的资料不能写成企业事实。</p></section>',
  '<section id="p-boundary"><h2>信息边界与更新时间</h2><p>本文只使用本次提供并标记为已审核的证据；价格、客户名称与效果数字若没有证据则省略，发布前仍需人工复核。</p></section>'
].join("");

const articleResult = {
  title: coreQuestion,
  summary: "先统一企业主体、产品服务边界和可公开证据，再启动 GEO 内容规划。",
  html: articleHtml,
  usedEvidenceIds: ["CIT-1"],
  omittedClaims: ["统一报价与确定性效果"],
  warnings: ["发布前复核企业资料版本"]
};

const dataDir = await mkdtemp(path.join(os.tmpdir(), "tongzhuo-ai-generation-"));
try {
  const calls = [];
  const queue = [questionResult, topicResult, articleResult];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return upstreamResponse(queue.shift());
  };
  const runStore = new AiGenerationRunStore({ dataDir });
  const service = new AiGenerationService({ providerStore, runStore, fetchImpl, maxAttempts: 1, timeoutMs: 5000 });

  const questions = await service.generateQuestions({
    providerId: provider.id,
    businessLine,
    seeds: ["制造业 GEO"],
    dimensions: ["question"],
    limitPerDimension: 1,
    existingQuestions: []
  });
  assert.equal(questions.questions.length, 1);
  assert.equal(questions.questions[0].generationMode, "model");
  assert.equal(questions.questions[0].modelRecommendation, 55);
  assert.equal(questions.questions[0].priorityScore, 91);
  assert.equal(questions.questions[0].recommendation, 91);
  assert.deepEqual(questions.questions[0].scoreBreakdown, {
    askability: 94,
    businessRelevance: 95,
    specificity: 86,
    commercialValue: 88,
    evidenceReadiness: 82,
    contentGap: 100,
    nonRepeat: 92
  });
  assert.equal(questions.questions[0].intent, "");
  assert.equal(questions.questions[0].stage, "");
  assert.deepEqual(questions.questions[0].followUpQuestions, []);
  assert.deepEqual(questions.questions[0].queryRewrites, []);
  assert.deepEqual(questions.questions[0].evidenceRequirements, []);
  assert.equal(questions.run.providerId, provider.id);
  assert.equal(Object.hasOwn(questions.run, "apiKey"), false);

  const topics = await service.generateTopics({
    providerId: provider.id,
    businessLine,
    questions: [{
      id: "Q-001",
      question: coreQuestion,
      sourceKeyword: "制造业 GEO",
      dimension: "question",
      intent: "方案了解",
      stage: "方案评估",
      coverage: "未覆盖"
    }],
    existingTopics: []
  });
  assert.equal(topics.topics.length, 1);
  assert.equal(topics.topics[0].coreQuestion, refinedCoreQuestion);
  assert.equal(topics.topics[0].title, refinedCoreQuestion);
  assert.equal(topics.topics[0].geoBrief.coreQuestion, refinedCoreQuestion);
  assert.equal(topics.topics[0].geoBrief.parentQuestion, coreQuestion);
  assert.equal(topics.topics[0].geoBrief.sourceQuestionId, "Q-001");

  const article = await service.generateArticle({
    providerId: provider.id,
    businessLine,
    contentType: "深度文章",
    topic: { id: "TOP-001", title: coreQuestion, dimension: "question", geoBrief: { coreQuestion } },
    writingAgent: { id: "WA-001", strictKnowledge: true, citationsRequired: true, minWords: 800, maxWords: 1600 },
    evidence: [{ id: "CIT-1", marker: "K1", claim: "企业资料需要审核", quote: "企业资料应保留来源、版本和审核状态。", status: "verified" }]
  });
  assert.equal(article.title, coreQuestion);
  assert.equal(article.quality.safeHtml, true);
  assert.deepEqual(article.usedEvidenceIds, ["CIT-1"]);

  assert.equal(calls.length, 3);
  assert.equal(calls[0].options.body.includes("askerRole"), false);
  assert.equal(calls[0].options.body.includes("triggerScenario"), false);
  assert.equal(calls[0].options.body.includes("followUpQuestions"), false);
  calls.forEach(({ url, options }) => {
    assert.equal(url, "https://api.deepseek.com/v1/chat/completions");
    assert.equal(options.headers.Authorization, `Bearer ${secret}`);
    assert.equal(options.body.includes(secret), false);
  });

  const persisted = await readFile(path.join(dataDir, "ai-generation-runs.json"), "utf8");
  assert.equal(persisted.includes(secret), false);
  assert.equal(JSON.parse(persisted).runs.length, 3);

  const probeService = new AiGenerationService({
    providerStore,
    runStore,
    maxAttempts: 1,
    timeoutMs: 5000,
    fetchImpl: async () => upstreamResponse({ ok: true })
  });
  const probe = await probeService.testProvider(provider.id);
  assert.equal(probe.status, "passed");
  assert.equal(probe.provider.hasApiKey, true);
  assert.equal(JSON.stringify(probe).includes(secret), false);

  const unsafeService = new AiGenerationService({
    providerStore,
    runStore,
    maxAttempts: 1,
    timeoutMs: 5000,
    fetchImpl: async () => upstreamResponse({ ...articleResult, html: `${articleHtml}<script>alert(1)</script>` })
  });
  await assert.rejects(
    () => unsafeService.generateArticle({
      providerId: provider.id,
      businessLine,
      topic: { title: coreQuestion, geoBrief: { coreQuestion } },
      writingAgent: { strictKnowledge: true, citationsRequired: true },
      evidence: [{ id: "CIT-1", marker: "K1", claim: "企业资料需要审核", quote: "企业资料应保留来源、版本和审核状态。", status: "verified" }]
    }),
    (error) => error instanceof ContractValidationError && error.code === "MODEL_CONTRACT_INVALID"
  );

  const failedService = new AiGenerationService({
    providerStore,
    runStore,
    maxAttempts: 1,
    timeoutMs: 5000,
    fetchImpl: async () => new Response(JSON.stringify({ error: { message: `invalid key ${secret}` } }), { status: 401, headers: { "Content-Type": "application/json" } })
  });
  await assert.rejects(
    () => failedService.generateQuestions({ providerId: provider.id, businessLine, seeds: ["制造业 GEO"], dimensions: ["question"] }),
    (error) => error.code === "UPSTREAM_HTTP_ERROR" && !error.message.includes(secret)
  );
  const persistedAfterFailures = await readFile(path.join(dataDir, "ai-generation-runs.json"), "utf8");
  assert.equal(persistedAfterFailures.includes(secret), false);

  console.log("AI generation service check passed");
} finally {
  await rm(dataDir, { recursive: true, force: true });
}
