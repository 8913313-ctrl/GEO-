export function themeContext(ctx = {}) {
  const esc = typeof ctx.escapeHtml === "function" ? ctx.escapeHtml : (v) => String(v ?? "");
  const articleLink = typeof ctx.articleLink === "function" ? ctx.articleLink : (a) => "/insights/" + encodeURIComponent(a?.slug || a?.id || "article") + "/";
  const categoryLink = typeof ctx.categoryLink === "function" ? ctx.categoryLink : (c) => "/insights/" + encodeURIComponent(c?.slug || c?.id || "category") + "/";
  const image = typeof ctx.articleCoverImage === "function" ? ctx.articleCoverImage : () => "";
  const action = typeof ctx.actionLink === "function" ? ctx.actionLink : (label, href = "/contact/", cls = "button primary") => '<a class="' + esc(cls) + '" href="' + esc(href) + '">' + esc(label) + "</a>";
  const date = typeof ctx.dateShort === "function" ? ctx.dateShort : (v) => String(v || "").slice(0, 10);
  const site = ctx.site || {};
  const brand = String(ctx.brand || site.siteName || site.companyName || "").trim();
  const description = String(ctx.description || site.description || "").trim();
  const services = Array.isArray(ctx.services) ? ctx.services : [];
  const cases = Array.isArray(ctx.cases) ? ctx.cases : [];
  const articles = Array.isArray(ctx.articles) ? ctx.articles : [];
  const categories = Array.isArray(ctx.categories) ? ctx.categories : [];
  const link = (label, href, cls = "") => "<a" + (cls ? ' class="' + esc(cls) + '"' : "") + ' href="' + esc(href || "/") + '">' + esc(label) + "</a>";
  const card = (a, cls = "") => '<article class="theme-card ' + esc(cls) + '">' + image(a, "theme-card-cover") + '<div class="theme-card-meta"><span>' + esc(a?.categoryName || "行业观察") + "</span><time>" + esc(date(a?.publishedAt)) + "</time></div><h3><a href=\"" + esc(articleLink(a)) + "\">" + esc(a?.title || "未命名文章") + '</a></h3><p>' + esc(a?.excerpt || "") + '</p><a class="theme-card-link" href="' + esc(articleLink(a)) + '">阅读全文 →</a></article>';
  const related = (themeName, className = "theme-related", heading = "继续阅读") => {
    if (!articles.length) return "";
    const rows = articles.slice(0, 3).map((article, index) =>
      '<article><span>' + String(index + 1).padStart(2, "0") + '</span><div><small>' + esc(article?.categoryName || "行业观察") + ' · ' + esc(date(article?.publishedAt)) + '</small><h3><a href="' + esc(articleLink(article)) + '">' + esc(article?.title || "未命名文章") + '</a></h3><p>' + esc(article?.excerpt || "") + '</p></div></article>'
    ).join("");
    return '<section class="' + esc(className) + '" data-theme-related="' + esc(themeName) + '"><header><h2>' + esc(heading) + '</h2><a href="/insights/">全部内容 →</a></header><div>' + rows + '</div></section>';
  };
  return { ...ctx, esc, site, brand, description, services, cases, articles, categories, articleLink, categoryLink, image, action, date, link, card, related };
}

function normalizePath(value) {
  return String(value || "/")
    .replace(/\/index\.html$/i, "/")
    .replace(/\.html$/i, "/")
    .replace(/\/{2,}/g, "/")
    .replace(/\/$/, "") || "/";
}

/**
 * Normalize the public chrome contract once while leaving every theme in
 * charge of its own header and footer DOM. The renderer supplies trusted
 * brand markup so configured logos keep working without being reconstructed.
 */
export function chromeContext(ctx = {}) {
  const esc = typeof ctx.escapeHtml === "function" ? ctx.escapeHtml : (value) => String(value ?? "");
  const items = Array.isArray(ctx.items) ? ctx.items.filter((item) => item?.path) : [];
  const activePath = normalizePath(ctx.active);
  const site = ctx.site || {};
  const contact = ctx.contact || site.contact || {};
  const brand = String(ctx.brand || site.siteName || site.companyName || "企业官网").trim();
  const company = String(ctx.company || site.companyName || brand).trim();
  const footerLabel = String(ctx.footerLabel || site.footerLabel || brand || "企业").trim();
  const brandMarkup = String(ctx.brandMarkup || esc(brand));
  const currentYear = Number(ctx.currentYear) || new Date().getFullYear();
  const icp = String(ctx.icp || site.footerIcp || "").trim();
  const active = (path) => activePath === normalizePath(path);
  const navLink = (item, cls = "") => {
    const selected = active(item.path);
    const classes = [cls, selected ? "active" : ""].filter(Boolean).join(" ");
    return '<a' + (classes ? ' class="' + esc(classes) + '"' : "") +
      (selected ? ' aria-current="page"' : "") + ' href="' + esc(item.path) + '">' + esc(item.label) + "</a>";
  };
  const navLinks = (cls = "") => items.map((item) => navLink(item, cls)).join("");
  const mobileNavigation = (themeKey, ctaLabel) =>
    '<nav id="mobile-navigation" class="mobile-navigation theme-mobile-navigation theme-mobile-' + esc(themeKey) + '" aria-label="移动端导航">' +
    navLinks("theme-mobile-link") + '<a class="mobile-cta" href="/contact/">' + esc(ctaLabel) + "</a></nav>";
  const menuButton = () => '<button class="menu-toggle" type="button" aria-label="打开导航" aria-expanded="false" aria-controls="mobile-navigation"><span></span><span></span><span></span></button>';
  const icpLink = () => icp
    ? '<a class="footer-icp" href="https://beian.miit.gov.cn/" target="_blank" rel="noreferrer">' + esc(icp) + "</a>"
    : "";
  return {
    ...ctx,
    esc,
    site,
    contact,
    brand,
    company,
    footerLabel,
    brandMarkup,
    currentYear,
    icp,
    items,
    active,
    navLink,
    navLinks,
    mobileNavigation,
    menuButton,
    icpLink
  };
}

export function fixedContext(ctx = {}) {
  const t = themeContext(ctx);
  const page = ctx.page || {};
  const fixed = ctx.fixed && typeof ctx.fixed === "object" ? ctx.fixed : {};
  const pageId = String(page.id || "page").trim().toLocaleLowerCase("en-US");
  const title = String(page.title || ctx.title || {
    services: "产品与服务",
    cases: "服务案例",
    "problem-map": "问题地图",
    about: "关于我们",
    contact: "联系我们"
  }[pageId] || "企业公开页面");
  const description = String(ctx.description || page.seoDescription || page.description || t.description || "");
  const labels = {
    services: "SERVICES",
    cases: "CASES",
    "problem-map": "QUESTION MAP",
    "problem-detail": "QUESTION",
    about: "ABOUT",
    contact: "CONTACT"
  };
  return {
    ...t,
    page,
    fixed,
    // Fixed pages receive CMS data, rather than a legacy HTML fragment. This
    // keeps every package free to own its complete page topology while the
    // public-site renderer remains responsible for the data/SEO contract.
    fixedServices: Array.isArray(fixed.services) ? fixed.services : t.services,
    fixedCases: Array.isArray(fixed.cases) ? fixed.cases : t.cases,
    fixedArticles: Array.isArray(fixed.articles) ? fixed.articles : t.articles,
    fixedCategories: Array.isArray(fixed.categories) ? fixed.categories : t.categories,
    fixedGroups: Array.isArray(fixed.groups) ? fixed.groups : [],
    fixedModules: Array.isArray(fixed.modules) ? fixed.modules : [],
    contact: fixed.contact && typeof fixed.contact === "object" ? fixed.contact : (t.site.contact || {}),
    pageId,
    title,
    description,
    pageLabel: labels[pageId] || "PUBLIC PAGE"
  };
}

export function fixedValue(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

export function fixedList(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

export function fixedHeading(t, eyebrow, title, description = "", className = "") {
  return '<header class="fixed-heading ' + t.esc(className) + '">' +
    (eyebrow ? '<span>' + t.esc(eyebrow) + '</span>' : "") +
    '<h2>' + t.esc(title) + '</h2>' +
    (description ? '<p>' + t.esc(description) + '</p>' : "") +
    '</header>';
}

export function fixedServiceMarkup(t, service, index, prefix, detailed = true) {
  const id = fixedValue(service?.id, 'service-' + (index + 1));
  const href = fixedValue(service?.href, '/contact/');
  const title = fixedValue(service?.title || service?.name, '服务能力');
  const description = fixedValue(service?.description || service?.content, '服务内容、适用对象与交付边界。');
  return '<article class="fixed-' + t.esc(prefix) + '-service" id="' + t.esc(id) + '">' +
    '<div class="fixed-service-index">' + String(index + 1).padStart(2, "0") + '</div>' +
    '<div class="fixed-service-copy"><span>' + t.esc(fixedValue(service?.eyebrow, 'SERVICE')) + '</span><h3>' + t.esc(title) + '</h3><p>' + t.esc(description) + '</p></div>' +
    (detailed ? '<dl><div><dt>适合对象</dt><dd>' + t.esc(fixedValue(service?.audience, '以企业实际业务场景为准')) + '</dd></div><div><dt>工作重点</dt><dd>' + t.esc(fixedValue(service?.focus || service?.cmsFocus, '资料、问题与交付边界')) + '</dd></div></dl>' : "") +
    '<a class="fixed-service-link" href="' + t.esc(href) + '">了解服务 <span aria-hidden="true">→</span></a></article>';
}

export function fixedCaseMarkup(t, item, index, prefix) {
  return '<article class="fixed-' + t.esc(prefix) + '-case" data-case-industry="' + t.esc(fixedValue(item?.industry, "项目场景")) + '">' +
    '<header><span>' + t.esc(fixedValue(item?.industry || item?.service, "PROJECT")) + '</span><b>' + String(index + 1).padStart(2, "0") + '</b></header>' +
    '<h3>' + t.esc(fixedValue(item?.title, "项目记录")) + '</h3><p>' + t.esc(fixedValue(item?.summary, "业务场景、实施内容与形成结果。")) + '</p>' +
    '<div><small>形成结果</small><strong>' + t.esc(fixedValue(item?.result, "结果待补充")) + '</strong></div></article>';
}

export function fixedProblemMarkup(t, problem, group, index, prefix) {
  const slug = fixedValue(problem?.slug, problem?.id || "question");
  const industries = fixedList(problem?.industries).slice(0, 3).join(" · ");
  return '<a class="fixed-' + t.esc(prefix) + '-question" href="/problem-map/' + encodeURIComponent(slug) + '/">' +
    '<span>' + t.esc(industries || fixedValue(group?.service, "客户问题")) + '</span><b>' + String(index + 1).padStart(2, "0") + '</b>' +
    '<h3>' + t.esc(fixedValue(problem?.title, "客户常见问题")) + '</h3><p>' + t.esc(fixedValue(problem?.answer, "问题的直接回答正在整理。")) + '</p><strong>查看直接回答 <span aria-hidden="true">→</span></strong></a>';
}

export function fixedArticleMarkup(t, article, prefix, index = 0) {
  const href = t.articleLink(article);
  const cover = t.image(article, 'fixed-' + prefix + '-article-cover');
  return '<article class="fixed-' + t.esc(prefix) + '-article">' + cover +
    '<div><small>' + t.esc(fixedValue(article?.categoryName, "行业观察")) + ' · ' + t.esc(t.date(article?.publishedAt)) + '</small><h3><a href="' + t.esc(href) + '">' + t.esc(fixedValue(article?.title, "未命名文章")) + '</a></h3><p>' + t.esc(fixedValue(article?.excerpt, "查看已审核公开内容。")) + '</p><a href="' + t.esc(href) + '">阅读全文 <span aria-hidden="true">→</span></a></div></article>';
}

export function fixedContactDetails(t) {
  const contact = t.contact || t.site?.contact || {};
  const rows = [];
  if (contact.phone) rows.push('<a href="tel:' + t.esc(contact.phone) + '"><small>联系电话</small><b>' + t.esc(contact.phone) + '</b></a>');
  if (contact.email) rows.push('<a href="mailto:' + t.esc(contact.email) + '"><small>电子邮箱</small><b>' + t.esc(contact.email) + '</b></a>');
  if (contact.address) rows.push('<span><small>企业地址</small><b>' + t.esc(contact.address) + '</b></span>');
  if (!rows.length) rows.push('<span><small>联系方式</small><b>提交表单后由运营人员联系</b></span>');
  return rows.join("");
}

export function fixedFactsMarkup(t, items, prefix) {
  const facts = fixedList(items).length ? fixedList(items) : [
    { title: "企业主体", description: t.site.companyName || t.brand },
    { title: "公开定位", description: t.description },
    { title: "服务边界", description: "以企业实际资料与审核版本为准。" }
  ];
  return facts.slice(0, 8).map((item, index) => '<article class="fixed-' + t.esc(prefix) + '-fact"><span>' + String(index + 1).padStart(2, "0") + '</span><h3>' + t.esc(fixedValue(item?.title, "公开信息")) + '</h3><p>' + t.esc(fixedValue(item?.description || item?.content, "待补充")) + '</p></article>').join("");
}

export function fixedModuleMarkup(t, module, prefix, index, sourcePath) {
  const type = fixedValue(module?.type, "content").toLowerCase();
  const title = fixedValue(module?.title, "公开信息");
  const content = fixedValue(module?.content || module?.description, t.description);
  const cls = 'fixed-' + t.esc(prefix) + '-module fixed-module-' + t.esc(type);
  if (type === "hero") return '<header class="' + cls + '"><span>' + t.esc(fixedValue(module?.eyebrow, "PUBLIC PAGE")) + '</span><h1>' + t.esc(title) + '</h1><p>' + t.esc(content) + '</p>' + (module?.ctaLabel ? t.action(module.ctaLabel, module.ctaHref || "/contact/", "button primary") : "") + '</header>';
  if (type === "services") return '<section class="' + cls + '">' + fixedHeading(t, module?.eyebrow, title, module?.description, "") + '<div class="fixed-' + t.esc(prefix) + '-services">' + fixedList(module?.items, t.fixedServices).slice(0, 12).map((item, row) => fixedServiceMarkup(t, item, row, prefix)).join("") + '</div></section>';
  if (type === "process") return '<section class="' + cls + '">' + fixedHeading(t, module?.eyebrow, title, module?.description) + '<ol class="fixed-' + t.esc(prefix) + '-process">' + fixedList(module?.items, []).slice(0, 10).map((item, row) => '<li><b>' + String(row + 1).padStart(2, "0") + '</b><div><h3>' + t.esc(fixedValue(item?.title, item)) + '</h3>' + (item?.description ? '<p>' + t.esc(item.description) + '</p>' : "") + '</div></li>').join("") + '</ol></section>';
  if (["proof", "entity", "principles", "boundary"].includes(type)) return '<section class="' + cls + '">' + fixedHeading(t, module?.eyebrow, title, module?.description) + '<div class="fixed-' + t.esc(prefix) + '-facts">' + fixedFactsMarkup(t, module?.items, prefix) + '</div></section>';
  if (["insights", "articles"].includes(type)) return '<section class="' + cls + '">' + fixedHeading(t, module?.eyebrow, title, module?.description) + '<div class="fixed-' + t.esc(prefix) + '-articles">' + t.fixedArticles.slice(0, 6).map((item, row) => fixedArticleMarkup(t, item, prefix, row)).join("") + '</div></section>';
  if (type === "faq") return '<section class="' + cls + '">' + fixedHeading(t, module?.eyebrow, title, module?.description) + '<div class="fixed-' + t.esc(prefix) + '-faq">' + fixedList(module?.items, []).slice(0, 12).map((item, row) => '<details' + (row === 0 ? ' open' : '') + '><summary>' + t.esc(fixedValue(item?.title, "常见问题")) + '</summary><p>' + t.esc(fixedValue(item?.description || item?.content, "回答正在整理。")) + '</p></details>').join("") + '</div></section>';
  if (["contact", "form"].includes(type)) return '<section class="' + cls + '"><div class="fixed-' + t.esc(prefix) + '-contact"><div><h2>' + t.esc(title) + '</h2><p>' + t.esc(content) + '</p><div class="fixed-contact-details">' + fixedContactDetails(t) + '</div></div><div>' + (typeof t.renderContactForm === "function" ? t.renderContactForm(sourcePath) : "") + '</div></div></section>';
  if (type === "cta") return '<section class="' + cls + '"><div class="fixed-' + t.esc(prefix) + '-cta"><div><h2>' + t.esc(title) + '</h2><p>' + t.esc(content) + '</p></div>' + t.action(module?.ctaLabel || t.site.cta || "联系我们", module?.ctaHref || "/contact/", "button ink") + '</div></section>';
  return '<section class="' + cls + '">' + fixedHeading(t, module?.eyebrow, title, module?.description) + '<div class="fixed-' + t.esc(prefix) + '-copy"><p>' + t.esc(content) + '</p></div></section>';
}

/**
 * Render a complete fixed page from structured CMS data. The prefix is owned
 * by the selected theme, so the same records can be arranged as a dossier,
 * specification sheet, console, magazine, casebook or catalogue.
 */
export function renderFixedSections(t, { prefix = "theme", sourcePath = "/contact/" } = {}) {
  const p = (name) => 'fixed-' + prefix + '-' + name;
  const services = t.fixedServices || [];
  const cases = t.fixedCases || [];
  const groups = t.fixedGroups || [];
  const articles = t.fixedArticles || [];
  const contact = t.contact || t.site?.contact || {};
  if (t.pageId === "services") {
    return '<div class="' + p("services-page") + '">' + fixedHeading(t, "SERVICES", t.title, t.description, p("intro")) + '<section class="' + p("service-register") + '"><header><h2>服务能力与适用边界</h2><span>' + String(services.length).padStart(2, "0") + ' UNITS</span></header><div>' + (services.length ? services.map((item, index) => fixedServiceMarkup(t, item, index, prefix)).join("") : '<p class="fixed-empty">服务资料正在完善。</p>') + '</div></section><section class="' + p("principles") + '">' + fixedHeading(t, "DELIVERY", "从事实开始，逐步形成可交付的工作", "服务范围、资料边界和交付方式会在项目开始前明确。") + '<div>' + fixedFactsMarkup(t, [{ title: "事实优先", description: "公开表达以企业资料与可核验来源为依据。" }, { title: "问题优先", description: "内容从客户在采购、技术和使用阶段的真实问题开始。" }, { title: "审核优先", description: "文章、案例和官网内容经过人工审核后公开。" }, { title: "长期运营", description: "每一次发布都沉淀为下一轮运营的依据。" }], prefix) + '</div></section><section class="' + p("action") + '"><h2>需要判断从哪一项开始？</h2>' + t.action(t.site.cta || "提交业务问题", "/contact/", "button ink") + '</section></div>';
  }
  if (t.pageId === "cases") {
    const industries = [...new Set(cases.map((item) => fixedValue(item?.industry)).filter(Boolean))];
    return '<div class="' + p("cases-page") + '">' + fixedHeading(t, "CASE RECORDS", t.title, t.description, p("intro")) + '<section class="' + p("case-register") + '"><nav class="' + p("filters") + '" data-case-filter><button class="is-active" type="button" data-case-value="all">全部场景</button>' + industries.map((industry) => '<button type="button" data-case-value="' + t.esc(industry) + '">' + t.esc(industry) + '</button>').join("") + '</nav><div class="' + p("case-grid") + '">' + (cases.length ? cases.map((item, index) => fixedCaseMarkup(t, item, index, prefix)).join("") : '<p class="fixed-empty">案例资料正在完善。</p>') + '</div></section><section class="' + p("note") + '"><h2>案例记录关注场景、过程与结果</h2><p>每个公开案例都回到企业事实，并保留可复用的方法线索。</p>' + t.action("讨论你的业务场景", "/contact/", "button secondary") + '</section></div>';
  }
  if (t.pageId === "problem-map") {
    return '<div class="' + p("problem-map-page") + '">' + fixedHeading(t, "QUESTION MAP", t.title, t.description, p("intro")) + '<div class="' + p("group-stack") + '">' + (groups.length ? groups.map((group) => '<section class="' + p("group") + '" id="' + t.esc(fixedValue(group?.id, "group")) + '"><header><span>' + t.esc(fixedValue(group?.service, "客户问题")) + '</span><h2>' + t.esc(fixedValue(group?.title, "客户问题")) + '</h2><p>' + t.esc(fixedValue(group?.description, "按服务方向整理的客户问题。")) + '</p></header><div class="' + p("questions") + '">' + fixedList(group?.questions, []).map((problem, index) => fixedProblemMarkup(t, problem, group, index, prefix)).join("") + '</div></section>').join("") : '<p class="fixed-empty">问题资料正在完善。</p>') + '</div><section class="' + p("action") + '"><h2>没有找到你的问题？</h2><p>把企业现状和具体场景告诉我们，我们会从问题本身判断下一步。</p>' + t.action("提交企业问题", "/contact/", "button ink") + '</section></div>';
  }
  if (t.pageId === "about") {
    const about = t.fixed?.about || {};
    const audiences = fixedValue(about.audiences, services.map((item) => item?.audience).filter(Boolean).join("；"));
    const directions = fixedValue(about.serviceDirection, services.map((item) => item?.title).filter(Boolean).join("；"));
    return '<div class="' + p("about-page") + '">' + fixedHeading(t, "ABOUT", t.title, t.description, p("intro")) + '<section class="' + p("story") + '"><div><h2>企业公开信息<br>产品服务展示<br>行业内容中心</h2></div><div><p>' + t.esc(fixedValue(about.positioning, t.description)) + '</p><p>官网让客户快速看懂企业是谁、提供什么、适用边界是什么，以及下一步如何联系。</p></div></section><section class="' + p("principles") + '">' + fixedHeading(t, "WORKING PRINCIPLES", "真实、清晰、可追溯、能持续", "每个页面、问题回答与公开内容都遵循同一套审核原则。") + '<div>' + fixedFactsMarkup(t, [{ title: "真实", description: "不凭空补充企业能力，不用无法验证的结果替代事实。" }, { title: "清晰", description: "直接回答客户问题，减少跨页面的信息断裂。" }, { title: "可追溯", description: "文章、案例和服务说明都能回到企业资料。" }, { title: "能持续", description: "把一次项目沉淀为后续可运营的内容资产。" }], prefix) + '</div></section><section class="' + p("facts") + '"><div><h2>' + t.esc(fixedValue(t.site.companyName || t.site.siteName, t.brand)) + '</h2><p>' + t.esc(t.description) + '</p></div><dl><div><dt>服务对象</dt><dd>' + t.esc(audiences || "以企业实际客户为准") + '</dd></div><div><dt>服务方向</dt><dd>' + t.esc(directions || "企业服务") + '</dd></div>' + ((contact.serviceArea || contact.industryRegion) ? '<div><dt>服务区域</dt><dd>' + t.esc([contact.industryRegion, contact.serviceArea].filter(Boolean).join(" · ")) + '</dd></div>' : "") + '</dl></section><section class="' + p("action") + '"><h2>从企业真实情况开始沟通</h2>' + t.action("联系我们", "/contact/", "button ink") + '</section></div>';
  }
  if (t.pageId === "contact") {
    return '<div class="' + p("contact-page") + '">' + fixedHeading(t, "CONTACT", t.title, t.description, p("intro")) + '<section class="' + p("contact-panel") + '"><div><h2>一次有准备的业务沟通</h2><p>请留下企业名称、联系方式和希望解决的问题，我们会先了解业务背景，再判断下一步。</p><div class="fixed-contact-details">' + fixedContactDetails(t) + '</div><ul><li>先了解企业现状</li><li>判断问题所在环节</li><li>给出可执行的下一步</li></ul></div><div class="' + p("form") + '">' + (typeof t.renderContactForm === "function" ? t.renderContactForm(sourcePath) : "") + '</div></section></div>';
  }
  if (t.pageId === "problem-detail") {
    const problem = t.fixed?.problem || {};
    const group = t.fixed?.group || {};
    return '<div class="' + p("problem-detail-page") + '">' + fixedHeading(t, fixedValue(group?.service, "QUESTION"), fixedValue(problem?.title, t.title), fixedValue(problem?.answer, t.description), p("intro")) + '<article class="' + p("answer") + '"><span>直接回答</span><p>' + t.esc(fixedValue(problem?.answer, t.description)) + '</p></article><div class="' + p("detail-grid") + '"><section><h2>这个问题为什么重要</h2><p>客户提出的问题往往比企业自我介绍更接近真实决策。把问题说清楚，才能让官网、文章和服务说明围绕同一套事实展开。</p><h2>建议从哪里开始</h2><ol><li>确认企业主体、产品服务和应用场景。</li><li>补充采购、技术和使用阶段的具体判断条件。</li><li>用结构清晰的内容回答问题，并连接服务与联系方式。</li></ol></section><aside><span>所属服务</span><b>' + t.esc(fixedValue(group?.service, "客户问题")) + '</b><span>适用行业</span><b>' + t.esc(fixedList(problem?.industries).join(" · ") || "以实际场景为准") + '</b>' + t.action("围绕这个问题咨询", "/contact/", "button primary") + '</aside></div>' + (articles.length ? '<section class="' + p("related") + '">' + fixedHeading(t, "RELATED", "继续阅读", "查看同一服务方向下的行业内容。") + '<div>' + articles.slice(0, 3).map((item, index) => fixedArticleMarkup(t, item, prefix, index)).join("") + '</div></section>' : "") + '</div>';
  }
  const modules = t.fixedModules || [];
  return '<div class="' + p("generic-page") + '">' + (modules.length ? modules.map((module, index) => fixedModuleMarkup(t, module, prefix, index, sourcePath)).join("") : '<section class="' + p("empty") + '"><h1>' + t.esc(t.title) + '</h1><p>' + t.esc(t.description) + '</p></section>') + '</div>';
}
