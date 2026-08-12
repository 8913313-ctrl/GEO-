import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const boundary = source.indexOf("function loadState");
const helperStart = source.indexOf("function ensureOnboardingPlanningBaseline");
const helperEnd = source.indexOf("function syncEnterpriseProfileToSiteCms", helperStart);
assert.ok(boundary > 0, "Unable to isolate onboarding helpers.");

const sandbox = { Date, Math, JSON, Object, Array, Set, Map, String, Number, Boolean, RegExp };
vm.createContext(sandbox);
vm.runInContext(`${source.slice(0, boundary)}
${source.slice(helperStart, helperEnd)}
let state = migrateState(cloneBlankState());
state.enterpriseProfile = {
  ...state.enterpriseProfile,
  companyName: "青岛恒稳电源科技有限公司",
  brandName: "恒稳电源",
  primaryService: "模块化 UPS 电源",
  serviceDescription: "面向数据中心提供设备选型与交付",
  introduction: "UPS 电源与数据中心基础设施企业",
  audience: "数据中心建设与运维企业",
  industryRegion: "UPS 电源与数据中心基础设施",
  serviceArea: "全国"
};
const firstLine = ensureOnboardingPlanningBaseline();
const firstCounts = { lines: state.businessLines.length, questions: state.questionLibrary.length, keywords: state.keywords.length };
const secondLine = ensureOnboardingPlanningBaseline();
globalThis.__result = { state, firstLine, secondLine, firstCounts };
`, sandbox, { filename: "public/app.js" });

const result = JSON.parse(JSON.stringify(sandbox.__result));
assert.equal(result.firstCounts.lines, 1, "Onboarding must create one default business line.");
assert.equal(result.firstCounts.questions, 8, "Onboarding must create eight baseline customer questions.");
assert.equal(result.firstCounts.keywords, 1, "Onboarding must create one core keyword.");
assert.equal(result.state.businessLines.length, 1, "Repeated completion must not duplicate the business line.");
assert.equal(result.state.questionLibrary.length, 8, "Repeated completion must not duplicate baseline questions.");
assert.equal(result.state.keywords.length, 1, "Repeated completion must not duplicate the core keyword.");
assert.equal(result.firstLine.id, result.secondLine.id);
assert.ok(result.state.questionLibrary.every((item) => item.businessLineId === result.firstLine.id && item.status === "active"));
assert.ok(result.state.questionLibrary.every((item) => item.source === "企业建档基线"));
assert.ok(result.state.questionLibrary.some((item) => item.question.includes("恒稳电源")), "Brand baseline must use the current customer's brand.");
assert.doesNotMatch(JSON.stringify(result.state.questionLibrary), /桐灼|灼见/, "Customer baseline must not inherit product-vendor identity.");

console.log("Onboarding default business line, keyword, questions, idempotency, and customer-boundary checks passed.");
