document.addEventListener('DOMContentLoaded', () => {
  const footerBottom = document.querySelector('.footer-bottom');
  if (footerBottom && !footerBottom.querySelector('.footer-icp')) {
    const icp = document.createElement('a');
    icp.className = 'footer-icp';
    icp.href = 'https://beian.miit.gov.cn/';
    icp.target = '_blank';
    icp.rel = 'noreferrer';
    icp.textContent = '鲁ICP备2026021587号-2';
    footerBottom.appendChild(icp);
  }

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
    if (!nav.id) nav.id = 'site-navigation';
    toggle.setAttribute('aria-controls', nav.id);

    const setMenuState = (open, { restoreFocus = false } = {}) => {
      nav.classList.toggle('open', open);
      document.body.classList.toggle('menu-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? '关闭导航' : '打开导航');
      toggle.textContent = open ? '×' : '☰';
      if (restoreFocus) toggle.focus();
    };

    toggle.addEventListener('click', () => {
      setMenuState(!nav.classList.contains('open'));
    });
    nav.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
      setMenuState(false);
    }));
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && nav.classList.contains('open')) {
        setMenuState(false, { restoreFocus: true });
      }
    });
    window.matchMedia('(min-width: 901px)').addEventListener('change', (event) => {
      if (event.matches) setMenuState(false);
    });
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
      if (submitButton) submitButton.disabled = true;

      try {
        const response = await fetch(form.dataset.endpoint || '/api/v1/leads', {
          method: 'POST',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
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
        status.textContent = result.data?.message || result.message || '提交成功，桐灼团队会尽快与您联系。';
        form.reset();
        return;
      } catch (_error) {
        status.textContent = '提交暂时失败，请稍后再试。当前信息未保存。';
      } finally {
        if (submitButton) submitButton.disabled = false;
      }
    });
  }

  const publicFeed = document.querySelector('[data-geoflow-feed="published"]');
  const publicArticleSeed = document.querySelector('[data-geoflow-article]');
  const publicProblemMap = document.querySelector('[data-geoflow-problem-map]');

  if (publicFeed || publicArticleSeed || publicProblemMap) {
    const escapeHtml = (value = '') => String(value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const articleDate = (value) => {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return { datetime: '', day: '--', month: '持续更新', label: '持续更新' };
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return { datetime: `${year}-${month}-${day}`, day, month: `${year}.${month}`, label: `${year}.${month}.${day}` };
    };
    const articleMarkup = (article) => {
      const date = articleDate(article.publishedAt);
      const tags = Array.isArray(article.tags) ? article.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join('') : '';
      const title = escapeHtml(article.title || '未命名文章');
      const url = escapeHtml(article.url || '#');
      return `<article class="blog-entry" data-geoflow-article><time datetime="${escapeHtml(date.datetime)}" class="blog-date"><strong>${escapeHtml(date.day)}</strong><span>${escapeHtml(date.month)}</span></time><div class="blog-entry-body"><div class="blog-meta"><span>${escapeHtml(article.categoryName || '行业观点')}</span><span>${escapeHtml(article.author || '桐灼研究')}</span><span>已发布</span></div><h3><a href="${url}">${title}</a></h3><p>${escapeHtml(article.excerpt || '查看桐灼已发布的行业内容。')}</p>${tags ? `<div class="blog-tags">${tags}</div>` : ''}</div><a class="blog-entry-link" href="${url}" aria-label="阅读${title}">→</a></article>`;
    };
    const problemMarkup = (group) => {
      const cards = (Array.isArray(group.questions) ? group.questions : []).map((problem) => {
        const context = Array.isArray(problem.industries) && problem.industries.length ? problem.industries.slice(0, 2).join(' · ') : (group.service || '客户问题');
        return `<a class="tz-problem-card" href="${escapeHtml(problem.url || '#')}"><span>${escapeHtml(context)}</span><h3>${escapeHtml(problem.title || '客户问题')}</h3><p>${escapeHtml(problem.answer || '查看直接回答与相关内容。')}</p><b>查看直接回答 <i aria-hidden="true">→</i></b></a>`;
      }).join('');
      return `<section class="tz-problem-group"><header><span>${escapeHtml(group.service || '客户问题')}</span><h2>${escapeHtml(group.title || '问题分组')}</h2>${group.description ? `<p>${escapeHtml(group.description)}</p>` : ''}</header><div class="tz-problem-grid">${cards}</div></section>`;
    };

    fetch('/api/v1/site-public/content', { headers: { Accept: 'application/json' }, cache: 'no-store' })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('PUBLIC_CONTENT_UNAVAILABLE')))
      .then((payload) => {
        const articles = Array.isArray(payload?.articles) ? payload.articles : [];
        const problemGroups = Array.isArray(payload?.problemGroups) ? payload.problemGroups : [];
        const insightsSidebar = publicFeed?.closest('main')?.querySelector('.blog-sidebar');
        if (insightsSidebar && !insightsSidebar.querySelector('[data-tz-problem-map-link]')) {
          insightsSidebar.insertAdjacentHTML('afterbegin', '<section class="blog-panel" data-tz-problem-map-link><span class="blog-panel-label">客户问题</span><a href="problem-map.html"><strong>问题地图</strong><small>按服务方向查看已公开问题与直接回答</small></a></section>');
        }
        const feature = publicFeed?.querySelector('.insight-feature');
        if (feature) {
          const article = articles[0];
          feature.innerHTML = article
            ? `<div class="insight-visual" aria-hidden="true"><span class="visual-word w1">SOURCE</span><span class="visual-word w2">GEO</span><span class="visual-caption">ENTITY / ANSWER / EVIDENCE / FRESHNESS</span></div><div class="insight-copy"><time datetime="${escapeHtml(articleDate(article.publishedAt).datetime)}">${escapeHtml(article.categoryName || '行业观点')} · ${escapeHtml(articleDate(article.publishedAt).label)} · ${escapeHtml(article.author || '桐灼研究')}</time><h3>${escapeHtml(article.title || '未命名文章')}</h3><p>${escapeHtml(article.excerpt || '查看桐灼已发布的行业内容。')}</p><a class="text-link" href="${escapeHtml(article.url || '#')}">阅读全文 <span>→</span></a></div>`
            : '<div class="insight-copy"><time>行业资讯</time><h3>暂未发布文章</h3><p>后台发布并通过审核的文章会自动展示在这里。</p></div>';
        }
        const articleList = publicArticleSeed?.parentElement;
        if (articleList) {
          articleList.querySelectorAll('[data-geoflow-article]').forEach((item) => item.remove());
          articleList.insertAdjacentHTML('beforeend', articles.length ? articles.map(articleMarkup).join('') : '<p class="tz-public-empty">暂未发布文章。后台完成审核并发布后，内容会自动展示在这里。</p>');
        }
        if (publicProblemMap) {
          publicProblemMap.innerHTML = problemGroups.length
            ? problemGroups.map(problemMarkup).join('')
            : '<p class="tz-public-empty">暂未公开问题。后台将问题分组和问题设为“公开”后，会自动展示在这里。</p>';
        }
      })
      .catch(() => {});
  }
});
