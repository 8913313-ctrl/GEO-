export default {
  templateKey: "energy-equipment",
  version: "1.0.0",
  displayName: "UPS 与能源设备",
  requiredFields: ["company_profile.legal_name", "company_profile.short_name", "company_profile.description", "company_profile.region", "business_lines", "industry_profile.power_ranges", "industry_profile.service_regions"],
  defaultQuestionGroups: [
    { key: "selection", name: "功率与选型", intents: ["负载容量", "冗余方式", "续航需求"] },
    { key: "reliability", name: "可靠性与边界", intents: ["供电质量", "切换时间", "运行环境"] },
    { key: "deployment", name: "安装与交付", intents: ["现场条件", "安装调试", "验收资料"] },
    { key: "operations", name: "运维与生命周期", intents: ["电池维护", "告警处理", "扩容更换"] }
  ],
  contentTypes: ["选型指南", "参数说明", "场景方案", "安装运维问答", "项目案例"],
  terminologyPack: {
    offering: "设备与方案",
    customer: "技术与采购团队",
    scenario: "供电与数据中心场景",
    evidence: "参数、测试与运行边界",
    conversion: "选型与技术咨询"
  },
  promptPreset: { key: "geo-energy-equipment", version: "1.0.0" },
  navigationPreset: ["home", "products", "solutions", "cases", "insights", "problem-map", "about", "contact"]
};
