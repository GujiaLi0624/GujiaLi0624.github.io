/* ============================================================
 * Module: cards (generic card grid) — Research / Notes / Projects
 * config `columns` is only semantic; the layout is responsive.
 * data: [ { title, desc, image?, link?, tags? }, ... ]
 * When `data` is empty, a placeholder notice is shown instead.
 * ============================================================ */
window.registerModule('cards', function (body, mod) {
  const items = (mod.data || []).map(function (c) {
    const external = c.link && c.link.indexOf('http') === 0;
    const tags = (c.tags || []).map(function (t) {
      return '<span class="tag">' + t + '</span>';
    }).join('');
    return (
      '<a class="card" href="' + (c.link || '#') + '"' + (external ? ' target="_blank" rel="noopener"' : '') + '>' +
      (c.image
        ? '<div class="card-img"><img src="' + c.image + '" alt="' + c.title + '" loading="lazy"></div>'
        : '') +
      '<div class="card-body">' +
      '  <h3>' + c.title + '</h3>' +
      (c.desc ? '<p>' + c.desc + '</p>' : '') +
      (tags ? '<div class="card-tags">' + tags + '</div>' : '') +
      '</div>' +
      '</a>'
    );
  }).join('');
  body.innerHTML = items
    ? '<div class="cards-grid">' + items + '</div>'
    : '<div class="empty-placeholder">Nothing here yet — research topics will be added soon.</div>';
});
