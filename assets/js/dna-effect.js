/* ============================================================
 * DNA base-pair effect (Canvas)
 *
 * Structure — a rotating 3D double helix projected to 2D:
 *  - Two anti-parallel sugar-phosphate BACKBONES wind around a
 *    vertical axis (phase-shifted by π) and slowly rotate.
 *    Depth (z) drives size, brightness and paint order, so the
 *    strands genuinely pass in front of / behind each other.
 *  - Base pairs form the rungs: one base capsule on each strand,
 *    joined by hydrogen bonds (2 dashes for A=T, 3 for C=G).
 *  - The complementary strand starts partially MISSING: broken
 *    rungs show a breathing ghost ring plus the letter required
 *    by the complementary-pairing rule (A-T / C-G).
 *  - A crowd of floating bases (A/T/C/G) drifts around and is
 *    attracted to the mouse cursor. Complementary bases inside
 *    the cursor halo PAIR UP (A+T, C+G) and stay bound together
 *    with their own hydrogen bonds while orbiting the cursor.
 *  - Moving the cursor near a gap repairs it: the engine grabs a
 *    matching base hovering around the cursor (unpairing it if
 *    needed) and flies it into the gap; if none is available the
 *    correct base self-assembles in place. Repairs flash.
 *  - Once every base pair is restored the whole helix glows,
 *    then a new decay cycle begins.
 *
 * Dependency: window.SITE_CONFIG.dnaEffect; set enabled:false to turn off.
 * ============================================================ */
(function () {
  'use strict';
  const cfg = (window.SITE_CONFIG && window.SITE_CONFIG.dnaEffect) || {};
  if (cfg.enabled === false) return;

  /* ---------- constants ---------- */
  const COMPLEMENT = { A: 'T', T: 'A', C: 'G', G: 'C' };
  const BASES = ['A', 'T', 'C', 'G'];
  const H_BONDS = { A: 2, T: 2, C: 3, G: 3 }; // A=T: 2 hydrogen bonds, C=G: 3
  const COLOR = {
    A: '#fb923c', T: '#22d3ee', C: '#a78bfa', G: '#4ade80',
  };
  const RGB = {
    A: '251,146,60', T: '34,211,238', C: '167,139,250', G: '74,222,128',
  };
  const PAIR_DIST = 60;   // cursor-halo distance at which two bases can pair
  const PAIR_GAP = 32;    // resting distance of a bound pair
  const PAIR_BREAK = 1.3; // pair breaks when both partners leave halo * this

  /* ---------- canvas ---------- */
  const canvas = document.createElement('canvas');
  canvas.id = 'dna-canvas';
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;' +
    'z-index:0;pointer-events:none;';
  document.addEventListener('DOMContentLoaded', () => document.body.prepend(canvas));

  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1;

  /* ---------- state ---------- */
  let dnaX = 0;            // helix axis x
  let rungs = [];          // base-pair rungs
  let strandSamples = [];  // backbone sample points [{x,y,z}] (shared geometry for both strands)
  let particles = [];      // floating bases
  let mouse = { x: -9999, y: -9999, active: false };
  let glowT = 0;           // full-repair glow intensity 0~1
  let glowHold = 0;        // glow hold timer
  let spiralPhase = 0;     // current rotation of the helix
  let time = 0;
  let running = true;

  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];
  const dist2 = (ax, ay, bx, by) => (ax - bx) ** 2 + (ay - by) ** 2;

  /* Helix geometry: a point on strand `side` (+1 / -1) at height y.
   * Strand 2 is phase-shifted by π (anti-parallel). Returns {x, z}
   * in canvas coords; z ∈ [-1, 1] is the depth used for shading
   * and paint order. */
  function strandPoint(side, y) {
    const amp = cfg.amp ?? 95;
    const k = Math.PI * 2 / (cfg.twistLen ?? 260);
    const a = y * k + spiralPhase + (side < 0 ? 0 : Math.PI);
    return {
      x: dnaX + Math.sin(a) * amp,
      z: Math.cos(a),
    };
  }

  /* ---------- build the helix rungs ---------- */
  function buildDNA() {
    dnaX = W * (cfg.xRatio ?? 0.72);
    const gap = cfg.rungGap ?? 48;
    const top = 46, bottom = H - 46;
    const n = Math.max(12, Math.floor((bottom - top) / gap)); // long chain, near full height

    rungs = [];
    const missingRatio = cfg.missingRatio ?? 0.4;
    for (let i = 0; i < n; i++) {
      const y = top + (i + 0.5) * ((bottom - top) / n);
      const base = pick(BASES);           // strand 1 base
      const comp = COMPLEMENT[base];      // complementary base on strand 2
      rungs.push({
        y,
        x1: 0, z1: 0, x2: 0, z2: 0,       // computed every frame
        base, comp,
        bonds: H_BONDS[base],
        missing: Math.random() < missingRatio, // only the complementary strand decays
        fill: 0,
        repaired: false,
        repairing: false,
        flyParticle: null,
        selfDelay: 0,
        flash: 0,
        seed: Math.random() * Math.PI * 2,
      });
    }
    // ensure there is at least one gap to play with
    if (rungs.every(r => !r.missing)) rungs[(n / 2) | 0].missing = true;

    // backbone sample points (independent of rungs, smooth along y)
    strandSamples = [];
    const step = 7;
    for (let y = top - 30; y <= bottom + 30; y += step) strandSamples.push(y);
  }

  function updatePositions() {
    for (const r of rungs) {
      const p1 = strandPoint(-1, r.y);
      const p2 = strandPoint(1, r.y);
      r.x1 = p1.x; r.z1 = p1.z;
      r.x2 = p2.x; r.z2 = p2.z;
    }
  }

  /* ---------- floating base particles ---------- */
  function targetParticleCount() {
    return cfg.particleCount || Math.min(26, Math.max(12, Math.round(W / 55)));
  }

  function spawnParticle(fade) {
    return {
      x: rnd(30, W - 30),
      y: rnd(30, H - 30),
      vx: rnd(-18, 18), vy: rnd(-18, 18),
      char: pick(BASES),
      size: rnd(11, 16),
      alpha: fade ? 0 : rnd(0.55, 0.95),
      fade: !!fade,
      partner: null,  // complementary particle this one is bound to
      pairFlash: 0,   // pairing flash timer
      flying: null,   // {sx,sy,tx,ty,t} when grabbed for a repair
    };
  }

  function resetParticles() {
    particles = [];
    const n = targetParticleCount();
    for (let i = 0; i < n; i++) particles.push(spawnParticle(false));
  }

  function unpair(p) {
    if (p.partner) {
      const q = p.partner;
      p.partner = null;
      if (q.partner === p) q.partner = null;
    }
  }

  function removeParticle(p) {
    unpair(p);
    const i = particles.indexOf(p);
    if (i >= 0) particles.splice(i, 1);
  }

  /* ---------- complementary pairing in the cursor halo ---------- */
  function updatePairing(dt) {
    const R = cfg.attractRadius ?? 170;
    const R2 = R * R;

    // form new pairs
    if (mouse.active) {
      for (let i = 0; i < particles.length; i++) {
        const a = particles[i];
        if (a.flying || a.partner || a.fade) continue;
        if (dist2(a.x, a.y, mouse.x, mouse.y) > R2) continue;
        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j];
          if (b.flying || b.partner || b.fade) continue;
          if (COMPLEMENT[a.char] !== b.char) continue;
          if (dist2(b.x, b.y, mouse.x, mouse.y) > R2) continue;
          if (dist2(a.x, a.y, b.x, b.y) < PAIR_DIST * PAIR_DIST) {
            a.partner = b; b.partner = a;
            a.pairFlash = 0.55; b.pairFlash = 0.55;
            break;
          }
        }
      }
    }

    // spring that keeps bound pairs together (they orbit as a unit)
    for (const p of particles) {
      if (!p.partner || p.flying) continue;
      const q = p.partner;
      const dx = q.x - p.x, dy = q.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      const f = (d - PAIR_GAP) * 9; // spring stiffness
      p.vx += (dx / d) * f * dt;
      p.vy += (dy / d) * f * dt;
      q.vx -= (dx / d) * f * dt;
      q.vy -= (dy / d) * f * dt;
    }

    // break pairs that leave the cursor halo
    const breakR2 = (R * PAIR_BREAK) ** 2;
    for (const p of particles) {
      if (!p.partner) continue;
      const dm = Math.min(
        dist2(p.x, p.y, mouse.x, mouse.y),
        dist2(p.partner.x, p.partner.y, mouse.x, mouse.y)
      );
      if (dm > breakR2) unpair(p);
    }

    // pairing flash timers
    for (const p of particles) {
      if (p.pairFlash > 0) p.pairFlash = Math.max(0, p.pairFlash - dt / 0.55);
    }
  }

  /* ---------- repair logic ---------- */
  function tryRepair(dt) {
    const R = (cfg.repairRadius ?? 130) ** 2;
    for (const r of rungs) {
      if (!r.missing || r.repaired || r.repairing) continue;
      if (!mouse.active) continue;
      if (dist2(mouse.x, mouse.y, r.x2, r.y) > R) continue;

      r.repairing = true;
      r.flash = 0;
      // Grab a matching base from the cursor halo — prefer unpaired
      // ones; fall back to breaking a bound pair.
      const need = r.comp;
      const attract2 = (cfg.attractRadius ?? 170) ** 2;
      let best = null, bestD = Infinity, bestPaired = null;
      for (const p of particles) {
        if (p.flying || p.fade) continue;
        if (p.char !== need) continue;
        const d = dist2(p.x, p.y, mouse.x, mouse.y);
        if (d >= attract2) continue;
        if (p.partner) {
          if (d < bestD && !bestPaired) { bestD = d; bestPaired = p; }
        } else if (d < bestD) { bestD = d; best = p; }
      }
      const chosen = best || bestPaired;
      if (chosen) {
        unpair(chosen); // if it was bound, release its partner first
        chosen.flying = { sx: chosen.x, sy: chosen.y, tx: r.x2, ty: r.y, t: 0 };
        r.flyParticle = chosen;
      } else {
        r.selfDelay = 0.22; // self-assemble in place
      }
    }
  }

  function updateRepair(dt) {
    for (const r of rungs) {
      // flying particle
      if (r.flyParticle && r.flyParticle.flying) {
        const f = r.flyParticle.flying;
        f.t = Math.min(1, f.t + dt * 2.2);
        f.tx = r.x2; f.ty = r.y; // retarget each frame (helix rotates)
        const e = 1 - (1 - f.t) ** 3; // easeOutCubic
        r.flyParticle.x = f.sx + (f.tx - f.sx) * e;
        r.flyParticle.y = f.sy + (f.ty - f.sy) * e;
        if (f.t >= 1) {
          removeParticle(r.flyParticle);
          r.flyParticle = null;
        }
      }
      // in-place self-assembly
      if (r.repairing && !r.flyParticle) {
        if (r.selfDelay > 0) r.selfDelay -= dt;
        else r.fill = Math.min(1, r.fill + dt / 0.6);
      }
      if (r.fill >= 1) {
        r.repaired = true;
        r.flash = 1; // flash on completion
      }
      if (r.flash > 0) r.flash = Math.max(0, r.flash - dt / 0.8);
    }
  }

  /* ---------- particle motion (drift + cursor attraction) ---------- */
  function updateParticles(dt) {
    const R = cfg.attractRadius ?? 170;
    for (const p of particles) {
      if (p.fade) { p.alpha = Math.min(rnd(0.55, 0.95), p.alpha + dt * 1.5); if (p.alpha >= 0.55) p.fade = false; }
      if (p.flying) continue; // flying particles are steered by the repair logic

      const dx = mouse.x - p.x, dy = mouse.y - p.y;
      const d = Math.hypot(dx, dy);
      if (mouse.active && d < R && d > 1) {
        // attraction + tangential component → orbiting the cursor
        const pull = (1 - d / R) * 900;
        p.vx += (dx / d) * pull * dt + (-dy / d) * pull * 0.35 * dt;
        p.vy += (dy / d) * pull * dt + (dx / d) * pull * 0.35 * dt;
      } else {
        // free drift with slight noise
        p.vx += rnd(-30, 30) * dt;
        p.vy += rnd(-30, 30) * dt;
        p.vx *= 0.995; p.vy *= 0.995;
      }
      // damping & speed limit
      const sp = Math.hypot(p.vx, p.vy);
      const max = mouse.active && d < R ? 320 : 60;
      if (sp > max) { p.vx = p.vx / sp * max; p.vy = p.vy / sp * max; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      // wrap around screen edges
      if (p.x < -20) p.x = W + 20; else if (p.x > W + 20) p.x = -20;
      if (p.y < -20) p.y = H + 20; else if (p.y > H + 20) p.y = -20;
    }
  }

  /* ---------- drawing helpers ---------- */
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawBaseChar(ch, x, y, size, alpha, glow) {
    const col = COLOR[ch];
    ctx.save();
    ctx.globalAlpha = alpha;
    if (glow) { ctx.shadowColor = col; ctx.shadowBlur = 12; }
    // capsule
    ctx.fillStyle = `rgba(${RGB[ch]},0.16)`;
    ctx.strokeStyle = `rgba(${RGB[ch]},0.9)`;
    ctx.lineWidth = 1.2;
    const w = size * 1.15, h = size * 1.15;
    roundRect(x - w / 2, y - h / 2, w, h, 5);
    ctx.fill(); ctx.stroke();
    // letter
    ctx.fillStyle = col;
    ctx.font = `bold ${size * 0.78}px ui-monospace,Consolas,monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(ch, x, y + 1);
    ctx.restore();
  }

  /* Hydrogen bonds between the two bases of a rung.
   * A=T draws 2 dashed lines, C=G draws 3 (real biochemistry). */
  function drawBonds(r, alpha) {
    let x1 = r.x1 + 11, x2 = r.x2 - 11;
    if (x2 <= x1) return;
    const n = r.bonds;
    const spread = 8;
    ctx.save();
    ctx.strokeStyle = `rgba(148,163,184,${alpha})`;
    ctx.lineWidth = 1.1;
    ctx.setLineDash([3, 3]);
    for (let i = 0; i < n; i++) {
      const yy = r.y + (n === 1 ? 0 : (i / (n - 1) - 0.5) * spread);
      ctx.beginPath();
      ctx.moveTo(x1, yy);
      ctx.lineTo(x2, yy);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* One backbone strand: continuous band split into a back pass
   * (z < 0) and a front pass (z >= 0) so strands overlap correctly. */
  function drawBackbone(side, front, glow) {
    if (!strandSamples.length) return;
    ctx.save();
    if (glow) { ctx.shadowColor = 'rgba(56,189,248,0.8)'; ctx.shadowBlur = 16; }
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';

    const pts = strandSamples.map(y => strandPoint(side, y).x);
    let seg = [];
    const flush = function () {
      if (seg.length < 2) { seg = []; return; }
      ctx.beginPath();
      ctx.moveTo(seg[0][0], seg[0][1]);
      for (let i = 1; i < seg.length; i++) ctx.lineTo(seg[i][0], seg[i][1]);
      ctx.strokeStyle = seg[0][2];
      ctx.lineWidth = seg[0][3];
      ctx.stroke();
      seg = [];
    };
    for (let i = 0; i < strandSamples.length; i++) {
      const y = strandSamples[i];
      const pt = strandPoint(side, y);
      const isFront = pt.z >= 0;
      if (isFront !== front) { flush(); continue; }
      const depth = (pt.z + 1) / 2; // 0..1
      const alpha = front ? 0.45 + 0.35 * depth : 0.18 + 0.22 * depth;
      const width = front ? 2.2 + 1.2 * depth : 1.6 + 0.8 * depth;
      const col = glow
        ? `rgba(125,211,252,${alpha + 0.2})`
        : `rgba(96,205,255,${alpha})`;
      // depth changed noticeably → start a new colored segment
      if (seg.length && Math.abs(seg[seg.length - 1][4] - depth) > 0.12) flush();
      seg.push([pts[i], y, col, width, depth]);
    }
    flush();

    // sugar-phosphate node at each rung on this strand
    for (const r of rungs) {
      const z = side < 0 ? r.z1 : r.z2;
      if ((z >= 0) !== front) continue;
      const depth = (z + 1) / 2;
      ctx.beginPath();
      ctx.arc(side < 0 ? r.x1 : r.x2, r.y, 2.6 + 1.6 * depth, 0, Math.PI * 2);
      ctx.fillStyle = front
        ? `rgba(186,230,253,${0.55 + 0.4 * depth})`
        : `rgba(147,197,253,${0.25 + 0.3 * depth})`;
      ctx.fill();
    }
    ctx.restore();
  }

  /* Ghost ring / self-assembly visuals for a missing base slot. */
  function drawGhost(r, x, y, f, dim) {
    if (f < 1) {
      const a = (dim ? 0.16 : 0.3) * (0.75 + 0.25 * Math.sin(time * 2.4 + r.seed)) * (1 - f);
      ctx.save();
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = `rgba(148,163,184,${a + 0.12})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, 11, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      // letter of the required (complementary) base
      ctx.save();
      ctx.globalAlpha = a * 1.1;
      ctx.fillStyle = COLOR[r.comp];
      ctx.font = 'bold 10px ui-monospace,Consolas,monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(r.comp, x, y + 1);
      ctx.restore();
    }
    // completion flash
    if (r.flash > 0) {
      ctx.save();
      const rr = 12 + (1 - r.flash) * 34;
      ctx.globalAlpha = r.flash * 0.8 * (dim ? 0.5 : 1);
      ctx.strokeStyle = COLOR[r.comp];
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, rr, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  /* All base capsules of one depth pass (front or back). */
  function drawBases(front, glow) {
    for (const r of rungs) {
      // strand 1 (left, always complete)
      if ((r.z1 >= 0) === front) {
        const depth = (r.z1 + 1) / 2;
        const size = 13 + 4 * depth;
        drawBaseChar(r.base, r.x1, r.y, size, front ? 0.85 + 0.15 * depth : 0.35 + 0.25 * depth, glow && front);
      }
      // strand 2 (complementary, may be missing)
      if ((r.z2 >= 0) === front) {
        const depth = (r.z2 + 1) / 2;
        const size = 13 + 4 * depth;
        if (!r.missing) {
          drawBaseChar(r.comp, r.x2, r.y, size, front ? 0.85 + 0.15 * depth : 0.35 + 0.25 * depth, glow && front);
        } else {
          const f = r.fill;
          if (f > 0) drawBaseChar(r.comp, r.x2, r.y, size * (0.6 + 0.4 * f), Math.max(f, 0.4), true);
          drawGhost(r, r.x2, r.y, f, !front);
        }
      }
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    const glow = glowT > 0;

    updatePositions();

    /* paint order: back backbone → bonds → back bases →
       front backbone → front bases → particles → overlays */
    drawBackbone(-1, false, glow);
    drawBackbone(1, false, glow);

    for (const r of rungs) {
      if (r.missing && r.fill < 1) {
        drawBonds(r, 0.08 + 0.05 * Math.sin(time * 2 + r.seed));
      } else {
        const depth = (Math.min(r.z1, r.z2) + 1) / 2;
        drawBonds(r, glow ? 0.45 + 0.4 * glowT : 0.28 + 0.25 * depth);
      }
    }

    drawBases(false, glow);

    drawBackbone(-1, true, glow);
    drawBackbone(1, true, glow);

    drawBases(true, glow);

    /* floating base particles + bound-pair bonds */
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      // hydrogen bond of a bound pair (draw once per pair)
      if (p.partner && particles.indexOf(p.partner) > i) {
        const q = p.partner;
        const n = Math.min(H_BONDS[p.char], H_BONDS[q.char]);
        ctx.save();
        ctx.strokeStyle = 'rgba(148,163,184,0.55)';
        ctx.lineWidth = 1.1;
        ctx.setLineDash([3, 3]);
        const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2;
        const dx = q.x - p.x, dy = q.y - p.y;
        const len = Math.hypot(dx, dy) || 1;
        for (let b = 0; b < n; b++) {
          const off = (b - (n - 1) / 2) * 5; // perpendicular offset
          ctx.beginPath();
          ctx.moveTo(p.x + (-dy / len) * off, p.y + (dx / len) * off);
          ctx.lineTo(q.x + (-dy / len) * off, q.y + (dx / len) * off);
          ctx.stroke();
        }
        ctx.restore();
        // pairing flash ring at the pair midpoint
        const fl = Math.max(p.pairFlash, q.pairFlash);
        if (fl > 0) {
          ctx.save();
          ctx.globalAlpha = fl * 0.7;
          ctx.strokeStyle = '#7dd3fc';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.arc(mx, my, 12 + (1 - fl) * 26, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }
      drawBaseChar(p.char, p.x, p.y, p.size, p.alpha, false);
      // highlight link when attracted by the cursor
      if (mouse.active && !p.flying && !p.partner) {
        const d = Math.hypot(mouse.x - p.x, mouse.y - p.y);
        if (d < (cfg.attractRadius ?? 170)) {
          ctx.save();
          ctx.globalAlpha = (1 - d / (cfg.attractRadius ?? 170)) * 0.35;
          ctx.strokeStyle = COLOR[p.char];
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    /* full-repair glow overlay */
    if (glow) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = glowT * 0.5;
      const g = ctx.createRadialGradient(dnaX, H / 2, 0, dnaX, H / 2, Math.max(W, H) * 0.35);
      g.addColorStop(0, 'rgba(56,189,248,0.35)');
      g.addColorStop(1, 'rgba(56,189,248,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    /* cursor attraction halo */
    if (mouse.active) {
      ctx.save();
      const R = cfg.attractRadius ?? 170;
      const rg = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, R);
      rg.addColorStop(0, 'rgba(125,211,252,0.10)');
      rg.addColorStop(1, 'rgba(125,211,252,0)');
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.arc(mouse.x, mouse.y, R, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(125,211,252,0.18)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(mouse.x, mouse.y, R * (0.94 + 0.05 * Math.sin(time * 3)), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  /* ---------- main loop ---------- */
  let last = performance.now();
  function frame(now) {
    if (!running) { last = now; requestAnimationFrame(frame); return; }
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    time += dt;
    spiralPhase += dt * (cfg.rotSpeed ?? 0.45);

    const allFixed = rungs.every(r => r.repaired);
    if (allFixed) {
      glowHold += dt;
      glowT = Math.min(1, glowT + dt * 2);
      if (glowHold > 2.8) {
        // reset: decay again, particles fade back in
        buildDNA();
        resetParticles();
        particles.forEach(p => { p.fade = true; p.alpha = 0; });
        glowHold = 0; glowT = 0;
      }
    } else {
      glowT = Math.max(0, glowT - dt);
    }

    tryRepair(dt);
    updateRepair(dt);
    updatePairing(dt);
    updateParticles(dt);
    draw();
    requestAnimationFrame(frame);
  }

  /* ---------- events ---------- */
  function onResize() {
    dpr = window.devicePixelRatio || 1;
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildDNA();
    resetParticles();
  }
  window.addEventListener('resize', onResize);
  window.addEventListener('pointermove', (e) => {
    mouse.x = e.clientX; mouse.y = e.clientY; mouse.active = true;
  });
  window.addEventListener('pointerleave', () => { mouse.active = false; mouse.x = -9999; mouse.y = -9999; });
  document.addEventListener('visibilitychange', () => { running = !document.hidden; });

  /* ---------- boot ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    onResize();
    requestAnimationFrame(frame);
  });
})();
