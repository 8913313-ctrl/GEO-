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
    const cards = document.querySelectorAll(".case-card[data-case-industry]");
    for (const button of group.querySelectorAll("[data-case-value]")) {
      button.addEventListener("click", () => {
        const value = button.dataset.caseValue || "all";
        for (const sibling of group.querySelectorAll("[data-case-value]")) sibling.classList.toggle("is-active", sibling === button);
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
})();
