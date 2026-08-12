import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const boundary = source.indexOf("function loadState");
assert.ok(boundary > 0, "Unable to isolate the workspace seed helpers.");

const sandbox = { Date, Math, JSON, Object, Array, Set, Map, String, Number, Boolean, RegExp };
vm.createContext(sandbox);
vm.runInContext(`${source.slice(0, boundary)}\nglobalThis.__blank = migrateState(cloneBlankState());`, sandbox, { filename: "public/app.js" });

const blank = JSON.parse(JSON.stringify(sandbox.__blank));
for (const key of [
  "businessLines", "keywords", "keywordPacks", "questionLibrary", "topics", "contentPlans",
  "articles", "publishTasks", "publishSchedules", "accountGroups", "knowledgeBases",
  "knowledgeItems", "knowledgeVersions", "knowledgeCitations", "contentAssets"
]) assert.deepEqual(blank[key], [], `Fresh delivery must start with an empty ${key}.`);

assert.equal(blank.enterpriseProfile.companyName, "");
assert.equal(blank.enterpriseProfile.completion, 0);
assert.equal(blank.site.domain, "");
assert.equal(blank.site.cms.leads.length, 0);
assert.equal(blank.monitoring.demo, false);
assert.equal(blank.settings.members.length, 0);
assert.ok(blank.writingAgents.length > 0, "Reusable built-in writing agents should remain available.");
assert.ok(blank.writingAgents.every((agent) => agent.builtIn && agent.preferredKnowledgeBaseIds.length === 0));
assert.ok(!JSON.stringify(blank).includes("桐灼（淄博）网络科技有限公司"), "Customer-specific company data leaked into the blank seed.");

assert.match(source, /source: "private-deployment-blank-seed"/, "Fresh-server hydration must use the neutral seed.");
assert.match(source, /if \(!saved\) return migrateState\(cloneBlankState\(\)\)/, "Fresh local bootstrap must use the neutral seed.");
assert.match(source, /state = migrateState\(cloneBlankState\(\)\);/, "Reset must return to a neutral customer workspace.");

const actorStart = source.indexOf("function currentActorName");
const actorEnd = source.indexOf("function productionUserToMember", actorStart);
assert.ok(actorStart > 0 && actorEnd > actorStart, "Unable to isolate current-user helpers.");
const actorSandbox = { window: { __TZ_AUTH__: { user: { username: "new-admin", displayName: "新客户管理员" } } } };
vm.createContext(actorSandbox);
vm.runInContext(`${source.slice(actorStart, actorEnd)}\nglobalThis.__actor = currentActorName();`, actorSandbox, { filename: "public/app.js" });
assert.equal(actorSandbox.__actor, "新客户管理员", "Business records must use the authenticated customer user.");

const dashboardStart = source.indexOf("function dashboardGreeting");
const dashboardEnd = source.indexOf("function customerFacingEffectText", dashboardStart);
assert.ok(dashboardStart > 0 && dashboardEnd > dashboardStart, "Unable to isolate dashboard customer-state helpers.");
actorSandbox.state = blank;
actorSandbox.auditSnapshot = { loaded: false, items: [] };
vm.runInContext(`${source.slice(dashboardStart, dashboardEnd)}
globalThis.__greeting = dashboardGreeting(new Date(2026, 7, 13, 15, 0, 0));
globalThis.__domain = dashboardOfficialDomain();
globalThis.__health = dashboardHealthStatus(state.enterpriseProfile.completion);
globalThis.__activities = dashboardActivityItems();`, actorSandbox, { filename: "public/app.js" });
assert.equal(actorSandbox.__greeting, "下午好，新客户管理员");
assert.equal(actorSandbox.__domain, "", "An unconfigured customer must not inherit a vendor domain.");
assert.equal(actorSandbox.__health, "待建档");
assert.deepEqual(JSON.parse(JSON.stringify(actorSandbox.__activities)), [], "A fresh customer must not see fabricated business activity.");

const beautyQuestions = sandbox.buildQuestionCandidates(["敏感肌面霜"], "KP-BEAUTY", "BL-BEAUTY", new Set(), { industry: "美妆" });
const upsQuestions = sandbox.buildQuestionCandidates(["机房 UPS 选型"], "KP-UPS", "BL-UPS", new Set(), { industry: "UPS 电源" });
assert.ok(beautyQuestions.some((item) => item.question.includes("美妆")), "Question rules must use the configured beauty industry.");
assert.ok(upsQuestions.some((item) => item.question.includes("UPS 电源")), "Question rules must use the configured UPS industry.");
assert.ok(!beautyQuestions.some((item) => item.question.includes("制造业")), "Beauty questions must not inherit manufacturing assumptions.");
assert.ok(!upsQuestions.some((item) => item.question.includes("制造业")), "UPS questions must not inherit manufacturing assumptions.");

const dashboardSource = source.slice(source.indexOf("function renderDashboard"), source.indexOf("function activeBusinessLine"));
assert.ok(!dashboardSource.includes("上午好，王宁"), "Dashboard greeting must not be hard-coded to the vendor demo user.");
assert.ok(!dashboardSource.includes("www.tongzhuo.com"), "Dashboard status must not be hard-coded to the vendor demo domain.");
assert.ok(!dashboardSource.includes("工业品企业如何搭建可持续"), "Dashboard activity must come from customer records.");
for (const forbidden of [
  'selectedBy: "王宁"', 'actor = "王宁"', 'reviewedBy = "王宁"',
  'archivedBy = "王宁"', 'author = "王宁', 'createdBy: "王宁"'
]) assert.ok(!source.slice(boundary).includes(forbidden), `Runtime customer records still contain fixed vendor identity: ${forbidden}`);
console.log("Blank private-deployment workspace bootstrap check passed.");
