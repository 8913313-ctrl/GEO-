#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const sourceRoot = path.resolve(process.argv[2] || "D:/lake/jiaoben/数据采集/shuojiepower");
const outputFile = path.resolve(process.argv[3] || "public-site/xinshuojie-content.mjs");
const pagesRoot = path.join(sourceRoot, "pages_text");
const officialName = "山东新硕捷电子科技有限公司";
const sourceName = "山东金沣昌电子科技有限公司";
const sourcePhone = "18253332881";
const sourceAddress = "山东省淄博市张店区齐赛科技市场一期一层甲6号";
const officialPhone = "18678123345";
const officialAddress = "山东省淄博市张店区新村西路223号尚文苑小区世源大厦1210房";

function normalizeImportedText(value) {
  return String(value || "")
    .replaceAll(sourceName, officialName)
    .replaceAll(sourcePhone, officialPhone)
    .replaceAll(sourceAddress, officialAddress);
}

function slugify(value, fallback) {
  const slug = String(value || "").normalize("NFKC").toLocaleLowerCase("zh-CN")
    .replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 110);
  return slug || fallback;
}

function cleanTitle(value) {
  return String(value || "").replace(new RegExp(`[_｜-]?${sourceName}.*$`), "").replace(/[。．]+$/, "").trim();
}

function localImage(lines) {
  const candidates = [];
  for (const line of lines) {
    const match = line.match(/!\[[^\]]*\]\((images\/[^)]+)\)/i);
    if (match) candidates.push(match[1]);
  }
  const picked = candidates.find((item) => !/20260505[\\/]1-260505095925E7\.png$/i.test(item) && !/20240118[\\/]1-24011P95323501\.jpg$/i.test(item) && !/20200720[\\/]1-250620153A5X3\.png$/i.test(item) && !/template[\\/]pc/i.test(item));
  return picked ? `/assets/shuojiepower/${picked.slice("images/".length).replaceAll("\\", "/")}` : "/assets/tz-ind-06.jpg";
}

function firstAid(name) { return (name.match(/_aid(\d+)/i) || [])[1] || "0"; }

function stripNoise(lines) {
  const output = [];
  let stopped = false;
  for (const raw of lines) {
    const line = String(raw || "").trim();
    if (!line) { if (output.length) output.push(""); continue; }
    if (/^相关文章|^相关文章 Related|^产品分类|^产品分类 Product|^在线询盘|^留言框|^关注我们/.test(line)) break;
    if (/^山东金沣昌电子科技有限公司-富兰纳尔|^Powered by EyouCms/.test(line)) { stopped = true; break; }
    if (/^!\[[^\]]*\]\(images\//.test(line)) continue;
    if (/^- (?:网站首页|关于我们|产品中心|新闻中心|客户案例|联系我们)$/.test(line)) continue;
    if (/^首页\s*>|^\[返回列表\]|^\[留言咨询\]|^或拨打：|^\d{1,3}$/.test(line)) continue;
    if (/^\[[^\]]+\]\(https?:\/\/(?:b2b\.baidu\.com|www\.baidu\.com)/.test(line)) continue;
    if (/^20\d{2}-\d{2}-\d{2}$/.test(line) || /^\d{1,6}$/.test(line)) continue;
    if (stopped) continue;
    output.push(line);
  }
  return output.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function markdownToHtml(markdown) {
  const escape = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  const lines = String(markdown || "").split(/\r?\n/);
  const html = [];
  let list = false;
  const closeList = () => { if (list) { html.push("</ul>"); list = false; } };
  for (const line of lines) {
    const value = line.trim();
    if (!value) { closeList(); continue; }
    const heading = value.match(/^(#{2,4})\s+(.+)$/);
    if (heading) { closeList(); html.push(`<h${Math.min(4, heading[1].length)}>${escape(heading[2])}</h${Math.min(4, heading[1].length)}>`); continue; }
    const bullet = value.match(/^[-*]\s+(.+)$/);
    if (bullet) { if (!list) { html.push("<ul>"); list = true; } html.push(`<li>${escape(bullet[1])}</li>`); continue; }
    const image = value.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (image) { closeList(); html.push(`<figure><img src="${escape(image[2])}" alt="${escape(image[1] || "企业图片")}" loading="lazy"><figcaption>${escape(image[1] || "")}</figcaption></figure>`); continue; }
    closeList();
    html.push(`<p>${escape(value).replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" rel="noreferrer">$1</a>')}</p>`);
  }
  closeList();
  return html.join("");
}

const files = fs.readdirSync(pagesRoot).filter((name) => name.endsWith(".md"));
const products = [];
const cases = [];
const articles = [];
for (const file of files) {
  const lines = fs.readFileSync(path.join(pagesRoot, file), "utf8").split(/\r?\n/);
  const firstHeadingIndex = lines.findIndex((line) => /^#\s+/.test(line));
  if (firstHeadingIndex < 0) continue;
  const firstTitle = cleanTitle(lines[firstHeadingIndex].replace(/^#\s+/, ""));
  const aid = firstAid(file);
  const category = file.startsWith("product_") ? "product" : file.startsWith("case_") ? "case" : file.startsWith("news_") ? "news" : "other";
  const secondHeadingIndex = lines.findIndex((line, index) => index > firstHeadingIndex && /^#\s+/.test(line));
  const title = category === "news" && secondHeadingIndex > 0 ? cleanTitle(lines[secondHeadingIndex].replace(/^#\s+/, "")) : firstTitle;
  const bodyStart = category === "news" && secondHeadingIndex > 0 ? secondHeadingIndex + 1 : firstHeadingIndex + 1;
  const body = normalizeImportedText(stripNoise(lines.slice(bodyStart)));
  const image = localImage(lines);
  const excerpt = body.replace(/[#*_`]/g, "").replace(/\s+/g, " ").slice(0, 220);
  if (category === "product") products.push({ id: `xinshuojie-product-${aid}`, title, description: excerpt || `${title}产品参数与适用场景。`, audience: "UPS电源产品", image, imageAlt: title, href: "/contact/", status: "published", order: Number(aid) || products.length + 1 });
  if (category === "case") cases.push({ id: `xinshuojie-case-${aid}`, title, industry: "UPS电源项目", service: "UPS电源", summary: excerpt || "根据现场负载与用电环境完成设备配置、安装连接和系统调试。", result: "项目完成设备配置、安装连接与交付使用。", image, imageAlt: title, href: "/contact/", status: "published", order: Number(aid) || cases.length + 1 });
  if (category === "news") {
    const date = (body.match(/20\d{2}-\d{2}-\d{2}/) || [])[0] || "2026-08-28";
    articles.push({ id: `xinshuojie-news-${aid}`, title, slug: `${slugify(title, `news-${aid}`)}-${aid}`, excerpt, author: officialName, categoryName: "行业新闻", categorySlug: "industry-news", tags: ["UPS电源", "电源保障"], contentHtml: markdownToHtml(body), contentText: body, image, imageAlt: title, publishedAt: date, updatedAt: date, reviewStatus: "approved", riskStatus: "passed", frozenAt: date });
  }
}
products.sort((a, b) => a.order - b.order);
cases.sort((a, b) => b.order - a.order);
articles.sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)) || a.title.localeCompare(b.title, "zh-CN"));

const services = [
  ...products,
  { id: "xinshuojie-eps", title: "EPS应急电源", description: "面向消防、应急照明及重要负载提供 EPS 应急电源配置支持。", audience: "应急供电", image: "/assets/tz-ind-03.jpg", href: "/contact/", status: "published", order: 200 },
  { id: "xinshuojie-stabilizer", title: "稳压电源及稳压器", description: "针对电压波动和电能质量问题提供稳压设备选型、供应与现场服务。", audience: "电能质量", image: "/assets/tz-ind-04.jpg", href: "/contact/", status: "published", order: 201 },
  { id: "xinshuojie-optical-storage", title: "光储充设备", description: "围绕光伏、储能与充电场景提供设备配套和项目落地服务。", audience: "新能源配套", image: "/assets/tz-ind-05.jpg", href: "/contact/", status: "published", order: 202 },
  { id: "xinshuojie-maintenance", title: "安装调试与运维", description: "覆盖现场勘察、线路连接、系统调试、巡检、续保维修与技术咨询。", audience: "工程与售后", image: "/assets/tz-ind-06.jpg", href: "/contact/", status: "published", order: 203 }
];

const source = `// Generated from ${sourceRoot.replaceAll("\\", "/")} on ${new Date().toISOString()}\nexport const XINSHUOJIE_IMPORTED_SERVICES = ${JSON.stringify(services, null, 2)};\nexport const XINSHUOJIE_IMPORTED_CASES = ${JSON.stringify(cases, null, 2)};\nexport const XINSHUOJIE_IMPORTED_ARTICLES = ${JSON.stringify(articles, null, 2)};\n`;
fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, source, "utf8");
console.log(JSON.stringify({ outputFile, products: products.length, cases: cases.length, articles: articles.length }, null, 2));
