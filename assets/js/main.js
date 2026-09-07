/* ============================================================
 * Render engine: reads SITE_CONFIG and renders nav / hero /
 * content modules / footer.
 * Module registry: each feature module registers itself via
 * registerModule(type, fn).
 * ============================================================ */
window.SiteModules = {};
window.registerModule = function (type, fn) {
  window.SiteModules[type] = fn;
};

document.addEventListener('DOMContentLoaded', function () {
  const C = window.SITE_CONFIG;
  if (!C) return;
  document.title = C.site.title;
  renderNav(C);
  renderHero(C);
  renderModules(C);
  renderFooter(C);
  initTyping(C);
  initHeaderScroll();
  initReveal();
});

/* ---------- Navigation ---------- */
function renderNav(C) {
  const nav = document.getElementById('site-nav');
  nav.innerHTML =
    '<a class="nav-logo" href="#home">🧬 ' + esc(C.site.author) + '</a>' +
    '<button class="nav-toggle" id="nav-toggle" aria-label="Menu">☰</button>' +
    '<ul class="nav-links" id="nav-links">' +
    C.site.nav.map(function (n) {
      return '<li><a href="#' + esc(n.anchor) + '">' + esc(n.label) + '</a></li>';
    }).join('') +
    '</ul>';
  document.getElementById('nav-toggle').addEventListener('click', function () {
    document.getElementById('nav-links').classList.toggle('open');
  });
  document.getElementById('nav-links').addEventListener('click', function (e) {
    if (e.target.tagName === 'A') this.classList.remove('open');
  });
}

/* ---------- Hero (overview) ---------- */
function renderHero(C) {
  const h = C.hero;
  const socials = (h.socials || []).map(function (s) {
    return '<a class="hero-social" href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.icon) + '</a>';
  }).join('');
  const contact = (h.contact && h.contact.email)
    ? '<p class="hero-contact">📧 Contact Me: <a href="mailto:' + esc(h.contact.email) + '">' + esc(h.contact.email) + '</a></p>'
    : '';
  const html =
    '<section id="home" class="hero">' +
    '  <div class="hero-inner">' +
    '    <img class="hero-avatar" src="' + esc(h.avatar) + '" alt="avatar">' +
    '    <h1 class="hero-name">' + esc(h.name) + '</h1>' +
    '    <p class="hero-tagline">' + esc(h.tagline) + '</p>' +
    contact +
    '    <p class="hero-typing"><span id="typing-text"></span><span class="type-caret"></span></p>' +
    '    <div class="hero-socials">' + socials + '</div>' +
    '  </div>' +
    '  <div class="scroll-hint">' + esc(h.scrollHint || '') + '</div>' +
    '</section>';
  document.getElementById('app').insertAdjacentHTML('beforeend', html);
}

/* ---------- Content modules ---------- */
function renderModules(C) {
  const app = document.getElementById('app');
  (C.modules || []).forEach(function (mod) {
    if (mod.enabled === false) return;
    const renderer = window.SiteModules[mod.type];
    if (!renderer) {
      console.warn('[site] Unregistered module type:', mod.type);
      return;
    }
    const section = document.createElement('section');
    section.className = 'module reveal';
    section.id = mod.id;
    section.innerHTML =
      '<div class="container">' +
      '  <h2 class="module-title"><span class="module-icon">' + (mod.icon || '') + '</span>' + esc(mod.title) + '</h2>' +
      '  <div class="module-body"></div>' +
      '</div>';
    app.appendChild(section);
    renderer(section.querySelector('.module-body'), mod, C);
  });
}

/* ---------- Footer ---------- */
function renderFooter(C) {
  document.getElementById('site-footer').innerHTML =
    '<div class="container footer-inner">' +
    '<p>' + esc(C.site.motto) + '</p>' +
    '<p class="footer-copy">' + esc(C.site.footer) + '</p>' +
    '</div>';
}

/* ---------- Typewriter effect ---------- */
function initTyping(C) {
  const lines = (C.hero && C.hero.typing) || [];
  const el = document.getElementById('typing-text');
  if (!el || !lines.length) return;
  let li = 0, ci = 0, deleting = false;
  (function tick() {
    const line = lines[li];
    ci += deleting ? -1 : 1;
    el.textContent = line.slice(0, ci);
    let delay = deleting ? 45 : 110;
    if (!deleting && ci === line.length) { delay = 1900; deleting = true; }
    else if (deleting && ci === 0) { deleting = false; li = (li + 1) % lines.length; delay = 420; }
    setTimeout(tick, delay);
  })();
}

/* ---------- Header scroll style ---------- */
function initHeaderScroll() {
  const header = document.getElementById('site-header');
  const onScroll = function () {
    header.classList.toggle('scrolled', window.scrollY > 30);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

/* ---------- Reveal modules when entering viewport ---------- */
function initReveal() {
  const io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting) { en.target.classList.add('visible'); io.unobserve(en.target); }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });
}

/* ---------- Utility: HTML escaping ---------- */
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
