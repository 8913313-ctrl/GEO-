import crypto from "node:crypto";
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const moduleRoot = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DATABASE_PATH = path.join(moduleRoot, "research-packages", "geo-citation-lab", "2.0.1", "derived", "citation-research.sqlite");
const EXPECTED_DATASET_VERSION = "2.0.1";
const EXPECTED_SOURCE_COMMIT = "81ba1566f70f114e9202b798f8d4525a9329ebd3";
const SOURCE_REPOSITORY = "https://github.com/yaojingang/geo-citation-lab";
const SOURCE_DATA_URL = `${SOURCE_REPOSITORY}/tree/${EXPECTED_SOURCE_COMMIT}/03-cn-geo-citation-dataset`;
const REQUIRED_TABLES = Object.freeze([
  "metadata", "source_artifacts", "table_inventory", "research_limitations",
  "questions", "question_labels", "ai_platforms", "sources", "pages", "citation_observations"
]);
const DEFAULT_LIMITATIONS = Object.freeze([
  "This is a fixed historical citation-observation dataset, not customer or real-time AI-platform monitoring.",
  "Complete answer text, reliable response identifiers, model versions and normalized collection timestamps are unavailable.",
  "Published dates describe cited pages and must not be interpreted as AI-answer collection times.",
  "Question matching is lexical and metadata-assisted; it does not prove semantic equivalence or industry coverage.",
  "Counts describe matched historical citation observations. They are not rankings, recommendation rates, sentiment scores or outcome guarantees."
]);
const DEFAULT_PLATFORM_FAMILIES = Object.freeze([
  { key: "doubao", family: "豆包", label: "豆包" },
  { key: "deepseek", family: "DeepSeek", label: "DeepSeek" },
  { key: "qwen", family: "千问", label: "千问" },
  { key: "yuanbao", family: "腾讯元宝", label: "元宝" }
]);
const CONTENT_FORMAT_LABELS = Object.freeze({ general: "其他/通用", ranking: "榜单/排名", guide: "攻略/指南", comparison: "对比/评测", unknown: "未识别" });

export class CitationResearchError extends Error {
  constructor(message, code = "CITATION_RESEARCH_ERROR", details = undefined) {
    super(message);
    this.name = "CitationResearchError";
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

function stableHash(value) { return crypto.createHash("sha256").update(String(value), "utf8").digest("hex"); }
function finiteLimit(value, fallback, maximum) { return Math.max(1, Math.min(maximum, Number(value) || fallback)); }
function parseJson(value, fallback = null) {
  try { return JSON.parse(String(value)); } catch { return fallback; }
}
function normalizeText(value) {
  return String(value || "").normalize("NFKC").toLocaleLowerCase("zh-CN")
    .replace(/[\p{P}\p{S}\p{Z}\s]+/gu, "")
    .trim();
}
function lexicalSegments(value) {
  return String(value || "").normalize("NFKC").toLocaleLowerCase("zh-CN").match(/[\p{Script=Han}]+|[a-z0-9]+/gu) || [];
}
function tokenSet(value) {
  const result = new Set();
  const chineseStops = new Set(["的", "了", "是", "在", "和", "与", "或", "及", "有", "哪", "什", "么", "如", "何", "吗", "时", "要", "可"]);
  for (const segment of lexicalSegments(value)) {
    if (/^[a-z0-9]+$/i.test(segment)) { if (segment.length > 1) result.add(segment); continue; }
    if (segment.length <= 6) result.add(segment);
    for (const character of segment) if (!chineseStops.has(character)) result.add(character);
    for (let index = 0; index < segment.length - 1; index += 1) result.add(segment.slice(index, index + 2));
  }
  return result;
}
function ngramSet(value, width) {
  const normalized = normalizeText(value); const result = new Set();
  if (normalized.length < width) { if (normalized) result.add(normalized); return result; }
  for (let index = 0; index <= normalized.length - width; index += 1) result.add(normalized.slice(index, index + width));
  return result;
}
function intersectionSize(left, right) { let count = 0; for (const item of left) if (right.has(item)) count += 1; return count; }
function jaccard(left, right) {
  if (!left.size || !right.size) return 0;
  const intersection = intersectionSize(left, right);
  return intersection / (left.size + right.size - intersection);
}
function dice(left, right) {
  if (!left.size || !right.size) return 0;
  return 2 * intersectionSize(left, right) / (left.size + right.size);
}
function roundScore(value) { return Math.round(Math.max(0, Math.min(1, value)) * 10000) / 10000; }
function roundMetric(value, digits = 1) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  const factor = 10 ** digits;
  return Math.round(number * factor) / factor;
}
function percentOf(value, total, digits = 1) {
  const denominator = Number(total);
  return denominator > 0 ? roundMetric(Number(value || 0) / denominator * 100, digits) : 0;
}
function evidenceId(prefix, ...parts) { return `${prefix}-${stableHash(parts.join("\u001f")).slice(0, 24)}`; }
function placeholders(count) { return Array.from({ length: count }, () => "?").join(", "); }
function metadataValue(row) {
  const raw = row?.value;
  try { return JSON.parse(String(raw)); }
  catch { return raw; }
}

export class CitationResearchStore {
  constructor(options = {}) {
    this.databasePath = path.resolve(options.databasePath || process.env.TZ_CITATION_RESEARCH_DB || DEFAULT_DATABASE_PATH);
    this.expectedDatasetVersion = String(options.expectedDatasetVersion || EXPECTED_DATASET_VERSION);
    this.expectedSourceCommit = String(options.expectedSourceCommit || EXPECTED_SOURCE_COMMIT);
    this.allowFixture = options.allowFixture === true;
    if (!existsSync(this.databasePath)) throw new CitationResearchError("Citation research database is not installed.", "CITATION_RESEARCH_NOT_INSTALLED", { databasePath: this.databasePath });
    const stats = statSync(this.databasePath);
    if (!stats.isFile() || stats.size < 1024) throw new CitationResearchError("Citation research database is invalid or incomplete.", "CITATION_RESEARCH_INVALID_FILE", { databasePath: this.databasePath, bytes: stats.size });
    try {
      this.connection = new DatabaseSync(this.databasePath, { readOnly: true });
      this.connection.exec("PRAGMA query_only = ON");
      this.connection.exec("PRAGMA trusted_schema = OFF");
      this.connection.exec("PRAGMA temp_store = MEMORY");
      this.connection.exec("PRAGMA cache_size = -32768");
      this.connection.exec("PRAGMA busy_timeout = 5000");
    } catch (error) {
      throw new CitationResearchError("Citation research database could not be opened read-only.", "CITATION_RESEARCH_OPEN_FAILED", { databasePath: this.databasePath, cause: error.message });
    }
    this.closed = false;
    this._metadata = this.readMetadata();
    this.validateSchema();
    this.validateProvenance();
    this._questionCache = null;
    this._platformBenchmarkCache = new Map();
  }

  readMetadata() {
    let rows;
    try { rows = this.connection.prepare("SELECT key, value FROM metadata ORDER BY key").all(); }
    catch (error) { throw new CitationResearchError("Citation research metadata table is unavailable.", "CITATION_RESEARCH_SCHEMA_INVALID", { cause: error.message }); }
    return Object.fromEntries(rows.map((row) => [String(row.key), metadataValue(row)]));
  }

  validateSchema() {
    const available = new Set(this.connection.prepare("SELECT name FROM sqlite_schema WHERE type = 'table'").all().map((row) => String(row.name)));
    const missing = REQUIRED_TABLES.filter((name) => !available.has(name));
    if (missing.length) throw new CitationResearchError("Citation research database schema is incomplete.", "CITATION_RESEARCH_SCHEMA_INVALID", { missingTables: missing });
    const integrity = this.connection.prepare("PRAGMA quick_check(1)").get()?.quick_check;
    if (integrity !== "ok") throw new CitationResearchError("Citation research database integrity check failed.", "CITATION_RESEARCH_INTEGRITY_FAILED", { integrity });
  }

  validateProvenance() {
    const datasetVersion = String(this._metadata.dataset_version || "");
    const sourceCommit = String(this._metadata.source_commit || "");
    if (datasetVersion !== this.expectedDatasetVersion) throw new CitationResearchError("Citation research dataset version does not match the pinned version.", "CITATION_RESEARCH_VERSION_MISMATCH", { expected: this.expectedDatasetVersion, actual: datasetVersion });
    if (!this.allowFixture && sourceCommit !== this.expectedSourceCommit) throw new CitationResearchError("Citation research source commit does not match the pinned commit.", "CITATION_RESEARCH_COMMIT_MISMATCH", { expected: this.expectedSourceCommit, actual: sourceCommit });
    if (!sourceCommit) throw new CitationResearchError("Citation research source commit is missing.", "CITATION_RESEARCH_PROVENANCE_MISSING");
  }

  health() {
    const counts = this.summary().counts;
    return {
      ok: true,
      state: "ready",
      readOnly: true,
      databasePath: this.databasePath,
      databaseBytes: statSync(this.databasePath).size,
      schemaVersion: Number(this._metadata.schema_version || 0),
      datasetVersion: String(this._metadata.dataset_version || ""),
      releaseDate: String(this._metadata.release_date || ""),
      sourceCommit: String(this._metadata.source_commit || ""),
      deterministicBuild: this._metadata.deterministic_build === true || this._metadata.deterministic_build === "true",
      counts
    };
  }

  summary() {
    const count = (table) => Number(this.connection.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get()?.count || 0);
    const preferred = Number(this.connection.prepare("SELECT COUNT(*) AS count FROM citation_observations WHERE is_preferred_exact_record = 1").get()?.count || 0);
    const artifacts = Object.fromEntries(this.connection.prepare("SELECT artifact_name, repository_path, size_bytes, sha256 FROM source_artifacts ORDER BY artifact_name").all().map((row) => [String(row.artifact_name), {
      repositoryPath: String(row.repository_path), sizeBytes: Number(row.size_bytes), sha256: String(row.sha256)
    }]));
    const databaseLimitations = this.connection.prepare("SELECT code, description FROM research_limitations ORDER BY code").all().map((row) => ({ code: String(row.code), description: String(row.description) }));
    return {
      package: {
        id: String(this._metadata.package_id || "geo-citation-lab"),
        datasetVersion: String(this._metadata.dataset_version || ""),
        releaseDate: String(this._metadata.release_date || ""),
        sourceCommit: String(this._metadata.source_commit || ""),
        sourceRepository: String(this._metadata.source_repository || SOURCE_REPOSITORY),
        sourceDataUrl: String(this._metadata.source_data_url || SOURCE_DATA_URL),
        upstreamDuckdbSha256: artifacts.duckdb?.sha256 || "",
        upstreamParquetSha256: artifacts.parquet?.sha256 || "",
        sourceArtifacts: artifacts
      },
      counts: {
        questions: count("questions"), platforms: count("ai_platforms"), sources: count("sources"), pages: count("pages"),
        citationObservations: count("citation_observations"), preferredCitationObservations: preferred
      },
      statisticalScope: {
        defaultObservationFilter: "is_preferred_exact_record = 1",
        unit: "historical citation observation",
        percentagesCalculated: false,
        customerPerformanceMetric: false
      },
      limitations: [...DEFAULT_LIMITATIONS],
      packageLimitations: databaseLimitations
    };
  }

  questionRows() {
    if (!this._questionCache) {
      const labelsByQuestion = new Map();
      for (const row of this.connection.prepare(`
        SELECT question_id, label_dimension, label_value, label_cn, confidence,
          label_source, taxonomy_version, source_layer, source_subcat
        FROM question_labels ORDER BY question_id, label_dimension, label_value
      `).all()) {
        const questionId = String(row.question_id); const labels = labelsByQuestion.get(questionId) || [];
        labels.push({ labelDimension: String(row.label_dimension || ""), labelValue: String(row.label_value || ""), labelCn: String(row.label_cn || ""), confidence: row.confidence == null ? null : Number(row.confidence), labelSource: String(row.label_source || ""), taxonomyVersion: String(row.taxonomy_version || ""), sourceLayer: String(row.source_layer || ""), sourceSubcat: String(row.source_subcat || "") });
        labelsByQuestion.set(questionId, labels);
      }
      this._questionCache = this.connection.prepare(`
        SELECT question_id, prompt, prompt_normalized, source_layer, source_subcat,
          citation_record_count, platform_count, source_count
        FROM questions ORDER BY question_id
      `).all().map((row) => ({
        questionId: String(row.question_id), prompt: String(row.prompt || ""), promptNormalized: String(row.prompt_normalized || row.prompt || ""),
        sourceLayer: String(row.source_layer || ""), sourceSubcat: String(row.source_subcat || ""),
        labels: labelsByQuestion.get(String(row.question_id)) || [], citationRecordCount: Number(row.citation_record_count || 0), platformCount: Number(row.platform_count || 0), sourceCount: Number(row.source_count || 0)
      }));
    }
    return this._questionCache;
  }

  matchQuestions(question, options = {}) {
    const query = String(question || "").trim();
    if (!query) throw new CitationResearchError("A customer question is required.", "CITATION_RESEARCH_QUESTION_REQUIRED");
    if (query.length > 2000) throw new CitationResearchError("Customer question exceeds 2000 characters.", "CITATION_RESEARCH_QUESTION_TOO_LONG");
    const limit = finiteLimit(options.limit, 8, 50);
    const minimumScore = Math.max(0, Math.min(1, Number(options.minimumScore ?? 0.12)));
    const queryNormalized = normalizeText(query); const queryTokens = tokenSet(query);
    const queryBi = ngramSet(query, 2); const queryTri = ngramSet(query, 3);
    return this.questionRows().map((candidate) => {
      const prompt = candidate.promptNormalized || candidate.prompt;
      const metadata = [candidate.sourceLayer, candidate.sourceSubcat, ...(Array.isArray(candidate.labels) ? candidate.labels.map((item) => typeof item === "string" ? item : `${item?.labelDimension || item?.dimension || ""} ${item?.labelValue || item?.value || ""} ${item?.labelCn || ""} ${item?.sourceLayer || ""} ${item?.sourceSubcat || ""}`) : [])].join(" ");
      const promptTokens = tokenSet(prompt); const metadataTokens = tokenSet(metadata);
      const tokenScore = jaccard(queryTokens, promptTokens);
      const bigramScore = dice(queryBi, ngramSet(prompt, 2));
      const trigramScore = dice(queryTri, ngramSet(prompt, 3));
      const metadataScore = jaccard(queryTokens, metadataTokens);
      const promptNormalized = normalizeText(prompt);
      const containment = queryNormalized && promptNormalized && (queryNormalized.includes(promptNormalized) || promptNormalized.includes(queryNormalized)) ? 1 : 0;
      const exact = queryNormalized === promptNormalized ? 1 : 0;
      const score = exact ? 1 : roundScore(tokenScore * 0.30 + bigramScore * 0.42 + trigramScore * 0.13 + metadataScore * 0.10 + containment * 0.05);
      return {
        evidenceId: evidenceId("CLQ", this.expectedDatasetVersion, candidate.questionId),
        questionId: candidate.questionId, prompt: candidate.prompt, score,
        matchSignals: { exact: Boolean(exact), tokenJaccard: roundScore(tokenScore), characterBigramDice: roundScore(bigramScore), characterTrigramDice: roundScore(trigramScore), labelMetadataJaccard: roundScore(metadataScore), containment: Boolean(containment) },
        labels: candidate.labels, sourceLayer: candidate.sourceLayer, sourceSubcat: candidate.sourceSubcat,
        declaredCitationRecordCount: candidate.citationRecordCount, declaredPlatformCount: candidate.platformCount, declaredSourceCount: candidate.sourceCount,
        sourceUrl: SOURCE_DATA_URL
      };
    }).filter((item) => item.score >= minimumScore)
      .sort((left, right) => right.score - left.score || left.questionId.localeCompare(right.questionId))
      .slice(0, limit);
  }

  availableIndustryCohorts() {
    return this.connection.prepare(`
      SELECT label_value AS key, label_cn AS label, COUNT(DISTINCT question_id) AS question_count
      FROM question_labels
      WHERE label_dimension = ?
      GROUP BY label_value, label_cn
      ORDER BY label_cn, label_value
    `).all("industry").map((row) => ({
      key: String(row.key || ""),
      label: String(row.label || row.key || ""),
      questionCount: Number(row.question_count || 0)
    }));
  }

  buildResearchCohort(options = {}) {
    if (!options || typeof options !== "object" || Array.isArray(options)) {
      throw new CitationResearchError("Research cohort options must be an object.", "CITATION_RESEARCH_COHORT_OPTIONS_INVALID");
    }
    const scopeMode = String(options.scopeMode || "auto").trim().toLowerCase();
    const allowedScopeModes = new Set(["auto", "global_baseline", "direct_industry"]);
    if (!allowedScopeModes.has(scopeMode)) {
      throw new CitationResearchError("scopeMode must be auto, global_baseline or direct_industry.", "CITATION_RESEARCH_SCOPE_MODE_INVALID", { scopeMode });
    }
    if (scopeMode !== "global_baseline" && options.questionIds != null && !Array.isArray(options.questionIds)) {
      throw new CitationResearchError("questionIds must be an array.", "CITATION_RESEARCH_QUESTION_IDS_INVALID");
    }
    if (scopeMode !== "global_baseline" && options.representativeQuestions != null && !Array.isArray(options.representativeQuestions)) {
      throw new CitationResearchError("representativeQuestions must be an array.", "CITATION_RESEARCH_REPRESENTATIVE_QUESTIONS_INVALID");
    }

    const source = this.summary();
    const questions = this.questionRows();
    const questionById = new Map(questions.map((item) => [item.questionId, item]));
    const availableIndustryCohorts = this.availableIndustryCohorts();
    const ignoredSelectorInputsProvided = scopeMode === "global_baseline" && Boolean(
      options.industry || options.industryKey || options.industryLabel || options.questionIds != null || options.representativeQuestions != null
    );
    const requestedIndustry = scopeMode === "global_baseline" ? "" : String(options.industry?.key || options.industry?.label || options.industry || options.industryKey || options.industryLabel || "").trim();
    const requestedQuestionIds = scopeMode === "global_baseline" ? [] : [...new Set((options.questionIds || []).map((item) => String(item || "").trim()).filter(Boolean))].slice(0, 2000);
    const representativeQuestions = (scopeMode === "global_baseline" ? [] : options.representativeQuestions || []).slice(0, 50).map((item, index) => ({
      id: typeof item === "string" ? `RQ-${index + 1}` : String(item?.id || `RQ-${index + 1}`),
      text: typeof item === "string" ? item.trim() : String(item?.text || item?.question || item?.title || "").trim()
    })).filter((item) => item.text);
    const selectorRequested = scopeMode === "auto" && Boolean(requestedQuestionIds.length || requestedIndustry || representativeQuestions.length);
    const rejectedQuestionIds = requestedQuestionIds.filter((questionId) => !questionById.has(questionId));
    const selectionWarnings = [];
    const selectionAttempts = [];
    const representativeMatches = [];
    let selectedIds = [];
    let mode = "global_baseline";
    let basis = scopeMode === "global_baseline"
      ? "scopeMode=global_baseline explicitly requires the complete Citation Lab question collection; industry, question IDs and representative questions are ignored."
      : "No cohort selector was supplied; the complete question collection is used as the global baseline.";
    let resolvedIndustry = null;

    if (scopeMode === "global_baseline") {
      selectionAttempts.push({ selector: "scopeMode", requested: "global_baseline", matchedCount: questions.length });
      if (ignoredSelectorInputsProvided) {
        selectionWarnings.push("Cohort selectors were ignored because scopeMode=global_baseline explicitly requires the full-dataset baseline.");
      }
    }

    if (scopeMode === "auto" && requestedQuestionIds.length) {
      selectedIds = requestedQuestionIds.filter((questionId) => questionById.has(questionId));
      selectionAttempts.push({ selector: "questionIds", requestedCount: requestedQuestionIds.length, matchedCount: selectedIds.length });
      if (rejectedQuestionIds.length) selectionWarnings.push(`${rejectedQuestionIds.length} requested question ID(s) do not exist in this dataset version.`);
      if (selectedIds.length) {
        mode = "explicit_question_ids";
        basis = "Exact question IDs supplied by the caller and verified against the pinned Citation Lab question table.";
      }
    }

    if (scopeMode !== "global_baseline" && !selectedIds.length && requestedIndustry) {
      const normalizedIndustry = normalizeText(requestedIndustry);
      resolvedIndustry = availableIndustryCohorts.find((item) => normalizeText(item.key) === normalizedIndustry || normalizeText(item.label) === normalizedIndustry) || null;
      if (resolvedIndustry) {
        const industryRows = this.connection.prepare(`
          SELECT DISTINCT question_id
          FROM question_labels
          WHERE label_dimension = ? AND (label_value = ? OR label_cn = ?)
          ORDER BY question_id
        `).all("industry", resolvedIndustry.key, resolvedIndustry.label);
        selectedIds = industryRows.map((row) => String(row.question_id)).filter((questionId) => questionById.has(questionId));
      }
      selectionAttempts.push({
        selector: "industry",
        requested: requestedIndustry,
        resolvedKey: resolvedIndustry?.key || null,
        resolvedLabel: resolvedIndustry?.label || null,
        matchedCount: selectedIds.length
      });
      if (selectedIds.length) {
        mode = "industry_label";
        basis = `Exact question_labels industry cohort: ${resolvedIndustry.label} (${resolvedIndustry.key}).`;
      } else {
        resolvedIndustry = null;
        selectionWarnings.push(`No exact Citation Lab industry label matched “${requestedIndustry}”; it is not reported as a measured industry cohort.`);
      }
    }

    if (scopeMode === "direct_industry" && !requestedIndustry) {
      throw new CitationResearchError("scopeMode=direct_industry requires an exact industry label.", "CITATION_RESEARCH_DIRECT_INDUSTRY_REQUIRED", {
        availableIndustryCohorts
      });
    }
    if (scopeMode === "direct_industry" && !selectedIds.length) {
      throw new CitationResearchError("The requested industry is not an exact Citation Lab industry cohort.", "CITATION_RESEARCH_DIRECT_INDUSTRY_NOT_AVAILABLE", {
        requestedIndustry,
        availableIndustryCohorts
      });
    }
    if (scopeMode === "direct_industry" && (requestedQuestionIds.length || representativeQuestions.length)) {
      selectionWarnings.push("questionIds and representativeQuestions were ignored because scopeMode=direct_industry only permits an exact industry-label cohort.");
    }

    if (scopeMode === "auto" && !selectedIds.length && representativeQuestions.length) {
      const matchLimit = finiteLimit(options.matchLimitPerQuestion ?? options.matchLimit, 5, 20);
      const minimumScore = Math.max(0, Math.min(1, Number(options.minimumScore ?? 0.12)));
      const matchedIds = new Set();
      for (const representative of representativeQuestions) {
        const matches = this.matchQuestions(representative.text, { limit: matchLimit, minimumScore });
        for (const match of matches) matchedIds.add(match.questionId);
        representativeMatches.push({ ...representative, matchCount: matches.length, matches });
      }
      selectedIds = [...matchedIds].sort((left, right) => left.localeCompare(right));
      selectionAttempts.push({ selector: "representativeQuestions", requestedCount: representativeQuestions.length, matchedCount: selectedIds.length, minimumScore, matchLimitPerQuestion: matchLimit });
      if (selectedIds.length) {
        mode = "matched_representative_questions";
        basis = "Transparent lexical and metadata-assisted matches produced by matchQuestions for the supplied representative question set.";
      } else {
        selectionWarnings.push("No representative question produced a valid Citation Lab match at the requested threshold.");
      }
    }

    const globalFallbackApplied = scopeMode === "auto" && !selectedIds.length && selectorRequested;
    if (!selectedIds.length) {
      selectedIds = questions.map((item) => item.questionId);
      mode = "global_baseline";
      basis = globalFallbackApplied
        ? "No requested selector produced a valid cohort; the complete Citation Lab question collection is explicitly used as a global fallback."
        : basis;
    }

    const selectedQuestions = selectedIds.map((questionId) => questionById.get(questionId)).filter(Boolean).map((question) => ({
      evidenceId: evidenceId("CLQ", source.package.datasetVersion, question.questionId),
      questionId: question.questionId,
      prompt: question.prompt,
      sourceLayer: question.sourceLayer,
      sourceSubcat: question.sourceSubcat,
      labels: question.labels,
      sourceUrl: source.package.sourceDataUrl
    }));
    const cohortEvidenceId = evidenceId(
      "CLH",
      source.package.datasetVersion,
      source.package.sourceCommit,
      scopeMode,
      mode,
      scopeMode === "global_baseline" ? "" : requestedIndustry,
      selectedIds.join(",")
    );
    return {
      evidenceId: cohortEvidenceId,
      cohortVersion: "citation-research-cohort-v1",
      scopeMode,
      mode,
      basis,
      selectorPrecedence: scopeMode === "global_baseline"
        ? ["globalBaseline"]
        : scopeMode === "direct_industry"
          ? ["industry"]
          : ["questionIds", "industry", "representativeQuestions", "globalBaseline"],
      requested: {
        scopeMode,
        industry: requestedIndustry || null,
        questionIds: requestedQuestionIds,
        representativeQuestions
      },
      resolvedIndustry,
      directIndustryCohortApplied: mode === "industry_label",
      inferredIndustryCohort: false,
      globalFallbackApplied,
      fallbackReason: globalFallbackApplied ? selectionWarnings.join(" ") || "No valid cohort selector match." : null,
      rejectedQuestionIds,
      selectionAttempts,
      selectionWarnings,
      representativeMatches,
      questionCount: selectedQuestions.length,
      questionIds: selectedQuestions.map((item) => item.questionId),
      questions: selectedQuestions,
      questionListTruncated: false,
      availableIndustryCohorts,
      source: { ...source.package, sourceUrl: source.package.sourceDataUrl },
      statisticalScope: {
        sampleUnit: "one Citation Lab research question",
        requestedScopeMode: scopeMode,
        selectionMode: mode,
        deterministic: true,
        industryInferencePerformed: false
      }
    };
  }

  analyzeQuestionSet(options = {}) {
    if (!options || typeof options !== "object" || Array.isArray(options)) {
      throw new CitationResearchError("Question-set analysis options must be an object.", "CITATION_RESEARCH_QUESTION_SET_OPTIONS_INVALID");
    }
    const requestedFamilies = Array.isArray(options.platformFamilies)
      ? options.platformFamilies.map((item) => String(item || "").trim()).filter(Boolean)
      : [];
    const specs = DEFAULT_PLATFORM_FAMILIES.filter((item) => !requestedFamilies.length || requestedFamilies.includes(item.family) || requestedFamilies.includes(item.key) || requestedFamilies.includes(item.label));
    if (!specs.length) throw new CitationResearchError("No supported platform family was selected.", "CITATION_RESEARCH_PLATFORM_FAMILY_INVALID", { requestedFamilies });
    const cohort = this.buildResearchCohort(options);
    if (!cohort.questionIds.length) throw new CitationResearchError("The resolved Citation Lab cohort is empty.", "CITATION_RESEARCH_COHORT_EMPTY");

    const preferredExact = options.preferredExact !== false;
    const families = specs.map((item) => item.family);
    const whereParts = [
      `p.product_family IN (${placeholders(families.length)})`,
      `c.question_id IN (${placeholders(cohort.questionIds.length)})`
    ];
    const parameters = [...families, ...cohort.questionIds];
    if (preferredExact) {
      whereParts.push("c.is_preferred_exact_record = ?");
      parameters.push(1);
    }
    const where = whereParts.join(" AND ");
    const hasPageFeatures = Boolean(this.connection.prepare("SELECT 1 AS found FROM sqlite_schema WHERE type = ? AND name = ?").get("table", "page_features"));
    const hasQuotePosition = Boolean(this.connection.prepare("SELECT 1 AS found FROM pragma_table_info(?) WHERE name = ?").get("citation_observations", "quote_position_normalized"));
    const positionExpression = hasQuotePosition ? "c.quote_position_normalized" : "NULL";
    const pageFeatureJoin = hasPageFeatures ? "LEFT JOIN page_features f ON f.page_id = c.page_id" : "";
    const contentFormatExpression = hasPageFeatures ? "COALESCE(NULLIF(f.content_format_hint, ''), 'unknown')" : "'unknown'";

    const platformRows = this.connection.prepare(`
      SELECT p.product_family AS family,
        GROUP_CONCAT(DISTINCT p.platform_code) AS platform_codes,
        COUNT(*) AS citation_observation_count,
        SUM(CASE WHEN c.is_preferred_exact_record = 1 THEN 1 ELSE 0 END) AS preferred_citation_observation_count,
        COUNT(DISTINCT c.question_id) AS question_count,
        COUNT(DISTINCT c.source_id) AS source_count,
        COUNT(DISTINCT c.page_id) AS page_count,
        COUNT(DISTINCT COALESCE(NULLIF(c.domain_normalized, ''), NULLIF(s.domain, ''))) AS domain_count,
        AVG(${positionExpression}) AS average_quote_position,
        COUNT(${positionExpression}) AS positioned_citation_count,
        AVG(LENGTH(NULLIF(c.snippet, ''))) AS average_snippet_length
      FROM citation_observations c
      JOIN ai_platforms p ON p.platform_code = c.platform_code
      LEFT JOIN sources s ON s.source_id = c.source_id
      WHERE ${where}
      GROUP BY p.product_family
    `).all(...parameters);

    const groupedQuery = (keyExpression, labelExpression, joins = "") => this.connection.prepare(`
      SELECT p.product_family AS family, ${keyExpression} AS key, ${labelExpression} AS label,
        COUNT(*) AS citation_observation_count, COUNT(DISTINCT c.question_id) AS question_count
      FROM citation_observations c
      JOIN ai_platforms p ON p.platform_code = c.platform_code
      LEFT JOIN sources s ON s.source_id = c.source_id
      ${joins}
      WHERE ${where}
      GROUP BY p.product_family, key, label
      ORDER BY p.product_family, citation_observation_count DESC, key
    `).all(...parameters);
    const categoryRows = groupedQuery(
      "COALESCE(NULLIF(s.source_category_l1, ''), 'unclassified')",
      "COALESCE(NULLIF(s.source_category_l1_cn, ''), NULLIF(s.source_category_l1, ''), '未分类')"
    );
    const typeRows = groupedQuery(
      "COALESCE(NULLIF(s.source_type, ''), 'unclassified')",
      "COALESCE(NULLIF(s.source_type_cn, ''), NULLIF(s.source_type, ''), '未分类')"
    );
    const ecosystemRows = groupedQuery(
      "COALESCE(NULLIF(s.ecosystem, ''), 'unclassified')",
      "COALESCE(NULLIF(s.ecosystem, ''), '未分类')"
    );
    const formatRows = groupedQuery(contentFormatExpression, contentFormatExpression, pageFeatureJoin).map((row) => ({
      ...row,
      label: CONTENT_FORMAT_LABELS[String(row.key)] || String(row.label || row.key || "未识别")
    }));
    const domainRows = this.connection.prepare(`
      SELECT p.product_family AS family,
        COALESCE(NULLIF(c.domain_normalized, ''), NULLIF(s.domain, '')) AS domain,
        MAX(COALESCE(NULLIF(s.source_display_name, ''), NULLIF(c.site_name_raw, ''), '')) AS source_name,
        COUNT(*) AS citation_observation_count,
        COUNT(DISTINCT c.question_id) AS question_count,
        COUNT(DISTINCT c.page_id) AS page_count
      FROM citation_observations c
      JOIN ai_platforms p ON p.platform_code = c.platform_code
      LEFT JOIN sources s ON s.source_id = c.source_id
      WHERE ${where}
        AND LENGTH(TRIM(COALESCE(NULLIF(c.domain_normalized, ''), NULLIF(s.domain, ''), ''))) > 0
      GROUP BY p.product_family, domain
      ORDER BY p.product_family, citation_observation_count DESC, domain
    `).all(...parameters);

    const groupRows = (rows) => {
      const groups = new Map(families.map((family) => [family, []]));
      for (const row of rows) groups.get(String(row.family))?.push({
        key: String(row.key || "unknown"),
        label: String(row.label || row.key || "未分类"),
        citationObservationCount: Number(row.citation_observation_count || 0),
        questionCount: Number(row.question_count || 0)
      });
      return groups;
    };
    const categoriesByFamily = groupRows(categoryRows);
    const typesByFamily = groupRows(typeRows);
    const ecosystemsByFamily = groupRows(ecosystemRows);
    const formatsByFamily = groupRows(formatRows);
    const domainsByFamily = new Map(families.map((family) => [family, []]));
    for (const row of domainRows) domainsByFamily.get(String(row.family))?.push({
      domain: String(row.domain || ""),
      sourceName: String(row.source_name || ""),
      citationObservationCount: Number(row.citation_observation_count || 0),
      questionCount: Number(row.question_count || 0),
      pageCount: Number(row.page_count || 0)
    });
    const platformByFamily = new Map(platformRows.map((row) => [String(row.family), row]));
    const withShares = (items, total, limit) => (items || []).slice(0, limit).map((item) => ({
      ...item,
      sharePct: percentOf(item.citationObservationCount, total)
    }));
    const platforms = specs.map((spec) => {
      const row = platformByFamily.get(spec.family) || {};
      const total = Number(row.citation_observation_count || 0);
      return {
        key: spec.key,
        family: spec.family,
        label: spec.label,
        platformCodes: String(row.platform_codes || "").split(",").filter(Boolean).sort(),
        citationObservationCount: total,
        preferredCitationObservationCount: Number(row.preferred_citation_observation_count || 0),
        questionCount: Number(row.question_count || 0),
        cohortQuestionCount: cohort.questionCount,
        questionCoveragePct: percentOf(row.question_count, cohort.questionCount),
        citationsPerObservedQuestion: Number(row.question_count || 0) ? roundMetric(total / Number(row.question_count), 1) : null,
        sourceCount: Number(row.source_count || 0),
        pageCount: Number(row.page_count || 0),
        domainCount: Number(row.domain_count || 0),
        averageQuotePosition: roundMetric(row.average_quote_position, 1),
        positionedCitationCount: Number(row.positioned_citation_count || 0),
        averageSnippetLength: roundMetric(row.average_snippet_length, 0),
        sourceCategories: withShares(categoriesByFamily.get(spec.family), total, finiteLimit(options.sourceCategoryLimit, 12, 50)),
        sourceTypes: withShares(typesByFamily.get(spec.family), total, finiteLimit(options.sourceTypeLimit, 16, 50)),
        ecosystems: withShares(ecosystemsByFamily.get(spec.family), total, finiteLimit(options.ecosystemLimit, 12, 50)),
        contentFormats: withShares(formatsByFamily.get(spec.family), total, finiteLimit(options.contentFormatLimit, 10, 50)),
        topDomains: withShares(domainsByFamily.get(spec.family), total, finiteLimit(options.domainLimit, 20, 100))
      };
    });

    const citationLimit = finiteLimit(options.citationLimit, 24, 200);
    const citationSamples = this.connection.prepare(`
      SELECT c.citation_id AS citationId, c.record_hash AS recordHash,
        c.question_id AS questionId, q.prompt AS question,
        p.product_family AS platformFamily, c.platform_code AS platformCode,
        c.source_id AS sourceId, c.page_id AS pageId,
        COALESCE(NULLIF(c.quote_title, ''), NULLIF(pg.page_title, ''), '') AS title,
        COALESCE(NULLIF(c.canonical_url, ''), NULLIF(pg.canonical_url, '')) AS url,
        COALESCE(NULLIF(c.domain_normalized, ''), NULLIF(s.domain, '')) AS domain,
        c.snippet AS snippet
      FROM citation_observations c
      JOIN questions q ON q.question_id = c.question_id
      JOIN ai_platforms p ON p.platform_code = c.platform_code
      LEFT JOIN sources s ON s.source_id = c.source_id
      LEFT JOIN pages pg ON pg.page_id = c.page_id
      WHERE ${where}
      ORDER BY p.product_family, c.question_id, c.citation_id
      LIMIT ?
    `).all(...parameters, citationLimit).map((row) => ({
      ...row,
      evidenceId: evidenceId("CLC", cohort.source.datasetVersion, row.citationId, row.recordHash),
      sourceUrl: row.url || cohort.source.sourceDataUrl
    }));

    const totalCitationObservationCount = platforms.reduce((sum, item) => sum + item.citationObservationCount, 0);
    const analysisEvidenceId = evidenceId(
      "CLA",
      cohort.source.datasetVersion,
      cohort.source.sourceCommit,
      cohort.evidenceId,
      specs.map((item) => item.family).join("|"),
      preferredExact ? "preferred_exact" : "all_observations"
    );
    return {
      evidenceId: analysisEvidenceId,
      factPackVersion: "citation-question-set-preference-v1",
      title: cohort.mode === "global_baseline" ? "Citation Lab 四平台全库引用偏好基线" : "Citation Lab 问题样本四平台引用偏好分析",
      source: cohort.source,
      datasetVersion: cohort.source.datasetVersion,
      sourceCommit: cohort.source.sourceCommit,
      cohort,
      platforms,
      citationSamples,
      evidence: {
        analysisEvidenceId,
        cohortEvidenceId: cohort.evidenceId,
        questionEvidenceIds: cohort.questions.map((item) => item.evidenceId),
        citationEvidenceIds: citationSamples.map((item) => item.evidenceId),
        datasetVersion: cohort.source.datasetVersion,
        sourceCommit: cohort.source.sourceCommit,
        sourceDataUrl: cohort.source.sourceDataUrl
      },
      sample: {
        mode: cohort.mode,
        basis: cohort.basis,
        questionCount: cohort.questionCount,
        citationObservationCount: totalCitationObservationCount,
        targetPlatformFamilies: specs.map((item) => item.label),
        preferredExactRecordOnly: preferredExact,
        globalFallbackApplied: cohort.globalFallbackApplied,
        directIndustryCohortApplied: cohort.directIndustryCohortApplied
      },
      statisticalScope: {
        observationFilter: preferredExact ? "is_preferred_exact_record = 1" : "all citation_observations rows",
        aggregationUnit: "one historical citation observation row",
        platformGrouping: "web and mobile terminals are merged by ai_platforms.product_family",
        percentagesCalculated: true,
        customerPerformanceMetric: false,
        causalInference: false
      },
      limitations: [
        ...DEFAULT_LIMITATIONS,
        cohort.mode === "matched_representative_questions"
          ? "This is a transparent matched-question sample, not a directly labelled industry cohort."
          : cohort.mode === "global_baseline"
            ? "This result is a global historical baseline and must not be described as a target-industry measurement."
            : "The result applies only to the explicitly selected Citation Lab question cohort.",
        "Platform differences are descriptive associations in the selected historical sample and do not establish causal preference or future citation probability."
      ]
    };
  }

  analyzeQuestion(question, options = {}) {
    const matches = this.matchQuestions(question, { limit: options.matchLimit, minimumScore: options.minimumScore });
    const normalizedQuery = normalizeText(question);
    const ids = matches.map((item) => item.questionId);
    const source = this.summary();
    const baseResult = {
      evidenceId: evidenceId("CLR", source.package.datasetVersion, source.package.sourceCommit, normalizedQuery, ids.join(","), "preferred_exact_record"),
      query: String(question || "").trim(), matchedQuestions: matches,
      source: { ...source.package, sourceUrl: source.package.sourceDataUrl },
      sample: { matchedQuestionCount: ids.length, citationObservationCount: 0, preferredExactRecordOnly: true },
      aggregations: { platforms: [], sourceTypes: [], domains: [], pages: [], citationSamples: [] },
      statisticalScope: {
        matching: "Deterministic Chinese/alphanumeric tokens plus character 2/3-grams, with question-label and taxonomy metadata.",
        observationFilter: "is_preferred_exact_record = 1",
        aggregationUnit: "one preferred historical citation observation row",
        ordering: "Counts are sorted for inspection only; no rank field or customer performance inference is produced.",
        percentagesCalculated: false, customerPerformanceMetric: false
      },
      limitations: [...DEFAULT_LIMITATIONS]
    };
    if (!ids.length) return baseResult;
    const inClause = placeholders(ids.length);
    const filter = `c.question_id IN (${inClause}) AND c.is_preferred_exact_record = 1`;
    const total = Number(this.connection.prepare(`SELECT COUNT(*) AS count FROM citation_observations c WHERE ${filter}`).get(...ids)?.count || 0);
    baseResult.sample.citationObservationCount = total;
    baseResult.aggregations.platforms = this.connection.prepare(`
      SELECT c.platform_code AS platformCode, COALESCE(p.platform_name_cn, c.platform_code) AS platformName,
        COUNT(*) AS citationObservationCount, COUNT(DISTINCT c.question_id) AS matchedQuestionCount,
        COUNT(DISTINCT c.page_id) AS pageCount, COUNT(DISTINCT c.source_id) AS sourceCount
      FROM citation_observations c LEFT JOIN ai_platforms p ON p.platform_code = c.platform_code
      WHERE ${filter} GROUP BY c.platform_code, p.platform_name_cn
      ORDER BY citationObservationCount DESC, c.platform_code LIMIT ?
    `).all(...ids, finiteLimit(options.platformLimit, 20, 100)).map((row) => ({ ...row, citationObservationCount: Number(row.citationObservationCount), matchedQuestionCount: Number(row.matchedQuestionCount), pageCount: Number(row.pageCount), sourceCount: Number(row.sourceCount) }));
    baseResult.aggregations.sourceTypes = this.connection.prepare(`
      SELECT COALESCE(NULLIF(s.source_type, ''), 'unclassified') AS sourceType,
        COALESCE(NULLIF(s.source_type_cn, ''), '未分类') AS sourceTypeLabel,
        COUNT(*) AS citationObservationCount, COUNT(DISTINCT c.question_id) AS matchedQuestionCount,
        COUNT(DISTINCT c.source_id) AS sourceCount, COUNT(DISTINCT c.page_id) AS pageCount
      FROM citation_observations c LEFT JOIN sources s ON s.source_id = c.source_id
      WHERE ${filter} GROUP BY sourceType, sourceTypeLabel
      ORDER BY citationObservationCount DESC, sourceType LIMIT ?
    `).all(...ids, finiteLimit(options.sourceTypeLimit, 30, 100)).map((row) => ({ ...row, citationObservationCount: Number(row.citationObservationCount), matchedQuestionCount: Number(row.matchedQuestionCount), sourceCount: Number(row.sourceCount), pageCount: Number(row.pageCount) }));
    baseResult.aggregations.domains = this.connection.prepare(`
      SELECT COALESCE(NULLIF(c.domain_normalized, ''), NULLIF(s.domain, ''), 'unknown') AS domain,
        COALESCE(NULLIF(s.source_display_name, ''), NULLIF(c.site_name_raw, ''), '') AS sourceName,
        COUNT(*) AS citationObservationCount, COUNT(DISTINCT c.question_id) AS matchedQuestionCount,
        COUNT(DISTINCT c.page_id) AS pageCount
      FROM citation_observations c LEFT JOIN sources s ON s.source_id = c.source_id
      WHERE ${filter} GROUP BY 1, 2
      ORDER BY citationObservationCount DESC, domain LIMIT ?
    `).all(...ids, finiteLimit(options.domainLimit, 50, 200)).map((row) => ({ ...row, citationObservationCount: Number(row.citationObservationCount), matchedQuestionCount: Number(row.matchedQuestionCount), pageCount: Number(row.pageCount) }));
    baseResult.aggregations.pages = this.connection.prepare(`
      SELECT c.page_id AS pageId, COALESCE(NULLIF(p.page_title, ''), NULLIF(c.quote_title, ''), '') AS title,
        COALESCE(NULLIF(p.canonical_url, ''), NULLIF(c.canonical_url, '')) AS url,
        COALESCE(NULLIF(c.domain_normalized, ''), NULLIF(s.domain, ''), 'unknown') AS domain,
        COALESCE(NULLIF(s.source_type, ''), 'unclassified') AS sourceType,
        COUNT(*) AS citationObservationCount, COUNT(DISTINCT c.question_id) AS matchedQuestionCount
      FROM citation_observations c LEFT JOIN pages p ON p.page_id = c.page_id LEFT JOIN sources s ON s.source_id = c.source_id
      WHERE ${filter} GROUP BY 1, 2, 3, 4, 5
      ORDER BY citationObservationCount DESC, c.page_id LIMIT ?
    `).all(...ids, finiteLimit(options.pageLimit, 50, 200)).map((row) => ({ ...row, evidenceId: evidenceId("CLP", source.package.datasetVersion, row.pageId || row.url), citationObservationCount: Number(row.citationObservationCount), matchedQuestionCount: Number(row.matchedQuestionCount), sourceUrl: row.url || source.package.sourceDataUrl }));
    baseResult.aggregations.citationSamples = this.connection.prepare(`
      SELECT c.citation_id AS citationId, c.record_hash AS recordHash, c.question_id AS questionId,
        c.platform_code AS platformCode, COALESCE(p.platform_name_cn, c.platform_code) AS platformName,
        c.source_id AS sourceId, c.page_id AS pageId, c.quote_title AS title,
        c.canonical_url AS url, c.site_name_raw AS siteName, c.domain_normalized AS domain,
        c.snippet AS snippet, c.source_layer AS sourceLayer, c.source_subcat AS sourceSubcat,
        c.release_date AS releaseDate
      FROM citation_observations c LEFT JOIN ai_platforms p ON p.platform_code = c.platform_code
      WHERE ${filter} ORDER BY c.question_id, c.citation_id LIMIT ?
    `).all(...ids, finiteLimit(options.citationLimit, 30, 200)).map((row) => ({ ...row, evidenceId: evidenceId("CLC", source.package.datasetVersion, row.citationId, row.recordHash), sourceUrl: row.url || source.package.sourceDataUrl }));
    return baseResult;
  }

  platformPreferenceBenchmark(options = {}) {
    const requestedFamilies = Array.isArray(options.platformFamilies)
      ? options.platformFamilies.map((item) => String(item || "").trim()).filter(Boolean)
      : [];
    const specs = DEFAULT_PLATFORM_FAMILIES.filter((item) => !requestedFamilies.length || requestedFamilies.includes(item.family) || requestedFamilies.includes(item.key) || requestedFamilies.includes(item.label));
    if (!specs.length) throw new CitationResearchError("No supported platform family was selected.", "CITATION_RESEARCH_PLATFORM_FAMILY_INVALID", { requestedFamilies });
    const cacheKey = specs.map((item) => item.family).join("|");
    if (this._platformBenchmarkCache.has(cacheKey)) return structuredClone(this._platformBenchmarkCache.get(cacheKey));

    const families = specs.map((item) => item.family);
    const inClause = placeholders(families.length);
    const releaseYear = String(this._metadata.release_date || "").slice(0, 4);
    const platformRows = this.connection.prepare(`
      SELECT p.product_family AS family,
        GROUP_CONCAT(DISTINCT p.platform_code) AS platform_codes,
        COUNT(*) AS citation_observation_count,
        SUM(CASE WHEN c.is_preferred_exact_record = 1 THEN 1 ELSE 0 END) AS preferred_citation_observation_count,
        COUNT(DISTINCT c.question_id) AS question_count,
        COUNT(DISTINCT c.source_id) AS source_count,
        COUNT(DISTINCT c.page_id) AS page_count,
        COUNT(DISTINCT CASE WHEN LENGTH(TRIM(COALESCE(c.domain_normalized, ''))) > 0 THEN c.domain_normalized END) AS domain_count,
        AVG(c.quote_position_normalized) AS average_quote_position,
        COUNT(c.quote_position_normalized) AS positioned_citation_count,
        AVG(LENGTH(NULLIF(c.snippet, ''))) AS average_snippet_length,
        SUM(CASE WHEN LENGTH(COALESCE(c.snippet, '')) > 500 THEN 1 ELSE 0 END) AS long_snippet_count,
        SUM(CASE WHEN c.published_date IS NULL OR LENGTH(TRIM(c.published_date)) = 0 THEN 1 ELSE 0 END) AS missing_published_date_count,
        SUM(CASE WHEN SUBSTR(c.published_date, 1, 4) = ? THEN 1 ELSE 0 END) AS release_year_published_count
      FROM citation_observations c
      JOIN ai_platforms p ON p.platform_code = c.platform_code
      WHERE p.product_family IN (${inClause})
      GROUP BY p.product_family
    `).all(releaseYear, ...families);

    const groupedRows = (select, labelKey, valueKey = "citation_observation_count") => {
      const grouped = new Map();
      for (const row of select) {
        const family = String(row.family || "");
        if (!grouped.has(family)) grouped.set(family, []);
        grouped.get(family).push({
          key: String(row.key || "unknown"),
          label: String(row[labelKey] || row.key || "未分类"),
          citationObservationCount: Number(row[valueKey] || 0)
        });
      }
      return grouped;
    };

    const categoryRows = this.connection.prepare(`
      SELECT p.product_family AS family,
        COALESCE(NULLIF(s.source_category_l1, ''), 'unclassified') AS key,
        COALESCE(NULLIF(s.source_category_l1_cn, ''), NULLIF(s.source_category_l1, ''), '未分类') AS label,
        COUNT(*) AS citation_observation_count
      FROM citation_observations c
      JOIN ai_platforms p ON p.platform_code = c.platform_code
      LEFT JOIN sources s ON s.source_id = c.source_id
      WHERE p.product_family IN (${inClause})
      GROUP BY p.product_family, key, label
      ORDER BY p.product_family, citation_observation_count DESC
    `).all(...families);
    const typeRows = this.connection.prepare(`
      SELECT p.product_family AS family,
        COALESCE(NULLIF(s.source_type, ''), 'unclassified') AS key,
        COALESCE(NULLIF(s.source_type_cn, ''), NULLIF(s.source_type, ''), '未分类') AS label,
        COUNT(*) AS citation_observation_count
      FROM citation_observations c
      JOIN ai_platforms p ON p.platform_code = c.platform_code
      LEFT JOIN sources s ON s.source_id = c.source_id
      WHERE p.product_family IN (${inClause})
      GROUP BY p.product_family, key, label
      ORDER BY p.product_family, citation_observation_count DESC
    `).all(...families);
    const ecosystemRows = this.connection.prepare(`
      SELECT p.product_family AS family,
        COALESCE(NULLIF(s.ecosystem, ''), 'unclassified') AS key,
        COALESCE(NULLIF(s.ecosystem, ''), '未分类') AS label,
        COUNT(*) AS citation_observation_count
      FROM citation_observations c
      JOIN ai_platforms p ON p.platform_code = c.platform_code
      LEFT JOIN sources s ON s.source_id = c.source_id
      WHERE p.product_family IN (${inClause})
      GROUP BY p.product_family, key, label
      ORDER BY p.product_family, citation_observation_count DESC
    `).all(...families);
    const formatRows = this.connection.prepare(`
      SELECT p.product_family AS family,
        COALESCE(NULLIF(f.content_format_hint, ''), 'unknown') AS key,
        COUNT(*) AS citation_observation_count
      FROM citation_observations c
      JOIN ai_platforms p ON p.platform_code = c.platform_code
      LEFT JOIN page_features f ON f.page_id = c.page_id
      WHERE p.product_family IN (${inClause})
      GROUP BY p.product_family, key
      ORDER BY p.product_family, citation_observation_count DESC
    `).all(...families).map((row) => ({ ...row, label: CONTENT_FORMAT_LABELS[row.key] || row.key }));
    const yearRows = this.connection.prepare(`
      SELECT p.product_family AS family,
        CASE WHEN c.published_date IS NULL OR LENGTH(TRIM(c.published_date)) = 0 THEN 'unknown' ELSE SUBSTR(c.published_date, 1, 4) END AS key,
        COUNT(*) AS citation_observation_count
      FROM citation_observations c
      JOIN ai_platforms p ON p.platform_code = c.platform_code
      WHERE p.product_family IN (${inClause})
      GROUP BY p.product_family, key
      ORDER BY p.product_family, citation_observation_count DESC
    `).all(...families).map((row) => ({ ...row, label: row.key === "unknown" ? "日期未知" : String(row.key) }));
    const domainRows = this.connection.prepare(`
      SELECT p.product_family AS family,
        COALESCE(NULLIF(c.domain_normalized, ''), NULLIF(s.domain, '')) AS domain,
        MAX(COALESCE(NULLIF(s.source_display_name, ''), NULLIF(c.site_name_raw, ''), '')) AS source_name,
        COUNT(*) AS citation_observation_count,
        COUNT(DISTINCT c.question_id) AS question_count,
        COUNT(DISTINCT c.page_id) AS page_count
      FROM citation_observations c
      JOIN ai_platforms p ON p.platform_code = c.platform_code
      LEFT JOIN sources s ON s.source_id = c.source_id
      WHERE p.product_family IN (${inClause})
        AND LENGTH(TRIM(COALESCE(NULLIF(c.domain_normalized, ''), NULLIF(s.domain, ''), ''))) > 0
      GROUP BY p.product_family, domain
      ORDER BY p.product_family, citation_observation_count DESC, domain
    `).all(...families);

    const categoryGroups = groupedRows(categoryRows, "label");
    const typeGroups = groupedRows(typeRows, "label");
    const ecosystemGroups = groupedRows(ecosystemRows, "label");
    const formatGroups = groupedRows(formatRows, "label");
    const yearGroups = groupedRows(yearRows, "label");
    const domainsByFamily = new Map(families.map((family) => [family, new Map()]));
    const domainFamilies = new Map();
    for (const row of domainRows) {
      const family = String(row.family); const domain = String(row.domain);
      domainsByFamily.get(family)?.set(domain, {
        domain,
        sourceName: String(row.source_name || ""),
        citationObservationCount: Number(row.citation_observation_count || 0),
        questionCount: Number(row.question_count || 0),
        pageCount: Number(row.page_count || 0)
      });
      if (!domainFamilies.has(domain)) domainFamilies.set(domain, new Set());
      domainFamilies.get(domain).add(family);
    }

    const platformByFamily = new Map(platformRows.map((row) => [String(row.family), row]));
    const withShares = (items, total, limit) => (items || []).slice(0, limit).map((item) => ({ ...item, sharePct: percentOf(item.citationObservationCount, total) }));
    const platforms = specs.map((spec) => {
      const row = platformByFamily.get(spec.family) || {};
      const total = Number(row.citation_observation_count || 0);
      const domainMap = domainsByFamily.get(spec.family) || new Map();
      const topDomains = [...domainMap.values()].sort((a, b) => b.citationObservationCount - a.citationObservationCount || a.domain.localeCompare(b.domain)).slice(0, 20).map((item) => ({
        ...item,
        sharePct: percentOf(item.citationObservationCount, total),
        exclusiveToPlatformFamily: domainFamilies.get(item.domain)?.size === 1
      }));
      const exclusiveDomainCount = [...domainMap.keys()].filter((domain) => domainFamilies.get(domain)?.size === 1).length;
      return {
        key: spec.key,
        family: spec.family,
        label: spec.label,
        platformCodes: String(row.platform_codes || "").split(",").filter(Boolean).sort(),
        citationObservationCount: total,
        preferredCitationObservationCount: Number(row.preferred_citation_observation_count || 0),
        questionCount: Number(row.question_count || 0),
        citationsPerQuestion: Number(row.question_count || 0) ? roundMetric(total / Number(row.question_count), 1) : null,
        sourceCount: Number(row.source_count || 0),
        pageCount: Number(row.page_count || 0),
        domainCount: Number(row.domain_count || 0),
        exclusiveDomainCount,
        exclusiveDomainSharePct: percentOf(exclusiveDomainCount, Number(row.domain_count || 0)),
        averageQuotePosition: roundMetric(row.average_quote_position, 1),
        positionedCitationCount: Number(row.positioned_citation_count || 0),
        averageSnippetLength: roundMetric(row.average_snippet_length, 0),
        longSnippetCount: Number(row.long_snippet_count || 0),
        longSnippetSharePct: percentOf(row.long_snippet_count, total),
        missingPublishedDateCount: Number(row.missing_published_date_count || 0),
        missingPublishedDateSharePct: percentOf(row.missing_published_date_count, total),
        releaseYear,
        releaseYearPublishedCount: Number(row.release_year_published_count || 0),
        releaseYearPublishedSharePct: percentOf(row.release_year_published_count, total),
        sourceCategories: withShares(categoryGroups.get(spec.family), total, 12),
        sourceTypes: withShares(typeGroups.get(spec.family), total, 16),
        ecosystems: withShares(ecosystemGroups.get(spec.family), total, 12),
        contentFormats: withShares(formatGroups.get(spec.family), total, 10),
        publicationYears: withShares(yearGroups.get(spec.family), total, 12),
        topDomains
      };
    });

    const domainOverlap = [];
    for (let leftIndex = 0; leftIndex < specs.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < specs.length; rightIndex += 1) {
        const left = domainsByFamily.get(specs[leftIndex].family) || new Map();
        const right = domainsByFamily.get(specs[rightIndex].family) || new Map();
        let sharedDomainCount = 0;
        for (const domain of left.keys()) if (right.has(domain)) sharedDomainCount += 1;
        const union = left.size + right.size - sharedDomainCount;
        domainOverlap.push({
          platformA: specs[leftIndex].label,
          platformB: specs[rightIndex].label,
          sharedDomainCount,
          jaccardPct: union ? roundMetric(sharedDomainCount / union * 100, 1) : 0
        });
      }
    }

    const labelsByQuestion = new Map(this.questionRows().map((question) => [question.questionId, new Set((question.labels || []).map((item) => `${item.labelDimension}:${item.labelValue}`))]));
    const questionCitationRows = this.connection.prepare(`
      SELECT c.question_id AS question_id, p.product_family AS family,
        COUNT(*) AS citation_observation_count,
        SUM(CASE WHEN c.is_preferred_exact_record = 1 THEN 1 ELSE 0 END) AS preferred_citation_observation_count
      FROM citation_observations c
      JOIN ai_platforms p ON p.platform_code = c.platform_code
      WHERE p.product_family IN (${inClause})
      GROUP BY c.question_id, p.product_family
    `).all(...families);
    const questionFamilyCounts = new Map();
    for (const row of questionCitationRows) questionFamilyCounts.set(`${row.question_id}\u001f${row.family}`, { raw: Number(row.citation_observation_count || 0), preferred: Number(row.preferred_citation_observation_count || 0) });
    const segmentRules = [
      { key: "comparison", label: "对比类", definition: "query_intent=comparison，或问题文本包含对比、区别、差异、相比、vs", test: (question, labels) => labels.has("query_intent:comparison") || /对比|区别|差异|相比|较之|\bvs\b/i.test(question.prompt) },
      { key: "scenario", label: "场景类", definition: "query_intent=scenario", test: (question, labels) => labels.has("query_intent:scenario") },
      { key: "ranking", label: "排行型", definition: "问题文本包含排行、排名、榜单、TOP 等明确排行表达", test: (question) => /排行|排名|榜单|top\s*\d*/i.test(question.prompt) },
      { key: "definition", label: "定义型", definition: "问题文本包含什么是、是什么、定义、概念或含义", test: (question) => /什么是|是什么|定义|概念|含义/.test(question.prompt) },
      { key: "procedural", label: "操作型", definition: "real_world_scene=procedural，或问题文本包含如何、怎么、步骤、流程、方法", test: (question, labels) => labels.has("real_world_scene:procedural") || /如何|怎么|步骤|流程|方法/.test(question.prompt) },
      { key: "high_time_sensitivity", label: "高时间敏感", definition: "time_sensitivity=high 或 real_world_scene=time_sensitive", test: (question, labels) => labels.has("time_sensitivity:high") || labels.has("real_world_scene:time_sensitive") },
      { key: "long_question", label: "长问题（>30字）", definition: "规范问题 Unicode 字符数大于 30", test: (question) => Array.from(question.prompt || "").length > 30 }
    ];
    const allQuestions = this.questionRows();
    const questionSegments = segmentRules.map((rule) => {
      const selected = allQuestions.filter((question) => rule.test(question, labelsByQuestion.get(question.questionId) || new Set()));
      return {
        key: rule.key,
        label: rule.label,
        definition: rule.definition,
        questionCount: selected.length,
        platforms: specs.map((spec) => {
          let raw = 0; let preferred = 0;
          for (const question of selected) {
            const counts = questionFamilyCounts.get(`${question.questionId}\u001f${spec.family}`);
            raw += Number(counts?.raw || 0); preferred += Number(counts?.preferred || 0);
          }
          return {
            platform: spec.label,
            citationObservationCount: raw,
            preferredCitationObservationCount: preferred,
            citationsPerQuestion: selected.length ? roundMetric(raw / selected.length, 1) : null
          };
        })
      };
    });

    const source = this.summary();
    const targetObservationCount = platforms.reduce((sum, item) => sum + item.citationObservationCount, 0);
    const targetPreferredObservationCount = platforms.reduce((sum, item) => sum + item.preferredCitationObservationCount, 0);
    const availableIndustryCohorts = this.connection.prepare(`
      SELECT label_value AS key, label_cn AS label, COUNT(DISTINCT question_id) AS question_count
      FROM question_labels WHERE label_dimension = 'industry'
      GROUP BY label_value, label_cn ORDER BY label_cn
    `).all().map((row) => ({ key: String(row.key), label: String(row.label), questionCount: Number(row.question_count || 0) }));
    const result = {
      evidenceId: evidenceId("CLB", source.package.datasetVersion, source.package.sourceCommit, cacheKey, "raw-platform-preference-v1"),
      factPackVersion: "citation-platform-preference-v1",
      title: "Citation Lab 四大平台全库引用偏好基线",
      source: { ...source.package, sourceUrl: source.package.sourceDataUrl },
      dataset: {
        ...source.counts,
        targetPlatformFamilies: specs.map((item) => item.label),
        targetPlatformCitationObservationCount: targetObservationCount,
        targetPlatformPreferredCitationObservationCount: targetPreferredObservationCount
      },
      platforms,
      domainOverlap: domainOverlap.sort((left, right) => right.sharedDomainCount - left.sharedDomainCount),
      questionSegments,
      coverage: {
        availableIndustryCohorts,
        requestedIndustryCohortApplied: false,
        globalBaselineAvailable: true,
        directQuestionMatchingRequired: false
      },
      statisticalScope: {
        primaryObservationFilter: "all citation_observations rows (raw upstream record scope)",
        comparisonObservationFilter: "is_preferred_exact_record = 1",
        aggregationUnit: "historical citation observation",
        platformGrouping: "web and mobile terminals are merged by ai_platforms.product_family",
        publicationDateMeaning: "published_date belongs to the cited page, not the AI answer collection time",
        percentagesCalculated: true,
        customerPerformanceMetric: false,
        causalInference: false
      },
      limitations: [
        ...DEFAULT_LIMITATIONS,
        "The four-platform benchmark is a global historical baseline across the dataset, not a target-industry cohort unless an explicit industry cohort is separately reported.",
        "Average snippet length, content-format share and source frequency are descriptive correlations; they do not prove that a platform reads only titles, prefers long articles, or guarantees citation.",
        "Raw upstream observation counts are retained to reproduce the public Citation Lab platform totals; preferred exact-record counts are reported separately and must not be mixed."
      ]
    };
    this._platformBenchmarkCache.set(cacheKey, result);
    return structuredClone(result);
  }

  search(request = {}) {
    const query = String(request.query || request.question?.text || request.question?.question || request.question || "").trim();
    const result = this.analyzeQuestion(query, {
      minimumScore: request.minimumScore ?? request.minScore,
      matchLimit: request.matchLimit,
      citationLimit: request.limit || request.topK,
      platformLimit: request.platformLimit,
      sourceTypeLimit: request.sourceTypeLimit,
      domainLimit: request.domainLimit,
      pageLimit: request.pageLimit
    });
    return {
      query: result.query,
      results: result.aggregations.citationSamples.map((item) => ({
        id: item.evidenceId, citationId: item.citationId, recordHash: item.recordHash,
        questionId: item.questionId, matchedResearchQuestionIds: result.matchedQuestions.map((match) => match.questionId),
        title: item.title, sourceUrl: item.sourceUrl, sourceName: item.siteName, domain: item.domain,
        platformCode: item.platformCode, platformName: item.platformName, snippet: item.snippet,
        sourceLayer: item.sourceLayer, sourceSubcat: item.sourceSubcat, releaseDate: item.releaseDate,
        verificationStatus: "verified",
        provenance: {
          datasetVersion: result.source.datasetVersion, sourceCommit: result.source.sourceCommit,
          observationFilter: result.statisticalScope.observationFilter, matching: result.statisticalScope.matching
        }
      })),
      matchedQuestions: result.matchedQuestions,
      aggregations: result.aggregations,
      source: result.source,
      statisticalScope: result.statisticalScope,
      limitations: result.limitations
    };
  }

  analyzeQuestions(questions = [], options = {}) {
    if (!Array.isArray(questions)) throw new CitationResearchError("questions must be an array.", "CITATION_RESEARCH_QUESTIONS_INVALID");
    const maximum = finiteLimit(options.maximumQuestions, 500, 500);
    const items = questions.slice(0, maximum).map((item, index) => {
      const questionId = typeof item === "string" ? `Q-${index + 1}` : String(item?.id || `Q-${index + 1}`);
      const text = typeof item === "string" ? item : String(item?.text || item?.question || item?.title || "");
      return { questionId, ...this.analyzeQuestion(text, options) };
    });
    const evidenceIds = new Set();
    for (const item of items) for (const evidence of item.aggregations.citationSamples) evidenceIds.add(evidence.evidenceId);
    return {
      evidenceId: evidenceId("CLB", this.expectedDatasetVersion, this.expectedSourceCommit, ...items.map((item) => `${item.questionId}:${item.evidenceId}`)),
      questionCount: items.length, matchedQuestionCount: items.filter((item) => item.matchedQuestions.length).length,
      uniqueCitationEvidenceCount: evidenceIds.size, items, source: this.summary().package,
      statisticalScope: { percentagesCalculated: false, customerPerformanceMetric: false },
      limitations: [...DEFAULT_LIMITATIONS]
    };
  }

  close() {
    if (this.closed) return;
    this.connection.close();
    this.closed = true;
  }
}

export const CITATION_RESEARCH_DEFAULTS = Object.freeze({
  databasePath: DEFAULT_DATABASE_PATH,
  datasetVersion: EXPECTED_DATASET_VERSION,
  sourceCommit: EXPECTED_SOURCE_COMMIT,
  sourceRepository: SOURCE_REPOSITORY,
  sourceDataUrl: SOURCE_DATA_URL,
  limitations: DEFAULT_LIMITATIONS
});

export default CitationResearchStore;
