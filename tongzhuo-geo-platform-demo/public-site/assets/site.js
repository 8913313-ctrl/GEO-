(() => {
  "use strict";

  function setMenu(open) {
    const header = document.querySelector(".site-header");
    const button = header?.querySelector(".menu-toggle");
    if (!header || !button) return;
    header.classList.toggle("menu-open", open);
    button.setAttribute("aria-expanded", String(open));
  }

  document.addEventListener("click", (event) => {
    const toggle = event.target.closest?.(".menu-toggle");
    if (toggle) {
      const header = toggle.closest(".site-header");
      setMenu(!header?.classList.contains("menu-open"));
      return;
    }
    if (event.target.closest?.(".mobile-navigation a")) setMenu(false);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setMenu(false);
  });

  for (const group of document.querySelectorAll("[data-case-filter]")) {
    const cards = document.querySelectorAll("[data-case-industry]");
    for (const button of group.querySelectorAll("[data-case-value]")) {
      button.addEventListener("click", () => {
        const value = button.dataset.caseValue || "all";
        for (const sibling of group.querySelectorAll("[data-case-value]")) {
          sibling.classList.toggle("is-active", sibling === button);
          sibling.classList.toggle("active", sibling === button);
        }
        for (const card of cards) card.hidden = value !== "all" && card.dataset.caseIndustry !== value;
      });
    }
  }

  function leadPayload(form) {
    const data = new FormData(form);
    const source = String(data.get("source_url") || window.location.pathname).trim();
    let sourceUrl = window.location.href;
    try { sourceUrl = new URL(source || window.location.pathname, window.location.origin).href; } catch { /* use current page */ }
    return {
      name: String(data.get("name") || "").trim(),
      phone: String(data.get("phone") || "").trim(),
      company: String(data.get("company") || "").trim(),
      service: String(data.get("service") || "").trim(),
      website: String(data.get("website") || "").trim(),
      message: String(data.get("message") || "").trim(),
      source_url: sourceUrl
    };
  }

  function setFormMessage(node, message, success = false) {
    if (!node) return;
    node.textContent = message;
    node.classList.toggle("success", success);
    node.setAttribute("role", success ? "status" : "alert");
  }

  for (const form of document.querySelectorAll("[data-lead-form]")) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (document.body.classList.contains("is-preview")) {
        setFormMessage(form.querySelector("[data-form-message]"), "这是 CMS 草稿预览，咨询表单不会实际提交。", false);
        return;
      }
      if (!form.reportValidity()) return;
      const button = form.querySelector("button[type='submit']");
      const messageNode = form.querySelector("[data-form-message]");
      const originalLabel = button?.textContent || "提交业务咨询";
      if (button) {
        button.disabled = true;
        button.setAttribute("aria-busy", "true");
        button.textContent = "正在提交…";
      }
      setFormMessage(messageNode, "正在安全提交咨询信息…");
      try {
        const response = await fetch("/api/v1/leads", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(leadPayload(form))
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || result.ok !== true) throw new Error(result.message || "提交暂时失败，请稍后再试。");
        form.reset();
        setFormMessage(messageNode, result.data?.message || "提交成功，企业运营人员会尽快与您联系。", true);
      } catch (error) {
        setFormMessage(messageNode, error?.message || "网络连接异常，请稍后再试。");
      } finally {
        if (button) {
          button.disabled = false;
          button.removeAttribute("aria-busy");
          button.textContent = originalLabel;
        }
      }
    });
  }

  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const loadedScriptPath = document.currentScript?.getAttribute("src") || "";
  const visualAssetBase = loadedScriptPath.replace(/[?#].*$/, "").replace(/\/site\.js$/, "") || "/site-assets-r6";

  function installHeroVisualCarousel() {
    const visuals = [
      { src: `${visualAssetBase}/geo-signal-hero.svg`, label: "信源脉冲" },
      { src: `${visualAssetBase}/geo-answer-hero.svg`, label: "答案结构" },
      { src: `${visualAssetBase}/geo-network-hero.svg`, label: "可见性网络" }
    ];
    for (const scene of document.querySelectorAll(".ai-pulse-scene")) {
      if (scene.dataset.motionReady === "true") continue;
      scene.dataset.motionReady = "true";

      const media = document.createElement("div");
      media.className = "hero-motion-media";
      media.setAttribute("aria-hidden", "true");
      const controls = document.createElement("div");
      controls.className = "hero-motion-controls";
      controls.setAttribute("role", "tablist");
      controls.setAttribute("aria-label", "GEO 视觉展示");

      const images = [];
      const buttons = [];
      let active = 0;
      let timer = 0;
      const select = (next) => {
        active = (next + visuals.length) % visuals.length;
        images.forEach((image, index) => image.classList.toggle("is-active", index === active));
        buttons.forEach((button, index) => {
          const selected = index === active;
          button.classList.toggle("is-active", selected);
          button.setAttribute("aria-selected", String(selected));
        });
      };
      const stop = () => { if (timer) window.clearInterval(timer); timer = 0; };
      const start = () => {
        stop();
        timer = window.setInterval(() => select(active + 1), 4600);
      };
      const showMotionMedia = () => scene.classList.add("has-hero-motion-media");
      const restoreFallback = () => {
        stop();
        scene.classList.remove("has-hero-motion-media");
        media.remove();
        controls.remove();
      };

      visuals.forEach((visual, index) => {
        const image = document.createElement("img");
        image.className = `hero-motion-image${index === 0 ? " is-active" : ""}`;
        image.alt = "";
        image.decoding = "async";
        if (index === 0) {
          image.addEventListener("load", showMotionMedia, { once: true });
          image.addEventListener("error", restoreFallback, { once: true });
        }
        image.src = visual.src;
        images.push(image);
        media.append(image);

        const button = document.createElement("button");
        button.type = "button";
        button.className = `hero-motion-control${index === 0 ? " is-active" : ""}`;
        button.setAttribute("role", "tab");
        button.setAttribute("aria-selected", String(index === 0));
        button.textContent = visual.label;
        button.addEventListener("click", () => { select(index); if (!reducedMotion) start(); });
        buttons.push(button);
        controls.append(button);
      });

      scene.append(media, controls);
      if (!reducedMotion) {
        scene.addEventListener("mouseenter", stop);
        scene.addEventListener("mouseleave", start);
        start();
      }
    }
  }

  function installInnerHeroVisuals() {
    const visuals = [
      `${visualAssetBase}/geo-answer-hero.svg`,
      `${visualAssetBase}/geo-network-hero.svg`,
      `${visualAssetBase}/geo-signal-hero.svg`
    ];
    const heroes = document.querySelectorAll(".page-hero, .blog-hero, .article-hero, .problem-detail-hero");
    heroes.forEach((hero, index) => {
      if (hero.dataset.motionVisualReady === "true") return;
      hero.dataset.motionVisualReady = "true";

      const media = document.createElement("div");
      media.className = "page-hero-motion-media";
      media.setAttribute("aria-hidden", "true");
      const image = document.createElement("img");
      image.alt = "";
      image.decoding = "async";
      image.addEventListener("load", () => hero.classList.add("has-page-motion-media"), { once: true });
      image.addEventListener("error", () => media.remove(), { once: true });
      image.src = visuals[index % visuals.length];
      media.append(image);
      hero.append(media);
    });
  }

  function installScrollReveal() {
    if (reducedMotion) return;
    const targets = document.querySelectorAll([
      ".home-section-heading", ".section-head", ".section-head-v2", ".home-process-intro",
      ".outcome-grid article", ".service-card", ".case-card", ".problem-card",
      ".compact-article-card", ".principle-grid article", ".service-card-detailed",
      ".insight-feature", ".blog-entry", ".contact-layout"
    ].join(","));
    if (!targets.length) return;
    document.documentElement.classList.add("motion-ready");
    let observer = null;
    const reveal = (target) => {
      if (target.classList.contains("is-revealed")) return;
      target.classList.add("is-revealed");
      observer?.unobserve(target);
    };
    const revealVisible = () => {
      for (const target of targets) {
        if (target.classList.contains("is-revealed")) continue;
        const bounds = target.getBoundingClientRect();
        if (bounds.top < window.innerHeight - 28 && bounds.bottom > 0) reveal(target);
      }
    };
    if ("IntersectionObserver" in window) {
      observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) reveal(entry.target);
        }
      }, { threshold: .12, rootMargin: "0px 0px -28px" });
    }
    targets.forEach((target, index) => {
      target.classList.add("reveal-item");
      target.style.setProperty("--reveal-delay", `${Math.min(index % 6, 5) * 70}ms`);
      observer?.observe(target);
    });
    window.addEventListener("scroll", revealVisible, { passive: true });
    window.addEventListener("resize", revealVisible);
    window.requestAnimationFrame(revealVisible);
  }

  installHeroVisualCarousel();
  installInnerHeroVisuals();
  installScrollReveal();
})();
