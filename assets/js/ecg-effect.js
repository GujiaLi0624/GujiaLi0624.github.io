/* ============================================================
 * ECG / EKG effect — Hospital monitor style (Canvas)
 *
 * Sweep-cursor renderer: a bright dot moves left→right at a
 * constant speed, drawing the ECG waveform in real time like a
 * real cardiac monitor. Old trace stays visible until the cursor
 * wraps around and overwrites it.
 *
 * Key rendering detail: each frame the cursor sweeps several
 * pixels; we sub-sample the ECG at 0.5px intervals along that
 * sweep so sharp features (the QRS spike) stay crisp instead of
 * being smeared into vertical bands.
 *
 * Rhythm: normal sinus rhythm at 75 bpm with P-QRS-T waves.
 * ============================================================ */
(function () {
  'use strict';
  var cfg = (window.SITE_CONFIG && window.SITE_CONFIG.ecgEffect) || {};
  if (cfg.enabled === false) return;

  /* ---------- canvas setup ---------- */
  var canvas = null, ctx = null;
  var W = 0, H = 0, dpr = 1;
  var ready = false;

  function initCanvas() {
    var container = document.getElementById('ecg-box');
    if (!container) { setTimeout(initCanvas, 100); return; }
    container.innerHTML = '';
    canvas = document.createElement('canvas');
    canvas.className = 'ecg-canvas';
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
    var container = canvas.parentElement;
    W = container.clientWidth || 360;
    H = container.clientHeight || 110;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    drawFullGrid();
  }

  window.addEventListener('resize', function () { if (ready) resize(); });
  initCanvas();

  /* ---------- ECG waveform ---------- */
  // P-QRS-T built from Gaussian harmonics (Fourier-style additive
  // synthesis). Sigmas are tuned so each feature spans several
  // pixels on screen at the sweep speed below:
  //   beat = 0.8s (75bpm), sweep = 60px/s → one beat ≈ 48px wide.
  function gaussian(x, amp, ctr, sigma) {
    return amp * Math.exp(-Math.pow(x - ctr, 2) / (2 * sigma * sigma));
  }

  var waves = [
    { amp: 0.14, ctr: 0.16, sigma: 0.040 },  // P wave   (wide, low)
    { amp: -0.08, ctr: 0.30, sigma: 0.018 }, // Q
    { amp: 0.95, ctr: 0.335, sigma: 0.015 }, // R (sharp needle)
    { amp: -0.22, ctr: 0.365, sigma: 0.018 },// S
    { amp: 0.26, ctr: 0.56, sigma: 0.050 },  // T wave   (broad)
  ];

  var BPM = 55;
  var beatInterval = 60 / BPM;   // ~1.09s per beat — relaxed spacing
  var jitter = 0.03;
  var noiseLevel = 0.004;

  var ecgTime = 0;
  var nextBeatTime = beatInterval;  // end of the current beat

  // Value of the ECG at beat phase t (0..1)
  function ecgValue(t) {
    if (t < 0 || t > 1) return 0;
    var v = 0;
    for (var i = 0; i < waves.length; i++) {
      v += gaussian(t, waves[i].amp, waves[i].ctr, waves[i].sigma);
    }
    return v;
  }

  /* ---------- sweep cursor ---------- */
  var SWEEP_SPEED = 60;   // px/s — one beat ≈ 65px with ~55bpm
  var GAP_WIDTH = 3;       // px erased ahead of the cursor
  var sweepX = 0;
  var lastTs = 0;

  var traceY, ampPx;

  function frame(ts) {
    if (!ready || !ctx) return;
    ts = ts || performance.now();
    if (!lastTs) lastTs = ts;
    var dt = Math.min((ts - lastTs) / 1000, 0.05);
    lastTs = ts;

    traceY = H * 0.55;
    ampPx = H * 0.32;

    // Advance ECG time; schedule next beat with jitter
    var oldEcgTime = ecgTime;
    ecgTime += dt;
    while (ecgTime >= nextBeatTime) {
      var jit = 1 + (Math.random() - 0.5) * 2 * jitter;
      nextBeatTime += beatInterval * jit;
    }

    // Advance sweep cursor
    var oldX = sweepX;
    var newX = sweepX + SWEEP_SPEED * dt;

    // Beat start/end for phase interpolation
    var beatStart = nextBeatTime - beatInterval;

    if (newX >= W) {
      // Wrap: erase from oldX..W and 0..(newX-W)
      ctx.clearRect(oldX, 0, W - oldX, H);
      var over = newX - W;
      ctx.clearRect(0, 0, over, H);
      drawGridInRect(oldX, W);
      drawGridInRect(0, over);
      // Draw the trace tail on the right edge up to W
      var tAtWrap = oldEcgTime + (W - oldX) / SWEEP_SPEED;
      drawTraceSegment(oldX, W, oldEcgTime, tAtWrap, beatStart);
      // Wrap cursor to left and draw the continuing fragment
      sweepX = over;
      drawTraceSegment(0, over, tAtWrap, ecgTime, beatStart);
    } else {
      sweepX = newX;
      // Erase gap ahead of cursor
      var gapEnd = Math.min(newX + GAP_WIDTH, W);
      ctx.clearRect(newX, 0, gapEnd - newX, H);
      drawGridInRect(newX, gapEnd);
      drawTraceSegment(oldX, newX, oldEcgTime, ecgTime, beatStart);
    }

    // Cursor dot (small crisp glow)
    var phase = (ecgTime - beatStart) / beatInterval;
    var v = ecgValue(phase);
    var y = traceY - v * ampPx;
    ctx.save();
    ctx.fillStyle = '#44ff44';
    ctx.shadowColor = '#22ff22';
    ctx.shadowBlur = 5;
    ctx.beginPath();
    ctx.arc(sweepX, y, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Draw trace from x0..x1, with ECG time going t0..t1.
  // Sub-sampled every ~0.4px so sharp peaks stay crisp.
  function drawTraceSegment(x0, x1, t0, t1, beatStart) {
    var dx = x1 - x0;
    if (dx <= 0) return;
    var steps = Math.max(1, Math.ceil(dx / 0.4));
    ctx.beginPath();
    ctx.strokeStyle = '#22ff22';
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'miter';
    for (var i = 0; i <= steps; i++) {
      var f = i / steps;
      var x = x0 + dx * f;
      var t = t0 + (t1 - t0) * f;
      var ph = (t - beatStart) / beatInterval;
      var v = 0;
      if (ph >= 0 && ph <= 1) v = ecgValue(ph);
      // tiny deterministic-free baseline noise
      v += (Math.random() - 0.5) * 2 * noiseLevel;
      var y = traceY - v * ampPx;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  /* ---------- grid ---------- */
  function gridLines(x0, x1) {
    var step = 8;
    var s = Math.ceil(x0 / step) * step;
    for (var x = s; x < x1; x += step) {
      ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); ctx.stroke();
    }
    for (var y = step; y < H; y += step) {
      ctx.beginPath(); ctx.moveTo(x0, y + 0.5); ctx.lineTo(x1, y + 0.5); ctx.stroke();
    }
    // major lines every 5 steps
    var ms = step * 5;
    var sm = Math.ceil(x0 / ms) * ms;
    for (var xm = sm; xm < x1; xm += ms) {
      ctx.beginPath(); ctx.moveTo(xm + 0.5, 0); ctx.lineTo(xm + 0.5, H); ctx.stroke();
    }
  }

  function drawGridInRect(x0, x1) {
    if (x1 <= x0) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(34, 255, 34, 0.07)';
    ctx.lineWidth = 1;
    gridLines(x0, x1);
    ctx.strokeStyle = 'rgba(34, 255, 34, 0.13)';
    // reuse major-line pass only by faking step=40
    var ms = 40;
    var sm = Math.ceil(x0 / ms) * ms;
    for (var xm = sm; xm < x1; xm += ms) {
      ctx.beginPath(); ctx.moveTo(xm + 0.5, 0); ctx.lineTo(xm + 0.5, H); ctx.stroke();
    }
    ctx.restore();
  }

  function drawFullGrid() {
    ctx.save();
    ctx.strokeStyle = 'rgba(34, 255, 34, 0.07)';
    ctx.lineWidth = 1;
    var step = 8;
    for (var x = step; x < W; x += step) {
      ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); ctx.stroke();
    }
    for (var y = step; y < H; y += step) {
      ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(34, 255, 34, 0.13)';
    for (var xm = step * 5; xm < W; xm += step * 5) {
      ctx.beginPath(); ctx.moveTo(xm + 0.5, 0); ctx.lineTo(xm + 0.5, H); ctx.stroke();
    }
    for (var ym = step * 5; ym < H; ym += step * 5) {
      ctx.beginPath(); ctx.moveTo(0, ym + 0.5); ctx.lineTo(W, ym + 0.5); ctx.stroke();
    }
    ctx.restore();
  }

  /* ---------- loop ---------- */
  function startLoop() {
    var ecgRAF = window.requestAnimationFrame || function (cb) {
      setTimeout(function () { cb(performance.now()); }, 16);
    };
    var ecgFrameCount = 0;
    function ecgLoop(ts) {
      frame(ts);
      ecgFrameCount++;
      ecgRAF(ecgLoop);
    }
    ecgRAF(ecgLoop);
    setTimeout(function () {
      if (ecgFrameCount < 2) {
        function tsFallback() {
          frame(performance.now());
          setTimeout(tsFallback, 33);
        }
        tsFallback();
      }
    }, 300);
  }
})();
