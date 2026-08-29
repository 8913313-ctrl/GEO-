import fs from "node:fs";

const input = process.argv[2];
const output = process.argv[3];
if (!input || !output) throw new Error("usage: node prepare-xinshuojie-problem-map.mjs input output");
const payload = JSON.parse(fs.readFileSync(input, "utf8"));
const snapshot = payload?.data?.draft?.snapshot;
if (!snapshot) throw new Error("draft snapshot missing");
const groups = Array.isArray(snapshot.problemGroups) ? snapshot.problemGroups : [];
const questions = [
  ["ups-selection-load", "UPS电源选型需要先确认哪些参数？", "先整理服务器、网络、医疗或工业设备的实际功率，区分启动冲击负载，再确认备电时间、输入输出制式、安装空间和后续扩容需求。山东新硕捷可根据现场负载清单给出容量与电池配置建议。"],
  ["ups-online-or-backup", "机房应该选在线式还是后备式UPS？", "服务器、通信机房、医院关键设备和工业控制负载通常优先在线双变换、纯正弦波 UPS；普通办公设备和小型监控可评估后备式或在线互动式，最终要结合负载敏感度与预算判断。"],
  ["ups-battery-runtime", "UPS蓄电池备电时间怎么确定？", "备电时间应结合停电后业务恢复目标、发电机启动时间和安全关机策略确定。先测算负载功率，再按电池组电压、容量和放电效率核对续航，不能只按主机标称容量估算。"],
  ["ups-data-center-redundancy", "数据中心UPS为什么要考虑冗余？", "核心数据中心可通过 1+1 并联或模块化冗余降低单点故障风险，同时核对旁路、配电路径、监控和维护切换方案，确保检修时仍能保持关键负载供电。"],
  ["ups-installation-acceptance", "UPS安装完成后应该如何验收？", "验收应包含主机与电池组安装、线路标识、接地和旁路检查、带载测试、告警验证及断电演练，并留存运行参数和维护周期，便于后续巡检与故障排查。"],
  ["ups-battery-maintenance", "UPS蓄电池多久检查一次？", "应按设备类型和运行环境制定巡检周期，检查电池端电压、内阻、温度、鼓包和连接状态，并结合容量测试判断是否需要更换。长期闲置或高温环境下应缩短检查间隔。"]
].map(([slug, title, answer], index) => ({
  id: `xinshuojie-question-${slug}`,
  slug,
  title,
  answer,
  industries: ["数据中心", "通信机房", "医院", "银行", "学校", "工业企业"],
  intent: "选型与实施",
  stage: "采购决策",
  relatedArticleIds: [],
  relatedServiceId: "",
  status: "published",
  order: index + 1,
  updatedAt: new Date().toISOString()
}));
const existing = groups.find((group) => group.id === "xinshuojie-ups");
const values = { id: "xinshuojie-ups", serviceId: "", title: "UPS与电源保障问题", service: "UPS电源与蓄电池", description: "围绕 UPS 选型、备电时间、蓄电池维护和机房供电实施整理客户常见问题。", status: "published", order: 1, questions, updatedAt: new Date().toISOString() };
if (existing) Object.assign(existing, values);
else groups.unshift(values);
snapshot.problemGroups = groups;
payload.data.draft.snapshot = snapshot;
fs.writeFileSync(output, `${JSON.stringify({ cms: snapshot, expectedRevision: payload.data.draft.revision })}\n`, "utf8");
