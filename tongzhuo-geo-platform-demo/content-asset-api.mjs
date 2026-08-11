import { ContentAssetError } from "./content-asset-store.mjs";

function bodyData(payload = {}) { return payload?.data && typeof payload.data === "object" ? payload.data : payload; }
function limit(value, fallback = 500) { const parsed = Number(value); return Number.isInteger(parsed) ? Math.max(1, Math.min(2_000, parsed)) : fallback; }
function booleanParam(value) { return ["1", "true", "yes", "on"].includes(String(value || "").trim().toLowerCase()); }

export function createContentAssetApi({ contentAssetStore, requestJson, configured = {} } = {}) {
  if (!contentAssetStore) throw new TypeError("createContentAssetApi requires contentAssetStore.");
  if (typeof requestJson !== "function") throw new TypeError("createContentAssetApi requires requestJson.");
  const workspaceId = String(contentAssetStore.workspaceId || "default");
  const bodyLimit = Math.max(100_000, Number(configured.requestBodyLimit || 1_000_000));

  return async function contentAssetApi(request, response, parts, principal = null) {
    const method = String(request.method || "GET").toUpperCase();
    const url = new URL(request.url || "/", "http://localhost");
    try {
      if (parts.length === 3 && method === "GET") {
        const items = contentAssetStore.list({ workspaceId, articleId: url.searchParams.get("articleId") || null, status: url.searchParams.get("status") || null, publishedOnly: booleanParam(url.searchParams.get("publishedOnly")), limit: limit(url.searchParams.get("limit")) });
        return response.json(200, { ok: true, data: { items, total: items.length } });
      }
      if (parts.length === 3 && method === "POST") {
        const body = bodyData(await requestJson(request, bodyLimit));
        const asset = contentAssetStore.ensureAsset({ workspaceId, articleId: body.articleId, actor: principal, request });
        return response.json(201, { ok: true, data: { asset } });
      }
      if (parts.length === 4 && parts[3] === "sync" && method === "POST") {
        const body = bodyData(await requestJson(request, bodyLimit));
        const rows = Array.isArray(body.publications) ? body.publications : [];
        if (rows.length > 2_000) throw new ContentAssetError("Too many publications in one sync request.", 422, "CONTENT_ASSET_SYNC_LIMIT");
        const results = rows.map((entry) => contentAssetStore.upsertPublication({ ...entry, workspaceId, source: ["manual", "import"].includes(entry?.source) ? entry.source : "publish_sync", actor: principal, request }));
        return response.json(200, { ok: true, data: { items: results.map((entry) => entry.publication), synced: results.length } });
      }
      if (parts.length === 5 && parts[3] === "citations" && parts[4] === "sync" && method === "POST") {
        const body = bodyData(await requestJson(request, bodyLimit));
        const result = contentAssetStore.syncEvidence({ workspaceId, limit: limit(body.limit, 2_000) });
        return response.json(200, { ok: true, data: result });
      }
      if (parts.length === 4 && parts[3] === "patrol" && method === "POST") {
        const body = bodyData(await requestJson(request, bodyLimit));
        const result = await contentAssetStore.patrolDue({ workspaceId, limit: limit(body.limit, 20), citationStaleDays: body.citationStaleDays });
        return response.json(200, { ok: true, data: result });
      }
      if (parts.length === 4 && parts[3] === "alerts" && method === "GET") {
        const items = contentAssetStore.alerts(workspaceId, null, { status: url.searchParams.get("status") || "open", limit: limit(url.searchParams.get("limit"), 200) });
        return response.json(200, { ok: true, data: { items, total: items.length } });
      }
      const assetId = parts[3] ? decodeURIComponent(parts[3]) : null;
      if (parts.length === 4 && method === "GET") return response.json(200, { ok: true, data: { asset: contentAssetStore.get(workspaceId, assetId) } });
      if (parts.length === 5 && parts[4] === "citations" && method === "GET") {
        const items = contentAssetStore.citations(workspaceId, assetId, { limit: limit(url.searchParams.get("limit"), 500) });
        return response.json(200, { ok: true, data: { items, total: items.length, summary: contentAssetStore.citationSummary(workspaceId, assetId) } });
      }
      if (parts.length === 5 && parts[4] === "publications" && method === "POST") {
        const body = bodyData(await requestJson(request, bodyLimit));
        const asset = contentAssetStore.get(workspaceId, assetId);
        const result = contentAssetStore.upsertPublication({ ...body, workspaceId, assetId, articleId: asset.articleId, source: "manual", actor: principal, request });
        return response.json(result.created ? 201 : 200, { ok: true, data: result });
      }
      const publicationId = parts[5] ? decodeURIComponent(parts[5]) : null;
      if (parts.length === 6 && parts[4] === "publications" && method === "DELETE") {
        const asset = contentAssetStore.removePublication({ workspaceId, assetId, publicationId, actor: principal, request });
        return response.json(200, { ok: true, data: { asset } });
      }
      if (parts.length === 7 && parts[4] === "publications" && parts[6] === "check" && method === "POST") {
        const publication = await contentAssetStore.checkPublication({ workspaceId, assetId, publicationId, actor: principal, request });
        return response.json(200, { ok: true, data: { publication } });
      }
      return response.json(404, { ok: false, code: "CONTENT_ASSET_ROUTE_NOT_FOUND", message: "内容资产接口不存在。" });
    } catch (error) {
      if (error instanceof ContentAssetError) return response.json(Number(error.status || 422), { ok: false, code: error.code, message: error.message, details: error.details });
      throw error;
    }
  };
}
