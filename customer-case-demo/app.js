(function () {
  const data = window.CASE_DATA;
  const baseline = new Date(data.client.baselineDate + "T00:00:00");
  const today = new Date();
  const day = Math.max(0, Math.floor((new Date(today.getFullYear(), today.getMonth(), today.getDate()) - baseline) / 86400000));
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const fmt = (value) => Number(value).toLocaleString("zh-CN");
  const dateText = (date) => `${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
  const currentDate = new Date(baseline); currentDate.setDate(currentDate.getDate() + day);
  const wobble = Math.sin(day * 1.7) * 1.2;
  const metrics = {
    conversations: data.baseline.conversations + day * 2 + Math.floor(day / 3),
    mentionRate: clamp(data.baseline.mentionRate + Math.round(day * .55 + wobble), 0, 100),
    mentionCount: data.baseline.mentionCount + Math.floor(day * 1.45),
    averageRank: Number(clamp(data.baseline.averageRank - day * .025 + Math.cos(day) * .08, 1, 9).toFixed(1)),
    citationSites: data.baseline.citationSites + Math.floor(day / 3),
    citationArticles: data.baseline.citationArticles + Math.floor(day * 1.3),
    heat: data.baseline.heat + Math.floor(day * .7)
  };
  const $ = (id) => document.getElementById(id);
  const set = (id, value) => { const el = $(id); if (el) el.textContent = value; };
  set("client-name", data.client.name); set("client-industry", data.client.industry);
  set("update-label", `数据日 · ${currentDate.getFullYear()}.${dateText(currentDate)}`); set("as-of", `截至 ${currentDate.getFullYear()}.${dateText(currentDate)}`);
  set("mention-rate", `${metrics.mentionRate}%`); set("average-rank", `${metrics.averageRank} 位`); set("citation-sites", fmt(metrics.citationSites)); set("conversation-count", fmt(metrics.conversations));
  set("mention-delta", `较基线 +${Math.max(0, metrics.mentionRate - data.baseline.mentionRate)} 个百分点`); set("rank-delta", `较基线 ${(metrics.averageRank - data.baseline.averageRank).toFixed(1)} 位`); set("citation-delta", `较基线 +${metrics.citationSites - data.baseline.citationSites} 个站点`); set("conversation-delta", `较基线 +${metrics.conversations - data.baseline.conversations} 条`);
  set("heat-value", metrics.heat); set("mention-count", fmt(metrics.mentionCount)); set("citation-articles", fmt(metrics.citationArticles)); set("trend-rate", `${metrics.mentionRate}%`); set("trend-change", `+${Math.max(0, metrics.mentionRate - data.baseline.mentionRate)}pp`); set("trend-days", Math.min(14, day + 1)); set("record-count", `${data.questions.length} 条基线记录 · +${day} 条演示`);

  const platformList = $("platform-list");
  data.platforms.forEach((platform, index) => {
    const rate = clamp(platform.base + Math.round(day * .35 + Math.sin(day + index) * 1.5), 0, 99);
    const count = platform.count + Math.floor(day * (index % 3 === 0 ? 1.2 : .8));
    platformList.insertAdjacentHTML("beforeend", `<div class="platform-row"><div class="platform-name"><span class="platform-badge" style="background:${platform.color}">${platform.name.slice(0,1)}</span><span><b>${platform.name}</b><small class="platform-terminal">${platform.terminal}</small></span></div><div class="bar-track"><div class="bar-fill" style="width:${rate}%"></div></div><span class="platform-value">${rate}%</span></div>`);
    platformList.lastElementChild.setAttribute("title", `${platform.name} · ${count} 次提及记录`);
  });

  const competitors = (data.competitors || []).map((brand) => ({
    ...brand,
    rate: clamp(brand.mentionRate + (brand.current ? Math.round(day * .55) : Math.round(day * .2)), 0, 100),
    count: brand.mentionCount + Math.floor(day * (brand.current ? 1.45 : .8)),
    averageRank: Number(clamp(brand.rank - (brand.current ? day * .025 : day * .008), 1, 9).toFixed(1))
  }));
  const rateMax = Math.max(...competitors.map((brand) => brand.rate), 1);
  const countMax = Math.max(...competitors.map((brand) => brand.count), 1);
  const renderBenchmarkList = (targetId, values, valueKey, suffix, max) => {
    const target = $(targetId);
    if (!target) return;
    target.innerHTML = values.map((brand, index) => `<div class="benchmark-row ${brand.current ? "is-current" : ""}"><span class="benchmark-rank">${index + 1}</span><span class="benchmark-name" title="${brand.name}">${brand.name}</span><span class="benchmark-bar-track"><i style="width:${Math.round(brand[valueKey] / max * 100)}%"></i></span><b class="benchmark-value">${brand[valueKey]}${suffix}</b></div>`).join("");
  };
  renderBenchmarkList("benchmark-rate", [...competitors].sort((a, b) => b.rate - a.rate), "rate", "%", rateMax);
  renderBenchmarkList("benchmark-count", [...competitors].sort((a, b) => b.count - a.count), "count", "", countMax);
  const rankTarget = $("benchmark-rank");
  if (rankTarget) rankTarget.innerHTML = [...competitors].sort((a, b) => a.averageRank - b.averageRank).map((brand, index) => `<tr class="${brand.current ? "is-current" : ""}"><td>${index + 1}</td><th scope="row" title="${brand.name}">${brand.name}</th><td>${brand.rate}%</td><td>${brand.averageRank} 位</td></tr>`).join("");

  const trend = Array.from({ length: 14 }, (_, index) => { const offset = Math.max(0, day - 13 + index); return { rate: clamp(data.baseline.mentionRate + Math.round(offset * .55 + Math.sin(offset * 1.7) * 1.2), 0, 100), citation: clamp(38 + offset * 2.2 + Math.cos(offset) * 2, 0, 100), date: new Date(baseline.getTime() + offset * 86400000) }; });
  const svg = $("trend-chart"); const W = 900, H = 250, left = 18, right = 14, top = 15, bottom = 28, chartW = W - left - right, chartH = H - top - bottom;
  const point = (value, index) => ({ x: left + index * chartW / (trend.length - 1), y: top + (100 - value) * chartH / 100 });
  const bluePts = trend.map((item, index) => point(item.rate, index)); const amberPts = trend.map((item, index) => point(item.citation, index));
  const path = (points) => points.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area = `${path(bluePts)} L ${bluePts.at(-1).x},${top + chartH} L ${bluePts[0].x},${top + chartH} Z`;
  svg.innerHTML = `<defs><linearGradient id="areaBlue" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#246bfe" stop-opacity=".18"/><stop offset="1" stop-color="#246bfe" stop-opacity="0"/></linearGradient></defs>${[0,50,100].map(v=>{const y=top+(100-v)*chartH/100;return `<line class="chart-grid" x1="${left}" x2="${W-right}" y1="${y}" y2="${y}"/>`}).join("")}<path class="chart-area" d="${area}"/><path class="chart-line-amber" d="${path(amberPts)}"/><path class="chart-line" d="${path(bluePts)}"/>${bluePts.map((p,i)=>`<circle class="chart-point" cx="${p.x}" cy="${p.y}" r="${i===bluePts.length-1?5:3}"/>`).join("")}<text class="chart-label" x="${left}" y="${top + 10}">100%</text><text class="chart-label" x="${left}" y="${top + chartH/2 + 4}">50%</text><text class="chart-label" x="${left}" y="${top + chartH + 4}">0%</text>`;
  $("chart-axis").innerHTML = [trend[0], trend[4], trend[8], trend[13]].map(item => `<span>${dateText(item.date)}</span>`).join("");

  const sourceNames = ["山东新硕捷电子科技有限公司 · 电源解决方案", "工业 UPS 供应商服务页", "UPS 项目交付与售后说明", "山东工业电源行业资料"]; let selected = 0;
  const list = $("question-list");
  function renderQuestions(filter = "") { const filtered = data.questions.filter(item => !filter || item.text.includes(filter) || item.platform.includes(filter)); list.innerHTML = filtered.length ? filtered.map((item, index) => `<button class="question-item ${item === data.questions[selected] ? "active" : ""}" type="button" data-question-index="${data.questions.indexOf(item)}"><strong>${item.text}</strong><span class="question-meta"><span>${item.platform}</span><span>${item.type}</span><span>热度 ${item.heat}</span></span></button>`).join("") : `<div class="method-note"><div><strong>没有匹配的问题</strong><p>换一个 UPS 关键词试试。</p></div></div>`; list.querySelectorAll("[data-question-index]").forEach(button => button.addEventListener("click", () => { selected = Number(button.dataset.questionIndex); renderQuestions($('question-search').value.trim()); renderDialogue(); })); }
  function renderDialogue() { const item = data.questions[selected] || data.questions[0]; set("dialogue-question", item.text); set("source-count", `${item.sources} 个站点 · ${item.articles} 篇文章`); $("dialogue-meta").innerHTML = [`平台 · ${item.platform}`, `类型 · ${item.type}`, `热度值 · ${item.heat}`, `提及状态 · ${item.mention}`, `平均排名 · ${item.rank}`].map((text, index) => `<span class="${index === 3 ? "accent" : ""}">${text}</span>`).join(""); set("dialogue-answer", item.answer); $("source-list").innerHTML = sourceNames.slice(0, Math.min(4, item.sources % 4 + 2)).map((name, index) => `<div class="source-row"><span class="source-num">${index + 1}</span><div><strong>${name}</strong><small>已记录 · ${item.platform}</small></div></div>`).join(""); }
  renderQuestions(); renderDialogue();
  $("question-search").addEventListener("input", event => renderQuestions(event.target.value.trim()));
  $("copy-case-link").addEventListener("click", async () => { try { await navigator.clipboard.writeText(window.location.href); set("copy-case-link", "已复制"); setTimeout(() => set("copy-case-link", "复制案例链接"), 1600); } catch { set("copy-case-link", "请手动复制地址"); } });
})();
