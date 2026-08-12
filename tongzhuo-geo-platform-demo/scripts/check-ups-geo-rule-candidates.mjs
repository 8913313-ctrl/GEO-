import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const manifestPath = path.join(projectRoot, "docs", "baseline", "P2-T06-UPS-GEO-RULE-CANDIDATES-20260812.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const sourceManifest = JSON.parse(await readFile(path.join(projectRoot, "docs", "baseline", manifest.sourceManifest), "utf8"));
const sourceHashes = new Map(sourceManifest.files.map((file) => [file.path, file.sha256]));
const expectedThemes = ["digital-identity", "first-party-evidence", "question-map", "content-and-citation", "publishing-and-review", "risk-boundaries"];
assert.equal(manifest.status, "candidate-for-review-only");
assert.deepEqual(manifest.themes.map((theme) => theme.key), expectedThemes);
const rules = manifest.themes.flatMap((theme) => theme.rules.map((rule) => ({ ...rule, theme: theme.key })));
assert.equal(rules.length, 16);
assert.equal(new Set(rules.map((rule) => rule.id)).size, rules.length, "rule IDs must be unique");
for (const rule of rules) {
  assert.ok(rule.rule && rule.rule.length >= 20, `${rule.id} needs a concrete rule`);
  assert.ok(rule.source?.path && rule.source?.locator && rule.source?.excerpt, `${rule.id} needs a source locator`);
  assert.match(rule.source.sha256 || "", /^[0-9a-f]{64}$/, `${rule.id} needs a source SHA-256`);
  assert.equal(rule.source.sha256, sourceHashes.get(rule.source.path), `${rule.id} source SHA-256 must match the source manifest`);
  assert.ok(["method", "governance", "data-contract", "quality-gate", "measurement", "guardrail", "distribution", "experiment", "commercial-risk", "safety", "evidence-boundary"].includes(rule.classification), `${rule.id} has unknown classification`);
  assert.equal(rule.reuseDecision, "candidate-global-after-approval", `${rule.id} must remain gated until source review`);
  assert.match(rule.source.path, /^(docs|research)\//, `${rule.id} cannot source excluded directories`);
}
console.log(JSON.stringify({ manifest: manifestPath, themes: manifest.themes.length, rules: rules.length, status: manifest.status }, null, 2));
