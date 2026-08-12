import { ContentGenerationSchedulerError } from "./content-generation-scheduler.mjs";

function decode(value) {
  try { return decodeURIComponent(String(value || "")); }
  catch { throw new ContentGenerationSchedulerError("Route identifier is invalid.", 422, "CONTENT_SCHEDULE_INVALID"); }
}

export function createContentGenerationSchedulerApi({ scheduler, requestJson, configured }) {
  if (!scheduler || typeof requestJson !== "function") throw new TypeError("Content generation scheduler API requires scheduler and requestJson.");
  return async function contentGenerationSchedulerApi(request, response, parts, principal) {
    const method = String(request.method || "GET").toUpperCase();
    const workspaceId = String(configured?.workspaceId || scheduler.workspaceId || "default");
    if (parts.length === 3 && method === "GET") {
      const query = new URL(request.url || "/", "http://localhost").searchParams;
      return response.json(200, { ok: true, data: { items: scheduler.listSchedules({ workspaceId, status: query.get("status") || "", limit: query.get("limit") || 100 }) } });
    }
    if (parts.length === 4 && method === "GET") {
      return response.json(200, { ok: true, data: { schedule: scheduler.getSchedule(decode(parts[3]), workspaceId) } });
    }
    if (parts.length === 4 && method === "PUT") {
      const body = await requestJson(request, 300_000);
      const schedule = scheduler.upsertSchedule({ workspaceId, planId: decode(parts[3]), status: body.status || "paused", schedule: body.schedule, generationPayload: body.generationPayload, actor: principal, request });
      return response.json(200, { ok: true, data: { schedule } });
    }
    if (parts.length === 5 && ["pause", "resume"].includes(parts[4]) && method === "POST") {
      const body = await requestJson(request, 20_000);
      if (parts[4] === "resume" && body.confirmDraftGeneration !== true) throw new ContentGenerationSchedulerError("Set confirmDraftGeneration to true to enable draft-only scheduled generation.", 422, "CONTENT_SCHEDULE_CONFIRMATION_REQUIRED");
      const schedule = scheduler.setStatus({ workspaceId, planId: decode(parts[3]), status: parts[4] === "resume" ? "active" : "paused", actor: principal, request });
      return response.json(200, { ok: true, data: { schedule } });
    }
    if (parts.length === 5 && parts[4] === "runs" && method === "GET") {
      const query = new URL(request.url || "/", "http://localhost").searchParams;
      scheduler.getSchedule(decode(parts[3]), workspaceId);
      return response.json(200, { ok: true, data: { items: scheduler.listRuns({ workspaceId, planId: decode(parts[3]), limit: query.get("limit") || 100 }) } });
    }
    if (parts.length === 4 && parts[3] === "process-due" && method === "POST") {
      const body = await requestJson(request, 20_000);
      const result = await scheduler.processDue({ at: body.at || new Date().toISOString(), limit: body.limit || configured?.contentGenerationSchedulerBatchSize || 3, actor: principal, request });
      return response.json(200, { ok: true, data: result });
    }
    return response.json(404, { ok: false, code: "CONTENT_SCHEDULE_ROUTE_NOT_FOUND", message: "Content generation schedule route was not found." });
  };
}

export default createContentGenerationSchedulerApi;
