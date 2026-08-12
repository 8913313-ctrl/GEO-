export default {
  templateKey: "professional-services",
  version: "1.0.0",
  displayName: "专业服务",
  requiredFields: ["company_profile.legal_name", "company_profile.short_name", "company_profile.description", "company_profile.region", "business_lines"],
  defaultQuestionGroups: [
    { key: "service-fit", name: "服务适配", intents: ["适用对象", "适用场景", "服务边界"] },
    { key: "delivery", name: "交付过程", intents: ["所需资料", "实施步骤", "交付周期"] },
    { key: "trust", name: "选择与验证", intents: ["专业能力", "案例证据", "服务商选择"] }
  ],
  contentTypes: ["服务说明", "客户问题回答", "方法解读", "实施案例"],
  terminologyPack: {
    offering: "服务",
    customer: "客户",
    scenario: "业务场景",
    evidence: "专业依据",
    conversion: "业务咨询"
  },
  promptPreset: { key: "geo-professional-services", version: "1.0.0" },
  navigationPreset: ["home", "services", "cases", "insights", "problem-map", "about", "contact"]
};
