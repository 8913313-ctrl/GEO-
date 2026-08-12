import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ProductionDatabase } from "../production-database.mjs";
import { AuthService, AuthError, PERMISSIONS } from "../auth-service.mjs";

const directory = await mkdtemp(path.join(os.tmpdir(), "tongzhuo-api-token-"));
const database = new ProductionDatabase({ databasePath: path.join(directory, "token.sqlite") });
try {
  const auth = new AuthService(database, { secureCookies: false });
  const setup = await auth.setup({ username: "token-admin", displayName: "Token Admin", password: "TokenAdmin!2026" });
  const actor = await auth.authenticate(setup.sessionToken);
  assert.throws(() => auth.createApiToken({ name: "invalid", scopes: ["system.root"] }, actor), (error) => error instanceof AuthError && error.code === "API_TOKEN_SCOPES_INVALID");
  const created = auth.createApiToken({ name: "只读集成", scopes: [PERMISSIONS.WORKSPACE_READ], expiresAt: new Date(Date.now() + 86_400_000).toISOString() }, actor);
  assert.match(created.token, /^tz_pat_/);
  assert.equal(JSON.stringify(auth.listApiTokens(actor.userId)).includes(created.token), false, "raw token must only be returned once");
  const principal = await auth.authenticate({ method: "GET", headers: { authorization: `Bearer ${created.token}` } });
  await auth.requirePermission(principal, PERMISSIONS.WORKSPACE_READ);
  await assert.rejects(() => auth.requirePermission(principal, PERMISSIONS.WORKSPACE_WRITE), (error) => error.code === "PERMISSION_DENIED");
  assert.ok(auth.listApiTokens(actor.userId)[0].lastUsedAt);
  auth.revokeApiToken(created.item.id, actor);
  await assert.rejects(() => auth.authenticate({ method: "GET", headers: { authorization: `Bearer ${created.token}` } }), (error) => error.code === "API_TOKEN_INVALID");
  assert.equal(database.connection.prepare("SELECT token_hash FROM api_tokens WHERE id = ?").get(created.item.id).token_hash.length, 64);
  console.log("Scoped API token hash storage, one-time secret, expiry, least privilege, last-use and revocation checks passed.");
} finally {
  database.close();
  await rm(directory, { recursive: true, force: true });
}
