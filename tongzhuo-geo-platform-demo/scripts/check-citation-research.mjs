import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { CitationResearchStore, CITATION_RESEARCH_DEFAULTS } from "../citation-research-store.mjs";

const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "tongzhuo-citation-research-"));
const databasePath = path.join(temporaryDirectory, "citation-research-fixture.sqlite");
let store;

function createFixture() {
  const db = new DatabaseSync(databasePath);
  db.exec(`
    PRAGMA journal_mode = DELETE;
    CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT;
    CREATE TABLE source_artifacts (artifact_name TEXT PRIMARY KEY, repository_path TEXT NOT NULL, size_bytes INTEGER NOT NULL, minimum_size_bytes INTEGER NOT NULL, sha256 TEXT NOT NULL) STRICT;
    CREATE TABLE table_inventory (table_name TEXT PRIMARY KEY, row_count INTEGER NOT NULL, source_artifact TEXT NOT NULL) STRICT;
    CREATE TABLE research_limitations (code TEXT PRIMARY KEY, description TEXT NOT NULL) STRICT;
    CREATE TABLE questions (
      question_id TEXT PRIMARY KEY, prompt TEXT NOT NULL, prompt_normalized TEXT NOT NULL,
      source_layer TEXT NOT NULL DEFAULT '', source_subcat TEXT NOT NULL DEFAULT '',
      citation_record_count INTEGER NOT NULL DEFAULT 0, platform_count INTEGER NOT NULL DEFAULT 0,
      source_count INTEGER NOT NULL DEFAULT 0
    ) STRICT;
    CREATE TABLE question_labels (question_id TEXT NOT NULL, label_dimension TEXT NOT NULL, label_value TEXT NOT NULL, label_cn TEXT NOT NULL, confidence REAL, label_source TEXT, taxonomy_version TEXT, source_layer TEXT, source_subcat TEXT);
    CREATE TABLE ai_platforms (
      platform_code TEXT PRIMARY KEY, platform_name_cn TEXT NOT NULL, product_family TEXT NOT NULL DEFAULT '',
      terminal TEXT NOT NULL DEFAULT '', company_ecosystem TEXT NOT NULL DEFAULT '', mapping_status TEXT NOT NULL DEFAULT ''
    ) STRICT;
    CREATE TABLE sources (
      source_id TEXT PRIMARY KEY, domain TEXT NOT NULL DEFAULT '', source_display_name TEXT NOT NULL DEFAULT '',
      source_category_l1 TEXT NOT NULL DEFAULT '', source_category_l1_cn TEXT NOT NULL DEFAULT '',
      source_type TEXT NOT NULL DEFAULT '', source_type_cn TEXT NOT NULL DEFAULT '', ecosystem TEXT NOT NULL DEFAULT '',
      classification_status TEXT NOT NULL DEFAULT ''
    ) STRICT;
    CREATE TABLE pages (
      page_id TEXT PRIMARY KEY, source_id TEXT, canonical_url TEXT NOT NULL DEFAULT '', page_title TEXT NOT NULL DEFAULT '',
      source_display_name TEXT NOT NULL DEFAULT '', representative_published_date TEXT
    ) STRICT;
    CREATE TABLE citation_observations (
      citation_id TEXT PRIMARY KEY, question_id TEXT NOT NULL, platform_code TEXT, page_id TEXT, source_id TEXT,
      canonical_url TEXT NOT NULL DEFAULT '', quote_title TEXT NOT NULL DEFAULT '', site_name_raw TEXT NOT NULL DEFAULT '',
      snippet TEXT NOT NULL DEFAULT '', domain_normalized TEXT NOT NULL DEFAULT '', source_layer TEXT NOT NULL DEFAULT '',
      source_subcat TEXT NOT NULL DEFAULT '', record_hash TEXT NOT NULL DEFAULT '', occurrence_count INTEGER NOT NULL DEFAULT 1,
      is_preferred_exact_record INTEGER NOT NULL DEFAULT 1 CHECK (is_preferred_exact_record IN (0, 1)),
      availability_flags TEXT NOT NULL DEFAULT '', quality_flags TEXT NOT NULL DEFAULT '', release_date TEXT NOT NULL
    ) STRICT;
    CREATE INDEX citations_question_idx ON citation_observations (question_id, is_preferred_exact_record);
  `);
  const metadata = {
    schema_version: 1,
    package_id: "geo-citation-lab",
    dataset_version: "2.0.1",
    release_date: "2026-07-14",
    source_commit: CITATION_RESEARCH_DEFAULTS.sourceCommit,
    source_repository: CITATION_RESEARCH_DEFAULTS.sourceRepository,
    source_data_url: CITATION_RESEARCH_DEFAULTS.sourceDataUrl,
    deterministic_build: "true"
  };
  const insertMetadata = db.prepare("INSERT INTO metadata (key, value) VALUES (?, ?)");
  for (const [key, value] of Object.entries(metadata)) insertMetadata.run(key, JSON.stringify(value));
  db.prepare("INSERT INTO source_artifacts VALUES (?, ?, ?, ?, ?)").run("duckdb", "data/catalog/cn_geo.duckdb", 42000000, 40000000, "a".repeat(64));
  db.prepare("INSERT INTO source_artifacts VALUES (?, ?, ?, ?, ?)").run("parquet", "data/curated/citation_observations/release_date=2026-07-14/part-0001.parquet", 84000000, 80000000, "b".repeat(64));
  db.prepare("INSERT INTO source_artifacts VALUES (?, ?, ?, ?, ?)").run("manifest", "data/manifest.json", 24362, 16000, "c".repeat(64));
  db.prepare("INSERT INTO research_limitations VALUES (?, ?)").run("NOT_REAL_TIME_CUSTOMER_MONITORING", "Historical research only.");
  const insertQuestion = db.prepare("INSERT INTO questions VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
  insertQuestion.run("q-robot-select", "制造企业选择工业机器人时要比较哪些参数？", "制造企业选择工业机器人时要比较哪些参数？", "购买决策", "选型类", 3, 2, 2);
  insertQuestion.run("q-robot-maintain", "工业机器人后期维护成本包括哪些？", "工业机器人后期维护成本包括哪些？", "使用阶段", "成本类", 1, 1, 1);
  insertQuestion.run("q-beauty", "家用美容仪应该怎么选？", "家用美容仪应该怎么选？", "购买决策", "选型类", 1, 1, 1);
  const insertLabel = db.prepare("INSERT INTO question_labels VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
  insertLabel.run("q-robot-select", "query_intent", "selection", "选型类", 1, "fixture", "1", "购买决策", "选型类");
  insertLabel.run("q-robot-select", "topic", "procurement", "采购意图 参数比较", 1, "fixture", "1", "购买决策", "选型类");
  insertLabel.run("q-robot-maintain", "query_intent", "cost", "维护成本 售后", 1, "fixture", "1", "使用阶段", "成本类");
  insertLabel.run("q-beauty", "query_intent", "selection", "美容仪 护肤", 1, "fixture", "1", "购买决策", "选型类");
  db.prepare("INSERT INTO ai_platforms VALUES (?, ?, ?, ?, ?, ?)").run("P1", "平台一", "测试产品", "web", "测试生态", "confirmed");
  db.prepare("INSERT INTO ai_platforms VALUES (?, ?, ?, ?, ?, ?)").run("P2", "平台二", "测试产品", "app", "测试生态", "confirmed");
  db.prepare("INSERT INTO sources VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run("S1", "manufacturer.example", "制造商官网", "official", "官方网站", "official_site", "官方网站", "enterprise", "curated");
  db.prepare("INSERT INTO sources VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run("S2", "media.example", "行业媒体", "media", "新闻媒体", "industry_media", "行业媒体", "media", "curated");
  db.prepare("INSERT INTO pages VALUES (?, ?, ?, ?, ?, ?)").run("PAGE1", "S1", "https://manufacturer.example/robot-parameters", "工业机器人选型参数", "制造商官网", "2026-01-01");
  db.prepare("INSERT INTO pages VALUES (?, ?, ?, ?, ?, ?)").run("PAGE2", "S2", "https://media.example/robot-buying", "机器人采购指南", "行业媒体", "2026-02-01");
  const insertCitation = db.prepare("INSERT INTO citation_observations VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
  insertCitation.run("C1", "q-robot-select", "P1", "PAGE1", "S1", "https://manufacturer.example/robot-parameters", "工业机器人选型参数", "制造商官网", "需要比较负载、臂展和重复定位精度。", "manufacturer.example", "购买决策", "选型类", "hash-c1", 1, 1, "", "", "2026-07-14");
  insertCitation.run("C2", "q-robot-select", "P2", "PAGE2", "S2", "https://media.example/robot-buying", "机器人采购指南", "行业媒体", "还应评估交付周期和集成能力。", "media.example", "购买决策", "选型类", "hash-c2", 1, 1, "", "", "2026-07-14");
  insertCitation.run("C2-DUP", "q-robot-select", "P2", "PAGE2", "S2", "https://media.example/robot-buying", "机器人采购指南", "行业媒体", "还应评估交付周期和集成能力。", "media.example", "购买决策", "选型类", "hash-c2", 1, 0, "", "exact_duplicate", "2026-07-14");
  insertCitation.run("C3", "q-robot-maintain", "P1", "PAGE1", "S1", "https://manufacturer.example/robot-parameters", "工业机器人维护", "制造商官网", "维护成本包括备件与停机成本。", "manufacturer.example", "使用阶段", "成本类", "hash-c3", 1, 1, "", "", "2026-07-14");
  db.close();
}

function assertNoProhibitedMetrics(value, pathLabel = "result") {
  if (Array.isArray(value)) return value.forEach((item, index) => assertNoProhibitedMetrics(item, `${pathLabel}[${index}]`));
  if (!value || typeof value !== "object") return;
  for (const [key, item] of Object.entries(value)) {
    assert.doesNotMatch(key, /^(?:rank|ranking|recommendationRate|sentiment|brandRank)$/i, `prohibited metric key at ${pathLabel}.${key}`);
    assertNoProhibitedMetrics(item, `${pathLabel}.${key}`);
  }
}

try {
  createFixture();
  store = new CitationResearchStore({ databasePath });
  const health = store.health();
  assert.equal(health.ok, true);
  assert.equal(health.readOnly, true);
  assert.equal(health.datasetVersion, "2.0.1");
  assert.equal(health.counts.questions, 3);
  assert.equal(health.counts.citationObservations, 4);
  assert.equal(health.counts.preferredCitationObservations, 3);

  const matches = store.matchQuestions("制造企业采购工业机器人需要比较哪些核心参数？");
  assert.ok(matches.length >= 1);
  assert.equal(matches[0].questionId, "q-robot-select");
  assert.equal(matches[0].matchSignals.exact, false);
  assert.ok(matches[0].matchSignals.characterBigramDice > 0);

  const metadataMatches = store.matchQuestions("机器人采购选型参数比较", { minimumScore: 0.08 });
  assert.ok(metadataMatches.some((item) => item.questionId === "q-robot-select"));
  assert.ok(metadataMatches.find((item) => item.questionId === "q-robot-select").matchSignals.labelMetadataJaccard > 0);

  const first = store.analyzeQuestion("制造企业采购工业机器人需要比较哪些核心参数？", { minimumScore: 0.1 });
  const second = store.analyzeQuestion("制造企业采购工业机器人需要比较哪些核心参数？", { minimumScore: 0.1 });
  assert.equal(first.evidenceId, second.evidenceId);
  assert.ok(first.sample.citationObservationCount >= 2);
  assert.equal(first.sample.preferredExactRecordOnly, true);
  assert.ok(first.aggregations.platforms.length >= 2);
  assert.ok(first.aggregations.sourceTypes.some((item) => item.sourceType === "official_site"));
  assert.ok(first.aggregations.domains.some((item) => item.domain === "manufacturer.example"));
  assert.ok(first.aggregations.pages.every((item) => item.evidenceId && item.sourceUrl));
  assert.ok(first.aggregations.citationSamples.every((item) => item.evidenceId && item.sourceUrl));
  assert.equal(first.statisticalScope.percentagesCalculated, false);
  assert.equal(first.statisticalScope.customerPerformanceMetric, false);
  assert.ok(first.limitations.some((item) => /not rankings/i.test(item)));
  assertNoProhibitedMetrics(first);

  const adapterResult = store.search({ query: "制造企业采购工业机器人需要比较哪些核心参数？", limit: 2, minimumScore: 0.1 });
  assert.ok(adapterResult.results.length >= 1);
  assert.ok(adapterResult.results.every((item) => item.id && item.verificationStatus === "verified"));
  assert.ok(adapterResult.results.every((item) => item.provenance.datasetVersion === "2.0.1"));
  const batch = store.analyzeQuestions([
    { id: "CUSTOMER-Q1", text: "制造企业采购工业机器人需要比较哪些核心参数？" },
    { id: "CUSTOMER-Q2", text: "工业机器人后期维护成本包括哪些？" }
  ], { minimumScore: 0.1, citationLimit: 2 });
  assert.equal(batch.questionCount, 2);
  assert.equal(batch.matchedQuestionCount, 2);
  assert.ok(batch.uniqueCitationEvidenceCount >= 2);
  assertNoProhibitedMetrics(batch);

  const unmatched = store.analyzeQuestion("量子航天宠物营养完全无关的问题", { minimumScore: 0.95 });
  assert.equal(unmatched.matchedQuestions.length, 0);
  assert.equal(unmatched.sample.citationObservationCount, 0);
  assert.equal(unmatched.aggregations.citationSamples.length, 0);

  assert.throws(() => store.connection.prepare("UPDATE metadata SET value = 'x'").run(), /read-?only|readonly/i);
  if (process.env.TZ_CHECK_REAL_CITATION_RESEARCH === "1") {
    assert.ok(existsSync(CITATION_RESEARCH_DEFAULTS.databasePath), "formal citation research database must exist");
    const formal = new CitationResearchStore();
    try {
      const formalHealth = formal.health();
      assert.equal(formalHealth.counts.questions, 620);
      assert.equal(formalHealth.counts.platforms, 12);
      assert.equal(formalHealth.counts.sources, 9878);
      assert.equal(formalHealth.counts.pages, 107659);
      assert.equal(formalHealth.counts.citationObservations, 214119);
      const formalResult = formal.search({ query: "想买耐用的不锈钢锅具，苏泊尔和其他牌子应该怎么选？", limit: 5, minimumScore: 0.08 });
      assert.ok(formalResult.matchedQuestions.length >= 1);
      assert.ok(formalResult.results.length >= 1);
      assert.ok(formalResult.results.every((item) => item.verificationStatus === "verified" && item.id && item.sourceUrl));
      assertNoProhibitedMetrics(formalResult);
      assert.throws(() => formal.connection.prepare("DELETE FROM metadata").run(), /read-?only|readonly/i);
      console.log("Formal citation research database check passed");
    } finally { formal.close(); }
  }
  console.log("Citation research store check passed");
} finally {
  store?.close();
  await rm(temporaryDirectory, { recursive: true, force: true });
}
