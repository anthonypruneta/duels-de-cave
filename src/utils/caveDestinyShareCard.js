/**
 * Carte image de partage Cave Destiny (style récap Destiny Eleven).
 * Canvas pur — pas de dépendance externe.
 */

import { CAVE_DESTINY_SEASON_COUNT } from '../data/caveDestiny';
import { TROPHY_META } from './caveDestinyRecap';

const W = 1080;

const COLORS = {
  bg0: '#1c1410',
  bg1: '#2a1f18',
  bg2: '#3d2a1a',
  panel: 'rgba(12, 10, 8, 0.55)',
  amber: '#f59e0b',
  amberSoft: '#fbbf24',
  amberDim: 'rgba(245, 158, 11, 0.35)',
  text: '#faf7f2',
  textMuted: 'rgba(250, 247, 242, 0.62)',
  textDim: 'rgba(250, 247, 242, 0.38)',
  sky: '#7dd3fc',
  line: 'rgba(245, 158, 11, 0.28)',
  badgeFill: '#0c4a6e',
  badgeStroke: '#38bdf8',
  starOn: '#f8fafc',
  starOff: 'rgba(248, 250, 252, 0.28)',
  countBadge: '#065f46',
};

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function wrapText(ctx, text, maxWidth) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawTrapezoidBadge(ctx, cx, y, label) {
  ctx.font = '700 28px Cinzel, Georgia, serif';
  const padX = 36;
  const tw = ctx.measureText(label).width;
  const w = tw + padX * 2;
  const h = 48;
  const x = cx - w / 2;
  const skew = 18;
  ctx.beginPath();
  ctx.moveTo(x + skew, y);
  ctx.lineTo(x + w - skew, y);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
  ctx.fillStyle = COLORS.badgeFill;
  ctx.fill();
  ctx.strokeStyle = COLORS.badgeStroke;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = COLORS.sky;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, cx, y + h / 2 + 1);
  return y + h;
}

function drawStars(ctx, cx, y, filled, total = 5) {
  const size = 22;
  const gap = 14;
  const totalW = total * size * 2 + (total - 1) * gap;
  let x = cx - totalW / 2 + size;
  for (let i = 0; i < total; i += 1) {
    ctx.beginPath();
    for (let p = 0; p < 10; p += 1) {
      const angle = -Math.PI / 2 + (p * Math.PI) / 5;
      const r = p % 2 === 0 ? size : size * 0.42;
      const px = x + Math.cos(angle) * r;
      const py = y + Math.sin(angle) * r;
      if (p === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = i < filled ? COLORS.starOn : COLORS.starOff;
    ctx.fill();
    x += size * 2 + gap;
  }
}

function drawScoreCircle(ctx, cx, cy, score) {
  const r = 118;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fill();
  ctx.setLineDash([10, 8]);
  ctx.strokeStyle = COLORS.amberSoft;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = COLORS.textMuted;
  ctx.font = '600 22px Cinzel, Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('NOTE DE CARRIÈRE', cx, cy - 42);

  ctx.fillStyle = COLORS.text;
  ctx.font = '800 96px Cinzel, Georgia, serif';
  ctx.fillText(String(score ?? 0), cx, cy + 28);
}

function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) {
      resolve(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function starsFromTier(tier) {
  const map = {
    mythe: 5,
    legende_arene: 4,
    champion_local: 3,
    aventurier: 2,
    cave_confirme: 2,
    bronze_cave: 1,
  };
  return map[tier?.id] || 1;
}

function shareStatCells(recap) {
  const s = recap.identity?.stats || {};
  const events = recap.statRows?.find((r) => r.label?.includes('Événements'))?.value || '—';
  const reussites = recap.statRows?.find((r) => r.label?.includes('Réussites'))?.value || '0';
  const echecs = recap.statRows?.find((r) => r.label?.includes('Échecs'))?.value || '0';
  return [
    { value: String(recap.identity?.seasons || CAVE_DESTINY_SEASON_COUNT), label: 'SAISONS' },
    { value: String(events), label: 'ÉVÉNEMENTS' },
    { value: String(Math.round(s.renommee || 0)), label: 'RENOMMÉE' },
    { value: String(reussites), label: 'RÉUSSITES' },
    { value: String(echecs), label: 'ÉCHECS' },
    { value: `${Math.round(s.or || 0)}`, label: 'OR' },
  ];
}

/** Palmarès : trophées gagnés d’abord, puis quelques à 0 (max 8). */
function sharePalmares(recap) {
  const earned = new Map((recap.palmares || []).map((p) => [p.key, p.count]));
  const all = Object.entries(TROPHY_META).map(([key, meta]) => ({
    key,
    icon: meta.icon,
    label: meta.label,
    count: earned.get(key) || 0,
  }));
  const won = all.filter((r) => r.count > 0).sort((a, b) => b.count - a.count);
  const zeros = all.filter((r) => r.count === 0);
  return [...won, ...zeros].slice(0, 8);
}

function drawCornerBrackets(ctx, H) {
  const m = 36;
  const len = 48;
  ctx.strokeStyle = COLORS.amberDim;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(m, m + len);
  ctx.lineTo(m, m);
  ctx.lineTo(m + len, m);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(W - m - len, m);
  ctx.lineTo(W - m, m);
  ctx.lineTo(W - m, m + len);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(m, H - m - len);
  ctx.lineTo(m, H - m);
  ctx.lineTo(m + len, H - m);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(W - m - len, H - m);
  ctx.lineTo(W - m, H - m);
  ctx.lineTo(W - m, H - m - len);
  ctx.stroke();
}

/**
 * @param {object} recap — sortie de buildCareerRecap
 * @returns {Promise<Blob>}
 */
export async function renderCaveDestinyShareCard(recap) {
  const measure = document.createElement('canvas').getContext('2d');
  const id = recap.identity || {};
  const palmares = sharePalmares(recap);
  const stats = shareStatCells(recap);

  measure.font = '800 64px Cinzel, Georgia, serif';
  const nameLines = wrapText(measure, id.name || 'Aventurier', W - 120).slice(0, 2);
  measure.font = '800 34px Cinzel, Georgia, serif';
  const headLines = wrapText(measure, recap.headline || '', W - 100).slice(0, 2);
  measure.font = 'italic 500 28px Georgia, serif';
  const nickLines = wrapText(measure, recap.nickname || '', W - 120).slice(0, 2);
  const story =
    recap.story ||
    (recap.narratives?.paragraphs || []).slice(0, 2).join(' ') ||
    '';
  measure.font = 'italic 26px Georgia, serif';
  const storyLines = wrapText(measure, story, W - 152).slice(0, 5);

  const hasPortrait = Boolean(id.characterImage);
  const rowH = 52;
  const statsH = 100 * 2 + 56;
  const palH = 48 + palmares.length * rowH + 16;

  // Estimation hauteur
  let estimated =
    72 + // top
    48 +
    28 + // badge
    56 + // stars
    260 + // score circle block
    (hasPortrait ? 160 : 0) +
    nameLines.length * 68 +
    44 + // role
    headLines.length * 40 +
    10 +
    nickLines.length * 34 +
    36 +
    statsH +
    28 +
    palH +
    28 +
    (story ? 56 + storyLines.length * 34 + 24 : 0) +
    120; // footer

  const H = Math.max(1680, Math.min(2200, Math.ceil(estimated)));

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, COLORS.bg2);
  grad.addColorStop(0.35, COLORS.bg1);
  grad.addColorStop(1, COLORS.bg0);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  for (let i = 0; i < 50; i += 1) {
    ctx.fillRect(0, (i / 50) * H, W, 1);
  }

  drawCornerBrackets(ctx, H);

  let y = 72;
  y = drawTrapezoidBadge(ctx, W / 2, y, recap.legendBadge || 'UN CAVE') + 28;

  drawStars(ctx, W / 2, y + 10, starsFromTier(recap.tier));
  y += 56;

  const scoreCy = y + 130;
  drawScoreCircle(ctx, W / 2, scoreCy, recap.score);
  y = scoreCy + 150;

  const portrait = await loadImage(id.characterImage);
  if (portrait) {
    const pr = 64;
    const px = W / 2;
    const py = y + pr;
    ctx.save();
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    const scale = Math.max((pr * 2) / portrait.width, (pr * 2) / portrait.height);
    const dw = portrait.width * scale;
    const dh = portrait.height * scale;
    ctx.drawImage(portrait, px - dw / 2, py - dh / 2, dw, dh);
    ctx.restore();
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.strokeStyle = COLORS.amber;
    ctx.lineWidth = 4;
    ctx.stroke();
    y = py + pr + 28;
  }

  ctx.fillStyle = COLORS.text;
  ctx.font = '800 64px Cinzel, Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  for (const line of nameLines) {
    ctx.fillText(line, W / 2, y);
    y += 68;
  }
  y += 8;

  ctx.fillStyle = COLORS.textMuted;
  ctx.font = '500 26px system-ui, sans-serif';
  const roleBits = [
    id.race,
    id.class,
    id.subclass,
    `${id.seasons || CAVE_DESTINY_SEASON_COUNT} saisons`,
  ].filter(Boolean);
  ctx.fillText(roleBits.join(' · '), W / 2, y);
  y += 44;

  ctx.fillStyle = COLORS.text;
  ctx.font = '800 34px Cinzel, Georgia, serif';
  for (const line of headLines) {
    ctx.fillText(line, W / 2, y);
    y += 40;
  }
  y += 10;

  if (nickLines.length) {
    ctx.fillStyle = COLORS.sky;
    ctx.font = 'italic 500 28px Georgia, serif';
    for (const line of nickLines) {
      ctx.fillText(line, W / 2, y);
      y += 34;
    }
  }
  y += 36;

  const panelX = 56;
  const panelW = W - 112;
  const cellW = panelW / 3;
  const cellH = 100;

  roundRect(ctx, panelX, y, panelW, statsH, 18);
  ctx.fillStyle = COLORS.panel;
  ctx.fill();
  ctx.strokeStyle = COLORS.line;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = COLORS.amberSoft;
  ctx.font = '700 22px Cinzel, Georgia, serif';
  ctx.textAlign = 'left';
  ctx.fillText('STATISTIQUES', panelX + 28, y + 36);

  const gridTop = y + 56;
  stats.forEach((cell, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const cx = panelX + col * cellW + cellW / 2;
    const cy = gridTop + row * cellH + cellH / 2;

    if (col > 0) {
      ctx.beginPath();
      ctx.moveTo(panelX + col * cellW, gridTop + 12);
      ctx.lineTo(panelX + col * cellW, gridTop + cellH * 2 - 12);
      ctx.strokeStyle = COLORS.line;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    if (row === 1 && col === 0) {
      ctx.beginPath();
      ctx.moveTo(panelX + 24, gridTop + cellH);
      ctx.lineTo(panelX + panelW - 24, gridTop + cellH);
      ctx.stroke();
    }

    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.text;
    ctx.font = '800 40px system-ui, sans-serif';
    ctx.fillText(cell.value, cx, cy - 8);
    ctx.fillStyle = COLORS.textMuted;
    ctx.font = '600 18px system-ui, sans-serif';
    ctx.fillText(cell.label, cx, cy + 28);
  });
  y += statsH + 28;

  roundRect(ctx, panelX, y, panelW, palH, 18);
  ctx.fillStyle = COLORS.panel;
  ctx.fill();
  ctx.strokeStyle = COLORS.line;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = COLORS.amberSoft;
  ctx.font = '700 22px Cinzel, Georgia, serif';
  ctx.textAlign = 'left';
  ctx.fillText('PALMARÈS', panelX + 28, y + 36);

  let py = y + 56;
  for (const row of palmares) {
    const active = row.count > 0;
    ctx.globalAlpha = active ? 1 : 0.38;
    ctx.font = '28px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.text;
    ctx.fillText(row.icon || '•', panelX + 28, py + 28);

    ctx.font = '600 24px system-ui, sans-serif';
    ctx.fillText(row.label, panelX + 72, py + 28);

    if (active) {
      const bx = panelX + panelW - 48;
      const by = py + 18;
      ctx.beginPath();
      ctx.arc(bx, by, 18, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.countBadge;
      ctx.fill();
      ctx.fillStyle = COLORS.text;
      ctx.font = '700 20px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(row.count), bx, by + 7);
    } else {
      ctx.fillStyle = COLORS.textDim;
      ctx.font = '600 22px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('0', panelX + panelW - 36, py + 28);
    }
    ctx.globalAlpha = 1;
    py += rowH;
  }
  y += palH + 28;

  if (storyLines.length) {
    ctx.fillStyle = COLORS.amberDim;
    ctx.font = 'italic 70px Georgia, serif';
    ctx.textAlign = 'left';
    ctx.fillText('“', panelX + 8, y + 40);

    ctx.fillStyle = COLORS.textMuted;
    ctx.font = 'italic 26px Georgia, serif';
    let qy = y + 56;
    for (const line of storyLines) {
      ctx.fillText(line, panelX + 28, qy);
      qy += 34;
    }
  }

  ctx.fillStyle = COLORS.amber;
  ctx.font = '800 36px Cinzel, Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('CAVE DESTINY', W / 2, H - 78);
  ctx.fillStyle = COLORS.textDim;
  ctx.font = '500 20px system-ui, sans-serif';
  ctx.fillText('Duels de Cave · Écrivez votre légende', W / 2, H - 42);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Génération image impossible'));
      },
      'image/png',
      1
    );
  });
}

/**
 * Partage l’image (Web Share API fichiers) ou télécharge en fallback.
 * @returns {Promise<'shared'|'downloaded'|'cancelled'>}
 */
export async function shareCaveDestinyRecapImage(recap) {
  const blob = await renderCaveDestinyShareCard(recap);
  const safeName = (recap.identity?.name || 'run')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 40);
  const fileName = `cave-destiny-${safeName || 'run'}.png`;
  const file = new File([blob], fileName, { type: 'image/png' });

  if (typeof navigator !== 'undefined' && navigator.share) {
    const payload = {
      files: [file],
      title: `${recap.identity?.name || 'Cave Destiny'} — Cave Destiny`,
      text: `${recap.identity?.name || 'Aventurier'} · Score ${recap.score} · Duels de Cave`,
    };
    const canFiles =
      typeof navigator.canShare !== 'function' || navigator.canShare({ files: [file] });
    if (canFiles) {
      try {
        await navigator.share(payload);
        return 'shared';
      } catch (err) {
        if (err?.name === 'AbortError') return 'cancelled';
      }
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return 'downloaded';
}
