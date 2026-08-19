/**
 * A deliberately small stdio MCP server for Tongzhuo central-relay operations.
 *
 * It is intentionally dependency-free: the relay package does not currently
 * ship @modelcontextprotocol/sdk, so this implements the JSON-RPC messages
 * used by the MCP stdio transport (initialize, tools/list and tools/call).
 *
 * The process never accepts an administrator token as a tool argument.  It
 * reads TZ_RELAY_ADMIN_TOKEN (or TZ_RELAY_ADMIN_TOKEN_FILE) when it starts and
 * forwards only an Authorization header to the existing central admin API.
 */
import { randomBytes, randomUUID } from "node:crypto";
import {
  chmodSync,
  closeSync,
  openSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync
} from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

const SERVER_NAME = "tongzhuo-relay-operations";
const SERVER_VERSION = "0.1.0";
const PROTOCOL_VERSION = "2025-06-18";
const SUPPORTED_PROTOCOL_VERSIONS = new Set([PROTOCOL_VERSION, "2025-03-26", "2024-11-05"]);
const MAX_LINE_BYTES = 1_048_576;
const MAX_RESPONSE_BYTES = 1_048_576;
const MAX_TOOL_OUTPUT_BYTES = 512 * 1024;
const SAFE_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;
const SAFE_STATUS_PATTERN = /^[A-Za-z_]{1,64}$/;
const SENSITIVE_KEY_PATTERN = /(authorization|token|secret|password|cookie|api[_-]?key|credential|upstream.*(?:response|payload)|raw(?:_payload)?|normalized)/i;
const SECRET_TEXT_PATTERN = /(?:bearer\s+|(?:authorization|token|secret|password|api[_-]?key)\s*[:=]\s*)[^\s,;]+/ig;
const LIKELY_BARE_SECRET_PATTERN = /\b[A-Za-z0-9_-]{32,}\b/;
const SAFE_REDACTION_EXCEPTION_KEYS = new Set(["credentialHandoff"]);

class RelayMcpError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "RelayMcpError";
    this.code = code;
  }
}

function own(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function relayMcpError(code, message) {
  return new RelayMcpError(code, message);
}

function readEnvironmentText(environment, name) {
  return String(environment?.[name] || "").trim();
}

/**
 * Resolve the same administrator credential used by the central API.  File
 * injection is preferred in production and avoids placing the token in a
 * process command line or MCP client configuration.
 */
export function resolveRelayMcpAdminToken(environment = process.env) {
  const direct = readEnvironmentText(environment, "TZ_RELAY_ADMIN_TOKEN");
  if (direct) return direct;
  const filePath = readEnvironmentText(environment, "TZ_RELAY_ADMIN_TOKEN_FILE");
  if (!filePath) {
    throw relayMcpError("RELAY_MCP_CONFIGURATION", "TZ_RELAY_ADMIN_TOKEN or TZ_RELAY_ADMIN_TOKEN_FILE is required for the MCP adapter.");
  }
  try {
    const token = readFileSync(filePath, "utf8").trim();
    if (!token) throw new Error("empty token");
    return token;
  } catch {
    throw relayMcpError("RELAY_MCP_CONFIGURATION", "The configured administrator token file could not be read.");
  }
}

function parsePositiveInteger(value, fallback, minimum, maximum) {
  const number = Number(value);
  if (!Number.isInteger(number)) return fallback;
  return Math.max(minimum, Math.min(maximum, number));
}

function isLoopbackHost(hostname) {
  const normalized = String(hostname || "").trim().toLowerCase();
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1" || normalized === "[::1]";
}

/**
 * MCP can talk to a local relay over HTTP during development.  A non-loopback
 * relay must use HTTPS so the injected administrator credential is never sent
 * across an unencrypted network.
 */
export function resolveRelayMcpBaseUrl(environment = process.env) {
  const configured = readEnvironmentText(environment, "TZ_RELAY_MCP_URL")
    || readEnvironmentText(environment, "TZ_RELAY_URL")
    || "http://127.0.0.1:44280";
  let parsed;
  try {
    parsed = new URL(configured);
  } catch {
    throw relayMcpError("RELAY_MCP_CONFIGURATION", "TZ_RELAY_MCP_URL must be an absolute HTTP(S) URL.");
  }
  if (!/^https?:$/.test(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw relayMcpError("RELAY_MCP_CONFIGURATION", "TZ_RELAY_MCP_URL must be a clean HTTP(S) relay URL without credentials or query parameters.");
  }
  if (parsed.protocol === "http:" && !isLoopbackHost(parsed.hostname)) {
    throw relayMcpError("RELAY_MCP_CONFIGURATION", "A non-loopback MCP relay URL must use HTTPS.");
  }
  const basePath = parsed.pathname.replace(/\/+$/, "");
  return `${parsed.origin}${basePath}`;
}

function resolveSecretHandoffDirectory(value) {
  const configured = String(value || "").trim();
  if (!configured) return null;
  if (!path.isAbsolute(configured)) {
    throw relayMcpError("RELAY_MCP_CONFIGURATION", "TZ_RELAY_MCP_SECRET_HANDOFF_DIR must be an absolute existing directory.");
  }
  try {
    const directory = realpathSync(configured);
    if (!statSync(directory).isDirectory()) throw new Error("not a directory");
    return directory;
  } catch {
    throw relayMcpError("RELAY_MCP_CONFIGURATION", "TZ_RELAY_MCP_SECRET_HANDOFF_DIR must be an absolute existing directory.");
  }
}

function appendRelayPath(baseUrl, requestPath) {
  const pathname = String(requestPath || "");
  if (!pathname.startsWith("/")) throw relayMcpError("RELAY_MCP_INTERNAL", "Invalid central relay request path.");
  return `${baseUrl}${pathname}`;
}

async function readBoundedResponse(response, maximum = MAX_RESPONSE_BYTES) {
  const declared = Number(response.headers?.get?.("content-length") || 0);
  if (Number.isFinite(declared) && declared > maximum) {
    try { await response.body?.cancel?.(); } catch { /* no body cleanup available */ }
    throw relayMcpError("RELAY_MCP_RESPONSE_TOO_LARGE", "The central relay response exceeded the MCP adapter safety limit.");
  }
  const reader = response.body?.getReader?.();
  if (!reader) return "";
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      const chunk = Buffer.from(next.value);
      total += chunk.length;
      if (total > maximum) {
        try { await reader.cancel(); } catch { /* best effort */ }
        throw relayMcpError("RELAY_MCP_RESPONSE_TOO_LARGE", "The central relay response exceeded the MCP adapter safety limit.");
      }
      chunks.push(chunk);
    }
  } finally {
    reader.releaseLock?.();
  }
  return Buffer.concat(chunks, total).toString("utf8");
}

function safeHttpError(status) {
  if (status === 401 || status === 403) return relayMcpError("RELAY_ADMIN_UNAUTHORIZED", "The central relay rejected the MCP administrator credential.");
  if (status === 404) return relayMcpError("RELAY_NOT_FOUND", "The requested central relay record was not found.");
  if (status === 409) return relayMcpError("RELAY_STATE_CONFLICT", "The requested operation conflicts with the current relay state.");
  if (status === 413) return relayMcpError("RELAY_RESPONSE_TOO_LARGE", "The central relay refused the request because its response is too large.");
  if (status === 422) return relayMcpError("RELAY_VALIDATION", "The central relay rejected the operation parameters.");
  if (status >= 500) return relayMcpError("RELAY_UNAVAILABLE", "The central relay is temporarily unavailable.");
  return relayMcpError("RELAY_ADMIN_REQUEST_FAILED", `The central relay request failed with HTTP ${status}.`);
}

/**
 * Use the regular admin API rather than opening the relay's SQLite database.
 * This preserves the API authorization boundary, transactional behaviour and
 * worker wake-up semantics for retry/reconciliation actions.
 */
export function createRelayMcpAdminClient(options = {}) {
  const environment = options.environment || process.env;
  const baseUrl = options.baseUrl || resolveRelayMcpBaseUrl(environment);
  const adminToken = options.adminToken === undefined ? resolveRelayMcpAdminToken(environment) : String(options.adminToken || "").trim();
  const timeoutMs = parsePositiveInteger(options.timeoutMs ?? environment.TZ_RELAY_MCP_TIMEOUT_MS, 10_000, 1_000, 60_000);
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (adminToken.length < 16) {
    throw relayMcpError("RELAY_MCP_CONFIGURATION", "The MCP adapter requires a securely generated administrator token of at least 16 characters.");
  }
  if (typeof fetchImpl !== "function") throw relayMcpError("RELAY_MCP_CONFIGURATION", "This Node runtime does not provide fetch for the MCP adapter.");

  async function request(method, requestPath, body = undefined) {
    const headers = {
      accept: "application/json",
      authorization: `Bearer ${adminToken}`
    };
    const init = {
      method,
      headers,
      redirect: "error",
      signal: AbortSignal.timeout(timeoutMs)
    };
    if (body !== undefined) {
      headers["content-type"] = "application/json";
      init.body = JSON.stringify(body);
    }
    let response;
    try {
      response = await fetchImpl(appendRelayPath(baseUrl, requestPath), init);
    } catch {
      throw relayMcpError("RELAY_UNAVAILABLE", "The central relay could not be reached by the MCP adapter.");
    }
    let rawBody = "";
    try {
      rawBody = await readBoundedResponse(response);
    } catch (error) {
      if (error instanceof RelayMcpError) throw error;
      throw relayMcpError("RELAY_UNAVAILABLE", "The central relay response could not be read safely.");
    }
    if (!response.ok) throw safeHttpError(response.status);
    try {
      const parsed = rawBody ? JSON.parse(rawBody) : {};
      if (!isPlainObject(parsed)) throw new Error("not object");
      return parsed;
    } catch {
      throw relayMcpError("RELAY_INVALID_RESPONSE", "The central relay returned an invalid management response.");
    }
  }

  return Object.freeze({ request, baseUrl, timeoutMs });
}

function cleanDisplayText(value, maximum = 240) {
  SECRET_TEXT_PATTERN.lastIndex = 0;
  const redacted = String(value ?? "").replace(SECRET_TEXT_PATTERN, "[REDACTED]");
  SECRET_TEXT_PATTERN.lastIndex = 0;
  return redacted.slice(0, maximum);
}

function containsSecretText(value) {
  SECRET_TEXT_PATTERN.lastIndex = 0;
  const found = SECRET_TEXT_PATTERN.test(String(value ?? ""));
  SECRET_TEXT_PATTERN.lastIndex = 0;
  return found;
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function safeNullableNumber(value) {
  return value === null || value === undefined ? null : safeNumber(value);
}

function safeTimestamp(value) {
  const text = String(value || "").trim();
  return text && Number.isFinite(Date.parse(text)) ? text : null;
}

function safeTenant(row) {
  const wallet = isPlainObject(row?.wallet) ? row.wallet : {};
  return {
    tenantId: cleanDisplayText(row?.tenantId, 128),
    displayName: cleanDisplayText(row?.displayName, 240),
    status: cleanDisplayText(row?.status, 64),
    wallet: {
      availableCredits: safeNumber(wallet.availableCredits),
      heldCredits: safeNumber(wallet.heldCredits),
      revision: safeNumber(wallet.revision),
      updatedAt: safeTimestamp(wallet.updatedAt)
    },
    createdAt: safeTimestamp(row?.createdAt),
    updatedAt: safeTimestamp(row?.updatedAt)
  };
}

function safeInstance(row) {
  return {
    instanceId: cleanDisplayText(row?.instanceId, 128),
    tenantId: cleanDisplayText(row?.tenantId, 128),
    tenantName: cleanDisplayText(row?.tenantName, 240),
    displayName: cleanDisplayText(row?.displayName, 240),
    clientId: cleanDisplayText(row?.clientId, 256),
    secretVersion: safeNumber(row?.secretVersion),
    status: cleanDisplayText(row?.status, 64),
    maxInFlight: safeNumber(row?.maxInFlight),
    dailyCreditLimit: safeNumber(row?.dailyCreditLimit),
    monthlyCreditLimit: safeNumber(row?.monthlyCreditLimit),
    lastSeenAt: safeTimestamp(row?.lastSeenAt),
    createdAt: safeTimestamp(row?.createdAt),
    updatedAt: safeTimestamp(row?.updatedAt)
  };
}

function safeRun(row) {
  return {
    relayRunId: cleanDisplayText(row?.relayRunId, 128),
    tenantId: cleanDisplayText(row?.tenantId, 128),
    tenantName: cleanDisplayText(row?.tenantName, 240),
    instanceId: cleanDisplayText(row?.instanceId, 128),
    clientRunId: cleanDisplayText(row?.clientRunId, 256),
    status: cleanDisplayText(row?.status, 64),
    billingStatus: cleanDisplayText(row?.billingStatus, 64),
    projectId: cleanDisplayText(row?.projectId, 256),
    questionSetId: cleanDisplayText(row?.questionSetId, 256),
    totalItems: safeNumber(row?.totalItems),
    completedItems: safeNumber(row?.completedItems),
    failedItems: safeNumber(row?.failedItems),
    estimatedCustomerCredits: safeNumber(row?.estimatedCustomerCredits),
    heldCustomerCredits: safeNumber(row?.heldCustomerCredits),
    settledCustomerCredits: safeNumber(row?.settledCustomerCredits),
    submittedAt: safeTimestamp(row?.submittedAt),
    startedAt: safeTimestamp(row?.startedAt),
    completedAt: safeTimestamp(row?.completedAt),
    updatedAt: safeTimestamp(row?.updatedAt)
  };
}

/**
 * Never expose prompts, raw/normalised AIDSO content, upstream request IDs or
 * upstream response metadata through this operational MCP surface.
 */
function safeTaskItem(row) {
  return {
    relayItemId: cleanDisplayText(row?.relayItemId, 128),
    relayRunId: cleanDisplayText(row?.relayRunId, 128),
    questionId: cleanDisplayText(row?.questionId, 256),
    ordinal: safeNumber(row?.ordinal),
    platform: cleanDisplayText(row?.platform, 64),
    terminal: cleanDisplayText(row?.terminal, 64),
    mode: cleanDisplayText(row?.mode, 64),
    status: cleanDisplayText(row?.status, 64),
    customerCredits: safeNumber(row?.customerCredits),
    submitAttempts: safeNumber(row?.submitAttempts),
    pollAttempts: safeNumber(row?.pollAttempts),
    lastErrorCode: cleanDisplayText(row?.lastError?.code || row?.lastErrorCode || "", 120) || null,
    observedAt: safeTimestamp(row?.observedAt),
    completedAt: safeTimestamp(row?.completedAt),
    updatedAt: safeTimestamp(row?.updatedAt)
  };
}

function safeProvider(row) {
  if (!isPlainObject(row)) return null;
  return {
    providerAccountId: cleanDisplayText(row.providerAccountId, 128),
    providerCode: cleanDisplayText(row.providerCode, 64),
    displayName: cleanDisplayText(row.displayName, 240),
    status: cleanDisplayText(row.status, 64),
    lastKnownBalance: safeNullableNumber(row.lastKnownBalance),
    maxInFlight: safeNumber(row.maxInFlight),
    lastHealthAt: safeTimestamp(row.lastHealthAt),
    lastHealthStatus: cleanDisplayText(row.lastHealthStatus, 64)
  };
}

function safeOperationsSummary(payload) {
  const summary = isPlainObject(payload?.summary) ? payload.summary : {};
  const runtime = isPlainObject(payload?.runtime) ? payload.runtime : {};
  const attention = Array.isArray(payload?.attention) ? payload.attention : [];
  return {
    serverTime: safeTimestamp(payload?.serverTime),
    summary: {
      activeTenants: safeNumber(summary.activeTenants),
      activeInstances: safeNumber(summary.activeInstances),
      activeRuns: safeNumber(summary.activeRuns),
      activeItems: safeNumber(summary.activeItems),
      attentionItems: safeNumber(summary.attentionItems),
      customerAvailableCredits: safeNumber(summary.customerAvailableCredits),
      customerHeldCredits: safeNumber(summary.customerHeldCredits),
      upstreamCreditsRecorded: safeNumber(summary.upstreamCreditsRecorded)
    },
    runtime: {
      aidsoMode: cleanDisplayText(runtime.aidsoMode, 32),
      workerEnabled: Boolean(runtime.workerEnabled),
      deliveryRetentionDays: safeNumber(runtime.deliveryRetentionDays),
      auditRetentionDays: safeNumber(runtime.auditRetentionDays)
    },
    provider: safeProvider(payload?.provider),
    attention: attention.map(safeTaskItem)
  };
}

/**
 * A final defence-in-depth pass.  The normal path uses whitelists above, but
 * this keeps future response-shape changes from accidentally returning a
 * credential or raw upstream field through a new mapping.
 */
export function redactRelayMcpOutput(value, depth = 0) {
  if (depth > 24) return "[TRUNCATED]";
  if (Array.isArray(value)) return value.map((entry) => redactRelayMcpOutput(entry, depth + 1));
  if (typeof value === "string") return cleanDisplayText(value, 8_192);
  if (!isPlainObject(value)) return value;
  const output = {};
  for (const [key, entry] of Object.entries(value)) {
    if (SENSITIVE_KEY_PATTERN.test(key) && !SAFE_REDACTION_EXCEPTION_KEYS.has(key)) output[key] = "[REDACTED]";
    else output[key] = redactRelayMcpOutput(entry, depth + 1);
  }
  return output;
}

function expectArguments(value) {
  if (value === undefined) return {};
  if (!isPlainObject(value)) throw relayMcpError("RELAY_MCP_INVALID_ARGUMENT", "Tool arguments must be a JSON object.");
  return value;
}

function onlyFields(input, allowed) {
  for (const key of Object.keys(input)) {
    if (!allowed.has(key)) throw relayMcpError("RELAY_MCP_INVALID_ARGUMENT", "The tool request contains an unsupported argument.");
  }
}

function optionalLimit(input, fallback = 50) {
  if (input.limit === undefined) return fallback;
  if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 100) {
    throw relayMcpError("RELAY_MCP_INVALID_ARGUMENT", "limit must be an integer between 1 and 100.");
  }
  return input.limit;
}

function optionalSafeId(input, field) {
  if (input[field] === undefined || input[field] === null || input[field] === "") return "";
  const value = String(input[field]);
  if (!SAFE_ID_PATTERN.test(value)) throw relayMcpError("RELAY_MCP_INVALID_ARGUMENT", `${field} must be a safe relay identifier.`);
  return value;
}

function requiredSafeId(input, field) {
  const value = optionalSafeId(input, field);
  if (!value) throw relayMcpError("RELAY_MCP_INVALID_ARGUMENT", `${field} is required.`);
  return value;
}

function optionalStatus(input) {
  if (input.status === undefined || input.status === null || input.status === "") return "";
  const status = String(input.status).trim();
  if (!SAFE_STATUS_PATTERN.test(status)) throw relayMcpError("RELAY_MCP_INVALID_ARGUMENT", "status must contain only letters and underscores.");
  return status;
}

function requireConfirmation(input, expected) {
  if (input.confirmation !== expected) {
    throw relayMcpError("RELAY_MCP_CONFIRMATION_REQUIRED", `This operation requires confirmation: ${expected}.`);
  }
}

function requiredOperatorNote(input) {
  const note = String(input.note || "").trim();
  if (note.length < 3 || note.length > 500) {
    throw relayMcpError("RELAY_MCP_INVALID_ARGUMENT", "note must contain 3 to 500 non-secret characters.");
  }
  if (containsSecretText(note) || LIKELY_BARE_SECRET_PATTERN.test(note)) {
    throw relayMcpError("RELAY_MCP_INVALID_ARGUMENT", "Do not put tokens, passwords or secrets in an operator note.");
  }
  return note;
}

function filterRows(rows, filters) {
  return rows.filter((row) => {
    if (filters.tenantId && row.tenantId !== filters.tenantId) return false;
    if (filters.instanceId && row.instanceId !== filters.instanceId) return false;
    if (filters.status && row.status !== filters.status) return false;
    return true;
  });
}

function writeSecretHandoff(directory, instanceId) {
  const reference = `mcp-handoff-${randomUUID().replaceAll("-", "")}`;
  const filePath = path.join(directory, `${reference}.json`);
  const clientSecret = randomBytes(32).toString("base64url");
  const record = {
    version: 1,
    reference,
    status: "pending",
    instanceId,
    issuedAt: new Date().toISOString(),
    clientSecret
  };
  let descriptor;
  try {
    descriptor = openSync(filePath, "wx", 0o600);
    writeFileSync(descriptor, `${JSON.stringify(record)}\n`, "utf8");
  } catch {
    throw relayMcpError("RELAY_MCP_SECRET_HANDOFF_FAILED", "The secure credential handoff record could not be created; no key rotation was attempted.");
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
  try { chmodSync(filePath, 0o600); } catch { /* ACLs are deployment-managed on Windows. */ }
  return { reference, filePath, record, clientSecret };
}

function updateSecretHandoff(handoff, patch) {
  const next = { ...handoff.record, ...patch };
  try {
    writeFileSync(handoff.filePath, `${JSON.stringify(next)}\n`, { encoding: "utf8", mode: 0o600 });
    try { chmodSync(handoff.filePath, 0o600); } catch { /* best effort */ }
    handoff.record = next;
    return true;
  } catch {
    return false;
  }
}

const TOOL_DEFINITIONS = Object.freeze([
  {
    name: "relay_operations_summary",
    description: "Read a redacted operations summary, provider health and attention-task metadata from the central relay.",
    inputSchema: {
      type: "object",
      properties: { attentionLimit: { type: "integer", minimum: 1, maximum: 100, description: "Maximum attention tasks to return (default 50)." } },
      additionalProperties: false
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  },
  {
    name: "relay_list_customers",
    description: "List central relay customer tenants and their aggregated credit wallets. Metadata and secrets are excluded.",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "integer", minimum: 1, maximum: 100 }, status: { type: "string", description: "Optional exact tenant status." } },
      additionalProperties: false
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  },
  {
    name: "relay_list_instances",
    description: "List customer relay instances and safe quota/status metadata. Client secrets and instance metadata are excluded.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "integer", minimum: 1, maximum: 100 },
        tenantId: { type: "string", description: "Optional exact tenant ID." },
        status: { type: "string", description: "Optional exact instance status." }
      },
      additionalProperties: false
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  },
  {
    name: "relay_list_tasks",
    description: "List central detection runs using only operational status and billing metadata; prompts and upstream results are excluded.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "integer", minimum: 1, maximum: 100 },
        tenantId: { type: "string", description: "Optional exact tenant ID." },
        instanceId: { type: "string", description: "Optional exact instance ID." },
        status: { type: "string", description: "Optional exact run status." }
      },
      additionalProperties: false
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  },
  {
    name: "relay_get_task",
    description: "Get a redacted run and item status view. It deliberately omits prompts, raw results, normalised results and all upstream payloads.",
    inputSchema: {
      type: "object",
      properties: { relayRunId: { type: "string", description: "Central relay run ID." } },
      required: ["relayRunId"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  },
  {
    name: "relay_retry_task",
    description: "Request a retry for an eligible failed, dead-letter or submission-uncertain task. Requires exact confirmation RETRY.",
    inputSchema: {
      type: "object",
      properties: {
        relayItemId: { type: "string", description: "Central relay item ID." },
        confirmation: { type: "string", const: "RETRY", description: "Must be exactly RETRY." }
      },
      required: ["relayItemId", "confirmation"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
  },
  {
    name: "relay_refund_attention_task",
    description: "Manually reconcile a submission-uncertain task by refunding its held customer credits. Requires exact confirmation REFUND and an audit note.",
    inputSchema: {
      type: "object",
      properties: {
        relayItemId: { type: "string", description: "Central relay item ID in submission_uncertain state." },
        confirmation: { type: "string", const: "REFUND", description: "Must be exactly REFUND." },
        note: { type: "string", minLength: 3, maxLength: 500, description: "Reason stored in the central audit trail. Do not include secrets." }
      },
      required: ["relayItemId", "confirmation", "note"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false }
  },
  {
    name: "relay_rotate_instance_secret",
    description: "Rotate an instance signing secret through a preconfigured secure handoff directory. Requires exact confirmation ROTATE; the new secret is never returned through MCP.",
    inputSchema: {
      type: "object",
      properties: {
        instanceId: { type: "string", description: "Central relay instance ID." },
        confirmation: { type: "string", const: "ROTATE", description: "Must be exactly ROTATE." }
      },
      required: ["instanceId", "confirmation"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false }
  }
]);

export function getRelayMcpToolDefinitions() {
  return TOOL_DEFINITIONS;
}

async function executeRelayTool(client, handoffDirectory, name, rawArguments) {
  const input = expectArguments(rawArguments);
  if (name === "relay_operations_summary") {
    onlyFields(input, new Set(["attentionLimit"]));
    const attentionLimit = input.attentionLimit === undefined ? 50 : optionalLimit({ limit: input.attentionLimit }, 50);
    return safeOperationsSummary(await client.request("GET", `/api/v1/admin/ops/summary?limit=${attentionLimit}`));
  }
  if (name === "relay_list_customers") {
    onlyFields(input, new Set(["limit", "status"]));
    const limit = optionalLimit(input);
    const status = optionalStatus(input);
    const fetchLimit = status ? 1_000 : limit;
    const payload = await client.request("GET", `/api/v1/admin/tenants?limit=${fetchLimit}`);
    const tenants = Array.isArray(payload.tenants) ? payload.tenants : [];
    return { tenants: tenants.map(safeTenant).filter((tenant) => !status || tenant.status === status).slice(0, limit) };
  }
  if (name === "relay_list_instances") {
    onlyFields(input, new Set(["limit", "tenantId", "status"]));
    const limit = optionalLimit(input);
    const filters = { tenantId: optionalSafeId(input, "tenantId"), status: optionalStatus(input) };
    const fetchLimit = filters.tenantId || filters.status ? 1_000 : limit;
    const payload = await client.request("GET", `/api/v1/admin/instances?limit=${fetchLimit}`);
    const instances = (Array.isArray(payload.instances) ? payload.instances : []).map(safeInstance);
    return { instances: filterRows(instances, filters).slice(0, limit) };
  }
  if (name === "relay_list_tasks") {
    onlyFields(input, new Set(["limit", "tenantId", "instanceId", "status"]));
    const limit = optionalLimit(input);
    const filters = {
      tenantId: optionalSafeId(input, "tenantId"),
      instanceId: optionalSafeId(input, "instanceId"),
      status: optionalStatus(input)
    };
    const fetchLimit = filters.tenantId || filters.instanceId || filters.status ? 1_000 : limit;
    const payload = await client.request("GET", `/api/v1/admin/runs?limit=${fetchLimit}`);
    const runs = (Array.isArray(payload.runs) ? payload.runs : []).map(safeRun);
    return { runs: filterRows(runs, filters).slice(0, limit) };
  }
  if (name === "relay_get_task") {
    onlyFields(input, new Set(["relayRunId"]));
    const relayRunId = requiredSafeId(input, "relayRunId");
    const payload = await client.request("GET", `/api/v1/admin/runs/${encodeURIComponent(relayRunId)}`);
    const run = safeRun(payload.run);
    return { run, items: (Array.isArray(payload.run?.items) ? payload.run.items : []).map(safeTaskItem) };
  }
  if (name === "relay_retry_task") {
    onlyFields(input, new Set(["relayItemId", "confirmation"]));
    const relayItemId = requiredSafeId(input, "relayItemId");
    requireConfirmation(input, "RETRY");
    const payload = await client.request("POST", `/api/v1/admin/items/${encodeURIComponent(relayItemId)}/retry`, {});
    return { retried: true, item: safeTaskItem(payload.item) };
  }
  if (name === "relay_refund_attention_task") {
    onlyFields(input, new Set(["relayItemId", "confirmation", "note"]));
    const relayItemId = requiredSafeId(input, "relayItemId");
    requireConfirmation(input, "REFUND");
    const note = requiredOperatorNote(input);
    const payload = await client.request("POST", `/api/v1/admin/items/${encodeURIComponent(relayItemId)}/reconcile`, { resolution: "refund", note });
    return { refunded: true, resolution: cleanDisplayText(payload.resolution, 32), item: safeTaskItem(payload.item), run: safeRun(payload.run) };
  }
  if (name === "relay_rotate_instance_secret") {
    onlyFields(input, new Set(["instanceId", "confirmation"]));
    const instanceId = requiredSafeId(input, "instanceId");
    requireConfirmation(input, "ROTATE");
    if (!handoffDirectory) {
      throw relayMcpError("RELAY_MCP_SECRET_HANDOFF_REQUIRED", "Instance secret rotation requires TZ_RELAY_MCP_SECRET_HANDOFF_DIR; MCP never returns client secrets.");
    }
    const handoff = writeSecretHandoff(handoffDirectory, instanceId);
    let payload;
    try {
      payload = await client.request("POST", `/api/v1/admin/instances/${encodeURIComponent(instanceId)}/rotate-secret`, { clientSecret: handoff.clientSecret });
    } catch (error) {
      // A timeout may be ambiguous. Retain the private pending handoff record
      // so an operator can reconcile it against the audited central action.
      updateSecretHandoff(handoff, { status: "pending_review", lastAttemptAt: new Date().toISOString() });
      throw error;
    }
    const instance = safeInstance(payload.instance);
    const finalized = updateSecretHandoff(handoff, {
      status: "ready",
      clientId: instance.clientId,
      secretVersion: instance.secretVersion,
      activatedAt: new Date().toISOString()
    });
    return {
      rotated: true,
      instance,
      credentialHandoff: {
        reference: handoff.reference,
        status: finalized ? "ready" : "pending_review",
        message: finalized
          ? "The new secret was written only to the configured secure handoff directory and was not returned through MCP."
          : "The relay rotation succeeded, but the handoff record needs secure operator review before delivery."
      }
    };
  }
  throw relayMcpError("RELAY_MCP_UNKNOWN_TOOL", "The requested relay MCP tool is not available.");
}

function jsonRpcResult(id, result) {
  return { jsonrpc: "2.0", id, result };
}

function jsonRpcError(id, code, message) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

function toolResult(value, isError = false) {
  const output = redactRelayMcpOutput(value);
  let text = JSON.stringify(output, null, 2);
  if (Buffer.byteLength(text, "utf8") > MAX_TOOL_OUTPUT_BYTES) {
    text = JSON.stringify({ ok: false, error: { code: "RELAY_MCP_OUTPUT_TOO_LARGE", message: "The redacted tool result exceeded the MCP output limit; request a smaller limit." } }, null, 2);
    isError = true;
  }
  return { content: [{ type: "text", text }], isError };
}

function protocolVersionFor(requested) {
  return SUPPORTED_PROTOCOL_VERSIONS.has(String(requested || "")) ? String(requested) : PROTOCOL_VERSION;
}

/**
 * Build a testable MCP request handler.  startRelayMcpStdioServer below wraps
 * it in newline-delimited stdin/stdout, as required by MCP's stdio transport.
 */
export function createRelayMcpServer(options = {}) {
  const environment = options.environment || process.env;
  const client = options.client || createRelayMcpAdminClient({
    environment,
    baseUrl: options.baseUrl,
    adminToken: options.adminToken,
    timeoutMs: options.timeoutMs,
    fetchImpl: options.fetchImpl
  });
  const handoffDirectory = options.secretHandoffDir === undefined
    ? resolveSecretHandoffDirectory(readEnvironmentText(environment, "TZ_RELAY_MCP_SECRET_HANDOFF_DIR"))
    : resolveSecretHandoffDirectory(options.secretHandoffDir);
  let initialized = false;

  async function handleRequest(message) {
    const requestId = isPlainObject(message) && own(message, "id") ? message.id : null;
    if (!isPlainObject(message) || message.jsonrpc !== "2.0" || typeof message.method !== "string") {
      return jsonRpcError(requestId, -32600, "Invalid JSON-RPC request.");
    }
    const isNotification = !own(message, "id");
    if (!isNotification && message.id !== null && typeof message.id !== "string" && typeof message.id !== "number") {
      return jsonRpcError(null, -32600, "Invalid JSON-RPC request id.");
    }
    if (message.method === "initialize") {
      initialized = true;
      if (isNotification) return null;
      return jsonRpcResult(message.id, {
        protocolVersion: protocolVersionFor(message.params?.protocolVersion),
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
        instructions: "This is a restricted Tongzhuo central-relay operations adapter. It never returns administrator tokens, client secrets or upstream raw responses."
      });
    }
    if (message.method === "notifications/initialized" || message.method === "notifications/cancelled") return null;
    if (!initialized) {
      return isNotification ? null : jsonRpcError(message.id, -32002, "MCP initialize must complete before other methods.");
    }
    if (message.method === "ping") return isNotification ? null : jsonRpcResult(message.id, {});
    if (message.method === "tools/list") {
      return isNotification ? null : jsonRpcResult(message.id, { tools: TOOL_DEFINITIONS });
    }
    if (message.method === "tools/call") {
      // Never run a state-changing tool as a JSON-RPC notification: without a
      // request id the caller cannot receive the audited outcome.
      if (isNotification) return null;
      const params = message.params;
      if (!isPlainObject(params) || typeof params.name !== "string") {
        return jsonRpcError(message.id, -32602, "tools/call requires a tool name and an arguments object.");
      }
      try {
        const result = await executeRelayTool(client, handoffDirectory, params.name, params.arguments);
        return jsonRpcResult(message.id, toolResult({ ok: true, data: result }));
      } catch (error) {
        const known = error instanceof RelayMcpError;
        const safeError = known
          ? { code: error.code, message: error.message }
          : { code: "RELAY_MCP_INTERNAL", message: "The MCP adapter could not complete the requested operation." };
        return jsonRpcResult(message.id, toolResult({ ok: false, error: safeError }, true));
      }
    }
    return isNotification ? null : jsonRpcError(message.id, -32601, "MCP method not found.");
  }

  return Object.freeze({ handleRequest, tools: TOOL_DEFINITIONS, client });
}

export async function startRelayMcpStdioServer(options = {}) {
  const server = createRelayMcpServer(options);
  const input = options.input || process.stdin;
  const output = options.output || process.stdout;
  const reader = createInterface({ input, crlfDelay: Infinity });
  for await (const line of reader) {
    if (Buffer.byteLength(line, "utf8") > MAX_LINE_BYTES) {
      output.write(`${JSON.stringify(jsonRpcError(null, -32600, "MCP request exceeds the line-size safety limit."))}\n`);
      continue;
    }
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      output.write(`${JSON.stringify(jsonRpcError(null, -32700, "Invalid JSON in MCP request."))}\n`);
      continue;
    }
    try {
      const response = await server.handleRequest(message);
      if (response) output.write(`${JSON.stringify(response)}\n`);
    } catch {
      // Do not print error objects here: an injected credential must never end
      // up in stdout/stderr because of a future implementation mistake.
      output.write(`${JSON.stringify(jsonRpcError(null, -32603, "MCP server internal error."))}\n`);
    }
  }
}

function launchedDirectly() {
  if (!process.argv[1]) return false;
  try {
    return path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (launchedDirectly()) {
  startRelayMcpStdioServer().catch((error) => {
    const code = error instanceof RelayMcpError ? error.code : "RELAY_MCP_STARTUP_FAILED";
    process.stderr.write(`[relay-mcp] startup failed: ${code}\n`);
    process.exitCode = 1;
  });
}
