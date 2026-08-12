import { ProductionDatabase } from "../production-database.mjs";
import { FoundationAssetStore } from "../foundation-asset-store.mjs";
import { ensureGeoFoundationDrafts } from "../foundation-assets/bootstrap.mjs";

if (!process.argv.includes("--apply")) {
  console.error("Refusing to write without --apply. This command creates draft GEO foundation assets in TZ_DATABASE_PATH.");
  process.exitCode = 2;
} else {
  const database = new ProductionDatabase();
  try {
    const result = ensureGeoFoundationDrafts(new FoundationAssetStore(database));
    console.log(JSON.stringify({
      databasePath: database.databasePath,
      status: "drafts_ready",
      methodologyVersionId: result.methodologyVersion.id,
      promptVersionId: result.promptVersion.id,
      qualityRulePackId: result.qualityRulePack.id
    }, null, 2));
  } finally {
    database.close();
  }
}
