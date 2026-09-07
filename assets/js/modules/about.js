/* ============================================================
 * Module: about (About Me) — text intro + image + tags
 * data: { text: [paragraphs...], image: url, tags: [...] }
 * ============================================================ */
window.registerModule('about', function (body, mod) {
  const d = mod.data || {};
  const paragraphs = (d.text || []).map(function (p) {
    return '<p>' + p + '</p>';
  }).join('');
  const tags = (d.tags || []).map(function (t) {
    return '<span class="tag">' + t + '</span>';
  }).join('');
  body.innerHTML =
    '<div class="about-grid">' +
    '  <div class="about-text">' + paragraphs +
    (tags ? '    <div class="about-tags">' + tags + '</div>' : '') +
    '  </div>' +
    (d.image ? '  <div class="about-img"><img src="' + d.image + '" alt="About me" loading="lazy"></div>' : '') +
    '</div>';
});
