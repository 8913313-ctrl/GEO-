// Article risk highlighting helpers. Kept separate from workflow/rendering
// code; the legacy global functions remain available to the existing shell.

function stripArticleRiskHighlights(html = "") {
  const source = String(html || "");
  if (!source) return source;
  if (typeof document === "undefined") {
    return source.replace(/<(?:mark|span)\b[^>]*class=["'][^"']*article-risk-highlight[^"']*["'][^>]*>([\s\S]*?)<\/(?:mark|span)>/gi, "$1");
  }
  const template = document.createElement("template");
  template.innerHTML = source;
  template.content.querySelectorAll("mark.article-risk-highlight, span.article-risk-highlight").forEach((node) => {
    const parent = node.parentNode;
    if (!parent) return;
    while (node.firstChild) parent.insertBefore(node.firstChild, node);
    parent.removeChild(node);
  });
  return template.innerHTML;
}

function articleRiskHighlightDescriptors(hits = []) {
  const byTerm = new Map();
  (Array.isArray(hits) ? hits : []).forEach((hit) => {
    const term = String(hit?.term || "").trim();
    if (!term) return;
    const key = term.toLocaleLowerCase();
    const current = byTerm.get(key);
    if (!current || (hit.level === "blocked" && current.level !== "blocked")) byTerm.set(key, { ...hit, term });
  });
  return [...byTerm.values()].sort((left, right) => right.term.length - left.term.length);
}

function articleRiskHighlightRegex(hits = []) {
  const descriptors = articleRiskHighlightDescriptors(hits);
  if (!descriptors.length) return { descriptors, map: new Map(), regex: null };
  const map = new Map(descriptors.map((hit) => [hit.term.toLocaleLowerCase(), hit]));
  const escapedTerms = descriptors.map((hit) => hit.term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return { descriptors, map, regex: new RegExp(escapedTerms.join("|"), "gi") };
}

function articleRiskMarkHtml(value, hit) {
  const blocked = hit?.level === "blocked";
  const label = blocked ? "违禁" : "复核";
  const detail = `${articleRiskHitLabel(hit)}：${hit?.message || hit?.rule || "请核对这段文字。"}`;
  return `<mark class="article-risk-highlight ${blocked ? "blocked" : "warning"}" data-risk-hit-id="${escapeHtml(hit?.id || "")}" data-risk-label="${label}" title="${escapeHtml(detail)}" aria-label="风险文字：${escapeHtml(value)}；${escapeHtml(detail)}">${escapeHtml(value)}</mark>`;
}

function highlightArticleRiskText(value, hits = []) {
  const source = String(value || "");
  const matcher = articleRiskHighlightRegex(hits);
  if (!source || !matcher.regex) return escapeHtml(source);
  let output = "";
  let cursor = 0;
  source.replace(matcher.regex, (match, offset) => {
    output += escapeHtml(source.slice(cursor, offset));
    const hit = matcher.map.get(match.toLocaleLowerCase()) || matcher.descriptors.find((item) => item.term.toLocaleLowerCase() === match.toLocaleLowerCase());
    output += articleRiskMarkHtml(match, hit);
    cursor = offset + match.length;
    return match;
  });
  output += escapeHtml(source.slice(cursor));
  return output;
}

function highlightArticleRiskHtml(html = "", hits = []) {
  const source = stripArticleRiskHighlights(html);
  const matcher = articleRiskHighlightRegex(hits);
  if (!source || !matcher.regex || typeof document === "undefined") return source;
  const template = document.createElement("template");
  template.innerHTML = source;
  const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  let node;
  while ((node = walker.nextNode())) {
    if (node.parentElement?.closest("[data-citation-id], .article-risk-highlight, script, style")) continue;
    if (matcher.regex.test(node.nodeValue || "")) {
      matcher.regex.lastIndex = 0;
      textNodes.push(node);
    }
    matcher.regex.lastIndex = 0;
  }
  textNodes.forEach((textNode) => {
    const sourceText = textNode.nodeValue || "";
    const fragment = document.createDocumentFragment();
    let cursor = 0;
    sourceText.replace(matcher.regex, (match, offset) => {
      if (offset > cursor) fragment.appendChild(document.createTextNode(sourceText.slice(cursor, offset)));
      const hit = matcher.map.get(match.toLocaleLowerCase()) || matcher.descriptors.find((item) => item.term.toLocaleLowerCase() === match.toLocaleLowerCase());
      const markTemplate = document.createElement("template");
      markTemplate.innerHTML = articleRiskMarkHtml(match, hit);
      fragment.appendChild(markTemplate.content.firstElementChild);
      cursor = offset + match.length;
      return match;
    });
    if (cursor < sourceText.length) fragment.appendChild(document.createTextNode(sourceText.slice(cursor)));
    textNode.replaceWith(fragment);
    matcher.regex.lastIndex = 0;
  });
  return template.innerHTML;
}
