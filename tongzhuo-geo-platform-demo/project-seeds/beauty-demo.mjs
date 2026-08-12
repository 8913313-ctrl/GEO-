const cms = Object.freeze({
  settings: Object.freeze({ siteName: "澄颜美妆演示项目", companyName: "美妆消费品行业演示项目", description: "面向消费者的产品成分、肤质适配、使用方法和安全合规资料演示。", industryRegion: "中国", serviceArea: "中国", officialDomain: "https://beauty-consumer.example.invalid", footerLabel: "澄颜美妆演示项目" }),
  theme: Object.freeze({ key: "beauty", name: "消费品牌 · 美妆个护", primaryColor: "#9d536b", cta: "了解产品详情", version: 1 }),
  services: Object.freeze([
    Object.freeze({ id: "ingredient-guide", title: "成分与配方说明", description: "用可核验资料说明主要成分、配方作用和适用边界。", audience: "关注成分和肤质适配的消费者", focus: "成分、配方、肤质与宣称边界", href: "/contact/", status: "published", order: 1 }),
    Object.freeze({ id: "usage-guide", title: "使用方法与注意事项", description: "说明使用顺序、频率、不适用情况和安全注意事项。", audience: "希望正确使用产品的消费者", focus: "顺序、用量、频率与安全边界", href: "/contact/", status: "published", order: 2 })
  ]),
  cases: Object.freeze([]),
  problemGroups: Object.freeze([{ id: "suitability", title: "肤质与使用问题", service: "成分与配方说明", description: "围绕肤质和使用场景回答问题。", status: "published", order: 1, questions: Object.freeze([{ id: "sensitive-skin", slug: "sensitive-skin-suitability", title: "敏感肌使用护肤产品前应该确认什么？", answer: "应核对完整成分、产品备案与使用说明，并结合自身过敏史先做局部测试；不应把一般产品说明替代专业诊疗建议。", industries: Object.freeze(["护肤", "美妆"]), status: "published", order: 1 }]) }])
});

export const beautyDemoProjectSeed = Object.freeze({ key: "beauty-demo", projectId: "beauty-demo", slug: "beauty-demo", tenantId: "tenant_beauty_demo", industryTemplate: "beauty-consumer", demo: true, companyProfile: Object.freeze({ legalName: "美妆消费品行业演示项目", shortName: "澄颜美妆演示项目", description: "成分、肤质适配、使用方法和安全合规资料演示。", region: "中国", officialDomain: "https://beauty-consumer.example.invalid" }), site: Object.freeze({ cms }) });
export default beautyDemoProjectSeed;
