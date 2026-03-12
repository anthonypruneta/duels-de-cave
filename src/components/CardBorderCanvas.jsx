import React, { useRef, useEffect, useCallback } from 'react';

const DPR = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;

function rand(min, max) { return Math.random() * (max - min) + min; }
function randInt(min, max) { return Math.floor(rand(min, max + 1)); }
function lerp(a, b, t) { return a + (b - a) * t; }
function hsl(h, s, l, a = 1) { return `hsla(${h},${s}%,${l}%,${a})`; }

// ─── Lave : cascade de lave sur les côtés ────────────────────────────────────

function initLava(w, h) {
  const particles = [];
  for (let i = 0; i < 40; i++) {
    particles.push(spawnLava(w, h, true));
  }
  return { particles, embers: Array.from({ length: 15 }, () => spawnEmber(w, h, true)) };
}

function spawnLava(w, h, randomY = false) {
  const side = Math.random() < 0.5 ? 0 : 1;
  return {
    x: side === 0 ? rand(-2, 6) : rand(w - 6, w + 2),
    y: randomY ? rand(-10, h) : rand(-20, -5),
    vy: rand(0.3, 0.9),
    vx: side === 0 ? rand(-0.1, 0.3) : rand(-0.3, 0.1),
    r: rand(2, 5),
    life: 1,
    hue: rand(10, 40),
    side,
  };
}

function spawnEmber(w, h, randomY = false) {
  const side = Math.random() < 0.5 ? 0 : 1;
  return {
    x: side === 0 ? rand(0, 15) : rand(w - 15, w),
    y: randomY ? rand(0, h) : rand(h * 0.5, h),
    vy: rand(-0.5, -1.5),
    vx: rand(-0.3, 0.3),
    r: rand(1, 2.5),
    life: 1,
    decay: rand(0.005, 0.015),
  };
}

function updateLava(state, w, h, dt) {
  const s = dt / 16;
  for (let i = 0; i < state.particles.length; i++) {
    const p = state.particles[i];
    p.y += p.vy * s;
    p.x += p.vx * s;
    if (p.y > h + 10) Object.assign(p, spawnLava(w, h));
  }
  for (let i = 0; i < state.embers.length; i++) {
    const e = state.embers[i];
    e.y += e.vy * s;
    e.x += e.vx * s;
    e.life -= e.decay * s;
    if (e.life <= 0 || e.y < -10) Object.assign(e, spawnEmber(w, h));
  }
}

function drawLava(ctx, state, w, h) {
  for (const p of state.particles) {
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 2);
    g.addColorStop(0, hsl(p.hue, 100, 60, 0.9));
    g.addColorStop(0.5, hsl(p.hue - 10, 100, 45, 0.5));
    g.addColorStop(1, hsl(p.hue - 20, 100, 30, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * 2, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const e of state.embers) {
    ctx.globalAlpha = e.life;
    ctx.fillStyle = hsl(30, 100, 70, e.life);
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ─── Givre : vent glacé horizontal ───────────────────────────────────────────

function initIce(w, h) {
  return {
    particles: Array.from({ length: 35 }, () => spawnIce(w, h, true)),
    streaks: Array.from({ length: 8 }, () => spawnIceStreak(w, h, true)),
  };
}

function spawnIce(w, h, randomX = false) {
  return {
    x: randomX ? rand(0, w) : rand(-20, -5),
    y: rand(0, h),
    vx: rand(0.5, 1.8),
    vy: rand(-0.2, 0.2),
    r: rand(1, 3),
    life: 1,
    decay: rand(0.003, 0.008),
    twinkle: rand(0, Math.PI * 2),
  };
}

function spawnIceStreak(w, h, randomX = false) {
  return {
    x: randomX ? rand(0, w) : rand(-50, -10),
    y: rand(0, h),
    len: rand(20, 50),
    vx: rand(1.5, 3),
    alpha: rand(0.05, 0.15),
  };
}

function updateIce(state, w, h, dt) {
  const s = dt / 16;
  for (const p of state.particles) {
    p.x += p.vx * s;
    p.y += p.vy * s;
    p.twinkle += 0.05 * s;
    p.life -= p.decay * s;
    if (p.x > w + 10 || p.life <= 0) Object.assign(p, spawnIce(w, h));
  }
  for (const st of state.streaks) {
    st.x += st.vx * s;
    if (st.x > w + 60) Object.assign(st, spawnIceStreak(w, h));
  }
}

function drawIce(ctx, state) {
  for (const st of state.streaks) {
    ctx.strokeStyle = `rgba(103, 232, 249, ${st.alpha})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(st.x, st.y);
    ctx.lineTo(st.x - st.len, st.y + 2);
    ctx.stroke();
  }
  for (const p of state.particles) {
    const a = p.life * (0.5 + 0.5 * Math.sin(p.twinkle));
    ctx.fillStyle = `rgba(186, 230, 253, ${a})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
    if (p.r > 2) {
      ctx.fillStyle = `rgba(255, 255, 255, ${a * 0.6})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ─── Ombre : brume noir/violet depuis le bas ─────────────────────────────────

function initShadow(w, h) {
  return {
    clouds: Array.from({ length: 20 }, () => spawnShadowCloud(w, h, true)),
    wisps: Array.from({ length: 12 }, () => spawnWisp(w, h, true)),
  };
}

function spawnShadowCloud(w, h, randomY = false) {
  return {
    x: rand(0, w),
    y: randomY ? rand(h * 0.5, h + 20) : rand(h, h + 30),
    r: rand(15, 35),
    vy: rand(-0.15, -0.4),
    vx: rand(-0.2, 0.2),
    alpha: rand(0.1, 0.25),
    hue: rand(260, 290),
  };
}

function spawnWisp(w, h, randomY = false) {
  return {
    x: rand(0, w),
    y: randomY ? rand(h * 0.6, h) : h + 5,
    vy: rand(-0.3, -0.8),
    vx: rand(-0.15, 0.15),
    alpha: rand(0.15, 0.35),
    r: rand(2, 4),
    life: 1,
    decay: rand(0.004, 0.01),
  };
}

function updateShadow(state, w, h, dt) {
  const s = dt / 16;
  for (const c of state.clouds) {
    c.y += c.vy * s;
    c.x += c.vx * s;
    if (c.y < h * 0.2 - c.r) Object.assign(c, spawnShadowCloud(w, h));
  }
  for (const wp of state.wisps) {
    wp.y += wp.vy * s;
    wp.x += wp.vx * s;
    wp.life -= wp.decay * s;
    if (wp.life <= 0 || wp.y < h * 0.2) Object.assign(wp, spawnWisp(w, h));
  }
}

function drawShadow(ctx, state, w, h) {
  const grad = ctx.createLinearGradient(0, h, 0, h * 0.5);
  grad.addColorStop(0, 'rgba(30, 0, 50, 0.25)');
  grad.addColorStop(1, 'rgba(30, 0, 50, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, h * 0.5, w, h * 0.5);

  for (const c of state.clouds) {
    const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r);
    g.addColorStop(0, hsl(c.hue, 60, 15, c.alpha));
    g.addColorStop(1, hsl(c.hue, 60, 10, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const wp of state.wisps) {
    ctx.fillStyle = hsl(275, 70, 40, wp.alpha * wp.life);
    ctx.beginPath();
    ctx.arc(wp.x, wp.y, wp.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ─── Or : scintillements dorés aléatoires ────────────────────────────────────

function initGold(w, h) {
  return { sparkles: Array.from({ length: 20 }, () => spawnGold(w, h)) };
}

function spawnGold(w, h) {
  return {
    x: rand(5, w - 5),
    y: rand(5, h - 5),
    life: 0,
    maxLife: rand(40, 80),
    size: rand(2, 5),
    delay: rand(0, 120),
    hue: rand(38, 50),
  };
}

function updateGold(state, w, h, dt) {
  const s = dt / 16;
  for (const sp of state.sparkles) {
    if (sp.delay > 0) { sp.delay -= s; continue; }
    sp.life += s;
    if (sp.life > sp.maxLife) Object.assign(sp, spawnGold(w, h));
  }
}

function drawGold(ctx, state) {
  for (const sp of state.sparkles) {
    if (sp.delay > 0) continue;
    const t = sp.life / sp.maxLife;
    const alpha = t < 0.3 ? t / 0.3 : t < 0.7 ? 1 : (1 - t) / 0.3;
    drawStar(ctx, sp.x, sp.y, sp.size, 4, hsl(sp.hue, 100, 65, alpha * 0.9));
    const g = ctx.createRadialGradient(sp.x, sp.y, 0, sp.x, sp.y, sp.size * 2.5);
    g.addColorStop(0, hsl(sp.hue, 100, 70, alpha * 0.3));
    g.addColorStop(1, hsl(sp.hue, 100, 50, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, sp.size * 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawStar(ctx, cx, cy, r, points, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const angle = (i * Math.PI) / points - Math.PI / 2;
    const dist = i % 2 === 0 ? r : r * 0.35;
    const x = cx + Math.cos(angle) * dist;
    const y = cy + Math.sin(angle) * dist;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

// ─── Territoire : effet magique pulsant bleu/rouge/violet ────────────────────

function initTerritory(w, h) {
  return {
    orbs: Array.from({ length: 10 }, () => spawnOrb(w, h)),
    pulseTime: 0,
  };
}

function spawnOrb(w, h) {
  return {
    x: rand(10, w - 10),
    y: rand(10, h - 10),
    r: rand(3, 7),
    phase: rand(0, Math.PI * 2),
    speed: rand(0.02, 0.06),
    colorIdx: randInt(0, 2),
    life: rand(60, 150),
    maxLife: 0,
    alpha: 0,
  };
}

const TERR_COLORS = [
  [220, 80, 60],
  [0, 80, 55],
  [275, 80, 55],
];

function updateTerritory(state, w, h, dt) {
  const s = dt / 16;
  state.pulseTime += 0.03 * s;
  for (const o of state.orbs) {
    o.phase += o.speed * s;
    o.maxLife += s;
    const t = o.maxLife / o.life;
    o.alpha = t < 0.2 ? t / 0.2 : t < 0.7 ? 1 : Math.max(0, (1 - t) / 0.3);
    if (o.maxLife > o.life) Object.assign(o, spawnOrb(w, h));
  }
}

function drawTerritory(ctx, state) {
  for (const o of state.orbs) {
    if (o.alpha <= 0) continue;
    const pulse = 1 + 0.3 * Math.sin(o.phase);
    const r = o.r * pulse;
    const [ch, cs, cl] = TERR_COLORS[o.colorIdx];
    const g = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, r * 2.5);
    g.addColorStop(0, hsl(ch, cs, cl, o.alpha * 0.7));
    g.addColorStop(0.5, hsl(ch, cs, cl, o.alpha * 0.2));
    g.addColorStop(1, hsl(ch, cs, cl, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(o.x, o.y, r * 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = hsl(ch, cs, cl + 15, o.alpha * 0.5);
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.arc(o.x, o.y, r * 1.8, 0, Math.PI * 2);
    ctx.stroke();
  }
}

// ─── Sang : gouttes de sang qui perlent ──────────────────────────────────────

function initBlood(w, h) {
  return {
    drops: Array.from({ length: 18 }, () => spawnDrop(w, h, true)),
    trails: [],
  };
}

function spawnDrop(w, h, randomY = false) {
  return {
    x: rand(3, w - 3),
    y: randomY ? rand(-10, h * 0.8) : rand(-20, -5),
    vy: rand(0.2, 0.6),
    r: rand(1.5, 3.5),
    streakLen: 0,
    maxStreak: rand(10, 30),
  };
}

function updateBlood(state, w, h, dt) {
  const s = dt / 16;
  for (const d of state.drops) {
    d.y += d.vy * s;
    d.streakLen = Math.min(d.streakLen + d.vy * s * 0.8, d.maxStreak);
    if (d.y > h + 10) Object.assign(d, spawnDrop(w, h));
  }
}

function drawBlood(ctx, state) {
  for (const d of state.drops) {
    if (d.streakLen > 1) {
      const g = ctx.createLinearGradient(d.x, d.y - d.streakLen, d.x, d.y);
      g.addColorStop(0, 'rgba(127, 29, 29, 0)');
      g.addColorStop(1, 'rgba(185, 28, 28, 0.6)');
      ctx.strokeStyle = g;
      ctx.lineWidth = d.r * 0.8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(d.x, d.y - d.streakLen);
      ctx.lineTo(d.x, d.y);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(220, 38, 38, 0.85)';
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(248, 113, 113, 0.4)';
    ctx.beginPath();
    ctx.arc(d.x - d.r * 0.3, d.y - d.r * 0.3, d.r * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ─── Nature : feuilles qui tombent ───────────────────────────────────────────

function initNature(w, h) {
  return { leaves: Array.from({ length: 18 }, () => spawnLeaf(w, h, true)) };
}

function spawnLeaf(w, h, randomY = false) {
  return {
    x: rand(0, w),
    y: randomY ? rand(-10, h) : rand(-30, -5),
    vy: rand(0.3, 0.7),
    vx: rand(-0.15, 0.15),
    angle: rand(0, Math.PI * 2),
    rotSpeed: rand(0.01, 0.04) * (Math.random() < 0.5 ? 1 : -1),
    swayPhase: rand(0, Math.PI * 2),
    swayAmp: rand(0.3, 0.8),
    size: rand(3, 6),
    hue: rand(130, 160),
    lightness: rand(35, 50),
  };
}

function updateNature(state, w, h, dt) {
  const s = dt / 16;
  for (const l of state.leaves) {
    l.y += l.vy * s;
    l.swayPhase += 0.03 * s;
    l.x += (l.vx + Math.sin(l.swayPhase) * l.swayAmp) * s;
    l.angle += l.rotSpeed * s;
    if (l.y > h + 10 || l.x < -20 || l.x > w + 20) Object.assign(l, spawnLeaf(w, h));
  }
}

function drawNature(ctx, state) {
  for (const l of state.leaves) {
    ctx.save();
    ctx.translate(l.x, l.y);
    ctx.rotate(l.angle);
    ctx.fillStyle = hsl(l.hue, 70, l.lightness, 0.8);
    ctx.beginPath();
    ctx.ellipse(0, 0, l.size, l.size * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = hsl(l.hue, 60, l.lightness - 10, 0.5);
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(-l.size * 0.7, 0);
    ctx.lineTo(l.size * 0.7, 0);
    ctx.stroke();
    ctx.restore();
  }
}

// ─── Titane : reflet métallique + étincelles ─────────────────────────────────

function initTitane(w, h) {
  return {
    sweepX: -w * 0.3,
    sparks: Array.from({ length: 12 }, () => spawnSpark(w, h)),
  };
}

function spawnSpark(w, h) {
  return {
    x: rand(0, w),
    y: rand(0, h),
    life: 0,
    maxLife: rand(20, 50),
    delay: rand(0, 80),
    size: rand(1, 2.5),
  };
}

function updateTitane(state, w, h, dt) {
  const s = dt / 16;
  state.sweepX += 0.8 * s;
  if (state.sweepX > w * 1.3) state.sweepX = -w * 0.3;
  for (const sp of state.sparks) {
    if (sp.delay > 0) { sp.delay -= s; continue; }
    sp.life += s;
    if (sp.life > sp.maxLife) Object.assign(sp, spawnSpark(w, h));
  }
}

function drawTitane(ctx, state, w, h) {
  const sw = w * 0.15;
  const g = ctx.createLinearGradient(state.sweepX - sw, 0, state.sweepX + sw, 0);
  g.addColorStop(0, 'rgba(203, 213, 225, 0)');
  g.addColorStop(0.4, 'rgba(226, 232, 240, 0.12)');
  g.addColorStop(0.5, 'rgba(241, 245, 249, 0.2)');
  g.addColorStop(0.6, 'rgba(226, 232, 240, 0.12)');
  g.addColorStop(1, 'rgba(203, 213, 225, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  for (const sp of state.sparks) {
    if (sp.delay > 0) continue;
    const t = sp.life / sp.maxLife;
    const alpha = t < 0.3 ? t / 0.3 : (1 - t) / 0.7;
    ctx.fillStyle = `rgba(226, 232, 240, ${alpha * 0.8})`;
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, sp.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ─── Cosmique : étoiles + nébuleuse ──────────────────────────────────────────

function initCosmic(w, h) {
  return {
    stars: Array.from({ length: 30 }, () => ({
      x: rand(0, w), y: rand(0, h),
      r: rand(0.5, 2),
      twinkle: rand(0, Math.PI * 2),
      speed: rand(0.03, 0.08),
      brightness: rand(0.4, 1),
    })),
    nebulae: Array.from({ length: 4 }, () => ({
      x: rand(w * 0.1, w * 0.9),
      y: rand(h * 0.1, h * 0.9),
      r: rand(30, 60),
      hue: rand(250, 290),
      phase: rand(0, Math.PI * 2),
    })),
    shootingStar: null,
    shootTimer: rand(100, 250),
  };
}

function updateCosmic(state, w, h, dt) {
  const s = dt / 16;
  for (const st of state.stars) st.twinkle += st.speed * s;
  for (const n of state.nebulae) n.phase += 0.01 * s;

  state.shootTimer -= s;
  if (state.shootTimer <= 0 && !state.shootingStar) {
    state.shootingStar = {
      x: rand(0, w * 0.5), y: rand(0, h * 0.3),
      vx: rand(2, 4), vy: rand(1, 2.5),
      life: 1, len: rand(15, 30),
    };
    state.shootTimer = rand(120, 300);
  }
  if (state.shootingStar) {
    const ss = state.shootingStar;
    ss.x += ss.vx * s;
    ss.y += ss.vy * s;
    ss.life -= 0.02 * s;
    if (ss.life <= 0 || ss.x > w || ss.y > h) state.shootingStar = null;
  }
}

function drawCosmic(ctx, state, w, h) {
  for (const n of state.nebulae) {
    const alpha = 0.06 + 0.03 * Math.sin(n.phase);
    const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
    g.addColorStop(0, hsl(n.hue, 80, 40, alpha));
    g.addColorStop(1, hsl(n.hue, 80, 20, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const st of state.stars) {
    const a = st.brightness * (0.4 + 0.6 * Math.abs(Math.sin(st.twinkle)));
    ctx.fillStyle = `rgba(255, 255, 255, ${a})`;
    ctx.beginPath();
    ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
    ctx.fill();
  }
  if (state.shootingStar) {
    const ss = state.shootingStar;
    const g = ctx.createLinearGradient(
      ss.x, ss.y,
      ss.x - ss.vx * ss.len * 0.3, ss.y - ss.vy * ss.len * 0.3
    );
    g.addColorStop(0, `rgba(255, 255, 255, ${ss.life})`);
    g.addColorStop(1, `rgba(168, 85, 247, 0)`);
    ctx.strokeStyle = g;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(ss.x, ss.y);
    ctx.lineTo(ss.x - ss.vx * ss.len * 0.3, ss.y - ss.vy * ss.len * 0.3);
    ctx.stroke();
  }
}

// ─── Transcendance : prismes / diamants iridescents ──────────────────────────

function initTranscendance(w, h) {
  return {
    prisms: Array.from({ length: 14 }, () => spawnPrism(w, h)),
    beams: Array.from({ length: 5 }, () => spawnBeam(w, h)),
  };
}

function spawnPrism(w, h) {
  return {
    x: rand(5, w - 5), y: rand(5, h - 5),
    angle: rand(0, Math.PI * 2),
    rotSpeed: rand(0.01, 0.04),
    size: rand(3, 6),
    life: 0, maxLife: rand(60, 130),
    delay: rand(0, 80),
    hueOffset: rand(0, 360),
  };
}

function spawnBeam(w, h) {
  return {
    x: rand(0, w), angle: rand(-0.3, 0.3),
    width: rand(1, 3), alpha: 0,
    life: 0, maxLife: rand(40, 80), delay: rand(0, 100),
    hue: rand(0, 360),
  };
}

function updateTranscendance(state, w, h, dt) {
  const s = dt / 16;
  for (const p of state.prisms) {
    if (p.delay > 0) { p.delay -= s; continue; }
    p.angle += p.rotSpeed * s;
    p.life += s;
    p.hueOffset += 1.5 * s;
    if (p.life > p.maxLife) Object.assign(p, spawnPrism(w, h));
  }
  for (const b of state.beams) {
    if (b.delay > 0) { b.delay -= s; continue; }
    b.life += s;
    b.hue += 2 * s;
    const t = b.life / b.maxLife;
    b.alpha = t < 0.2 ? t / 0.2 * 0.08 : t < 0.7 ? 0.08 : (1 - t) / 0.3 * 0.08;
    if (b.life > b.maxLife) Object.assign(b, spawnBeam(w, h));
  }
}

function drawTranscendance(ctx, state, w, h) {
  for (const b of state.beams) {
    if (b.delay > 0 || b.alpha <= 0) continue;
    ctx.save();
    ctx.translate(b.x, 0);
    ctx.rotate(b.angle);
    ctx.fillStyle = hsl(b.hue % 360, 80, 70, b.alpha);
    ctx.fillRect(-b.width / 2, 0, b.width, h);
    ctx.restore();
  }
  for (const p of state.prisms) {
    if (p.delay > 0) continue;
    const t = p.life / p.maxLife;
    const alpha = t < 0.2 ? t / 0.2 : t < 0.7 ? 1 : (1 - t) / 0.3;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    const hue = p.hueOffset % 360;

    ctx.fillStyle = hsl(hue, 70, 70, alpha * 0.6);
    ctx.beginPath();
    ctx.moveTo(0, -p.size);
    ctx.lineTo(p.size * 0.6, 0);
    ctx.lineTo(0, p.size);
    ctx.lineTo(-p.size * 0.6, 0);
    ctx.closePath();
    ctx.fill();

    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, p.size * 2);
    glow.addColorStop(0, hsl(hue, 80, 80, alpha * 0.25));
    glow.addColorStop(1, hsl(hue, 80, 60, 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, p.size * 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

// ─── Champion : particules rainbow + étoiles dorées ──────────────────────────

function initChampion(w, h) {
  return {
    particles: Array.from({ length: 25 }, () => spawnChampionParticle(w, h)),
    stars: Array.from({ length: 8 }, () => spawnChampionStar(w, h)),
  };
}

function spawnChampionParticle(w, h) {
  const edge = randInt(0, 3);
  let x, y, vx, vy;
  if (edge === 0) { x = rand(0, w); y = -3; vx = rand(-0.3, 0.3); vy = rand(0.3, 0.7); }
  else if (edge === 1) { x = rand(0, w); y = h + 3; vx = rand(-0.3, 0.3); vy = rand(-0.7, -0.3); }
  else if (edge === 2) { x = -3; y = rand(0, h); vx = rand(0.3, 0.7); vy = rand(-0.3, 0.3); }
  else { x = w + 3; y = rand(0, h); vx = rand(-0.7, -0.3); vy = rand(-0.3, 0.3); }
  return {
    x, y, vx, vy,
    hue: rand(0, 360), hueSpeed: rand(1, 4),
    r: rand(1.5, 3), life: 1, decay: rand(0.005, 0.012),
  };
}

function spawnChampionStar(w, h) {
  return {
    x: rand(10, w - 10), y: rand(10, h - 10),
    size: rand(3, 6), life: 0, maxLife: rand(50, 100),
    delay: rand(0, 100), rotation: rand(0, Math.PI),
  };
}

function updateChampion(state, w, h, dt) {
  const s = dt / 16;
  for (const p of state.particles) {
    p.x += p.vx * s;
    p.y += p.vy * s;
    p.hue += p.hueSpeed * s;
    p.life -= p.decay * s;
    if (p.life <= 0 || p.x < -10 || p.x > w + 10 || p.y < -10 || p.y > h + 10) {
      Object.assign(p, spawnChampionParticle(w, h));
    }
  }
  for (const st of state.stars) {
    if (st.delay > 0) { st.delay -= s; continue; }
    st.life += s;
    st.rotation += 0.02 * s;
    if (st.life > st.maxLife) Object.assign(st, spawnChampionStar(w, h));
  }
}

function drawChampion(ctx, state) {
  for (const p of state.particles) {
    ctx.fillStyle = hsl(p.hue % 360, 90, 60, p.life * 0.7);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const st of state.stars) {
    if (st.delay > 0) continue;
    const t = st.life / st.maxLife;
    const alpha = t < 0.3 ? t / 0.3 : (1 - t) / 0.7;
    ctx.save();
    ctx.translate(st.x, st.y);
    ctx.rotate(st.rotation);
    drawStar(ctx, 0, 0, st.size, 4, hsl(45, 100, 60, alpha * 0.8));
    ctx.restore();
  }
}

// ─── Registre des effets ─────────────────────────────────────────────────────

const EFFECTS = {
  lava:           { init: initLava, update: updateLava, draw: drawLava },
  ice:            { init: initIce, update: updateIce, draw: drawIce },
  shadow:         { init: initShadow, update: updateShadow, draw: drawShadow },
  gold:           { init: initGold, update: updateGold, draw: drawGold },
  territory:      { init: initTerritory, update: updateTerritory, draw: drawTerritory },
  blood:          { init: initBlood, update: updateBlood, draw: drawBlood },
  nature:         { init: initNature, update: updateNature, draw: drawNature },
  titane:         { init: initTitane, update: updateTitane, draw: drawTitane },
  cosmique:       { init: initCosmic, update: updateCosmic, draw: drawCosmic },
  transcendance:  { init: initTranscendance, update: updateTranscendance, draw: drawTranscendance },
  champion:       { init: initChampion, update: updateChampion, draw: drawChampion },
};

// ─── Composant React ─────────────────────────────────────────────────────────

const CardBorderCanvas = React.memo(function CardBorderCanvas({ borderId }) {
  const canvasRef = useRef(null);
  const stateRef = useRef(null);
  const rafRef = useRef(null);
  const lastTimeRef = useRef(0);
  const visibleRef = useRef(true);
  const sizeRef = useRef({ w: 0, h: 0 });

  const effect = EFFECTS[borderId];

  const animate = useCallback((time) => {
    if (!visibleRef.current || !stateRef.current) {
      rafRef.current = requestAnimationFrame(animate);
      return;
    }

    const dt = lastTimeRef.current ? Math.min(time - lastTimeRef.current, 50) : 16;
    lastTimeRef.current = time;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { w, h } = sizeRef.current;
    if (w === 0 || h === 0) { rafRef.current = requestAnimationFrame(animate); return; }

    ctx.clearRect(0, 0, w * DPR, h * DPR);
    ctx.save();
    ctx.scale(DPR, DPR);

    effect.update(stateRef.current, w, h, dt);
    effect.draw(ctx, stateRef.current, w, h);

    ctx.restore();
    rafRef.current = requestAnimationFrame(animate);
  }, [effect]);

  useEffect(() => {
    if (!effect) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const resize = () => {
      const rect = parent.getBoundingClientRect();
      const w = Math.round(rect.width);
      const h = Math.round(rect.height);
      sizeRef.current = { w, h };
      canvas.width = w * DPR;
      canvas.height = h * DPR;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      stateRef.current = effect.init(w, h);
    };

    const ro = new ResizeObserver(resize);
    ro.observe(parent);

    const io = new IntersectionObserver(([entry]) => {
      visibleRef.current = entry.isIntersecting;
    }, { threshold: 0 });
    io.observe(parent);

    resize();
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      ro.disconnect();
      io.disconnect();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [effect, animate]);

  if (!effect) return null;

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0, left: 0,
        width: '100%', height: '100%',
        pointerEvents: 'none',
        zIndex: 2,
      }}
    />
  );
});

export default CardBorderCanvas;
