import crypto from "node:crypto";

const MAXIMUMS = Object.freeze({
  name: 120,
  phone: 120,
  company: 240,
  service: 160,
  website: 2_000,
  message: 8_000,
  sourceUrl: 2_000,
  userAgent: 1_000
});

const UTM_KEYS = Object.freeze(["source", "medium", "campaign", "term", "content"]);
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{15,199}$/;
const CUSTOM_FIELD_KEY_PATTERN = /^[a-z][a-z0-9_-]{0,47}$/;
const BLOCKED_FIELD_PATTERN = /(?:password|passwd|pwd|密码|身份证|证件号|银行卡|信用卡|cvv|支付密码)/i;

export class PublicLeadError extends Error {
  constructor(message, status = 422, code = "SITE_LEAD_INVALID") {
    super(message);
    this.name = "PublicLeadError";
    this.status = status;
    this.code = code;
  }
}

function clean(value, maximum) {
  return String(value ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim().slice(0, maximum);
}

function required(value, field, maximum) {
  const result = clean(value, maximum);
  if (!result) throw new PublicLeadError(`${field}不能为空。`, 422, "SITE_LEAD_REQUIRED");
  return result;
}

function safeSourceUrl(value) {
  const source = clean(value, MAXIMUMS.sourceUrl);
  if (!source) return "";
  try {
    const parsed = new URL(source);
    return ["http:", "https:"].includes(parsed.protocol) && !parsed.username && !parsed.password ? parsed.href : "";
  } catch {
    return "";
  }
}

function customFieldSnapshot(payload = {}) {
  const source = payload.custom_fields && typeof payload.custom_fields === "object" && !Array.isArray(payload.custom_fields) ? payload.custom_fields : {};
  const entries = Object.entries(source);
  if (entries.length > 16) throw new PublicLeadError("表单字段数量超过限制。", 422, "SITE_LEAD_CUSTOM_FIELDS_INVALID");
  const fields = {};
  let totalBytes = 0;
  for (const [rawKey, rawValue] of entries) {
    const key = clean(rawKey, 48).toLocaleLowerCase("en-US");
    if (!CUSTOM_FIELD_KEY_PATTERN.test(key) || BLOCKED_FIELD_PATTERN.test(key)) throw new PublicLeadError("表单包含不允许的字段。", 422, "SITE_LEAD_CUSTOM_FIELDS_INVALID");
    if (rawValue !== null && typeof rawValue === "object") throw new PublicLeadError("表单字段格式无效。", 422, "SITE_LEAD_CUSTOM_FIELDS_INVALID");
    if (String(rawValue ?? "").length > 8_000) throw new PublicLeadError("表单字段内容超过允许长度。", 413, "SITE_LEAD_CUSTOM_FIELDS_TOO_LARGE");
    const value = clean(rawValue, 8_000);
    totalBytes += Buffer.byteLength(key, "utf8") + Buffer.byteLength(value, "utf8");
    if (totalBytes > 32_000) throw new PublicLeadError("表单内容超过允许大小。", 413, "SITE_LEAD_CUSTOM_FIELDS_TOO_LARGE");
    fields[key] = value;
  }
  return fields;
}

function fieldValue(payload, key, customFields) {
  return ["name", "phone", "company", "service", "website", "message"].includes(key) ? payload[key] : customFields[key];
}

function validateAgainstPublishedForm(payload, customFields, site = null) {
  const form = site?.leadForm;
  const definitions = Array.isArray(form?.fields) ? form.fields.filter((field) => field?.enabled !== false) : [];
  if (!definitions.length) return { version: clean(payload.form_version ?? payload.formVersion, 64) || "legacy", definitions: [], answers: customFields };
  const submittedVersion = clean(payload.form_version ?? payload.formVersion, 64);
  if (submittedVersion && submittedVersion !== form.version) throw new PublicLeadError("咨询表单已更新，请刷新页面后重新提交。", 409, "SITE_LEAD_FORM_VERSION_STALE");
  const allowedCustom = new Set(definitions.map((field) => field.key).filter((key) => !["name", "phone", "company", "service", "website", "message"].includes(key)));
  if (Object.keys(customFields).some((key) => !allowedCustom.has(key))) throw new PublicLeadError("提交内容包含当前表单未定义的字段。", 422, "SITE_LEAD_CUSTOM_FIELDS_INVALID");
  for (const field of definitions) {
    const maximum = Math.max(1, Number(field.maximum) || 160);
    const rawValue = fieldValue(payload, field.key, customFields);
    if (String(rawValue ?? "").length > maximum) throw new PublicLeadError(`${field.label || field.key}超过允许长度。`, 422, "SITE_LEAD_FIELD_TOO_LONG");
    const value = clean(rawValue, maximum);
    if (field.required && !value) throw new PublicLeadError(`${field.label || field.key}不能为空。`, 422, "SITE_LEAD_REQUIRED");
    if (field.type === "email" && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new PublicLeadError(`${field.label || field.key}格式不正确。`, 422, "SITE_LEAD_FIELD_INVALID");
    if (field.type === "url" && value && !safeSourceUrl(value)) throw new PublicLeadError(`${field.label || field.key}格式不正确。`, 422, "SITE_LEAD_FIELD_INVALID");
    if (field.type === "number" && value && !Number.isFinite(Number(value))) throw new PublicLeadError(`${field.label || field.key}必须是数字。`, 422, "SITE_LEAD_FIELD_INVALID");
    if (field.type === "select" && value) {
      const options = [...(Array.isArray(field.options) ? field.options : []), ...(field.dynamicOptions === "business-lines" ? (site.businessLines || []).map((line) => line.product || line.name) : [])].map(String);
      if (options.length && !options.includes(value)) throw new PublicLeadError(`${field.label || field.key}选项无效。`, 422, "SITE_LEAD_FIELD_INVALID");
    }
  }
  return {
    version: form.version,
    definitions: definitions.map(({ key, label, type, required, options = [] }) => ({ key, label, type, required: required === true, options })),
    answers: Object.fromEntries(definitions.map((field) => [field.key, clean(fieldValue(payload, field.key, customFields), Math.max(1, Number(field.maximum) || 160))]))
  };
}

export class PublicLeadStore {
  constructor(database, options = {}) {
    if (!database?.connection) throw new TypeError("PublicLeadStore requires a production database.");
    this.database = database;
    this.workspaceId = clean(options.workspaceId || "default", 120) || "default";
    this.projectId = clean(options.projectId || process.env.TZ_PROJECT_ID || this.workspaceId, 120) || this.workspaceId;
  }

  create(payload = {}, context = {}) {
    // Homepage and contact-page forms use snake_case for source_url. Unknown
    // fields are intentionally ignored so arbitrary browser data is never
    // persisted by accident.
    const customFields = customFieldSnapshot(payload);
    const formSnapshot = validateAgainstPublishedForm(payload, customFields, context.site);
    const lead = {
      id: `LEAD-${crypto.randomUUID()}`,
      workspaceId: this.workspaceId,
      projectId: this.projectId,
      name: required(payload.name, "称呼", MAXIMUMS.name),
      phone: required(payload.phone, "联系方式", MAXIMUMS.phone),
      company: clean(payload.company, MAXIMUMS.company),
      service: clean(payload.service, MAXIMUMS.service),
      website: clean(payload.website, MAXIMUMS.website),
      message: clean(payload.message, MAXIMUMS.message),
      sourceUrl: safeSourceUrl(payload.source_url ?? payload.sourceUrl),
      userAgent: clean(context.userAgent, MAXIMUMS.userAgent),
      utm: Object.fromEntries(UTM_KEYS.map((key) => [key, clean(payload.utm?.[key] ?? payload[`utm_${key}`], 300)]).filter(([, value]) => value)),
      createdAt: new Date().toISOString()
    };
    const metadata = { leadForm: { version: formSnapshot.version, definition: formSnapshot.definitions, fields: formSnapshot.answers } };
    const idempotencyKey = clean(context.idempotencyKey ?? payload.idempotency_key, 200);
    if (!IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) throw new PublicLeadError("提交标识无效，请刷新页面后重试。", 422, "SITE_LEAD_IDEMPOTENCY_REQUIRED");
    const submissionHash = crypto.createHash("sha256").update(JSON.stringify({
      projectId: lead.projectId, name: lead.name, phone: lead.phone,
      company: lead.company, service: lead.service, website: lead.website, message: lead.message,
      sourceUrl: lead.sourceUrl, utm: lead.utm, metadata
    })).digest("hex");
    const existing = this.database.connection.prepare("SELECT id, status, created_at, submission_hash FROM site_contact_leads WHERE workspace_id = ? AND project_id = ? AND idempotency_key = ?").get(lead.workspaceId, lead.projectId, idempotencyKey);
    if (existing) {
      if (existing.submission_hash !== submissionHash) throw new PublicLeadError("同一提交标识不能用于不同内容，请刷新页面后重试。", 409, "SITE_LEAD_IDEMPOTENCY_CONFLICT");
      return { id: existing.id, status: existing.status, createdAt: existing.created_at, replayed: true };
    }
    this.database.connection.prepare(`
      INSERT INTO site_contact_leads (
        id, workspace_id, project_id, name, phone, company, service, website, message,
        source_url, status, user_agent, metadata_json, created_at, updated_at,
        phone_or_email, need, source_page, utm_json,
        idempotency_key, submission_hash
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      lead.id, lead.workspaceId, lead.projectId, lead.name, lead.phone, lead.company, lead.service,
      lead.website, lead.message, lead.sourceUrl, lead.userAgent, JSON.stringify(metadata), lead.createdAt, lead.createdAt,
      lead.phone, lead.message, lead.sourceUrl, JSON.stringify(lead.utm),
      idempotencyKey, submissionHash
    );
    return { id: lead.id, status: "new", createdAt: lead.createdAt, replayed: false };
  }
}
