import { ProductionDatabase } from "../production-database.mjs";
import { FoundationAssetStore } from "../foundation-asset-store.mjs";
import { ensureGeoPromptAndQualityPublishedAssets } from "../foundation-assets/bootstrap.mjs";

if (!process.argv.includes("--apply") || !process.argv.includes("--owner-confirmed")) {
  console.error("Refusing to publish GEO content foundation assets without --apply and --owner-confirmed.");
  process.exitCode = 2;
} else {
  const database = new ProductionDatabase();
  try {
    const reviewer = database.connection.prepare("SELECT id FROM users WHERE status = 'active' AND role = 'admin' ORDER BY created_at ASC LIMIT 1").get()
      || database.connection.prepare("SELECT id FROM users WHERE status = 'active' ORDER BY created_at ASC LIMIT 1").get();
    if (!reviewer?.id) throw new Error("Cannot publish GEO content foundation assets without an active local reviewer account.");
    const result = ensureGeoPromptAndQualityPublishedAssets(new FoundationAssetStore(database), { userId: reviewer.id });
    console.log(JSON.stringify({
      status: "published",
      promptVersion: { id: result.promptVersion.id, version: result.promptVersion.version, status: result.promptVersion.status, checksum: result.promptVersion.checksum },
      qualityRulePack: { id: result.qualityRulePack.id, version: result.qualityRulePack.version, status: result.qualityRulePack.status, checksum: result.qualityRulePack.checksum }
    }, null, 2));
  } finally {
    database.close();
  }
}
