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

function smoothstep(t) {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function hash2D(ix, iy, seed) {
  // Hash déterministe -> [0..1)
  let h = (ix * 374761393) ^ (iy * 668265263) ^ seed;
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function valueNoise2D(x, y, seed) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = x0 + 1;
  const y1 = y0 + 1;
  const sx = smoothstep(x - x0);
  const sy = smoothstep(y - y0);

  const n00 = hash2D(x0, y0, seed);
  const n10 = hash2D(x1, y0, seed);
  const n01 = hash2D(x0, y1, seed);
  const n11 = hash2D(x1, y1, seed);

  const ix0 = lerp(n00, n10, sx);
  const ix1 = lerp(n01, n11, sx);
  return lerp(ix0, ix1, sy);
}

function fbm2D(x, y, seed) {
  // Fractal brownian motion (4 octaves)
  let amp = 1;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < 4; i++) {
    sum += amp * valueNoise2D(x * freq, y * freq, seed + i * 1013);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm; // 0..1
}

function buildWavyInnerContour(w, h, baseThickness, seed) {
  // Construit un contour intérieur ondulé (liste de points) en parcourant le périmètre.
  const pts = [];
  const perim = 2 * (w + h);
  const step = Math.max(6, Math.round(Math.min(w, h) * 0.02)); // échantillonnage stable
  const count = Math.max(160, Math.floor(perim / step));

  for (let i = 0; i <= count; i++) {
    const t = i / count;
    const s = t * perim;

    // Coordonnée (x,y) sur le bord externe + normale intérieure (nx,ny)
    let x = 0, y = 0, nx = 0, ny = 0;
    if (s < w) { // top: (s,0)
      x = s; y = 0; nx = 0; ny = 1;
    } else if (s < w + h) { // right: (w, s-w)
      x = w; y = s - w; nx = -1; ny = 0;
    } else if (s < 2 * w + h) { // bottom: (2w+h - s, h)
      x = (2 * w + h) - s; y = h; nx = 0; ny = -1;
    } else { // left: (0, 2w+2h - s)
      x = 0; y = (2 * w + 2 * h) - s; nx = 1; ny = 0;
    }

    // Bruit le long du périmètre + bruit 2D pour "ronger" de manière organique
    const along = t * 6; // fréquence le long des bords
    const n1 = fbm2D(along, 0.7, seed);
    const n2 = fbm2D(x / 110, y / 110, seed + 777);
    const jag = (n1 * 0.65 + n2 * 0.35); // 0..1

    // Épaisseur locale: base + variations (vagues)
    const wave = (jag - 0.5) * 2; // -1..1
    const local = baseThickness * (0.78 + 0.48 * (0.5 + 0.5 * wave));

    pts.push({
      x: x + nx * local,
      y: y + ny * local,
    });
  }
  return pts;
}

function drawOmbre2(ctx, w, h) {
  // Bordure "vagues d'ombre" : bande qui ronge l'intérieur, noir -> violet.
  const minDim = Math.min(w, h);
  const seed = hashStr(`ombre2:${w}x${h}`);
  const baseThickness = Math.max(20, Math.round(minDim * 0.12));

  // Contour intérieur ondulé
  const inner = buildWavyInnerContour(w, h, baseThickness, seed);

  // Dessiner la bande entre le bord externe et le contour ondulé (even-odd)
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, w, h); // extérieur
  ctx.moveTo(inner[0].x, inner[0].y);
  for (let i = 1; i < inner.length; i++) ctx.lineTo(inner[i].x, inner[i].y);
  ctx.closePath();

  // Dégradé: noir profond en bord externe -> violet à l'intérieur
  const grad = ctx.createRadialGradient(w / 2, h / 2, Math.max(w, h) * 0.15, w / 2, h / 2, Math.max(w, h) * 0.85);
  grad.addColorStop(0, 'rgba(0,0,0,0)'); // centre transparent
  grad.addColorStop(0.55, 'rgba(0,0,0,0.08)');
  grad.addColorStop(0.72, 'rgba(15,0,35,0.35)');
  grad.addColorStop(0.84, 'rgba(60,15,110,0.55)');
  grad.addColorStop(1, 'rgba(0,0,0,0.92)');

  ctx.fillStyle = grad;
  ctx.fill('evenodd');
  ctx.restore();

  // Renforcer l'impression de "ronge" : un halo violet concentré près du contour intérieur
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.beginPath();
  ctx.moveTo(inner[0].x, inner[0].y);
  for (let i = 1; i < inner.length; i++) ctx.lineTo(inner[i].x, inner[i].y);
  ctx.closePath();
  ctx.strokeStyle = 'rgba(168, 85, 247, 0.22)';
  ctx.lineWidth = Math.max(10, minDim * 0.04);
  ctx.shadowColor = 'rgba(168, 85, 247, 0.35)';
  ctx.shadowBlur = Math.max(12, minDim * 0.06);
  ctx.stroke();
  ctx.restore();

  // Un trait sombre fin sur le bord extérieur pour "cadrer"
  ctx.strokeStyle = 'rgba(0,0,0,0.9)';
  ctx.lineWidth = Math.max(1.5, minDim * 0.006);
  ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
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

