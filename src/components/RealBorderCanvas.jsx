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
    // (plus nerveux pour donner des "vagues" visibles)
    const along = t * 10; // fréquence le long des bords
    const n1 = fbm2D(along, 0.7, seed);
    const n2 = fbm2D(x / 110, y / 110, seed + 777);
    const n3 = fbm2D(t * 22, 1.3, seed + 3333);
    const jag = (n1 * 0.48 + n2 * 0.22 + n3 * 0.30); // 0..1

    // Épaisseur locale: base + variations (vagues)
    const wave = (jag - 0.5) * 2; // -1..1
    const local = baseThickness * (0.70 + 0.70 * (0.5 + 0.5 * wave));

    pts.push({
      x: x + nx * local,
      y: y + ny * local,
    });
  }
  return pts;
}

function drawOmbre2(ctx, w, h) {
  // Bordure "vagues d'ombre" : bande qui ronge l'intérieur, noir pur -> violet.
  const minDim = Math.min(w, h);
  const seed = hashStr(`ombre2:${w}x${h}`);
  const baseThickness = Math.max(22, Math.round(minDim * 0.135));

  // Contour intérieur ondulé
  const inner = buildWavyInnerContour(w, h, baseThickness, seed);

  // Bande entre le bord externe et le contour ondulé (even-odd) = "mask"
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, w, h); // extérieur
  ctx.moveTo(inner[0].x, inner[0].y);
  for (let i = 1; i < inner.length; i++) ctx.lineTo(inner[i].x, inner[i].y);
  ctx.closePath();

  // 1) Remplissage noir pur côté bord (base solide)
  ctx.fillStyle = 'rgba(0,0,0,0.92)';
  ctx.fill('evenodd');

  // 2) Dégradé noir -> violet en partant du contour intérieur
  // On clippe à la bande puis on empile des strokes (plus violet au bord intérieur, plus noir vers l'extérieur).
  ctx.clip('evenodd');

  const drawInnerStroke = (width, color, shadow = null, comp = null) => {
    ctx.save();
    if (comp) ctx.globalCompositeOperation = comp;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    if (shadow) {
      ctx.shadowColor = shadow.color;
      ctx.shadowBlur = shadow.blur;
    } else {
      ctx.shadowBlur = 0;
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(inner[0].x, inner[0].y);
    for (let i = 1; i < inner.length; i++) ctx.lineTo(inner[i].x, inner[i].y);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  };

  // Violet "franc" au plus près de la morsure (comme ta capture)
  drawInnerStroke(
    Math.max(14, baseThickness * 0.62),
    'rgba(120, 45, 170, 0.62)',
    { color: 'rgba(160, 70, 255, 0.35)', blur: Math.max(10, minDim * 0.045) },
    'source-over'
  );
  drawInnerStroke(
    Math.max(10, baseThickness * 0.42),
    'rgba(168, 85, 247, 0.72)',
    { color: 'rgba(168, 85, 247, 0.55)', blur: Math.max(10, minDim * 0.05) },
    'lighter'
  );
  // Transition sombre vers l'extérieur (redonne le noir profond)
  drawInnerStroke(
    Math.max(18, baseThickness * 0.95),
    'rgba(0, 0, 0, 0.35)',
    { color: 'rgba(0, 0, 0, 0.55)', blur: Math.max(8, minDim * 0.04) },
    'multiply'
  );

  // Liseré net au niveau de la morsure (trait clair violet)
  drawInnerStroke(
    Math.max(2.2, minDim * 0.01),
    'rgba(216, 180, 254, 0.55)',
    { color: 'rgba(168, 85, 247, 0.65)', blur: Math.max(6, minDim * 0.03) },
    'lighter'
  );

  // Micro-brume opaque "crade" qui suit les vagues (petits blobs sur le contour)
  const blobN = Math.max(90, Math.floor((w + h) * 0.20));
  for (let i = 0; i < blobN; i++) {
    const r1 = rand(seed + 9000 + i * 17);
    const r2 = rand(seed + 9000 + i * 17 + 1);
    const idx = Math.floor(r1 * (inner.length - 1));
    const p = inner[idx];
    const jitter = (r2 - 0.5) * baseThickness * 0.35;
    const rad = (4 + rand(seed + 9000 + i * 17 + 2) * 16) * (minDim / 340);
    const a = 0.10 + rand(seed + 9000 + i * 17 + 3) * 0.22;
    const gx = p.x + jitter;
    const gy = p.y + jitter;
    const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, rad);
    g.addColorStop(0, `rgba(35, 0, 70, ${a})`);
    g.addColorStop(0.35, `rgba(110, 40, 180, ${a * 0.55})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(gx, gy, rad, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();

  // Un trait sombre fin sur le bord extérieur pour "cadrer"
  ctx.strokeStyle = 'rgba(0,0,0,0.95)';
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

