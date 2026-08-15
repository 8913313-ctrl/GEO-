const cms = Object.freeze({
  settings: Object.freeze({ siteName: "恒稳能源演示项目", companyName: "UPS 能源设备行业演示项目", description: "面向数据中心与关键负载团队的 UPS 选型、续航、安装和运维资料演示。", industryRegion: "中国", serviceArea: "中国", officialDomain: "https://energy-equipment.example.invalid", footerLabel: "恒稳能源演示项目" }),
  theme: Object.freeze({ key: "energy", name: "技术设备 · UPS 能源", primaryColor: "#0d6b67", cta: "获取选型建议", version: 1 }),
  services: Object.freeze([
    Object.freeze({ id: "ups-selection", title: "UPS 选型支持", description: "按负载容量、冗余方式、续航目标与运行环境组织选型依据。", audience: "数据中心技术与采购团队", focus: "功率、冗余、续航与环境边界", href: "/contact/", status: "published", order: 1 }),
    Object.freeze({ id: "deployment", title: "安装与调试说明", description: "明确现场条件、配电接口、安装范围与验收资料。", audience: "项目实施与运维团队", focus: "安装、调试、验收与风险边界", href: "/contact/", status: "published", order: 2 })
  ]),
  cases: Object.freeze([]),
  problemGroups: Object.freeze([{ id: "selection", title: "UPS 选型问题", service: "UPS 选型支持", description: "从真实负载和续航目标开始选型。", status: "published", order: 1, questions: Object.freeze([{ id: "ups-capacity", slug: "ups-capacity-selection", title: "机房应该如何确定 UPS 容量与续航时间？", answer: "应先核对关键负载、启动冲击、未来扩容、冗余方式和目标后备时间，再结合电池方案、环境条件与维护能力确认。", industries: Object.freeze(["UPS 电源", "数据中心"]), status: "published", order: 1 }]) }])
});

export const energyDemoProjectSeed = Object.freeze({ key: "energy-demo", projectId: "energy-demo", slug: "energy-demo", industryTemplate: "energy-equipment", demo: true, companyProfile: Object.freeze({ legalName: "UPS 能源设备行业演示项目", shortName: "恒稳能源演示项目", description: "UPS 选型、续航、安装和运维资料演示。", region: "中国", officialDomain: "https://energy-equipment.example.invalid" }), site: Object.freeze({ cms }) });
export default energyDemoProjectSeed;
