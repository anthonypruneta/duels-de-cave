/**
 * Sprites donjon Red — imports explicites. Chemins = noms exacts des fichiers sur le disque / Git
 * (Linux CI sensible à la casse : doit matcher GitHub à l’identique).
 */
// IMPORTANT: on évite les `import ... from *.png` pour que les scripts Node (simulations)
// puissent charger ce module sans erreur ESM "Unknown file extension".
const urlBulbizarre = new URL('../assets/coop/bulbizarre.png', import.meta.url).href;
const urlCarapuce = new URL('../assets/coop/carapuce.png', import.meta.url).href;
const urlDracaufeu = new URL('../assets/coop/dracaufeu.png', import.meta.url).href;
const urlFlorizarre = new URL('../assets/coop/florizarre.png', import.meta.url).href;
const urlLokhlass = new URL('../assets/coop/lokhlass.png', import.meta.url).href;
const urlPikachu = new URL('../assets/coop/pikachu.png', import.meta.url).href;
const urlRed = new URL('../assets/coop/red.png', import.meta.url).href;
const urlRonflex = new URL('../assets/coop/ronflex.png', import.meta.url).href;
const urlSalameche = new URL('../assets/coop/salameche.png', import.meta.url).href;
const urlTortank = new URL('../assets/coop/tortank.png', import.meta.url).href;

const urlByFileLower = {
  'bulbizarre.png': urlBulbizarre,
  'carapuce.png': urlCarapuce,
  'dracaufeu.png': urlDracaufeu,
  'florizarre.png': urlFlorizarre,
  'lokhlass.png': urlLokhlass,
  'pikachu.png': urlPikachu,
  'red.png': urlRed,
  'ronflex.png': urlRonflex,
  'salameche.png': urlSalameche,
  'tortank.png': urlTortank,
};

export function getCoopRedSpriteUrl(imageFile) {
  if (!imageFile) return null;
  const key = String(imageFile).trim().toLowerCase();
  return urlByFileLower[key] ?? null;
}
