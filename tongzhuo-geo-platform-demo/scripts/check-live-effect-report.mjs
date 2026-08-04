import assert from "node:assert/strict";
import { LIVE_EFFECT_REPORT_SYSTEM_PROMPT, LiveEffectReportEngine } from "../live-effect-report-engine.mjs";

const evidence = {
  id: "LIVE-1",
  evidenceType: "live",
  verificationStatus: "verified",
  observedAt: "2026-08-03T10:00:00.000Z",
  provenance: JSON.stringify({ platform: "DB", terminal: "web", mode: "fast", questionId: "Q1" }),
  payload: JSON.stringify({
    request: { prompt: "Acme brand recommendation?", questionId: "Q1" },
    delivery: {
      normalized: {
        answerText: "Acme is a provider.",
        brandMentioned: true,
        brandMentionCount: 1,
        quotes: [{ title: "Example", domain: "example.test", url: "https://example.test" }]
      }
    }
  }),
  excerpt: "Acme is a provider."
};

const sections = [
  "brand_visibility",
  "answer_insights",
  "platform_comparison",
  "citation_analysis",
  "content_gaps",
  "action_roadmap"
].map((key) => ({
  key,
  title: key,
  summary: "Evidence-grounded section summary.",
  findings: [{ title: "Finding", analysis: "A concrete finding derived from verified returned data.", evidenceIds: ["LIVE-1"] }]
}));

const aiGenerationService = {
  async generate(operation, input, prompt, validator) {
    assert.equal(operation, "live_effect_report");
    assert.equal(input.runId, "RUN-1");
    assert.match(prompt, /DATA_JSON/);
    const report = validator({
      executiveSummary: "A".repeat(100),
      sections,
      recommendations: [{
        id: "REC-1",
        priority: "high",
        title: "Improve source coverage",
        action: "Publish a verified source page",
        rationale: "The returned citation data exposes a gap",
        expectedOutcome: "Re-test the same question set",
        evidenceIds: ["LIVE-1"]
      }],
      limitations: ["Only this verified sample is covered"]
    });
    return {
      run: { id: "AIRUN-1", providerId: "PROVIDER-1", model: "model-1", completedAt: "2026-08-03T10:01:00.000Z" },
      ...report
    };
  }
};

const diagnosticStore = {
  run() {
    return {
      id: "RUN-1",
      projectId: "PROJECT-1",
      status: "completed",
      inputSnapshot: JSON.stringify({ request: { brand: { name: "Acme" }, items: [{ prompt: "Acme brand recommendation?" }] } }),
      evidence: [evidence]
    };
  },
  project() {
    return { id: "PROJECT-1", targetBrand: "Acme", name: "Acme" };
  }
};

const engine = new LiveEffectReportEngine({ diagnosticStore, aiGenerationService });
const result = await engine.generate({ projectId: "PROJECT-1", runId: "RUN-1", providerId: "PROVIDER-1" });

assert.equal(result.analysis.sections.length, 6);
assert.equal(result.analysis.recommendations.length, 1);
assert.equal(result.analysis.model.generationRunId, "AIRUN-1");
assert.equal(result.input.samples[0].evidenceId, "LIVE-1");
assert.equal(result.input.derived.verifiedCount, 1);
assert.match(LIVE_EFFECT_REPORT_SYSTEM_PROMPT, /只能使用/);
assert.match(LIVE_EFFECT_REPORT_SYSTEM_PROMPT, /不得推测或补造/);

console.log("Live effect report check passed");

