import assert from "node:assert/strict";
import { renderArticlePage, renderFixedPage, renderInsightsPage } from "../public-site/site-renderer.mjs";
import { listSiteTemplates } from "../public-site/templates/site-template-registry.mjs";

const baseSite = {
  siteName: "Example Company",
  companyName: "Example Company Ltd.",
  description: "Verified enterprise information.",
  theme: { key: "professional" },
  template: { key: "professional" },
  pages: [
    { id: "home", path: "/", title: "Home", status: "published" },
    { id: "services", path: "/services/", title: "Services", status: "published" },
    { id: "cases", path: "/cases/", title: "Cases", status: "published" },
    { id: "problem-map", path: "/problem-map/", title: "Problem map", status: "published" },
    { id: "about", path: "/about/", title: "About", status: "published" },
    { id: "contact", path: "/contact/", title: "Contact", status: "published" }
  ],
  navItems: [{ path: "/", label: "Home" }, { path: "/about/", label: "About" }],
  contact: {},
  modules: {},
  businessLines: []
};
const article = {
  id: "a1", slug: "a1", title: "Test article", excerpt: "Test excerpt",
  contentHtml: "<h2>Content</h2><p>Body.</p>", publishedAt: "2026-08-01T00:00:00Z", author: "Example Company"
};
const capture = (html, pattern) => html.match(pattern)?.[1] || "unknown";
const signatures = [];
const fixedPageIds = ["services", "cases", "problem-map", "about", "contact"];
const legacyFixedSkeletonClasses = [
  "page-hero",
  "services-detail-section",
  "cases-list-section",
  "about-story-section",
  "contact-section",
  "corp-home-page"
];

function mainMarkup(html, label) {
  const match = String(html).match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  assert(match, `${label}: rendered document must include a main element`);
  return match[1];
}

function classTokensInMarkup(markup) {
  // Inspect only class attributes of actual HTML start tags. In particular,
  // this deliberately ignores CSS text in the document head (or in a style
  // element), where compatibility selectors may legitimately mention these
  // old class names.
  const domMarkup = String(markup).replace(/<(script|style|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "");
  const tokens = [];
  const startTagPattern = /<[A-Za-z][^<>]*>/g;
  const classPattern = /\bclass\s*=\s*(['"])([\s\S]*?)\1/i;
  for (const match of domMarkup.matchAll(startTagPattern)) {
    const classAttribute = match[0].match(classPattern);
    if (classAttribute) tokens.push(...classAttribute[2].trim().split(/\s+/).filter(Boolean));
  }
  return tokens;
}

function assertNoLegacyFixedSkeleton(html, label) {
  const classes = new Set(classTokensInMarkup(mainMarkup(html, label)));
  for (const legacyClass of legacyFixedSkeletonClasses) {
    assert(!classes.has(legacyClass), `${label}: #main must not render legacy shared skeleton class .${legacyClass}`);
  }
}

for (const template of listSiteTemplates()) {
  const site = structuredClone(baseSite);
  site.theme.key = template.key;
  site.template.key = template.key;
  const home = renderFixedPage({ site, page: site.pages[0], origin: "https://example.test", preview: true });
  const fixed = renderFixedPage({ site, page: site.pages[1], origin: "https://example.test", preview: true });
  for (const pageId of fixedPageIds) {
    const page = site.pages.find((item) => item.id === pageId);
    assert(page, `${template.key}: missing test fixture for ${pageId}`);
    const html = renderFixedPage({ site, page, origin: "https://example.test", preview: true });
    assertNoLegacyFixedSkeleton(html, `${template.key}/${pageId}`);
  }
  const listing = renderInsightsPage({ site, articles: [article], categories: [], origin: "https://example.test", preview: true });
  const detail = renderArticlePage({ site, article, relatedArticles: [article], origin: "https://example.test" }).html;
  signatures.push({
    key: template.key,
    home: capture(home, /class="(theme-(?:dossier|spec|console|magazine|casebook|catalog|space|power|flow)-home)/),
    fixed: capture(fixed, /class="(theme-(?:dossier|spec|console|magazine|casebook|catalog|space|power|flow)-fixed[^" ]*)/),
    listing: capture(listing, /class="(theme-(?:dossier|spec|console|magazine|casebook|catalog|space|power|flow)-listing)/),
    article: capture(detail, /class="(theme-(?:dossier|spec|console|magazine|casebook|catalog|space|power|flow)-article)/),
    header: capture(home, /class="site-header ([^"]+)/),
    footer: capture(home, /class="site-footer ([^"]+)/),
    related: capture(detail, /data-theme-related="([^"]+)"/)
  });
}

for (const field of ["home", "fixed", "listing", "article", "header", "footer", "related"]) {
  const values = new Set(signatures.map((item) => item[field]));
  assert.equal(values.size, signatures.length, `${field} signatures must be unique for every theme`);
  assert(!values.has("unknown"), `${field} signature is missing`);
}
console.log(JSON.stringify(signatures));
