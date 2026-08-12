export default {
  templateKey: "machinery",
  version: "1.0.0",
  displayName: "机械设备",
  requiredFields: ["company_profile.legal_name", "company_profile.short_name", "company_profile.description", "company_profile.region", "business_lines", "industry_profile.product_series", "industry_profile.technical_parameters"],
  defaultQuestionGroups: [
    { key: "selection", name: "设备选型", intents: ["产能要求", "工况适配", "型号对比"] },
    { key: "technical", name: "技术参数", intents: ["关键参数", "配套条件", "能力边界"] },
    { key: "delivery", name: "交付实施", intents: ["安装调试", "交付周期", "验收条件"] },
    { key: "service", name: "使用与售后", intents: ["操作维护", "故障处理", "备件服务"] }
  ],
  contentTypes: ["设备说明", "选型指南", "技术问答", "应用案例", "维护指南"],
  terminologyPack: {
    offering: "设备",
    customer: "采购与技术人员",
    scenario: "工况与产线场景",
    evidence: "参数、工况与验收依据",
    conversion: "选型与技术咨询"
  },
  promptPreset: { key: "geo-machinery", version: "1.0.0" },
  navigationPreset: ["home", "products", "applications", "cases", "insights", "problem-map", "about", "contact"]
};
