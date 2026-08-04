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
console.log("Blank private-deployment workspace bootstrap check passed.");
