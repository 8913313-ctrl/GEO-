import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  AI_GENERATION_DIMENSIONS,
  AiGenerationError,
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

function compatibleChatResponse(payload, options = {}) {
  return new Response(JSON.stringify(payload), {
    status: options.status || 200,
    headers: { "Content-Type": "application/json", "x-request-id": options.requestId || "req-compatible-001" }
  });
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
  assert.equal(JSON.parse(calls[0].options.body).enable_thinking, false);
  assert.deepEqual(JSON.parse(calls[0].options.body).thinking, { type: "disabled" });
  assert.equal(JSON.parse(calls[2].options.body).enable_thinking, false);
  calls.forEach(({ url, options }) => {
    assert.equal(url, "https://api.deepseek.com/v1/chat/completions");
    assert.equal(options.headers.Authorization, `Bearer ${secret}`);
    assert.equal(options.body.includes(secret), false);
  });

  const persisted = await readFile(path.join(dataDir, "ai-generation-runs.json"), "utf8");
  assert.equal(persisted.includes(secret), false);
  assert.equal(JSON.parse(persisted).runs.length, 3);

  let contractResponseCount = 0;
  const validationContexts = [];
  const contractRetryService = new AiGenerationService({
    providerStore,
    runStore,
    maxAttempts: 2,
    timeoutMs: 5000,
    fetchImpl: async () => {
      contractResponseCount += 1;
      return contractResponseCount === 1
        ? compatibleChatResponse({ choices: [{ message: { role: "assistant", content: "not-json" }, finish_reason: "stop" }] })
        : upstreamResponse({ ok: true });
    }
  });
  const contractRetry = await contractRetryService.generate(
    "contract-attempt-context",
    { providerId: provider.id },
    "Return JSON.",
    (raw, _input, context) => {
      validationContexts.push(context);
      return { ok: raw.ok === true };
    }
  );
  assert.equal(contractRetry.ok, true);
  assert.equal(contractRetry.run.attempts, 2);
  assert.equal(contractResponseCount, 2);
  assert.deepEqual(validationContexts, [{ attempt: 2, maxAttempts: 2 }], "the validator must receive the real model attempt even when the first response never reached it");

  let truncatedResponseCount = 0;
  const truncatedRequestBodies = [];
  const truncatedRetryService = new AiGenerationService({
    providerStore,
    runStore,
    maxAttempts: 2,
    upstreamMaxAttempts: 1,
    timeoutMs: 5000,
    fetchImpl: async (_url, options) => {
      truncatedRequestBodies.push(JSON.parse(options.body));
      truncatedResponseCount += 1;
      return truncatedResponseCount === 1
        ? compatibleChatResponse({ choices: [{ message: { role: "assistant", content: '{"ok":' }, finish_reason: "length" }] })
        : compatibleChatResponse({ choices: [{ message: { role: "assistant", content: '{"ok":true}' }, finish_reason: "stop" }] });
    }
  });
  const truncatedRetry = await truncatedRetryService.generate(
    "truncated-output-repair",
    { providerId: provider.id },
    "Return JSON.",
    (raw) => raw
  );
  assert.equal(truncatedRetry.ok, true);
  assert.equal(truncatedRetry.run.attempts, 2);
  assert.match(truncatedRequestBodies[1].messages[1].content, /长度限制被截断/);

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

  let retryCalls = 0;
  const retryService = new AiGenerationService({
    providerStore,
    runStore,
    maxAttempts: 1,
    upstreamMaxAttempts: 3,
    upstreamRetryBaseMs: 0,
    timeoutMs: 5000,
    fetchImpl: async () => {
      retryCalls += 1;
      if (retryCalls === 1) {
        return new Response(JSON.stringify({ error: { message: "Service is too busy, please retry later." } }), { status: 503, headers: { "Content-Type": "application/json" } });
      }
      if (retryCalls === 2) {
        return new Response(JSON.stringify({ choices: [{ message: { role: "assistant", content: "" } }] }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return upstreamResponse(questionResult);
    }
  });
  const retriedQuestions = await retryService.generateQuestions({
    providerId: provider.id,
    businessLine,
    seeds: ["制造业 GEO"],
    dimensions: ["question"],
    limitPerDimension: 1,
    existingQuestions: []
  });
  assert.equal(retriedQuestions.questions.length, 1);
  assert.equal(retryCalls, 3);

  let questionBatchCalls = 0;
  const batchedQuestionResult = {
    questions: AI_GENERATION_DIMENSIONS.map((dimension) => ({
      sourceKeyword: "GEO优化服务",
      question: `制造业企业评估GEO优化服务时，应该重点判断哪些${dimension}条件？`,
      dimension,
      recommendation: 80,
      business: 82,
      askability: 90,
      specificity: 82,
      businessRelevance: 90,
      evidenceReadiness: 80,
      duplicateRisk: 5
    }))
  };
  const questionBatchService = new AiGenerationService({
    providerStore,
    runStore,
    maxAttempts: 1,
    upstreamMaxAttempts: 1,
    timeoutMs: 5_000,
    fetchImpl: async () => {
      questionBatchCalls += 1;
      return upstreamResponse(batchedQuestionResult);
    }
  });
  assert.equal(questionBatchService.questionBatchConcurrency, 1, "question batches must default to a gateway-safe sequential queue");
  const batchedQuestions = await questionBatchService.generateQuestions({
    providerId: provider.id,
    businessLine,
    seeds: ["GEO优化服务"],
    dimensions: AI_GENERATION_DIMENSIONS,
    limitPerDimension: 1,
    existingQuestions: []
  });
  assert.equal(questionBatchCalls, 8, "eight dimensions must be split into eight finite single-dimension batches");
  assert.equal(batchedQuestions.questions.length, 8);
  assert.equal(batchedQuestions.generationRunIds.length, 8);

  let boundedQuestionPromptBody;
  const boundedQuestionPromptService = new AiGenerationService({
    providerStore,
    runStore,
    maxAttempts: 1,
    upstreamMaxAttempts: 1,
    timeoutMs: 5_000,
    fetchImpl: async (_url, options) => {
      boundedQuestionPromptBody = JSON.parse(options.body);
      return upstreamResponse(questionResult);
    }
  });
  await boundedQuestionPromptService.generateQuestions({
    providerId: provider.id,
    businessLine,
    seeds: ["制造业 GEO"],
    dimensions: ["question"],
    limitPerDimension: 1,
    existingQuestions: Array.from({ length: 100 }, (_, index) => `制造业 GEO 历史问题-${index}？`)
  });
  const boundedQuestionPrompt = boundedQuestionPromptBody.messages[1].content;
  assert.ok((boundedQuestionPrompt.match(/历史问题-/g) || []).length <= 6, "the model prompt must not repeat the full historical question library");
  assert.ok(!boundedQuestionPrompt.includes("历史问题-99"));

  const generationBudgetCalls = [];
  const generationBudgetService = new AiGenerationService({
    providerStore,
    runStore,
    maxAttempts: 1,
    upstreamMaxAttempts: 1,
    upstreamRetryBaseMs: 0,
    upstreamTotalTimeoutMs: 55_000,
    timeoutMs: 5_000,
    fetchImpl: async () => { throw new Error("callModelOnce is replaced by this check"); }
  });
  generationBudgetService.callModelOnce = async (_provider, model, _messages, options = {}) => {
    generationBudgetCalls.push(options);
    if (generationBudgetCalls.length === 1) {
      throw new AiGenerationError("temporary upstream connection failure", 502, "UPSTREAM_CONNECTION_ERROR");
    }
    return { content: JSON.stringify({ ok: true }), model, usage: null, requestId: "budget-probe" };
  };
  const budgetResult = await generationBudgetService.generate(
    "generation_budget_probe",
    { providerId: provider.id },
    "Return one JSON object.",
    (raw) => raw,
    {
      upstreamTotalTimeoutMs: 105_000,
      requestTimeoutMs: 100_000,
      upstreamMaxAttempts: 2,
      maxTokens: 128
    }
  );
  assert.equal(budgetResult.ok, true);
  assert.equal(generationBudgetCalls.length, 2, "one generation call must be able to override the upstream attempt limit");
  assert.equal(generationBudgetCalls[0].requestTimeoutMs, 100_000, "one generation call must override both the total and per-request time budgets");
  assert.equal(generationBudgetCalls[1].requestTimeoutMs, 100_000);

  const articleBudgetCalls = [];
  const articleBudgetService = new AiGenerationService({
    providerStore,
    runStore,
    maxAttempts: 1,
    upstreamMaxAttempts: 1,
    timeoutMs: 5_000,
    fetchImpl: async () => { throw new Error("callModel is replaced by this check"); }
  });
  articleBudgetService.callModel = async (_provider, model, _messages, options = {}) => {
    articleBudgetCalls.push(options);
    return { content: JSON.stringify(articleResult), finishReason: "stop", model, usage: null, requestId: "article-budget-probe" };
  };
  await articleBudgetService.generateArticle({
    providerId: provider.id,
    businessLine,
    contentType: "深度文章",
    topic: { id: "TOP-BUDGET", title: coreQuestion, geoBrief: { coreQuestion } },
    writingAgent: { id: "WA-BUDGET", strictKnowledge: true, citationsRequired: true, minWords: 800, maxWords: 1600 },
    evidence: [{ id: "CIT-1", marker: "K1", claim: "企业资料需要审核", quote: "企业资料应保留来源、版本和审核状态。", status: "verified" }]
  });
  assert.equal(articleBudgetCalls.length, 1);
  assert.equal(articleBudgetCalls[0].maxTokens, 6_000);
  assert.equal(articleBudgetCalls[0].upstreamTotalTimeoutMs, 105_000);
  assert.equal(articleBudgetCalls[0].requestTimeoutMs, 95_000);
  assert.equal(articleBudgetCalls[0].upstreamMaxAttempts, 2);

  const compatibilityBodies = [];
  const compatibilityPayloads = [
    {
      choices: [{ message: { role: "assistant", content: "", reasoning_content: JSON.stringify({ ok: true }) } }]
    },
    {
      choices: [{ message: { role: "assistant", content: null }, text: JSON.stringify({ ok: true }) }]
    },
    {
      output_text: [{ type: "output_text", text: JSON.stringify({ ok: true }) }]
    },
    {
      choices: [{ message: { role: "assistant", content: "", reasoning_content: JSON.stringify({ ok: false }) }, text: JSON.stringify({ ok: true }) }]
    }
  ];
  let compatibilityIndex = 0;
  const compatibilityService = new AiGenerationService({
    providerStore,
    runStore,
    maxAttempts: 1,
    upstreamMaxAttempts: 1,
    timeoutMs: 5_000,
    fetchImpl: async (_url, options) => {
      compatibilityBodies.push(JSON.parse(options.body));
      return compatibleChatResponse(compatibilityPayloads[compatibilityIndex++]);
    }
  });
  for (let index = 0; index < compatibilityPayloads.length; index += 1) {
    const result = await compatibilityService.generate(
      `response_compatibility_probe_${index}`,
      { providerId: provider.id },
      "Return one JSON object.",
      (raw) => raw,
      { maxTokens: 128 }
    );
    assert.equal(result.ok, true);
  }
  assert.ok(compatibilityBodies.every((body) => !Object.hasOwn(body, "response_format")), "DeepSeek-compatible gateways must not be forced into the response_format path");

  const genericProvider = {
    id: "generic-openai",
    name: "Generic OpenAI Compatible",
    baseUrl: "https://api.openai.example/v1",
    model: "gpt-test",
    protocol: "openai_compatible",
    kind: "text",
    status: "enabled",
    apiKey: "sk-generic-test"
  };
  const genericProviderStore = {
    async load() {},
    find(id) { return id === genericProvider.id ? genericProvider : null; }
  };
  let genericBody;
  const genericService = new AiGenerationService({
    providerStore: genericProviderStore,
    runStore,
    maxAttempts: 1,
    upstreamMaxAttempts: 1,
    timeoutMs: 5_000,
    fetchImpl: async (_url, options) => {
      genericBody = JSON.parse(options.body);
      return upstreamResponse({ ok: true });
    }
  });
  const genericResult = await genericService.generate(
    "generic_response_format_probe",
    { providerId: genericProvider.id },
    "Return one JSON object.",
    (raw) => raw,
    { maxTokens: 128 }
  );
  assert.equal(genericResult.ok, true);
  assert.deepEqual(genericBody.response_format, { type: "json_object" }, "non-DeepSeek OpenAI-compatible providers retain JSON response_format");

  const unsafeCompatibilityService = new AiGenerationService({
    providerStore,
    runStore,
    maxAttempts: 1,
    upstreamMaxAttempts: 1,
    timeoutMs: 5_000,
    fetchImpl: async () => compatibleChatResponse({ choices: [{ message: { content: { raw: secret } } }] })
  });
  await assert.rejects(
    () => unsafeCompatibilityService.generate(
      "response_compatibility_invalid_probe",
      { providerId: provider.id },
      "Return one JSON object.",
      (raw) => raw,
      { maxTokens: 128 }
    ),
    (error) => error.code === "UPSTREAM_EMPTY_RESPONSE" && !error.message.includes(secret)
  );
  const reasoningProseService = new AiGenerationService({
    providerStore,
    runStore,
    maxAttempts: 1,
    upstreamMaxAttempts: 1,
    timeoutMs: 5_000,
    fetchImpl: async () => compatibleChatResponse({ choices: [{ message: { content: "", reasoning_content: "I considered the request, but did not produce the final object." } }] })
  });
  await assert.rejects(
    () => reasoningProseService.generate(
      "response_compatibility_reasoning_prose_probe",
      { providerId: provider.id },
      "Return one JSON object.",
      (raw) => raw,
      { maxTokens: 128 }
    ),
    (error) => error.code === "UPSTREAM_EMPTY_RESPONSE"
  );

  const truncatedEmptyBodies = [];
  let truncatedEmptyCalls = 0;
  const truncatedEmptyRetryService = new AiGenerationService({
    providerStore,
    runStore,
    maxAttempts: 1,
    upstreamMaxAttempts: 2,
    upstreamRetryBaseMs: 0,
    timeoutMs: 5_000,
    fetchImpl: async (_url, options) => {
      truncatedEmptyBodies.push(JSON.parse(options.body));
      truncatedEmptyCalls += 1;
      return truncatedEmptyCalls === 1
        ? compatibleChatResponse({ choices: [{ finish_reason: "length", message: { content: "", reasoning_content: "unfinished reasoning" } }], usage: { completion_tokens: 4_500 } })
        : compatibleChatResponse({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ ok: true }) } }] });
    }
  });
  const recoveredTruncatedEmpty = await truncatedEmptyRetryService.generate(
    "truncated-empty-recovery",
    { providerId: provider.id },
    "Return one JSON object.",
    (raw) => raw,
    { maxTokens: 4_500 }
  );
  assert.equal(recoveredTruncatedEmpty.ok, true);
  assert.equal(truncatedEmptyBodies.length, 2);
  assert.equal(truncatedEmptyBodies[0].max_tokens, 4_500);
  assert.ok(truncatedEmptyBodies[1].max_tokens > truncatedEmptyBodies[0].max_tokens, "a truncated empty response must retry with a larger completion budget");
  const truncatedReasoningService = new AiGenerationService({
    providerStore,
    runStore,
    maxAttempts: 1,
    upstreamMaxAttempts: 1,
    timeoutMs: 5_000,
    fetchImpl: async () => compatibleChatResponse({ choices: [{ finish_reason: "length", message: { content: "", reasoning_content: JSON.stringify({ ok: true }) } }] })
  });
  await assert.rejects(
    () => truncatedReasoningService.generate(
      "response_compatibility_truncated_reasoning_probe",
      { providerId: provider.id },
      "Return one JSON object.",
      (raw) => raw,
      { maxTokens: 128 }
    ),
    (error) => error.code === "UPSTREAM_OUTPUT_TRUNCATED" && error.finishReason === "length"
  );
  const persistedCompatibility = await readFile(path.join(dataDir, "ai-generation-runs.json"), "utf8");
  assert.equal(persistedCompatibility.includes(secret), false, "raw compatible responses must never be persisted");

  console.log("AI generation service check passed");
} finally {
  await rm(dataDir, { recursive: true, force: true });
}
