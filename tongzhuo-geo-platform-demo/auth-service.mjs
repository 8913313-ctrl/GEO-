import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { appendAuditLog, readHeader, requestMetadata } from "./production-audit.mjs";

const scryptAsync = promisify(scrypt);
const PASSWORD_PARAMETERS = Object.freeze({ N: 16_384, r: 8, p: 1, keyLength: 32, maxmem: 64 * 1024 * 1024 });
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS", "TRACE"]);

export const PERMISSIONS = Object.freeze({
  WORKSPACE_READ: "workspace.read",
  WORKSPACE_WRITE: "workspace.write",
  LEADS_CONTACT_READ: "leads.contact.read",
  LEADS_MANAGE: "leads.manage",
  LEADS_EXPORT: "leads.export",
  CONTENT_GENERATE: "content.generate",
  CONTENT_REVIEW: "content.review",
  CONTENT_PUBLISH: "content.publish",
  KNOWLEDGE_MANAGE: "knowledge.manage",
  KNOWLEDGE_REVIEW: "knowledge.review",
  USERS_MANAGE: "users.manage",
  MODELS_MANAGE: "models.manage",
  AUDIT_READ: "audit.read",
  SYSTEM_MANAGE: "system.manage"
});

const allPermissions = Object.freeze(Object.values(PERMISSIONS));

export const ROLE_PERMISSIONS = Object.freeze({
  admin: allPermissions,
  operator: Object.freeze([
    PERMISSIONS.WORKSPACE_READ,
    PERMISSIONS.WORKSPACE_WRITE,
    PERMISSIONS.LEADS_CONTACT_READ,
    PERMISSIONS.LEADS_MANAGE,
    PERMISSIONS.LEADS_EXPORT,
    PERMISSIONS.CONTENT_GENERATE,
    PERMISSIONS.CONTENT_PUBLISH,
    PERMISSIONS.KNOWLEDGE_MANAGE,
    PERMISSIONS.KNOWLEDGE_REVIEW
  ]),
  reviewer: Object.freeze([
    PERMISSIONS.WORKSPACE_READ,
    PERMISSIONS.WORKSPACE_WRITE,
    PERMISSIONS.CONTENT_REVIEW,
    PERMISSIONS.KNOWLEDGE_REVIEW,
    PERMISSIONS.CONTENT_PUBLISH,
    PERMISSIONS.AUDIT_READ
  ]),
  viewer: Object.freeze([PERMISSIONS.WORKSPACE_READ])
});

export class AuthError extends Error {
  constructor(message, status = 401, code = "AUTHENTICATION_REQUIRED", details = undefined) {
    super(message);
    this.name = "AuthError";
    this.status = status;
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

export class PermissionDeniedError extends AuthError {
  constructor(permission) {
    super("当前账号没有执行此操作的权限。", 403, "PERMISSION_DENIED", { permission });
    this.name = "PermissionDeniedError";
  }
}

function boundedInteger(value, fallback, minimum, maximum) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.max(minimum, Math.min(maximum, parsed));
}

function base64Url(buffer) {
  return Buffer.from(buffer).toString("base64url");
}

function normalizeUsername(value) {
  const username = String(value || "").trim();
  if (username.length < 3 || username.length > 120 || /[\u0000-\u0020\u007f]/u.test(username)) {
    throw new AuthError("用户名需为 3–120 个不含空格或控制字符的字符。", 422, "INVALID_USERNAME");
  }
  return { username, normalized: username.toLocaleLowerCase("en-US") };
}

function validatePassword(value) {
  const password = String(value || "");
  const bytes = Buffer.byteLength(password, "utf8");
  if (password.length < 10 || bytes > 4096) {
    throw new AuthError("密码至少需要 10 个字符，且不能超过 4096 字节。", 422, "INVALID_PASSWORD");
  }
  return password;
}

function normalizeRole(value, fallback = "operator") {
  const role = String(value || fallback).trim().toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(ROLE_PERMISSIONS, role)) {
    throw new AuthError("成员角色无效。", 422, "INVALID_ROLE");
  }
  return role;
}

function normalizeUserStatus(value, fallback = "active") {
  const status = String(value || fallback).trim().toLowerCase();
  if (!['active', 'disabled'].includes(status)) throw new AuthError("成员状态无效。", 422, "INVALID_USER_STATUS");
  return status;
}

export async function hashPassword(value) {
  const password = validatePassword(value);
  const salt = randomBytes(16);
  const derived = await scryptAsync(password, salt, PASSWORD_PARAMETERS.keyLength, {
    N: PASSWORD_PARAMETERS.N,
    r: PASSWORD_PARAMETERS.r,
    p: PASSWORD_PARAMETERS.p,
    maxmem: PASSWORD_PARAMETERS.maxmem
  });
  return [
    "scrypt",
    PASSWORD_PARAMETERS.N,
    PASSWORD_PARAMETERS.r,
    PASSWORD_PARAMETERS.p,
    PASSWORD_PARAMETERS.keyLength,
    base64Url(salt),
    base64Url(derived)
  ].join("$");
}

export async function verifyPassword(value, encoded) {
  const password = String(value || "");
  const parts = String(encoded || "").split("$");
  if (parts.length !== 7 || parts[0] !== "scrypt") return false;
  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const keyLength = Number(parts[4]);
  if (!Number.isInteger(N) || N < 4096 || N > 1_048_576 || (N & (N - 1)) !== 0) return false;
  if (!Number.isInteger(r) || r < 1 || r > 32 || !Number.isInteger(p) || p < 1 || p > 16) return false;
  if (!Number.isInteger(keyLength) || keyLength < 16 || keyLength > 64) return false;
  let salt;
  let expected;
  try {
    salt = Buffer.from(parts[5], "base64url");
    expected = Buffer.from(parts[6], "base64url");
  } catch {
    return false;
  }
  if (salt.length < 16 || expected.length !== keyLength) return false;
  try {
    const actual = await scryptAsync(password, salt, keyLength, { N, r, p, maxmem: Math.max(64 * 1024 * 1024, 256 * N * r) });
    return timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export function sha256Token(token) {
  return createHash("sha256").update(String(token || ""), "utf8").digest("hex");
}

export function permissionsForRole(role) {
  return [...(ROLE_PERMISSIONS[String(role || "")] || [])];
}

function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    email: row.email || "",
    role: row.role,
    status: row.status,
    permissions: permissionsForRole(row.role),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastLoginAt: row.last_login_at || null
  };
}

function parseCookies(header) {
  const result = {};
  for (const part of String(header || "").split(";")) {
    const separator = part.indexOf("=");
    if (separator < 1) continue;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (!key) continue;
    try {
      result[key] = decodeURIComponent(value);
    } catch {
      result[key] = value;
    }
  }
  return result;
}

function appendSetCookie(response, cookies) {
  if (!response || typeof response.setHeader !== "function") return;
  const current = typeof response.getHeader === "function" ? response.getHeader("Set-Cookie") : undefined;
  const existing = current == null ? [] : Array.isArray(current) ? current : [String(current)];
  response.setHeader("Set-Cookie", [...existing, ...cookies]);
}

function cookieValue(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, "Path=/", "SameSite=Strict"];
  if (options.httpOnly) parts.push("HttpOnly");
  if (options.secure) parts.push("Secure");
  if (Number.isFinite(options.maxAge)) parts.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge))}`);
  return parts.join("; ");
}

function tokenFromRequest(request, cookieName) {
  if (typeof request === "string") return { token: request, source: "bearer" };
  const authorization = readHeader(request, "authorization");
  const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (bearer) return { token: bearer, source: "bearer" };
  const cookies = parseCookies(readHeader(request, "cookie"));
  return { token: String(cookies[cookieName] || ""), source: "cookie" };
}

function csrfFromRequest(request) {
  return readHeader(request, "x-csrf-token") || readHeader(request, "x-xsrf-token");
}

function hashMatches(raw, expectedHash) {
  const actual = Buffer.from(sha256Token(raw), "hex");
  const expected = Buffer.from(String(expectedHash || ""), "hex");
  return actual.length === expected.length && actual.length > 0 && timingSafeEqual(actual, expected);
}

function normalizeTokenScopes(value) {
  if (!Array.isArray(value)) throw new AuthError("API Token 必须明确选择权限范围。", 422, "API_TOKEN_SCOPES_REQUIRED");
  const scopes = [...new Set(value.map(String).filter((item) => allPermissions.includes(item)))];
  if (!scopes.length || scopes.length !== value.length) throw new AuthError("API Token 权限范围无效。", 422, "API_TOKEN_SCOPES_INVALID");
  return scopes;
}

export class AuthService {
  constructor(database, options = {}) {
    if (!database?.connection) throw new TypeError("AuthService requires a ProductionDatabase instance.");
    this.database = database;
    this.connection = database.connection;
    this.sessionTtlSeconds = boundedInteger(options.sessionTtlSeconds ?? process.env.TZ_SESSION_TTL_SECONDS, 43_200, 300, 604_800);
    this.sessionCookieName = String(options.sessionCookieName || process.env.TZ_SESSION_COOKIE_NAME || "tz_session").trim();
    this.csrfCookieName = String(options.csrfCookieName || process.env.TZ_CSRF_COOKIE_NAME || "tz_csrf").trim();
    this.secureCookies = options.secureCookies ?? (String(process.env.NODE_ENV || "").toLowerCase() === "production");
    this.trustProxy = options.trustProxy ?? (String(process.env.TZ_TRUST_PROXY || "").toLowerCase() === "true");
    this.loginAttemptWindowMs = boundedInteger(options.loginAttemptWindowMs ?? process.env.TZ_LOGIN_ATTEMPT_WINDOW_MS, 15 * 60_000, 10_000, 24 * 60 * 60_000);
    this.loginAccountMaxAttempts = boundedInteger(options.loginAccountMaxAttempts ?? process.env.TZ_LOGIN_ACCOUNT_MAX_ATTEMPTS, 8, 3, 100);
    this.loginIpMaxAttempts = boundedInteger(options.loginIpMaxAttempts ?? process.env.TZ_LOGIN_IP_MAX_ATTEMPTS, 30, 5, 500);
    this.loginAttempts = new Map();
  }

  loginAttemptKeys(normalized, request) {
    const ipAddress = requestMetadata(request, { trustProxy: this.trustProxy }).ipAddress || "unknown";
    return [
      { key: `account:${normalized}`, limit: this.loginAccountMaxAttempts },
      { key: `ip:${ipAddress}`, limit: this.loginIpMaxAttempts }
    ];
  }

  assertLoginAllowed(normalized, request) {
    const timestamp = Date.now();
    for (const { key, limit } of this.loginAttemptKeys(normalized, request)) {
      const entry = this.loginAttempts.get(key);
      if (!entry || timestamp - entry.startedAt >= this.loginAttemptWindowMs) {
        if (entry) this.loginAttempts.delete(key);
        continue;
      }
      if (entry.count >= limit) {
        const retryAfterSeconds = Math.max(1, Math.ceil((entry.startedAt + this.loginAttemptWindowMs - timestamp) / 1000));
        throw new AuthError("登录失败次数过多，请稍后再试。", 429, "LOGIN_RATE_LIMITED", { retryAfterSeconds });
      }
    }
  }

  recordLoginFailure(normalized, request) {
    const timestamp = Date.now();
    for (const { key } of this.loginAttemptKeys(normalized, request)) {
      const current = this.loginAttempts.get(key);
      const entry = !current || timestamp - current.startedAt >= this.loginAttemptWindowMs
        ? { count: 0, startedAt: timestamp }
        : current;
      entry.count += 1;
      this.loginAttempts.set(key, entry);
    }
  }

  clearLoginAccountFailures(normalized) {
    this.loginAttempts.delete(`account:${normalized}`);
  }

  initialized() {
    return Number(this.connection.prepare("SELECT COUNT(*) AS count FROM users").get()?.count || 0) > 0;
  }

  async setup(payload = {}, request = null, response = null) {
    const { username, normalized } = normalizeUsername(payload.username);
    const passwordHash = await hashPassword(payload.password);
    const displayName = String(payload.displayName || username).trim().slice(0, 120) || username;
    const email = String(payload.email || "").trim().slice(0, 240) || null;
    const now = new Date().toISOString();
    const id = randomUUID();
    this.database.transaction(() => {
      const count = Number(this.connection.prepare("SELECT COUNT(*) AS count FROM users").get()?.count || 0);
      if (count > 0) throw new AuthError("系统已经完成初始化。", 409, "SETUP_ALREADY_COMPLETED");
      this.connection.prepare(`
        INSERT INTO users (
          id, username, username_normalized, display_name, email, password_hash, role, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'admin', 'active', ?, ?)
      `).run(id, username, normalized, displayName, email, passwordHash, now, now);
      appendAuditLog(this.connection, {
        actorUserId: id,
        action: "auth.setup",
        entityType: "user",
        entityId: id,
        details: { username, role: "admin" },
        request,
        trustProxy: this.trustProxy,
        createdAt: now
      });
    });
    const row = this.connection.prepare("SELECT * FROM users WHERE id = ?").get(id);
    const result = this.issueSession(row, request);
    this.applySessionToResponse(response, result);
    return { initialized: true, user: publicUser(row), ...result };
  }

  async login(payload = {}, request = null, response = null) {
    const { username, normalized } = normalizeUsername(payload.username);
    this.assertLoginAllowed(normalized, request);
    const row = this.connection.prepare("SELECT * FROM users WHERE username_normalized = ?").get(normalized);
    const valid = row?.status === "active" && await verifyPassword(payload.password, row.password_hash);
    if (!valid) {
      this.recordLoginFailure(normalized, request);
      appendAuditLog(this.connection, {
        action: "auth.login_failed",
        entityType: "user",
        details: { username },
        request,
        trustProxy: this.trustProxy
      });
      throw new AuthError("用户名或密码不正确。", 401, "INVALID_CREDENTIALS");
    }
    this.clearLoginAccountFailures(normalized);
    const now = new Date().toISOString();
    this.connection.prepare("UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?").run(now, now, row.id);
    row.last_login_at = now;
    row.updated_at = now;
    const result = this.issueSession(row, request);
    appendAuditLog(this.connection, {
      actorUserId: row.id,
      action: "auth.login",
      entityType: "session",
      entityId: result.sessionId,
      details: {},
      request,
      trustProxy: this.trustProxy,
      createdAt: now
    });
    this.applySessionToResponse(response, result);
    return { user: publicUser(row), ...result };
  }

  issueSession(userRow, request = null) {
    const sessionToken = base64Url(randomBytes(32));
    const csrfToken = base64Url(randomBytes(32));
    const sessionId = randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.sessionTtlSeconds * 1000);
    const metadata = requestMetadata(request, { trustProxy: this.trustProxy });
    this.database.transaction(() => {
      this.connection.prepare("DELETE FROM sessions WHERE expires_at <= ? OR revoked_at IS NOT NULL").run(now.toISOString());
      this.connection.prepare(`
        INSERT INTO sessions (
          id, user_id, token_hash, csrf_hash, created_at, expires_at, last_seen_at, ip_address, user_agent
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        sessionId,
        userRow.id,
        sha256Token(sessionToken),
        sha256Token(csrfToken),
        now.toISOString(),
        expiresAt.toISOString(),
        now.toISOString(),
        metadata.ipAddress,
        metadata.userAgent
      );
    });
    return { sessionId, sessionToken, csrfToken, expiresAt: expiresAt.toISOString() };
  }

  applySessionToResponse(response, result) {
    if (!response || !result?.sessionToken || !result?.csrfToken) return;
    appendSetCookie(response, [
      cookieValue(this.sessionCookieName, result.sessionToken, { httpOnly: true, secure: this.secureCookies, maxAge: this.sessionTtlSeconds }),
      cookieValue(this.csrfCookieName, result.csrfToken, { httpOnly: false, secure: this.secureCookies, maxAge: this.sessionTtlSeconds })
    ]);
    if (typeof response.setHeader === "function") response.setHeader("Cache-Control", "no-store");
  }

  clearSessionFromResponse(response) {
    if (!response) return;
    appendSetCookie(response, [
      cookieValue(this.sessionCookieName, "", { httpOnly: true, secure: this.secureCookies, maxAge: 0 }),
      cookieValue(this.csrfCookieName, "", { httpOnly: false, secure: this.secureCookies, maxAge: 0 })
    ]);
    if (typeof response.setHeader === "function") response.setHeader("Cache-Control", "no-store");
  }

  async authenticate(requestOrToken, options = {}) {
    const extracted = tokenFromRequest(requestOrToken, this.sessionCookieName);
    if (!extracted.token) throw new AuthError("请先登录。", 401, "AUTHENTICATION_REQUIRED");
    const now = new Date().toISOString();
    if (extracted.source === "bearer") {
      const tokenRow = this.connection.prepare(`SELECT t.*, u.username, u.display_name, u.email, u.role, u.status, u.created_at AS user_created_at, u.updated_at AS user_updated_at, u.last_login_at FROM api_tokens t JOIN users u ON u.id = t.user_id WHERE t.token_hash = ?`).get(sha256Token(extracted.token));
      if (tokenRow) {
        if (tokenRow.revoked_at || (tokenRow.expires_at && tokenRow.expires_at <= now) || tokenRow.status !== "active") throw new AuthError("API Token 已失效。", 401, "API_TOKEN_INVALID");
        const scopes = JSON.parse(tokenRow.scopes_json);
        this.connection.prepare("UPDATE api_tokens SET last_used_at = ? WHERE id = ?").run(now, tokenRow.id);
        return { userId: tokenRow.user_id, tokenId: tokenRow.id, username: tokenRow.username, displayName: tokenRow.display_name, role: tokenRow.role, permissions: scopes, user: { id: tokenRow.user_id, username: tokenRow.username, displayName: tokenRow.display_name, email: tokenRow.email || "", role: tokenRow.role, status: tokenRow.status, permissions: scopes, createdAt: tokenRow.user_created_at, updatedAt: tokenRow.user_updated_at, lastLoginAt: tokenRow.last_login_at || null } };
      }
    }
    const row = this.connection.prepare(`
      SELECT
        s.id AS session_id, s.csrf_hash, s.expires_at, s.revoked_at,
        u.id, u.username, u.display_name, u.email, u.role, u.status,
        u.created_at, u.updated_at, u.last_login_at
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ?
    `).get(sha256Token(extracted.token));
    if (!row || row.revoked_at || row.expires_at <= now || row.status !== "active") {
      throw new AuthError("登录状态已失效，请重新登录。", 401, "SESSION_INVALID");
    }
    const method = typeof requestOrToken === "string" ? "GET" : String(requestOrToken?.method || "GET").toUpperCase();
    const csrfRequired = options.requireCsrf ?? (extracted.source === "cookie" && !SAFE_METHODS.has(method));
    if (csrfRequired && !hashMatches(csrfFromRequest(requestOrToken), row.csrf_hash)) {
      throw new AuthError("请求校验失败，请刷新页面后重试。", 403, "CSRF_INVALID");
    }
    this.connection.prepare("UPDATE sessions SET last_seen_at = ? WHERE id = ?").run(now, row.session_id);
    const user = publicUser(row);
    return {
      userId: user.id,
      sessionId: row.session_id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      permissions: user.permissions,
      user
    };
  }

  async logout(requestOrToken, response = null) {
    let principal;
    try {
      principal = await this.authenticate(requestOrToken);
    } catch (error) {
      this.clearSessionFromResponse(response);
      throw error;
    }
    const now = new Date().toISOString();
    this.connection.prepare("UPDATE sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL").run(now, principal.sessionId);
    appendAuditLog(this.connection, {
      actorUserId: principal.userId,
      action: "auth.logout",
      entityType: "session",
      entityId: principal.sessionId,
      details: {},
      request: typeof requestOrToken === "string" ? null : requestOrToken,
      trustProxy: this.trustProxy,
      createdAt: now
    });
    this.clearSessionFromResponse(response);
    return { loggedOut: true };
  }

  async requirePermission(subject, permission, options = {}) {
    const principal = subject?.userId ? subject : await this.authenticate(subject, options);
    const required = Array.isArray(permission) ? permission.map(String) : [String(permission || "")];
    const granted = new Set(principal.permissions || permissionsForRole(principal.role));
    const allowed = options.any === true ? required.some((item) => granted.has(item)) : required.every((item) => granted.has(item));
    if (!required.length || required.some((item) => !allPermissions.includes(item)) || !allowed) {
      throw new PermissionDeniedError(Array.isArray(permission) ? required : required[0]);
    }
    return principal;
  }

  listUsers() {
    return this.connection.prepare("SELECT * FROM users ORDER BY created_at ASC").all().map(publicUser);
  }

  listApiTokens(userId) {
    return this.connection.prepare("SELECT id, name, token_prefix, scopes_json, created_at, expires_at, last_used_at, revoked_at FROM api_tokens WHERE user_id = ? ORDER BY created_at DESC").all(String(userId)).map((row) => ({ id: row.id, name: row.name, tokenPrefix: row.token_prefix, scopes: JSON.parse(row.scopes_json), createdAt: row.created_at, expiresAt: row.expires_at, lastUsedAt: row.last_used_at, revokedAt: row.revoked_at }));
  }

  createApiToken(payload = {}, actor = null, request = null) {
    const name = String(payload.name || "").trim().slice(0, 120);
    if (!name) throw new AuthError("请填写 API Token 名称。", 422, "API_TOKEN_NAME_REQUIRED");
    const scopes = normalizeTokenScopes(payload.scopes);
    const expiresAt = payload.expiresAt ? new Date(payload.expiresAt).toISOString() : null;
    if (expiresAt && expiresAt <= new Date().toISOString()) throw new AuthError("API Token 到期时间必须晚于当前时间。", 422, "API_TOKEN_EXPIRY_INVALID");
    const raw = `tz_pat_${base64Url(randomBytes(32))}`;
    const id = randomUUID(); const now = new Date().toISOString();
    this.connection.prepare("INSERT INTO api_tokens (id, user_id, name, token_hash, token_prefix, scopes_json, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(id, actor.userId, name, sha256Token(raw), raw.slice(0, 14), JSON.stringify(scopes), now, expiresAt);
    appendAuditLog(this.connection, { actorUserId: actor.userId, action: "api_token.create", entityType: "api_token", entityId: id, details: { name, scopes, expiresAt }, request, trustProxy: this.trustProxy, createdAt: now });
    return { token: raw, item: this.listApiTokens(actor.userId).find((item) => item.id === id) };
  }

  revokeApiToken(id, actor = null, request = null) {
    const now = new Date().toISOString();
    const result = this.connection.prepare("UPDATE api_tokens SET revoked_at = COALESCE(revoked_at, ?) WHERE id = ? AND user_id = ?").run(now, String(id), actor.userId);
    if (!result.changes) throw new AuthError("API Token 不存在。", 404, "API_TOKEN_NOT_FOUND");
    appendAuditLog(this.connection, { actorUserId: actor.userId, action: "api_token.revoke", entityType: "api_token", entityId: String(id), details: {}, request, trustProxy: this.trustProxy, createdAt: now });
    return { revoked: true, id: String(id) };
  }

  async createUser(payload = {}, actor = null, request = null) {
    const { username, normalized } = normalizeUsername(payload.username || payload.email);
    const passwordHash = await hashPassword(payload.password);
    const displayName = String(payload.displayName || payload.name || username).trim().slice(0, 120) || username;
    const email = String(payload.email || "").trim().slice(0, 240) || null;
    const role = normalizeRole(payload.role);
    const status = normalizeUserStatus(payload.status);
    const id = randomUUID();
    const now = new Date().toISOString();
    try {
      this.database.transaction(() => {
        this.connection.prepare(`
          INSERT INTO users (
            id, username, username_normalized, display_name, email, password_hash, role, status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, username, normalized, displayName, email, passwordHash, role, status, now, now);
        appendAuditLog(this.connection, {
          actorUserId: actor?.userId || actor?.id || null,
          action: "user.create",
          entityType: "user",
          entityId: id,
          details: { username, role, status },
          request,
          trustProxy: this.trustProxy,
          createdAt: now
        });
      });
    } catch (error) {
      if (String(error?.message || "").includes("UNIQUE constraint failed")) throw new AuthError("登录账号已经存在。", 409, "USERNAME_EXISTS");
      throw error;
    }
    return publicUser(this.connection.prepare("SELECT * FROM users WHERE id = ?").get(id));
  }

  async updateUser(userId, payload = {}, actor = null, request = null) {
    const id = String(userId || "").trim();
    const current = this.connection.prepare("SELECT * FROM users WHERE id = ?").get(id);
    if (!current) throw new AuthError("成员不存在。", 404, "USER_NOT_FOUND");
    const displayName = Object.prototype.hasOwnProperty.call(payload, "displayName") || Object.prototype.hasOwnProperty.call(payload, "name")
      ? String(payload.displayName || payload.name || current.display_name).trim().slice(0, 120)
      : current.display_name;
    const email = Object.prototype.hasOwnProperty.call(payload, "email") ? String(payload.email || "").trim().slice(0, 240) || null : current.email;
    const role = Object.prototype.hasOwnProperty.call(payload, "role") ? normalizeRole(payload.role, current.role) : current.role;
    const status = Object.prototype.hasOwnProperty.call(payload, "status") ? normalizeUserStatus(payload.status, current.status) : current.status;
    const passwordHash = payload.password ? await hashPassword(payload.password) : current.password_hash;
    const demotesActiveAdmin = current.role === "admin" && current.status === "active" && (role !== "admin" || status !== "active");
    if (demotesActiveAdmin) {
      const activeAdmins = Number(this.connection.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND status = 'active'").get()?.count || 0);
      if (activeAdmins <= 1) throw new AuthError("不能停用或降级最后一名管理员。", 409, "LAST_ADMIN_REQUIRED");
    }
    const now = new Date().toISOString();
    this.database.transaction(() => {
      this.connection.prepare(`
        UPDATE users SET display_name = ?, email = ?, password_hash = ?, role = ?, status = ?, updated_at = ?
        WHERE id = ?
      `).run(displayName, email, passwordHash, role, status, now, id);
      if (status !== "active" || payload.password) this.connection.prepare("UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL").run(now, id);
      appendAuditLog(this.connection, {
        actorUserId: actor?.userId || actor?.id || null,
        action: "user.update",
        entityType: "user",
        entityId: id,
        details: { role, status, passwordChanged: Boolean(payload.password) },
        request,
        trustProxy: this.trustProxy,
        createdAt: now
      });
    });
    return publicUser(this.connection.prepare("SELECT * FROM users WHERE id = ?").get(id));
  }

  deleteUser(userId, actor = null, request = null) {
    const id = String(userId || "").trim();
    const current = this.connection.prepare("SELECT * FROM users WHERE id = ?").get(id);
    if (!current) throw new AuthError("成员不存在。", 404, "USER_NOT_FOUND");
    if (id === actor?.userId) throw new AuthError("不能删除当前登录账号。", 409, "CANNOT_DELETE_SELF");
    if (current.role === "admin" && current.status === "active") {
      const activeAdmins = Number(this.connection.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND status = 'active'").get()?.count || 0);
      if (activeAdmins <= 1) throw new AuthError("不能删除最后一名管理员。", 409, "LAST_ADMIN_REQUIRED");
    }
    const now = new Date().toISOString();
    this.database.transaction(() => {
      appendAuditLog(this.connection, {
        actorUserId: actor?.userId || actor?.id || null,
        action: "user.delete",
        entityType: "user",
        entityId: id,
        details: { username: current.username, role: current.role },
        request,
        trustProxy: this.trustProxy,
        createdAt: now
      });
      this.connection.prepare("DELETE FROM users WHERE id = ?").run(id);
    });
    return { deleted: true, id };
  }
}

export { publicUser };
