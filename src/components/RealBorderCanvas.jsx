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
  // Version "coins arrondis" pour éviter les artefacts dans les angles.
  const pts = [];
  const minDim = Math.min(w, h);
  const cornerR = Math.max(14, Math.round(minDim * 0.12));

  // Périmètre d'un rectangle arrondi : 2*(w-2r)+2*(h-2r)+2πr
  const perim = 2 * (w - 2 * cornerR) + 2 * (h - 2 * cornerR) + 2 * Math.PI * cornerR;
  const step = Math.max(6, Math.round(minDim * 0.018)); // échantillonnage stable
  const count = Math.max(200, Math.floor(perim / step));

  for (let i = 0; i <= count; i++) {
    const t = i / count;
    const s = t * perim;

    // Coordonnée (x,y) sur le bord externe (rectangle arrondi) + normale intérieure (nx,ny)
    let x = 0, y = 0, nx = 0, ny = 0;

    const topLen = (w - 2 * cornerR);
    const rightLen = (h - 2 * cornerR);
    const arcLen = (Math.PI / 2) * cornerR;
    const seg1 = topLen;
    const seg2 = seg1 + arcLen;
    const seg3 = seg2 + rightLen;
    const seg4 = seg3 + arcLen;
    const seg5 = seg4 + topLen;
    const seg6 = seg5 + arcLen;
    const seg7 = seg6 + rightLen;
    // seg8 = seg7 + arcLen = perim

    if (s < seg1) {
      // Top edge (left->right)
      x = cornerR + s;
      y = 0;
      nx = 0; ny = 1;
    } else if (s < seg2) {
      // Top-right corner arc: angle -90° -> 0°
      const a = -Math.PI / 2 + ((s - seg1) / arcLen) * (Math.PI / 2);
      const cx = w - cornerR;
      const cy = cornerR;
      x = cx + Math.cos(a) * cornerR;
      y = cy + Math.sin(a) * cornerR;
      // inward normal roughly points to center: opposite of radial outward
      nx = -Math.cos(a);
      ny = -Math.sin(a);
    } else if (s < seg3) {
      // Right edge (top->bottom)
      x = w;
      y = cornerR + (s - seg2);
      nx = -1; ny = 0;
    } else if (s < seg4) {
      // Bottom-right arc: angle 0° -> 90°
      const a = 0 + ((s - seg3) / arcLen) * (Math.PI / 2);
      const cx = w - cornerR;
      const cy = h - cornerR;
      x = cx + Math.cos(a) * cornerR;
      y = cy + Math.sin(a) * cornerR;
      nx = -Math.cos(a);
      ny = -Math.sin(a);
    } else if (s < seg5) {
      // Bottom edge (right->left)
      x = (w - cornerR) - (s - seg4);
      y = h;
      nx = 0; ny = -1;
    } else if (s < seg6) {
      // Bottom-left arc: angle 90° -> 180°
      const a = Math.PI / 2 + ((s - seg5) / arcLen) * (Math.PI / 2);
      const cx = cornerR;
      const cy = h - cornerR;
      x = cx + Math.cos(a) * cornerR;
      y = cy + Math.sin(a) * cornerR;
      nx = -Math.cos(a);
      ny = -Math.sin(a);
    } else if (s < seg7) {
      // Left edge (bottom->top)
      x = 0;
      y = (h - cornerR) - (s - seg6);
      nx = 1; ny = 0;
    } else {
      // Top-left arc: angle 180° -> 270°
      const a = Math.PI + ((s - seg7) / arcLen) * (Math.PI / 2);
      const cx = cornerR;
      const cy = cornerR;
      x = cx + Math.cos(a) * cornerR;
      y = cy + Math.sin(a) * cornerR;
      nx = -Math.cos(a);
      ny = -Math.sin(a);
    }

    // Bruit le long du périmètre + bruit 2D pour "ronger" de manière organique
    // (plus nerveux pour donner des "vagues" visibles)
    const along = t * 10; // fréquence le long des bords
    const n1 = fbm2D(along, 0.7, seed);
    const n2 = fbm2D(x / 110, y / 110, seed + 777);
    const n3 = fbm2D(t * 22, 1.3, seed + 3333);
    const jag = (n1 * 0.48 + n2 * 0.22 + n3 * 0.30); // 0..1

    // Épaisseur locale: base + variations (vagues)
    const wave = (jag - 0.5) * 2; // -1..1
    const local = baseThickness * (0.70 + 0.70 * (0.5 + 0.5 * wave));

    pts.push({ x: x + nx * local, y: y + ny * local });
  }
  return pts;
}

function drawOmbre2(ctx, w, h) {
  // Bordure "vagues d'ombre" : tout le tour, noir -> violet, opacité qui tombe vers le centre.
  const minDim = Math.min(w, h);
  const seed = hashStr(`ombre2:${w}x${h}`);
  const baseThickness = Math.max(24, Math.round(minDim * 0.15));

  // Contour intérieur ondulé (la "morsure")
  const inner = buildWavyInnerContour(w, h, baseThickness, seed);

  const buildBandPath = () => {
    ctx.beginPath();
    ctx.rect(0, 0, w, h); // extérieur (bord)
    ctx.moveTo(inner[0].x, inner[0].y);
    for (let i = 1; i < inner.length; i++) ctx.lineTo(inner[i].x, inner[i].y);
    ctx.closePath();
  };

  const strokeInner = (width, style) => {
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineWidth = width;
    if (style.shadowColor) {
      ctx.shadowColor = style.shadowColor;
      ctx.shadowBlur = style.shadowBlur || 0;
    } else {
      ctx.shadowBlur = 0;
    }
    ctx.strokeStyle = style.strokeStyle;
    ctx.beginPath();
    ctx.moveTo(inner[0].x, inner[0].y);
    for (let i = 1; i < inner.length; i++) ctx.lineTo(inner[i].x, inner[i].y);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  };

  // 1) On clippe la bande (extérieur - intérieur) pour garantir que ça fait tout le tour.
  ctx.save();
  buildBandPath();
  ctx.clip('evenodd');

  // 2) Base noir profond (plein) sur toute la bande
  ctx.fillStyle = 'rgba(0, 0, 0, 0.95)';
  ctx.fillRect(0, 0, w, h);

  // 3) Violet près de la morsure (teinte + glow), sans colorer le bord externe
  ctx.globalCompositeOperation = 'lighter';
  strokeInner(
    Math.max(10, baseThickness * 0.55),
    {
      strokeStyle: 'rgba(110, 40, 180, 0.55)',
      shadowColor: 'rgba(160, 70, 255, 0.45)',
      shadowBlur: Math.max(10, minDim * 0.06),
    }
  );
  strokeInner(
    Math.max(4, baseThickness * 0.18),
    {
      strokeStyle: 'rgba(196, 181, 253, 0.35)',
      shadowColor: 'rgba(168, 85, 247, 0.55)',
      shadowBlur: Math.max(6, minDim * 0.04),
    }
  );

  // 4) Fondu vers le centre: on "efface" progressivement au niveau de la morsure
  // Plus on se rapproche du contour intérieur, plus ça devient transparent.
  ctx.globalCompositeOperation = 'destination-out';
  const fadeSteps = 7;
  for (let k = 0; k < fadeSteps; k++) {
    const t = k / (fadeSteps - 1); // 0..1
    const width = baseThickness * (0.30 + t * 1.10);
    const alpha = 0.45 * (1 - t) ** 1.6; // fort près de la morsure, faible vers l'extérieur
    strokeInner(width, { strokeStyle: `rgba(0,0,0,${alpha})` });
  }

  ctx.restore();
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

