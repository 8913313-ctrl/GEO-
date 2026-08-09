const EVIDENCE_KEYS = new Set(["schema", "content", "meta", "citation"]);

function compactText(value, max = 800) {
  return String(value ?? "").replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim().slice(0, max);
}

function evidenceKeys(value) {
  return [...new Set((Array.isArray(value) ? value : [])
    .map((item) => String(item || "").trim().toLowerCase())
    .filter((item) => EVIDENCE_KEYS.has(item)))];
}

function validateRecommendation(item, index) {
  if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(`recommendations[${index}] must be an object.`);
  const title = compactText(item.title, 180);
  const action = compactText(item.action, 700);
  if (!title || !action) throw new Error(`recommendations[${index}] requires title and action.`);
  const priority = ["P0", "P1", "P2"].includes(String(item.priority || "").toUpperCase())
    ? String(item.priority).toUpperCase()
    : index === 0 ? "P0" : "P1";
  const keys = evidenceKeys(item.evidenceKeys || item.evidence_keys);
  if (!keys.length) throw new Error(`recommendations[${index}] requires at least one evidenceKeys value.`);
  return {
    priority,
    title,
    action,
    rationale: compactText(item.rationale, 700),
    evidenceKeys: keys
  };
}

function validateModelResponse(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("The model must return one JSON object.");
  const rows = Array.isArray(raw.recommendations) ? raw.recommendations.slice(0, 6) : [];
  const recommendations = rows.map(validateRecommendation);
  if (!recommendations.length) throw new Error("The model did not return any usable recommendations.");
  return {
    summary: compactText(raw.summary || raw.overview, 1_200),
    priorityAction: compactText(raw.priorityAction || raw.priority_action, 700),
    recommendations
  };
}

function modelEvidence(analysis = {}) {
  const dimension = (name) => {
    const source = analysis[name] || {};
    return {
      score: Number(source.score || 0),
      evidence: source.evidence || {}
    };
  };
  return {
    sourceUrl: compactText(analysis.sourceUrl, 2_000),
    overallScore: Number(analysis.overallScore || 0),
    weights: analysis.weights || {},
    dimensions: {
      schema: dimension("schema"),
      content: dimension("content"),
      meta: dimension("meta"),
      citation: dimension("citation")
    }
  };
}

function promptFor({ sourceUrl, analysis, ruleRecommendations }) {
  const facts = modelEvidence({ ...analysis, sourceUrl });
  const ruleFindings = ruleRecommendations?.ruleFindings || {};
  return `You are writing grounded, implementation-ready suggestions for a website page analysis.\n\nOnly use the supplied deterministic evidence. Do not claim that the page is ranked, cited, recommended, indexed, or visited by an AI model. Do not invent page content, competitor facts, performance outcomes, or source links.\n\nReturn one JSON object exactly in this shape:\n{\n  "summary": "short grounded summary",\n  "priorityAction": "the most important next action",\n  "recommendations": [\n    {\n      "priority": "P0|P1|P2",\n      "title": "short action title",\n      "action": "specific implementation action",\n      "rationale": "why this follows from the evidence",\n      "evidenceKeys": ["schema|content|meta|citation"]\n    }\n  ]\n}\n\nReturn 1 to 5 recommendations. Each recommendation must reference at least one of schema, content, meta, citation in evidenceKeys.\n\nDeterministic evidence:\n${JSON.stringify(facts, null, 2)}\n\nRule findings (these are the non-model fallback recommendations):\n${JSON.stringify(ruleFindings, null, 2)}`;
}

export function createMonitoringSuggestionGenerator({ aiGenerationService } = {}) {
  if (!aiGenerationService || typeof aiGenerationService.generate !== "function") {
    throw new TypeError("createMonitoringSuggestionGenerator requires aiGenerationService.generate.");
  }
  return async function generateMonitoringSuggestions(input = {}) {
    const providerId = compactText(input.providerId, 180);
    if (!providerId) throw new Error("A text-model provider is required for model suggestions.");
    const result = await aiGenerationService.generate(
      "monitoring_page_recommendations",
      { providerId, model: compactText(input.model, 180), workspaceId: input.workspaceId || "default", reportId: input.reportId || "" },
      promptFor(input),
      validateModelResponse,
      {
        systemPrompt: "You create concise, evidence-bounded website GEO optimization suggestions. You must return only valid JSON and never make ranking, citation, or traffic claims beyond the supplied deterministic evidence.",
        temperature: 0.15,
        maxTokens: 1_800,
        generationTotalTimeoutMs: 65_000,
        upstreamTotalTimeoutMs: 55_000,
        requestTimeoutMs: 50_000,
        upstreamMaxAttempts: 1,
        disableThinking: true,
        inputSummary: { reportId: input.reportId || "", sourceUrl: compactText(input.sourceUrl, 2_000), dimensions: ["schema", "content", "meta", "citation"] },
        outputSummary: (output) => ({ recommendationCount: output.recommendations.length })
      }
    );
    return {
      summary: result.summary,
      priorityAction: result.priorityAction,
      recommendations: result.recommendations,
      generation: {
        providerId: result.run?.providerId || providerId,
        providerName: result.run?.providerName || "",
        model: result.run?.model || compactText(input.model, 180),
        generationRunId: result.run?.id || "",
        generatedAt: result.run?.completedAt || new Date().toISOString()
      }
    };
  };
}

export default createMonitoringSuggestionGenerator;
