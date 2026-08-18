// The registry is deliberately data-only so the admin UI, public renderer,
// and deployment checks can share the same template contract.
export const DEFAULT_SITE_TEMPLATE_KEY = "01-industry";

export const SITE_TEMPLATES = Object.freeze([
  { key: "01-industry", name: "工业制造 / 建材 / 机械", shortName: "工业制造", description: "强调产品能力、参数信息、应用场景与交付可信度。", source: "01-工业制造建材机械", layout: "industrial-grid", accent: "#1d4ed8", supports: ["products", "cases", "articles", "contact"], stylesheet: "template-01-industry.css", sourceReady: true, status: "ready" },
  { key: "02-construction", name: "建筑工程 / 装饰设计", shortName: "建筑工程", description: "适合展示项目经验、设计能力、施工流程与项目案例。", source: "02-建筑工程装饰设计", layout: "project-studio", accent: "#b45309", supports: ["projects", "cases", "articles", "contact"], stylesheet: "template-02-construction.css", sourceReady: true, status: "ready" },
  { key: "03-software-ai", name: "软件科技 / AI", shortName: "软件科技", description: "突出产品功能、技术能力、解决方案和企业客户价值。", source: "03-软件科技AI企业", layout: "tech-system", accent: "#0f766e", supports: ["products", "solutions", "articles", "contact"], sourceReady: false, status: "pending" },
  { key: "04-logistics", name: "物流运输 / 供应链", shortName: "物流供应链", description: "围绕运输网络、时效、仓储、服务区域与流程能力组织内容。", source: "04-物流运输供应链", layout: "route-network", accent: "#0369a1", supports: ["services", "network", "articles", "contact"], sourceReady: false, status: "pending" },
  { key: "05-business-services", name: "企业服务 / 咨询营销", shortName: "企业服务", description: "适合呈现服务方法、顾问团队、客户问题和咨询转化入口。", source: "05-企业服务咨询营销", layout: "editorial-consulting", accent: "#7c3aed", supports: ["services", "cases", "articles", "contact"], sourceReady: false, status: "pending" },
  { key: "06-finance", name: "金融服务 / 投资", shortName: "金融投资", description: "强调专业资质、服务边界、风险提示和可信的客户沟通。", source: "06-金融服务投资", layout: "trust-capital", accent: "#166534", supports: ["services", "insights", "compliance", "contact"], sourceReady: false, status: "pending" },
  { key: "07-healthcare", name: "医疗健康", shortName: "医疗健康", description: "突出专业团队、诊疗服务、机构信息和预约咨询路径。", source: "07-医疗健康", layout: "care-path", accent: "#0f766e", supports: ["services", "doctors", "articles", "contact"], sourceReady: false, status: "pending" },
  { key: "08-education", name: "教育培训 / 学校", shortName: "教育培训", description: "围绕课程、师资、教学成果、招生信息与咨询表单布局。", source: "08-教育培训学校", layout: "learning-path", accent: "#c2410c", supports: ["courses", "teachers", "articles", "contact"], sourceReady: false, status: "pending" },
  { key: "09-travel-hotel", name: "旅游酒店 / 文旅", shortName: "旅游文旅", description: "适合展示目的地、房型或线路、体验内容和预订咨询。", source: "09-旅游酒店文旅", layout: "destination-led", accent: "#be123c", supports: ["destinations", "rooms", "articles", "contact"], sourceReady: false, status: "pending" },
  { key: "10-food-consumer", name: "食品餐饮 / 消费", shortName: "食品餐饮", description: "突出产品、门店、品牌故事、供应信息与消费场景。", source: "10-食品餐饮消费", layout: "product-story", accent: "#9a3412", supports: ["products", "stores", "articles", "contact"], sourceReady: false, status: "pending" }
]);

const TEMPLATE_KEYS = new Set(SITE_TEMPLATES.map((item) => item.key));

export function isSiteTemplateKey(value) {
  return TEMPLATE_KEYS.has(String(value || ""));
}

export function siteTemplateByKey(value) {
  return SITE_TEMPLATES.find((item) => item.key === value) || SITE_TEMPLATES[0];
}
