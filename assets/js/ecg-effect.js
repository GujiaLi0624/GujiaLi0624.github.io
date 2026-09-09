/* ============================================================
 * ECG / EKG effect — Fourier-series cardiac monitor (Canvas)
 *
 * A green scrolling ECG trace fixed to the LEFT side of the page.
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
  const cfg = (window.SITE_CONFIG && window.SITE_CONFIG.ecgEffect) || {};
  if (cfg.enabled === false) return;

  /* ---------- canvas setup ---------- */
  const canvas = document.createElement('canvas');
  canvas.className = 'ecg-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = cfg.width || Math.min(window.innerWidth * 0.28, 380);
    const h = window.innerHeight || document.documentElement.clientHeight || 600;
    W = w; H = h;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);
  document.body.appendChild(canvas);
  // Re-resize after DOM is fully ready (Electron webview sometimes
  // reports innerHeight=0 at script load time)
  requestAnimationFrame(function () { resize(); });

  /* ---------- rhythm definitions ---------- */
  // Each rhythm defines: bpm, jitter (beat interval randomness), and
  // a set of Gaussian harmonics {amp, ctr, sigma} per beat.
  // `ctr` is 0..1 within one beat (normalised RR interval).
  function gaussian(x, amp, ctr, sigma) {
    return amp * Math.exp(-Math.pow(x - ctr, 2) / (2 * sigma * sigma));
  }

  const rhythms = [
    {
      name: 'Normal Sinus Rhythm',
      bpm: 75, jitter: 0.04,
      // P, Q, R, S, T — textbook amplitudes
      waves: [
        { amp: 0.15, ctr: 0.18, sigma: 0.05 },   // P wave
        { amp: -0.10, ctr: 0.34, sigma: 0.012 }, // Q
        { amp: 1.00, ctr: 0.37, sigma: 0.012 },  // R (tall spike)
        { amp: -0.28, ctr: 0.40, sigma: 0.012 }, // S
        { amp: 0.30, ctr: 0.62, sigma: 0.07 },   // T wave
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
        { amp: 1.15, ctr: 0.37, sigma: 0.012 },  // taller R
        { amp: -0.30, ctr: 0.40, sigma: 0.012 },
        { amp: 0.22, ctr: 0.60, sigma: 0.06 },  // flatter T
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
        { amp: 0.35, ctr: 0.58, sigma: 0.08 },  // broad T
      ],
      noise: 0.006,
      color: '#33ffaa',
    },
    {
      name: 'Atrial Fibrillation',
      bpm: 95, jitter: 0.35,  // very irregular
      waves: [
        // no P wave
        { amp: -0.10, ctr: 0.35, sigma: 0.014 },
        { amp: 0.95, ctr: 0.38, sigma: 0.014 },
        { amp: -0.28, ctr: 0.41, sigma: 0.014 },
        { amp: 0.18, ctr: 0.60, sigma: 0.06 },
      ],
      noise: 0.03,  // fibrillatory baseline
      color: '#88ff44',
    },
    {
      name: 'Ventricular Tachycardia',
      bpm: 180, jitter: 0.02,
      waves: [
        // wide, bizarre QRS — no P, no T
        { amp: -0.40, ctr: 0.25, sigma: 0.06 },
        { amp: 0.80, ctr: 0.38, sigma: 0.08 },  // very wide
        { amp: -0.50, ctr: 0.52, sigma: 0.06 },
      ],
      noise: 0.02,
      color: '#ffaa00',
    },
    {
      name: 'Ventricular Fibrillation',
      bpm: 250, jitter: 0.5,  // chaotic
      waves: [
        { amp: 0.25, ctr: 0.30, sigma: 0.15 },
        { amp: -0.20, ctr: 0.55, sigma: 0.12 },
        { amp: 0.15, ctr: 0.75, sigma: 0.10 },
      ],
      noise: 0.06,  // very noisy
      color: '#ff6600',
    },
    {
      name: 'Asystole',
      bpm: 0, jitter: 0,
      waves: [],   // flatline
      noise: 0.004,
      color: '#ff0000',
    },
  ];

  /* ---------- scrolling buffer ---------- */
  // We render one vertical strip of pixels per frame and scroll
  // the whole canvas left. The buffer holds the waveform samples.
  const SAMPLE_RATE = 250;          // Hz (samples per second of simulated ECG)
  const PX_PER_SEC = cfg.speed || 200; // pixels scrolled per second of ECG time
  const baseline = () => H * 0.55;  // vertical centre of the trace

  // Circular sample buffer — holds enough for one screen width
  const bufLen = Math.ceil(W * 3);   // 3x width for margin
  let ring = new Float32Array(bufLen);
  let writePos = 0;

  // ECG time (in seconds) — advances per frame
  let ecgTime = 0;
  let nextBeatTime = 0;  // when the next beat starts
  let beatCount = 0;
  let beatInterval = 60 / rhythms[0].bpm;

  // Stage tracking
  let stageIdx = 0;
  let stageStart = 0;
  let stageDuration = 0;
  let rhythm = rhythms[0];

  // Smooth colour & amplitude transitions
  let curColor = rhythm.color;
  let curAmpScale = 1;

  function startStage(idx) {
    stageIdx = idx;
    rhythm = rhythms[idx];
    stageStart = performance.now() / 1000;
    // duration: normal rhythms longer, deadly ones shorter
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
    const v = parseInt(hex.replace('#', ''), 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  }
  function lerpColor(c1, c2, t) {
    const a = hexToRgb(c1), b = hexToRgb(c2);
    const r = Math.round(a[0] + (b[0] - a[0]) * t);
    const g = Math.round(a[1] + (b[1] - a[1]) * t);
    const bl = Math.round(a[2] + (b[2] - a[2]) * t);
    return 'rgb(' + r + ',' + g + ',' + bl + ')';
  }

  /* ---------- generate one ECG sample at time `t` within a beat ---------- */
  function ecgSample(t, rhy) {
    // t: 0..1 normalised within one beat
    let v = 0;
    for (let i = 0; i < rhy.waves.length; i++) {
      v += gaussian(t, rhy.waves[i].amp, rhy.waves[i].ctr, rhy.waves[i].sigma);
    }
    // baseline noise (muscle artefact / fibrillation)
    v += (Math.random() - 0.5) * 2 * rhy.noise;
    return v;
  }

  /* ---------- animation loop ---------- */
  let lastTs = 0;
  let scrollOffset = 0;   // fractional pixels scrolled (for smooth sub-pixel scrolling)

  function frame(ts) {
    ts = ts || performance.now();
    if (!lastTs) lastTs = ts;
    const dt = Math.min((ts - lastTs) / 1000, 0.05);
    lastTs = ts;
    const now = ts / 1000;

    // Stage transition
    if (now - stageStart > stageDuration) {
      const next = stageIdx + 1;
      if (next >= rhythms.length) {
        startStage(0);
      } else {
        startStage(next);
      }
    }

    // Colour transition (lerp toward target)
    curColor = lerpColor(curColor, rhythm.color, 0.02);

    // Amplitude: gradually fade during asystole, recover on restart
    const targetAmp = rhythm.name === 'Asystole' ? 0 : 1;
    curAmpScale += (targetAmp - curAmpScale) * 0.03;

    // Generate samples for this frame
    const samplesToGen = Math.ceil(dt * SAMPLE_RATE);
    const pxPerSample = PX_PER_SEC / SAMPLE_RATE;

    for (let i = 0; i < samplesToGen; i++) {
      const subDt = dt / samplesToGen;
      ecgTime += subDt;

      // Check if it's time for a new beat
      if (rhythm.bpm > 0 && ecgTime >= nextBeatTime) {
        beatCount++;
        // Add jitter to the next beat interval
        const jit = 1 + (Math.random() - 0.5) * 2 * rhythm.jitter;
        nextBeatTime += beatInterval * jit;
      }

      // Where are we within the current beat? (0..1)
      const beatPhase = rhythm.bpm > 0
        ? (ecgTime - (nextBeatTime - beatInterval)) / beatInterval
        : 0;

      let sample;
      if (rhythm.bpm > 0 && beatPhase >= 0 && beatPhase <= 1) {
        sample = ecgSample(beatPhase, rhythm) * curAmpScale;
      } else if (rhythm.bpm > 0 && beatPhase > 1) {
        // between beats — just baseline noise
        sample = (Math.random() - 0.5) * 2 * rhythm.noise * curAmpScale;
      } else {
        // asystole — flatline with tiny noise
        sample = (Math.random() - 0.5) * 2 * rhythm.noise;
      }

      ring[writePos] = sample;
      writePos = (writePos + 1) % bufLen;
    }

    // Scroll and render
    scrollOffset += dt * PX_PER_SEC;
    const wholePx = Math.floor(scrollOffset);
    scrollOffset -= wholePx;

    // Shift ring buffer backward by wholePx
    if (wholePx > 0) {
      for (let p = 0; p < wholePx; p++) {
        // The oldest sample moves to the left edge
        // We don't actually shift — we just track read position
      }
    }

    // Render: clear canvas, draw trace by reading from ring buffer
    ctx.clearRect(0, 0, W, H);

    // Subtle grid (medical monitor look)
    drawGrid();

    // Draw the ECG trace
    const traceY = baseline();
    const ampPx = H * 0.22;  // amplitude in pixels
    const readStart = (writePos - Math.ceil(W / pxPerSample) - 1 + bufLen * 10) % bufLen;

    // Glow layers: draw 3 passes with decreasing blur for neon effect
    for (let pass = 0; pass < 3; pass++) {
      const lw = pass === 0 ? 6 : pass === 1 ? 3 : 1.5;
      const alpha = pass === 0 ? 0.12 : pass === 1 ? 0.35 : 1.0;
      ctx.beginPath();
      ctx.strokeStyle = curColor;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = lw;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      let started = false;
      const numSamples = Math.ceil(W / pxPerSample);
      for (let s = 0; s <= numSamples; s++) {
        const idx = (readStart + s + bufLen) % bufLen;
        const v = ring[idx];
        const x = (s * pxPerSample) - (scrollOffset * pxPerSample);
        const y = traceY - v * ampPx;
        if (!started) { ctx.moveTo(x, y); started = true; }
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Draw rhythm label
    drawLabel();
  }

  function drawGrid() {
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 255, 100, 0.04)';
    ctx.lineWidth = 1;
    const step = 20;
    for (let x = 0; x < W; x += step) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += step) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    // brighter major lines
    ctx.strokeStyle = 'rgba(0, 255, 100, 0.08)';
    for (let x = 0; x < W; x += step * 5) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += step * 5) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    ctx.restore();
  }

  function drawLabel() {
    ctx.save();
    ctx.font = '11px ui-monospace, Consolas, monospace';
    ctx.fillStyle = curColor;
    ctx.globalAlpha = 0.8;
    ctx.shadowColor = curColor;
    ctx.shadowBlur = 4;
    ctx.fillText('● ' + rhythm.name, 14, 28);
    const bpm = rhythm.bpm > 0 ? Math.round(rhythm.bpm) + ' bpm' : '— bpm';
    ctx.fillText(bpm, 14, 44);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = curColor;
    ctx.fillText('LEAD II', 14, H - 20);
    ctx.restore();
  }

  // Use rAF with setTimeout fallback (some Electron webviews throttle rAF)
  var ecgRAF = window.requestAnimationFrame || function (cb) { setTimeout(function () { cb(performance.now()); }, 16); };
  var ecgFrameCount = 0;
  function ecgLoop(ts) {
    frame(ts);
    ecgFrameCount++;
    ecgRAF(ecgLoop);
  }
  ecgRAF(ecgLoop);
  // Safety: if rAF didn't fire in 300ms, start a setTimeout loop
  setTimeout(function () {
    if (ecgFrameCount < 2) {
      function tsFallback() {
        frame(performance.now());
        setTimeout(tsFallback, 33);
      }
      tsFallback();
    }
  }, 300);
})();
