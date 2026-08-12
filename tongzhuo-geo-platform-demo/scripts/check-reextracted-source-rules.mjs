import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const registry = JSON.parse(await readFile(path.join(projectRoot, "docs", "baseline", "P2-T06-EXTERNAL-SOURCE-REGISTRY-20260812.json"), "utf8"));
const manifest = JSON.parse(await readFile(path.join(projectRoot, "docs", "baseline", "P2-T06-REEXTRACTED-RULE-CANDIDATES-20260812.json"), "utf8"));
const sourceIds = new Set(registry.sources.map((source) => source.id));
assert.equal(manifest.status, "candidate-for-review-only");
assert.equal(manifest.rules.length, 12);
assert.equal(new Set(manifest.rules.map((rule) => rule.id)).size, manifest.rules.length);
for (const rule of manifest.rules) {
  assert.ok(rule.rule.length >= 20, `${rule.id} needs a concrete rule`);
  assert.ok(rule.sources.length > 0 && rule.sources.every((sourceId) => sourceIds.has(sourceId)), `${rule.id} has an unknown source`);
  assert.equal(rule.reuseDecision, "candidate-global-after-approval");
  const sources = rule.sources.map((sourceId) => registry.sources.find((source) => source.id === sourceId));
  if (sources.some((source) => source.reuse === "research-reference-only" || source.reuse === "review-only" || source.reuse === "quote-or-summary-only")) {
    assert.equal(rule.classification === "engineering-governance" && rule.sources.every((sourceId) => ["SRC-016", "SRC-018", "SRC-019"].includes(sourceId)), false, `${rule.id} must not silently turn restricted research into engineering fact`);
  }
}
console.log(JSON.stringify({ registrySources: registry.sources.length, candidateRules: manifest.rules.length, status: manifest.status }, null, 2));
