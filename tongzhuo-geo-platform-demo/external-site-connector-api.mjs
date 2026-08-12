import { ExternalSiteConnectorError } from "./external-site-connector-store.mjs";

function decode(value) { try { return decodeURIComponent(String(value || "")); } catch { throw new ExternalSiteConnectorError("Route identifier is invalid.", 422, "EXTERNAL_SITE_INVALID_INPUT"); } }

export function createExternalSiteConnectorApi({ store, requestJson, configured }) {
  if (!store || typeof requestJson !== "function") throw new TypeError("External site connector API requires store and requestJson.");
  return async function externalSiteConnectorApi(request, response, parts, principal) {
    const method = String(request.method || "GET").toUpperCase();
    const workspaceId = String(configured?.workspaceId || store.workspaceId || "default");
    if (parts.length === 4 && parts[3] === "connections" && method === "GET") return response.json(200, { ok: true, data: { items: store.list({ workspaceId }) } });
    if (parts.length === 4 && parts[3] === "connections" && method === "POST") {
      const body = await requestJson(request, 300_000);
      const connection = await store.create({ workspaceId, ...body, actor: principal, request });
      return response.json(201, { ok: true, data: { connection } });
    }
    if (parts.length === 5 && parts[3] === "connections" && method === "GET") return response.json(200, { ok: true, data: { connection: store.get(workspaceId, decode(parts[4])) } });
    if (parts.length === 5 && parts[3] === "connections" && method === "PATCH") {
      const body = await requestJson(request, 300_000);
      const connection = await store.update({ workspaceId, connectionId: decode(parts[4]), ...body, actor: principal, request });
      return response.json(200, { ok: true, data: { connection } });
    }
    if (parts.length === 6 && parts[3] === "connections" && parts[5] === "test" && method === "POST") {
      const result = await store.testConnection({ workspaceId, connectionId: decode(parts[4]), actor: principal, request });
      return response.json(200, { ok: true, data: result });
    }
    if (parts.length === 4 && parts[3] === "tasks" && method === "GET") {
      const query = new URL(request.url || "/", "http://localhost").searchParams;
      return response.json(200, { ok: true, data: { items: store.listTasks({ workspaceId, connectionId: query.get("connectionId") || "", articleId: query.get("articleId") || "", limit: query.get("limit") || 100 }) } });
    }
    if (parts.length === 4 && parts[3] === "tasks" && method === "POST") {
      const body = await requestJson(request, 300_000);
      const result = store.createTask({ workspaceId, ...body, actor: principal, request });
      return response.json(result.idempotent ? 200 : 201, { ok: true, data: result });
    }
    if (parts.length === 5 && parts[3] === "tasks" && method === "GET") return response.json(200, { ok: true, data: { task: store.task(workspaceId, decode(parts[4])) } });
    if (parts.length === 6 && parts[3] === "tasks" && parts[5] === "execute" && method === "POST") {
      const result = await store.executeTask({ workspaceId, taskId: decode(parts[4]), actor: principal, request });
      return response.json(200, { ok: true, data: result });
    }
    return response.json(404, { ok: false, code: "EXTERNAL_SITE_ROUTE_NOT_FOUND", message: "External site connector route was not found." });
  };
}

