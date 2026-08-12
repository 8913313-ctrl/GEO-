import { ProductionDatabase } from "../production-database.mjs";
import { FoundationAssetStore } from "../foundation-asset-store.mjs";

const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  if (!process.argv[index].startsWith("--")) continue;
  args.set(process.argv[index].slice(2), process.argv[index + 1] || "true");
  index += 1;
}
if (args.get("apply") !== "true") {
  console.error("Refusing to publish methodology without --apply true.");
  process.exitCode = 2;
} else {
  const versionId = String(args.get("version") || "").trim();
  const publisherId = String(args.get("publisher-id") || "").trim();
  if (!versionId || !publisherId) throw new Error("Required: --version, --publisher-id, --apply true");
  const database = new ProductionDatabase();
  try {
    if (!database.connection.prepare("SELECT 1 FROM users WHERE id = ? AND status = 'active'").get(publisherId)) throw new Error("Publisher must be an active local user.");
    const store = new FoundationAssetStore(database);
    const readiness = store.assertMethodologyPublicationReady(versionId);
    const published = store.setMethodologyVersionStatus(versionId, "published", { userId: publisherId });
    console.log(JSON.stringify({ readiness, published }, null, 2));
  } finally {
    database.close();
  }
}
