/* ============================================================
 * Module: timeline (experience timeline)
 * data: [ { year, title, desc }, ... ]
 * ============================================================ */
window.registerModule('timeline', function (body, mod) {
  const items = (mod.data || []).map(function (t) {
    return (
      '<div class="tl-item">' +
      '  <div class="tl-dot"></div>' +
      '  <div class="tl-year">' + t.year + '</div>' +
      '  <div class="tl-content">' +
      '    <h3>' + t.title + '</h3>' +
      (t.desc ? '<p>' + t.desc + '</p>' : '') +
      '  </div>' +
      '</div>'
    );
  }).join('');
  body.innerHTML = '<div class="timeline">' + items + '</div>';
});
