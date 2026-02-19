/**
 * Mini serveur pour sauvegarder l'équilibrage directement dans les fichiers
 * Lance avec: node server/balanceServer.js
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 8001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Chemin vers les fichiers de config
const COMBAT_MECHANICS_PATH = path.join(__dirname, '../src/data/combatMechanics.js');
const RACES_PATH = path.join(__dirname, '../src/data/races.js');

/**
 * Génère le contenu du fichier combatMechanics.js
 */
function generateCombatMechanicsFile(classConstants, raceConstants) {
  return `// Mécaniques de combat centralisées
// Ce fichier est la source unique de vérité pour tous les calculs de combat.
// ATTENTION: Ce fichier est généré automatiquement par la page Admin Équilibrage

// Cooldowns des classes (en tours)
export const cooldowns = {
  war: 3,   // Guerrier - Frappe pénétrante
  rog: 4,   // Voleur - Esquive
  pal: 2,   // Paladin - Riposte
  heal: 4,  // Healer - Soin puissant
  arc: 3,   // Archer - Tir multiple
  mag: 3,   // Mage - Sort magique
  dem: 1,   // Demoniste - Familier (chaque tour)
  maso: 4,  // Masochiste - Renvoi dégâts
  succ: 4,  // Succube - Coup de fouet
  bast: 4   // Bastion - Charge du rempart
};

// Constantes des classes (valeurs réelles utilisées dans le combat)
export const classConstants = ${JSON.stringify(classConstants, null, 2)};

// Constantes des races
export const raceConstants = ${JSON.stringify(raceConstants, null, 2)};

// Constantes générales
export const generalConstants = {
  baseCritChance: 0.10,    // 10% crit de base
  critMultiplier: 1.5,     // x1.5 dégâts crit (sauf Voleur)
  maxTurns: 30,            // Maximum de tours par combat
};

// Constantes des armes
export const weaponConstants = {
  laevateinn: { critDamageBonus: 0.30 },
  gungnir: { defReduction: 0.15, rescapReduction: 0.15, duration: 2 },
  mjollnir: { stunChance: 0.15 },
  aegis: { damageReduction: 0.10 },
  tyrfing: { lifestealPercent: 0.08 },
  gleipnir: { slowPercent: 0.12 },
  dainsleif: { bleedDamage: 0.03, duration: 3 },
  hofund: { damageBonus: 0.12 },
  mystletainn: { critBonus: 0.10, critDamageBonus: 0.15 },
  skofnung: { healingBonus: 0.20 },
  balmung: { shieldPercent: 0.08 },
  caladbolg: { damageBonus: 0.15 },
  hrunting: { counterChance: 0.15, counterDamage: 0.50 },
};

// Fonctions utilitaires
export const dmgPhys = (auto, def) => Math.max(1, Math.round(auto - 0.5 * def));
export const dmgCap = (cap, rescap) => Math.max(1, Math.round(cap - 0.5 * rescap));
export const calcCritChance = (attacker, defender, awakenedOverride = null) => {
  let crit = generalConstants.baseCritChance;
  const aw = awakenedOverride || attacker.awakening || {};
  if (attacker.race === 'Elfe') crit += aw.critChanceBonus ?? raceConstants.elfe.critBonus;
  const speedDuel = getSpeedDuelBonuses(attacker, defender);
  crit += speedDuel.crit;
  return Math.min(1, crit);
};

export const getCritMultiplier = (attacker, defender = null) => {
  let mult = generalConstants.critMultiplier;
  const aw = attacker.awakening || {};
  if (attacker.race === 'Elfe') mult *= (1 + (aw.critDamageBonus ?? 0));
  const speedDuel = getSpeedDuelBonuses(attacker, defender);
  mult *= (1 + speedDuel.critDmg);
  return mult;
};

export const getSpeedDuelBonuses = (attacker, defender) => {
  if (attacker.race !== 'Gnome') return { crit: 0, critDmg: 0, dodge: 0, capBonus: 0 };
  const aw = attacker.awakening || {};
  const atkSpd = attacker.base?.spd || 0;
  const defSpd = defender?.base?.spd || 0;
  if (atkSpd > defSpd) {
    const critIfFaster = aw.speedDuelCritHigh ?? raceConstants.gnome.critIfFaster;
    const critDmgIfFaster = aw.speedDuelCritDmgHigh ?? raceConstants.gnome.critDmgIfFaster;
    return { crit: critIfFaster, critDmg: critDmgIfFaster, dodge: 0, capBonus: aw.speedDuelCapBonusHigh ?? 0 };
  } else if (atkSpd < defSpd) {
    const dodgeIfSlower = aw.speedDuelDodgeLow ?? raceConstants.gnome.dodgeIfSlower;
    const capBonusIfSlower = aw.speedDuelCapBonusLow ?? raceConstants.gnome.capBonusIfSlower;
    return { crit: 0, critDmg: 0, dodge: dodgeIfSlower, capBonus: capBonusIfSlower };
  }
  const critIfEqual = aw.speedDuelEqualCrit ?? raceConstants.gnome.critIfEqual;
  const critDmgIfEqual = aw.speedDuelEqualCritDmg ?? raceConstants.gnome.critDmgIfEqual;
  const dodgeIfEqual = aw.speedDuelEqualDodge ?? raceConstants.gnome.dodgeIfEqual;
  const capBonusIfEqual = aw.speedDuelEqualCapBonus ?? raceConstants.gnome.capBonusIfEqual;
  return { crit: critIfEqual, critDmg: critDmgIfEqual, dodge: dodgeIfEqual, capBonus: capBonusIfEqual };
};

export const getRaceBonus = (raceName) => {
  const r = raceConstants[raceName.toLowerCase()] || {};
  return {
    hp: r.hp || 0,
    auto: r.auto || 0,
    def: r.def || 0,
    cap: r.cap || 0,
    rescap: r.rescap || 0,
    spd: r.spd || 0,
  };
};

export const getClassBonus = () => ({ hp: 0, auto: 0, def: 0, cap: 0, rescap: 0, spd: 0 });
`;
}

/**
 * Génère le contenu du fichier races.js avec les awakening effects
 */
function generateRacesFile(raceAwakenings, raceTexts) {
  const racesData = {};
  
  const raceIcons = {
    'Humain': '👥',
    'Elfe': '🧝',
    'Orc': '🪓',
    'Nain': '⛏️',
    'Dragonkin': '🐲',
    'Mort-vivant': '☠️',
    'Lycan': '🐺',
    'Sylvari': '🌿',
    'Gnome': '🧬',
    'Sirène': '🧜',
    'Mindflayer': '🦑'
  };

  Object.keys(raceAwakenings).forEach(raceName => {
    const awakening = raceAwakenings[raceName];
    const texts = raceTexts[raceName] || {};
    
    racesData[raceName] = {
      bonus: texts.bonus || '',
      icon: raceIcons[raceName] || '❓',
      awakening: {
        levelRequired: 100,
        description: texts.awakeningDescription || '',
        effect: awakening
      }
    };
  });

  return `// Données partagées pour les races du jeu
// ATTENTION: Ce fichier est généré automatiquement par la page Admin Équilibrage

export const races = ${JSON.stringify(racesData, null, 2)};
`;
}

// Endpoint pour sauvegarder l'équilibrage
app.post('/api/balance/save', (req, res) => {
  try {
    const { classConstants, raceConstants, raceAwakenings, raceTexts } = req.body;

    if (!classConstants || !raceConstants) {
      return res.status(400).json({ success: false, error: 'Données manquantes' });
    }

    // Générer et écrire combatMechanics.js
    const combatMechanicsContent = generateCombatMechanicsFile(classConstants, raceConstants);
    fs.writeFileSync(COMBAT_MECHANICS_PATH, combatMechanicsContent, 'utf8');
    console.log('✅ combatMechanics.js mis à jour');

    // Générer et écrire races.js si les données sont fournies
    if (raceAwakenings && raceTexts) {
      const racesContent = generateRacesFile(raceAwakenings, raceTexts);
      fs.writeFileSync(RACES_PATH, racesContent, 'utf8');
      console.log('✅ races.js mis à jour');
    }

    res.json({ success: true, message: 'Fichiers mis à jour avec succès' });
  } catch (error) {
    console.error('Erreur sauvegarde:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'balance-server' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🎮 Serveur d'équilibrage lancé sur http://localhost:${PORT}`);
});
