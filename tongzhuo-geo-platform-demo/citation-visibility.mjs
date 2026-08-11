const EXPLICIT_TRUE_VALUES = new Set([true, 1, "1", "true", "show", "visible"]);

export function publicCitationMarkersVisible(metadata = {}) {
  if (!metadata || typeof metadata !== "object") return false;
  const site = metadata.site && typeof metadata.site === "object" ? metadata.site : {};
  const value = Object.prototype.hasOwnProperty.call(metadata, "showPublicCitationMarkers")
    ? metadata.showPublicCitationMarkers
    : site.showPublicCitationMarkers;
  return EXPLICIT_TRUE_VALUES.has(typeof value === "string" ? value.trim().toLowerCase() : value);
}

export function stripCitationMarkers(value = "") {
  return String(value || "")
    .replace(/<([a-z][a-z0-9]*)\b(?=[^>]*\bdata-(?:citation|evidence)-id\s*=)[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/\[(?:K|E|REF)\s*\d+\]/gi, "")
    .replace(/[ \t]{2,}/g, " ");
}

export function applyPublicCitationVisibility(value = "", metadata = {}) {
  return publicCitationMarkersVisible(metadata) ? String(value || "") : stripCitationMarkers(value);
}