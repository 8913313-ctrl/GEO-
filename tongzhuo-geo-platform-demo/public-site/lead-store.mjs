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

export class PublicLeadStore {
  constructor(database, options = {}) {
    if (!database?.connection) throw new TypeError("PublicLeadStore requires a production database.");
    this.database = database;
    this.workspaceId = clean(options.workspaceId || process.env.TZ_TENANT_ID || "default", 120) || "default";
    this.projectId = clean(options.projectId || process.env.TZ_PROJECT_ID || this.workspaceId, 120) || this.workspaceId;
  }

  create(payload = {}, context = {}) {
    // Homepage and contact-page forms use snake_case for source_url. Unknown
    // fields are intentionally ignored so arbitrary browser data is never
    // persisted by accident.
    const lead = {
      id: `LEAD-${crypto.randomUUID()}`,
      workspaceId: this.workspaceId,
      tenantId: this.workspaceId,
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
    const idempotencyKey = clean(context.idempotencyKey ?? payload.idempotency_key, 200);
    if (!IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) throw new PublicLeadError("提交标识无效，请刷新页面后重试。", 422, "SITE_LEAD_IDEMPOTENCY_REQUIRED");
    const submissionHash = crypto.createHash("sha256").update(JSON.stringify({
      tenantId: lead.tenantId, projectId: lead.projectId, name: lead.name, phone: lead.phone,
      company: lead.company, service: lead.service, website: lead.website, message: lead.message,
      sourceUrl: lead.sourceUrl, utm: lead.utm
    })).digest("hex");
    const existing = this.database.connection.prepare("SELECT id, status, created_at, submission_hash FROM site_contact_leads WHERE tenant_id = ? AND project_id = ? AND idempotency_key = ?").get(lead.tenantId, lead.projectId, idempotencyKey);
    if (existing) {
      if (existing.submission_hash !== submissionHash) throw new PublicLeadError("同一提交标识不能用于不同内容，请刷新页面后重试。", 409, "SITE_LEAD_IDEMPOTENCY_CONFLICT");
      return { id: existing.id, status: existing.status, createdAt: existing.created_at, replayed: true };
    }
    this.database.connection.prepare(`
      INSERT INTO site_contact_leads (
        id, workspace_id, name, phone, company, service, website, message,
        source_url, status, user_agent, metadata_json, created_at, updated_at,
        tenant_id, project_id, phone_or_email, need, source_page, utm_json,
        idempotency_key, submission_hash
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, '{}', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      lead.id, lead.workspaceId, lead.name, lead.phone, lead.company, lead.service,
      lead.website, lead.message, lead.sourceUrl, lead.userAgent, lead.createdAt, lead.createdAt,
      lead.tenantId, lead.projectId, lead.phone, lead.message, lead.sourceUrl, JSON.stringify(lead.utm),
      idempotencyKey, submissionHash
    );
    return { id: lead.id, status: "new", createdAt: lead.createdAt, replayed: false };
  }
}
