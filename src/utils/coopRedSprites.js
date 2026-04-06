/**
 * Sprites donjon Red — imports explicites. Chemins = noms exacts des fichiers sur le disque / Git
 * (Linux CI sensible à la casse : doit matcher GitHub à l’identique).
 */
import urlBulbizarre from '../assets/coop/bulbizarre.png';
import urlCarapuce from '../assets/coop/carapuce.png';
import urlDracaufeu from '../assets/coop/dracaufeu.png';
import urlFlorizarre from '../assets/coop/florizarre.png';
import urlLokhlass from '../assets/coop/lokhlass.png';
import urlPikachu from '../assets/coop/pikachu.png';
import urlRed from '../assets/coop/red.png';
import urlRonflex from '../assets/coop/ronflex.png';
import urlSalameche from '../assets/coop/salameche.png';
import urlTortank from '../assets/coop/tortank.png';

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
