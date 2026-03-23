/**
 * Sprites donjon Red (src/assets/coop). Clés insensibles à la casse pour Windows / doublons.
 */
const coopSpriteModules = import.meta.glob('../assets/coop/**/*', { eager: true, import: 'default' });

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
