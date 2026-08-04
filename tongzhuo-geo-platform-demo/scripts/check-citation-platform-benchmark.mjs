import assert from "node:assert/strict";
import { CitationResearchStore } from "../citation-research-store.mjs";

const store = new CitationResearchStore();
try {
  const benchmark = store.platformPreferenceBenchmark();
  assert.equal(benchmark.factPackVersion, "citation-platform-preference-v1");
  assert.equal(benchmark.dataset.citationObservations, 214119);
  assert.equal(benchmark.dataset.preferredCitationObservations, 189845);
  assert.equal(benchmark.dataset.targetPlatformCitationObservationCount, 194753);
  assert.equal(benchmark.dataset.targetPlatformPreferredCitationObservationCount, 177137);

  const byLabel = new Map(benchmark.platforms.map((item) => [item.label, item]));
  const expected = {
    豆包: { citations: 61592, domains: 3384, perQuestion: 103.9, position: 10.2, snippet: 475 },
    DeepSeek: { citations: 34767, domains: 3301, perQuestion: 58.9, position: 5.4, snippet: 123 },
    千问: { citations: 48634, domains: 1376, perQuestion: 78.4, position: 8.2, snippet: 396 },
    元宝: { citations: 49760, domains: 4715, perQuestion: 82.4, position: 8, snippet: 73 }
  };
  for (const [label, values] of Object.entries(expected)) {
    const platform = byLabel.get(label);
    assert.ok(platform, `${label} platform family must exist`);
    assert.equal(platform.citationObservationCount, values.citations);
    assert.equal(platform.domainCount, values.domains);
    assert.equal(platform.citationsPerQuestion, values.perQuestion);
    assert.equal(platform.averageQuotePosition, values.position);
    assert.equal(platform.averageSnippetLength, values.snippet);
    assert.ok(platform.sourceCategories.length > 0);
    assert.ok(platform.sourceTypes.length > 0);
    assert.ok(platform.contentFormats.length > 0);
    assert.ok(platform.topDomains.length > 0);
  }

  const overlap = new Map(benchmark.domainOverlap.map((item) => [[item.platformA, item.platformB].sort().join("|"), item.sharedDomainCount]));
  assert.equal(overlap.get(["豆包", "元宝"].sort().join("|")), 1090);
  assert.equal(overlap.get(["DeepSeek", "元宝"].sort().join("|")), 1047);
  assert.equal(overlap.get(["豆包", "DeepSeek"].sort().join("|")), 883);
  assert.equal(overlap.get(["千问", "元宝"].sort().join("|")), 737);
  assert.equal(overlap.get(["DeepSeek", "千问"].sort().join("|")), 627);
  assert.equal(overlap.get(["豆包", "千问"].sort().join("|")), 614);

  assert.ok(benchmark.questionSegments.some((item) => item.key === "comparison"));
  assert.ok(benchmark.questionSegments.every((item) => item.definition && item.platforms.length === 4));
  assert.equal(benchmark.statisticalScope.customerPerformanceMetric, false);
  assert.equal(benchmark.statisticalScope.causalInference, false);
  assert.match(benchmark.statisticalScope.primaryObservationFilter, /raw upstream record scope/);
  assert.ok(benchmark.limitations.some((item) => /global historical baseline/i.test(item)));
  console.log("Citation platform benchmark check passed");
} finally {
  store.close();
}
