(function bootstrapPrivateDeploymentAuth() {
  "use strict";

  const auth = { user: null, csrfToken: "", initialized: false, authenticated: false };
  window.__TZ_AUTH__ = auth;

  function safeText(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  }

  async function parseResponse(response) {
    const text = await response.text();
    let body = {};
    try { body = text ? JSON.parse(text) : {}; } catch { body = { message: text }; }
    if (!response.ok || body.ok === false) {
      const error = new Error(body.message || `请求失败（${response.status}）`);
      error.status = response.status;
      error.code = body.code || `HTTP_${response.status}`;
      error.body = body;
      throw error;
    }
    return body;
  }

  window.tzFetch = async function tzFetch(url, options = {}) {
    const method = String(options.method || "GET").toUpperCase();
    const headers = { Accept: "application/json", ...(options.headers || {}) };
    if (!["GET", "HEAD", "OPTIONS"].includes(method) && auth.csrfToken) headers["X-CSRF-Token"] = auth.csrfToken;
    const response = await fetch(url, { credentials: "same-origin", ...options, method, headers });
    if (response.status === 401 && !String(url).includes("/auth/")) {
      auth.user = null;
      auth.authenticated = false;
      window.setTimeout(() => window.location.reload(), 50);
    }
    return response;
  };

  async function authRequest(path, options = {}) {
    const response = await window.tzFetch(path, {
      ...options,
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      body: options.body && typeof options.body !== "string" ? JSON.stringify(options.body) : options.body
    });
    return parseResponse(response);
  }

  function ensureOverlay() {
    let root = document.getElementById("production-auth-root");
    if (root) return root;
    root = document.createElement("div");
    root.id = "production-auth-root";
    root.className = "production-auth-root";
    document.body.appendChild(root);
    document.body.classList.add("auth-locked");
    return root;
  }

  function message(root, text, tone = "error") {
    const node = root.querySelector("[data-auth-message]");
    if (!node) return;
    node.textContent = text || "";
    node.className = `production-auth-message ${tone}`;
  }

  function passwordEyeIcon(visible = false) {
    return visible
      ? '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m3 3 18 18"/><path d="M10.6 10.7a2 2 0 0 0 2.7 2.7"/><path d="M9.9 5.2A11.2 11.2 0 0 1 12 5c6.5 0 10 7 10 7a18.3 18.3 0 0 1-3.1 3.9M6.2 6.2C3.6 8.2 2 12 2 12s3.5 7 10 7a10.8 10.8 0 0 0 4.1-.8"/></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z"/><circle cx="12" cy="12" r="2.5"/></svg>';
  }

  function passwordField({ label, name, autocomplete, required = true }) {
    return `<label>${label}<span class="production-password-control"><input name="${name}" type="password" minlength="12" maxlength="200" autocomplete="${autocomplete}"${required ? " required" : ""} /><button type="button" class="production-password-toggle" data-auth-password-toggle="${name}" aria-label="显示${label}" aria-pressed="false">${passwordEyeIcon()}</button></span></label>`;
  }

  function renderForm(status) {
    const root = ensureOverlay();
    const setup = !status.initialized;
    root.innerHTML = `
      <main class="production-auth-card" aria-labelledby="production-auth-title">
        <div class="production-auth-brand"><span>桐</span><div><b>桐灼 GEO</b><small>企业私有化运营系统</small></div></div>
        <div class="production-auth-copy">
          <span class="production-auth-kicker">${setup ? "FIRST RUN SETUP" : "PRIVATE DEPLOYMENT"}</span>
          <h1 id="production-auth-title">${setup ? "创建企业管理员" : "登录运营后台"}</h1>
          <p>${setup ? "这是当前服务器的首次初始化。管理员账号仅保存在本企业服务器中。请由部署负责人创建并保存账号。" : "请输入企业内部账号。连续失败会被记录到安全审计日志。首次登录凭据由部署负责人交接；忘记密码请联系部署管理员重置。"}</p>
        </div>
        <form data-auth-form autocomplete="${setup ? "off" : "on"}">
          ${setup ? '<label>管理员姓名<input name="name" maxlength="80" autocomplete="name" value="系统管理员" required /></label>' : ""}
          <label>登录账号<input name="username" maxlength="64" autocomplete="username" value="${setup ? "admin" : ""}" required /></label>
          ${passwordField({ label: "登录密码", name: "password", autocomplete: setup ? "new-password" : "current-password" })}
          ${setup ? passwordField({ label: "确认密码", name: "passwordConfirm", autocomplete: "new-password" }) : ""}
          <div class="production-auth-message" data-auth-message aria-live="assertive"></div>
          <button type="submit">${setup ? "完成初始化并进入系统" : "登录"}</button>
        </form>
        <p class="production-auth-help">${setup ? "完成后请立即修改初始密码，并创建运营、审核和只读账号。" : "没有账号或无法登录？请联系本企业部署管理员，不要反复尝试未知密码。"}</p>
        <footer><span>单企业独立部署</span><span>数据保存在当前服务器</span></footer>
      </main>`;

    const form = root.querySelector("[data-auth-form]");
    form.querySelectorAll("[data-auth-password-toggle]").forEach((toggle) => {
      toggle.addEventListener("click", () => {
        const input = form.elements.namedItem(toggle.dataset.authPasswordToggle);
        if (!input) return;
        const visible = input.type === "password";
        input.type = visible ? "text" : "password";
        toggle.setAttribute("aria-pressed", String(visible));
        toggle.setAttribute("aria-label", `${visible ? "隐藏" : "显示"}${toggle.dataset.authPasswordToggle === "passwordConfirm" ? "确认密码" : "登录密码"}`);
        toggle.innerHTML = passwordEyeIcon(visible);
        input.focus({ preventScroll: true });
      });
    });
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = form.querySelector("button[type='submit']");
      const data = new FormData(form);
      const password = String(data.get("password") || "");
      if (setup && password !== String(data.get("passwordConfirm") || "")) return message(root, "两次输入的密码不一致。");
      button.disabled = true;
      button.textContent = setup ? "正在初始化…" : "正在登录…";
      message(root, "", "info");
      try {
        const payload = setup
          ? { displayName: data.get("name"), username: data.get("username"), password }
          : { username: data.get("username"), password };
        const response = await authRequest(setup ? "/api/v1/auth/setup" : "/api/v1/auth/login", { method: "POST", body: payload });
        const result = response.data || response;
        auth.user = result.user;
        auth.csrfToken = result.csrfToken || "";
        auth.initialized = true;
        auth.authenticated = true;
        root.remove();
        document.body.classList.remove("auth-locked");
        window.dispatchEvent(new CustomEvent("tz-authenticated", { detail: { user: auth.user } }));
      } catch (error) {
        message(root, error.message || "登录失败，请稍后重试。");
        button.disabled = false;
        button.textContent = setup ? "完成初始化并进入系统" : "登录";
      }
    });
    window.setTimeout(() => root.querySelector(setup ? 'input[name="name"]' : 'input[name="username"]')?.focus(), 20);
  }

  async function waitUntilAuthenticated() {
    let status;
    try {
      const response = await authRequest("/api/v1/auth/status");
      status = response.data || response;
    } catch (error) {
      const root = ensureOverlay();
      root.innerHTML = `<main class="production-auth-card production-auth-failure"><div class="production-auth-brand"><span>桐</span><div><b>生产服务未就绪</b><small>无法建立安全登录会话</small></div></div><p>${safeText(error.message)}</p><button type="button" data-auth-reload>重新连接</button></main>`;
      root.querySelector("[data-auth-reload]")?.addEventListener("click", () => window.location.reload());
      throw error;
    }
    auth.initialized = Boolean(status.initialized);
    auth.authenticated = Boolean(status.authenticated);
    auth.user = status.user || null;
    auth.csrfToken = status.csrfToken || "";
    if (auth.authenticated) return auth;
    renderForm(status);
    await new Promise((resolve) => window.addEventListener("tz-authenticated", resolve, { once: true }));
    return auth;
  }

  window.tzLogout = async function tzLogout() {
    try { await authRequest("/api/v1/auth/logout", { method: "POST", body: {} }); } finally { window.location.reload(); }
  };

  window.__TZ_AUTH_READY__ = waitUntilAuthenticated();
})();
