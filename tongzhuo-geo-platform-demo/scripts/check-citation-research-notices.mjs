import assert from "node:assert/strict";
import crypto from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageRoot = path.join(projectRoot, "research-packages", "geo-citation-lab", "2.0.1");
const pins = JSON.parse(await readFile(path.join(packageRoot, "NOTICE-PINS.json"), "utf8"));
assert.equal(pins.datasetVersion, "2.0.1");
assert.equal(pins.sourceCommit, "81ba1566f70f114e9202b798f8d4525a9329ebd3");
assert.match(pins.attribution, /GEO Citation Lab/);
for (const [name, expected] of Object.entries(pins.notices)) {
  const file = path.join(packageRoot, "upstream", "licenses", name);
  const bytes = await readFile(file);
  assert.equal((await stat(file)).size, expected.sizeBytes, `${name} byte count`);
  assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"), expected.sha256, `${name} sha256`);
}
console.log("Citation research notice check passed");
