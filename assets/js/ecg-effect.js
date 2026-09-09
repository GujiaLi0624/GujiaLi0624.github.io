/* ============================================================
 * ECG / EKG effect — Hospital monitor style (Canvas)
 *
 * A small framed ECG monitor embedded in the hero section.
 * Uses a sweep cursor: a bright dot moves left→right drawing
 * the waveform in real-time. Old trace stays visible until the
 * cursor wraps around and overwrites it. Just like a real
 * hospital cardiac monitor.
 *
 * Rhythm: normal sinus rhythm at 75 bpm with P-QRS-T waves.
 *
 * Dependency: window.SITE_CONFIG.ecgEffect; set enabled:false to turn off.
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
    // Clear canvas
    ctx.clearRect(0, 0, W, H);
  }

  window.addEventListener('resize', function () { if (ready) resize(); });
  initCanvas();

  /* ---------- ECG waveform ---------- */
  // Normal sinus rhythm: P, Q, R, S, T waves via Gaussian harmonics
  function gaussian(x, amp, ctr, sigma) {
    return amp * Math.exp(-Math.pow(x - ctr, 2) / (2 * sigma * sigma));
  }

  var waves = [
    { amp: 0.15, ctr: 0.18, sigma: 0.05 },    // P wave
    { amp: -0.10, ctr: 0.34, sigma: 0.012 },  // Q
    { amp: 1.00, ctr: 0.37, sigma: 0.012 },   // R (tall spike)
    { amp: -0.28, ctr: 0.40, sigma: 0.012 },  // S
    { amp: 0.30, ctr: 0.62, sigma: 0.07 },     // T wave
  ];

  var BPM = 75;
  var beatInterval = 60 / BPM;  // seconds per beat
  var jitter = 0.04;            // beat-to-beat variation
  var noiseLevel = 0.006;

  // ECG time (seconds) — one full beat = beatInterval seconds
  var ecgTime = 0;
  var nextBeatTime = 0;

  function ecgValue(t) {
    // t: 0..1 within one beat
    var v = 0;
    for (var i = 0; i < waves.length; i++) {
      v += gaussian(t, waves[i].amp, waves[i].ctr, waves[i].sigma);
    }
    v += (Math.random() - 0.5) * 2 * noiseLevel;
    return v;
  }

  /* ---------- sweep cursor rendering ---------- */
  // The cursor moves left→right at SWEEP_SPEED px/s.
  // It draws the trace as it moves. When it reaches the right
  // edge, it wraps to the left and clears a small gap ahead.
  var SWEEP_SPEED = 30;   // px/s — slow, hospital-monitor feel
  var GAP_WIDTH = 4;       // px — the "eraser" gap ahead of cursor
  var sweepX = 0;           // current cursor x position (pixels)
  var lastY = 0;            // last drawn y position
  var lastTs = 0;

  function frame(ts) {
    if (!ready || !ctx) return;
    ts = ts || performance.now();
    if (!lastTs) lastTs = ts;
    var dt = Math.min((ts - lastTs) / 1000, 0.05);
    lastTs = ts;

    // Advance ECG time
    ecgTime += dt;
    if (ecgTime >= nextBeatTime) {
      var jit = 1 + (Math.random() - 0.5) * 2 * jitter;
      nextBeatTime += beatInterval * jit;
    }
    // Beat phase 0..1
    var beatPhase = (ecgTime - (nextBeatTime - beatInterval)) / beatInterval;
    if (beatPhase < 0) beatPhase = 0;
    if (beatPhase > 1) beatPhase = 1;

    // Advance sweep cursor
    sweepX += SWEEP_SPEED * dt;

    // Wrap around
    if (sweepX >= W) {
      sweepX = 0;
      lastY = 0;
    }

    // Y position of the trace at current cursor x
    var traceY = H * 0.5;
    var ampPx = H * 0.3;
    var v = ecgValue(beatPhase);
    var y = traceY - v * ampPx;

    // --- Erase a small gap ahead of the cursor (the "fresh" area) ---
    // This creates the classic hospital-monitor look where old trace
    // is erased just before the cursor overwrites it.
    var gapStart = sweepX;
    var gapEnd = sweepX + GAP_WIDTH;
    if (gapEnd >= W) {
      // Gap wraps around — erase from sweepX to W, and 0 to overflow
      ctx.clearRect(gapStart, 0, W - gapStart, H);
      var overflow = gapEnd - W;
      if (overflow > 0) ctx.clearRect(0, 0, overflow, H);
    } else {
      ctx.clearRect(gapStart, 0, GAP_WIDTH, H);
    }

    // --- Draw the grid in the gap area (so grid isn't erased permanently) ---
    drawGridInGap(gapStart, gapEnd);

    // --- Draw trace from last position to current ---
    if (sweepX > 0 && lastY !== 0) {
      // Single crisp line — no blur layers
      ctx.beginPath();
      ctx.strokeStyle = '#22ff22';
      ctx.globalAlpha = 1;
      ctx.lineWidth = 1.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.moveTo(sweepX - SWEEP_SPEED * dt, lastY);
      ctx.lineTo(sweepX, y);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // --- Draw the cursor dot (bright green dot at sweep position) ---
    ctx.save();
    ctx.fillStyle = '#22ff22';
    ctx.shadowColor = '#22ff22';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(sweepX, y, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    lastY = y;
  }

  // Draw grid only in the gap area (where we just erased)
  function drawGridInGap(gapStart, gapEnd) {
    ctx.save();
    ctx.strokeStyle = 'rgba(34, 255, 34, 0.08)';
    ctx.lineWidth = 1;
    var step = 8;

    // Handle wrap-around
    var startX = Math.floor(gapStart / step) * step;
    var endX = gapEnd;
    if (gapEnd >= W) {
      // Draw from gapStart to W
      for (var x = startX; x < W; x += step) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }
      // Draw from 0 to overflow
      for (var x2 = 0; x2 < (gapEnd - W); x2 += step) {
        ctx.beginPath(); ctx.moveTo(x2, 0); ctx.lineTo(x2, H); ctx.stroke();
      }
      // Horizontal lines in gap region
      for (var y = 0; y < H; y += step) {
        ctx.beginPath(); ctx.moveTo(gapStart, y); ctx.lineTo(W, y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(gapEnd - W, y); ctx.stroke();
      }
    } else {
      for (var x3 = startX; x3 < endX; x3 += step) {
        ctx.beginPath(); ctx.moveTo(x3, 0); ctx.lineTo(x3, H); ctx.stroke();
      }
      for (var y2 = 0; y2 < H; y2 += step) {
        ctx.beginPath(); ctx.moveTo(gapStart, y2); ctx.lineTo(gapEnd, y2); ctx.stroke();
      }
    }

    // Brighter major lines (every 5 steps)
    ctx.strokeStyle = 'rgba(34, 255, 34, 0.14)';
    var majorStep = step * 5;
    var startMaj = Math.floor(gapStart / majorStep) * majorStep;
    if (gapEnd >= W) {
      for (var x4 = startMaj; x4 < W; x4 += majorStep) {
        ctx.beginPath(); ctx.moveTo(x4, 0); ctx.lineTo(x4, H); ctx.stroke();
      }
      for (var x5 = 0; x5 < (gapEnd - W); x5 += majorStep) {
        ctx.beginPath(); ctx.moveTo(x5, 0); ctx.lineTo(x5, H); ctx.stroke();
      }
    } else {
      for (var x6 = startMaj; x6 < endX; x6 += majorStep) {
        ctx.beginPath(); ctx.moveTo(x6, 0); ctx.lineTo(x6, H); ctx.stroke();
      }
    }
    ctx.restore();
  }

  // Draw initial full grid
  function drawFullGrid() {
    ctx.save();
    ctx.strokeStyle = 'rgba(34, 255, 34, 0.08)';
    ctx.lineWidth = 1;
    var step = 8;
    for (var x = 0; x < W; x += step) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (var y = 0; y < H; y += step) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(34, 255, 34, 0.14)';
    for (var x2 = 0; x2 < W; x2 += step * 5) {
      ctx.beginPath(); ctx.moveTo(x2, 0); ctx.lineTo(x2, H); ctx.stroke();
    }
    for (var y2 = 0; y2 < H; y2 += step * 5) {
      ctx.beginPath(); ctx.moveTo(0, y2); ctx.lineTo(W, y2); ctx.stroke();
    }
    ctx.restore();
  }

  /* ---------- start loop ---------- */
  function startLoop() {
    drawFullGrid();
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
