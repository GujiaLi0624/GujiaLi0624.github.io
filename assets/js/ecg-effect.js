/* ============================================================
 * ECG / EKG effect — Fourier-series cardiac monitor (Canvas)
 *
 * A small framed ECG monitor embedded in the hero section,
 * between the social links and the scroll hint.
 *
 * Fourier-synthesis approach:
 *   Each cardiac beat is built by summing Gaussian "harmonics" —
 *   one for each wave component (P, Q, R, S, T). This is additive
 *   synthesis, the time-domain dual of a Fourier series. The
 *   coefficients (amplitude, centre, width) are tuned per rhythm.
 *
 * Rhythm cycle:
 *   1. Normal sinus rhythm (steady P-QRS-T at ~75 bpm)
 *   2. Sinus tachycardia (faster ~130 bpm, taller R)
 *   3. Sinus bradycardia (slower ~45 bpm, flatter T)
 *   4. Atrial fibrillation (irregular, no P, noisy baseline)
 *   5. Ventricular tachycardia (wide QRS, no P/T)
 *   6. Ventricular fibrillation (chaotic, low amplitude)
 *   7. Asystole — flatline (only baseline noise)
 *   → loop back to normal
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

  // Wait for the hero ECG container to be created by main.js
  function initCanvas() {
    var container = document.getElementById('ecg-box');
    if (!container) {
      // Container not ready yet — retry shortly
      setTimeout(initCanvas, 100);
      return;
    }
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
    H = container.clientHeight || 120;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Recompute ring buffer for new width
    bufLen = Math.ceil(W * 3);
    ring = new Float32Array(bufLen);
    writePos = 0;
  }

  window.addEventListener('resize', function () { if (ready) resize(); });
  initCanvas();

  /* ---------- rhythm definitions ---------- */
  function gaussian(x, amp, ctr, sigma) {
    return amp * Math.exp(-Math.pow(x - ctr, 2) / (2 * sigma * sigma));
  }

  var rhythms = [
    {
      name: 'Normal Sinus Rhythm',
      bpm: 75, jitter: 0.04,
      waves: [
        { amp: 0.15, ctr: 0.18, sigma: 0.05 },
        { amp: -0.10, ctr: 0.34, sigma: 0.012 },
        { amp: 1.00, ctr: 0.37, sigma: 0.012 },
        { amp: -0.28, ctr: 0.40, sigma: 0.012 },
        { amp: 0.30, ctr: 0.62, sigma: 0.07 },
      ],
      noise: 0.008,
      color: '#00ff88',
    },
    {
      name: 'Sinus Tachycardia',
      bpm: 130, jitter: 0.03,
      waves: [
        { amp: 0.12, ctr: 0.18, sigma: 0.05 },
        { amp: -0.10, ctr: 0.34, sigma: 0.012 },
        { amp: 1.15, ctr: 0.37, sigma: 0.012 },
        { amp: -0.30, ctr: 0.40, sigma: 0.012 },
        { amp: 0.22, ctr: 0.60, sigma: 0.06 },
      ],
      noise: 0.012,
      color: '#00ff66',
    },
    {
      name: 'Sinus Bradycardia',
      bpm: 45, jitter: 0.05,
      waves: [
        { amp: 0.18, ctr: 0.15, sigma: 0.055 },
        { amp: -0.08, ctr: 0.30, sigma: 0.012 },
        { amp: 0.88, ctr: 0.33, sigma: 0.012 },
        { amp: -0.25, ctr: 0.36, sigma: 0.012 },
        { amp: 0.35, ctr: 0.58, sigma: 0.08 },
      ],
      noise: 0.006,
      color: '#33ffaa',
    },
    {
      name: 'Atrial Fibrillation',
      bpm: 95, jitter: 0.35,
      waves: [
        { amp: -0.10, ctr: 0.35, sigma: 0.014 },
        { amp: 0.95, ctr: 0.38, sigma: 0.014 },
        { amp: -0.28, ctr: 0.41, sigma: 0.014 },
        { amp: 0.18, ctr: 0.60, sigma: 0.06 },
      ],
      noise: 0.03,
      color: '#88ff44',
    },
    {
      name: 'Ventricular Tachycardia',
      bpm: 180, jitter: 0.02,
      waves: [
        { amp: -0.40, ctr: 0.25, sigma: 0.06 },
        { amp: 0.80, ctr: 0.38, sigma: 0.08 },
        { amp: -0.50, ctr: 0.52, sigma: 0.06 },
      ],
      noise: 0.02,
      color: '#ffaa00',
    },
    {
      name: 'Ventricular Fibrillation',
      bpm: 250, jitter: 0.5,
      waves: [
        { amp: 0.25, ctr: 0.30, sigma: 0.15 },
        { amp: -0.20, ctr: 0.55, sigma: 0.12 },
        { amp: 0.15, ctr: 0.75, sigma: 0.10 },
      ],
      noise: 0.06,
      color: '#ff6600',
    },
    {
      name: 'Asystole',
      bpm: 0, jitter: 0,
      waves: [],
      noise: 0.004,
      color: '#ff0000',
    },
  ];

  /* ---------- scrolling buffer ---------- */
  var SAMPLE_RATE = 250;
  var PX_PER_SEC = cfg.speed || 200;
  var bufLen = 1200;
  var ring = new Float32Array(bufLen);
  var writePos = 0;

  var ecgTime = 0;
  var nextBeatTime = 0;
  var beatCount = 0;
  var beatInterval = 60 / rhythms[0].bpm;

  var stageIdx = 0;
  var stageStart = 0;
  var stageDuration = 0;
  var rhythm = rhythms[0];
  var curColor = rhythm.color;
  var curAmpScale = 1;

  function startStage(idx) {
    stageIdx = idx;
    rhythm = rhythms[idx];
    stageStart = performance.now() / 1000;
    if (idx === 0) stageDuration = 10;
    else if (idx >= 4) stageDuration = 6;
    else stageDuration = 8;
    beatInterval = rhythm.bpm > 0 ? 60 / rhythm.bpm : 1.0;
    nextBeatTime = 0;
    ecgTime = 0;
    beatCount = 0;
  }
  startStage(0);

  function hexToRgb(hex) {
    var v = parseInt(hex.replace('#', ''), 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  }
  function lerpColor(c1, c2, t) {
    var a = hexToRgb(c1), b = hexToRgb(c2);
    return 'rgb(' + Math.round(a[0] + (b[0] - a[0]) * t) + ',' +
      Math.round(a[1] + (b[1] - a[1]) * t) + ',' +
      Math.round(a[2] + (b[2] - a[2]) * t) + ')';
  }

  function ecgSample(t, rhy) {
    var v = 0;
    for (var i = 0; i < rhy.waves.length; i++) {
      v += gaussian(t, rhy.waves[i].amp, rhy.waves[i].ctr, rhy.waves[i].sigma);
    }
    v += (Math.random() - 0.5) * 2 * rhy.noise;
    return v;
  }

  /* ---------- animation loop ---------- */
  var lastTs = 0;
  var scrollOffset = 0;

  function frame(ts) {
    if (!ready || !ctx) return;
    ts = ts || performance.now();
    if (!lastTs) lastTs = ts;
    var dt = Math.min((ts - lastTs) / 1000, 0.05);
    lastTs = ts;
    var now = ts / 1000;

    if (now - stageStart > stageDuration) {
      var next = stageIdx + 1;
      if (next >= rhythms.length) startStage(0);
      else startStage(next);
    }

    curColor = lerpColor(curColor, rhythm.color, 0.02);
    var targetAmp = rhythm.name === 'Asystole' ? 0 : 1;
    curAmpScale += (targetAmp - curAmpScale) * 0.03;

    var samplesToGen = Math.ceil(dt * SAMPLE_RATE);
    var pxPerSample = PX_PER_SEC / SAMPLE_RATE;

    for (var i = 0; i < samplesToGen; i++) {
      var subDt = dt / samplesToGen;
      ecgTime += subDt;
      if (rhythm.bpm > 0 && ecgTime >= nextBeatTime) {
        beatCount++;
        var jit = 1 + (Math.random() - 0.5) * 2 * rhythm.jitter;
        nextBeatTime += beatInterval * jit;
      }
      var beatPhase = rhythm.bpm > 0
        ? (ecgTime - (nextBeatTime - beatInterval)) / beatInterval
        : 0;
      var sample;
      if (rhythm.bpm > 0 && beatPhase >= 0 && beatPhase <= 1) {
        sample = ecgSample(beatPhase, rhythm) * curAmpScale;
      } else if (rhythm.bpm > 0 && beatPhase > 1) {
        sample = (Math.random() - 0.5) * 2 * rhythm.noise * curAmpScale;
      } else {
        sample = (Math.random() - 0.5) * 2 * rhythm.noise;
      }
      ring[writePos] = sample;
      writePos = (writePos + 1) % bufLen;
    }

    scrollOffset += dt * PX_PER_SEC;
    var wholePx = Math.floor(scrollOffset);
    scrollOffset -= wholePx;

    ctx.clearRect(0, 0, W, H);
    drawGrid();

    var traceY = H * 0.5;
    var ampPx = H * 0.3;
    var readStart = (writePos - Math.ceil(W / pxPerSample) - 1 + bufLen * 10) % bufLen;

    for (var pass = 0; pass < 3; pass++) {
      var lw = pass === 0 ? 5 : pass === 1 ? 2.5 : 1.2;
      var alpha = pass === 0 ? 0.15 : pass === 1 ? 0.4 : 1.0;
      ctx.beginPath();
      ctx.strokeStyle = curColor;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = lw;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      var started = false;
      var numSamples = Math.ceil(W / pxPerSample);
      for (var s = 0; s <= numSamples; s++) {
        var idx = (readStart + s + bufLen) % bufLen;
        var v = ring[idx];
        var x = (s * pxPerSample) - (scrollOffset * pxPerSample);
        var y = traceY - v * ampPx;
        if (!started) { ctx.moveTo(x, y); started = true; }
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    drawLabel();
  }

  function drawGrid() {
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 255, 100, 0.06)';
    ctx.lineWidth = 1;
    var step = 16;
    for (var x = 0; x < W; x += step) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (var y = 0; y < H; y += step) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(0, 255, 100, 0.12)';
    for (var x2 = 0; x2 < W; x2 += step * 5) {
      ctx.beginPath(); ctx.moveTo(x2, 0); ctx.lineTo(x2, H); ctx.stroke();
    }
    for (var y2 = 0; y2 < H; y2 += step * 5) {
      ctx.beginPath(); ctx.moveTo(0, y2); ctx.lineTo(W, y2); ctx.stroke();
    }
    ctx.restore();
  }

  function drawLabel() {
    ctx.save();
    ctx.font = '10px ui-monospace, Consolas, monospace';
    ctx.fillStyle = curColor;
    ctx.globalAlpha = 0.9;
    ctx.shadowColor = curColor;
    ctx.shadowBlur = 3;
    ctx.fillText('● ' + rhythm.name, 10, 16);
    var bpm = rhythm.bpm > 0 ? Math.round(rhythm.bpm) + ' bpm' : '— bpm';
    ctx.fillText(bpm, 10, 30);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 0.5;
    ctx.fillText('LEAD II', W - 56, 16);
    ctx.restore();
  }

  /* ---------- start loop ---------- */
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
