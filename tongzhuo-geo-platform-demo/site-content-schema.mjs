// Shared contract for every enterprise website template.
// Templates consume this schema; industries must not add database fields.

export const CONTENT_KINDS = Object.freeze([
  "offering",
  "proof",
  "credential",
  "partner",
  "testimonial",
  "person",
  "scene",
  "faq",
  "media"
]);

export const CONTENT_FIELD_DEFINITIONS = Object.freeze({
  common: [
    { key: "title", label: "标题", type: "text", required: true },
    { key: "subtitle", label: "副标题", type: "text" },
    { key: "label", label: "标签", type: "text" },
    { key: "summary", label: "摘要", type: "textarea" },
    { key: "description", label: "说明", type: "richtext" },
    { key: "content", label: "正文", type: "richtext" },
    { key: "image", label: "主图", type: "asset" },
    { key: "gallery", label: "图集", type: "asset-list" },
    { key: "tags", label: "标签", type: "list" },
    { key: "facts", label: "事实字段", type: "key-value" },
    { key: "metadata", label: "扩展信息", type: "json" }
  ],
  offering: ["audience", "scope", "process", "priceRange"],
  proof: ["client", "location", "area", "amount", "duration", "result", "authorized"],
  credential: ["issuer", "certificateNo", "issueDate", "expireDate"],
  partner: ["brandName", "authorization", "series"],
  testimonial: ["customer", "role", "project", "rating"],
  person: ["role", "specialty", "experience"],
  scene: ["industry", "challenge", "solution", "result"],
  faq: ["question", "answer", "intent"],
  media: ["mediaType", "source", "caption"]
});

export const PAGE_BLOCK_TYPES = Object.freeze([
  "hero",
  "offering-list",
  "proof-list",
  "fact-grid",
  "gallery",
  "process",
  "testimonial",
  "credential-list",
  "partner-list",
  "faq",
  "article-list",
  "calculator",
  "interactive-demo",
  "contact-form",
  "cta"
]);

export function isContentKind(value) {
  return CONTENT_KINDS.includes(String(value || ""));
}
