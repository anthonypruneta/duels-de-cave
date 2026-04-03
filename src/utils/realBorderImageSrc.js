/**
 * Résout equippedRealBorder (nom de fichier PNG dans assets/backgrounds).
 */

const realBorderPngModules = import.meta.glob('../assets/backgrounds/*.png', { eager: true, import: 'default' });

function normalizePngName(name) {
  return String(name || '').trim();
}

function isOldAsset(baseName) {
  return /Old$/i.test(baseName);
}

export function getRealBorderImageSrc(borderIdOrFile) {
  const raw = normalizePngName(borderIdOrFile);
  if (!raw) return null;

  const wantsPng = raw.toLowerCase().endsWith('.png');
  const fileName = wantsPng ? raw : `${raw}.png`;
  const base = fileName.replace(/\.png$/i, '');

  if (/^BG$/i.test(base)) return null;
  if (isOldAsset(base)) return null;

  const key = `../assets/backgrounds/${fileName}`;
  return realBorderPngModules[key] || null;
}
