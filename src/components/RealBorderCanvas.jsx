import React, { useEffect, useRef } from 'react';

const DPR = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;

function rand(seed) {
  // PRNG déterministe (Mulberry32)
  let t = seed + 0x6D2B79F5;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function hashStr(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function drawSoftEdgeGlow(ctx, w, h, edge, colorA, colorB) {
  const thickness = Math.max(10, Math.min(w, h) * 0.095);
  let g;
  if (edge === 'top') g = ctx.createLinearGradient(0, 0, 0, thickness);
  else if (edge === 'bottom') g = ctx.createLinearGradient(0, h, 0, h - thickness);
  else if (edge === 'left') g = ctx.createLinearGradient(0, 0, thickness, 0);
  else g = ctx.createLinearGradient(w, 0, w - thickness, 0);

  g.addColorStop(0, colorA);
  g.addColorStop(0.6, colorB);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  if (edge === 'top') ctx.fillRect(0, 0, w, thickness);
  else if (edge === 'bottom') ctx.fillRect(0, h - thickness, w, thickness);
  else if (edge === 'left') ctx.fillRect(0, 0, thickness, h);
  else ctx.fillRect(w - thickness, 0, thickness, h);
}

function drawOmbre2(ctx, w, h) {
  // Objectif : "traits francs" + cadre travaillé + fumée opaque.
  const minDim = Math.min(w, h);
  const inset = Math.max(8, Math.round(minDim * 0.045));
  const inset2 = inset + Math.max(3, Math.round(minDim * 0.012));
  const seed = hashStr(`ombre2:${w}x${h}`);

  // 1) Base sombre autour (cadre externe)
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(0, 0, w, h);

  // 2) Fumée opaque (blobs) concentrée sur les bords + coins
  const smokePad = inset * 1.55;
  const blobCount = Math.max(140, Math.floor((w + h) * 0.55));
  for (let i = 0; i < blobCount; i++) {
    const r1 = rand(seed + i * 13);
    const r2 = rand(seed + i * 13 + 1);
    const r3 = rand(seed + i * 13 + 2);
    const r4 = rand(seed + i * 13 + 3);

    const side = Math.floor(r1 * 4);
    let x = 0;
    let y = 0;
    if (side === 0) { // top
      x = r2 * w;
      y = r3 * smokePad;
    } else if (side === 1) { // bottom
      x = r2 * w;
      y = h - r3 * smokePad;
    } else if (side === 2) { // left
      x = r3 * smokePad;
      y = r2 * h;
    } else { // right
      x = w - r3 * smokePad;
      y = r2 * h;
    }

    // Booster les coins
    const cornerBoost = (x < smokePad * 1.2 || x > w - smokePad * 1.2 || y < smokePad * 1.2 || y > h - smokePad * 1.2) ? 1.25 : 1;
    const rad = (6 + r4 * 26) * cornerBoost * (minDim / 340);
    const alpha = (0.10 + r3 * 0.22) * cornerBoost; // opaque

    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, `rgba(30, 0, 55, ${alpha})`);
    g.addColorStop(0.4, `rgba(75, 15, 120, ${alpha * 0.55})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
  }

  // 3) Glow doux (sous-couche) — plus présent que la V1 mais pas "néon"
  drawSoftEdgeGlow(ctx, w, h, 'top', 'rgba(168, 85, 247, 0.22)', 'rgba(88, 28, 135, 0.10)');
  drawSoftEdgeGlow(ctx, w, h, 'bottom', 'rgba(139, 92, 246, 0.24)', 'rgba(76, 29, 149, 0.11)');
  drawSoftEdgeGlow(ctx, w, h, 'left', 'rgba(168, 85, 247, 0.18)', 'rgba(88, 28, 135, 0.09)');
  drawSoftEdgeGlow(ctx, w, h, 'right', 'rgba(168, 85, 247, 0.18)', 'rgba(88, 28, 135, 0.09)');

  // Helpers pour traits/ornements
  const strokeFrame = (off, width, strokeStyle, glow = null) => {
    ctx.save();
    if (glow) {
      ctx.shadowColor = glow.color;
      ctx.shadowBlur = glow.blur;
    } else {
      ctx.shadowBlur = 0;
    }
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = width;
    ctx.lineJoin = 'round';
    ctx.strokeRect(off + 0.5, off + 0.5, w - (off * 2) - 1, h - (off * 2) - 1);
    ctx.restore();
  };

  // 4) Traits francs (double cadre) comme sur ta référence
  // Outer dark line
  strokeFrame(inset2, Math.max(1.5, minDim / 220), 'rgba(5, 0, 12, 0.85)');
  // Inner violet line with subtle glow
  const violet = ctx.createLinearGradient(inset, inset, w - inset, h - inset);
  violet.addColorStop(0, 'rgba(221, 214, 254, 0.95)');
  violet.addColorStop(0.35, 'rgba(196, 181, 253, 0.80)');
  violet.addColorStop(0.7, 'rgba(167, 139, 250, 0.65)');
  violet.addColorStop(1, 'rgba(233, 213, 255, 0.90)');
  strokeFrame(inset, Math.max(1.2, minDim / 260), violet, { color: 'rgba(168, 85, 247, 0.45)', blur: Math.max(4, minDim * 0.02) });

  // 5) Ornements simples (coins + diamant haut/bas) — “ça a de la gueule” sans PNG
  const cornerSize = Math.max(18, minDim * 0.14);
  const curl = (sx, sy, flipX, flipY) => {
    const x = sx;
    const y = sy;
    const fx = flipX ? -1 : 1;
    const fy = flipY ? -1 : 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(fx, fy);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // base dark stroke (shadow)
    ctx.strokeStyle = 'rgba(0,0,0,0.65)';
    ctx.lineWidth = Math.max(2.4, minDim * 0.010);
    ctx.beginPath();
    ctx.moveTo(0, cornerSize * 0.15);
    ctx.bezierCurveTo(cornerSize * 0.25, cornerSize * 0.05, cornerSize * 0.55, cornerSize * 0.15, cornerSize * 0.62, cornerSize * 0.34);
    ctx.bezierCurveTo(cornerSize * 0.72, cornerSize * 0.62, cornerSize * 0.35, cornerSize * 0.70, cornerSize * 0.22, cornerSize * 0.88);
    ctx.stroke();

    // violet highlight stroke
    ctx.shadowColor = 'rgba(168, 85, 247, 0.55)';
    ctx.shadowBlur = Math.max(6, minDim * 0.028);
    ctx.strokeStyle = 'rgba(216, 180, 254, 0.70)';
    ctx.lineWidth = Math.max(1.2, minDim * 0.005);
    ctx.beginPath();
    ctx.moveTo(cornerSize * 0.02, cornerSize * 0.22);
    ctx.bezierCurveTo(cornerSize * 0.32, cornerSize * 0.10, cornerSize * 0.58, cornerSize * 0.22, cornerSize * 0.58, cornerSize * 0.40);
    ctx.bezierCurveTo(cornerSize * 0.58, cornerSize * 0.60, cornerSize * 0.30, cornerSize * 0.70, cornerSize * 0.20, cornerSize * 0.86);
    ctx.stroke();

    ctx.restore();
  };

  const off = inset * 0.55;
  curl(off, off, false, false);
  curl(w - off, off, true, false);
  curl(off, h - off, false, true);
  curl(w - off, h - off, true, true);

  const diamond = (cx, cy) => {
    const s = Math.max(10, minDim * 0.045);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.PI / 4);
    ctx.shadowColor = 'rgba(168, 85, 247, 0.65)';
    ctx.shadowBlur = Math.max(6, minDim * 0.03);
    ctx.fillStyle = 'rgba(196, 181, 253, 0.70)';
    ctx.fillRect(-s / 2, -s / 2, s, s);
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.lineWidth = Math.max(1, minDim * 0.004);
    ctx.strokeRect(-s / 2, -s / 2, s, s);
    ctx.restore();
  };

  diamond(w / 2, inset);
  diamond(w / 2, h - inset);
}

function drawBorder(ctx, borderId, w, h) {
  if (borderId === 'ombre2') return drawOmbre2(ctx, w, h);
  return null;
}

export default function RealBorderCanvas({ borderId, className = '', style = {} }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const resizeAndDraw = () => {
      const rect = parent.getBoundingClientRect();
      const w = Math.max(1, Math.round(rect.width));
      const h = Math.max(1, Math.round(rect.height));

      canvas.width = w * DPR;
      canvas.height = h * DPR;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.scale(DPR, DPR);
      drawBorder(ctx, borderId, w, h);
      ctx.restore();
    };

    const ro = new ResizeObserver(resizeAndDraw);
    ro.observe(parent);
    resizeAndDraw();

    return () => ro.disconnect();
  }, [borderId]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        ...style,
      }}
    />
  );
}

