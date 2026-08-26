import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  AuthService,
  PERMISSIONS,
  ProductionDatabase,
  WorkspaceConflictError,
  WorkspaceStore,
  permissionsForRole,
  sha256Token
} from "../production-foundation.mjs";

class MockResponse {
  constructor() {
    this.headers = new Map();
  }

  setHeader(name, value) {
    this.headers.set(String(name).toLowerCase(), value);
  }

  getHeader(name) {
    return this.headers.get(String(name).toLowerCase());
  }
}

function request(method = "GET", headers = {}) {
  return {
    method,
    headers,
    socket: { remoteAddress: "127.0.0.1" }
  };
}

function cookiePair(setCookies, name) {
  const row = (Array.isArray(setCookies) ? setCookies : [setCookies]).find((item) => String(item).startsWith(`${name}=`));
  return String(row || "").split(";")[0];
}

const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "tongzhuo-production-foundation-"));
const databasePath = path.join(temporaryDirectory, "foundation.sqlite");
const password = "Test-only strong password 2026!";
let database;

try {
  database = new ProductionDatabase({ databasePath, busyTimeoutMs: 4200 });
  const pragmas = database.pragmas();
  assert.equal(pragmas.journalMode, "wal");
  assert.equal(pragmas.foreignKeys, 1);
  assert.equal(pragmas.busyTimeoutMs, 4200);

  const requiredTables = [
    "migrations",
    "users",
    "sessions",
    "workspace_state",
    "workspace_revisions",
    "business_records",
    "audit_logs"
  ];
  const actualTables = new Set(database.connection.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((row) => row.name));
  requiredTables.forEach((name) => assert.ok(actualTables.has(name), `missing table: ${name}`));
  assert.ok(Number(database.connection.prepare("SELECT COUNT(*) AS count FROM migrations").get().count) >= 2);

  const auth = new AuthService(database, { secureCookies: false, sessionTtlSeconds: 3600 });
  assert.equal(auth.initialized(), false);
  const setupResponse = new MockResponse();
  const setup = await auth.setup({
    username: "admin",
    password,
    displayName: "System Administrator",
    email: "admin@example.invalid"
  }, request("POST", { "user-agent": "foundation-check" }), setupResponse);
  assert.equal(auth.initialized(), true);
  assert.equal(setup.user.role, "admin");
  assert.ok(setup.user.permissions.includes(PERMISSIONS.SYSTEM_MANAGE));
  assert.ok(cookiePair(setupResponse.getHeader("Set-Cookie"), "tz_session"));
  assert.ok(cookiePair(setupResponse.getHeader("Set-Cookie"), "tz_csrf"));

  await assert.rejects(
    () => auth.setup({ username: "second-admin", password }),
    (error) => error?.code === "SETUP_ALREADY_COMPLETED" && error?.status === 409
  );
  await assert.rejects(
    () => auth.login({ username: "admin", password: `${password}-wrong` }, request("POST")),
    (error) => error?.code === "INVALID_CREDENTIALS" && error?.status === 401
  );

  const loginResponse = new MockResponse();
  const login = await auth.login({ username: "ADMIN", password }, request("POST", { "user-agent": "foundation-check" }), loginResponse);
  assert.equal(login.user.id, setup.user.id);
  const sessionRow = database.connection.prepare("SELECT token_hash, csrf_hash FROM sessions WHERE id = ?").get(login.sessionId);
  assert.equal(sessionRow.token_hash, sha256Token(login.sessionToken));
  assert.equal(sessionRow.csrf_hash, sha256Token(login.csrfToken));
  assert.notEqual(sessionRow.token_hash, login.sessionToken);
  assert.notEqual(sessionRow.csrf_hash, login.csrfToken);
  const userRow = database.connection.prepare("SELECT password_hash FROM users WHERE id = ?").get(login.user.id);
  assert.match(userRow.password_hash, /^scrypt\$/);
  assert.notEqual(userRow.password_hash, password);

  const bearerPrincipal = await auth.authenticate(request("GET", { authorization: `Bearer ${login.sessionToken}` }));
  assert.equal(bearerPrincipal.userId, login.user.id);
  await auth.requirePermission(bearerPrincipal, PERMISSIONS.MODELS_MANAGE);
  await assert.rejects(
    () => auth.requirePermission({ userId: "viewer", role: "viewer", permissions: permissionsForRole("viewer") }, PERMISSIONS.WORKSPACE_WRITE),
    (error) => error?.code === "PERMISSION_DENIED" && error?.status === 403
  );

  const sessionCookie = cookiePair(loginResponse.getHeader("Set-Cookie"), "tz_session");
  await assert.rejects(
    () => auth.authenticate(request("POST", { cookie: sessionCookie })),
    (error) => error?.code === "CSRF_INVALID" && error?.status === 403
  );
  const cookiePrincipal = await auth.authenticate(request("POST", {
    cookie: sessionCookie,
    "x-csrf-token": login.csrfToken
  }));
  assert.equal(cookiePrincipal.userId, login.user.id);

  const workspaces = new WorkspaceStore(database);
  assert.deepEqual(workspaces.get("enterprise"), {
    workspaceId: "enterprise",
    revision: 0,
    state: null,
    checksum: null,
    createdAt: null,
    updatedAt: null,
    updatedBy: null
  });
  const state1 = {
    schemaVersion: 12,
    businessLines: [{ id: "BL-1", name: "GEO", status: "active" }],
    questionLibrary: [{ id: "Q-1", businessLineId: "BL-1", question: "客户会问什么？", status: "active" }],
    articles: [{ id: "ART-1", businessLineId: "BL-1", title: "First article", status: "draft" }],
    monitoring: { tasks: [{ id: "MON-1", businessLineId: "BL-1", name: "Baseline", status: "queued" }] }
  };
  const saved1 = workspaces.save("enterprise", state1, {
    expectedRevision: 0,
    actor: bearerPrincipal,
    request: request("PUT", { "user-agent": "foundation-check" }),
    reason: "initial import"
  });
  assert.equal(saved1.revision, 1);
  assert.equal(saved1.recordCounts.business_line, 1);
  assert.equal(saved1.recordCounts.question, 1);
  assert.equal(saved1.recordCounts.article, 1);
  assert.equal(saved1.recordCounts.monitor_task, 1);
  assert.deepEqual(workspaces.get("enterprise").state, state1);
  assert.equal(workspaces.listBusinessRecords("enterprise", "question").length, 1);

  const state2 = structuredClone(state1);
  state2.questionLibrary = [];
  state2.articles[0].status = "approved";
  state2.articles.push({ id: "ART-2", businessLineId: "BL-1", title: "Second article", status: "draft" });
  const saved2 = workspaces.save(state2, {
    workspaceId: "enterprise",
    expectedRevision: 1,
    actorUserId: bearerPrincipal.userId,
    reason: "second revision"
  });
  assert.equal(saved2.revision, 2);
  assert.equal(workspaces.listBusinessRecords("enterprise", "question").length, 0);
  assert.equal(workspaces.listBusinessRecords("enterprise", "article").length, 2);
  assert.equal(workspaces.listRevisions("enterprise").length, 2);
  const duplicate = workspaces.save(state2, {
    workspaceId: "enterprise",
    expectedRevision: 2,
    actorUserId: bearerPrincipal.userId,
    reason: "duplicate browser sync"
  });
  assert.equal(duplicate.revision, 2);
  assert.equal(duplicate.unchanged, true);
  assert.equal(workspaces.listRevisions("enterprise").length, 2);
  await assert.rejects(
    async () => workspaces.save("enterprise", state2, { expectedRevision: 1, actor: bearerPrincipal }),
    (error) => error instanceof WorkspaceConflictError && error.currentRevision === 2 && error.status === 409
  );

  const retainedWorkspaces = new WorkspaceStore(database, { revisionRetention: 2 });
  retainedWorkspaces.save("retained", { value: 1 }, { expectedRevision: 0, actorUserId: bearerPrincipal.userId });
  retainedWorkspaces.save("retained", { value: 2 }, { expectedRevision: 1, actorUserId: bearerPrincipal.userId });
  retainedWorkspaces.save("retained", { value: 3 }, { expectedRevision: 2, actorUserId: bearerPrincipal.userId });
  assert.deepEqual(retainedWorkspaces.listRevisions("retained").map((item) => item.revision), [3, 2]);

  const auditActions = database.connection.prepare("SELECT action FROM audit_logs ORDER BY id").all().map((row) => row.action);
  assert.ok(auditActions.includes("auth.setup"));
  assert.ok(auditActions.includes("auth.login_failed"));
  assert.ok(auditActions.includes("auth.login"));
  assert.equal(auditActions.filter((action) => action === "workspace.save").length, 0);

  const logoutResponse = new MockResponse();
  assert.deepEqual(await auth.logout(login.sessionToken, logoutResponse), { loggedOut: true });
  await assert.rejects(
    () => auth.authenticate(login.sessionToken),
    (error) => error?.code === "SESSION_INVALID" && error?.status === 401
  );
  assert.ok(cookiePair(logoutResponse.getHeader("Set-Cookie"), "tz_session").endsWith("="));

  database.checkpoint("FULL");
  database.close();
  database = null;

  const databaseFiles = (await readdir(temporaryDirectory)).filter((name) => name.startsWith("foundation.sqlite"));
  for (const file of databaseFiles) {
    const bytes = await readFile(path.join(temporaryDirectory, file));
    const contents = bytes.toString("latin1");
    assert.equal(contents.includes(password), false);
    assert.equal(contents.includes(login.sessionToken), false);
    assert.equal(contents.includes(login.csrfToken), false);
  }

  database = new ProductionDatabase({ databasePath, busyTimeoutMs: 4200 });
  assert.ok(Number(database.connection.prepare("SELECT COUNT(*) AS count FROM migrations").get().count) >= 2);
  assert.equal(new AuthService(database, { secureCookies: false }).initialized(), true);
  assert.equal(new WorkspaceStore(database).get("enterprise").revision, 2);

  console.log("Production foundation check passed");
} finally {
  database?.close();
  await rm(temporaryDirectory, { recursive: true, force: true });
}
