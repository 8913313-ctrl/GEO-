import {
  chromeContext,
  fixedContactDetails,
  fixedContext,
  fixedFactsMarkup,
  fixedList,
  fixedValue,
  themeContext
} from "./runtime.mjs";

/*
 * These three packages are intentionally not skin variants.  They share only
 * the CMS data boundary in runtime.mjs; chrome, home, reading and every fixed
 * route below own their individual DOM topology.
 */

function imageOrPlaceholder(t, item, className, label, options = {}) {
  const media = t.image(item || {}, className, options);
  return media || '<div class="' + t.esc(className) + ' theme-image-placeholder" role="img" aria-label="' + t.esc(label) + '"><span>待补充企业已授权图片</span><small>' + t.esc(label) + '</small></div>';
}

function articleRows(t, items, className, options = {}) {
  return fixedList(items).slice(0, options.limit || 4).map((item, index) =>
    '<article class="' + t.esc(className) + '">' +
      (options.image ? imageOrPlaceholder(t, item, options.image, "文章配图") : "") +
      '<div><small>' + t.esc(fixedValue(item?.categoryName, "行业内容")) + ' / ' + t.esc(t.date(item?.publishedAt)) + '</small>' +
      '<h3><a href="' + t.esc(t.articleLink(item)) + '">' + t.esc(fixedValue(item?.title, "未命名文章")) + '</a></h3>' +
      '<p>' + t.esc(fixedValue(item?.excerpt, "查看企业已审核公开内容。")) + '</p>' +
      '<a href="' + t.esc(t.articleLink(item)) + '">阅读全文 <span aria-hidden="true">→</span></a></div>' +
      (options.index ? '<b>' + String(index + 1).padStart(2, "0") + '</b>' : "") +
    '</article>'
  ).join("");
}

function serviceRows(t, items, className, formatter) {
  return fixedList(items).slice(0, 8).map((item, index) => formatter(item || {}, index, className)).join("");
}

function navItems(t, className) {
  return t.navLinks(className);
}

/* ───────────────────────── 空间材料 / 档案式网站 ───────────────────────── */

function renderSpaceHeader(ctx = {}) {
  const t = chromeContext(ctx);
  return '<header class="site-header theme-space-materials-header space-chrome" data-theme-chrome="space-materials">' +
    '<div class="shell space-topline"><a class="brand space-brand" href="/" aria-label="' + t.esc(t.brand) + '首页">' + t.brandMarkup + '</a><span>MATERIAL ARCHIVE / ' + t.esc(t.currentYear) + '</span></div>' +
    '<div class="shell space-navigation"><span>以材质组织空间体验</span><nav class="nav-links space-nav-links" aria-label="主导航">' + navItems(t, "space-nav-link") + '</nav><a class="nav-cta" href="/contact/">预约选材</a>' + t.menuButton() + '</div>' +
    t.mobileNavigation("space-materials", "预约选材") + '</header>';
}

function renderSpaceFooter(ctx = {}) {
  const t = chromeContext(ctx);
  return '<footer class="site-footer theme-space-materials-footer space-footer" data-theme-chrome="space-materials"><div class="shell space-footer-index">' +
    '<section><span>SPACE / MATERIAL / LIVING</span><a class="brand" href="/">' + t.brandMarkup + '</a><p>企业资料、空间案例与已审核内容共同构成可持续更新的材料档案。</p></section>' +
    '<nav aria-label="空间入口"><b>探索空间</b><a href="/services/">产品与系列</a><a href="/cases/">工程案例</a><a href="/insights/">空间灵感</a></nav>' +
    '<nav aria-label="服务入口"><b>服务支持</b><a href="/problem-map/">选材问题</a><a href="/about/">关于企业</a><a href="/contact/">预约咨询</a></nav>' +
    '<address><b>联系</b>' + (t.contact.phone ? '<a href="tel:' + t.esc(t.contact.phone) + '">' + t.esc(t.contact.phone) + '</a>' : '<a href="/contact/">提交选材需求</a>') + (t.contact.email ? '<a href="mailto:' + t.esc(t.contact.email) + '">' + t.esc(t.contact.email) + '</a>' : '') + '</address></div><div class="shell space-footer-bottom"><span>© ' + t.esc(t.currentYear) + ' ' + t.esc(t.company) + '</span>' + t.icpLink() + '<span>只展示来源明确、已审核的企业资料</span></div></footer>';
}

function renderSpaceHome(ctx = {}) {
  const t = themeContext(ctx);
  const heroSource = t.articles[0] || t.cases[0] || null;
  const services = serviceRows(t, t.services, "space-service-row", (item, index) =>
    '<article class="space-service-row"><span>' + String(index + 1).padStart(2, "0") + '</span><div><h3>' + t.esc(fixedValue(item.title || item.name, "材料系列")) + '</h3><p>' + t.esc(fixedValue(item.description, "查看适用空间、材质说明与服务边界。")) + '</p></div><a href="' + t.esc(fixedValue(item.href, "/services/")) + '">进入系列 →</a></article>'
  );
  const cases = fixedList(t.cases).slice(0, 3).map((item) => '<article class="space-project-tile">' + imageOrPlaceholder(t, item, "space-project-image", "空间项目参考图") + '<div><small>' + t.esc(fixedValue(item.industry || item.service, "空间项目")) + '</small><h3>' + t.esc(fixedValue(item.title, "项目记录")) + '</h3><p>' + t.esc(fixedValue(item.summary, "项目资料正在整理。")) + '</p></div></article>').join("");
  return '<section class="theme-space-home" data-theme-layout="material-archive-home">' +
    '<header class="space-hero"><div class="space-hero-copy"><h1>' + t.esc(t.site.homeTitle || t.brand) + '</h1><p>' + t.esc(t.description) + '</p><div class="space-hero-actions">' + t.action(t.site.cta || "预约选材", "/contact/", "button primary") + t.action("查看空间案例", "/cases/", "button secondary") + '</div></div><div class="space-hero-media">' + imageOrPlaceholder(t, heroSource, "space-hero-image", "首页空间主视觉", { eager: true, caption: true }) + '<span class="space-seal" aria-hidden="true">MATERIAL<br>ARCHIVE</span></div></header>' +
    '<section class="space-introduction"><h2>从一份材料档案，进入完整的空间方法。</h2><p>先从真实空间、产品系列、应用条件和设计服务开始，再进入可公开核验的项目内容。</p></section>' +
    '<section class="space-series"><header><h2>产品与空间系列</h2><a href="/services/">全部系列 →</a></header><div>' + (services || '<p class="theme-empty">请先在后台补充已审核的产品与服务资料。</p>') + '</div></section>' +
    (cases ? '<section class="space-projects"><header><h2>工程案例</h2><a href="/cases/">查看项目 →</a></header><div>' + cases + '</div></section>' : '') +
    '<section class="space-reading"><header><h2>材料与空间阅读</h2><a href="/insights/">全部文章 →</a></header><div>' + (articleRows(t, t.articles, "space-reading-row", { limit: 3, index: true }) || '<p class="theme-empty">已审核文章会在这里出现。</p>') + '</div></section>' +
    '<footer class="space-close"><div><h2>把空间条件告诉我们，获得下一步建议。</h2><p>提交用途、尺寸、材质偏好或已有项目资料。</p></div>' + t.action("开始选材咨询", "/contact/", "button ink") + '</footer></section>';
}

function renderSpaceListing(ctx = {}) {
  const t = themeContext(ctx);
  const rows = articleRows(t, t.articles, "space-journal-entry", { limit: 100, image: "space-journal-image", index: true });
  return '<section class="theme-space-listing" data-theme-layout="material-journal"><header class="space-listing-head"><span>SPACE JOURNAL</span><h1>' + t.esc(ctx.title || "材料与空间阅读") + '</h1><p>' + t.esc(ctx.description || t.description) + '</p></header><nav class="space-category-bar"><a class="is-active" href="/insights/">全部文章</a>' + t.categories.map((category) => t.link(category.name || category.title, t.categoryLink(category))).join("") + '</nav><div class="space-journal-list">' + (rows || '<p class="theme-empty">暂无已审核文章。</p>') + '</div>' + (ctx.pagination || "") + '</section>';
}

function renderSpaceArticle(ctx = {}) {
  const t = themeContext(ctx); const a = ctx.article || {};
  const headings = (ctx.headings || []).map((item) => '<a href="#' + t.esc(item.id) + '">' + t.esc(item.title) + '</a>').join("");
  return '<section class="theme-space-article" data-theme-layout="spatial-reading"><header class="space-article-head"><div><span>' + t.esc(a.categoryName || "空间笔记") + '</span><h1>' + t.esc(a.title) + '</h1><p>' + t.esc(a.excerpt || "") + '</p><small>' + t.esc(a.author || t.brand) + ' / ' + t.esc(t.date(a.publishedAt)) + '</small></div></header><div class="space-reading-layout"><aside><b>目录</b>' + (headings || '<a href="/insights/">返回全部文章</a>') + '</aside><article>' + imageOrPlaceholder(t, a, "space-article-cover", "文章封面图", { eager: true, caption: true }) + (ctx.contentHtml || "") + '<footer>本文图片仅使用已审核、来源可追溯的企业素材。</footer></article></div>' + t.related("space-materials", "space-related", "继续阅读") + '</section>';
}

function renderSpaceFixed(ctx = {}) {
  const t = fixedContext(ctx); const services = t.fixedServices || []; const cases = t.fixedCases || []; const groups = t.fixedGroups || []; const sourcePath = t.page?.path || "/contact/";
  let content = "";
  if (t.pageId === "services") content = '<section class="space-service-page"><header><span>THE MATERIAL INDEX</span><h2>从空间用途进入产品与服务。</h2><p>' + t.esc(t.description) + '</p></header><div class="space-service-register">' + (serviceRows(t, services, "space-service-sheet", (item, index) => '<article class="space-service-sheet"><span>' + String(index + 1).padStart(2, "0") + '</span><div><h3>' + t.esc(fixedValue(item.title || item.name, "材料系列")) + '</h3><p>' + t.esc(fixedValue(item.description, "资料待补充。")) + '</p></div><dl><div><dt>适用空间</dt><dd>' + t.esc(fixedValue(item.audience, "以企业实际应用说明为准")) + '</dd></div><div><dt>服务内容</dt><dd>' + t.esc(fixedValue(item.focus || item.cmsFocus, "选材、应用与设计支持")) + '</dd></div></dl><a href="' + t.esc(fixedValue(item.href, "/contact/")) + '">了解更多 →</a></article>') || '<p class="theme-empty">请补充产品或服务资料。</p>') + '</div></section>';
  else if (t.pageId === "cases") content = '<section class="space-case-page"><header><span>PROJECT ARCHIVE</span><h2>空间项目记录</h2><p>案例只展示已审核的企业项目资料。</p></header><div class="space-case-gallery">' + (cases.map((item) => '<article>' + imageOrPlaceholder(t, item, "space-case-image", "项目图片") + '<div><small>' + t.esc(fixedValue(item.industry || item.service, "项目场景")) + '</small><h3>' + t.esc(fixedValue(item.title, "项目记录")) + '</h3><p>' + t.esc(fixedValue(item.summary, "项目说明待补充。")) + '</p><b>' + t.esc(fixedValue(item.result, "结果待补充")) + '</b></div></article>').join("") || '<p class="theme-empty">暂无可公开案例。</p>') + '</div></section>';
  else if (t.pageId === "problem-map") content = '<section class="space-question-page"><header><h2>从你的空间问题开始。</h2><p>' + t.esc(t.description) + '</p></header><div>' + (groups.map((group) => '<section><h3>' + t.esc(fixedValue(group.title, "选材问题")) + '</h3><p>' + t.esc(fixedValue(group.description, "选择一个问题查看已审核的直接回答。")) + '</p><ol>' + fixedList(group.questions).map((item, index) => '<li><a href="/problem-map/' + encodeURIComponent(fixedValue(item.slug, item.id || "question")) + '/"><span>' + String(index + 1).padStart(2, "0") + '</span><b>' + t.esc(fixedValue(item.title, "常见问题")) + '</b><i>→</i></a></li>').join("") + '</ol></section>').join("") || '<p class="theme-empty">问题库正在整理。</p>') + '</div></section>';
  else if (t.pageId === "about") content = '<section class="space-about-page"><div><span>ABOUT THE MATERIAL</span><h2>' + t.esc(t.site.companyName || t.brand) + '</h2><p>' + t.esc(t.description) + '</p></div><div class="space-about-facts">' + fixedFactsMarkup(t, [{ title: "企业主体", description: t.site.companyName || t.brand }, { title: "公开信息", description: "只展示已审核、可追溯的企业资料。" }, { title: "服务方式", description: "通过空间、产品、案例与咨询建立清晰路径。" }], "space") + '</div></section>';
  else if (t.pageId === "contact") content = '<section class="space-contact-page"><div><span>START WITH YOUR SPACE</span><h2>告诉我们你的空间条件。</h2><p>可提交项目用途、材质偏好、现有图纸或需要进一步确认的问题。</p><div class="fixed-contact-details">' + fixedContactDetails(t) + '</div></div><div class="space-contact-form">' + (typeof t.renderContactForm === "function" ? t.renderContactForm(sourcePath) : "") + '</div></section>';
  else if (t.pageId === "problem-detail") { const problem = t.fixed?.problem || {}; content = '<article class="space-answer-page"><span>选材问题</span><h2>' + t.esc(fixedValue(problem.title, t.title)) + '</h2><p>' + t.esc(fixedValue(problem.answer, t.description)) + '</p>' + t.action("围绕这个问题咨询", "/contact/", "button primary") + '</article>'; }
  else content = '<section class="space-generic-page"><h1>' + t.esc(t.title) + '</h1><p>' + t.esc(t.description) + '</p></section>';
  return '<section class="theme-space-fixed theme-space-fixed-' + t.esc(t.pageId) + '" data-theme-layout="material-public-pages"><header class="space-fixed-head"><span>SPACE / MATERIAL</span><h1>' + t.esc(t.title) + '</h1><p>' + t.esc(t.description) + '</p></header>' + content + '</section>';
}

export const spaceMaterials = { key: "space-materials", renderHeader: renderSpaceHeader, renderFooter: renderSpaceFooter, renderHome: renderSpaceHome, renderListing: renderSpaceListing, renderArticle: renderSpaceArticle, renderFixed: renderSpaceFixed };

/* ───────────────────────── UPS / 控制台式网站 ───────────────────────── */

function renderPowerHeader(ctx = {}) {
  const t = chromeContext(ctx);
  return '<header class="site-header theme-power-systems-header power-chrome" data-theme-chrome="power-systems"><div class="shell power-topline"><a class="brand power-brand" href="/" aria-label="' + t.esc(t.brand) + '首页">' + t.brandMarkup + '</a><div><span class="power-status"><i></i> SYSTEM ONLINE</span>' + (t.contact.phone ? '<a href="tel:' + t.esc(t.contact.phone) + '">' + t.esc(t.contact.phone) + '</a>' : '') + '<a class="nav-cta" href="/contact/">提交工况</a>' + t.menuButton() + '</div></div><nav class="shell power-navigation" aria-label="主导航">' + navItems(t, "power-nav-link") + '</nav>' + t.mobileNavigation("power-systems", "提交工况") + '</header>';
}

function renderPowerFooter(ctx = {}) {
  const t = chromeContext(ctx);
  return '<footer class="site-footer theme-power-systems-footer power-footer" data-theme-chrome="power-systems"><div class="shell power-footer-status"><span><i></i> SUPPORT CHANNEL / READY</span><b>PUBLIC TECHNICAL SOURCE</b></div><div class="shell power-footer-grid"><section><a class="brand" href="/">' + t.brandMarkup + '</a><p>用已审核的产品、场景、资料与支持路径，帮助客户完成可靠的技术判断。</p></section><nav aria-label="产品入口"><span>PRODUCT</span><a href="/services/">产品与选型</a><a href="/cases/">应用案例</a><a href="/problem-map/">技术问答</a></nav><nav aria-label="资料入口"><span>RESOURCE</span><a href="/insights/">技术资料</a><a href="/llms.txt">AI 索引</a><a href="/feed.xml">更新订阅</a></nav><address><span>SUPPORT</span>' + (t.contact.phone ? '<a href="tel:' + t.esc(t.contact.phone) + '">' + t.esc(t.contact.phone) + '</a>' : '<a href="/contact/">提交支持请求</a>') + (t.contact.email ? '<a href="mailto:' + t.esc(t.contact.email) + '">' + t.esc(t.contact.email) + '</a>' : '') + '</address></div><div class="shell power-footer-bottom"><span>© ' + t.esc(t.currentYear) + ' ' + t.esc(t.company) + '</span>' + t.icpLink() + '<span>TECHNICAL INFORMATION / REVIEWED</span></div></footer>';
}

function renderPowerHome(ctx = {}) {
  const t = themeContext(ctx); const heroSource = t.articles[0] || t.cases[0] || null;
  const capabilities = serviceRows(t, t.services, "power-entry", (item, index) => '<a class="power-entry" href="' + t.esc(fixedValue(item.href, "/services/")) + '"><span>0' + (index + 1) + '</span><div><b>' + t.esc(fixedValue(item.title || item.name, "产品选型")) + '</b><small>' + t.esc(fixedValue(item.audience, "按实际工况进入")) + '</small></div><i>→</i></a>');
  return '<section class="theme-power-home" data-theme-layout="power-control-home"><header class="power-hero"><div class="power-hero-media">' + imageOrPlaceholder(t, heroSource, "power-hero-image", "UPS 与数据中心应用场景", { eager: true, caption: true }) + '</div><div class="power-hero-shade"></div><div class="power-hero-copy"><span class="power-status"><i></i> CONTINUITY / POWER / DATA CENTER</span><h1>' + t.esc(t.site.homeTitle || t.brand) + '</h1><p>' + t.esc(t.description) + '</p><div>' + t.action(t.site.cta || "进入产品选型", "/services/", "button primary") + t.action("查看解决方案", "/cases/", "button secondary") + '</div></div><dl class="power-hero-spec"><div><dt>应用场景</dt><dd>以企业已配置场景为准</dd></div><div><dt>选型入口</dt><dd>产品与工况匹配</dd></div><div><dt>服务路径</dt><dd>资料下载 / 技术咨询</dd></div></dl></header><section class="power-decision"><div><h2>把可靠性说清楚，才能让采购开始。</h2><p>围绕工况、产品、资料、案例和服务支持组织网站，不用空泛承诺替代技术信息。</p></div><div class="power-entry-list">' + (capabilities || '<p class="theme-empty">请先补充产品与服务资料。</p>') + '</div></section><section class="power-resources"><header><h2>技术资料</h2><a href="/insights/">进入资料中心 →</a></header><div>' + (articleRows(t, t.articles, "power-resource", { limit: 3, index: true }) || '<p class="theme-empty">已审核技术内容会在这里出现。</p>') + '</div></section><footer class="power-close"><h2>带上你的实际工况，获得下一步建议。</h2>' + t.action("提交工况", "/contact/", "button ink") + '</footer></section>';
}

function renderPowerListing(ctx = {}) {
  const t = themeContext(ctx);
  const rows = fixedList(t.articles).map((item, index) => '<article class="power-manual-row"><span>' + String(index + 1).padStart(2, "0") + '</span>' + imageOrPlaceholder(t, item, "power-manual-cover", "技术资料配图") + '<div><small>' + t.esc(fixedValue(item.categoryName, "TECHNICAL NOTE")) + ' / ' + t.esc(t.date(item.publishedAt)) + '</small><h2><a href="' + t.esc(t.articleLink(item)) + '">' + t.esc(fixedValue(item.title, "技术资料")) + '</a></h2><p>' + t.esc(fixedValue(item.excerpt, "已审核的技术内容。")) + '</p></div><a href="' + t.esc(t.articleLink(item)) + '">阅读 →</a></article>').join("");
  return '<section class="theme-power-listing" data-theme-layout="technical-manual-list"><header><span class="power-status"><i></i> KNOWLEDGE BASE</span><h1>' + t.esc(ctx.title || "技术资料") + '</h1><p>' + t.esc(ctx.description || t.description) + '</p></header><nav class="power-category-bar"><a class="is-active" href="/insights/">全部资料</a>' + t.categories.map((category) => t.link(category.name || category.title, t.categoryLink(category))).join("") + '</nav><div class="power-manual-list">' + (rows || '<p class="theme-empty">暂无已审核资料。</p>') + '</div>' + (ctx.pagination || "") + '</section>';
}

function renderPowerArticle(ctx = {}) {
  const t = themeContext(ctx); const a = ctx.article || {}; const toc = (ctx.headings || []).map((item, index) => '<a href="#' + t.esc(item.id) + '"><span>' + String(index + 1).padStart(2, "0") + '</span>' + t.esc(item.title) + '</a>').join("");
  return '<section class="theme-power-article" data-theme-layout="technical-manual"><header class="power-article-head"><div><span class="power-status"><i></i> TECHNICAL MANUAL</span><h1>' + t.esc(a.title) + '</h1><p>' + t.esc(a.excerpt || "") + '</p></div><dl><div><dt>发布</dt><dd>' + t.esc(t.date(a.publishedAt)) + '</dd></div><div><dt>来源</dt><dd>' + t.esc(a.author || t.brand) + '</dd></div><div><dt>状态</dt><dd>已审核</dd></div></dl></header><div class="power-article-layout"><aside><b>本页索引</b>' + (toc || '<a href="/insights/">返回资料中心</a>') + '</aside><article>' + imageOrPlaceholder(t, a, "power-article-cover", "文章封面图", { eager: true, caption: true }) + '<div class="power-direct-answer"><strong>内容摘要</strong><p>' + t.esc(a.excerpt || "") + '</p></div>' + (ctx.contentHtml || "") + '<footer>内容与图片均以企业审核通过版本为准。</footer></article></div>' + t.related("power-systems", "power-related", "相关技术资料") + '</section>';
}

function renderPowerFixed(ctx = {}) {
  const t = fixedContext(ctx); const services = t.fixedServices || []; const cases = t.fixedCases || []; const groups = t.fixedGroups || []; const sourcePath = t.page?.path || "/contact/"; let content = "";
  if (t.pageId === "services") content = '<section class="power-products-page"><header><span class="power-status"><i></i> PRODUCT AND SELECTION</span><h2>按条件进入产品与服务。</h2><p>' + t.esc(t.description) + '</p></header><div>' + (serviceRows(t, services, "power-product-unit", (item, index) => '<article class="power-product-unit"><span>UNIT-' + String(index + 1).padStart(2, "0") + '</span><h3>' + t.esc(fixedValue(item.title || item.name, "产品能力")) + '</h3><p>' + t.esc(fixedValue(item.description, "资料待补充。")) + '</p><dl><div><dt>适用条件</dt><dd>' + t.esc(fixedValue(item.audience, "以企业实际产品资料为准")) + '</dd></div><div><dt>技术重点</dt><dd>' + t.esc(fixedValue(item.focus || item.cmsFocus, "查看选型资料与咨询支持")) + '</dd></div></dl><a href="' + t.esc(fixedValue(item.href, "/contact/")) + '">查看单元 →</a></article>') || '<p class="theme-empty">请先补充产品资料。</p>') + '</div></section>';
  else if (t.pageId === "cases") content = '<section class="power-project-page"><header><span>APPLICATION LOG</span><h2>应用与项目记录</h2><p>仅展示可以公开、经审核的案例说明。</p></header><div class="power-project-log">' + (cases.map((item, index) => '<article><span>LOG-' + String(index + 1).padStart(2, "0") + '</span><div><small>' + t.esc(fixedValue(item.industry || item.service, "应用场景")) + '</small><h3>' + t.esc(fixedValue(item.title, "应用记录")) + '</h3><p>' + t.esc(fixedValue(item.summary, "资料待补充。")) + '</p></div><b>' + t.esc(fixedValue(item.result, "结果待补充")) + '</b></article>').join("") || '<p class="theme-empty">暂无可公开案例。</p>') + '</div></section>';
  else if (t.pageId === "problem-map") content = '<section class="power-question-page"><header><h2>技术问题索引</h2><p>先按实际场景锁定问题，再查看已审核的直接回答。</p></header><div class="power-question-grid">' + (groups.map((group, groupIndex) => '<section><header><span>CHANNEL ' + String(groupIndex + 1).padStart(2, "0") + '</span><h3>' + t.esc(fixedValue(group.title, "技术问题")) + '</h3></header><ol>' + fixedList(group.questions).map((item, index) => '<li><a href="/problem-map/' + encodeURIComponent(fixedValue(item.slug, item.id || "question")) + '/"><span>SIG-' + String(index + 1).padStart(2, "0") + '</span><b>' + t.esc(fixedValue(item.title, "常见问题")) + '</b><i>→</i></a></li>').join("") + '</ol></section>').join("") || '<p class="theme-empty">问题库正在整理。</p>') + '</div></section>';
  else if (t.pageId === "about") content = '<section class="power-about-page"><div class="power-about-core"><span>PUBLIC ENTITY</span><b>' + t.esc((t.site.companyName || t.brand).slice(0, 3)) + '</b><i></i></div><div><h2>' + t.esc(t.site.companyName || t.brand) + '</h2><p>' + t.esc(t.description) + '</p><div class="power-about-facts">' + fixedFactsMarkup(t, [{ title: "企业主体", description: t.site.companyName || t.brand }, { title: "内容状态", description: "公开资料遵循人工审核与来源追溯。" }, { title: "服务支持", description: "围绕实际技术条件提供下一步路径。" }], "power") + '</div></div></section>';
  else if (t.pageId === "contact") content = '<section class="power-contact-page"><div><span class="power-status"><i></i> SUPPORT CHANNEL</span><h2>提交你的技术工况。</h2><p>描述应用场景、现有条件与需要解决的问题，方便后续判断适合的支持路径。</p><div class="fixed-contact-details">' + fixedContactDetails(t) + '</div></div><div class="power-contact-form">' + (typeof t.renderContactForm === "function" ? t.renderContactForm(sourcePath) : "") + '</div></section>';
  else if (t.pageId === "problem-detail") { const problem = t.fixed?.problem || {}; content = '<article class="power-answer-page"><span class="power-status"><i></i> DIRECT ANSWER</span><h2>' + t.esc(fixedValue(problem.title, t.title)) + '</h2><p>' + t.esc(fixedValue(problem.answer, t.description)) + '</p>' + t.action("提交实际工况", "/contact/", "button primary") + '</article>'; }
  else content = '<section class="power-generic-page"><h1>' + t.esc(t.title) + '</h1><p>' + t.esc(t.description) + '</p></section>';
  return '<section class="theme-power-fixed theme-power-fixed-' + t.esc(t.pageId) + '" data-theme-layout="technical-public-pages"><header class="power-fixed-head"><span class="power-status"><i></i> POWER SYSTEMS</span><h1>' + t.esc(t.title) + '</h1><p>' + t.esc(t.description) + '</p></header>' + content + '</section>';
}

export const powerSystems = { key: "power-systems", renderHeader: renderPowerHeader, renderFooter: renderPowerFooter, renderHome: renderPowerHome, renderListing: renderPowerListing, renderArticle: renderPowerArticle, renderFixed: renderPowerFixed };

/* ───────────────────────── 供应链 / 服务分流式网站 ───────────────────────── */

function renderFlowHeader(ctx = {}) {
  const t = chromeContext(ctx);
  return '<header class="site-header theme-supply-chain-header flow-chrome" data-theme-chrome="supply-chain"><div class="shell flow-topline"><a class="brand flow-brand" href="/" aria-label="' + t.esc(t.brand) + '首页">' + t.brandMarkup + '</a><span>业务咨询 ' + (t.contact.phone ? '<b>' + t.esc(t.contact.phone) + '</b>' : '') + '</span></div><div class="shell flow-navigation"><nav class="nav-links flow-nav-links" aria-label="主导航">' + navItems(t, "flow-nav-link") + '</nav><a class="nav-cta" href="/contact/">提交业务需求 →</a>' + t.menuButton() + '</div>' + t.mobileNavigation("supply-chain", "提交业务需求") + '</header>';
}

function renderFlowFooter(ctx = {}) {
  const t = chromeContext(ctx);
  return '<footer class="site-footer theme-supply-chain-footer flow-footer" data-theme-chrome="supply-chain"><div class="shell flow-footer-start"><div><a class="brand" href="/">' + t.brandMarkup + '</a><h2>从一件具体的业务开始。</h2><p>寄递、企业物流、行业方案与合作需求都有各自清晰的入口。</p></div><a class="button primary" href="/contact/">提交业务需求</a></div><div class="shell flow-footer-grid"><nav aria-label="服务入口"><b>服务入口</b><a href="/services/">企业物流</a><a href="/cases/">行业方案</a><a href="/problem-map/">常见问题</a></nav><nav aria-label="资源入口"><b>资源入口</b><a href="/insights/">行业资讯</a><a href="/about/">关于企业</a><a href="/llms.txt">AI 索引</a></nav><address><b>人工沟通</b>' + (t.contact.phone ? '<a href="tel:' + t.esc(t.contact.phone) + '">' + t.esc(t.contact.phone) + '</a>' : '<a href="/contact/">提交业务需求</a>') + (t.contact.email ? '<a href="mailto:' + t.esc(t.contact.email) + '">' + t.esc(t.contact.email) + '</a>' : '') + '</address></div><div class="shell flow-footer-bottom"><span>© ' + t.esc(t.currentYear) + ' ' + t.esc(t.company) + '</span>' + t.icpLink() + '<span>以企业实际服务网络与公开资料为准</span></div></footer>';
}

function renderFlowHome(ctx = {}) {
  const t = themeContext(ctx); const heroSource = t.articles[0] || t.cases[0] || null;
  const serviceChoices = fixedList(t.services).slice(0, 4).map((item, index) => '<a class="flow-choice" href="' + t.esc(fixedValue(item.href, "/services/")) + '"><span>' + String(index + 1).padStart(2, "0") + '</span><div><b>' + t.esc(fixedValue(item.title || item.name, "业务咨询")) + '</b><small>' + t.esc(fixedValue(item.audience, "查看适用服务")) + '</small></div><i>→</i></a>').join("");
  return '<section class="theme-flow-home" data-theme-layout="service-split-home"><header class="flow-hero"><div class="flow-hero-media">' + imageOrPlaceholder(t, heroSource, "flow-hero-image", "供应链服务场景", { eager: true, caption: true }) + '</div><div class="flow-hero-tint"></div><div class="flow-hero-copy"><h1>' + t.esc(t.site.homeTitle || t.brand) + '</h1><p>' + t.esc(t.description) + '</p><a class="button primary" href="/services/">进入企业物流方案</a></div><aside class="flow-choice-panel"><h2>你现在要解决哪一件事？</h2><div>' + (serviceChoices || '<p class="theme-empty">请先在后台配置服务入口。</p>') + '</div></aside></header><section class="flow-network"><article><h2>业务网络</h2><p>按企业实际覆盖区域、运输、仓配与交付能力组织公开信息。</p><a href="/services/">查看服务 →</a></article><article><h2>行业方案</h2><p>从制造、零售、医药或跨境等真实业务场景进入服务路径。</p><a href="/cases/">查看方案 →</a></article><article><h2>服务支持</h2><p>报价、资料准备、人工沟通和交付节点在同一路径中完成。</p><a href="/contact/">提交需求 →</a></article></section><section class="flow-insights"><header><h2>供应链观察</h2><a href="/insights/">全部资讯 →</a></header><div>' + (articleRows(t, t.articles, "flow-insight-row", { limit: 3, index: true }) || '<p class="theme-empty">已审核文章会在这里出现。</p>') + '</div></section></section>';
}

function renderFlowListing(ctx = {}) {
  const t = themeContext(ctx); const rows = articleRows(t, t.articles, "flow-dispatch-row", { limit: 100, image: "flow-dispatch-image", index: true });
  return '<section class="theme-flow-listing" data-theme-layout="dispatch-board"><header><span>OPERATIONS &amp; INSIGHTS</span><h1>' + t.esc(ctx.title || "供应链观察") + '</h1><p>' + t.esc(ctx.description || t.description) + '</p></header><div class="flow-listing-content"><aside><b>按主题浏览</b><a class="is-active" href="/insights/">全部内容</a>' + t.categories.map((category) => t.link(category.name || category.title, t.categoryLink(category))).join("") + '</aside><div class="flow-dispatch-list">' + (rows || '<p class="theme-empty">暂无已审核文章。</p>') + '</div></div>' + (ctx.pagination || "") + '</section>';
}

function renderFlowArticle(ctx = {}) {
  const t = themeContext(ctx); const a = ctx.article || {}; const toc = (ctx.headings || []).map((item) => '<a href="#' + t.esc(item.id) + '">' + t.esc(item.title) + '</a>').join("");
  return '<section class="theme-flow-article" data-theme-layout="route-reading"><header class="flow-article-head"><div><span>OPERATIONS NOTE / ' + t.esc(a.categoryName || "行业内容") + '</span><h1>' + t.esc(a.title) + '</h1><p>' + t.esc(a.excerpt || "") + '</p></div><dl><div><dt>发布</dt><dd>' + t.esc(t.date(a.publishedAt)) + '</dd></div><div><dt>来源</dt><dd>' + t.esc(a.author || t.brand) + '</dd></div></dl></header><div class="flow-reading-layout"><article>' + imageOrPlaceholder(t, a, "flow-article-cover", "文章封面图", { eager: true, caption: true }) + '<div class="flow-article-summary"><strong>阅读摘要</strong><p>' + t.esc(a.excerpt || "") + '</p></div>' + (ctx.contentHtml || "") + '<footer>正文配图来自企业审核通过的素材库。</footer></article><aside><b>本页路线</b>' + (toc || '<a href="/insights/">返回全部内容</a>') + '</aside></div>' + t.related("supply-chain", "flow-related", "相关内容") + '</section>';
}

function renderFlowFixed(ctx = {}) {
  const t = fixedContext(ctx); const services = t.fixedServices || []; const cases = t.fixedCases || []; const groups = t.fixedGroups || []; const sourcePath = t.page?.path || "/contact/"; let content = "";
  if (t.pageId === "services") content = '<section class="flow-service-page"><header><span>BUSINESS ROUTES</span><h2>把服务按客户要做的事分开。</h2><p>' + t.esc(t.description) + '</p></header><div class="flow-service-lanes">' + (serviceRows(t, services, "flow-service-lane", (item, index) => '<article class="flow-service-lane"><span>ROUTE-' + String(index + 1).padStart(2, "0") + '</span><div><h3>' + t.esc(fixedValue(item.title || item.name, "服务入口")) + '</h3><p>' + t.esc(fixedValue(item.description, "服务说明待补充。")) + '</p></div><dl><div><dt>适用对象</dt><dd>' + t.esc(fixedValue(item.audience, "以企业实际业务为准")) + '</dd></div><div><dt>下一步</dt><dd>' + t.esc(fixedValue(item.focus || item.cmsFocus, "提交业务条件与人工沟通")) + '</dd></div></dl><a href="' + t.esc(fixedValue(item.href, "/contact/")) + '">进入服务 →</a></article>') || '<p class="theme-empty">请先补充服务入口。</p>') + '</div></section>';
  else if (t.pageId === "cases") content = '<section class="flow-case-page"><header><span>INDUSTRY ROUTES</span><h2>行业服务路径</h2><p>案例内容仅在企业确认可公开后展示。</p></header><div class="flow-case-stream">' + (cases.map((item, index) => '<article><span>' + String(index + 1).padStart(2, "0") + '</span><div><small>' + t.esc(fixedValue(item.industry || item.service, "业务场景")) + '</small><h3>' + t.esc(fixedValue(item.title, "服务记录")) + '</h3><p>' + t.esc(fixedValue(item.summary, "资料待补充。")) + '</p></div><b>' + t.esc(fixedValue(item.result, "结果待补充")) + '</b></article>').join("") || '<p class="theme-empty">暂无可公开案例。</p>') + '</div></section>';
  else if (t.pageId === "problem-map") content = '<section class="flow-question-page"><header><h2>先找到你要办的事。</h2><p>从业务问题进入相关服务与已经审核的直接回答。</p></header><div class="flow-question-lanes">' + (groups.map((group) => '<section><header><h3>' + t.esc(fixedValue(group.title, "业务问题")) + '</h3><p>' + t.esc(fixedValue(group.description, "按业务场景整理问题。")) + '</p></header>' + fixedList(group.questions).map((item, index) => '<a href="/problem-map/' + encodeURIComponent(fixedValue(item.slug, item.id || "question")) + '/"><span>' + String(index + 1).padStart(2, "0") + '</span><b>' + t.esc(fixedValue(item.title, "常见问题")) + '</b><i>→</i></a>').join("") + '</section>').join("") || '<p class="theme-empty">问题库正在整理。</p>') + '</div></section>';
  else if (t.pageId === "about") content = '<section class="flow-about-page"><div><span>ABOUT THE NETWORK</span><h2>' + t.esc(t.site.companyName || t.brand) + '</h2><p>' + t.esc(t.description) + '</p></div><div class="flow-about-facts">' + fixedFactsMarkup(t, [{ title: "企业主体", description: t.site.companyName || t.brand }, { title: "业务信息", description: "以企业审核后公开的服务网络与资料为准。" }, { title: "沟通方式", description: "先明确实际业务场景，再安排后续路径。" }], "flow") + '</div></section>';
  else if (t.pageId === "contact") content = '<section class="flow-contact-page"><div><span>BUSINESS BRIEF</span><h2>提交一份业务简报。</h2><p>告诉我们你的运输、仓配、交付或合作需求，我们会按实际业务情况安排下一步。</p><div class="fixed-contact-details">' + fixedContactDetails(t) + '</div></div><div class="flow-contact-form">' + (typeof t.renderContactForm === "function" ? t.renderContactForm(sourcePath) : "") + '</div></section>';
  else if (t.pageId === "problem-detail") { const problem = t.fixed?.problem || {}; content = '<article class="flow-answer-page"><span>BUSINESS ANSWER</span><h2>' + t.esc(fixedValue(problem.title, t.title)) + '</h2><p>' + t.esc(fixedValue(problem.answer, t.description)) + '</p>' + t.action("提交业务需求", "/contact/", "button primary") + '</article>'; }
  else content = '<section class="flow-generic-page"><h1>' + t.esc(t.title) + '</h1><p>' + t.esc(t.description) + '</p></section>';
  return '<section class="theme-flow-fixed theme-flow-fixed-' + t.esc(t.pageId) + '" data-theme-layout="service-route-pages"><header class="flow-fixed-head"><span>SUPPLY CHAIN SERVICE</span><h1>' + t.esc(t.title) + '</h1><p>' + t.esc(t.description) + '</p></header>' + content + '</section>';
}

export const supplyChain = { key: "supply-chain", renderHeader: renderFlowHeader, renderFooter: renderFlowFooter, renderHome: renderFlowHome, renderListing: renderFlowListing, renderArticle: renderFlowArticle, renderFixed: renderFlowFixed };
