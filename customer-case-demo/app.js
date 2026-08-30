(function () {
  const data = window.CASE_DATA;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const fmt = (value) => Number(value).toLocaleString("zh-CN");
  const dateText = (date) => `${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
  const metrics = {
    conversations: data.baseline.conversations,
    mentionRate: data.baseline.mentionRate,
    mentionCount: data.baseline.mentionCount,
    averageRank: data.baseline.averageRank,
    citationSites: data.baseline.citationSites,
    citationArticles: data.baseline.citationArticles,
    heat: data.baseline.heat
  };
  const $ = (id) => document.getElementById(id);
  const set = (id, value) => { const el = $(id); if (el) el.textContent = value; };
  set("client-name", data.client.name); set("client-industry", data.client.industry);
  set("update-label", `检测时间 · ${data.client.baselineDate.replaceAll("-", ".")}`); set("as-of", `截至 ${data.client.baselineDate.replaceAll("-", ".")}`);
  set("mention-rate", `${metrics.mentionRate}%`); set("average-rank", `${metrics.averageRank} 位`); set("citation-sites", fmt(metrics.citationSites)); set("conversation-count", fmt(metrics.conversations));
  set("mention-delta", "当前检测结果"); set("rank-delta", "当前检测结果"); set("citation-delta", "当前检测结果"); set("conversation-delta", "当前检测结果");
  set("heat-value", metrics.heat); set("mention-count", fmt(metrics.mentionCount)); set("citation-articles", fmt(metrics.citationArticles)); set("trend-rate", `${metrics.mentionRate}%`); set("trend-change", "暂无历史对比"); set("trend-days", data.trend?.length || 1); set("record-count", `${data.questions.length} 条真实记录`);

  const platformList = $("platform-list");
  const platformTitle = platformList?.previousElementSibling;
  if (platformTitle) platformTitle.innerHTML = `<span>平台提及率</span><span class="panel-actions" role="group" aria-label="平台筛选"><button type="button" class="filter-button is-active" data-platform-filter="all">全部</button><button type="button" class="filter-button" data-platform-filter="mentioned">已提及</button><button type="button" class="filter-button" data-platform-filter="unmentioned">未提及</button></span>`;
  const renderPlatforms = (filter = "all") => {
    const visible = data.platforms.filter((platform) => filter === "all" || (filter === "mentioned" ? platform.base > 0 : platform.base === 0));
    platformList.innerHTML = visible.map((platform) => { const rate = clamp(platform.base, 0, 99); return `<button type="button" class="platform-row" data-platform-name="${platform.name}" title="${platform.name} · ${platform.count} 次提及记录"><span class="platform-name"><span class="platform-badge" style="--platform-color:${platform.color}"><img src="./assets/platform-icons/${platform.icon}" alt="${platform.name} 图标" /></span><span><b>${platform.name}</b><small class="platform-terminal">${platform.terminal}</small></span></span><span class="bar-track"><i class="bar-fill" style="width:${rate}%"></i></span><span class="platform-value">${rate}%</span></button>`; }).join("") || `<div class="platform-empty">暂无符合条件的平台记录</div>`;
    platformList.querySelectorAll("[data-platform-name]").forEach((row) => row.addEventListener("click", () => { platformList.querySelectorAll(".platform-row").forEach((item) => item.classList.remove("is-selected")); row.classList.add("is-selected"); }));
  };
  renderPlatforms();
  platformTitle?.querySelectorAll("[data-platform-filter]").forEach((button) => button.addEventListener("click", () => { platformTitle.querySelectorAll(".filter-button").forEach((item) => item.classList.toggle("is-active", item === button)); renderPlatforms(button.dataset.platformFilter); }));

  const competitors = (data.competitors || []).map((brand) => ({
    ...brand,
    rate: clamp(brand.mentionRate, 0, 100),
    count: brand.mentionCount,
    averageRank: Number(clamp(brand.rank, 1, 9).toFixed(1))
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

  const trend = Array.isArray(data.trend) ? data.trend : [];
  const svg = $("trend-chart"); const W = 900, H = 250, left = 18, right = 14, top = 15, bottom = 28, chartW = W - left - right, chartH = H - top - bottom;
  if (trend.length >= 2) {
    const point = (value, index) => ({ x: left + index * chartW / (trend.length - 1), y: top + (100 - value) * chartH / 100 });
    const bluePts = trend.map((item, index) => point(item.rate, index)); const amberPts = trend.map((item, index) => point(item.citation, index));
    const path = (points) => points.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    const area = `${path(bluePts)} L ${bluePts.at(-1).x},${top + chartH} L ${bluePts[0].x},${top + chartH} Z`;
    svg.innerHTML = `<defs><linearGradient id="areaBlue" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#246bfe" stop-opacity=".18"/><stop offset="1" stop-color="#246bfe" stop-opacity="0"/></linearGradient></defs>${[0,50,100].map(v=>{const y=top+(100-v)*chartH/100;return `<line class="chart-grid" x1="${left}" x2="${W-right}" y1="${y}" y2="${y}"/>`}).join("")}<path class="chart-area" d="${area}"/><path class="chart-line-amber" d="${path(amberPts)}"/><path class="chart-line" d="${path(bluePts)}"/>${bluePts.map((p,i)=>`<circle class="chart-point" cx="${p.x}" cy="${p.y}" r="${i===bluePts.length-1?5:3}"/>`).join("")}<text class="chart-label" x="${left}" y="${top + 10}">100%</text><text class="chart-label" x="${left}" y="${top + chartH/2 + 4}">50%</text><text class="chart-label" x="${left}" y="${top + chartH + 4}">0%</text>`;
    $("chart-axis").innerHTML = [trend[0], trend[Math.floor((trend.length - 1) / 3)], trend[Math.floor((trend.length - 1) * 2 / 3)], trend.at(-1)].map(item => `<span>${dateText(new Date(item.date))}</span>`).join("");
  } else {
    svg.innerHTML = `<text class="chart-empty" x="50%" y="50%" text-anchor="middle">暂无足够的历史检测数据</text>`;
    $("chart-axis").innerHTML = "";
  }

  const sourceNames = ["山东新硕捷电子科技有限公司 · 电源解决方案", "工业 UPS 供应商服务页", "UPS 项目交付与售后说明", "山东工业电源行业资料"]; let selected = 0;
  const list = $("question-list");
  function renderQuestions(filter = "") { const filtered = data.questions.filter(item => !filter || item.text.includes(filter) || item.platform.includes(filter)); list.innerHTML = filtered.length ? filtered.map((item, index) => `<button class="question-item ${item === data.questions[selected] ? "active" : ""}" type="button" data-question-index="${data.questions.indexOf(item)}"><strong>${item.text}</strong><span class="question-meta"><span>${item.platform}</span><span>${item.type}</span><span>热度 ${item.heat}</span></span></button>`).join("") : `<div class="method-note"><div><strong>没有匹配的问题</strong><p>换一个 UPS 关键词试试。</p></div></div>`; list.querySelectorAll("[data-question-index]").forEach(button => button.addEventListener("click", () => { selected = Number(button.dataset.questionIndex); renderQuestions($('question-search').value.trim()); renderDialogue(); })); }
  function renderDialogue() { const item = data.questions[selected] || data.questions[0]; set("dialogue-question", item.text); set("source-count", `${item.sources} 个站点 · ${item.articles} 篇文章`); $("dialogue-meta").innerHTML = [`平台 · ${item.platform}`, `类型 · ${item.type}`, `热度值 · ${item.heat}`, `提及状态 · ${item.mention}`, `平均排名 · ${item.rank}`].map((text, index) => `<span class="${index === 3 ? "accent" : ""}">${text}</span>`).join(""); set("dialogue-answer", item.answer); $("source-list").innerHTML = sourceNames.slice(0, Math.min(4, item.sources % 4 + 2)).map((name, index) => `<div class="source-row"><span class="source-num">${index + 1}</span><div><strong>${name}</strong><small>已记录 · ${item.platform}</small></div></div>`).join(""); }
  renderQuestions(); renderDialogue();
  $("question-search").addEventListener("input", event => renderQuestions(event.target.value.trim()));
  $("copy-case-link").addEventListener("click", async () => { try { await navigator.clipboard.writeText(window.location.href); set("copy-case-link", "已复制"); setTimeout(() => set("copy-case-link", "复制案例链接"), 1600); } catch { set("copy-case-link", "请手动复制地址"); } });

  const setupTechMotion = () => {
    if (!window.gsap) return;
    const mm = window.gsap.matchMedia();
    mm.add({ reduceMotion: "(prefers-reduced-motion: reduce)" }, ({ conditions }) => {
      if (conditions.reduceMotion) return;
      const intro = window.gsap.timeline({ defaults: { ease: "power3.out" } });
      intro.fromTo(".site-header", { y: -18, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .55 })
        .fromTo(".hero-copy > *", { y: 18, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .55, stagger: .07 }, "-=.2")
        .fromTo(".hero-note", { x: 18, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: .65 }, "-=.35")
        .fromTo(".metric-card", { y: 22, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .5, stagger: .08 }, "-=.25");
      window.gsap.to(".pulse-bars i", { scaleY: () => .5 + Math.random() * .45, transformOrigin: "bottom", duration: 1.15, ease: "sine.inOut", repeat: -1, yoyo: true, stagger: { each: .08, from: "random" } });
      window.gsap.to(".brand-mark", { rotation: 360, transformOrigin: "50% 50%", duration: 18, ease: "none", repeat: -1 });
      const revealTargets = document.querySelectorAll(".section-block, .method-note");
      const reveal = (entry) => {
        if (!entry.isIntersecting || entry.target.dataset.motionReady) return;
        entry.target.dataset.motionReady = "1";
        window.gsap.fromTo(entry.target, { y: 24 }, { y: 0, duration: .65, ease: "power2.out" });
      };
      const observer = new IntersectionObserver((entries) => entries.forEach(reveal), { threshold: .14 });
      revealTargets.forEach((target) => observer.observe(target));
      return () => { observer.disconnect(); window.gsap.killTweensOf(".pulse-bars i"); window.gsap.killTweensOf(".brand-mark"); };
    });
  };
  setupTechMotion();
})();
