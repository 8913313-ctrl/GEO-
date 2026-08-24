/*
 * 桐灼 GEO · AI 效果检测过程反馈
 *
 * 这里只处理已经由页面渲染出来的真实状态：
 * - 检测阶段从“配置 → 排队 → 分析 → 校验 → 完成”的变化；
 * - 真实任务的“已校验 / 请求项”进度；
 * - 明确的 KPI 数字变化。
 *
 * 不做整页入场、卡片错峰、无限循环或文本猜数字。动画只在状态/数值
 * 真正变化时播放，并且每次都读取 prefers-reduced-motion。
 */
(function () {
  "use strict";

  var VIEW_SELECTOR = ".effect-search-page, .effect-diagnostic-page, .effect-monitor-page";
  var KPI_SELECTOR = ".effect-search-summary b, .effect-task-summary b, .effect-monitor-trend-list article span > b, .effect-trend-list article span > b, .effect-aligned-kpi-number";
  var previousStages = new Map();
  var previousProgress = new Map();
  var previousMetrics = new Map();
  var previousCharts = new Map();
  var scheduleTimer = null;

  function reducedMotion() {
    return Boolean(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  function effectView() {
    var view = document.getElementById("view");
    return view && view.querySelector(VIEW_SELECTOR) ? view : null;
  }

  function routeName() {
    return String(document.body && document.body.dataset && document.body.dataset.route || "effect");
  }

  function finiteNumber(value) {
    return typeof value === "number" && isFinite(value) ? value : null;
  }

  function readStrictNumber(text) {
    var value = String(text || "").trim();
    if (!/^-?\d[\d,]*(?:\.\d+)?%?$/.test(value)) return null;
    var percent = value.endsWith("%");
    var normalized = value.replace(/%$/, "").replace(/,/g, "");
    var number = Number(normalized);
    return finiteNumber(number) === null ? null : { value: number, percent: percent, grouped: /,/.test(value), decimals: (normalized.split(".")[1] || "").length };
  }

  function formatNumber(number, format) {
    var fixed = format.decimals ? Number(number).toFixed(format.decimals) : String(Math.round(number));
    var parts = fixed.split(".");
    if (format.grouped) parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.join(".") + (format.percent ? "%" : "");
  }

  function animateObject(target, from, to, duration, update, done) {
    if (reducedMotion() || from === to) {
      update(to);
      if (done) done();
      return;
    }
    if (window.gsap) {
      window.gsap.killTweensOf(target);
      window.gsap.fromTo(target, { value: from }, {
        value: to,
        duration: duration,
        ease: "power2.out",
        overwrite: "auto",
        onUpdate: function () { update(target.value); },
        onComplete: function () { update(to); if (done) done(); }
      });
      return;
    }
    var started = 0;
    function frame(now) {
      if (!started) started = now;
      var progress = Math.min(1, (now - started) / (duration * 1000));
      var eased = 1 - Math.pow(1 - progress, 3);
      update(from + (to - from) * eased);
      if (progress < 1) window.requestAnimationFrame(frame);
      else if (done) done();
    }
    window.requestAnimationFrame(frame);
  }

  function metricKey(element, index) {
    var summary = element.closest(".effect-search-summary, .effect-task-summary, .effect-monitor-trend-list article, .effect-trend-list article");
    var label = summary && summary.querySelector("small") ? summary.querySelector("small").textContent.trim() : "metric";
    return routeName() + "|" + label + "|" + index;
  }

  function animateMetrics(root) {
    var elements = root.querySelectorAll(KPI_SELECTOR);
    elements.forEach(function (element, index) {
      var currentText = element.textContent.trim();
      var current = readStrictNumber(currentText);
      var key = metricKey(element, index);
      var previous = previousMetrics.get(key);
      if (!current) {
        previousMetrics.set(key, null);
        return;
      }
      if (!previous || previous.text === currentText || previous.value === current.value) {
        previousMetrics.set(key, { text: currentText, value: current.value });
        return;
      }
      var from = readStrictNumber(previous.text);
      previousMetrics.set(key, { text: currentText, value: current.value });
      if (!from) return;
      element.textContent = formatNumber(from.value, current);
      animateObject({ value: from.value }, from.value, current.value, 0.28, function (value) {
        element.textContent = formatNumber(value, current);
      }, function () {
        element.textContent = currentText;
      });
    });
  }

  function stageKey(stage) {
    return routeName() + "|" + String(stage.dataset.effectStageKey || "draft");
  }

  function animateStages(root) {
    root.querySelectorAll("[data-effect-stage-flow]").forEach(function (stage) {
      var key = stageKey(stage);
      var current = Number(stage.dataset.effectStageCurrent || 0);
      var previous = previousStages.get(key);
      previousStages.set(key, current);
      if (previous === undefined || previous === current || reducedMotion()) return;
      var active = stage.querySelector(".is-current > span");
      if (!active) return;
      active.classList.add("is-state-transition");
      if (window.gsap) {
        window.gsap.fromTo(active, { scale: 0.86, autoAlpha: 0.55 }, { scale: 1, autoAlpha: 1, duration: 0.26, ease: "power2.out", overwrite: "auto", clearProps: "transform,opacity,visibility" });
      } else {
        window.setTimeout(function () { active.classList.remove("is-state-transition"); }, 280);
      }
      window.setTimeout(function () { active.classList.remove("is-state-transition"); }, 320);
    });
  }

  function progressKey(progress) {
    return routeName() + "|" + String(progress.dataset.effectProgressKey || "draft");
  }

  function animateProgress(root) {
    root.querySelectorAll("[data-effect-progress]").forEach(function (progress) {
      var fill = progress.querySelector("[data-effect-progress-fill]");
      if (!fill) return;
      var key = progressKey(progress);
      var value = Math.min(1, Math.max(0, Number(progress.dataset.effectProgressValue || 0)));
      var previous = previousProgress.get(key);
      previousProgress.set(key, value);
      if (previous === undefined || previous === value || reducedMotion()) return;
      if (window.gsap) {
        window.gsap.killTweensOf(fill);
        window.gsap.fromTo(fill, { scaleX: previous }, { scaleX: value, duration: 0.3, ease: "power2.out", overwrite: "auto" });
      } else {
        fill.style.transform = "scaleX(" + previous + ")";
        window.requestAnimationFrame(function () { fill.style.transform = "scaleX(" + value + ")"; });
      }
    });
  }

  function animateRealTrendCharts(root) {
    root.querySelectorAll(".effect-monitor-real-chart .trend-line").forEach(function (path, index) {
      if (!path || typeof path.getTotalLength !== "function") return;
      var value = String(path.getAttribute("d") || "");
      if (!value) return;
      var key = routeName() + "|trend|" + index;
      var previous = previousCharts.get(key);
      previousCharts.set(key, value);
      if (previous === value || reducedMotion()) return;
      var length;
      try { length = path.getTotalLength(); } catch (error) { return; }
      if (!isFinite(length) || length <= 0) return;
      path.style.strokeDasharray = String(length);
      path.style.strokeDashoffset = String(length);
      if (window.gsap) {
        window.gsap.killTweensOf(path);
        window.gsap.to(path, { strokeDashoffset: 0, duration: 0.32, ease: "power2.out", overwrite: "auto", clearProps: "strokeDasharray,strokeDashoffset" });
      } else {
        window.requestAnimationFrame(function () {
          path.style.transition = "stroke-dashoffset .32s ease";
          path.style.strokeDashoffset = "0";
        });
      }
    });
  }

  function animateEffectFeedback() {
    var view = effectView();
    if (!view) return;
    animateStages(view);
    animateProgress(view);
    animateMetrics(view);
    animateRealTrendCharts(view);
  }

  function schedule() {
    if (scheduleTimer) window.clearTimeout(scheduleTimer);
    scheduleTimer = window.setTimeout(function () {
      scheduleTimer = null;
      animateEffectFeedback();
    }, 24);
  }

  function init() {
    var view = document.getElementById("view");
    if (!view) return;
    if ("MutationObserver" in window) {
      var observer = new MutationObserver(function () { schedule(); });
      observer.observe(view, { childList: true, subtree: false });
    }
    if (window.matchMedia) {
      var motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
      var onMotionChange = function () { schedule(); };
      if (motionQuery.addEventListener) motionQuery.addEventListener("change", onMotionChange);
      else if (motionQuery.addListener) motionQuery.addListener(onMotionChange);
    }
    schedule();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
