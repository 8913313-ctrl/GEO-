import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ProductionDatabase } from "../production-database.mjs";
import { FoundationAssetStore } from "../foundation-asset-store.mjs";
import { flattenUpsGeoRules, importUpsGeoCandidateRules } from "../foundation-assets/ups-geo-review-import.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const candidatePath = path.join(projectRoot, "docs", "baseline", "P2-T06-UPS-GEO-RULE-CANDIDATES-20260812.json");
const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  if (process.argv[index].startsWith("--")) {
    args.set(process.argv[index].slice(2), process.argv[index + 1] || "true");
    index += 1;
  }
}

const candidateManifest = JSON.parse(await readFile(candidatePath, "utf8"));
const rules = flattenUpsGeoRules(candidateManifest);
const apply = args.get("apply") === "true";
if (!apply) {
  console.log(JSON.stringify({ mode: "dry-run", candidatePath, ruleCount: rules.length, nextAction: "review each rule, then rerun with --apply" }, null, 2));
  process.exit(0);
}

const database = new ProductionDatabase();
try {
  const store = new FoundationAssetStore(database);
  const imported = importUpsGeoCandidateRules(store, candidateManifest);
  console.log(JSON.stringify({ databasePath: database.databasePath, mode: "applied", methodologyVersionId: imported.version.id, ruleCount: imported.rules.length, status: imported.version.status, publicationBlocked: true }, null, 2));
} finally {
  database.close();
}
