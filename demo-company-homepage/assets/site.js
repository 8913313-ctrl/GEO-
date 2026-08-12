document.addEventListener('DOMContentLoaded', () => {
  const alignHashTarget = () => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    const target = id ? document.getElementById(id) : null;
    if (!target) return;
    requestAnimationFrame(() => {
      const header = document.querySelector('.site-header');
      const offset = (header ? header.getBoundingClientRect().height : 0) + 20;
      window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - offset });
    });
  };

  alignHashTarget();
  window.addEventListener('hashchange', alignHashTarget);

  const toggle = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.nav-links');

  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      document.body.classList.toggle('menu-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.textContent = open ? '×' : '☰';
    });
    nav.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
      nav.classList.remove('open');
      document.body.classList.remove('menu-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.textContent = '☰';
    }));
  }

  document.querySelectorAll('.faq-question').forEach((button) => {
    button.addEventListener('click', () => {
      const item = button.closest('.faq-item');
      const open = item.classList.toggle('open');
      button.setAttribute('aria-expanded', String(open));
      const symbol = button.querySelector('[data-faq-symbol]');
      if (symbol) symbol.textContent = open ? '−' : '+';
    });
  });

  const observer = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      }), { threshold: 0.08 })
    : null;
  document.querySelectorAll('.reveal').forEach((el) => observer ? observer.observe(el) : el.classList.add('visible'));

  const scene = document.querySelector('.signal-scene');
  if (scene && window.matchMedia('(pointer: fine)').matches) {
    scene.addEventListener('pointermove', (event) => {
      const bounds = scene.getBoundingClientRect();
      const x = (event.clientX - bounds.left) / bounds.width - 0.5;
      const y = (event.clientY - bounds.top) / bounds.height - 0.5;
      scene.style.setProperty('--scene-ry', `${x * 2.2}deg`);
      scene.style.setProperty('--scene-rx', `${y * -1.8}deg`);
    });
    scene.addEventListener('pointerleave', () => {
      scene.style.setProperty('--scene-ry', '0deg');
      scene.style.setProperty('--scene-rx', '0deg');
    });
  }

  const form = document.querySelector('[data-contact-form]');
  if (form) {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const status = form.querySelector('.form-status');
      const data = new FormData(form);
      const submitButton = form.querySelector('button[type="submit"]');
      const payload = Object.fromEntries(data.entries());
      payload.source_url = window.location.href;
      payload.utm = Object.fromEntries(['source', 'medium', 'campaign', 'term', 'content'].map((key) => [key, new URLSearchParams(window.location.search).get(`utm_${key}`) || '']).filter(([, value]) => value));
      if (!form.dataset.idempotencyKey) form.dataset.idempotencyKey = globalThis.crypto?.randomUUID?.() || `lead-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      if (submitButton) submitButton.disabled = true;

      try {
        const response = await fetch(form.dataset.endpoint || '/api/v1/leads', {
          method: 'POST',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'Idempotency-Key': form.dataset.idempotencyKey },
          body: JSON.stringify(payload),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || result.ok === false) {
          if (response.status >= 400 && response.status < 500) {
            status.textContent = result.message || '请检查必填信息后再提交。';
            return;
          }
          throw new Error(result.message || '提交失败');
        }
        status.textContent = result.data?.message || result.message || '提交成功，我们将在 1 个工作日内回复。';
        form.reset();
        delete form.dataset.idempotencyKey;
        return;
      } catch (_error) {
        status.textContent = '提交暂时失败，请稍后再试。当前信息未保存。';
      } finally {
        if (submitButton) submitButton.disabled = false;
      }
    });
  }
});
