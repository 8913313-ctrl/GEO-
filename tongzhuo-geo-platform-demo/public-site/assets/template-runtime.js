(() => {
  "use strict";

  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

  function setMenu(header, open) {
    if (!header) return;
    const button = header.querySelector(".mobile-menu-btn");
    const menu = header.querySelector(".nav-menu");
    header.classList.toggle("menu-open", open);
    menu?.classList.toggle("active", open);
    button?.setAttribute("aria-expanded", String(open));
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest?.(".mobile-menu-btn");
    if (button) {
      const header = button.closest(".header");
      setMenu(header, !header?.classList.contains("menu-open"));
      return;
    }
    const link = event.target.closest?.(".nav-menu a");
    if (link) setMenu(link.closest(".header"), false);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") document.querySelectorAll(".header.menu-open").forEach((header) => setMenu(header, false));
  });

  window.addEventListener("scroll", () => {
    document.querySelectorAll(".header").forEach((header) => header.classList.toggle("scrolled", window.scrollY > 40));
  }, { passive: true });

  document.querySelectorAll("[data-case-filter]").forEach((group) => {
    const cards = document.querySelectorAll("[data-case-industry], [data-category]");
    group.querySelectorAll("[data-case-value], [data-filter]").forEach((button) => {
      button.addEventListener("click", () => {
        const value = button.dataset.caseValue || button.dataset.filter || "all";
        group.querySelectorAll("[data-case-value], [data-filter]").forEach((item) => {
          item.classList.toggle("active", item === button);
          item.classList.toggle("is-active", item === button);
        });
        cards.forEach((card) => {
          const category = card.dataset.caseIndustry || card.dataset.category || "";
          card.hidden = value !== "all" && category !== value;
        });
      });
    });
  });

  function leadPayload(form) {
    const data = new FormData(form);
    let sourceUrl = window.location.href;
    try { sourceUrl = new URL(data.get("source_url") || window.location.pathname, window.location.origin).href; } catch { /* keep current URL */ }
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

  function setMessage(node, text, success = false) {
    if (!node) return;
    node.textContent = text;
    node.classList.toggle("success", success);
    node.setAttribute("role", success ? "status" : "alert");
  }

  document.querySelectorAll("[data-lead-form]").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const message = form.querySelector("[data-form-message]");
      if (document.body.classList.contains("is-preview")) {
        setMessage(message, "这是 CMS 草稿预览，咨询表单不会实际提交。");
        return;
      }
      if (!form.reportValidity()) return;
      const submit = form.querySelector("button[type='submit']");
      const originalLabel = submit?.textContent || "提交";
      if (submit) {
        submit.disabled = true;
        submit.setAttribute("aria-busy", "true");
        submit.textContent = "正在提交...";
      }
      setMessage(message, "正在提交咨询信息...");
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
        setMessage(message, result.data?.message || "提交成功，企业运营人员会尽快与您联系。", true);
      } catch (error) {
        setMessage(message, error?.message || "网络连接异常，请稍后再试。");
      } finally {
        if (submit) {
          submit.disabled = false;
          submit.removeAttribute("aria-busy");
          submit.textContent = originalLabel;
        }
      }
    });
  });

  const statNodes = document.querySelectorAll("[data-target]");
  const animateStat = (node) => {
    const target = Number(node.dataset.target);
    if (!Number.isFinite(target) || reducedMotion) {
      node.textContent = node.dataset.target;
      return;
    }
    const startedAt = performance.now();
    const duration = 900;
    const tick = (now) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const value = target * (1 - Math.pow(1 - progress, 3));
      node.textContent = Number.isInteger(target) ? String(Math.round(value)) : value.toFixed(1);
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      animateStat(entry.target);
      observer.unobserve(entry.target);
    }), { threshold: 0.35 });
    statNodes.forEach((node) => observer.observe(node));
  } else statNodes.forEach(animateStat);

  const backToTop = document.createElement("button");
  backToTop.type = "button";
  backToTop.className = "template-back-to-top";
  backToTop.setAttribute("aria-label", "返回顶部");
  backToTop.innerHTML = "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M12 19V5m-6 6 6-6 6 6\"/></svg>";
  backToTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" }));
  document.body.append(backToTop);
  window.addEventListener("scroll", () => backToTop.classList.toggle("is-visible", window.scrollY > 420), { passive: true });
})();
