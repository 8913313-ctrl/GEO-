// Source-derived content seeds keep each original template recognizable before
// the CMS receives industry-specific records. CMS records always take priority.
export const LEGACY_SOURCE_PROFILES = Object.freeze({
  "03-software-ai": {
    heroTitle: "用AI技术驱动企业数字化转型", heroHighlight: "AI技术", heroDescription: "星云科技专注于人工智能、大数据、云计算等前沿技术，为企业提供智能化解决方案，助力企业实现数字化升级。",
    pageProductTitle: "产品方案", pageProductLead: "面向不同行业的AI解决方案", serviceSectionTitle: "核心技术", serviceSectionLead: "领先的人工智能技术栈", caseSectionTitle: "产品方案", caseSectionLead: "面向不同行业的AI解决方案", articleSectionTitle: "技术动态", articleSectionLead: "了解企业最新技术与行业动态", aboutLead: "专注于人工智能技术研发与应用，为企业提供可落地的智能化解决方案。", ctaLabel: "免费试用", statsClass: "stat-box", kind: "technology",
    seedServices: [
      ["AI算法引擎", "自研深度学习框架，支持计算机视觉、自然语言处理、语音识别等AI能力。", "gear"],
      ["大数据平台", "海量数据实时处理与分析，提供数据洞察与决策支持。", "chart"],
      ["云原生架构", "基于云原生的微服务架构，弹性伸缩，高可用保障。", "building"],
      ["安全合规", "企业级安全防护，数据加密存储，符合合规要求。", "check"],
      ["API开放平台", "丰富的API接口，快速集成，降低开发成本。", "service"],
      ["全端覆盖", "Web、移动端和小程序全平台支持，统一体验。", "design"]
    ],
    seedProducts: [["AI智能客服", "基于大语言模型的智能客服系统，提升客户服务效率。", "gear"], ["数据智能分析", "实时监控业务指标，智能预测趋势，辅助企业决策。", "chart"], ["智能制造系统", "工业物联网与AI协同，提升产能与良率。", "factory"], ["医疗AI辅助诊断", "医学影像AI分析，辅助医生快速准确诊断。", "check"]],
    techItems: [["React / Vue", "前端框架", "design"], ["Python", "AI开发", "gear"], ["Kubernetes", "容器编排", "building"], ["PyTorch", "深度学习", "chart"], ["MySQL / Redis", "数据存储", "service"], ["Kafka", "消息队列", "news"], ["Docker", "容器化", "building"], ["Spark", "大数据", "chart"]],
    stats: [["500", "企业客户"], ["99.9", "系统可用性"], ["50", "AI算法专利"], ["10", "年技术积累"]]
  },
  "04-logistics": {
    heroTitle: "智慧物流，高效供应链", heroHighlight: "", heroDescription: "迅驰物流专注于智慧物流与供应链管理，提供仓储、运输、配送、供应链金融等一站式解决方案。",
    pageProductTitle: "服务项目", pageProductLead: "全方位物流解决方案", serviceSectionTitle: "核心服务", serviceSectionLead: "全方位物流解决方案", caseSectionTitle: "为什么选择我们", caseSectionLead: "专业、高效、值得信赖", articleSectionTitle: "物流动态", articleSectionLead: "了解企业最新服务与行业动态", aboutLead: "专注于智慧物流与供应链管理，为企业提供高效、可靠的物流服务。", ctaLabel: "获取报价", statsClass: "stat-item", kind: "logistics",
    seedServices: [["干线运输", "全国网络覆盖，定时达、快运等多种运输方式", "building"], ["仓储管理", "智能化仓储系统，WMS/TMS无缝对接", "factory"], ["城市配送", "最后一公里配送，准时高效", "service"], ["供应链金融", "供应链融资、仓单质押等金融服务", "chart"]],
    featureItems: [["网络覆盖广", "覆盖全国300+城市，5000+配送网点"], ["时效保障", "承诺时效，准时率99.5%以上"], ["智能系统", "自主研发物流管理系统，实时追踪"], ["安全保障", "全程保险，货物安全有保障"], ["价格透明", "公开透明的定价体系，无隐性费用"], ["定制服务", "根据客户需求提供定制化物流方案"]],
    stats: [["300+", "覆盖城市"], ["5000+", "配送网点"], ["100万+", "日处理订单"], ["99.5%", "准时率"]]
  },
  "05-business-services": {
    heroTitle: "助力企业创新增长", heroHighlight: "创新增长", heroDescription: "创想咨询专注于品牌策划、数字营销、管理咨询等服务，帮助企业实现业务增长与品牌升级。",
    pageProductTitle: "服务项目", pageProductLead: "一站式企业增长解决方案", serviceSectionTitle: "核心服务", serviceSectionLead: "一站式企业增长解决方案", caseSectionTitle: "为什么选择创想", caseSectionLead: "用方法和经验帮助企业持续增长", articleSectionTitle: "咨询动态", articleSectionLead: "了解企业最新方法与行业洞察", aboutLead: "专注于品牌策划、数字营销、管理咨询等服务，帮助企业实现业务增长。", ctaLabel: "预约咨询", statsClass: "stat-item", kind: "consulting",
    seedServices: [["品牌策划", "品牌定位、视觉设计、品牌传播全案服务", "design"], ["数字营销", "社交媒体、内容营销、精准投放等数字营销服务", "service"], ["管理咨询", "战略规划、组织优化、流程再造等管理咨询服务", "chart"], ["产品创新", "用户研究、产品设计、体验优化等创新服务", "gear"], ["电商运营", "店铺运营、直播带货、私域流量等电商服务", "building"], ["活动策划", "线上线下活动策划、执行、传播一站式服务", "award"]],
    advantages: ["资深专家团队，平均10年+行业经验", "500+成功案例，覆盖20+行业", "数据驱动，效果可量化", "一站式服务，省心省力", "高性价比，投资回报率高"],
    stats: [["500+", "服务企业"], ["30%", "平均增长"], ["100+", "专家团队"], ["10年+", "行业经验"]]
  },
  "06-finance": {
    heroTitle: "稳健投资 财富增值", heroHighlight: "财富增值", heroDescription: "鑫盛金融专注于财富管理、资产管理、投资银行等金融服务，为高净值客户提供专业的资产配置方案。",
    pageProductTitle: "金融产品", pageProductLead: "多元化资产配置方案", serviceSectionTitle: "金融产品", serviceSectionLead: "多元化资产配置方案", caseSectionTitle: "为什么选择鑫盛", caseSectionLead: "专业、稳健、值得信赖", articleSectionTitle: "财经资讯", articleSectionLead: "了解企业最新观点与行业动态", aboutLead: "专注于财富管理、资产管理、投资银行等金融服务，为客户提供专业服务。", ctaLabel: "预约咨询", statsClass: "stat-item", kind: "finance",
    seedServices: [["财富管理", "为高净值客户提供定制化财富管理方案", "award"], ["资产管理", "专业团队管理，追求稳健收益", "chart"], ["投资银行", "IPO、并购重组等投行服务", "building"], ["私募基金", "优质项目投资，分享成长红利", "service"]],
    advantages: ["10年+资产管理经验", "专业投研团队，覆盖全市场", "严格风控体系，保障资金安全", "稳健投资策略，追求长期回报", "透明信息披露，值得信赖"],
    stats: [["100亿+", "管理规模"], ["15%", "年化收益"], ["1000+", "服务客户"], ["10年", "稳健运营"]]
  },
  "07-healthcare": {
    heroTitle: "守护健康 专业医疗", heroHighlight: "专业医疗", heroDescription: "康瑞医疗集团集医疗、预防、保健、康复于一体，提供全方位的医疗健康服务。",
    pageProductTitle: "科室与服务", pageProductLead: "专业医疗，用心守护", serviceSectionTitle: "特色服务", serviceSectionLead: "专业医疗，用心守护", caseSectionTitle: "重点科室", caseSectionLead: "专业科室，精准诊疗", articleSectionTitle: "健康资讯", articleSectionLead: "了解企业最新健康内容", aboutLead: "集医疗、预防、保健、康复于一体的综合性医疗集团。", ctaLabel: "预约挂号", statsClass: "stat-item", kind: "health",
    seedServices: [["综合门诊", "内科、外科、妇科、儿科等全科门诊服务", "building"], ["健康体检", "个性化体检套餐，早期疾病筛查", "check"], ["慢病管理", "高血压、糖尿病等慢性病长期管理", "clock"], ["急诊急救", "24小时急诊服务，快速响应", "phone"], ["专家会诊", "多学科专家联合诊疗", "team"], ["在线问诊", "互联网医疗，远程诊疗", "service"]],
    departments: [["心血管内科", "health"], ["神经内科", "gear"], ["骨科中心", "building"], ["眼科中心", "design"], ["口腔科", "check"], ["妇产科", "team"], ["儿科中心", "team"], ["肿瘤中心", "building"]],
    people: [["张教授", "心血管内科主任"], ["李主任", "神经内科专家"], ["王院长", "骨科中心主任"], ["陈主任", "妇产科专家"]],
    stats: [["20年+", "品牌历史"], ["100+", "专家团队"], ["50万+", "服务患者"], ["98%", "满意度"]]
  },
  "08-education": {
    heroTitle: "知识改变命运 学习成就未来", heroHighlight: "学习成就未来", heroDescription: "博学堂专注于K12教育、职业培训、成人教育等领域，提供优质的教育培训服务。",
    pageProductTitle: "课程中心", pageProductLead: "精品课程，助力成长", serviceSectionTitle: "热门课程", serviceSectionLead: "精品课程，助力成长", caseSectionTitle: "为什么选择博学", caseSectionLead: "专业、用心、值得信赖", articleSectionTitle: "校园动态", articleSectionLead: "了解学校最新课程与动态", aboutLead: "专注于K12教育、职业培训、成人教育，提供优质的教育培训服务。", ctaLabel: "免费试听", statsClass: "stat-item", kind: "education",
    seedServices: [["小学数学提优班", "针对3-6年级学生，系统提升数学思维能力", "30课时 · ¥2980", "chart"], ["初中英语强化班", "语法、阅读、写作全面提升，冲刺高分", "40课时 · ¥3980", "news"], ["IT技能培训班", "Python、Java、前端开发等热门技能", "80课时 · ¥8980", "gear"], ["美术创意班", "素描、色彩、创意绘画，培养艺术素养", "24课时 · ¥1980", "design"], ["钢琴入门班", "零基础入门，轻松学会钢琴演奏", "20课时 · ¥2580", "service"], ["篮球训练营", "专业教练指导，提升篮球技能", "16课时 · ¥1580", "building"]],
    featureItems: [["名师团队", "985/211院校毕业，教学经验丰富", "team"], ["科学课程", "系统化课程体系，因材施教", "news"], ["效果保障", "定期测评，学习效果可视化", "chart"], ["贴心服务", "班主任全程跟踪，家校及时沟通", "check"]],
    people: [["张老师", "数学高级教师"], ["李老师", "英语特级教师"], ["王老师", "语文名师"], ["陈老师", "物理竞赛教练"]],
    stats: [["15年", "办学历史"], ["10万+", "学员数量"], ["200+", "专业教师"], ["95%", "满意度"]]
  },
  "09-travel-hotel": {
    heroTitle: "探索世界 美好旅程", heroHighlight: "美好旅程", heroDescription: "云游文旅为您提供国内外旅游、酒店预订、定制行程等一站式旅游服务。",
    pageProductTitle: "旅游产品", pageProductLead: "发现世界之美", serviceSectionTitle: "热门目的地", serviceSectionLead: "发现世界之美", caseSectionTitle: "精选酒店", caseSectionLead: "舒适住宿，品质之选", articleSectionTitle: "旅游资讯", articleSectionLead: "了解最新旅行灵感与服务动态", aboutLead: "专注于旅游服务，提供国内外旅游、酒店预订、定制行程等一站式服务。", ctaLabel: "立即预订", statsClass: "stat-item", kind: "travel",
    destinations: [["丽江古城", "感受纳西族风情", "building"], ["三亚湾", "热带海滨度假", "design"], ["张家界", "奇峰秀水仙境", "building"], ["西藏拉萨", "朝圣之旅", "pin"]],
    hotels: [["云顶度假酒店", "位于山顶，俯瞰全景，设施齐全", "¥899", "building"], ["海滨度假村", "私人沙滩，海景房，亲子友好", "¥1299", "design"], ["山居精品民宿", "远离喧嚣，亲近自然，体验慢生活", "¥599", "building"]],
    seedServices: [["机票预订", "国内外航线，优惠价格", "pin"], ["酒店住宿", "全球酒店，品质保障", "building"], ["跟团游", "精品小团，深度体验", "service"], ["定制行程", "专属定制，随心所欲", "design"]],
    stats: [["10年", "行业经验"], ["100万+", "服务游客"], ["500+", "合作酒店"], ["98%", "好评率"]]
  },
  "10-food-consumer": {
    heroTitle: "传统美食 匠心制作", heroHighlight: "匠心制作", heroDescription: "味道坊传承百年工艺，精选优质食材，为您呈现地道的中华美食。",
    pageProductTitle: "产品中心", pageProductLead: "传统工艺，美味传承", serviceSectionTitle: "热销产品", serviceSectionLead: "传统工艺，美味传承", caseSectionTitle: "为什么选择我们", caseSectionLead: "匠心品质，值得信赖", articleSectionTitle: "品牌动态", articleSectionLead: "了解品牌故事与产品动态", aboutLead: "传承百年工艺，用心制作每一份美食，让您品尝地道的中华味道。", ctaLabel: "立即下单", statsClass: "stat-item", kind: "food",
    seedServices: [["手工月饼", "传统配方，皮薄馅足", "¥128/盒", "service"], ["糯米糕点", "软糯香甜，老少皆宜", "¥68/盒", "design"], ["蜂蜜礼盒", "纯天然，无添加", "¥198/盒", "award"], ["年货礼盒", "精选多款传统糕点", "¥288/盒", "building"]],
    featureItems: [["传统工艺", "百年传承，手工制作，保留原汁原味", "design"], ["优质原料", "精选上等食材，源头把控品质", "building"], ["品质保证", "ISO认证，食品安全有保障", "award"]],
    cookingTitle: "匠心制作，传承百年", cookingParagraphs: ["味道坊始创于1920年，历经百年风雨，始终坚持传统工艺，用心制作每一份美食。", "我们的糕点师傅拥有30年以上制作经验，每一道工序都精益求精，只为呈现最地道的味道。"],
    stats: [["100年", "品牌历史"], ["50+", "产品种类"], ["1000万+", "年销量"], ["99%", "好评率"]]
  }
});
