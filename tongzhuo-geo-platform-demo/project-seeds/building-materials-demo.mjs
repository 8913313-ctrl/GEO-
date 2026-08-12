const buildingMaterialsCms = Object.freeze({
  settings: Object.freeze({
    siteName: "华材建材演示项目",
    companyName: "华材建材行业演示项目",
    description: "面向工程采购与施工团队的建材产品、规格参数和应用场景信息演示。",
    industryRegion: "中国",
    serviceArea: "中国",
    officialDomain: "https://building-materials.example.invalid",
    address: "",
    logoUrl: "",
    brandLogoUrl: "",
    brandMarkUrl: "",
    brandMarkOnDarkUrl: "",
    schemaLogoUrl: "",
    footerIcp: "",
    footerLabel: "华材建材演示项目"
  }),
  services: Object.freeze([
    Object.freeze({ id: "material-selection", title: "建材选型支持", eyebrow: "MATERIAL SELECTION", description: "围绕规格参数、适用场景和工程条件，整理可核验的选型信息。", audience: "需要比较建材产品与工程适配性的采购和技术团队", focus: "产品类别、规格参数、适用场景与选型边界", href: "/contact/", status: "published", order: 1 }),
    Object.freeze({ id: "quality-compliance", title: "质量与标准资料", eyebrow: "QUALITY & STANDARDS", description: "把执行标准、检测依据和质量边界组织成可查阅的企业资料。", audience: "需要核验材料质量与合规要求的工程项目", focus: "执行标准、检测报告、验收条件与资料版本", href: "/contact/", status: "published", order: 2 }),
    Object.freeze({ id: "delivery-support", title: "采购与交付说明", eyebrow: "SUPPLY & DELIVERY", description: "清楚说明供货区域、起订条件和交付流程，减少采购沟通中的信息缺口。", audience: "需要明确采购条件和交付边界的建材客户", focus: "供货区域、起订要求、交付流程与售后边界", href: "/contact/", status: "published", order: 3 })
  ]),
  cases: Object.freeze([
    Object.freeze({ id: "demo-insulation-selection", title: "保温材料选型资料演示", service: "建材选型支持", industry: "建筑保温", summary: "以工程部位、环境条件和规格参数为线索组织选型说明。", result: "形成可复核的产品选型问题与资料结构", status: "published", order: 1 }),
    Object.freeze({ id: "demo-standard-library", title: "建材标准资料结构演示", service: "质量与标准资料", industry: "工程建材", summary: "将执行标准、检测依据和验收边界拆成采购人员可直接核对的内容。", result: "建立标准、证据与公开内容的对应关系", status: "published", order: 2 })
  ]),
  problemGroups: Object.freeze([
    Object.freeze({ id: "selection", title: "产品选型问题", service: "建材选型支持", description: "从规格、场景与工程条件开始回答采购问题。", status: "published", order: 1, questions: Object.freeze([
      Object.freeze({ id: "question-material-parameter", slug: "material-parameter-comparison", title: "建材产品选型时应该比较哪些参数？", answer: "先确认使用部位、环境条件和项目标准，再比较规格尺寸、性能指标、检测依据、供货条件与施工要求。", industries: Object.freeze(["建筑保温", "工程建材"]), status: "published", order: 1 }),
      Object.freeze({ id: "question-material-standard", slug: "material-standard-verification", title: "如何核验建材产品的执行标准和检测资料？", answer: "应核对产品对应的执行标准、检测报告适用范围、报告日期和样品信息，并确认资料与本项目验收要求一致。", industries: Object.freeze(["工程建材"]), status: "published", order: 2 })
    ]) }),
    Object.freeze({ id: "delivery", title: "采购与交付问题", service: "采购与交付说明", description: "把供货、起订和交付边界说清楚。", status: "published", order: 2, questions: Object.freeze([
      Object.freeze({ id: "question-material-delivery", slug: "material-delivery-boundary", title: "采购建材前需要确认哪些交付条件？", answer: "应提前确认供货区域、起订要求、包装与运输方式、交付时间、验收资料和异常处理边界。", industries: Object.freeze(["工程建材"]), status: "published", order: 1 })
    ]) })
  ])
});

export const buildingMaterialsDemoProjectSeed = Object.freeze({
  key: "building-materials-demo",
  projectId: "building-materials-demo",
  slug: "building-materials-demo",
  tenantId: "tenant_building_materials_demo",
  industryTemplate: "building-materials",
  demo: true,
  companyProfile: Object.freeze({
    legalName: "华材建材行业演示项目",
    shortName: "华材建材演示项目",
    alternateName: "Building Materials Demo",
    description: "面向工程采购与施工团队的建材产品、规格参数和应用场景信息演示。",
    region: "中国",
    officialDomain: "https://building-materials.example.invalid",
    address: ""
  }),
  site: Object.freeze({ cms: buildingMaterialsCms })
});

export default buildingMaterialsDemoProjectSeed;
