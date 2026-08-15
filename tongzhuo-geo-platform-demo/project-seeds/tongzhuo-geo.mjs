export const tongzhuoGeoProjectSeed = Object.freeze({
  key: "tongzhuo-geo",
  projectId: "tongzhuo-geo",
  slug: "tongzhuo-geo",
  industryTemplate: "professional-services",
  companyProfile: Object.freeze({
    legalName: "桐灼（淄博）网络科技有限公司",
    shortName: "桐灼科技",
    alternateName: "灼见 AI",
    description: "面向企业提供 GEO 服务、企业 AI 应用与内容运营服务。",
    region: "山东淄博",
    officialDomain: "https://tongzhuo.ink",
    address: "山东省淄博市张店区北西六路20甲4号5层A4号"
  }),
  site: Object.freeze({
    cms: Object.freeze({
      settings: Object.freeze({
        siteName: "桐灼科技",
        companyName: "桐灼（淄博）网络科技有限公司",
        description: "面向企业提供 GEO 服务、企业 AI 应用与内容运营服务。",
        industryRegion: "山东淄博",
        serviceArea: "中国",
        officialDomain: "https://tongzhuo.ink",
        address: "山东省淄博市张店区北西六路20甲4号5层A4号",
        logoUrl: "/assets/zhuojian-ai-official-logo.png",
        brandLogoUrl: "/assets/zhuojian-ai-lockup-gold.png",
        brandMarkUrl: "/assets/tongzhuo-mark-wine.png",
        brandMarkOnDarkUrl: "/assets/tongzhuo-mark-gold.png",
        schemaLogoUrl: "/assets/zhuojian-ai-official-logo.png",
        footerIcp: "鲁ICP备2026021587号-2",
        footerLabel: "桐灼"
      }),
      services: Object.freeze([
        Object.freeze({ id: "geo", title: "GEO 服务", eyebrow: "AI SEARCH VISIBILITY", description: "围绕企业知识、官网信源、客户问题和持续内容运营，让企业信息更容易被客户与 AI 正确理解。", audience: "工业品、制造业及需要建设公开信源的中小企业", focus: "企业实体、官网页面、客户问题和公开内容结构", href: "/contact/", status: "published", order: 1 }),
        Object.freeze({ id: "enterprise-ai", title: "企业 AI 落地", eyebrow: "ENTERPRISE AI", description: "把企业资料、业务规则和工作流程整理为可调用的知识与智能应用，帮助团队真正使用 AI。", audience: "希望建设知识库、智能体和业务工作流的企业", focus: "知识库、检索增强、智能体和业务流程协同", href: "/contact/", status: "published", order: 2 }),
        Object.freeze({ id: "short-video", title: "短视频运营", eyebrow: "CONTENT GROWTH", description: "围绕真实业务场景建立选题、脚本、账号和发布节奏，持续沉淀可复用的内容资产。", audience: "需要长期获客和内容运营能力的企业", focus: "选题、脚本、账号内容与持续发布节奏", href: "/contact/", status: "published", order: 3 })
      ]),
      cases: Object.freeze([
        Object.freeze({ id: "case-industry-source", title: "工业设备企业公开信源建设", service: "GEO 服务", industry: "工业品", summary: "统一产品参数、应用场景和售后问答，让官网与公开内容使用同一套企业事实。", result: "企业知识、官网页面与内容生产形成统一来源", status: "published", order: 1 }),
        Object.freeze({ id: "case-manufacturing-questions", title: "制造业客户问题体系梳理", service: "企业 AI 落地", industry: "制造业", summary: "按照采购、技术和使用人员的决策阶段拆分问题，形成知识库、问题地图和内容计划。", result: "客户问题能够被持续管理、回答和复用", status: "published", order: 2 }),
        Object.freeze({ id: "case-content-operations", title: "中小企业内容运营流程建设", service: "短视频运营", industry: "中小企业", summary: "统一内容方向、审核标准和发布节奏，让短视频与图文内容不再依赖临时发挥。", result: "形成可执行、可复盘的长期内容机制", status: "published", order: 3 })
      ]),
      problemGroups: Object.freeze([
        Object.freeze({ id: "geo", title: "GEO 服务问题", service: "GEO 服务", description: "从 AI 搜索认知、信源建设到效果判断。", status: "published", order: 1, questions: Object.freeze([
          Object.freeze({ id: "question-industrial-geo-start", slug: "industrial-geo-start", title: "工业品企业做 GEO 应该从哪里开始？", answer: "先统一企业主体、产品服务、应用场景、案例和常见问答，再围绕采购与技术人员真实会问的问题建设公开内容。", industries: Object.freeze(["工业品", "制造业"]), status: "published", order: 1 }),
          Object.freeze({ id: "question-geo-vs-seo", slug: "geo-vs-seo", title: "GEO 与传统 SEO 的目标和做法有什么不同？", answer: "SEO 更关注搜索结果中的网页可见性，GEO 更关注企业事实能否被 AI 理解、选择并组织进回答。两者可以协同，但内容结构和衡量方式不同。", industries: Object.freeze(["工业品", "制造业", "中小企业"]), status: "published", order: 2 })
        ]) }),
        Object.freeze({ id: "enterprise-ai", title: "企业 AI 落地问题", service: "企业 AI 落地", description: "从资料治理、知识库到业务智能体。", status: "published", order: 2, questions: Object.freeze([
          Object.freeze({ id: "question-ai-knowledge-base", slug: "ai-knowledge-base", title: "企业做 AI 应用前为什么要先建立知识库？", answer: "企业知识库为 AI 提供统一、经过审核且可追溯的事实来源，避免不同员工、文档和模型给出互相冲突的答案。", industries: Object.freeze(["工业品", "制造业", "中小企业"]), status: "published", order: 1 })
        ]) }),
        Object.freeze({ id: "short-video", title: "短视频运营问题", service: "短视频运营", description: "从选题、内容生产到账号持续运营。", status: "published", order: 3, questions: Object.freeze([
          Object.freeze({ id: "question-video-b2b-content", slug: "video-b2b-content", title: "工业品和制造业短视频应该拍什么内容？", answer: "优先展示客户真实关心的选型问题、使用场景、技术边界、实施流程和售后问题，而不是只做企业宣传片。", industries: Object.freeze(["工业品", "制造业"]), status: "published", order: 1 })
        ]) })
      ])
    })
  })
});

export default tongzhuoGeoProjectSeed;
