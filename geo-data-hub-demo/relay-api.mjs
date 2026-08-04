import { timingSafeEqual } from "node:crypto";
import { RelayStoreError } from "./relay-store.mjs";

const MAX_BODY_BYTES = 512 * 1024;
const ADMIN_ROLE_PERMISSIONS = Object.freeze({
  super_admin: ["*"],
  operations: ["admin.read", "tenant.manage", "instance.manage", "provider.manage", "pricing.manage", "task.manage", "reconciliation.manage", "settings.manage"],
  finance: ["admin.read", "finance.manage", "reconciliation.manage"],
  support: ["admin.read", "task.manage"],
  auditor: ["admin.read"]
});

function permissionsForAdminRole(role) {
  return ADMIN_ROLE_PERMISSIONS[role] || [];
}

function adminPermissionForRequest(method, pathname) {
  const verb = String(method || "GET").toUpperCase();
  if (/^\/api\/v1\/admin\/users(?:\/|$)/.test(pathname)) return "admin_users.manage";
  if (verb === "GET") return "admin.read";
  if (/^\/api\/v1\/admin\/tenants\/[^/]+\/credits$/.test(pathname)) return "finance.manage";
  if (/^\/api\/v1\/admin\/(payment-orders|invoice-requests)(?:\/|$)/.test(pathname)) return "finance.manage";
  if (pathname === "/api/v1/admin/tenants") return "tenant.manage";
  if (/^\/api\/v1\/admin\/instances(?:\/|$)/.test(pathname)) return "instance.manage";
  if (/^\/api\/v1\/admin\/providers(?:\/|$)/.test(pathname)) return "provider.manage";
  if (/^\/api\/v1\/admin\/prices(?:\/|$)/.test(pathname)) return "pricing.manage";
  if (/^\/api\/v1\/admin\/(items\/[^/]+\/retry|deliveries\/[^/]+\/requeue)$/.test(pathname)) return "task.manage";
  if (/^\/api\/v1\/admin\/items\/[^/]+\/reconcile$/.test(pathname)) return "reconciliation.manage";
  if (pathname === "/api/v1/admin/settings") return "settings.manage";
  if (pathname === "/api/v1/admin/ops/cleanup") return "system.manage";
  return "super_admin";
}

function isHighRiskAdminRequest(method, pathname) {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(String(method || "").toUpperCase())) return false;
  return /^\/api\/v1\/admin\/users(?:\/|$)/.test(pathname)
    || /^\/api\/v1\/admin\/tenants\/[^/]+\/credits$/.test(pathname)
    || /^\/api\/v1\/admin\/payment-orders\/[^/]+\/(confirm|cancel)$/.test(pathname)
    || /^\/api\/v1\/admin\/invoice-requests\/[^/]+\/(issue|void)$/.test(pathname)
    || /^\/api\/v1\/admin\/instances\/[^/]+\/(rotate-secret|revoke)$/.test(pathname)
    || pathname === "/api/v1/admin/providers/aidso"
    || pathname === "/api/v1/admin/prices"
    || /^\/api\/v1\/admin\/items\/[^/]+\/reconcile$/.test(pathname)
    || pathname === "/api/v1/admin/ops/cleanup";
}

function json(response, statusCode, payload, headers = {}) {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(body),
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "X-Frame-Options": "DENY",
    "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
    ...headers
  });
  response.end(body);
}

function text(response, statusCode, payload) {
  response.writeHead(statusCode, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
  response.end(payload);
}

function parseLimit(value, fallback = 50, maximum = 200) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.max(1, Math.min(maximum, parsed));
}

function pathSegment(value) {
  try {
    return decodeURIComponent(value || "");
  } catch {
    return "";
  }
}

function requestTarget(url) {
  return `${url.pathname}${url.search}`;
}

function header(request, name) {
  const value = request.headers[String(name).toLowerCase()];
  return Array.isArray(value) ? value[0] : String(value || "");
}

function secureTokenEqual(left, right) {
  const leftBytes = Buffer.from(String(left || ""), "utf8");
  const rightBytes = Buffer.from(String(right || ""), "utf8");
  return leftBytes.length > 0 && leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

async function readRawBody(request) {
  const chunks = [];
  let total = 0;
  for await (const chunk of request) {
    total += chunk.length;
    if (total > MAX_BODY_BYTES) {
      const error = new Error("请求体过大。");
      error.code = "RELAY_BODY_TOO_LARGE";
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function parseJsonBody(rawBody) {
  if (!rawBody?.length) return {};
  try {
    const parsed = JSON.parse(rawBody.toString("utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      const error = new Error("请求 JSON 必须是对象。");
      error.code = "RELAY_JSON_INVALID";
      error.statusCode = 422;
      throw error;
    }
    return parsed;
  } catch (error) {
    if (error.code) throw error;
    const wrapped = new Error("请求 JSON 无法解析。");
    wrapped.code = "RELAY_JSON_INVALID";
    wrapped.statusCode = 422;
    throw wrapped;
  }
}

function isLoopback(request) {
  return isLoopbackAddress(request.socket?.remoteAddress);
}

function normalizeRemoteAddress(value) {
  return String(value || "").trim().toLowerCase().replace(/^::ffff:/, "");
}

function isLoopbackAddress(value) {
  const address = normalizeRemoteAddress(value);
  return address === "127.0.0.1" || address === "::1";
}

function requestComesFromTrustedProxy(request, trustedProxyAddresses) {
  const peer = normalizeRemoteAddress(request.socket?.remoteAddress);
  return trustedProxyAddresses.some((address) => normalizeRemoteAddress(address) === peer);
}

function cookieValue(request, name) {
  const target = String(name || "").trim();
  if (!target) return "";
  const entries = header(request, "cookie").split(";");
  for (const entry of entries) {
    const separator = entry.indexOf("=");
    if (separator < 1) continue;
    if (entry.slice(0, separator).trim() !== target) continue;
    try {
      return decodeURIComponent(entry.slice(separator + 1).trim());
    } catch {
      return "";
    }
  }
  return "";
}

function requestRemoteAddress(request, trustedProxyAddresses = []) {
  const forwarded = requestComesFromTrustedProxy(request, trustedProxyAddresses)
    ? header(request, "x-forwarded-for").split(",")[0].trim()
    : "";
  return (forwarded || request.socket?.remoteAddress || "").slice(0, 256);
}

function requestUserAgent(request) {
  return header(request, "user-agent").slice(0, 1_000);
}

function isStateChangingMethod(method) {
  return ["POST", "PUT", "PATCH", "DELETE"].includes(String(method || "").toUpperCase());
}

function retentionDays(value, fallback = 90) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.max(0, Math.min(3_650, parsed));
}

function requestProtocol(request, trustedProxyAddresses = []) {
  if (request.socket?.encrypted) return "https";
  if (requestComesFromTrustedProxy(request, trustedProxyAddresses)) {
    const forwarded = header(request, "x-forwarded-proto").split(",")[0].trim().toLowerCase();
    if (forwarded === "https" || forwarded === "http") return forwarded;
  }
  return "http";
}

function sameOriginRequest(request, options = {}) {
  const origin = header(request, "origin");
  // Modern browsers send Sec-Fetch-Site for same-origin fetches. Keep this
  // fallback for user agents that omit Origin on a same-origin DELETE, while
  // rejecting cross-site and command-line cookie replay.
  if (!origin) return header(request, "sec-fetch-site").toLowerCase() === "same-origin";
  try {
    const parsed = new URL(origin);
    const configuredOrigin = String(options.publicOrigin || "").toLowerCase();
    if (configuredOrigin) return parsed.origin.toLowerCase() === configuredOrigin;
    const protocol = requestProtocol(request, options.trustedProxyAddresses);
    const expectedHost = header(request, "host").toLowerCase();
    return parsed.protocol === `${protocol}:` && parsed.host.toLowerCase() === expectedHost;
  } catch {
    return false;
  }
}

function publicAdminProvider(row) {
  return {
    providerAccountId: row.id,
    providerCode: row.provider_code,
    displayName: row.display_name,
    status: row.status,
    isDefault: Boolean(row.is_default),
    tokenConfigured: Boolean(row.token_envelope_json),
    tokenReference: row.token_reference || "",
    lastKnownBalance: row.last_known_balance === null ? null : Number(row.last_known_balance),
    maxInFlight: Number(row.max_in_flight),
    lastHealthAt: row.last_health_at || null,
    lastHealthStatus: row.last_health_status || "unknown",
    capabilitySnapshot: safeParse(row.capabilities_json, {})
  };
}

function publicAdminInstance(row) {
  return {
    instanceId: row.id,
    tenantId: row.tenant_id,
    tenantName: row.tenant_name || "",
    providerAccountId: row.provider_account_id || null,
    displayName: row.display_name,
    clientId: row.client_id,
    secretVersion: Number(row.secret_version),
    status: row.status,
    maxInFlight: Number(row.max_in_flight),
    dailyCreditLimit: Number(row.daily_credit_limit),
    monthlyCreditLimit: Number(row.monthly_credit_limit),
    lastSeenAt: row.last_seen_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function safeParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function publicAdminRun(row) {
  const input = safeParse(row.input_snapshot_json, {});
  return {
    relayRunId: row.id,
    tenantId: row.tenant_id,
    tenantName: row.tenant_name || "",
    instanceId: row.instance_id,
    clientRunId: row.client_run_id,
    status: row.status,
    billingStatus: row.billing_status,
    projectId: row.project_id || "",
    questionSetId: row.question_set_id || "",
    brand: input.brand || {},
    totalItems: Number(row.total_items),
    completedItems: Number(row.completed_items),
    failedItems: Number(row.failed_items),
    estimatedCustomerCredits: Number(row.estimated_customer_credits),
    heldCustomerCredits: Number(row.held_customer_credits),
    settledCustomerCredits: Number(row.settled_customer_credits),
    submittedAt: row.submitted_at,
    startedAt: row.started_at || null,
    completedAt: row.completed_at || null,
    updatedAt: row.updated_at
  };
}

function publicAdminLedger(row) {
  return {
    ledgerId: row.id,
    tenantId: row.tenant_id,
    tenantName: row.tenant_name || "",
    relayRunId: row.run_id || null,
    entryType: row.entry_type,
    availableDelta: Number(row.available_delta),
    heldDelta: Number(row.held_delta),
    availableAfter: row.available_after === null ? null : Number(row.available_after),
    heldAfter: row.held_after === null ? null : Number(row.held_after),
    customerCredits: Number(row.customer_credits),
    upstreamCredits: Number(row.upstream_credits),
    note: row.note || "",
    createdAt: row.created_at
  };
}

function publicAdminPrice(row) {
  return {
    priceRuleId: row.id,
    providerAccountId: row.provider_account_id,
    platform: row.platform,
    terminal: row.terminal,
    mode: row.mode,
    customerCredits: Number(row.customer_credits),
    estimatedUpstreamCredits: Number(row.estimated_upstream_credits),
    version: row.version,
    status: row.status,
    metadata: safeParse(row.metadata_json, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function relayErrorResponse(response, error) {
  const relayError = error instanceof RelayStoreError;
  const statusCode = relayError ? error.statusCode : Number(error?.statusCode || 500);
  const code = relayError ? error.code : (error?.code || "RELAY_INTERNAL_ERROR");
  const message = relayError ? error.message : (statusCode >= 500 ? "中转站内部错误。" : error?.message || "请求无法处理。");
  json(response, statusCode, {
    error: {
      code,
      message,
      details: relayError ? error.details || null : null
    }
  });
}

export function createRelayApi(options = {}) {
  const store = options.store;
  if (!store) throw new TypeError("createRelayApi requires a RelayStore.");
  const worker = options.worker || null;
  const runtimeConfig = options.runtimeConfig || {};
  const configuredAdminToken = String(options.adminToken ?? process.env.TZ_RELAY_ADMIN_TOKEN ?? "").trim();
  const insecureAdminAllowed = options.allowInsecureAdmin ?? (process.env.NODE_ENV !== "production" && process.env.TZ_RELAY_ALLOW_INSECURE_ADMIN !== "0");
  const publicOrigin = String(runtimeConfig.publicOrigin || "").trim();
  const trustedProxyAddresses = Array.isArray(runtimeConfig.trustedProxyAddresses)
    ? runtimeConfig.trustedProxyAddresses.map((entry) => String(entry || "").trim()).filter(Boolean)
    : [];
  const requireHttpsForAdmin = runtimeConfig.requireHttpsForAdmin === undefined
    ? process.env.NODE_ENV === "production"
    : Boolean(runtimeConfig.requireHttpsForAdmin);
  const rawResponseRetentionCeilingDays = retentionDays(runtimeConfig.rawResponseRetentionDays, 90);

  function effectiveRawResponseRetentionDays(requestedValue) {
    const configuredByOperator = retentionDays(
      store.getOperatorSettings?.().storage?.rawResponseRetentionDays,
      rawResponseRetentionCeilingDays
    );
    const requested = requestedValue === undefined
      ? configuredByOperator
      : retentionDays(requestedValue, configuredByOperator);
    // Deployment config is a hard privacy ceiling. The console and a manual
    // cleanup may make it stricter but can never lengthen retention.
    return Math.min(rawResponseRetentionCeilingDays, configuredByOperator, requested);
  }
  const adminSessionTtlSeconds = Math.max(300, Math.min(86_400, Number(runtimeConfig.adminSessionTtlSeconds) || 3_600));
  const adminSessionCookieName = String(runtimeConfig.adminSessionCookieName || "tz-relay-admin-session").trim() || "tz-relay-admin-session";
  if (!/^[A-Za-z0-9_-]{3,128}$/.test(adminSessionCookieName)) throw new TypeError("Invalid administrator session cookie name.");
  const adminSessionSecureCookie = runtimeConfig.adminSessionSecureCookie === undefined
    ? process.env.NODE_ENV === "production"
    : ["1", "true", "yes", "on"].includes(String(runtimeConfig.adminSessionSecureCookie).trim().toLowerCase());

  function adminUnauthorized() {
    const error = new Error(configuredAdminToken ? "中央运营接口未授权。" : "中央运营接口必须配置 TZ_RELAY_ADMIN_TOKEN。");
    error.code = "RELAY_ADMIN_UNAUTHORIZED";
    error.statusCode = 401;
    return error;
  }

  function adminForbidden(message = "管理员会话请求必须来自同源 HTTPS 运营页面。") {
    const error = new Error(message);
    error.code = "RELAY_ADMIN_SESSION_ORIGIN";
    error.statusCode = 403;
    return error;
  }

  function adminAccessDenied(code, message, details = undefined) {
    const error = new Error(message);
    error.code = code;
    error.statusCode = 403;
    error.details = details;
    return error;
  }

  function adminTransportAllowed(request) {
    if (!requireHttpsForAdmin) return true;
    return requestProtocol(request, trustedProxyAddresses) === "https";
  }

  function sessionCookie(value, maxAgeSeconds) {
    const parts = [
      `${adminSessionCookieName}=${encodeURIComponent(value)}`,
      "Path=/",
      "HttpOnly",
      "SameSite=Strict",
      `Max-Age=${Math.max(0, Math.floor(Number(maxAgeSeconds) || 0))}`
    ];
    if (adminSessionSecureCookie) parts.push("Secure");
    return parts.join("; ");
  }

  function expiredSessionCookie() {
    const parts = [
      `${adminSessionCookieName}=`,
      "Path=/",
      "HttpOnly",
      "SameSite=Strict",
      "Max-Age=0",
      "Expires=Thu, 01 Jan 1970 00:00:00 GMT"
    ];
    if (adminSessionSecureCookie) parts.push("Secure");
    return parts.join("; ");
  }

  function rootTokenAuthorized(request) {
    if (!adminTransportAllowed(request)) return false;
    const authorization = header(request, "authorization");
    return Boolean(configuredAdminToken && secureTokenEqual(authorization, `Bearer ${configuredAdminToken}`));
  }

  function requireAdmin(request) {
    if (rootTokenAuthorized(request)) return { type: "root_token", role: "operator", actorType: "operator_cli", permissions: ["*"], emergency: true };
    const token = cookieValue(request, adminSessionCookieName);
    if (token) {
      const session = store.authenticateAdminSession(token);
      if (session) {
        if (!adminTransportAllowed(request)) throw adminForbidden("管理员会话只能通过 HTTPS 访问。");
        if (isStateChangingMethod(request.method) && !sameOriginRequest(request, { publicOrigin, trustedProxyAddresses })) throw adminForbidden();
        const emergency = session.authSource === "root_token";
        return {
          type: "session",
          role: session.role,
          actorType: session.adminUserId ? `admin_user:${session.adminUserId}` : "operator_session",
          sessionToken: token,
          session,
          permissions: emergency ? ["*"] : permissionsForAdminRole(session.role),
          emergency
        };
      }
    }
    if (!configuredAdminToken && insecureAdminAllowed && isLoopback(request)) return { type: "development_loopback", role: "operator", actorType: "operator_development", permissions: ["*"], emergency: true };
    throw adminUnauthorized();
  }

  function requireAdminPermission(admin, method, pathname) {
    if (admin.emergency) return;
    const permission = adminPermissionForRequest(method, pathname);
    if (!admin.permissions.includes("*") && !admin.permissions.includes(permission)) {
      throw adminAccessDenied("RELAY_ADMIN_PERMISSION_DENIED", "当前管理员角色无权执行此操作。", { permission, role: admin.role });
    }
    if (isHighRiskAdminRequest(method, pathname) && !admin.session?.mfaVerified) {
      throw adminAccessDenied("RELAY_ADMIN_MFA_REQUIRED", "该高风险操作要求管理员先启用并通过多因素认证。", { permission, role: admin.role });
    }
  }

  async function authenticateInstance(request, url, rawBody) {
    const authorization = header(request, "authorization");
    const clientId = authorization.match(/^Instance\s+(.+)$/i)?.[1]?.trim() || header(request, "x-tz-client-id");
    return store.authenticateInstanceRequest({
      clientId,
      timestamp: header(request, "x-tz-timestamp"),
      nonce: header(request, "x-tz-nonce"),
      signature: header(request, "x-tz-signature"),
      method: request.method,
      requestTarget: requestTarget(url),
      rawBody
    });
  }

  function wakeWorker() {
    try {
      worker?.wake?.();
    } catch {
      // The persisted queue will be picked up by the periodic worker tick.
    }
  }

  function adminOverview() {
    const tenants = store.listTenants({ limit: 200 });
    const instances = store.db.prepare(`
      SELECT i.*, t.display_name AS tenant_name
      FROM relay_instances i
      JOIN relay_tenants t ON t.id = i.tenant_id
      ORDER BY i.created_at DESC
      LIMIT 500
    `).all().map(publicAdminInstance);
    const providers = store.db.prepare("SELECT * FROM relay_provider_accounts ORDER BY is_default DESC, created_at ASC").all().map(publicAdminProvider);
    const runs = store.db.prepare(`
      SELECT r.*, t.display_name AS tenant_name
      FROM relay_runs r
      JOIN relay_tenants t ON t.id = r.tenant_id
      ORDER BY r.submitted_at DESC
      LIMIT 200
    `).all().map(publicAdminRun);
    const attention = store.listAttentionItems({ limit: 100 });
    const ledger = store.db.prepare(`
      SELECT l.*, t.display_name AS tenant_name
      FROM relay_billing_ledger l
      JOIN relay_tenants t ON t.id = l.tenant_id
      ORDER BY l.created_at DESC
      LIMIT 200
    `).all().map(publicAdminLedger);
    return {
      summary: store.getOperationsSummary(),
      analytics: store.getOperationsAnalytics({ days: 30 }),
      settings: store.getOperatorSettings(),
      tenants,
      instances,
      providers,
      runs,
      attention,
      ledger,
      paymentOrders: store.listPaymentOrders({ limit: 200 }),
      invoiceRequests: store.listInvoiceRequests({ limit: 200 }),
      audit: store.listAuditEvents({ limit: 100 }),
      serverTime: new Date().toISOString()
    };
  }

  async function handleAdmin(request, response, url, rawBody) {
    const { pathname } = url;
    const method = request.method;
    if (method === "POST" && pathname === "/api/v1/admin/bootstrap") {
      if (!adminTransportAllowed(request)) throw adminForbidden("管理员初始化只能通过 HTTPS 访问。");
      if (!rootTokenAuthorized(request)) throw adminUnauthorized();
      if (store.countAdminUsers() > 0) {
        const error = new Error("中央后台已经完成管理员初始化。");
        error.code = "RELAY_ADMIN_ALREADY_BOOTSTRAPPED";
        error.statusCode = 409;
        throw error;
      }
      const body = parseJsonBody(rawBody);
      const user = store.createAdminUser({
        ...body,
        role: "super_admin",
        status: "active",
        createdBy: "root_token"
      });
      json(response, 201, { user, bootstrapComplete: true, serverTime: new Date().toISOString() });
      return true;
    }
    if (method === "POST" && pathname === "/api/v1/admin/login") {
      if (!adminTransportAllowed(request)) throw adminForbidden("管理员登录只能通过 HTTPS 访问。");
      const body = parseJsonBody(rawBody);
      const authenticated = store.authenticateAdminCredentials({
        username: body.username,
        password: body.password,
        totp: body.totp
      });
      const created = store.createAdminSession({
        ttlSeconds: adminSessionTtlSeconds,
        role: authenticated.user.role,
        adminUserId: authenticated.user.adminUserId,
        authSource: "password",
        actorLabel: authenticated.user.displayName,
        mfaVerified: authenticated.mfaVerified,
        remoteAddress: requestRemoteAddress(request, trustedProxyAddresses),
        userAgent: requestUserAgent(request)
      });
      json(response, 201, {
        authenticated: true,
        authType: "session",
        role: created.session.role,
        permissions: permissionsForAdminRole(created.session.role),
        adminUserId: created.session.adminUserId,
        username: created.session.username,
        displayName: created.session.displayName,
        mfaVerified: created.session.mfaVerified,
        expiresAt: created.session.expiresAt,
        serverTime: new Date().toISOString()
      }, { "Set-Cookie": sessionCookie(created.sessionToken, adminSessionTtlSeconds) });
      return true;
    }
    // The root token is a bootstrap/CLI credential only. Browser operators
    // exchange it once for an opaque, short-lived HttpOnly session cookie.
    if (method === "POST" && pathname === "/api/v1/admin/session") {
      if (!adminTransportAllowed(request)) throw adminForbidden("管理员登录只能通过 HTTPS 访问。");
      if (!rootTokenAuthorized(request)) throw adminUnauthorized();
      const body = parseJsonBody(rawBody);
      const created = store.createAdminSession({
        ttlSeconds: adminSessionTtlSeconds,
        role: "operator",
        authSource: "root_token",
        actorLabel: body.operatorLabel || body.operator || "",
        remoteAddress: requestRemoteAddress(request, trustedProxyAddresses),
        userAgent: requestUserAgent(request)
      });
      json(response, 201, {
        authenticated: true,
        authType: "session",
        role: created.session.role,
        permissions: ["*"],
        emergency: true,
        expiresAt: created.session.expiresAt,
        serverTime: new Date().toISOString()
      }, { "Set-Cookie": sessionCookie(created.sessionToken, adminSessionTtlSeconds) });
      return true;
    }

    const admin = requireAdmin(request);
    if (method === "DELETE" && pathname === "/api/v1/admin/session") {
      const revoked = admin.type === "session"
        ? store.revokeAdminSession(admin.sessionToken, { reason: "operator_logout", actorType: admin.actorType })
        : null;
      json(response, 200, {
        authenticated: false,
        loggedOut: true,
        revoked: Boolean(revoked),
        serverTime: new Date().toISOString()
      }, { "Set-Cookie": expiredSessionCookie() });
      return true;
    }
    if (method === "GET" && pathname === "/api/v1/admin/session") {
      json(response, 200, {
        authenticated: true,
        authType: admin.type === "session" ? "session" : "root_token",
        role: admin.role,
        permissions: admin.permissions,
        emergency: Boolean(admin.emergency),
        adminUserId: admin.session?.adminUserId || null,
        username: admin.session?.username || "",
        displayName: admin.session?.displayName || "",
        mfaVerified: Boolean(admin.session?.mfaVerified),
        expiresAt: admin.session?.expiresAt || null,
        serverTime: new Date().toISOString()
      });
      return true;
    }
    if (method === "POST" && pathname === "/api/v1/admin/me/mfa/enroll") {
      if (!admin.session?.adminUserId) throw adminAccessDenied("RELAY_ADMIN_NAMED_ACCOUNT_REQUIRED", "根凭证会话不能绑定个人多因素认证，请使用命名管理员账号。");
      const enrollment = store.beginAdminMfaEnrollment(admin.session.adminUserId, { actorType: admin.actorType });
      json(response, 201, { enrollment, serverTime: new Date().toISOString() });
      return true;
    }
    if (method === "POST" && pathname === "/api/v1/admin/me/mfa/confirm") {
      if (!admin.session?.adminUserId) throw adminAccessDenied("RELAY_ADMIN_NAMED_ACCOUNT_REQUIRED", "根凭证会话不能绑定个人多因素认证，请使用命名管理员账号。");
      const body = parseJsonBody(rawBody);
      const user = store.confirmAdminMfaEnrollment(admin.session.adminUserId, body.totp, { actorType: admin.actorType });
      const session = store.markAdminSessionMfaVerified(admin.sessionToken);
      json(response, 200, { user, mfaVerified: Boolean(session?.mfaVerified), serverTime: new Date().toISOString() });
      return true;
    }
    requireAdminPermission(admin, method, pathname);
    if (method === "GET" && pathname === "/api/v1/admin/users") {
      json(response, 200, { users: store.listAdminUsers({ limit: parseLimit(url.searchParams.get("limit"), 200, 1_000) }) });
      return true;
    }
    if (method === "POST" && pathname === "/api/v1/admin/users") {
      const user = store.createAdminUser({ ...parseJsonBody(rawBody), createdBy: admin.actorType });
      json(response, 201, { user });
      return true;
    }
    const adminPasswordResetMatch = pathname.match(/^\/api\/v1\/admin\/users\/([^/]+)\/password$/);
    if (method === "POST" && adminPasswordResetMatch) {
      const body = parseJsonBody(rawBody);
      const user = store.resetAdminPassword(pathSegment(adminPasswordResetMatch[1]), body.password, { actorType: admin.actorType });
      json(response, 200, { user, sessionsRevoked: true });
      return true;
    }
    const adminSessionRevokeMatch = pathname.match(/^\/api\/v1\/admin\/users\/([^/]+)\/sessions\/revoke$/);
    if (method === "POST" && adminSessionRevokeMatch) {
      const revoked = store.revokeAdminUserSessions(pathSegment(adminSessionRevokeMatch[1]), { actorType: admin.actorType, reason: parseJsonBody(rawBody).reason || "operator_revoked" });
      json(response, 200, { revoked });
      return true;
    }
    const adminMfaDisableMatch = pathname.match(/^\/api\/v1\/admin\/users\/([^/]+)\/mfa\/disable$/);
    if (method === "POST" && adminMfaDisableMatch) {
      const user = store.disableAdminMfa(pathSegment(adminMfaDisableMatch[1]), { actorType: admin.actorType });
      json(response, 200, { user, sessionsRevoked: true });
      return true;
    }
    const adminUserMatch = pathname.match(/^\/api\/v1\/admin\/users\/([^/]+)$/);
    if (method === "PATCH" && adminUserMatch) {
      const user = store.updateAdminUser(pathSegment(adminUserMatch[1]), parseJsonBody(rawBody), { actorType: admin.actorType });
      json(response, 200, { user });
      return true;
    }
    if (method === "GET" && pathname === "/api/v1/admin/overview") {
      json(response, 200, adminOverview());
      return true;
    }
    if (method === "GET" && pathname === "/api/v1/admin/ops/summary") {
      const provider = store.db.prepare("SELECT * FROM relay_provider_accounts WHERE is_default = 1 ORDER BY created_at ASC LIMIT 1").get();
      json(response, 200, {
        summary: store.getOperationsSummary(),
        attention: store.listAttentionItems({ limit: parseLimit(url.searchParams.get("limit"), 100, 1_000) }),
        runtime: {
          aidsoMode: runtimeConfig.aidsoMode || "unknown",
          workerEnabled: runtimeConfig.workerEnabled !== false,
          deliveryRetentionDays: Number(runtimeConfig.deliveryRetentionDays || 90),
          auditRetentionDays: Number(runtimeConfig.auditRetentionDays || 365),
          rawResponseRetentionDays: effectiveRawResponseRetentionDays(),
          rawResponseRetentionCeilingDays,
          adminSessionTtlSeconds: Number(runtimeConfig.adminSessionTtlSeconds || 3_600),
          adminSessionRetentionDays: Number(runtimeConfig.adminSessionRetentionDays || 7)
        },
        provider: provider ? publicAdminProvider(provider) : null,
        serverTime: new Date().toISOString()
      });
      return true;
    }
    if (method === "GET" && pathname === "/api/v1/admin/deliveries/dead-letter") {
      json(response, 200, {
        deliveries: store.listDeadLetterDeliveries({ limit: parseLimit(url.searchParams.get("limit"), 100, 1_000) }),
        serverTime: new Date().toISOString()
      });
      return true;
    }
    const deadLetterRequeueMatch = pathname.match(/^\/api\/v1\/admin\/deliveries\/([^/]+)\/requeue$/);
    if (method === "POST" && deadLetterRequeueMatch) {
      const body = parseJsonBody(rawBody);
      const delivery = store.requeueDeadLetterDelivery(pathSegment(deadLetterRequeueMatch[1]), {
        actorType: admin.actorType,
        note: body.note
      });
      json(response, 202, { delivery, serverTime: new Date().toISOString() });
      return true;
    }
    if (method === "POST" && pathname === "/api/v1/admin/ops/cleanup") {
      const body = parseJsonBody(rawBody);
      const result = store.cleanupOperationalData({
        deliveryRetentionDays: body.deliveryRetentionDays || runtimeConfig.deliveryRetentionDays,
        auditRetentionDays: body.auditRetentionDays || runtimeConfig.auditRetentionDays,
        adminSessionRetentionDays: body.adminSessionRetentionDays || runtimeConfig.adminSessionRetentionDays,
        rawResponseRetentionDays: effectiveRawResponseRetentionDays(body.rawResponseRetentionDays)
      });
      json(response, 200, { cleanup: result, serverTime: new Date().toISOString() });
      return true;
    }
    if (method === "GET" && pathname === "/api/v1/admin/audit") {
      const limit = parseLimit(url.searchParams.get("limit"), 100, 1_000);
      const rows = store.db.prepare(`
        SELECT id, tenant_id AS tenantId, instance_id AS instanceId, actor_type AS actorType,
               action, entity_type AS entityType, entity_id AS entityId, details_json AS detailsJson, created_at AS createdAt
        FROM relay_audit_events ORDER BY created_at DESC LIMIT ?
      `).all(limit).map((row) => ({
        ...row,
        details: safeParse(row.detailsJson, {})
      }));
      rows.forEach((row) => delete row.detailsJson);
      json(response, 200, { events: rows });
      return true;
    }
    if (method === "GET" && pathname === "/api/v1/admin/tenants") {
      json(response, 200, { tenants: store.listTenants({ limit: parseLimit(url.searchParams.get("limit"), 100, 1_000) }) });
      return true;
    }
    if (method === "POST" && pathname === "/api/v1/admin/tenants") {
      const body = parseJsonBody(rawBody);
      const tenant = store.createTenant({ ...body, actorType: admin.actorType });
      json(response, 201, { tenant });
      return true;
    }
    const creditMatch = pathname.match(/^\/api\/v1\/admin\/tenants\/([^/]+)\/credits$/);
    if (method === "POST" && creditMatch) {
      const body = parseJsonBody(rawBody);
      const result = store.creditTenant(pathSegment(creditMatch[1]), { ...body, actorType: admin.actorType });
      json(response, 200, result);
      return true;
    }
    if (method === "GET" && pathname === "/api/v1/admin/payment-orders") {
      json(response, 200, {
        orders: store.listPaymentOrders({
          tenantId: url.searchParams.get("tenantId") || "",
          status: url.searchParams.get("status") || "",
          limit: parseLimit(url.searchParams.get("limit"), 100, 1_000)
        })
      });
      return true;
    }
    if (method === "POST" && pathname === "/api/v1/admin/payment-orders") {
      const result = store.createPaymentOrder({ ...parseJsonBody(rawBody), actorType: admin.actorType });
      json(response, result.created ? 201 : 200, result);
      return true;
    }
    const paymentOrderConfirmMatch = pathname.match(/^\/api\/v1\/admin\/payment-orders\/([^/]+)\/confirm$/);
    if (method === "POST" && paymentOrderConfirmMatch) {
      const result = store.confirmPaymentOrder(pathSegment(paymentOrderConfirmMatch[1]), { ...parseJsonBody(rawBody), actorType: admin.actorType });
      json(response, 200, result);
      return true;
    }
    const paymentOrderCancelMatch = pathname.match(/^\/api\/v1\/admin\/payment-orders\/([^/]+)\/cancel$/);
    if (method === "POST" && paymentOrderCancelMatch) {
      const result = store.cancelPaymentOrder(pathSegment(paymentOrderCancelMatch[1]), { ...parseJsonBody(rawBody), actorType: admin.actorType });
      json(response, 200, result);
      return true;
    }
    const paymentOrderMatch = pathname.match(/^\/api\/v1\/admin\/payment-orders\/([^/]+)$/);
    if (method === "GET" && paymentOrderMatch) {
      const order = store.getPaymentOrder(pathSegment(paymentOrderMatch[1]));
      if (!order) {
        const error = new Error("支付订单不存在。");
        error.code = "RELAY_NOT_FOUND";
        error.statusCode = 404;
        throw error;
      }
      json(response, 200, { order });
      return true;
    }
    if (method === "GET" && pathname === "/api/v1/admin/invoice-requests") {
      json(response, 200, {
        invoices: store.listInvoiceRequests({
          tenantId: url.searchParams.get("tenantId") || "",
          status: url.searchParams.get("status") || "",
          limit: parseLimit(url.searchParams.get("limit"), 100, 1_000),
          includeBilling: url.searchParams.get("includeBilling") === "true"
        })
      });
      return true;
    }
    if (method === "POST" && pathname === "/api/v1/admin/invoice-requests") {
      const result = store.createInvoiceRequest({ ...parseJsonBody(rawBody), actorType: admin.actorType });
      json(response, result.created ? 201 : 200, result);
      return true;
    }
    const invoiceIssueMatch = pathname.match(/^\/api\/v1\/admin\/invoice-requests\/([^/]+)\/issue$/);
    if (method === "POST" && invoiceIssueMatch) {
      const result = store.issueInvoiceRequest(pathSegment(invoiceIssueMatch[1]), { ...parseJsonBody(rawBody), actorType: admin.actorType });
      json(response, 200, result);
      return true;
    }
    const invoiceVoidMatch = pathname.match(/^\/api\/v1\/admin\/invoice-requests\/([^/]+)\/void$/);
    if (method === "POST" && invoiceVoidMatch) {
      const result = store.voidInvoiceRequest(pathSegment(invoiceVoidMatch[1]), { ...parseJsonBody(rawBody), actorType: admin.actorType });
      json(response, 200, result);
      return true;
    }
    const invoiceRequestMatch = pathname.match(/^\/api\/v1\/admin\/invoice-requests\/([^/]+)$/);
    if (method === "GET" && invoiceRequestMatch) {
      const invoice = store.getInvoiceRequest(pathSegment(invoiceRequestMatch[1]), { includeBilling: url.searchParams.get("includeBilling") === "true" });
      if (!invoice) {
        const error = new Error("开票申请不存在。");
        error.code = "RELAY_NOT_FOUND";
        error.statusCode = 404;
        throw error;
      }
      json(response, 200, { invoice });
      return true;
    }
    if (method === "GET" && pathname === "/api/v1/admin/instances") {
      const rows = store.db.prepare(`
        SELECT i.*, t.display_name AS tenant_name
        FROM relay_instances i JOIN relay_tenants t ON t.id = i.tenant_id
        ORDER BY i.created_at DESC LIMIT ?
      `).all(parseLimit(url.searchParams.get("limit"), 200, 1_000));
      json(response, 200, { instances: rows.map(publicAdminInstance) });
      return true;
    }
    if (method === "POST" && pathname === "/api/v1/admin/instances") {
      const body = parseJsonBody(rawBody);
      const result = store.provisionInstance({ ...body, actorType: admin.actorType });
      json(response, 201, result);
      return true;
    }
    const rotateMatch = pathname.match(/^\/api\/v1\/admin\/instances\/([^/]+)\/rotate-secret$/);
    if (method === "POST" && rotateMatch) {
      const result = store.rotateInstanceSecret(pathSegment(rotateMatch[1]), { ...parseJsonBody(rawBody), actorType: admin.actorType });
      json(response, 200, result);
      return true;
    }
    const statusMatch = pathname.match(/^\/api\/v1\/admin\/instances\/([^/]+)\/status$/);
    if (method === "POST" && statusMatch) {
      const body = parseJsonBody(rawBody);
      const instance = store.setInstanceStatus(pathSegment(statusMatch[1]), body.status, { actorType: admin.actorType });
      json(response, 200, { instance });
      return true;
    }
    const revokeMatch = pathname.match(/^\/api\/v1\/admin\/instances\/([^/]+)\/revoke$/);
    if (method === "POST" && revokeMatch) {
      const instance = store.setInstanceStatus(pathSegment(revokeMatch[1]), "revoked", { actorType: admin.actorType });
      json(response, 200, { instance, revoked: true });
      return true;
    }
    if (method === "GET" && pathname === "/api/v1/admin/providers") {
      const providers = store.db.prepare("SELECT * FROM relay_provider_accounts ORDER BY is_default DESC, created_at ASC").all().map(publicAdminProvider);
      json(response, 200, { providers });
      return true;
    }
    if (method === "POST" && pathname === "/api/v1/admin/providers/aidso") {
      const body = parseJsonBody(rawBody);
      const provider = store.upsertProviderAccount({ ...body, providerCode: "aidso", actorType: admin.actorType });
      json(response, 200, { provider });
      return true;
    }
    if (method === "POST" && pathname === "/api/v1/admin/providers/aidso/test") {
      const testResult = worker?.testProvider ? await worker.testProvider() : { status: "not_ready", message: "中转 Worker 尚未启动。" };
      json(response, testResult.status === "healthy" || testResult.status === "mock" ? 200 : 503, testResult);
      return true;
    }
    if (method === "GET" && pathname === "/api/v1/admin/prices") {
      const providerAccountId = String(url.searchParams.get("providerAccountId") || "").trim();
      const rows = providerAccountId
        ? store.db.prepare("SELECT * FROM relay_price_rules WHERE provider_account_id = ? ORDER BY platform ASC, terminal ASC, mode ASC, updated_at DESC").all(providerAccountId)
        : store.db.prepare("SELECT * FROM relay_price_rules ORDER BY provider_account_id ASC, platform ASC, terminal ASC, mode ASC, updated_at DESC").all();
      json(response, 200, { prices: rows.map(publicAdminPrice) });
      return true;
    }
    if (method === "POST" && pathname === "/api/v1/admin/prices") {
      const price = store.upsertPriceRule({ ...parseJsonBody(rawBody), actorType: admin.actorType });
      json(response, 200, { price });
      return true;
    }
    if (method === "GET" && pathname === "/api/v1/admin/runs") {
      const rows = store.db.prepare(`
        SELECT r.*, t.display_name AS tenant_name
        FROM relay_runs r JOIN relay_tenants t ON t.id = r.tenant_id
        ORDER BY r.submitted_at DESC LIMIT ?
      `).all(parseLimit(url.searchParams.get("limit"), 100, 1_000));
      json(response, 200, { runs: rows.map(publicAdminRun) });
      return true;
    }
    const adminRunMatch = pathname.match(/^\/api\/v1\/admin\/runs\/([^/]+)$/);
    if (method === "GET" && adminRunMatch) {
      const run = store.getRun(pathSegment(adminRunMatch[1]), { includeItems: true, includeResults: true, includeUpstream: true });
      if (!run) {
        const error = new Error("检测运行不存在。");
        error.code = "RELAY_NOT_FOUND";
        error.statusCode = 404;
        throw error;
      }
      json(response, 200, { run });
      return true;
    }
    const retryMatch = pathname.match(/^\/api\/v1\/admin\/items\/([^/]+)\/retry$/);
    if (method === "POST" && retryMatch) {
      const item = store.retryItem(pathSegment(retryMatch[1]), { actorType: admin.actorType });
      wakeWorker();
      json(response, 202, { item });
      return true;
    }
    const reconcileMatch = pathname.match(/^\/api\/v1\/admin\/items\/([^/]+)\/reconcile$/);
    if (method === "POST" && reconcileMatch) {
      const body = parseJsonBody(rawBody);
      const result = store.reconcileAttentionItem(pathSegment(reconcileMatch[1]), {
        ...body,
        actorType: admin.actorType
      });
      wakeWorker();
      json(response, 200, result);
      return true;
    }
    if (method === "GET" && pathname === "/api/v1/admin/ledger") {
      const tenantId = url.searchParams.get("tenantId");
      if (!tenantId) {
        const error = new Error("ledger 查询需要 tenantId。");
        error.code = "RELAY_VALIDATION";
        error.statusCode = 422;
        throw error;
      }
      json(response, 200, { entries: store.listBillingLedger(tenantId, { limit: parseLimit(url.searchParams.get("limit"), 100, 1_000) }) });
      return true;
    }
    if (method === "GET" && pathname === "/api/v1/admin/analytics") {
      json(response, 200, store.getOperationsAnalytics({ days: parseLimit(url.searchParams.get("days"), 30, 365) }));
      return true;
    }
    if (method === "GET" && pathname === "/api/v1/admin/settings") {
      json(response, 200, { settings: store.getOperatorSettings() });
      return true;
    }
    if (["PUT", "PATCH", "POST"].includes(method) && pathname === "/api/v1/admin/settings") {
      const settings = store.updateOperatorSettings(parseJsonBody(rawBody), { actorType: admin.actorType });
      json(response, 200, { settings });
      return true;
    }
    return false;
  }

  async function handleClient(request, response, url, rawBody) {
    const auth = await authenticateInstance(request, url, rawBody);
    const instanceId = auth.instance.instanceId;
    const { pathname } = url;
    const method = request.method;
    if (method === "GET" && pathname === "/client/v1/capabilities") {
      json(response, 200, store.listCapabilitiesForInstance(instanceId));
      return true;
    }
    if (method === "GET" && pathname === "/client/v1/quota") {
      json(response, 200, store.getQuotaForInstance(instanceId));
      return true;
    }
    if (method === "POST" && pathname === "/client/v1/heartbeat") {
      json(response, 200, { accepted: true, instanceId, serverTime: new Date().toISOString(), quota: store.getQuotaForInstance(instanceId) });
      return true;
    }
    if (method === "POST" && pathname === "/client/v1/effect-runs/quote") {
      const body = parseJsonBody(rawBody);
      json(response, 200, store.quoteEffectRun({ ...body, instanceId }));
      return true;
    }
    if (method === "POST" && pathname === "/client/v1/effect-runs") {
      const body = parseJsonBody(rawBody);
      const idempotencyKey = header(request, "idempotency-key");
      const result = store.createEffectRun({ ...body, instanceId, idempotencyKey });
      wakeWorker();
      json(response, result.created ? 202 : 200, { relayRunId: result.run.relayRunId, created: result.created, run: result.run });
      return true;
    }
    if (method === "GET" && pathname === "/client/v1/effect-runs") {
      json(response, 200, { runs: store.listRunsForInstance(instanceId, { limit: parseLimit(url.searchParams.get("limit"), 50, 500) }) });
      return true;
    }
    const runMatch = pathname.match(/^\/client\/v1\/effect-runs\/([^/]+)$/);
    if (method === "GET" && runMatch) {
      const run = store.getRunForInstance(instanceId, pathSegment(runMatch[1]), {
        includeItems: url.searchParams.get("includeItems") === "true",
        includeResults: url.searchParams.get("includeResults") === "true"
      });
      if (!run) {
        const error = new Error("检测运行不存在。");
        error.code = "RELAY_NOT_FOUND";
        error.statusCode = 404;
        throw error;
      }
      json(response, 200, { run });
      return true;
    }
    const cancelRunMatch = pathname.match(/^\/client\/v1\/effect-runs\/([^/]+)\/cancel$/);
    if (method === "POST" && cancelRunMatch) {
      const runId = pathSegment(cancelRunMatch[1]);
      const current = store.getRunForInstance(instanceId, runId);
      if (!current) {
        const error = new Error("检测运行不存在。");
        error.code = "RELAY_NOT_FOUND";
        error.statusCode = 404;
        throw error;
      }
      const run = store.cancelRun(runId, { instanceId, actorType: "instance" });
      wakeWorker();
      json(response, 200, { run });
      return true;
    }
    if (method === "GET" && pathname === "/client/v1/deliveries") {
      const consumerId = header(request, "x-tz-delivery-consumer") || `instance:${instanceId}`;
      const deliveries = store.leaseDeliveries({ instanceId, consumerId, limit: parseLimit(url.searchParams.get("limit"), 50, 200) });
      json(response, 200, { deliveries, serverTime: new Date().toISOString() });
      return true;
    }
    const ackMatch = pathname.match(/^\/client\/v1\/deliveries\/([^/]+)\/ack$/);
    if (method === "POST" && ackMatch) {
      const body = parseJsonBody(rawBody);
      const consumerId = header(request, "x-tz-delivery-consumer") || `instance:${instanceId}`;
      const result = store.acknowledgeDelivery({ instanceId, deliveryId: pathSegment(ackMatch[1]), consumerId, payloadHash: body.payloadHash || body.payloadSha256 || "" });
      json(response, 200, result);
      return true;
    }
    const releaseMatch = pathname.match(/^\/client\/v1\/deliveries\/([^/]+)\/release$/);
    if (method === "POST" && releaseMatch) {
      const body = parseJsonBody(rawBody);
      const consumerId = header(request, "x-tz-delivery-consumer") || `instance:${instanceId}`;
      const result = store.releaseDelivery({ instanceId, deliveryId: pathSegment(releaseMatch[1]), consumerId, delayMs: body.delayMs, error: body.error || "" });
      json(response, 200, result);
      return true;
    }
    return false;
  }

  return {
    async handle(request, response, url) {
      const pathname = url.pathname;
      if (!pathname.startsWith("/api/v1/admin/") && !pathname.startsWith("/client/v1/")) return false;
      try {
        const rawBody = ["POST", "PUT", "PATCH"].includes(request.method) ? await readRawBody(request) : Buffer.alloc(0);
        const handled = pathname.startsWith("/api/v1/admin/")
          ? await handleAdmin(request, response, url, rawBody)
          : await handleClient(request, response, url, rawBody);
        if (!handled) {
          text(response, 404, "Not found");
        }
      } catch (error) {
        relayErrorResponse(response, error);
      }
      return true;
    }
  };
}
