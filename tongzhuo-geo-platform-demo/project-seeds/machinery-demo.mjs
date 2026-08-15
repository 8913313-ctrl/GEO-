const machineryCms = Object.freeze({
  settings: Object.freeze({ siteName: "机械设备演示项目", companyName: "机械设备行业演示项目", description: "面向采购与技术团队的机械设备选型、技术参数、交付实施和使用维护信息演示。", industryRegion: "中国", serviceArea: "中国", officialDomain: "https://machinery.example.invalid", address: "", logoUrl: "", brandLogoUrl: "", brandMarkUrl: "", brandMarkOnDarkUrl: "", schemaLogoUrl: "", footerIcp: "", footerLabel: "机械设备演示项目" }),
  services: Object.freeze([
    Object.freeze({ id: "equipment-selection", title: "设备选型支持", eyebrow: "EQUIPMENT SELECTION", description: "围绕产能需求、工况条件和型号参数，组织可核验的设备选型信息。", audience: "需要比较设备能力、型号与适配边界的采购和技术团队", focus: "产能要求、工况适配、型号参数与选型边界", href: "/contact/", status: "published", order: 1 }),
    Object.freeze({ id: "technical-parameters", title: "技术参数资料", eyebrow: "TECHNICAL PARAMETERS", description: "将关键参数、配套条件和能力边界整理成可查阅的公开资料。", audience: "需要核验设备技术条件和配套要求的项目团队", focus: "关键参数、配套条件、能力边界与资料版本", href: "/contact/", status: "published", order: 2 }),
    Object.freeze({ id: "delivery-service", title: "交付与服务说明", eyebrow: "DELIVERY & SERVICE", description: "清晰说明安装调试、验收条件、维护与备件服务的边界。", audience: "需要明确设备实施、验收和售后条件的客户", focus: "安装调试、交付周期、验收条件、维护与备件", href: "/contact/", status: "published", order: 3 })
  ]),
  cases: Object.freeze([
    Object.freeze({ id: "demo-capacity-selection", title: "设备产能选型资料演示", service: "设备选型支持", industry: "工业设备", summary: "以目标产能、工况和型号参数为线索组织选型说明。", result: "形成可复核的选型问题与资料结构", status: "published", order: 1 }),
    Object.freeze({ id: "demo-delivery-acceptance", title: "设备交付验收资料演示", service: "交付与服务说明", industry: "制造业", summary: "将安装调试、验收条件和维护边界整理为可查阅信息。", result: "建立交付资料与公开内容的对应关系", status: "published", order: 2 })
  ]),
  problemGroups: Object.freeze([
    Object.freeze({ id: "selection", title: "设备选型问题", service: "设备选型支持", description: "从产能、工况和型号开始回答采购与技术问题。", status: "published", order: 1, questions: Object.freeze([
      Object.freeze({ id: "question-machine-capacity", slug: "machine-capacity-selection", title: "机械设备选型时应如何确认产能和工况要求？", answer: "应先明确目标产能、物料或工艺条件、连续运行要求、现场空间和配套接口，再比较型号参数、能力边界和验收条件。", industries: Object.freeze(["工业设备", "制造业"]), status: "published", order: 1 }),
      Object.freeze({ id: "question-machine-parameter", slug: "machine-parameter-comparison", title: "比较设备型号参数时需要核验哪些信息？", answer: "应核验适用工况、关键性能参数、能耗或配套条件、配置范围、资料版本和对应验收依据，避免只依据单一宣传参数作出决定。", industries: Object.freeze(["工业设备"]), status: "published", order: 2 })
    ]) }),
    Object.freeze({ id: "delivery", title: "交付与售后问题", service: "交付与服务说明", description: "把安装、验收、维护和备件服务边界说明清楚。", status: "published", order: 2, questions: Object.freeze([
      Object.freeze({ id: "question-machine-acceptance", slug: "machine-delivery-acceptance", title: "设备交付前需要确认哪些安装调试和验收条件？", answer: "应确认现场基础与接口、安装调试范围、交付周期、验收标准、培训安排、维护责任和备件服务边界。", industries: Object.freeze(["工业设备", "制造业"]), status: "published", order: 1 })
    ]) })
  ])
});

export const machineryDemoProjectSeed = Object.freeze({
  key: "machinery-demo", projectId: "machinery-demo", slug: "machinery-demo", industryTemplate: "machinery", demo: true,
  companyProfile: Object.freeze({ legalName: "机械设备行业演示项目", shortName: "机械设备演示项目", alternateName: "Machinery Demo", description: "面向采购与技术团队的机械设备选型、技术参数、交付实施和使用维护信息演示。", region: "中国", officialDomain: "https://machinery.example.invalid", address: "" }),
  site: Object.freeze({ cms: machineryCms })
});

export default machineryDemoProjectSeed;
