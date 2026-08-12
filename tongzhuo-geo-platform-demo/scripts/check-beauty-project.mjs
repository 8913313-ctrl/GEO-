import { checkPrivateIndustryProject } from "./private-industry-project-check.mjs";

await checkPrivateIndustryProject({
  seedKey: "beauty-demo",
  projectId: "beauty-demo",
  tenantId: "tenant_beauty_demo",
  industryTemplate: "beauty-consumer",
  officialDomain: "beauty-consumer.example.invalid",
  companyName: "美妆消费品行业演示项目",
  themeKey: "beauty",
  requiredIndustryFields: ["industry_profile.product_categories", "industry_profile.compliance_regions"],
  requiredQuestionGroups: ["ingredients", "suitability", "usage", "safety"],
  requiredContentTypes: ["产品说明", "成分科普", "合规说明"],
  serviceIds: ["ingredient-guide", "usage-guide"],
  questionSlugs: ["sensitive-skin-suitability"],
  publicIdentity: ["澄颜美妆演示项目", "成分与配方说明", "敏感肌", "安全", "beauty-consumer.example.invalid"],
  forbiddenIdentity: /桐灼|灼见 AI|鲁ICP备2026021587号-2|tongzhuo-mark|zhuojian-ai|华材建材|恒稳能源/,
  lead: { name: "演示产品负责人", phone: "13800004444", company: "美妆演示客户", message: "了解敏感肌适用与成分资料" },
  articlePrefix: "BEAUTY-CHECK-1",
  businessLineId: "ingredient-guide",
  planName: "美妆成分内容计划",
  articleTitle: "敏感肌使用护肤产品前应该确认什么",
  articleCategory: "肤质指南",
  articleSlug: "sensitive-skin-product-checklist",
  articleExcerpt: "从完整成分、备案资料、过敏史和局部测试确认使用边界。",
  articleHtml: "<h2>先确认产品与个人边界</h2><p>敏感肌使用前应核对完整成分、备案资料和使用说明，并结合过敏史进行局部测试。</p>",
  evidenceClaim: "敏感肌使用前应核对完整成分、备案资料并结合过敏史做局部测试。"
});
