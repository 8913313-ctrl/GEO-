import { CitationDocumentUpdateError } from "./citation-document-update-store.mjs";

function bodyObject(value) { return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }

export function createCitationDocumentUpdateApi({ store, requestJson, configured = {} } = {}) {
  if (!store || typeof store.status !== "function") throw new TypeError("createCitationDocumentUpdateApi requires a CitationDocumentUpdateStore.");
  if (typeof requestJson !== "function") throw new TypeError("createCitationDocumentUpdateApi requires requestJson.");
  const bodyLimit = Math.min(Math.max(Number(configured.requestBodyLimit) || 100_000, 10_000), 500_000);

  return async function handleCitationDocumentUpdateApi(request, response, parts) {
    const method = String(request.method || "GET").toUpperCase();
    const domain = parts[2] || "";
    const action = parts[3] || "";
    if (domain !== "citation-document-updates") {
      throw new CitationDocumentUpdateError("Citation document update API route not found.", 404, "CITATION_DOCUMENT_UPDATE_ROUTE_NOT_FOUND");
    }
    if ((parts.length === 3 || action === "status") && method === "GET") {
      return response.json(200, { ok: true, data: { update: await store.status() } });
    }
    if (parts.length === 4 && action === "check" && method === "POST") {
      return response.json(200, { ok: true, data: { update: await store.checkForUpdates() } });
    }
    const body = parts.length === 4 && method === "POST" ? bodyObject(await requestJson(request, bodyLimit)) : null;
    if (action === "stage" && body) return response.json(200, { ok: true, data: { update: await store.stageCandidate(body) } });
    if (action === "validate" && body) return response.json(200, { ok: true, data: { update: await store.validateStagedCandidate(body) } });
    if (action === "discard" && body) return response.json(200, { ok: true, data: { update: await store.discardCandidate(body) } });
    if (action === "activate" && body) return response.json(200, { ok: true, data: { update: await store.activateCandidate(body) } });
    if (action === "rollback" && body) return response.json(200, { ok: true, data: { update: await store.rollback(body) } });
    throw new CitationDocumentUpdateError("Citation document update API route not found.", 404, "CITATION_DOCUMENT_UPDATE_ROUTE_NOT_FOUND", { method, path: parts.join("/") });
  };
}

export default createCitationDocumentUpdateApi;
