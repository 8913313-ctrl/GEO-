import { createHash, timingSafeEqual } from "node:crypto";
import { AuthError, PERMISSIONS } from "./auth-service.mjs";
import { readHeader } from "./production-audit.mjs";

function tokenDigest(value) {
  return createHash("sha256").update(String(value || ""), "utf8").digest();
}

function tokensMatch(provided, expected) {
  if (!provided || !expected) return false;
  return timingSafeEqual(tokenDigest(provided), tokenDigest(expected));
}

/**
 * Authenticate the deliberately narrow customer-server API used for a
 * single-question relay diagnostic. It never accepts a browser cookie or an
 * ordinary user session; the caller must present the separately provisioned
 * service key in X-TZ-Ad-Hoc-Api-Key.
 */
export function requireAdHocDiagnosticServiceApi(request, options = {}) {
  const expectedToken = String(options.token || "").trim();
  if (!expectedToken) {
    throw new AuthError("The ad-hoc diagnostic service API is not provisioned.", 503, "AD_HOC_DIAGNOSTIC_SERVICE_API_DISABLED");
  }
  const providedToken = readHeader(request, "x-tz-ad-hoc-api-key").trim();
  if (!tokensMatch(providedToken, expectedToken)) {
    throw new AuthError("A valid customer-server ad-hoc diagnostic API key is required.", 401, "AD_HOC_DIAGNOSTIC_SERVICE_AUTH_REQUIRED");
  }
  return {
    userId: null,
    username: "customer-server-api",
    displayName: "Customer server API",
    role: "service",
    permissions: [PERMISSIONS.WORKSPACE_WRITE],
    authMethod: "ad_hoc_diagnostic_service_key",
    service: { adHocDiagnostic: true, caller: "customer_server_api" }
  };
}

export default requireAdHocDiagnosticServiceApi;
