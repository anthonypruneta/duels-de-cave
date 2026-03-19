import React, { useRef, useEffect, useCallback } from 'react';

const DPR = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;

function rand(min, max) { return Math.random() * (max - min) + min; }
function randInt(min, max) { return Math.floor(rand(min, max + 1)); }
function lerp(a, b, t) { return a + (b - a) * t; }
function hsl(h, s, l, a = 1) { return `hsla(${h},${s}%,${l}%,${a})`; }

// ─── Lave : cascades continues sur les côtés + bassin en bas + étincelles ────

function initLava(w, h) {
  const STREAM_W = 12;
  const streamLeft = [];
  const streamRight = [];
  for (let i = 0; i < 50; i++) {
    streamLeft.push(spawnStream(0, STREAM_W, h, true));
    streamRight.push(spawnStream(w - STREAM_W, STREAM_W, h, true));
  }
  return {
    streamLeft, streamRight, STREAM_W,
    poolPhase: 0,
    embers: Array.from({ length: 20 }, () => spawnPoolEmber(w, h)),
    poolBubbles: Array.from({ length: 10 }, () => spawnBubble(w, h)),
  };
}

function spawnStream(xBase, streamW, h, randomY = false) {
  return {
    x: rand(xBase, xBase + streamW),
    y: randomY ? rand(-10, h) : rand(-25, -5),
    vy: rand(1.0, 2.2),
    vx: rand(-0.15, 0.15),
    r: rand(2.5, 5.5),
    hue: rand(8, 42),
    bright: rand(50, 65),
  };
}

function spawnPoolEmber(w, h) {
  return {
    x: rand(5, w - 5),
    y: h,
    vy: rand(-1.2, -3.0),
    vx: rand(-0.6, 0.6),
    r: rand(1, 3),
    life: 1,
    decay: rand(0.012, 0.025),
    hue: rand(15, 45),
  };
}

function spawnBubble(w, h) {
  const poolH = h * 0.08;
  return {
    x: rand(5, w - 5),
    y: rand(h - poolH, h),
    r: rand(1.5, 4),
    phase: rand(0, Math.PI * 2),
    speed: rand(0.04, 0.1),
    alpha: rand(0.3, 0.7),
  };
}

function updateLava(state, w, h, dt) {
  const s = dt / 16;
  state.poolPhase += 0.025 * s;

  for (const p of state.streamLeft) {
    p.y += p.vy * s;
    p.x += p.vx * s;
    if (p.y > h + 5) Object.assign(p, spawnStream(0, state.STREAM_W, h));
  }
  for (const p of state.streamRight) {
    p.y += p.vy * s;
    p.x += p.vx * s;
    if (p.y > h + 5) Object.assign(p, spawnStream(w - state.STREAM_W, state.STREAM_W, h));
  }
  for (const e of state.embers) {
    e.y += e.vy * s;
    e.x += e.vx * s;
    e.vy += 0.03 * s;
    e.life -= e.decay * s;
    if (e.life <= 0 || e.y < -10) Object.assign(e, spawnPoolEmber(w, h));
  }
  for (const b of state.poolBubbles) {
    b.phase += b.speed * s;
    b.alpha = 0.3 + 0.3 * Math.sin(b.phase);
    if (b.phase > Math.PI * 6) Object.assign(b, spawnBubble(w, h));
  }
}

function drawLava(ctx, state, w, h) {
  const poolH = h * 0.08;
  const SW = state.STREAM_W;

  // Lueur latérale continue (fond des cascades)
  for (const side of [0, w - SW]) {
    const g = ctx.createLinearGradient(side, 0, side + SW * 2.5, 0);
    if (side === 0) {
      g.addColorStop(0, 'rgba(239, 68, 68, 0.35)');
      g.addColorStop(0.4, 'rgba(249, 115, 22, 0.15)');
      g.addColorStop(1, 'rgba(249, 115, 22, 0)');
    } else {
      g.addColorStop(0, 'rgba(249, 115, 22, 0)');
      g.addColorStop(0.6, 'rgba(249, 115, 22, 0.15)');
      g.addColorStop(1, 'rgba(239, 68, 68, 0.35)');
    }
    ctx.fillStyle = g;
    ctx.fillRect(side === 0 ? 0 : w - SW * 2.5, 0, SW * 2.5, h);
  }

  // Particules des cascades
  const drawStream = (particles) => {
    for (const p of particles) {
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 1.8);
      g.addColorStop(0, hsl(p.hue, 100, p.bright, 0.9));
      g.addColorStop(0.5, hsl(p.hue - 5, 100, p.bright - 15, 0.55));
      g.addColorStop(1, hsl(p.hue - 10, 100, 30, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  drawStream(state.streamLeft);
  drawStream(state.streamRight);

  // Bassin de lave en bas avec ondulation
  const poolG = ctx.createLinearGradient(0, h - poolH * 1.5, 0, h);
  poolG.addColorStop(0, 'rgba(180, 30, 0, 0)');
  poolG.addColorStop(0.3, 'rgba(220, 50, 10, 0.25)');
  poolG.addColorStop(0.7, 'rgba(249, 115, 22, 0.55)');
  poolG.addColorStop(1, 'rgba(234, 88, 12, 0.7)');
  ctx.fillStyle = poolG;
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let x = 0; x <= w; x += 4) {
    const wave = Math.sin(state.poolPhase + x * 0.04) * 3 + Math.sin(state.poolPhase * 1.7 + x * 0.07) * 2;
    ctx.lineTo(x, h - poolH + wave);
  }
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();

  // Bulles dans le bassin
  for (const b of state.poolBubbles) {
    ctx.fillStyle = hsl(25, 100, 65, b.alpha * 0.5);
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Étincelles qui sautent depuis le bassin
  for (const e of state.embers) {
    if (e.life <= 0) continue;
    ctx.fillStyle = hsl(e.hue, 100, 75, e.life);
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r * e.life, 0, Math.PI * 2);
    ctx.fill();
    const glowR = e.r * 3 * e.life;
    const eg = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, glowR);
    eg.addColorStop(0, hsl(e.hue, 100, 70, e.life * 0.3));
    eg.addColorStop(1, hsl(e.hue, 100, 50, 0));
    ctx.fillStyle = eg;
    ctx.beginPath();
    ctx.arc(e.x, e.y, glowR, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ─── Givre : vent glacé + failles de glacier depuis les bords ─────────────────

function buildFissure(ox, oy, baseAngle, maxLen, depth) {
  const segments = [];
  let x = ox, y = oy, angle = baseAngle;
  const segCount = randInt(6, 12);
  const segLen = maxLen / segCount;
  for (let i = 0; i < segCount; i++) {
    angle += rand(-0.4, 0.4);
    const len = segLen * rand(0.6, 1.4);
    const nx = x + Math.cos(angle) * len;
    const ny = y + Math.sin(angle) * len;
    const width = lerp(2.5, 0.3, i / segCount) * (depth === 0 ? 1 : 0.5);
    segments.push({ x1: x, y1: y, x2: nx, y2: ny, width, t: i / segCount });
    if (depth < 2 && i > 1 && Math.random() < 0.4) {
      const branchAngle = angle + rand(-1.0, 1.0);
      const branchLen = (maxLen - i * segLen) * rand(0.25, 0.55);
      const sub = buildFissure(x, y, branchAngle, branchLen, depth + 1);
      segments.push(...sub);
    }
    x = nx;
    y = ny;
  }
  return segments;
}

function initIceFissures(w, h) {
  const fissures = [];
  const minDim = Math.min(w, h);
  const reach = minDim * rand(0.45, 0.7);
  const edgeSpawns = [
    { x: rand(w * 0.05, w * 0.35), y: 0, aMin: 0.3, aMax: 1.3 },
    { x: rand(w * 0.65, w * 0.95), y: 0, aMin: 1.8, aMax: 2.8 },
    { x: 0, y: rand(h * 0.1, h * 0.4), aMin: -0.4, aMax: 0.5 },
    { x: w, y: rand(h * 0.1, h * 0.4), aMin: 2.6, aMax: 3.5 },
    { x: rand(w * 0.15, w * 0.45), y: h, aMin: -1.3, aMax: -0.3 },
    { x: rand(w * 0.55, w * 0.85), y: h, aMin: -2.8, aMax: -1.8 },
    { x: 0, y: rand(h * 0.6, h * 0.9), aMin: -0.5, aMax: 0.4 },
    { x: w, y: rand(h * 0.6, h * 0.9), aMin: 2.7, aMax: 3.6 },
  ];
  for (const sp of edgeSpawns) {
    const angle = rand(sp.aMin, sp.aMax);
    const len = reach * rand(0.6, 1.0);
    fissures.push(...buildFissure(sp.x, sp.y, angle, len, 0));
  }
  return fissures;
}

function initIce(w, h) {
  return {
    particles: Array.from({ length: 45 }, () => spawnIce(w, h, true)),
    streaks: Array.from({ length: 12 }, () => spawnIceStreak(w, h, true)),
    fissures: initIceFissures(w, h),
    frostPhase: 0,
  };
}

function spawnIce(w, h, randomX = false) {
  return {
    x: randomX ? rand(0, w) : rand(-20, -5),
    y: rand(0, h),
    vx: rand(0.5, 2.0),
    vy: rand(-0.3, 0.3),
    r: rand(1, 3.5),
    life: 1,
    decay: rand(0.003, 0.007),
    twinkle: rand(0, Math.PI * 2),
  };
}

function spawnIceStreak(w, h, randomX = false) {
  return {
    x: randomX ? rand(0, w) : rand(-50, -10),
    y: rand(0, h),
    len: rand(25, 60),
    vx: rand(1.5, 3.5),
    alpha: rand(0.06, 0.18),
  };
}

function updateIce(state, w, h, dt) {
  const s = dt / 16;
  state.frostPhase += 0.015 * s;
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

function drawIceFissures(ctx, fissures, phase) {
  const pulse = 0.85 + 0.15 * Math.sin(phase);

  for (const seg of fissures) {
    const glowW = seg.width * 6;
    const ga = 0.07 * pulse * (1 - seg.t);
    ctx.strokeStyle = `rgba(103, 232, 249, ${ga})`;
    ctx.lineWidth = glowW;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(seg.x1, seg.y1);
    ctx.lineTo(seg.x2, seg.y2);
    ctx.stroke();
  }

  for (const seg of fissures) {
    const a = (0.55 + 0.15 * Math.sin(phase + seg.x1 * 0.01)) * (1 - seg.t * 0.5) * pulse;
    ctx.strokeStyle = `rgba(220, 245, 255, ${a})`;
    ctx.lineWidth = seg.width;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(seg.x1, seg.y1);
    ctx.lineTo(seg.x2, seg.y2);
    ctx.stroke();
  }

  for (const seg of fissures) {
    const coreA = 0.9 * pulse * (1 - seg.t * 0.6);
    ctx.strokeStyle = `rgba(255, 255, 255, ${coreA})`;
    ctx.lineWidth = Math.max(0.4, seg.width * 0.35);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(seg.x1, seg.y1);
    ctx.lineTo(seg.x2, seg.y2);
    ctx.stroke();
  }
}

function drawIce(ctx, state, w, h) {
  const edgeFrost = Math.min(w, h) * 0.08;
  const frostA = 0.06 + 0.02 * Math.sin(state.frostPhase * 0.7);
  const topG = ctx.createLinearGradient(0, 0, 0, edgeFrost);
  topG.addColorStop(0, `rgba(186, 230, 253, ${frostA})`);
  topG.addColorStop(1, 'rgba(186, 230, 253, 0)');
  ctx.fillStyle = topG;
  ctx.fillRect(0, 0, w, edgeFrost);
  const botG = ctx.createLinearGradient(0, h, 0, h - edgeFrost);
  botG.addColorStop(0, `rgba(186, 230, 253, ${frostA})`);
  botG.addColorStop(1, 'rgba(186, 230, 253, 0)');
  ctx.fillStyle = botG;
  ctx.fillRect(0, h - edgeFrost, w, edgeFrost);
  const leftG = ctx.createLinearGradient(0, 0, edgeFrost, 0);
  leftG.addColorStop(0, `rgba(186, 230, 253, ${frostA})`);
  leftG.addColorStop(1, 'rgba(186, 230, 253, 0)');
  ctx.fillStyle = leftG;
  ctx.fillRect(0, 0, edgeFrost, h);
  const rightG = ctx.createLinearGradient(w, 0, w - edgeFrost, 0);
  rightG.addColorStop(0, `rgba(186, 230, 253, ${frostA})`);
  rightG.addColorStop(1, 'rgba(186, 230, 253, 0)');
  ctx.fillStyle = rightG;
  ctx.fillRect(w - edgeFrost, 0, edgeFrost, h);

  drawIceFissures(ctx, state.fissures, state.frostPhase);

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

// ─── Ombre : brume épaisse noir/violet depuis le bas ─────────────────────────

function initShadow(w, h) {
  return {
    clouds: Array.from({ length: 30 }, () => spawnShadowCloud(w, h, true)),
    wisps: Array.from({ length: 18 }, () => spawnWisp(w, h, true)),
    tendrils: Array.from({ length: 6 }, () => spawnTendril(w, h)),
    fogPhase: 0,
  };
}

function spawnShadowCloud(w, h, randomY = false) {
  return {
    x: rand(-20, w + 20),
    y: randomY ? rand(h * 0.35, h + 20) : rand(h, h + 30),
    r: rand(25, 55),
    vy: rand(-0.2, -0.55),
    vx: rand(-0.25, 0.25),
    alpha: rand(0.2, 0.45),
    hue: rand(260, 295),
  };
}

function spawnWisp(w, h, randomY = false) {
  return {
    x: rand(0, w),
    y: randomY ? rand(h * 0.4, h) : h + 5,
    vy: rand(-0.4, -1.2),
    vx: rand(-0.2, 0.2),
    alpha: rand(0.3, 0.6),
    r: rand(3, 6),
    life: 1,
    decay: rand(0.003, 0.008),
  };
}

function spawnTendril(w, h) {
  return {
    x: rand(w * 0.1, w * 0.9),
    baseY: h,
    reach: rand(h * 0.3, h * 0.6),
    phase: rand(0, Math.PI * 2),
    speed: rand(0.015, 0.04),
    width: rand(8, 20),
    hue: rand(265, 290),
    alpha: rand(0.12, 0.25),
  };
}

function updateShadow(state, w, h, dt) {
  const s = dt / 16;
  state.fogPhase += 0.02 * s;
  for (const c of state.clouds) {
    c.y += c.vy * s;
    c.x += c.vx * s;
    if (c.y < h * 0.1 - c.r) Object.assign(c, spawnShadowCloud(w, h));
  }
  for (const wp of state.wisps) {
    wp.y += wp.vy * s;
    wp.x += wp.vx * s;
    wp.life -= wp.decay * s;
    if (wp.life <= 0 || wp.y < h * 0.05) Object.assign(wp, spawnWisp(w, h));
  }
  for (const t of state.tendrils) {
    t.phase += t.speed * s;
  }
}

function drawShadow(ctx, state, w, h) {
  // Fond brumeux dense depuis le bas (couvre 60% de la carte)
  const grad = ctx.createLinearGradient(0, h, 0, h * 0.3);
  grad.addColorStop(0, 'rgba(20, 0, 40, 0.6)');
  grad.addColorStop(0.4, 'rgba(30, 0, 50, 0.35)');
  grad.addColorStop(0.7, 'rgba(30, 0, 50, 0.12)');
  grad.addColorStop(1, 'rgba(30, 0, 50, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, h * 0.3, w, h * 0.7);

  // Tentacules de brume qui ondulent vers le haut
  for (const t of state.tendrils) {
    const sway = Math.sin(t.phase) * 15;
    const swayMid = Math.sin(t.phase * 1.3 + 1) * 10;
    ctx.beginPath();
    ctx.moveTo(t.x - t.width / 2, t.baseY);
    ctx.quadraticCurveTo(
      t.x + swayMid, t.baseY - t.reach * 0.5,
      t.x + sway, t.baseY - t.reach
    );
    ctx.quadraticCurveTo(
      t.x + swayMid + t.width * 0.3, t.baseY - t.reach * 0.5,
      t.x + t.width / 2, t.baseY
    );
    ctx.closePath();
    const tg = ctx.createLinearGradient(t.x, t.baseY, t.x, t.baseY - t.reach);
    tg.addColorStop(0, hsl(t.hue, 70, 20, t.alpha));
    tg.addColorStop(0.6, hsl(t.hue, 60, 15, t.alpha * 0.5));
    tg.addColorStop(1, hsl(t.hue, 60, 10, 0));
    ctx.fillStyle = tg;
    ctx.fill();
  }

  // Nuages denses
  for (const c of state.clouds) {
    const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r);
    g.addColorStop(0, hsl(c.hue, 70, 12, c.alpha));
    g.addColorStop(0.6, hsl(c.hue, 60, 10, c.alpha * 0.5));
    g.addColorStop(1, hsl(c.hue, 60, 8, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Mèches violettes lumineuses
  for (const wp of state.wisps) {
    const a = wp.alpha * wp.life;
    if (a <= 0) continue;
    const g = ctx.createRadialGradient(wp.x, wp.y, 0, wp.x, wp.y, wp.r * 2.5);
    g.addColorStop(0, hsl(275, 80, 50, a * 0.8));
    g.addColorStop(0.4, hsl(275, 70, 40, a * 0.4));
    g.addColorStop(1, hsl(275, 60, 30, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(wp.x, wp.y, wp.r * 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ─── Or : scintillements dorés + sweep de brillance ──────────────────────────

function initGold(w, h) {
  const diag = Math.sqrt(w * w + h * h);
  return {
    sparkles: Array.from({ length: 25 }, () => spawnGold(w, h)),
    sweepPos: -diag * 0.3,
    sweepDiag: diag,
    sweepActive: false,
    sweepTimer: rand(150, 300),
  };
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
  if (!state.sweepActive) {
    state.sweepTimer -= s;
    if (state.sweepTimer <= 0) {
      state.sweepActive = true;
      state.sweepPos = -state.sweepDiag * 0.3;
    }
  } else {
    state.sweepPos += 2.5 * s;
    if (state.sweepPos > state.sweepDiag * 1.3) {
      state.sweepActive = false;
      state.sweepTimer = rand(180, 350);
    }
  }
}

function drawGold(ctx, state, w, h) {
  // Sweep de brillance diagonal
  if (state.sweepActive) {
    ctx.save();
    ctx.translate(0, 0);
    ctx.rotate(Math.PI / 4);
    const sw = state.sweepDiag * 0.12;
    const pos = state.sweepPos;
    const g = ctx.createLinearGradient(pos - sw, 0, pos + sw, 0);
    g.addColorStop(0, 'rgba(251, 191, 36, 0)');
    g.addColorStop(0.3, 'rgba(251, 191, 36, 0.06)');
    g.addColorStop(0.5, 'rgba(253, 224, 71, 0.18)');
    g.addColorStop(0.7, 'rgba(251, 191, 36, 0.06)');
    g.addColorStop(1, 'rgba(251, 191, 36, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(pos - sw, -h, sw * 2, h * 3);
    ctx.restore();
  }

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

// ─── Territoire : orbes pulsantes + comètes magiques ─────────────────────────

function initTerritory(w, h) {
  return {
    orbs: Array.from({ length: 10 }, () => spawnOrb(w, h)),
    comets: [],
    cometTimer: rand(40, 100),
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

function spawnTerrComet(w, h) {
  const edge = randInt(0, 3);
  let x, y, vx, vy;
  if (edge === 0) { x = -5; y = rand(0, h); vx = rand(2, 4.5); vy = rand(-1, 1); }
  else if (edge === 1) { x = w + 5; y = rand(0, h); vx = rand(-4.5, -2); vy = rand(-1, 1); }
  else if (edge === 2) { x = rand(0, w); y = -5; vx = rand(-1, 1); vy = rand(2, 4.5); }
  else { x = rand(0, w); y = h + 5; vx = rand(-1, 1); vy = rand(-4.5, -2); }
  return { x, y, vx, vy, colorIdx: randInt(0, 2), life: 1, tailLen: rand(12, 25) };
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
  state.cometTimer -= s;
  if (state.cometTimer <= 0) {
    state.comets.push(spawnTerrComet(w, h));
    state.cometTimer = rand(50, 140);
  }
  for (let i = state.comets.length - 1; i >= 0; i--) {
    const c = state.comets[i];
    c.x += c.vx * s;
    c.y += c.vy * s;
    c.life -= 0.01 * s;
    if (c.life <= 0 || c.x < -30 || c.x > w + 30 || c.y < -30 || c.y > h + 30) {
      state.comets.splice(i, 1);
    }
  }
}

function drawTerritory(ctx, state, w, h) {
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
  for (const c of state.comets) {
    const [ch, cs, cl] = TERR_COLORS[c.colorIdx];
    const speed = Math.sqrt(c.vx * c.vx + c.vy * c.vy);
    const nx = -c.vx / speed;
    const ny = -c.vy / speed;
    const tailX = c.x + nx * c.tailLen;
    const tailY = c.y + ny * c.tailLen;
    const g = ctx.createLinearGradient(c.x, c.y, tailX, tailY);
    g.addColorStop(0, hsl(ch, cs, cl + 15, c.life * 0.9));
    g.addColorStop(1, hsl(ch, cs, cl, 0));
    ctx.strokeStyle = g;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(tailX, tailY);
    ctx.stroke();
    const glow = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, 6);
    glow.addColorStop(0, hsl(ch, cs, cl + 20, c.life * 0.5));
    glow.addColorStop(1, hsl(ch, cs, cl, 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(c.x, c.y, 6, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ─── Sang : débordement en haut + gouttes qui perlent ────────────────────────

function initBlood(w, h) {
  const overflowDrips = [];
  const count = Math.floor(w / 18);
  for (let i = 0; i < count; i++) {
    overflowDrips.push({
      x: rand(2, w - 2),
      len: rand(8, 45),
      targetLen: rand(15, 55),
      speed: rand(0.08, 0.25),
      width: rand(2, 5),
      phase: rand(0, Math.PI * 2),
    });
  }
  return {
    drops: Array.from({ length: 22 }, () => spawnDrop(w, h, true)),
    overflowDrips,
    poolPhase: 0,
  };
}

function spawnDrop(w, h, randomY = false) {
  return {
    x: rand(3, w - 3),
    y: randomY ? rand(12, h * 0.8) : rand(8, 15),
    vy: rand(0.2, 0.7),
    r: rand(1.5, 3.5),
    streakLen: 0,
    maxStreak: rand(10, 35),
  };
}

function updateBlood(state, w, h, dt) {
  const s = dt / 16;
  state.poolPhase += 0.02 * s;
  for (const d of state.drops) {
    d.y += d.vy * s;
    d.streakLen = Math.min(d.streakLen + d.vy * s * 0.8, d.maxStreak);
    if (d.y > h + 10) Object.assign(d, spawnDrop(w, h));
  }
  for (const drip of state.overflowDrips) {
    drip.phase += 0.01 * s;
    drip.targetLen = 20 + 25 * (0.5 + 0.5 * Math.sin(drip.phase));
    if (drip.len < drip.targetLen) drip.len += drip.speed * s;
    else drip.len -= drip.speed * 0.3 * s;
    drip.len = Math.max(5, drip.len);
  }
}

function drawBlood(ctx, state, w, h) {
  // Bande de sang en haut (nappe qui déborde)
  const poolH = 8;
  const poolG = ctx.createLinearGradient(0, 0, 0, poolH + 4);
  poolG.addColorStop(0, 'rgba(153, 27, 27, 0.8)');
  poolG.addColorStop(0.5, 'rgba(185, 28, 28, 0.65)');
  poolG.addColorStop(1, 'rgba(127, 29, 29, 0)');
  ctx.fillStyle = poolG;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(w, 0);
  for (let x = w; x >= 0; x -= 3) {
    const wave = Math.sin(state.poolPhase * 1.5 + x * 0.06) * 2;
    ctx.lineTo(x, poolH + wave);
  }
  ctx.closePath();
  ctx.fill();

  // Coulures de sang qui pendent depuis le bord supérieur
  for (const drip of state.overflowDrips) {
    const g = ctx.createLinearGradient(drip.x, poolH - 2, drip.x, poolH + drip.len);
    g.addColorStop(0, 'rgba(185, 28, 28, 0.75)');
    g.addColorStop(0.7, 'rgba(153, 27, 27, 0.5)');
    g.addColorStop(1, 'rgba(127, 29, 29, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(drip.x - drip.width / 2, poolH - 2);
    ctx.lineTo(drip.x + drip.width / 2, poolH - 2);
    ctx.lineTo(drip.x + drip.width * 0.3, poolH + drip.len * 0.8);
    ctx.quadraticCurveTo(drip.x, poolH + drip.len + 3, drip.x - drip.width * 0.3, poolH + drip.len * 0.8);
    ctx.closePath();
    ctx.fill();
  }

  // Gouttes qui tombent
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

// ─── Nature : feuilles qui tombent + bourrasques ─────────────────────────────

function initNature(w, h) {
  return {
    leaves: Array.from({ length: 35 }, () => spawnLeaf(w, h, true)),
    gustActive: false,
    gustTimer: rand(200, 400),
    gustVx: 0,
    gustVy: 0,
    gustFade: 0,
  };
}

function spawnLeaf(w, h, randomY = false) {
  return {
    x: rand(-10, w + 10),
    y: randomY ? rand(-10, h) : rand(-30, -5),
    vy: rand(0.3, 0.7),
    vx: rand(-0.15, 0.15),
    angle: rand(0, Math.PI * 2),
    rotSpeed: rand(0.01, 0.04) * (Math.random() < 0.5 ? 1 : -1),
    swayPhase: rand(0, Math.PI * 2),
    swayAmp: rand(0.3, 0.8),
    size: rand(3, 7),
    hue: randInt(0, 3) === 0 ? rand(25, 45) : rand(100, 160),
    lightness: rand(30, 50),
  };
}

function updateNature(state, w, h, dt) {
  const s = dt / 16;

  if (!state.gustActive) {
    state.gustTimer -= s;
    if (state.gustTimer <= 0) {
      state.gustActive = true;
      state.gustVx = rand(-3, 3);
      state.gustVy = rand(-1.5, 1.5);
      state.gustFade = 1;
      state.gustTimer = rand(250, 500);
      for (const l of state.leaves) {
        l.rotSpeed = rand(0.04, 0.1) * (Math.random() < 0.5 ? 1 : -1);
      }
    }
  } else {
    state.gustFade -= 0.008 * s;
    if (state.gustFade <= 0) {
      state.gustActive = false;
      state.gustFade = 0;
      for (const l of state.leaves) {
        l.rotSpeed = rand(0.01, 0.04) * (Math.random() < 0.5 ? 1 : -1);
      }
    }
  }

  const gx = state.gustActive ? state.gustVx * state.gustFade : 0;
  const gy = state.gustActive ? state.gustVy * state.gustFade : 0;

  for (const l of state.leaves) {
    l.y += (l.vy + gy) * s;
    l.swayPhase += 0.03 * s;
    l.x += (l.vx + Math.sin(l.swayPhase) * l.swayAmp + gx) * s;
    l.angle += l.rotSpeed * s;
    if (l.y > h + 10 || l.x < -30 || l.x > w + 30 || l.y < -30) {
      Object.assign(l, spawnLeaf(w, h));
    }
  }
}

function drawNature(ctx, state) {
  for (const l of state.leaves) {
    ctx.save();
    ctx.translate(l.x, l.y);
    ctx.rotate(l.angle);
    ctx.fillStyle = hsl(l.hue, 70, l.lightness, 0.85);
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

// ─── Titane : reflet métallique + étincelles + éclairs de bord ────────────────

function initTitane(w, h) {
  return {
    sweepX: -w * 0.3,
    sparks: Array.from({ length: 18 }, () => spawnSpark(w, h)),
    edgeBolts: [],
    boltTimer: rand(60, 150),
    platePhase: 0,
  };
}

function spawnSpark(w, h) {
  return {
    x: rand(0, w),
    y: rand(0, h),
    life: 0,
    maxLife: rand(20, 50),
    delay: rand(0, 80),
    size: rand(1, 3),
  };
}

function spawnBolt(w, h) {
  const edge = randInt(0, 3);
  const pts = [];
  const steps = randInt(4, 8);
  let x, y;
  if (edge === 0) { x = 0; y = rand(0, h); }
  else if (edge === 1) { x = w; y = rand(0, h); }
  else if (edge === 2) { x = rand(0, w); y = 0; }
  else { x = rand(0, w); y = h; }
  pts.push({ x, y });
  for (let i = 0; i < steps; i++) {
    const inward = (edge === 0) ? rand(5, 25) : (edge === 1) ? rand(-25, -5) :
                   (edge === 2) ? rand(5, 25) : rand(-25, -5);
    const lateral = rand(-15, 15);
    if (edge <= 1) { x += lateral; y += (edge === 0 ? inward : -inward); x += inward; }
    else { x += lateral; y += inward; }
    pts.push({ x: Math.max(0, Math.min(w, x)), y: Math.max(0, Math.min(h, y)) });
  }
  return { pts, life: 1, decay: rand(0.03, 0.06) };
}

function updateTitane(state, w, h, dt) {
  const s = dt / 16;
  state.sweepX += 1.0 * s;
  state.platePhase += 0.02 * s;
  if (state.sweepX > w * 1.3) state.sweepX = -w * 0.3;
  for (const sp of state.sparks) {
    if (sp.delay > 0) { sp.delay -= s; continue; }
    sp.life += s;
    if (sp.life > sp.maxLife) Object.assign(sp, spawnSpark(w, h));
  }
  state.boltTimer -= s;
  if (state.boltTimer <= 0) {
    state.edgeBolts.push(spawnBolt(w, h));
    state.boltTimer = rand(70, 180);
  }
  for (let i = state.edgeBolts.length - 1; i >= 0; i--) {
    state.edgeBolts[i].life -= state.edgeBolts[i].decay * s;
    if (state.edgeBolts[i].life <= 0) state.edgeBolts.splice(i, 1);
  }
}

function drawTitane(ctx, state, w, h) {
  // Plaque métallique subtile avec reflet
  const plateAlpha = 0.03 + 0.02 * Math.sin(state.platePhase);
  ctx.fillStyle = `rgba(148, 163, 184, ${plateAlpha})`;
  ctx.fillRect(0, 0, w, h);

  // Sweep
  const sw = w * 0.18;
  const g = ctx.createLinearGradient(state.sweepX - sw, 0, state.sweepX + sw, 0);
  g.addColorStop(0, 'rgba(203, 213, 225, 0)');
  g.addColorStop(0.35, 'rgba(226, 232, 240, 0.15)');
  g.addColorStop(0.5, 'rgba(241, 245, 249, 0.28)');
  g.addColorStop(0.65, 'rgba(226, 232, 240, 0.15)');
  g.addColorStop(1, 'rgba(203, 213, 225, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // Edge bolts
  for (const bolt of state.edgeBolts) {
    ctx.strokeStyle = `rgba(226, 232, 240, ${bolt.life * 0.7})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(bolt.pts[0].x, bolt.pts[0].y);
    for (let i = 1; i < bolt.pts.length; i++) {
      ctx.lineTo(bolt.pts[i].x, bolt.pts[i].y);
    }
    ctx.stroke();
    ctx.strokeStyle = `rgba(255, 255, 255, ${bolt.life * 0.3})`;
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  for (const sp of state.sparks) {
    if (sp.delay > 0) continue;
    const t = sp.life / sp.maxLife;
    const alpha = t < 0.3 ? t / 0.3 : (1 - t) / 0.7;
    ctx.fillStyle = `rgba(226, 232, 240, ${alpha * 0.9})`;
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, sp.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ─── Cosmique : étoiles + nébuleuses + galaxies + étoiles filantes ───────────

function initCosmic(w, h) {
  return {
    stars: Array.from({ length: 72 }, () => ({
      x: rand(0, w), y: rand(0, h),
      r: rand(0.7, 2.9),
      twinkle: rand(0, Math.PI * 2),
      speed: rand(0.03, 0.08),
      brightness: rand(0.58, 1.25),
      hue: Math.random() < 0.3 ? rand(200, 280) : -1,
    })),
    nebulae: Array.from({ length: 6 }, () => ({
      x: rand(w * 0.05, w * 0.95),
      y: rand(h * 0.05, h * 0.95),
      r: rand(30, 70),
      hue: rand(240, 300),
      phase: rand(0, Math.PI * 2),
    })),
    galaxies: Array.from({ length: 2 }, () => ({
      x: rand(w * 0.2, w * 0.8),
      y: rand(h * 0.2, h * 0.8),
      r: rand(12, 22),
      angle: rand(0, Math.PI * 2),
      rotSpeed: rand(0.003, 0.008),
      hue: rand(250, 290),
    })),
    shootingStars: [],
    shootTimer: rand(40, 100),
    dustPhase: 0,
  };
}

function updateCosmic(state, w, h, dt) {
  const s = dt / 16;
  state.dustPhase += 0.008 * s;
  for (const st of state.stars) st.twinkle += st.speed * s;
  for (const n of state.nebulae) n.phase += 0.012 * s;
  for (const g of state.galaxies) g.angle += g.rotSpeed * s;

  state.shootTimer -= s;
  if (state.shootTimer <= 0) {
    state.shootingStars.push({
      x: rand(0, w * 0.6), y: rand(0, h * 0.4),
      vx: rand(2.5, 5), vy: rand(1, 3),
      life: 1, len: rand(18, 35),
    });
    state.shootTimer = rand(50, 150);
  }
  for (let i = state.shootingStars.length - 1; i >= 0; i--) {
    const ss = state.shootingStars[i];
    ss.x += ss.vx * s;
    ss.y += ss.vy * s;
    ss.life -= 0.025 * s;
    if (ss.life <= 0 || ss.x > w + 10 || ss.y > h + 10) {
      state.shootingStars.splice(i, 1);
    }
  }
}

function drawCosmic(ctx, state, w, h) {
  // Poussière d'étoiles subtile
  const dustAlpha = 0.03 + 0.01 * Math.sin(state.dustPhase);
  const dg = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.6);
  dg.addColorStop(0, `rgba(109, 40, 217, ${dustAlpha})`);
  dg.addColorStop(1, 'rgba(30, 27, 75, 0)');
  ctx.fillStyle = dg;
  ctx.fillRect(0, 0, w, h);

  for (const n of state.nebulae) {
    const alpha = 0.07 + 0.04 * Math.sin(n.phase);
    const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
    g.addColorStop(0, hsl(n.hue, 80, 40, alpha));
    g.addColorStop(0.6, hsl(n.hue + 20, 70, 30, alpha * 0.4));
    g.addColorStop(1, hsl(n.hue, 80, 20, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Galaxies spirales
  for (const gx of state.galaxies) {
    ctx.save();
    ctx.translate(gx.x, gx.y);
    ctx.rotate(gx.angle);
    const gg = ctx.createRadialGradient(0, 0, 0, 0, 0, gx.r);
    gg.addColorStop(0, hsl(gx.hue, 70, 70, 0.2));
    gg.addColorStop(0.4, hsl(gx.hue, 60, 50, 0.08));
    gg.addColorStop(1, hsl(gx.hue, 60, 40, 0));
    ctx.fillStyle = gg;
    ctx.beginPath();
    ctx.ellipse(0, 0, gx.r, gx.r * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  for (const st of state.stars) {
    const a = Math.min(1, st.brightness * (0.45 + 0.75 * Math.abs(Math.sin(st.twinkle))));
    const glow = ctx.createRadialGradient(st.x, st.y, 0, st.x, st.y, st.r * 4.2);
    glow.addColorStop(0, `rgba(255, 255, 255, ${a * 0.36})`);
    glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(st.x, st.y, st.r * 4.2, 0, Math.PI * 2);
    ctx.fill();

    if (st.hue >= 0) {
      ctx.fillStyle = hsl(st.hue, 60, 80, a);
    } else {
      ctx.fillStyle = `rgba(255, 255, 255, ${a})`;
    }
    ctx.beginPath();
    ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const ss of state.shootingStars) {
    const g = ctx.createLinearGradient(
      ss.x, ss.y,
      ss.x - ss.vx * ss.len * 0.3, ss.y - ss.vy * ss.len * 0.3
    );
    g.addColorStop(0, `rgba(255, 255, 255, ${ss.life})`);
    g.addColorStop(1, 'rgba(168, 85, 247, 0)');
    ctx.strokeStyle = g;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(ss.x, ss.y);
    ctx.lineTo(ss.x - ss.vx * ss.len * 0.3, ss.y - ss.vy * ss.len * 0.3);
    ctx.stroke();
  }
}

// ─── Transcendance : prismes intenses + halos iridescents + faisceaux ────────

function initTranscendance(w, h) {
  return {
    prisms: Array.from({ length: 18 }, () => spawnPrism(w, h)),
    beams: Array.from({ length: 7 }, () => spawnBeam(w, h)),
    haloPhase: 0,
    flashTimer: rand(80, 200),
    flash: null,
  };
}

function spawnPrism(w, h) {
  return {
    x: rand(5, w - 5), y: rand(5, h - 5),
    angle: rand(0, Math.PI * 2),
    rotSpeed: rand(0.015, 0.05),
    size: rand(3, 7),
    life: 0, maxLife: rand(50, 110),
    delay: rand(0, 60),
    hueOffset: rand(0, 360),
  };
}

function spawnBeam(w, h) {
  return {
    x: rand(0, w), angle: rand(-0.4, 0.4),
    width: rand(1.5, 4), alpha: 0,
    life: 0, maxLife: rand(40, 80), delay: rand(0, 90),
    hue: rand(0, 360),
  };
}

function updateTranscendance(state, w, h, dt) {
  const s = dt / 16;
  state.haloPhase += 0.015 * s;
  for (const p of state.prisms) {
    if (p.delay > 0) { p.delay -= s; continue; }
    p.angle += p.rotSpeed * s;
    p.life += s;
    p.hueOffset += 2 * s;
    if (p.life > p.maxLife) Object.assign(p, spawnPrism(w, h));
  }
  for (const b of state.beams) {
    if (b.delay > 0) { b.delay -= s; continue; }
    b.life += s;
    b.hue += 2.5 * s;
    const t = b.life / b.maxLife;
    b.alpha = t < 0.2 ? t / 0.2 * 0.1 : t < 0.7 ? 0.1 : (1 - t) / 0.3 * 0.1;
    if (b.life > b.maxLife) Object.assign(b, spawnBeam(w, h));
  }
  state.flashTimer -= s;
  if (state.flashTimer <= 0) {
    state.flash = { life: 1, x: rand(w * 0.1, w * 0.9), y: rand(h * 0.1, h * 0.9), hue: rand(0, 360) };
    state.flashTimer = rand(100, 250);
  }
  if (state.flash) {
    state.flash.life -= 0.04 * s;
    if (state.flash.life <= 0) state.flash = null;
  }
}

function drawTranscendance(ctx, state, w, h) {
  // Halo iridescent central
  const haloAlpha = 0.04 + 0.02 * Math.sin(state.haloPhase);
  const haloHue = (state.haloPhase * 30) % 360;
  const hg = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.5);
  hg.addColorStop(0, hsl(haloHue, 70, 70, haloAlpha));
  hg.addColorStop(0.5, hsl((haloHue + 60) % 360, 60, 60, haloAlpha * 0.4));
  hg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = hg;
  ctx.fillRect(0, 0, w, h);

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
    const hu = p.hueOffset % 360;

    ctx.fillStyle = hsl(hu, 75, 72, alpha * 0.7);
    ctx.beginPath();
    ctx.moveTo(0, -p.size);
    ctx.lineTo(p.size * 0.6, 0);
    ctx.lineTo(0, p.size);
    ctx.lineTo(-p.size * 0.6, 0);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = hsl((hu + 90) % 360, 80, 80, alpha * 0.4);
    ctx.lineWidth = 0.5;
    ctx.stroke();

    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, p.size * 2.5);
    glow.addColorStop(0, hsl(hu, 80, 85, alpha * 0.3));
    glow.addColorStop(1, hsl(hu, 80, 60, 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, p.size * 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // Flash lumineux occasionnel
  if (state.flash) {
    const f = state.flash;
    const r = 40 * f.life;
    const fg = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r);
    fg.addColorStop(0, hsl(f.hue, 80, 90, f.life * 0.35));
    fg.addColorStop(0.5, hsl((f.hue + 60) % 360, 70, 70, f.life * 0.1));
    fg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.arc(f.x, f.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ─── Champion : confettis rainbow + étoiles + traînées lumineuses ─────────────

function initChampion(w, h) {
  return {
    particles: Array.from({ length: 35 }, () => spawnChampionParticle(w, h)),
    confetti: Array.from({ length: 20 }, () => spawnConfetti(w, h, true)),
    stars: Array.from({ length: 10 }, () => spawnChampionStar(w, h)),
    rainbowPhase: 0,
  };
}

function spawnChampionParticle(w, h) {
  const edge = randInt(0, 3);
  let x, y, vx, vy;
  if (edge === 0) { x = rand(0, w); y = -3; vx = rand(-0.3, 0.3); vy = rand(0.3, 0.8); }
  else if (edge === 1) { x = rand(0, w); y = h + 3; vx = rand(-0.3, 0.3); vy = rand(-0.8, -0.3); }
  else if (edge === 2) { x = -3; y = rand(0, h); vx = rand(0.3, 0.8); vy = rand(-0.3, 0.3); }
  else { x = w + 3; y = rand(0, h); vx = rand(-0.8, -0.3); vy = rand(-0.3, 0.3); }
  return {
    x, y, vx, vy,
    hue: rand(0, 360), hueSpeed: rand(1, 4),
    r: rand(1.5, 3.5), life: 1, decay: rand(0.004, 0.01),
    trail: [],
  };
}

function spawnConfetti(w, h, randomY = false) {
  return {
    x: rand(0, w),
    y: randomY ? rand(-10, h) : rand(-20, -5),
    vy: rand(0.3, 0.8),
    vx: rand(-0.3, 0.3),
    angle: rand(0, Math.PI * 2),
    rotSpeed: rand(0.03, 0.08),
    w: rand(2, 4), h: rand(3, 6),
    hue: rand(0, 360),
  };
}

function spawnChampionStar(w, h) {
  return {
    x: rand(10, w - 10), y: rand(10, h - 10),
    size: rand(3, 7), life: 0, maxLife: rand(50, 100),
    delay: rand(0, 100), rotation: rand(0, Math.PI),
  };
}

function updateChampion(state, w, h, dt) {
  const s = dt / 16;
  state.rainbowPhase += 0.02 * s;
  for (const p of state.particles) {
    p.trail.push({ x: p.x, y: p.y, a: p.life * 0.3 });
    if (p.trail.length > 6) p.trail.shift();
    p.x += p.vx * s;
    p.y += p.vy * s;
    p.hue += p.hueSpeed * s;
    p.life -= p.decay * s;
    if (p.life <= 0 || p.x < -10 || p.x > w + 10 || p.y < -10 || p.y > h + 10) {
      Object.assign(p, spawnChampionParticle(w, h));
    }
  }
  for (const c of state.confetti) {
    c.y += c.vy * s;
    c.x += c.vx * s;
    c.angle += c.rotSpeed * s;
    if (c.y > h + 10) Object.assign(c, spawnConfetti(w, h));
  }
  for (const st of state.stars) {
    if (st.delay > 0) { st.delay -= s; continue; }
    st.life += s;
    st.rotation += 0.02 * s;
    if (st.life > st.maxLife) Object.assign(st, spawnChampionStar(w, h));
  }
}

function drawChampion(ctx, state, w, h) {
  // Traînées des particules
  for (const p of state.particles) {
    for (const t of p.trail) {
      ctx.fillStyle = hsl(p.hue % 360, 80, 60, t.a);
      ctx.beginPath();
      ctx.arc(t.x, t.y, p.r * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = hsl(p.hue % 360, 90, 65, p.life * 0.8);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Confettis
  for (const c of state.confetti) {
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.angle);
    ctx.fillStyle = hsl(c.hue, 85, 60, 0.75);
    ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
    ctx.restore();
  }

  for (const st of state.stars) {
    if (st.delay > 0) continue;
    const t = st.life / st.maxLife;
    const alpha = t < 0.3 ? t / 0.3 : (1 - t) / 0.7;
    ctx.save();
    ctx.translate(st.x, st.y);
    ctx.rotate(st.rotation);
    drawStar(ctx, 0, 0, st.size, 4, hsl(45, 100, 60, alpha * 0.9));
    ctx.restore();
  }
}

// ─── Ancient : noir & blanc + scanlines + grésillement ────────────────

function initAncient(w, h) {
  return {
    time: rand(0, Math.PI * 2),
    flicker: rand(0.75, 1.15),
    scanPhase: rand(0, 5),
    nextFlickerIn: rand(18, 42),
    roll: rand(-1.5, 1.5),
    rollSpeed: rand(0.8, 1.6),
    // Light leaks (fuites lumineuses) : positions / couleurs fixes, intensités animées.
    leaks: Array.from({ length: 3 }, () => ({
      x: rand(0.05, 0.95),
      y: rand(0.05, 0.35),
      r: rand(0.35, 0.75),
      hue: rand(18, 55), // chaud (jaune/orange) plutôt qu'un bleu
      alpha: rand(0.12, 0.30),
      phase: rand(0, Math.PI * 2),
    })),
  };
}

function updateAncient(state, w, h, dt) {
  const s = dt / 16;
  state.time += 0.035 * s;
  state.scanPhase += 0.7 * s;
  state.roll += Math.sin(state.time * state.rollSpeed) * 0.05;

  // Flicker aléatoire (plus “vieux” TV).
  state.nextFlickerIn -= s;
  if (state.nextFlickerIn <= 0) {
    state.nextFlickerIn = rand(18, 42);
    state.flicker = rand(0.65, 1.25);
  }
}

function drawAncient(ctx, state, w, h) {
  ctx.save();

  // Légère vignette + assombrissement pour simuler un tube.
  const vignette = ctx.createRadialGradient(w * 0.5, h * 0.55, 0, w * 0.5, h * 0.55, Math.max(w, h) * 0.75);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.42)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);

  const flicker = state.flicker;

  // “Light leaks” : dégradés chauds sur les bords (comme vieux films).
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (const leak of state.leaks || []) {
    const t = 0.5 + 0.5 * Math.sin(state.time * 0.9 + leak.phase);
    const a = leak.alpha * (0.35 + 0.65 * t) * flicker;
    const gx = w * leak.x;
    const gy = h * leak.y;
    const gr = Math.max(w, h) * leak.r;
    const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
    g.addColorStop(0, `hsla(${leak.hue}, 95%, 60%, ${a})`);
    g.addColorStop(0.35, `hsla(${leak.hue}, 95%, 60%, ${a * 0.35})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.restore();

  // Scanlines horizontales.
  const lineSpacing = Math.max(2, Math.floor(h / 60));
  const lineAlpha = 0.22 * flicker;
  const jitter = Math.sin(state.time * 1.7) * 1.45;
  const phaseOffset = (state.scanPhase % lineSpacing) * 1.0;

  ctx.globalAlpha = lineAlpha;
  ctx.fillStyle = 'rgba(0,0,0,1)';
  for (let y = -lineSpacing; y < h + lineSpacing; y += lineSpacing) {
    const rollJ = Math.sin((y / h) * Math.PI * 2 + state.time * 0.9) * state.roll;
    ctx.fillRect(0, y + phaseOffset + jitter + rollJ, w, 1);
  }

  // Bandes d'interférence (le “grésillement” grossier).
  ctx.globalAlpha = 0.14 * flicker;
  for (let i = 0; i < 4; i++) {
    const y = rand(0, h);
    const bandH = rand(1, 3);
    const xOff = Math.sin(state.time * 1.1 + i) * (w * 0.03);
    ctx.fillStyle = Math.random() < 0.55 ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.65)';
    ctx.fillRect(xOff, y, w, bandH);
  }

  // Grains aléatoires (petits points).
  const noiseCount = Math.floor(Math.min((w * h) / 1200, 220));
  ctx.globalAlpha = 0.10 * flicker;
  for (let i = 0; i < noiseCount; i++) {
    const x = rand(0, w);
    const y = rand(0, h);
    const on = Math.random() < 0.48;
    ctx.fillStyle = on ? 'rgba(255,255,255,0.95)' : 'rgba(0,0,0,0.95)';
    ctx.fillRect(x, y, 1, 1);
  }

  // Micro-scratches verticales (instables).
  ctx.globalAlpha = 0.10 * flicker;
  for (let i = 0; i < 7; i++) {
    const x = rand(0, w);
    const len = rand(h * 0.25, h * 0.85);
    const y = rand(0, h - len);
    ctx.strokeStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)';
    ctx.lineWidth = Math.max(0.6, rand(0.6, 1.2));
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + rand(-2, 2), y + len);
    ctx.stroke();
  }

  ctx.restore();
}

// ─── Eau & Soleil : rayons en haut + eau vascillante en bas + vague ponctuelle ────

function spawnWaterBubble(w, h) {
  // On aligne les bulles avec la nouvelle surface pour éviter les “trous”
  const surfaceY = h * 0.93;
  return {
    x: rand(0, w),
    y: rand(surfaceY - h * 0.05, h * 0.99),
    vy: rand(-0.15, -0.9),
    vx: rand(-0.08, 0.08),
    r: rand(1.2, 3.2),
    phase: rand(0, Math.PI * 2),
    alpha: rand(0.18, 0.6),
  };
}

function initWaterSun(w, h) {
  return {
    waterPhase: rand(0, Math.PI * 2),
    bubbles: Array.from({ length: Math.max(14, Math.floor(w / 16)) }, () => spawnWaterBubble(w, h)),
    // Plus rare et plus “tsunami” (mini) : cooldown plus long
    waveCooldown: rand(220, 360),
    wave: null,
  };
}

function updateWaterSun(state, w, h, dt) {
  const s = dt / 16;
  state.waterPhase += 0.018 * s;

  for (const b of state.bubbles) {
    b.phase += 0.06 * s;
    b.y += b.vy * s - Math.sin(b.phase) * 0.15 * s;
    b.x += b.vx * s + Math.cos(b.phase * 0.7) * 0.03 * s;
    // Respawn quand la bulle sort trop haut (sinon elles “flottent” dans la zone air)
    if (b.y < h * 0.89 || b.x < -10 || b.x > w + 10) Object.assign(b, spawnWaterBubble(w, h));
  }

  state.waveCooldown -= s;
  if (state.waveCooldown <= 0 && !state.wave) {
    state.wave = {
      t: 0,
      // Vague "tsunami" : front qui se déplace lentement
      // (on augmente la durée pour que ça ressemble à une vague mur)
      duration: randInt(240, 340),
      amp: rand(80, 140),
      phase: rand(0, Math.PI * 2),
      speed: rand(0.18, 0.35),
    };
    state.waveCooldown = rand(650, 1300);
  }

  if (state.wave) {
    state.wave.t += s;
    if (state.wave.t >= state.wave.duration) state.wave = null;
  }
}

function drawWaterSun(ctx, state, w, h) {
  // Haze / ciel au-dessus
  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.6);
  sky.addColorStop(0, 'rgba(251, 191, 36, 0.12)');
  sky.addColorStop(0.25, 'rgba(250, 204, 21, 0.07)');
  sky.addColorStop(0.7, 'rgba(56, 189, 248, 0.03)');
  sky.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h * 0.6);

  // Rayons du soleil (flare) : gros glow radial collé à l'angle + quelques streaks vers l'intérieur.
  // Objectif : garder la zone la plus lumineuse au maximum dans le coin haut-gauche.
  const baseLen = Math.max(w, h);
  const sunX = w * 0.03;
  const sunY = h * 0.03;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  // Glow principal
  const flareR = baseLen * 0.60;
  const core = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, flareR);
  core.addColorStop(0, 'rgba(255, 252, 220, 0.78)');
  core.addColorStop(0.08, 'rgba(251, 191, 36, 0.42)');
  core.addColorStop(0.28, 'rgba(234, 179, 8, 0.18)');
  core.addColorStop(0.65, 'rgba(251, 191, 36, 0.07)');
  core.addColorStop(1, 'rgba(251, 191, 36, 0)');
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(sunX, sunY, flareR, 0, Math.PI * 2);
  ctx.fill();

  // Halo doux (plus large)
  const haloR = baseLen * 0.92;
  const halo = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, haloR);
  halo.addColorStop(0, 'rgba(251, 191, 36, 0.20)');
  halo.addColorStop(0.40, 'rgba(234, 179, 8, 0.06)');
  halo.addColorStop(1, 'rgba(251, 191, 36, 0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(sunX, sunY, haloR, 0, Math.PI * 2);
  ctx.fill();

  // Streaks (segments) dans le quadrant "droit + bas"
  const rayCount = 10;
  const rayLenBase = baseLen * 0.82;
  ctx.translate(sunX, sunY);
  ctx.globalAlpha = 1;

  for (let i = 0; i < rayCount; i++) {
    const t = i / (rayCount - 1);
    const theta = lerp(0.05, Math.PI * 0.95, t) + Math.sin(state.waterPhase * 0.55 + i) * 0.035;

    const rayLen = rayLenBase * (0.75 + 0.25 * Math.sin(state.waterPhase * 0.30 + i) * 0.5 + 0.5);
    const x2 = Math.cos(theta) * rayLen;
    const y2 = Math.sin(theta) * rayLen;

    const rayW = lerp(22, 7, t);
    const streak = ctx.createLinearGradient(0, 0, x2, y2);
    streak.addColorStop(0, 'rgba(251, 191, 36, 0)');
    streak.addColorStop(0.18, 'rgba(251, 191, 36, 0.48)');
    streak.addColorStop(0.56, 'rgba(234, 179, 8, 0.28)');
    streak.addColorStop(1, 'rgba(251, 191, 36, 0)');

    ctx.strokeStyle = streak;
    ctx.lineWidth = Math.max(1.5, rayW * 0.12);
    ctx.lineCap = 'round';

    const segs = 9;
    for (let s = 0; s < segs; s++) {
      const segT0 = s / segs;
      const segT1 = (s + 1) / segs;
      const p = (segT0 + segT1) * 0.5;

      const gap = Math.sin(state.waterPhase * 1.15 + i * 1.7 + s * 2.25);
      if (gap > 0.38) continue;

      ctx.globalAlpha = 0.35 + 0.65 * (1 - p);
      ctx.beginPath();
      ctx.moveTo(x2 * segT0, y2 * segT0);
      ctx.lineTo(x2 * segT1, y2 * segT1);
      ctx.stroke();
    }
  }

  ctx.globalAlpha = 1;
  ctx.restore();

  // Eau trop haute actuellement => on baisse la surface (moins d'eau visible)
  // Pour que l'eau de base soit plus basse (moins visible).
  const surfaceY = h * 0.93;
  const waveProgress = state.wave ? Math.min(1, state.wave.t / state.wave.duration) : 0;
  const wavePulse = state.wave ? Math.sin(waveProgress * Math.PI) : 0; // pic au milieu
  // Front qui va de droite -> gauche
  const waveFrontX = state.wave
    ? lerp(w * 1.05, -w * 0.05, waveProgress)
    : 0;
  // Largeur du front (tsunami large)
  const waveSigma = Math.max(34, w * 0.13);
  const waveFreq = Math.max(0.02, 0.04 * (w / 280));

  // Fond eau
  const waterBg = ctx.createLinearGradient(0, surfaceY, 0, h);
  waterBg.addColorStop(0, 'rgba(56, 189, 248, 0.05)');
  waterBg.addColorStop(0.25, 'rgba(59, 130, 246, 0.14)');
  waterBg.addColorStop(1, 'rgba(37, 99, 235, 0.38)');
  ctx.fillStyle = waterBg;
  ctx.fillRect(0, surfaceY, w, h - surfaceY);

  const waveFade = state.wave ? Math.max(0, 1 - state.wave.t / state.wave.duration) : 0;

  // Vagues superposées (surface vascillante)
  const drawWaveLayer = (layerIdx) => {
    const step = Math.max(4, Math.floor(w / 120));
    const ampBase = lerp(5, 12, layerIdx / 2);
    const amp = ampBase + (state.wave ? waveFade * state.wave.amp * (0.6 + layerIdx * 0.2) : 0);

    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(0, surfaceY);
    for (let x = 0; x <= w; x += step) {
      const baseScale = state.wave ? (0.25 + 0.25 * (1 - wavePulse)) : 1; // calmer la mer pendant le tsunami
      const wave = Math.sin(state.waterPhase * (1.0 + layerIdx * 0.12) + x * 0.03 + layerIdx * 2.2) * (2.5 + layerIdx) * baseScale;
      const wave2 = Math.sin(state.waterPhase * 1.7 + x * 0.06 + layerIdx) * (1.1 + layerIdx * 0.4) * baseScale;

      // Tsunami façon "mur/poussée" :
      // - relief surtout sur le front (enveloppe gaussienne autour de dx=0)
      // - petite traînée qui décroît derrière le front (dx<0)
      let raise = 0;
      let micro = 0;
      if (state.wave) {
        const dx = x - waveFrontX; // dx < 0 = derrière le front (zone déjà touchée)

        // Crest plus large (moins pointu) + traînée plus étalée
        const crestW = waveSigma * (0.45 + layerIdx * 0.05);
        const trailW = waveSigma * (0.80 + layerIdx * 0.07);

        // Sommet “plat” : gaussienne d'ordre 4 (tt^4) au lieu de tt^2
        const tt = dx / crestW;
        const crest = Math.exp(-(tt * tt * tt * tt) / 2);
        const trail = dx < 0 ? Math.exp(dx / Math.max(1, trailW)) : 0;

        const crestHeight = state.wave.amp * (0.62 + layerIdx * 0.08);
        const env = wavePulse * (0.85 + 0.15 * waveFade); // pic au milieu, puis décroît

        // "Rouleau" : bosses oscillantes dans la traînée (derrière le front)
        const rollLen = Math.max(60, w * 0.24);
        const rollK = (Math.PI * 2) / rollLen;
        const rollPhase = (-dx) * rollK + state.wave.phase * 0.25 + state.waterPhase * 0.5 - waveProgress * 2.2;
        let hump = dx < 0 ? Math.max(0, Math.sin(rollPhase)) : 0; // 0..1
        // adoucit pour éviter un relief trop “pic”
        hump = hump * hump * (3 - 2 * hump);

        raise = crestHeight * env * (crest + 0.55 * trail + 0.25 * trail * hump);

        const ripple = Math.sin(state.wave.phase + dx * waveFreq - waveProgress * state.wave.speed * 7.0);
        micro = crest * ripple * crestHeight * 0.03 + trail * hump * ripple * crestHeight * 0.014;
      }

      const y = surfaceY + wave + wave2 - raise + micro;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.closePath();

    const alpha = layerIdx === 0 ? 0.22 : layerIdx === 1 ? 0.28 : 0.18;
    ctx.fillStyle = `rgba(147, 197, 253, ${alpha})`;
    ctx.fill();

    // Petit trait lumineux sur la crête
    ctx.strokeStyle = layerIdx === 0 ? `rgba(186, 230, 253, ${0.16})` : `rgba(147, 197, 253, ${0.12})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    let started = false;
    for (let x = 0; x <= w; x += step) {
      const baseScale = state.wave ? (0.25 + 0.25 * (1 - wavePulse)) : 1;
      const wave = Math.sin(state.waterPhase * (1.0 + layerIdx * 0.12) + x * 0.03 + layerIdx * 2.2) * (2.5 + layerIdx) * baseScale;
      const wave2 = Math.sin(state.waterPhase * 1.7 + x * 0.06 + layerIdx) * (1.1 + layerIdx * 0.4) * baseScale;

      let raise = 0;
      let micro = 0;
      if (state.wave) {
        const dx = x - waveFrontX;
        const crestW = waveSigma * (0.45 + layerIdx * 0.05);
        const trailW = waveSigma * (0.80 + layerIdx * 0.07);

        const tt = dx / crestW;
        const crest = Math.exp(-(tt * tt * tt * tt) / 2);
        const trail = dx < 0 ? Math.exp(dx / Math.max(1, trailW)) : 0;

        const crestHeight = state.wave.amp * (0.62 + layerIdx * 0.08);
        const env = wavePulse * (0.85 + 0.15 * waveFade);
        // "Rouleau" : bosses oscillantes dans la traînée derrière le front
        const rollLen = Math.max(60, w * 0.24);
        const rollK = (Math.PI * 2) / rollLen;
        const rollPhase = (-dx) * rollK + state.wave.phase * 0.25 + state.waterPhase * 0.5 - waveProgress * 2.2;
        let hump = dx < 0 ? Math.max(0, Math.sin(rollPhase)) : 0;
        hump = hump * hump * (3 - 2 * hump);

        raise = crestHeight * env * (crest + 0.55 * trail + 0.25 * trail * hump);

        const ripple = Math.sin(state.wave.phase + dx * waveFreq - waveProgress * state.wave.speed * 7.0);
        micro = crest * ripple * crestHeight * 0.03 + trail * hump * ripple * crestHeight * 0.014;
      }

      const y = surfaceY + wave + wave2 - raise + micro;
      if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
    }
    ctx.stroke();
  };

  drawWaveLayer(0);
  drawWaveLayer(1);
  drawWaveLayer(2);

  // Bulles / scintillement
  for (const b of state.bubbles) {
    const shimmer = 0.6 + 0.4 * Math.sin(b.phase + state.waterPhase);
    const a = b.alpha * shimmer;
    const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r * 3);
    g.addColorStop(0, `rgba(186, 230, 253, ${a * 0.35})`);
    g.addColorStop(0.4, `rgba(56, 189, 248, ${a * 0.22})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r * 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ─── Sable : dunes basses + tempête de sable occasionnelle ───────────────────

function spawnSandDust(w, h, gust = false) {
  const baseY = gust ? rand(h * 0.04, h * 0.98) : rand(h * 0.62, h * 0.98);
  return {
    x: gust ? rand(-w * 0.2, w * 1.15) : rand(0, w),
    y: baseY,
    vx: gust ? rand(1.3, 3.2) : rand(0.35, 1.0),
    vy: gust ? rand(-0.18, 0.12) : rand(-0.08, 0.06),
    r: gust ? rand(0.9, 2.2) : rand(0.6, 1.4),
    alpha: gust ? rand(0.28, 0.58) : rand(0.08, 0.22),
    life: gust ? rand(55, 95) : rand(90, 170),
  };
}

function initSable(w, h) {
  return {
    time: 0,
    dunePhase: rand(0, Math.PI * 2),
    dust: Array.from({ length: Math.max(38, Math.floor(w / 5.5)) }, () => spawnSandDust(w, h, false)),
    gustActive: false,
    gustTimer: 0,
    gustCooldown: rand(220, 420),
  };
}

function updateSable(state, w, h, dt) {
  const s = dt / 16;
  state.time += 0.02 * s;
  state.dunePhase += 0.011 * s;

  if (!state.gustActive) {
    state.gustCooldown -= s;
    if (state.gustCooldown <= 0) {
      state.gustActive = true;
      state.gustTimer = rand(80, 150);
      const burstCount = randInt(24, 46);
      for (let i = 0; i < burstCount; i++) {
        state.dust.push(spawnSandDust(w, h, true));
      }
    }
  } else {
    state.gustTimer -= s;
    if (state.gustTimer <= 0) {
      state.gustActive = false;
      state.gustCooldown = rand(280, 520);
    }
  }

  for (let i = state.dust.length - 1; i >= 0; i--) {
    const p = state.dust[i];
    const boost = state.gustActive ? 1.85 : 1;
    p.x += p.vx * s * boost;
    p.y += p.vy * s + Math.sin(state.time * 2.1 + p.x * 0.015) * 0.08 * s;
    p.life -= (state.gustActive ? 1.15 : 0.8) * s;
    if (p.life <= 0 || p.x > w * 1.25 || p.y < -20 || p.y > h + 16) {
      Object.assign(p, spawnSandDust(w, h, state.gustActive && Math.random() < 0.45));
    }
  }
}

function drawSable(ctx, state, w, h) {
  const bg = ctx.createLinearGradient(0, h * 0.48, 0, h);
  bg.addColorStop(0, 'rgba(245, 158, 11, 0)');
  bg.addColorStop(0.45, 'rgba(217, 119, 6, 0.10)');
  bg.addColorStop(1, 'rgba(120, 53, 15, 0.30)');
  ctx.fillStyle = bg;
  ctx.fillRect(0, h * 0.45, w, h * 0.55);

  const layers = [
    { y: h * 0.80, a1: 10, a2: 5, c1: 'rgba(245, 158, 11, 0.30)', c2: 'rgba(202, 138, 4, 0.62)' },
    { y: h * 0.86, a1: 14, a2: 7, c1: 'rgba(234, 179, 8, 0.26)', c2: 'rgba(180, 83, 9, 0.60)' },
    { y: h * 0.92, a1: 9, a2: 5, c1: 'rgba(217, 119, 6, 0.32)', c2: 'rgba(120, 53, 15, 0.72)' },
  ];
  const step = Math.max(4, Math.floor(w / 92));
  for (let li = 0; li < layers.length; li++) {
    const L = layers[li];
    const grad = ctx.createLinearGradient(0, L.y - L.a1 * 1.3, 0, h);
    grad.addColorStop(0, L.c1);
    grad.addColorStop(1, L.c2);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(0, L.y);
    for (let x = 0; x <= w; x += step) {
      const waveA = Math.sin(x * (0.02 + li * 0.004) + state.dunePhase * (1 + li * 0.18)) * L.a1;
      const waveB = Math.cos(x * (0.009 + li * 0.002) + state.dunePhase * 0.8 + li) * L.a2;
      ctx.lineTo(x, L.y + waveA + waveB);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
  }

  if (state.gustActive) {
    const strength = Math.max(0, Math.min(1, state.gustTimer / 45));
    const fog = ctx.createLinearGradient(0, 0, w, h);
    fog.addColorStop(0, `rgba(254, 243, 199, ${0.015 + 0.02 * strength})`);
    fog.addColorStop(0.45, `rgba(245, 158, 11, ${0.08 + 0.06 * strength})`);
    fog.addColorStop(1, `rgba(120, 53, 15, ${0.02 + 0.03 * strength})`);
    ctx.fillStyle = fog;
    ctx.fillRect(0, 0, w, h);

    const haze = ctx.createRadialGradient(w * 0.55, h * 0.46, 0, w * 0.55, h * 0.46, Math.max(w, h) * 0.9);
    haze.addColorStop(0, `rgba(251, 191, 36, ${0.06 + 0.05 * strength})`);
    haze.addColorStop(1, 'rgba(120, 53, 15, 0)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, w, h);
  }

  for (const p of state.dust) {
    const a = p.alpha * (0.55 + 0.45 * Math.sin(state.time * 2.3 + p.x * 0.03));
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 1.8);
    g.addColorStop(0, `rgba(254, 243, 199, ${a})`);
    g.addColorStop(0.6, `rgba(245, 158, 11, ${a * 0.65})`);
    g.addColorStop(1, 'rgba(120, 53, 15, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ─── Forge Runique : glyphes rouge-or + particules de braise ─────────────────

function makeRunicGlyph(w, h) {
  const side = Math.random() < 0.5 ? 'left' : 'right';
  const x = side === 'left' ? rand(w * 0.02, w * 0.16) : rand(w * 0.84, w * 0.98);
  return {
    x,
    y: rand(h * 0.10, h * 0.90),
    size: rand(8, 16),
    alpha: rand(0.15, 0.35),
    phase: rand(0, Math.PI * 2),
    drift: rand(-0.05, 0.05),
    char: ['ᚠ', 'ᚱ', 'ᚦ', 'ᚨ', 'ᚲ', 'ᛃ', 'ᛟ'][randInt(0, 6)],
  };
}

function initOrnnRunic(w, h) {
  return {
    t: rand(0, Math.PI * 2),
    glyphs: Array.from({ length: Math.max(14, Math.floor(h / 18)) }, () => makeRunicGlyph(w, h)),
    embers: Array.from({ length: Math.max(16, Math.floor(w / 18)) }, () => ({
      x: rand(0, w),
      y: rand(h * 0.58, h),
      vx: rand(-0.25, 0.25),
      vy: rand(-0.8, -0.25),
      r: rand(0.8, 2.0),
      life: rand(40, 95),
      maxLife: 1,
    })),
    impactCooldown: rand(160, 280),
    impact: null,
  };
}

function updateOrnnRunic(state, w, h, dt) {
  const s = dt / 16;
  state.t += 0.018 * s;
  state.impactCooldown -= s;

  if (!state.impact && state.impactCooldown <= 0) {
    state.impact = {
      x: rand(w * 0.2, w * 0.8),
      y: rand(h * 0.3, h * 0.72),
      t: 0,
      duration: randInt(30, 48),
      rune: ['ᚠ', 'ᚱ', 'ᚦ', 'ᚨ', 'ᚲ', 'ᛃ', 'ᛟ'][randInt(0, 6)],
    };
    state.impactCooldown = rand(220, 360);
  }

  if (state.impact) {
    state.impact.t += s;
    if (state.impact.t >= state.impact.duration) {
      state.impact = null;
    }
  }

  for (const g of state.glyphs) {
    g.phase += 0.02 * s;
    g.y += g.drift * s;
    if (g.y < h * 0.06) g.y = h * 0.94;
    if (g.y > h * 0.94) g.y = h * 0.06;
  }
  for (const e of state.embers) {
    e.x += e.vx * s;
    e.y += e.vy * s;
    e.life -= 1.1 * s;
    if (e.life <= 0 || e.y < h * 0.45 || e.x < -5 || e.x > w + 5) {
      e.x = rand(0, w);
      e.y = rand(h * 0.62, h);
      e.vx = rand(-0.25, 0.25);
      e.vy = rand(-0.8, -0.25);
      e.r = rand(0.8, 2.0);
      e.life = rand(45, 110);
    }
  }
}

function drawOrnnRunic(ctx, state, w, h) {
  const sideGlowL = ctx.createLinearGradient(0, 0, w * 0.22, 0);
  sideGlowL.addColorStop(0, 'rgba(239, 68, 68, 0.22)');
  sideGlowL.addColorStop(1, 'rgba(239, 68, 68, 0)');
  ctx.fillStyle = sideGlowL;
  ctx.fillRect(0, 0, w * 0.22, h);

  const sideGlowR = ctx.createLinearGradient(w * 0.78, 0, w, 0);
  sideGlowR.addColorStop(0, 'rgba(234, 179, 8, 0)');
  sideGlowR.addColorStop(1, 'rgba(234, 179, 8, 0.20)');
  ctx.fillStyle = sideGlowR;
  ctx.fillRect(w * 0.78, 0, w * 0.22, h);

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const g of state.glyphs) {
    const pulse = 0.55 + 0.45 * Math.sin(state.t * 2.1 + g.phase);
    let impactBoost = 0;
    if (state.impact) {
      const dx = g.x - state.impact.x;
      const dy = g.y - state.impact.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      const reach = Math.max(50, w * 0.34);
      impactBoost = Math.max(0, 1 - d / reach);
    }
    ctx.font = `${g.size}px serif`;
    ctx.shadowBlur = 10 * pulse + impactBoost * 18;
    ctx.shadowColor = `rgba(245, 158, 11, ${(0.45 + impactBoost * 0.35) * pulse})`;
    ctx.fillStyle = `rgba(254, 243, 199, ${g.alpha * pulse * (1 + impactBoost * 1.5)})`;
    ctx.fillText(g.char, g.x, g.y + Math.sin(g.phase) * 2);
  }
  ctx.restore();

  if (state.impact) {
    const it = Math.max(0, Math.min(1, state.impact.t / state.impact.duration));
    const boom = Math.sin(it * Math.PI);
    const rr = (w * 0.14) + boom * (w * 0.34);
    const gx = state.impact.x;
    const gy = state.impact.y;

    // Diffusion d'impact de marteau (centre moins opaque + fondu progressif)
    const flash = ctx.createRadialGradient(gx, gy, 0, gx, gy, rr * 1.25);
    flash.addColorStop(0, `rgba(254, 243, 199, ${0.18 * boom})`);
    flash.addColorStop(0.20, `rgba(251, 191, 36, ${0.20 * boom})`);
    flash.addColorStop(0.58, `rgba(239, 68, 68, ${0.12 * boom})`);
    flash.addColorStop(1, 'rgba(239, 68, 68, 0)');
    ctx.fillStyle = flash;
    ctx.beginPath();
    ctx.arc(gx, gy, rr * 1.45, 0, Math.PI * 2);
    ctx.fill();

    // Halo externe très diffus pour étaler l'impact
    const outer = ctx.createRadialGradient(gx, gy, rr * 0.2, gx, gy, rr * 1.9);
    outer.addColorStop(0, `rgba(251, 191, 36, ${0.07 * boom})`);
    outer.addColorStop(0.55, `rgba(239, 68, 68, ${0.05 * boom})`);
    outer.addColorStop(1, 'rgba(239, 68, 68, 0)');
    ctx.fillStyle = outer;
    ctx.beginPath();
    ctx.arc(gx, gy, rr * 1.9, 0, Math.PI * 2);
    ctx.fill();

    // Rune centrale renforcée après impact
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${Math.round(18 + 22 * boom)}px serif`;
    ctx.shadowBlur = 24 * boom;
    ctx.shadowColor = `rgba(251, 191, 36, ${0.7 * boom})`;
    ctx.fillStyle = `rgba(255, 251, 235, ${0.78 * boom})`;
    ctx.fillText(state.impact.rune, gx, gy);
    ctx.restore();
  }

  for (const e of state.embers) {
    const a = Math.max(0, Math.min(1, e.life / 110));
    const gg = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.r * 2.8);
    gg.addColorStop(0, `rgba(251, 191, 36, ${0.6 * a})`);
    gg.addColorStop(0.5, `rgba(239, 68, 68, ${0.35 * a})`);
    gg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gg;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r * 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ─── Gojo Infinity : distortion cyan + orbes suspendues ─────────────────────

function makeInfinityOrb(w, h) {
  return {
    x: rand(w * 0.2, w * 0.8),
    y: rand(h * 0.18, h * 0.82),
    r: rand(4, 10),
    phase: rand(0, Math.PI * 2),
    speed: rand(0.005, 0.014),
    alpha: rand(0.18, 0.38),
  };
}

function initGojoInfinity(w, h) {
  return {
    t: rand(0, Math.PI * 2),
    ringPhase: rand(0, Math.PI * 2),
    orbs: Array.from({ length: Math.max(10, Math.floor(w / 26)) }, () => makeInfinityOrb(w, h)),
  };
}

function updateGojoInfinity(state, w, h, dt) {
  const s = dt / 16;
  state.t += 0.016 * s;
  state.ringPhase += 0.012 * s;
  for (const o of state.orbs) {
    o.phase += o.speed * s * 3;
  }
}

function drawGojoInfinity(ctx, state, w, h) {
  const cx = w * 0.5;
  const cy = h * 0.52;

  const haze = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.62);
  haze.addColorStop(0, 'rgba(125, 211, 252, 0.18)');
  haze.addColorStop(0.45, 'rgba(56, 189, 248, 0.09)');
  haze.addColorStop(1, 'rgba(14, 116, 144, 0)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.translate(cx, cy);
  for (let i = 0; i < 4; i++) {
    const t = i / 4;
    const rx = w * (0.22 + t * 0.08);
    const ry = h * (0.10 + t * 0.04);
    const a = 0.08 + 0.05 * Math.sin(state.ringPhase * 2 + i);
    ctx.strokeStyle = `rgba(186, 230, 253, ${a})`;
    ctx.lineWidth = 1.2 + i * 0.35;
    ctx.beginPath();
    for (let p = 0; p <= 80; p++) {
      const u = (p / 80) * Math.PI * 2;
      const x = Math.sin(u) * rx;
      const y = Math.sin(u * 2 + state.ringPhase + i * 0.5) * ry;
      if (p === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();

  for (const o of state.orbs) {
    const x = o.x + Math.sin(state.t * 1.4 + o.phase) * 7;
    const y = o.y + Math.cos(state.t * 1.1 + o.phase * 1.2) * 5;
    const a = o.alpha * (0.65 + 0.35 * Math.sin(state.t * 3 + o.phase));
    const gg = ctx.createRadialGradient(x, y, 0, x, y, o.r * 2.6);
    gg.addColorStop(0, `rgba(224, 242, 254, ${a})`);
    gg.addColorStop(0.5, `rgba(56, 189, 248, ${a * 0.55})`);
    gg.addColorStop(1, 'rgba(14, 116, 144, 0)');
    ctx.fillStyle = gg;
    ctx.beginPath();
    ctx.arc(x, y, o.r * 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ─── Personnage parfait : fusion runique + infini + sable + lune ────────────

function initPerfectCharacter(w, h) {
  return {
    t: rand(0, Math.PI * 2),
    dunePhase: rand(0, Math.PI * 2),
    ringPhase: rand(0, Math.PI * 2),
    glyphs: Array.from({ length: Math.max(12, Math.floor(h / 22)) }, () => ({
      x: rand(w * 0.06, w * 0.94),
      y: rand(h * 0.10, h * 0.90),
      size: rand(8, 14),
      phase: rand(0, Math.PI * 2),
      alpha: rand(0.10, 0.24),
      char: ['ᚠ', 'ᚱ', 'ᚦ', 'ᚨ', 'ᚲ', 'ᛃ', 'ᛟ'][randInt(0, 6)],
    })),
    stars: Array.from({ length: Math.max(18, Math.floor(w / 16)) }, () => ({
      x: rand(0, w),
      y: rand(0, h * 0.62),
      r: rand(0.7, 1.7),
      phase: rand(0, Math.PI * 2),
      alpha: rand(0.12, 0.28),
    })),
  };
}

function updatePerfectCharacter(state, w, h, dt) {
  const s = dt / 16;
  state.t += 0.017 * s;
  state.dunePhase += 0.010 * s;
  state.ringPhase += 0.014 * s;
  for (const g of state.glyphs) g.phase += 0.018 * s;
  for (const st of state.stars) st.phase += 0.028 * s;
}

function drawPerfectCharacter(ctx, state, w, h) {
  const cx = w * 0.5;
  const cy = h * 0.48;
  const epicPulse = 0.5 + 0.5 * Math.sin(state.t * 2.8);

  // Aura globale prisme (plus flashy)
  const aura = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.72);
  aura.addColorStop(0, `rgba(253, 224, 71, ${0.18 + 0.06 * epicPulse})`);
  aura.addColorStop(0.33, `rgba(125, 211, 252, ${0.15 + 0.05 * epicPulse})`);
  aura.addColorStop(0.66, `rgba(196, 181, 253, ${0.13 + 0.05 * epicPulse})`);
  aura.addColorStop(1, 'rgba(15, 23, 42, 0)');
  ctx.fillStyle = aura;
  ctx.fillRect(0, 0, w, h);

  // Flash central épique
  const coreFlash = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.38);
  coreFlash.addColorStop(0, `rgba(255, 255, 255, ${0.12 + 0.12 * epicPulse})`);
  coreFlash.addColorStop(0.45, `rgba(250, 204, 21, ${0.10 + 0.08 * epicPulse})`);
  coreFlash.addColorStop(1, 'rgba(250, 204, 21, 0)');
  ctx.fillStyle = coreFlash;
  ctx.fillRect(0, 0, w, h);

  // Anneaux "infini" (plus marqués)
  ctx.save();
  ctx.translate(cx, cy);
  for (let i = 0; i < 5; i++) {
    const rx = w * (0.18 + i * 0.05);
    const ry = h * (0.08 + i * 0.025);
    const a = 0.14 + 0.11 * Math.sin(state.ringPhase * 2 + i * 0.7);
    ctx.strokeStyle = `rgba(186, 230, 253, ${a})`;
    ctx.lineWidth = 1.6 + i * 0.32;
    ctx.beginPath();
    for (let p = 0; p <= 92; p++) {
      const u = (p / 92) * Math.PI * 2;
      const x = Math.sin(u) * rx;
      const y = Math.sin(u * 2 + state.ringPhase + i * 0.45) * ry;
      if (p === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();

  // Runes renforcées
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const g of state.glyphs) {
    const pulse = 0.6 + 0.4 * Math.sin(state.t * 2.0 + g.phase);
    ctx.font = `${g.size}px serif`;
    ctx.shadowBlur = 11 + 7 * pulse;
    ctx.shadowColor = `rgba(251, 191, 36, ${0.35 + 0.25 * pulse})`;
    ctx.fillStyle = `rgba(255, 251, 235, ${g.alpha * (0.85 + 0.65 * pulse)})`;
    ctx.fillText(g.char, g.x, g.y + Math.sin(g.phase) * 2.2);
  }
  ctx.restore();

  // Lune en coin + faisceaux subtils
  const moonX = w * 0.86;
  const moonY = h * 0.10;
  const moon = ctx.createRadialGradient(moonX, moonY, 0, moonX, moonY, Math.max(w, h) * 0.18);
  moon.addColorStop(0, 'rgba(255, 255, 255, 0.40)');
  moon.addColorStop(0.4, 'rgba(226, 232, 240, 0.18)');
  moon.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = moon;
  ctx.beginPath();
  ctx.arc(moonX, moonY, Math.max(w, h) * 0.16, 0, Math.PI * 2);
  ctx.fill();

  for (let i = 0; i < 8; i++) {
    const t = i / 6;
    const theta = lerp(0.5, 1.25, t) + Math.sin(state.t + i) * 0.03;
    const len = h * 0.66;
    const x2 = moonX + Math.cos(theta) * len;
    const y2 = moonY + Math.sin(theta) * len;
    const rg = ctx.createLinearGradient(moonX, moonY, x2, y2);
    rg.addColorStop(0, 'rgba(255, 255, 255, 0.16)');
    rg.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.strokeStyle = rg;
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(moonX, moonY);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  // Étoiles
  for (const st of state.stars) {
    const a = st.alpha * (0.65 + 0.35 * Math.sin(st.phase + state.t * 2.4));
    ctx.fillStyle = `rgba(226, 232, 240, ${a})`;
    ctx.beginPath();
    ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Dunes bas de carte (subtiles)
  const duneY = h * 0.90;
  const dg = ctx.createLinearGradient(0, duneY - 16, 0, h);
  dg.addColorStop(0, 'rgba(245, 158, 11, 0.16)');
  dg.addColorStop(1, 'rgba(120, 53, 15, 0.50)');
  ctx.fillStyle = dg;
  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.lineTo(0, duneY);
  const step = Math.max(5, Math.floor(w / 90));
  for (let x = 0; x <= w; x += step) {
    const yy = duneY + Math.sin(x * 0.022 + state.dunePhase) * 7 + Math.cos(x * 0.01 + state.dunePhase * 0.7) * 3;
    ctx.lineTo(x, yy);
  }
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();
}

// ─── Nuit : rayon de lune en haut + sol fracturé + pierres lévitantes ────

function initNightMoon(w, h) {
  const groundY = h * 0.78;

  const fissures = [];
  const fissCount = Math.max(10, Math.floor(w / 35));
  for (let i = 0; i < fissCount; i++) {
    const x1 = rand(0, w);
    const y1 = rand(groundY - 10, h - 10);
    const segs = randInt(3, 6);
    let x = x1;
    let y = y1;
    for (let s = 0; s < segs; s++) {
      const x2 = Math.max(0, Math.min(w, x + rand(-w * 0.08, w * 0.08)));
      const y2 = Math.max(groundY - 25, Math.min(h, y + rand(-10, 25)));
      fissures.push({
        x1: x,
        y1: y,
        x2,
        y2,
        width: rand(0.8, 2.4),
        alpha: rand(0.08, 0.22),
      });
      x = x2;
      y = y2;
    }
  }

  const stonesCount = Math.max(6, Math.floor(w / 45));
  const stones = Array.from({ length: stonesCount }, () => ({
    x: rand(10, w - 10),
    baseY: rand(groundY - 55, groundY - 15),
    floatAmp: rand(14, 32),
    phase: rand(0, Math.PI * 2),
    size: rand(7, 16),
    alpha: rand(0.35, 0.85),
  }));

  const chunks = [];
  let x = 0;
  while (x < w) {
    const chunkW = rand(14, 34);
    chunks.push({
      x1: x,
      x2: Math.min(w, x + chunkW),
      topY: rand(groundY - 6, groundY + 18),
      depth: rand(16, 42),
      skew: rand(-8, 8),
      alpha: rand(0.34, 0.66),
    });
    x += chunkW + rand(2, 6);
  }

  return { groundY, moonPhase: rand(0, Math.PI * 2), fissures, stones, chunks };
}

function updateNightMoon(state, w, h, dt) {
  const s = dt / 16;
  state.moonPhase += 0.01 * s;

  // Pierres qui lévitent
  for (const st of state.stones) {
    st.phase += 0.005 * s;
    st.y = st.baseY + Math.sin(st.phase) * st.floatAmp;
    // Petite dérive horizontale
    st.x += Math.sin(st.phase * 0.6) * 0.04 * s;
    if (st.x < -20) st.x = w + 20;
    if (st.x > w + 20) st.x = -20;
  }
}

function drawNightMoon(ctx, state, w, h) {
  // Fond nuit (éclairci)
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, 'rgba(18, 14, 60, 0.48)');
  bg.addColorStop(0.45, 'rgba(30, 41, 59, 0.36)');
  bg.addColorStop(1, 'rgba(2, 6, 23, 0.52)');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  const moonX = w * 0.14;
  const moonY = h * 0.13;

  // Glow de lune + halos
  const moonGlow = ctx.createRadialGradient(moonX, moonY, 0, moonX, moonY, Math.max(w, h) * 0.6);
  moonGlow.addColorStop(0, 'rgba(255, 255, 255, 0.22)');
  moonGlow.addColorStop(0.2, 'rgba(226, 232, 240, 0.12)');
  moonGlow.addColorStop(0.42, 'rgba(191, 219, 254, 0.06)');
  moonGlow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = moonGlow;
  ctx.fillRect(0, 0, w, h);

  // Rayons de lune (faisceau)
  ctx.save();
  ctx.translate(moonX, moonY);
  const rayCount = 7;
  const len = h * 0.74;
  for (let i = 0; i < rayCount; i++) {
    const t = i / (rayCount - 1);
    const angle = lerp(0.12, 1.02, t) + Math.sin(state.moonPhase * 1.6 + i) * 0.02;
    const sw = lerp(6.5, 1.8, Math.abs(t - 0.5) * 2);
    const g = ctx.createLinearGradient(0, 0, 0, len);
    g.addColorStop(0, 'rgba(255, 255, 255, 0)');
    g.addColorStop(0.2, 'rgba(255, 255, 255, 0.07)');
    g.addColorStop(0.6, 'rgba(226, 232, 240, 0.08)');
    g.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.save();
    ctx.rotate(angle);
    ctx.fillStyle = g;
    ctx.fillRect(-sw / 2, 0, sw, len);
    ctx.restore();
  }
  ctx.restore();

  // Sol fracturé en bas
  const ridge = state.groundY + Math.sin(state.moonPhase) * 1.2;
  const groundG = ctx.createLinearGradient(0, ridge, 0, h);
  groundG.addColorStop(0, 'rgba(148, 163, 184, 0.14)');
  groundG.addColorStop(0.35, 'rgba(75, 85, 99, 0.24)');
  groundG.addColorStop(1, 'rgba(0, 0, 0, 0.40)');
  ctx.fillStyle = groundG;

  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.lineTo(0, ridge + Math.sin(0) * 3);
  const step = Math.max(5, Math.floor(w / 90));
  for (let x = 0; x <= w; x += step) {
    const jag = Math.sin(x * 0.11 + state.moonPhase * 0.9) * 1.4 + Math.sin(x * 0.23 + 0.9) * 0.9;
    ctx.lineTo(x, ridge + jag);
  }
  // Morceaux de sol explosés (angles plus rigides)
  for (const c of state.chunks || []) {
    const top = c.topY + Math.sin(state.moonPhase + c.x1 * 0.03) * 1.2;
    ctx.fillStyle = `rgba(30, 41, 59, ${c.alpha})`;
    ctx.beginPath();
    ctx.moveTo(c.x1, top);
    ctx.lineTo(c.x2, top + Math.sin(c.x2 * 0.09 + state.moonPhase) * 1.1);
    ctx.lineTo(c.x2 + c.skew * 0.3, Math.min(h, top + c.depth * 0.55));
    ctx.lineTo((c.x1 + c.x2) * 0.5 + c.skew, Math.min(h, top + c.depth));
    ctx.lineTo(c.x1 - c.skew * 0.25, Math.min(h, top + c.depth * 0.5));
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = `rgba(226, 232, 240, ${0.16 + c.alpha * 0.15})`;
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(c.x1, top);
    ctx.lineTo(c.x2, top + 0.6);
    ctx.stroke();
  }

  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();

  // Fissures lumineuses
  for (const f of state.fissures) {
    const a = f.alpha * (0.65 + 0.35 * Math.sin(state.moonPhase + f.x1 * 0.01));
    ctx.strokeStyle = `rgba(226, 232, 240, ${a * 0.75})`;
    ctx.lineWidth = f.width;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(f.x1, f.y1);
    ctx.lineTo(f.x2, f.y2);
    ctx.stroke();
  }

  // Pierres lévitantes
  for (const st of state.stones) {
    const y = st.y ?? st.baseY;
    const r = st.size;

    // Ombre
    ctx.fillStyle = `rgba(0,0,0,${0.18 * st.alpha})`;
    ctx.beginPath();
    ctx.ellipse(st.x, state.groundY + 14, r * 0.9, r * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();

    // Corps de pierre (ellipsoïde) + glow
    const glow = ctx.createRadialGradient(st.x, y, 0, st.x, y, r * 3.2);
    glow.addColorStop(0, `rgba(216, 180, 254, ${0.22 * st.alpha})`);
    glow.addColorStop(0.35, `rgba(99, 102, 241, ${0.14 * st.alpha})`);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(st.x, y, r * 1.7, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `rgba(148, 163, 184, ${0.22 * st.alpha})`;
    ctx.beginPath();
    ctx.ellipse(st.x, y, r * 0.85, r * 0.55, Math.sin(st.phase) * 0.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `rgba(255, 255, 255, ${0.08 * st.alpha})`;
    ctx.beginPath();
    ctx.ellipse(st.x - r * 0.25, y - r * 0.15, r * 0.25, r * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ─── Tempête : nuages noirs en haut + petits éclairs fréquents + gros éclairs occasionnels ───

function spawnStormCloud(w, h) {
  return {
    x: rand(-w * 0.1, w * 1.1),
    y: rand(0, h * 0.38),
    r: rand(28, 70),
    vx: rand(-0.18, 0.18),
    alpha: rand(0.18, 0.45),
    phase: rand(0, Math.PI * 2),
  };
}

function initStormTempest(w, h) {
  return {
    clouds: Array.from({ length: Math.max(14, Math.floor(w / 35)) }, () => spawnStormCloud(w, h)),
    cloudPhase: rand(0, Math.PI * 2),
    smallTimer: rand(40, 90),
    bigTimer: rand(220, 520),
    bolts: [],
  };
}

function makeLightningBolt(w, h, kind) {
  const big = kind === 'big';
  const startX = rand(0, w);
  const startY = rand(h * 0.02, h * 0.18);
  const endY = big ? rand(h * 0.35, h * 0.8) : rand(h * 0.28, h * 0.62);
  const steps = big ? randInt(7, 11) : randInt(5, 9);
  const thickness = big ? rand(1.8, 3.4) : rand(1.0, 2.2);
  const life = big ? 18 : 12;
  const phase = rand(0, Math.PI * 2);

  const points = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const y = lerp(startY, endY, t) + Math.sin(phase + t * 8) * (big ? 16 : 12) * (1 - t * 0.2);
    const sway = Math.cos(phase * 0.8 + t * 6) * (big ? 26 : 18) * (1 - t * 0.15);
    const x = startX + sway + Math.sin(phase + i * 1.5) * (big ? 8 : 6);
    points.push({ x: Math.max(0, Math.min(w, x)), y: Math.max(0, Math.min(h, y)) });
  }

  return { kind, points, thickness, life, maxLife: life };
}

function updateStormTempest(state, w, h, dt) {
  const s = dt / 16;
  state.cloudPhase += 0.008 * s;

  for (const c of state.clouds) {
    c.x += c.vx * s;
    if (c.x < -w * 0.3) c.x = w + w * 0.3;
    if (c.x > w + w * 0.3) c.x = -w * 0.3;
    c.phase += 0.02 * s;
  }

  state.smallTimer -= s;
  state.bigTimer -= s;

  if (state.smallTimer <= 0) {
    state.bolts.push(makeLightningBolt(w, h, 'small'));
    state.smallTimer = rand(55, 120);
  }
  if (state.bigTimer <= 0) {
    state.bolts.push(makeLightningBolt(w, h, 'big'));
    state.bigTimer = rand(320, 760);
  }

  for (let i = state.bolts.length - 1; i >= 0; i--) {
    const b = state.bolts[i];
    b.life -= 1.2 * s * (b.kind === 'big' ? 0.85 : 1);
    if (b.life <= 0) state.bolts.splice(i, 1);
  }
}

function drawStormTempest(ctx, state, w, h) {
  // Fond (moins sombre)
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, 'rgba(30, 41, 59, 0.64)');
  bg.addColorStop(0.42, 'rgba(30, 41, 59, 0.42)');
  bg.addColorStop(1, 'rgba(2, 6, 23, 0.30)');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Nuages noirs (haut)
  for (const c of state.clouds) {
    const pulse = 0.7 + 0.3 * Math.sin(c.phase + state.cloudPhase);
    const a = c.alpha * pulse;
    const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r);
    g.addColorStop(0, `rgba(15, 23, 42, ${a * 0.72})`);
    g.addColorStop(0.4, `rgba(30, 41, 59, ${a * 0.58})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Ombres de nuages (dégradé)
  const fog = ctx.createLinearGradient(0, 0, 0, h * 0.55);
  fog.addColorStop(0, 'rgba(15,23,42,0.28)');
  fog.addColorStop(0.3, 'rgba(15,23,42,0.12)');
  fog.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = fog;
  ctx.fillRect(0, 0, w, h * 0.55);

  // Eclairs
  for (const b of state.bolts) {
    const t = b.life / b.maxLife;
    const alpha = t * t;
    if (alpha <= 0) continue;

    ctx.save();
    ctx.shadowBlur = (b.kind === 'big' ? 22 : 14) * alpha;
    ctx.shadowColor = b.kind === 'big' ? `rgba(147, 197, 253, ${alpha})` : `rgba(226, 232, 240, ${alpha})`;
    ctx.lineWidth = b.thickness * (0.75 + 0.6 * alpha);
    ctx.lineCap = 'round';

    const stroke = b.kind === 'big'
      ? `rgba(186, 230, 253, ${0.85 * alpha})`
      : `rgba(255, 255, 255, ${0.70 * alpha})`;
    ctx.strokeStyle = stroke;
    ctx.beginPath();
    ctx.moveTo(b.points[0].x, b.points[0].y);
    for (let i = 1; i < b.points.length; i++) {
      ctx.lineTo(b.points[i].x, b.points[i].y);
    }
    ctx.stroke();

    // Petit halo additionnel
    if (b.kind === 'big') {
      for (const p of b.points) {
        const gg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, b.thickness * 8);
        gg.addColorStop(0, `rgba(147, 197, 253, ${0.25 * alpha})`);
        gg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gg;
        ctx.beginPath();
        ctx.arc(p.x, p.y, b.thickness * 4.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
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
  water_sun:      { init: initWaterSun, update: updateWaterSun, draw: drawWaterSun },
  sable:          { init: initSable, update: updateSable, draw: drawSable },
  ornn_runic:     { init: initOrnnRunic, update: updateOrnnRunic, draw: drawOrnnRunic },
  gojo_infinity:  { init: initGojoInfinity, update: updateGojoInfinity, draw: drawGojoInfinity },
  perfect_character: { init: initPerfectCharacter, update: updatePerfectCharacter, draw: drawPerfectCharacter },
  night_moon:     { init: initNightMoon, update: updateNightMoon, draw: drawNightMoon },
  storm_tempest:  { init: initStormTempest, update: updateStormTempest, draw: drawStormTempest },
  nature:         { init: initNature, update: updateNature, draw: drawNature },
  titane:         { init: initTitane, update: updateTitane, draw: drawTitane },
  cosmique:       { init: initCosmic, update: updateCosmic, draw: drawCosmic },
  transcendance:  { init: initTranscendance, update: updateTranscendance, draw: drawTranscendance },
  champion:       { init: initChampion, update: updateChampion, draw: drawChampion },
  ancient:        { init: initAncient, update: updateAncient, draw: drawAncient },
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
        zIndex: 3,
      }}
    />
  );
});

export default CardBorderCanvas;
