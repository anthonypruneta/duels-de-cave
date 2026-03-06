/**
 * Données pour les sprites HD-2D type pixel-art (race + classe).
 * Grille de pixels : chaque caractère = une teinte (H=cheveux/casque, S=peau, O=tenue, D=tenue sombre, A=accent, W=arme).
 * Aucun emoji — uniquement des couleurs dérivées de la race et de la classe.
 */

// Teintes de peau par race (style HD-2D)
export const RACE_SKIN = {
  'Humain': { skin: '#e8c4a0', skinShadow: '#c9a882', hair: '#5c4033' },
  'Elfe': { skin: '#f5e6d3', skinShadow: '#e0d0b8', hair: '#8b7355' },
  'Orc': { skin: '#6b8e6b', skinShadow: '#4a674a', hair: '#2d3d2d' },
  'Nain': { skin: '#c4a574', skinShadow: '#a08050', hair: '#6b4423' },
  'Dragonkin': { skin: '#8b7355', skinShadow: '#5c4a32', hair: '#4a3728' },
  'Mort-vivant': { skin: '#9ca3af', skinShadow: '#6b7280', hair: '#4b5563' },
  'Lycan': { skin: '#8b6914', skinShadow: '#5c4509', hair: '#3d3206' },
  'Sylvari': { skin: '#7cb342', skinShadow: '#558b2f', hair: '#33691e' },
  'Gnome': { skin: '#d4a574', skinShadow: '#b08050', hair: '#8b6914' },
  'Sirène': { skin: '#b3e5fc', skinShadow: '#81d4fa', hair: '#0288d1' },
  'Mindflayer': { skin: '#7e57c2', skinShadow: '#5e35b1', hair: '#4527a0' }
};

// Tenue / armure par classe (couleurs principales)
export const CLASS_OUTFIT = {
  'Guerrier': { main: '#b45309', dark: '#78350f', accent: '#f59e0b' },
  'Voleur': { main: '#475569', dark: '#334155', accent: '#94a3b8' },
  'Paladin': { main: '#ca8a04', dark: '#854d0e', accent: '#fde047' },
  'Healer': { main: '#059669', dark: '#065f46', accent: '#6ee7b7' },
  'Archer': { main: '#65a30d', dark: '#4d7c0f', accent: '#bef264' },
  'Mage': { main: '#7c3aed', dark: '#5b21b6', accent: '#c4b5fd' },
  'Demoniste': { main: '#a21caf', dark: '#701a75', accent: '#f0abfc' },
  'Masochiste': { main: '#9f1239', dark: '#881337', accent: '#fda4af' },
  'Briseur de Sort': { main: '#57534e', dark: '#44403c', accent: '#a8a29e' },
  'Succube': { main: '#be185d', dark: '#9d174d', accent: '#f9a8d4' },
  'Bastion': { main: '#78716c', dark: '#57534e', accent: '#d6d3d1' }
};

function getRacePalette(race) {
  return RACE_SKIN[race] || RACE_SKIN['Humain'];
}
function getClassPalette(className) {
  return CLASS_OUTFIT[className] || { main: '#57534e', dark: '#44403c', accent: '#a8a29e' };
}

/**
 * Template pixel-art 20x32 (une ligne = 20 caractères).
 * H = cheveux/casque, S = peau, O = tenue, D = tenue sombre, A = ceinture/détail, W = arme
 */
const SPRITE_TEMPLATE = [
  '        HHHHHH        ',
  '      HHSSSSSSHH      ',
  '      HSSSSSSSSH      ',
  '       SSSSSSSS       ',
  '        SSSSSS        ',
  '    OOOOOOOOOOOOOO    ',
  '    OOODDDDDDOOOO     ',
  '    OOODDDDDDOOOO     ',
  '    OOODDDDDDOOOO  W  ',
  '    OOODDDDDDOOOO  W  ',
  '    OOODDDDDDOOOO  W  ',
  '      OODDDDOO     W  ',
  '    DDDDDDDDDD     W  ',
  '    DDDDDDDDDD   WW   ',
  '    DDDDDDDDDD   WW   ',
  '    DDDDDDDDDD    W   ',
  '    DDDDDDDDDD        ',
  '    DDDDDDDDDD        ',
  '    DDDDDDDD          ',
  '    DDDDDD            ',
];

// Variante "caster" (robe plus longue, capuche)
const SPRITE_CASTER = [
  '      HHHHHHHH        ',
  '      HSSSSSSH        ',
  '      SSSSSSSS        ',
  '       SSSSSS         ',
  '    OOOOOOOOOOOO      ',
  '    OOOOOOOOOOOO      ',
  '    OOODDDDDOOOO   W  ',
  '    OOODDDDDOOOO   W  ',
  '    OOODDDDDOOOO  WW  ',
  '    OOODDDDDOOOO  WW  ',
  '    OOODDDDDOOOO  WW  ',
  '    OOODDDDDOOOO   W  ',
  '    DDDDDDDDDDDD   W  ',
  '    DDDDDDDDDDDD      ',
  '    DDDDDDDDDDDD      ',
  '    DDDDDDDDDDDD      ',
  '    DDDDDDDDDD        ',
  '    DDDDDDDDDD        ',
  '    DDDDDDDD          ',
  '    DDDDDD            ',
];

// Variante "melee" (épaules plus larges, armure)
const SPRITE_MELEE = [
  '      HHHHHHHH        ',
  '    HHSSSSSSSSHH      ',
  '    HSSSSSSSSSSH      ',
  '     SSSSSSSSSS       ',
  '      SSSSSSSS        ',
  '  OOOOOOOOOOOOOOOO    ',
  '  OOODDDDDDDDDOOO  W  ',
  '  OOODDDDDDDDDOOO  W  ',
  '  OOODDDDDDDDDOOO  W  ',
  '  OOODDDDDDDDDOOO WW  ',
  '  OOODDDDDDDDDOOO WW  ',
  '    OODDDDDDOO     W  ',
  '  DDDDDDDDDDDD     W  ',
  '  DDDDDDDDDDDD   WW   ',
  '  DDDDDDDDDDDD   WW   ',
  '  DDDDDDDDDDDD    W   ',
  '  DDDDDDDDDDDD        ',
  '  DDDDDDDDDDDD        ',
  '  DDDDDDDDDD          ',
  '  DDDDDDDD            ',
];

const BODY_BY_CLASS = {
  Guerrier: 'melee',
  Paladin: 'melee',
  Bastion: 'melee',
  Mage: 'caster',
  Healer: 'caster',
  Demoniste: 'caster',
  Voleur: 'default',
  Archer: 'default',
  Masochiste: 'default',
  'Briseur de Sort': 'melee',
  Succube: 'default'
};

function getTemplate(className) {
  const body = BODY_BY_CLASS[className] || 'default';
  if (body === 'melee') return SPRITE_MELEE;
  if (body === 'caster') return SPRITE_CASTER;
  return SPRITE_TEMPLATE;
}

const PIXEL_SIZE = 2;
const COLS = 20;
const ROWS = 20;

/**
 * Retourne la palette de couleurs pour un personnage (race + classe).
 */
export function getSpritePalette(race, className) {
  const r = getRacePalette(race);
  const c = getClassPalette(className);
  return {
    H: r.hair,
    S: r.skin,
    O: c.main,
    D: c.dark,
    A: c.accent,
    W: c.accent
  };
}

/**
 * Retourne les lignes du template (grille 20x20) pour la classe.
 */
export function getSpriteGrid(className) {
  return getTemplate(className);
}

/**
 * Génère les données pour dessiner le sprite en SVG (liste de rect par couleur).
 * Chaque "pixel" est un carré PIXEL_SIZE x PIXEL_SIZE.
 */
export function getSpriteRects(race, className) {
  const grid = getSpriteGrid(className);
  const palette = getSpritePalette(race, className);
  const rects = [];
  for (let row = 0; row < grid.length; row++) {
    const line = grid[row];
    for (let col = 0; col < Math.min(COLS, line.length); col++) {
      const ch = line[col];
      if (ch === ' ' || !palette[ch]) continue;
      rects.push({
        x: col * PIXEL_SIZE,
        y: row * PIXEL_SIZE,
        w: PIXEL_SIZE,
        h: PIXEL_SIZE,
        fill: palette[ch]
      });
    }
  }
  return rects;
}

export const SPRITE_VIEWBOX = { width: COLS * PIXEL_SIZE, height: ROWS * PIXEL_SIZE };
