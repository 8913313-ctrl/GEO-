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
    this.workspaceId = clean(options.workspaceId || "default", 120) || "default";
  }

  create(payload = {}, context = {}) {
    // Homepage and contact-page forms use snake_case for source_url. Unknown
    // fields are intentionally ignored so arbitrary browser data is never
    // persisted by accident.
    const lead = {
      id: `LEAD-${crypto.randomUUID()}`,
      workspaceId: this.workspaceId,
      name: required(payload.name, "称呼", MAXIMUMS.name),
      phone: required(payload.phone, "联系方式", MAXIMUMS.phone),
      company: clean(payload.company, MAXIMUMS.company),
      service: clean(payload.service, MAXIMUMS.service),
      website: clean(payload.website, MAXIMUMS.website),
      message: clean(payload.message, MAXIMUMS.message),
      sourceUrl: safeSourceUrl(payload.source_url ?? payload.sourceUrl),
      userAgent: clean(context.userAgent, MAXIMUMS.userAgent),
      createdAt: new Date().toISOString()
    };
    this.database.connection.prepare(`
      INSERT INTO site_contact_leads (
        id, workspace_id, name, phone, company, service, website, message,
        source_url, status, user_agent, metadata_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, '{}', ?, ?)
    `).run(
      lead.id, lead.workspaceId, lead.name, lead.phone, lead.company, lead.service,
      lead.website, lead.message, lead.sourceUrl, lead.userAgent, lead.createdAt, lead.createdAt
    );
    return { id: lead.id, status: "new", createdAt: lead.createdAt };
  }
}

