import { checkPrivateIndustryProject } from "./private-industry-project-check.mjs";

await checkPrivateIndustryProject({
  seedKey: "energy-demo",
  projectId: "energy-demo",
  tenantId: "tenant_energy_demo",
  industryTemplate: "energy-equipment",
  officialDomain: "energy-equipment.example.invalid",
  companyName: "UPS 能源设备行业演示项目",
  themeKey: "energy",
  requiredIndustryFields: ["industry_profile.power_ranges", "industry_profile.service_regions"],
  requiredQuestionGroups: ["selection", "reliability", "deployment", "operations"],
  requiredContentTypes: ["选型指南", "参数说明", "安装运维问答"],
  serviceIds: ["ups-selection", "deployment"],
  questionSlugs: ["ups-capacity-selection"],
  publicIdentity: ["恒稳能源演示项目", "UPS 选型支持", "负载容量", "续航", "energy-equipment.example.invalid"],
  forbiddenIdentity: /桐灼|灼见 AI|鲁ICP备2026021587号-2|tongzhuo-mark|zhuojian-ai|华材建材|澄颜美妆/,
  lead: { name: "演示机房负责人", phone: "13800003333", company: "UPS 演示客户", message: "了解负载容量与续航选型资料" },
  articlePrefix: "ENERGY-CHECK-1",
  businessLineId: "ups-selection",
  planName: "UPS 选型内容计划",
  articleTitle: "机房如何确定 UPS 容量与续航时间",
  articleCategory: "选型指南",
  articleSlug: "ups-capacity-and-runtime-guide",
  articleExcerpt: "根据负载、冗余方式和后备时间组织 UPS 选型依据。",
  articleHtml: "<h2>先核对真实负载</h2><p>UPS 容量与续航时间应结合负载、冗余方式、扩容计划和电池条件确定。</p>",
  evidenceClaim: "UPS 选型应核对真实负载、冗余方式和目标后备时间。"
});
