export const GEO_CORE_DRAFT = Object.freeze({
  pack: Object.freeze({
    id: "MPACK-GEO-CORE",
    key: "geo-core",
    scope: "global",
    title: "GEO 核心方法",
    description: "所有 GEO 客户共用的方法约束。当前为待导入既有资料前的治理草稿。"
  }),
  version: Object.freeze({
    id: "MVER-GEO-CORE-DRAFT-1",
    content: [
      "# GEO 核心方法治理草稿",
      "",
      "1. 以企业已审核事实为唯一客户事实来源。",
      "2. 从客户真实问题组织内容，不以关键词堆砌替代回答。",
      "3. 关键判断、数字、案例、资质和效果必须能追溯到证据。",
      "4. 官网、问题地图、文章与发布结果应形成可复核的公开信源链。",
      "5. 资料不足时记录知识缺口，不生成补全式事实。",
      "6. 把搜索触发、召回、引用、吸收、提及、归因和业务观察分开记录。",
      "7. 研究基线和单平台采样只能作为有边界的观察，不能写成实时表现或全平台结论。",
      "8. 每次内容干预都必须有版本、目标问题、处理/对照和观察窗口。",
      "",
      "该版本只建立资产结构和最低治理边界，尚未完成 ups_geo / 既有资料来源审计，不得发布为正式方法论。"
    ].join("\n"),
    sources: Object.freeze([
      Object.freeze({ type: "repository", path: "public/app.js", locator: "GEO_AGENT_PROMPT_FOUNDATION", usage: "internal-product-source" }),
      Object.freeze({ type: "repository", path: "docs/GENERAL-ENTERPRISE-PROJECT-DEVELOPMENT-PLAN.md", locator: "P2-T05", usage: "internal-project-contract" })
    ])
  })
});

export const GEO_ARTICLE_PROMPT_DRAFT = Object.freeze({
  template: Object.freeze({
    id: "PTPL-GEO-ARTICLE",
    key: "geo-article",
    scope: "global",
    operation: "article",
    title: "GEO 证据型文章生成"
  }),
  version: Object.freeze({
    id: "PVER-GEO-ARTICLE-V1",
    systemPrompt: [
      "你是企业 GEO 证据型内容编辑。目标不是堆关键词，而是让企业实体、能力、场景和边界被 AI 准确理解、引用和复述。",
      "先回答一个明确的客户问题，再按判断顺序组织正文；每个企业事实、数字、案例、资质和效果判断都必须绑定本次已审核知识证据，找不到证据就省略并记录知识缺口。",
      "输出必须包含直接回答、适用对象与问题边界、关键判断与事实依据、实施步骤或决策清单、常见追问、来源与信息边界。使用语义化 HTML，不输出 Markdown，不重复 H1。",
      "禁止虚构价格、排名、客户名称、案例数字、效果承诺、资质和平台结果；禁止把联网搜索、附件或图片直接当成企业事实。"
    ].join("\n"),
    userTemplate: [
      "企业资料：{{company_profile}}",
      "业务线：{{business_line}}",
      "主题：{{topic}}",
      "客户问题：{{customer_question}}",
      "内容类型：{{content_type}}",
      "知识范围：{{knowledge_scope}}",
      "已检索证据：{{retrieved_evidence}}",
      "方法版本：{{methodology_version}}",
      "输出契约：{{output_schema}}"
    ].join("\n\n"),
    variablesSchema: Object.freeze({
      type: "object",
      required: Object.freeze(["company_profile", "business_line", "topic", "customer_question", "content_type", "knowledge_scope", "retrieved_evidence", "methodology_version", "output_schema"]),
      properties: Object.freeze({
        company_profile: Object.freeze({ type: "object" }), business_line: Object.freeze({ type: "object" }), topic: Object.freeze({ type: "object" }),
        customer_question: Object.freeze({ type: "object" }), content_type: Object.freeze({ type: "string" }), knowledge_scope: Object.freeze({ type: "object" }),
        retrieved_evidence: Object.freeze({ type: "array" }), methodology_version: Object.freeze({ type: "string" }), output_schema: Object.freeze({ type: "object" })
      })
    }),
    outputSchema: Object.freeze({
      type: "object",
      required: Object.freeze(["title", "excerpt", "content_html", "knowledge_gaps"]),
      properties: Object.freeze({ title: Object.freeze({ type: "string" }), excerpt: Object.freeze({ type: "string" }), content_html: Object.freeze({ type: "string" }), knowledge_gaps: Object.freeze({ type: "array" }) })
    }),
    qualityRules: Object.freeze(["facts_require_approved_evidence", "citations_must_be_traceable", "missing_evidence_must_not_be_invented", "no_unverified_performance_claims", "semantic_html_without_duplicate_h1"])
  }),
  tests: Object.freeze([
    Object.freeze({
      id: "PTEST-GEO-ARTICLE-NO-INVENTION",
      name: "缺少企业证据时不得补写事实",
      inputFixture: Object.freeze({ customer_question: "该企业有哪些客户案例？", retrieved_evidence: Object.freeze([]) }),
      expectedRules: Object.freeze(["missing_evidence_must_not_be_invented", "knowledge_gap_must_be_recorded"])
    }),
    Object.freeze({
      id: "PTEST-GEO-ARTICLE-APPROVED-EVIDENCE",
      name: "企业事实必须引用已审核知识",
      inputFixture: Object.freeze({ customer_question: "企业有哪些服务？", retrieved_evidence: Object.freeze([{ claim_id: "C-001", status: "approved" }]) }),
      expectedRules: Object.freeze(["facts_require_approved_evidence", "citations_must_be_traceable"])
    }),
    Object.freeze({
      id: "PTEST-GEO-ARTICLE-NO-LIVE-BASELINE",
      name: "研究基线不能冒充实时表现",
      inputFixture: Object.freeze({ customer_question: "这个品牌现在在 AI 中排名第几？", retrieved_evidence: Object.freeze([{ claim_id: "R-001", source_type: "research-baseline", verified_at: "2026-07-26" }]) }),
      expectedRules: Object.freeze(["baseline_must_be_labeled", "no_fixed_ranking_claims"])
    }),
    Object.freeze({
      id: "PTEST-GEO-ARTICLE-NO-CROSS-PLATFORM",
      name: "单平台采样不能推广为全平台结论",
      inputFixture: Object.freeze({ customer_question: "所有 AI 平台都会推荐该企业吗？", retrieved_evidence: Object.freeze([{ platform: "doubao", sample_count: 10 }]) }),
      expectedRules: Object.freeze(["platform_scope_must_be_explicit", "no_cross_platform_generalization"])
    }),
    Object.freeze({
      id: "PTEST-GEO-ARTICLE-RESULT-LAYERS",
      name: "引用、提及、吸收和业务结果必须分开",
      inputFixture: Object.freeze({ customer_question: "被引用是否代表带来了客户？", retrieved_evidence: Object.freeze([{ metric: "citation", value: 1 }]) }),
      expectedRules: Object.freeze(["citation_is_not_absorption", "visibility_is_not_conversion"])
    }),
    Object.freeze({
      id: "PTEST-GEO-ARTICLE-NO-UNVERIFIED-PERFORMANCE",
      name: "缺少实验对照时不得生成效果承诺",
      inputFixture: Object.freeze({ customer_question: "优化后能提升多少询盘？", retrieved_evidence: Object.freeze([{ claim_id: "C-002", status: "approved", evidence_grade: "C" }]) }),
      expectedRules: Object.freeze(["no_unverified_performance_claims", "business_outcome_requires_boundary"])
    })
  ])
});

export const GEO_CONTENT_QUALITY_DRAFT = Object.freeze({
  id: "QRULE-GEO-CONTENT-V1",
  key: "geo-content-quality",
  scope: "global",
  title: "GEO 内容质量规则",
  rules: Object.freeze([
    Object.freeze({ key: "facts_require_approved_evidence", category: "fact", severity: "error" }),
    Object.freeze({ key: "citations_must_be_traceable", category: "citation", severity: "error" }),
    Object.freeze({ key: "missing_evidence_must_not_be_invented", category: "risk", severity: "error" }),
    Object.freeze({ key: "no_unverified_performance_claims", category: "risk", severity: "error" }),
    Object.freeze({ key: "semantic_html_without_duplicate_h1", category: "structure", severity: "warning" }),
    Object.freeze({ key: "baseline_must_be_labeled", category: "measurement", severity: "error" }),
    Object.freeze({ key: "no_fixed_ranking_claims", category: "commercial-risk", severity: "error" }),
    Object.freeze({ key: "platform_scope_must_be_explicit", category: "measurement", severity: "error" }),
    Object.freeze({ key: "no_cross_platform_generalization", category: "measurement", severity: "error" }),
    Object.freeze({ key: "citation_is_not_absorption", category: "measurement", severity: "error" }),
    Object.freeze({ key: "visibility_is_not_conversion", category: "commercial-risk", severity: "error" }),
    Object.freeze({ key: "business_outcome_requires_boundary", category: "commercial-risk", severity: "error" })
  ])
});
