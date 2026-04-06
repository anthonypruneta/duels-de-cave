/**
 * Sprites donjon Red — imports explicites (pas de glob) pour que les URLs soient
 * toujours résolues au build (Vite) : CI Linux, prod, pas de sprite « fantôme ».
 * Clés en minuscules : insensible à la casse côté données (Red.png / red.png).
 */
import urlBulbizarre from '../assets/coop/Bulbizarre.png';
import urlCarapuce from '../assets/coop/Carapuce.png';
import urlDracaufeu from '../assets/coop/Dracaufeu.png';
import urlFlorizarre from '../assets/coop/Florizarre.png';
import urlLokhlass from '../assets/coop/Lokhlass.png';
import urlPikachu from '../assets/coop/Pikachu.png';
import urlRed from '../assets/coop/Red.png';
import urlRonflex from '../assets/coop/Ronflex.png';
import urlSalameche from '../assets/coop/Salameche.png';
import urlTortank from '../assets/coop/Tortank.png';

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
