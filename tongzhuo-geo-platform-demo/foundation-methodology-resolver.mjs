import { FoundationAssetError } from "./foundation-asset-store.mjs";

const THEME_SIGNALS = Object.freeze({
  "digital-identity": ["企业", "公司", "品牌", "主体", "身份", "产品", "服务"],
  "first-party-evidence": ["事实", "证据", "参数", "资质", "案例", "报价", "客户"],
  "question-map": ["问题", "选型", "采购", "比较", "场景", "需求", "如何", "为什么"],
  "content-and-citation": ["文章", "内容", "引用", "信源", "官网", "页面", "faq", "schema"],
  "publishing-and-review": ["发布", "分发", "复盘", "监测", "采样", "效果", "排名"],
  "risk-boundaries": ["承诺", "效果", "排名", "推荐", "风险", "合规", "竞品", "销量"]
});

function clean(value, maximum = 2_000) { return String(value ?? "").replace(/\u0000/g, "").trim().slice(0, maximum); }
function plain(value) { return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }
function compact(value, maximum = 8_000) { return JSON.stringify(value).slice(0, maximum); }
function render(template, variables) {
  return clean(template, 100_000).replace(/{{([a-z_]+)}}/g, (_match, key) => Object.hasOwn(variables, key) ? compact(variables[key]) : `{{${key}}}`);
}

function renderPrompt(systemPrompt, userTemplate, variables) {
  return [clean(systemPrompt, 100_000), render(userTemplate, variables)].filter(Boolean).join("\n\n");
}

function desiredThemes(input = {}) {
  const haystack = [input.customerQuestion, input.contentType, input.topicTitle, input.intent, input.stage].map((value) => clean(value).toLowerCase()).join(" ");
  const selected = new Set(["first-party-evidence", "content-and-citation", "risk-boundaries"]);
  for (const [theme, signals] of Object.entries(THEME_SIGNALS)) if (signals.some((signal) => haystack.includes(signal))) selected.add(theme);
  return selected;
}

export class FoundationMethodologyResolver {
  constructor(database) {
    if (!database?.connection) throw new TypeError("FoundationMethodologyResolver requires a ProductionDatabase instance.");
    this.connection = database.connection;
  }

  resolveArticleContext({ workspaceId, planId, customerQuestion = "", contentType = "", topicTitle = "", intent = "", stage = "", maximumFragments = 8 } = {}) {
    const workspace = clean(workspaceId, 160);
    const plan = clean(planId, 180);
    if (!workspace || !plan) throw new FoundationAssetError("workspaceId and planId are required to resolve methodology.", 422, "METHODOLOGY_CONTEXT_INVALID_INPUT");
    const row = this.connection.prepare(`
      SELECT cp.methodology_version_id, v.version, v.checksum, v.status,
             p.id AS pack_id, p.key AS pack_key, p.scope, p.industry_template, p.workspace_id
      FROM content_plans cp
      LEFT JOIN methodology_versions v ON v.id = cp.methodology_version_id
      LEFT JOIN methodology_packs p ON p.id = v.pack_id
      WHERE cp.workspace_id = ? AND cp.id = ?
    `).get(workspace, plan);
    if (!row) throw new FoundationAssetError("Content plan not found in the current private deployment.", 404, "CONTENT_PLAN_NOT_FOUND");
    if (!row.methodology_version_id) throw new FoundationAssetError("Content plan has no methodology version.", 409, "METHODOLOGY_VERSION_NOT_SELECTED");
    if (row.status !== "published") throw new FoundationAssetError("Content plan methodology must be published before generation.", 409, "METHODOLOGY_VERSION_NOT_PUBLISHED");
    if (row.scope === "project" && row.workspace_id !== workspace) throw new FoundationAssetError("Project methodology belongs to another private deployment.", 403, "METHODOLOGY_WORKSPACE_MISMATCH");

    const reviews = this.connection.prepare(`
      SELECT rule_id, theme, rule_text, source_path, source_locator, source_sha256, classification
      FROM methodology_source_reviews
      WHERE methodology_version_id = ? AND review_status = 'approved' AND reuse_decision = 'approved-global'
      ORDER BY theme, rule_id
    `).all(row.methodology_version_id);
    if (!reviews.length) throw new FoundationAssetError("Published methodology has no approved rule fragments.", 409, "METHODOLOGY_APPROVED_FRAGMENTS_REQUIRED");
    const themes = desiredThemes({ customerQuestion, contentType, topicTitle, intent, stage });
    const limit = Math.max(1, Math.min(12, Number(maximumFragments) || 8));
    let selected = reviews.filter((review) => themes.has(review.theme)).slice(0, limit);
    if (!selected.length) selected = reviews.slice(0, limit);
    return {
      packId: row.pack_id,
      packKey: row.pack_key,
      scope: row.scope,
      industryTemplate: row.industry_template || "",
      versionId: row.methodology_version_id,
      version: Number(row.version),
      checksum: row.checksum,
      selectedAt: new Date().toISOString(),
      fragments: selected.map((review) => ({
        id: review.rule_id,
        theme: review.theme,
        rule: review.rule_text,
        classification: review.classification,
        source: { path: review.source_path, locator: review.source_locator, sha256: review.source_sha256 }
      }))
    };
  }

  resolveArticlePromptContext({ workspaceId, planId, companyProfile = {}, businessLine = {}, topic = {}, customerQuestion = "", contentType = "", knowledgeScope = {}, retrievedEvidence = [], methodology = null } = {}) {
    const workspace = clean(workspaceId, 160);
    const plan = clean(planId, 180);
    if (!workspace || !plan) throw new FoundationAssetError("workspaceId and planId are required to resolve a prompt version.", 422, "PROMPT_CONTEXT_INVALID_INPUT");
    const row = this.connection.prepare(`
      SELECT cp.prompt_version_id, cp.quality_rule_pack_id,
             pv.version AS prompt_version, pv.system_prompt, pv.user_template, pv.variables_schema_json, pv.output_schema_json, pv.quality_rules_json, pv.checksum AS prompt_checksum, pv.status AS prompt_status,
             pt.key AS prompt_key, pt.scope AS prompt_scope, pt.industry_template AS prompt_industry, pt.workspace_id AS prompt_workspace,
             qp.key AS quality_key, qp.version AS quality_version, qp.checksum AS quality_checksum, qp.rules_json, qp.status AS quality_status, qp.scope AS quality_scope, qp.industry_template AS quality_industry, qp.workspace_id AS quality_workspace
      FROM content_plans cp
      LEFT JOIN prompt_versions pv ON pv.id = cp.prompt_version_id
      LEFT JOIN prompt_templates pt ON pt.id = pv.template_id
      LEFT JOIN quality_rule_packs qp ON qp.id = cp.quality_rule_pack_id
      WHERE cp.workspace_id = ? AND cp.id = ?
    `).get(workspace, plan);
    if (!row) throw new FoundationAssetError("Content plan not found in the current private deployment.", 404, "CONTENT_PLAN_NOT_FOUND");
    if (!row.prompt_version_id || !row.quality_rule_pack_id) throw new FoundationAssetError("Content plan must select a prompt version and quality rule pack before generation.", 409, "PROMPT_FOUNDATION_NOT_SELECTED");
    if (row.prompt_status !== "published" || row.quality_status !== "published") throw new FoundationAssetError("Content plan prompt and quality assets must be published before generation.", 409, "PROMPT_FOUNDATION_NOT_PUBLISHED");
    for (const [kind, scope, assetWorkspace] of [["prompt", row.prompt_scope, row.prompt_workspace], ["quality", row.quality_scope, row.quality_workspace]]) {
      if (scope === "project" && assetWorkspace !== workspace) throw new FoundationAssetError(`${kind} foundation asset belongs to another private deployment.`, 403, "PROMPT_FOUNDATION_WORKSPACE_MISMATCH");
    }
    const variablesSchema = JSON.parse(row.variables_schema_json || "{}");
    const outputSchema = JSON.parse(row.output_schema_json || "{}");
    const qualityRules = JSON.parse(row.quality_rules_json || "[]");
    const qualityPackRules = JSON.parse(row.rules_json || "[]");
    const compactCompany = plain(companyProfile);
    const compactLine = plain(businessLine);
    const compactTopic = plain(topic);
    const approvedEvidence = Array.isArray(retrievedEvidence) ? retrievedEvidence.slice(0, 40).map((item) => ({
      id: clean(item?.id || item?.citationId, 128), claim: clean(item?.claim || item?.title, 500), quote: clean(item?.quote || item?.excerpt || item?.content, 4_000),
      libraryId: clean(item?.libraryId || item?.knowledgeLibraryId, 180), documentId: clean(item?.documentId || item?.knowledgeDocumentId || item?.itemId, 180), versionId: clean(item?.versionId || item?.knowledgeVersionId, 180), chunkId: clean(item?.chunkId || item?.knowledgeChunkId, 180)
    })) : [];
    const variables = {
      company_profile: { legal_name: clean(compactCompany.legalName || compactCompany.legal_name, 300), short_name: clean(compactCompany.shortName || compactCompany.short_name, 160), description: clean(compactCompany.description, 1_000), region: clean(compactCompany.region, 300) },
      business_line: { id: clean(compactLine.id, 180), name: clean(compactLine.name, 300), description: clean(compactLine.description, 1_000) },
      topic: { id: clean(compactTopic.id, 180), title: clean(compactTopic.title, 300), intent: clean(compactTopic.intent, 160), stage: clean(compactTopic.stage, 160) },
      customer_question: clean(customerQuestion, 300),
      content_type: clean(contentType, 120),
      knowledge_scope: { library_ids: Array.isArray(plain(knowledgeScope).libraryIds) ? plain(knowledgeScope).libraryIds.map((id) => clean(id, 180)).slice(0, 20) : [], retrieval_mode: "public-approved-only" },
      retrieved_evidence: approvedEvidence,
      methodology_version: methodology ? { id: methodology.versionId, version: methodology.version, checksum: methodology.checksum, fragment_ids: methodology.fragments.map((fragment) => fragment.id) } : null,
      output_schema: outputSchema
    };
    const required = Array.isArray(variablesSchema.required) ? variablesSchema.required : [];
    const missing = required.filter((key) => !Object.hasOwn(variables, key));
    if (missing.length) throw new FoundationAssetError("Prompt template requires unsupported variables.", 409, "PROMPT_VARIABLE_UNSUPPORTED", { missing });
    return {
      templateId: row.prompt_version_id,
      templateKey: row.prompt_key,
      version: Number(row.prompt_version),
      checksum: row.prompt_checksum,
      systemPrompt: row.system_prompt,
      userTemplate: row.user_template,
      renderedPrompt: renderPrompt(row.system_prompt, row.user_template, variables),
      variables,
      quality: { packId: row.quality_rule_pack_id, key: row.quality_key, version: Number(row.quality_version), checksum: row.quality_checksum, rules: [...qualityRules, ...qualityPackRules.map((item) => item.key || item)].filter(Boolean) },
      frozenAt: new Date().toISOString()
    };
  }
}
