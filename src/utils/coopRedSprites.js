/**
 * Sprites donjon Red (src/assets/coop). Résolution insensible à la casse (Windows / noms Git PascalCase).
 * Hors Vite (ex. node scripts/runMassSim.mjs) : pas de import.meta.glob → aucune URL (getCoopRedSpriteUrl → null).
 */
const coopSpriteModules =
  typeof import.meta !== 'undefined' && typeof import.meta.glob === 'function'
    ? import.meta.glob('../assets/coop/**/*', { eager: true, import: 'default' })
    : {};

const urlByFileLower = {};
for (const path of Object.keys(coopSpriteModules)) {
  const base = path.split('/').pop();
  if (!base || !/\.(png|jpe?g|webp|gif)$/i.test(base)) continue;
  urlByFileLower[base.toLowerCase()] = coopSpriteModules[path];
}

export function getCoopRedSpriteUrl(imageFile) {
  if (!imageFile) return null;
  const key = String(imageFile).trim().toLowerCase();
  return urlByFileLower[key] ?? null;
}
