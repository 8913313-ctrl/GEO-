import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { AiGenerationRunStore, AiGenerationService } from "../ai-generation-service.mjs";

const apiKey = process.env.REAL_DEEPSEEK_TOKEN;
if (!apiKey) throw new Error("REAL_DEEPSEEK_TOKEN is required");
const dataDir = await mkdtemp(path.join(os.tmpdir(), "geo-real-deepseek-"));
const provider = {
  id: "deepseek-real-test",
  name: "DeepSeek real test",
  baseUrl: "https://api.deepseek.com/v1",
  model: "deepseek-v4-flash",
  protocol: "openai_compatible",
  kind: "text",
  status: "enabled",
  apiKey,
  fallbackProviderIds: []
};
const providerStore = {
  async load() {},
  find(id) { return id === provider.id ? provider : null; },
  async recordConnectionTest() { return { id: provider.id, hasApiKey: true }; }
};
const service = new AiGenerationService({ providerStore, runStore: new AiGenerationRunStore({ dataDir }), timeoutMs: 90000, maxAttempts: 1, upstreamMaxAttempts: 1 });
const coreQuestion = "企业官网如何成为AI搜索中的可信答案来源？";
const result = await service.generateArticle({
  providerId: provider.id,
  businessLine: { id: "BL-GEO", name: "GEO 内容运营", product: "企业官网内容与 GEO 运营", audience: "希望被 AI 准确理解的企业", scenario: "AI 搜索中的品牌与服务发现" },
  contentType: "深度文章",
  topic: { id: "TOP-REAL-001", title: coreQuestion, dimension: "question", geoBrief: { coreQuestion, answerMode: "直接答案与执行清单", answerPromise: "给出企业可以落实的三项做法", evidenceNeeds: ["企业主体资料", "产品服务边界", "公开来源"], faqSeeds: ["没有案例时怎么办？", "多久更新一次？"] } },
  writingAgent: { id: "WA-REAL-001", strictKnowledge: true, citationsRequired: true, minWords: 500, maxWords: 1200, tone: "专业、清楚、克制" },
  evidence: [{ id: "REAL-E1", marker: "K1", claim: "公开信息需要明确来源和更新时间。", quote: "企业官网公开信息应标明来源、发布日期或更新时间，并由负责人审核后发布。", source: "企业内容治理测试资料", locator: "测试资料/内容发布规范", status: "verified" }]
});
const output = { status: "passed", model: result.model, generationRunId: result.generationRunId, requestId: result.requestId, title: result.article.title, summary: result.article.summary, html: result.article.html, usedEvidenceIds: result.article.usedEvidenceIds, usage: result.article.usage };
console.log(JSON.stringify(output));
await rm(dataDir, { recursive: true, force: true });
