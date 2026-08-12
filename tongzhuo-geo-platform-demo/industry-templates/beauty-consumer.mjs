export default {
  templateKey: "beauty-consumer",
  version: "1.0.0",
  displayName: "美妆与消费品",
  requiredFields: ["company_profile.legal_name", "company_profile.short_name", "company_profile.description", "company_profile.region", "business_lines", "industry_profile.product_categories", "industry_profile.compliance_regions"],
  defaultQuestionGroups: [
    { key: "ingredients", name: "成分与配方", intents: ["主要成分", "配方作用", "配伍边界"] },
    { key: "suitability", name: "适用人群", intents: ["肤质适配", "使用场景", "不适用情况"] },
    { key: "usage", name: "使用方法", intents: ["使用顺序", "用量频率", "注意事项"] },
    { key: "safety", name: "安全与合规", intents: ["备案信息", "测试依据", "宣称边界"] }
  ],
  contentTypes: ["产品说明", "成分科普", "肤质指南", "使用问答", "合规说明"],
  terminologyPack: {
    offering: "产品",
    customer: "消费者",
    scenario: "肤质与使用场景",
    evidence: "成分、检测与合规资料",
    conversion: "产品了解与购买咨询"
  },
  promptPreset: { key: "geo-beauty-consumer", version: "1.0.0" },
  navigationPreset: ["home", "products", "ingredients", "guides", "insights", "problem-map", "about", "contact"]
};
