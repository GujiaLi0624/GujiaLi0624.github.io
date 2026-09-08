/* ============================================================
 * Module: repository — auto-lists files in the repository/
 * folder via GitHub Contents API. No code needed to add files:
 * just drop a file into repository/, commit & push, and it
 * appears here automatically.
 *
 * config: { type:'repository', repo:'user/repo', folder:'repository' }
 * ============================================================ */
window.registerModule('repository', function (body, mod) {
  var repo = mod.repo || 'GujiaLi0624/GujiaLi0624.github.io';
  var folder = mod.folder || 'repository';
  var branch = mod.branch || 'main';
  var apiUrl = 'https://api.github.com/repos/' + repo + '/contents/' + folder + '?ref=' + branch;

  body.innerHTML = '<div class="repo-loading">Loading files…</div>';

  fetch(apiUrl)
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function (items) {
      // Filter out hidden files (.gitkeep, .gitignore, etc.)
      var files = items.filter(function (f) {
        return f.type === 'file' && f.name.charAt(0) !== '.';
      });

      if (!files.length) {
        body.innerHTML = '<div class="empty-placeholder">No files yet. Drop files into the repository/ folder and push to GitHub.</div>';
        return;
      }

      // Sort by name, group by extension
      files.sort(function (a, b) { return a.name.localeCompare(b.name); });

      var html = '<div class="repo-grid">';
      files.forEach(function (f) {
        var ext = f.name.split('.').pop().toUpperCase();
        var sizeKB = (f.size / 1024).toFixed(1);
        var sizeStr = sizeKB < 1024 ? sizeKB + ' KB' : (sizeKB / 1024).toFixed(1) + ' MB';
        var date = f.last_modified ? new Date(f.last_modified).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '';
        html +=
          '<a class="repo-item" href="' + f.download_url + '" target="_blank" rel="noopener">' +
          '  <div class="repo-icon">' + fileIcon(ext) + '</div>' +
          '  <div class="repo-info">' +
          '    <div class="repo-name">' + f.name + '</div>' +
          '    <div class="repo-meta">' + ext + ' · ' + sizeStr + (date ? ' · ' + date : '') + '</div>' +
          '  </div>' +
          '  <div class="repo-dl">⬇</div>' +
          '</a>';
      });
      html += '</div>';
      body.innerHTML = html;
    })
    .catch(function (e) {
      body.innerHTML = '<div class="empty-placeholder">Failed to load files. Visit <a href="https://github.com/' + repo + '/tree/' + branch + '/' + folder + '" target="_blank">GitHub</a> to browse directly.</div>';
      console.warn('[repository] load error:', e.message);
    });

  function fileIcon(ext) {
    var icons = {
      PDF: '📄', DOC: '📝', DOCX: '📝', TXT: '📝', MD: '📝',
      ZIP: '📦', RAR: '📦', '7Z': '📦', GZ: '📦', TAR: '📦',
      JPG: '🖼', JPEG: '🖼', PNG: '🖼', GIF: '🖼', SVG: '🖼', WEBP: '🖼',
      MP4: '🎬', AVI: '🎬', MOV: '🎬', MKV: '🎬', WEBM: '🎬',
      MP3: '🎵', WAV: '🎵', FLAC: '🎵', OGG: '🎵',
      PY: '🐍', JS: '📜', HTML: '🌐', CSS: '🎨', JSON: '⚙️',
      XLSX: '📊', XLS: '📊', CSV: '📊', PPTX: '📊', PPT: '📊',
      DEFAULT: '📎',
    };
    return icons[ext] || icons.DEFAULT;
  }
});
