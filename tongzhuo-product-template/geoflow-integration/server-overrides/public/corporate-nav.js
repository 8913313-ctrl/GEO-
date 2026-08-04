document.addEventListener('DOMContentLoaded', () => {
  const links = document.querySelector('.corp-links');
  const menu = document.querySelector('.corp-menu');
  if (!links || !menu) return;

  normalizeCorporateNav(links);

  menu.setAttribute('aria-expanded', 'false');
  menu.textContent = '☰';

  menu.addEventListener('click', () => {
    const open = links.classList.toggle('open');
    document.body.classList.toggle('nav-open', open);
    menu.setAttribute('aria-expanded', String(open));
    menu.textContent = open ? '×' : '☰';
  });

  links.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      links.classList.remove('open');
      document.body.classList.remove('nav-open');
      menu.setAttribute('aria-expanded', 'false');
      menu.textContent = '☰';
    });
  });
});

function normalizeCorporateNav(links) {
  const navItems = [
    ['首页', '/index.html'],
    ['关于我们', '/about.html'],
    ['产品中心', '/products.html'],
    ['服务案例', '/cases.html'],
    ['创始团队', '/team.html'],
    ['荣誉资质', '/honors.html'],
    ['行业资讯', '/insights.html'],
    ['常见问题', '/issues.html'],
    ['加入我们', '/careers.html'],
    ['联系方式', '/contact.html'],
  ];

  const currentPath = normalizePath(window.location.pathname);
  const existing = new Map();

  links.querySelectorAll('a').forEach((link) => {
    const label = link.textContent.trim();
    if (label) existing.set(label, link);
    link.remove();
  });

  navItems.forEach(([label, href]) => {
    const link = existing.get(label) || document.createElement('a');
    link.textContent = label;
    link.href = href;
    link.classList.toggle('active', normalizePath(href) === currentPath);
    links.appendChild(link);
  });
}

function normalizePath(pathname) {
  const path = (pathname || '').replace(/\/+$/, '');
  if (!path || path === '/') return '/index.html';
  return path;
}
