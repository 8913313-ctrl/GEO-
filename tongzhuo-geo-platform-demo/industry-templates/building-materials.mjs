export default {
  templateKey: "building-materials",
  version: "1.0.0",
  displayName: "建材",
  requiredFields: ["company_profile.legal_name", "company_profile.short_name", "company_profile.description", "company_profile.region", "business_lines", "industry_profile.product_categories", "industry_profile.service_regions"],
  defaultQuestionGroups: [
    { key: "selection", name: "选型与适配", intents: ["规格参数", "适用场景", "选型对比"] },
    { key: "quality", name: "质量与合规", intents: ["执行标准", "检测报告", "质量边界"] },
    { key: "supply", name: "采购与交付", intents: ["起订要求", "供货区域", "交付周期"] },
    { key: "application", name: "施工与使用", intents: ["施工条件", "使用方法", "常见问题"] }
  ],
  contentTypes: ["产品说明", "选型指南", "标准解读", "施工问答", "项目案例"],
  terminologyPack: {
    offering: "产品",
    customer: "采购方",
    scenario: "工程与使用场景",
    evidence: "参数、标准与检测依据",
    conversion: "询价与选型咨询"
  },
  promptPreset: { key: "geo-building-materials", version: "1.0.0" },
  navigationPreset: ["home", "products", "applications", "cases", "insights", "problem-map", "about", "contact"]
};
