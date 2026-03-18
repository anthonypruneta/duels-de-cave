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
  // Bordure statique "premium" : glow doux + coins + specks près des bords.
  drawSoftEdgeGlow(ctx, w, h, 'top', 'rgba(168, 85, 247, 0.16)', 'rgba(88, 28, 135, 0.08)');
  drawSoftEdgeGlow(ctx, w, h, 'bottom', 'rgba(139, 92, 246, 0.18)', 'rgba(76, 29, 149, 0.09)');
  drawSoftEdgeGlow(ctx, w, h, 'left', 'rgba(168, 85, 247, 0.14)', 'rgba(88, 28, 135, 0.07)');
  drawSoftEdgeGlow(ctx, w, h, 'right', 'rgba(168, 85, 247, 0.14)', 'rgba(88, 28, 135, 0.07)');

  const cornerR = Math.min(w, h) * 0.46;
  const corners = [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: 0, y: h },
    { x: w, y: h },
  ];
  for (const c of corners) {
    const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, cornerR);
    g.addColorStop(0, 'rgba(217, 70, 239, 0.14)');
    g.addColorStop(0.35, 'rgba(139, 92, 246, 0.09)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  // Specks déterministes, concentrés vers les bords
  const seed = hashStr(`ombre2:${w}x${h}`);
  const count = Math.max(26, Math.floor((w * h) / 5200));
  for (let i = 0; i < count; i++) {
    const r1 = rand(seed + i * 11);
    const r2 = rand(seed + i * 11 + 1);
    const r3 = rand(seed + i * 11 + 2);

    // Choisir un bord (0..3)
    const side = Math.floor(r1 * 4);
    const pad = Math.min(w, h) * 0.12;
    let x = 0;
    let y = 0;
    if (side === 0) { // top
      x = r2 * w;
      y = r3 * pad;
    } else if (side === 1) { // bottom
      x = r2 * w;
      y = h - r3 * pad;
    } else if (side === 2) { // left
      x = r3 * pad;
      y = r2 * h;
    } else { // right
      x = w - r3 * pad;
      y = r2 * h;
    }

    const rad = 0.6 + rand(seed + i * 11 + 3) * 1.6;
    const alpha = 0.03 + rand(seed + i * 11 + 4) * 0.09;
    const hue = 265 + rand(seed + i * 11 + 5) * 30;

    ctx.fillStyle = `hsla(${hue},70%,72%,${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
  }

  // Double liseré subtil (extérieur + intérieur)
  ctx.strokeStyle = 'rgba(216, 180, 254, 0.10)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
  ctx.strokeStyle = 'rgba(15, 0, 30, 0.22)';
  ctx.strokeRect(1.5, 1.5, w - 3, h - 3);
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

