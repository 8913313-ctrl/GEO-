export function readHeader(request, name) {
  const headers = request?.headers || {};
  const key = String(name || "").toLowerCase();
  const value = typeof headers.get === "function" ? headers.get(key) : headers[key];
  return Array.isArray(value) ? value.join(", ") : String(value || "");
}

export function requestMetadata(request, options = {}) {
  const directAddress = String(request?.socket?.remoteAddress || request?.connection?.remoteAddress || "").slice(0, 120);
  const forwarded = options.trustProxy ? readHeader(request, "x-forwarded-for").split(",")[0].trim().slice(0, 120) : "";
  return {
    ipAddress: forwarded || directAddress || null,
    userAgent: readHeader(request, "user-agent").slice(0, 500) || null
  };
}

export function auditDetailsJson(details = {}) {
  let json;
  try {
    json = JSON.stringify(details ?? {});
  } catch {
    json = JSON.stringify({ serializationError: true });
  }
  if (Buffer.byteLength(json, "utf8") <= 64_000) return json;
  return JSON.stringify({ truncated: true, originalBytes: Buffer.byteLength(json, "utf8") });
}

export function appendAuditLog(connection, entry = {}) {
  const metadata = entry.requestMetadata || requestMetadata(entry.request, { trustProxy: entry.trustProxy });
  const result = connection.prepare(`
    INSERT INTO audit_logs (
      actor_user_id, action, entity_type, entity_id, details_json, ip_address, user_agent, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    entry.actorUserId || null,
    String(entry.action || "unknown").slice(0, 160),
    String(entry.entityType || "system").slice(0, 120),
    entry.entityId == null ? null : String(entry.entityId).slice(0, 240),
    auditDetailsJson(entry.details),
    metadata.ipAddress,
    metadata.userAgent,
    entry.createdAt || new Date().toISOString()
  );
  return Number(result.lastInsertRowid);
}
