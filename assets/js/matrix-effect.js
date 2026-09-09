/* ============================================================
 * Matrix "hacker data stream" effect — digital rain (Canvas)
 *
 * Columns of katakana / hex / binary glyphs fall through the
 * hero box like the Matrix code-rain. Each column has its own
 * speed; the leading glyph is drawn near-white with a green
 * glow, while older glyphs decay into green trails via a
 * translucent fade overlay (frame-rate independent).
 * ============================================================ */
(function () {
  'use strict';
  var cfg = (window.SITE_CONFIG && window.SITE_CONFIG.matrixEffect) || {};
  if (cfg.enabled === false) return;

  var GLYPHS =
    'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン' +
    '0123456789ABCDEF:.<>/\\|=+*#$%&';

  var FONT_SIZE = cfg.fontSize || 14;          // px
  var SPEED_MIN = cfg.speedMin || 6;           // rows per second
  var SPEED_MAX = cfg.speedMax || 16;          // rows per second
  var FADE     = cfg.fadeAlpha != null ? cfg.fadeAlpha : 0.14; // trail decay

  /* ---------- canvas setup ---------- */
  var canvas = null, ctx = null;
  var W = 0, H = 0, dpr = 1;
  var ready = false;
  var cols = [];

  function randGlyph() {
    return GLYPHS.charAt((Math.random() * GLYPHS.length) | 0);
  }

  function makeColumn(stagger) {
    return {
      y: stagger ? -Math.random() * H : -FONT_SIZE - Math.random() * H * 0.6,
      speed: SPEED_MIN + Math.random() * (SPEED_MAX - SPEED_MIN),
      glyph: randGlyph(),
      switchIn: Math.random() * 0.2,   // countdown to next glyph shuffle
    };
  }

  function setupColumns() {
    var n = Math.ceil(W / FONT_SIZE);
    cols = [];
    for (var i = 0; i < n; i++) cols.push(makeColumn(true));
  }

  function initCanvas() {
    var container = document.getElementById('matrix-box');
    if (!container) { setTimeout(initCanvas, 100); return; }
    container.innerHTML = '';
    canvas = document.createElement('canvas');
    canvas.className = 'matrix-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    ctx = canvas.getContext('2d');
    container.appendChild(canvas);
    resize();
    ready = true;
    startLoop();
  }

  function resize() {
    if (!canvas) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    var c = canvas.parentElement;
    W = Math.round(c.clientWidth || 360);
    H = Math.round(c.clientHeight || 110);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#020a05';
    ctx.fillRect(0, 0, W, H);
    setupColumns();
  }

  window.addEventListener('resize', function () { if (ready) resize(); });
  initCanvas();

  /* ---------- frame ---------- */
  var lastTs = 0;

  function frame(ts) {
    if (!ready || !ctx) return;
    ts = ts || performance.now();
    if (!lastTs) lastTs = ts;
    var dt = Math.min((ts - lastTs) / 1000, 0.05);
    lastTs = ts;

    // Fade existing glyphs into the dark background (trail decay),
    // scaled to be frame-rate independent.
    var fade = 1 - Math.pow(1 - FADE, dt * 60);
    ctx.fillStyle = 'rgba(2, 10, 5, ' + fade.toFixed(3) + ')';
    ctx.fillRect(0, 0, W, H);

    ctx.font = FONT_SIZE + 'px "Consolas", "Monaco", "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    for (var i = 0; i < cols.length; i++) {
      var col = cols[i];
      col.y += col.speed * FONT_SIZE * dt;
      col.switchIn -= dt;
      if (col.switchIn <= 0) {
        col.glyph = randGlyph();
        col.switchIn = 0.05 + Math.random() * 0.2;
      }

      // Recycle once the whole column has left the box
      if (col.y - FONT_SIZE > H) {
        cols[i] = makeColumn(false);
        continue;
      }
      if (col.y < -FONT_SIZE) continue;

      var x = i * FONT_SIZE + FONT_SIZE / 2;

      // Bright "neck" glyph right behind the head
      ctx.fillStyle = '#37ff8b';
      ctx.fillText(randGlyph(), x, col.y - FONT_SIZE);

      // Leading glyph — near white with green glow
      ctx.save();
      ctx.shadowColor = '#00ff70';
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#d8ffe6';
      ctx.fillText(col.glyph, x, col.y);
      ctx.restore();
    }
  }

  /* ---------- loop ---------- */
  function startLoop() {
    var raf = window.requestAnimationFrame || function (cb) {
      setTimeout(function () { cb(performance.now()); }, 16);
    };
    var frameCount = 0;
    function loop(ts) {
      frame(ts);
      frameCount++;
      raf(loop);
    }
    raf(loop);
    setTimeout(function () {
      if (frameCount < 2) {
        (function fallback() {
          frame(performance.now());
          setTimeout(fallback, 33);
        })();
      }
    }, 300);
  }
})();
