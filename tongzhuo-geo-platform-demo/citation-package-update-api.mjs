import { CitationPackageUpdateError } from "./citation-package-update-store.mjs";

function bodyObject(value) { return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }

export function createCitationPackageUpdateApi({ store, requestJson, configured = {} } = {}) {
  if (!store || typeof store.status !== "function") throw new TypeError("createCitationPackageUpdateApi requires a CitationPackageUpdateStore.");
  if (typeof requestJson !== "function") throw new TypeError("createCitationPackageUpdateApi requires requestJson.");
  const bodyLimit = Math.min(Math.max(Number(configured.requestBodyLimit) || 100_000, 10_000), 500_000);

  return async function handleCitationPackageUpdateApi(request, response, parts) {
    const method = String(request.method || "GET").toUpperCase();
    const domain = parts[2] || "";
    const action = parts[3] || "";
    if (domain !== "citation-package-updates") {
      throw new CitationPackageUpdateError("Citation package update API route not found.", 404, "CITATION_UPDATE_ROUTE_NOT_FOUND");
    }

    if ((parts.length === 3 || action === "status") && method === "GET") {
      return response.json(200, { ok: true, data: { update: await store.status() } });
    }
    if (parts.length === 4 && action === "check" && method === "POST") {
      return response.json(200, { ok: true, data: { update: await store.checkForUpdates() } });
    }
    if (parts.length === 4 && action === "stage" && method === "POST") {
      const body = bodyObject(await requestJson(request, bodyLimit));
      return response.json(200, { ok: true, data: { update: await store.stageCandidate(body) } });
    }
    if (parts.length === 4 && action === "validate" && method === "POST") {
      const body = bodyObject(await requestJson(request, bodyLimit));
      return response.json(200, { ok: true, data: { update: await store.validateStagedCandidate(body) } });
    }
    if (parts.length === 4 && action === "discard" && method === "POST") {
      const body = bodyObject(await requestJson(request, bodyLimit));
      return response.json(200, { ok: true, data: { update: await store.discardCandidate(body) } });
    }
    if (parts.length === 4 && action === "activate" && method === "POST") {
      const body = bodyObject(await requestJson(request, bodyLimit));
      return response.json(200, { ok: true, data: { update: await store.activateCandidate(body) } });
    }
    if (parts.length === 4 && action === "rollback" && method === "POST") {
      const body = bodyObject(await requestJson(request, bodyLimit));
      return response.json(200, { ok: true, data: { update: await store.rollback(body) } });
    }
    throw new CitationPackageUpdateError("Citation package update API route not found.", 404, "CITATION_UPDATE_ROUTE_NOT_FOUND", { method, path: parts.join("/") });
  };
}

export default createCitationPackageUpdateApi;
