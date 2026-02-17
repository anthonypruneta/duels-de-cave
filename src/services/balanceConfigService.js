import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { classConstants, cooldowns, raceConstants } from '../data/combatMechanics';
import { races } from '../data/races';
import { classes } from '../data/classes';

const BALANCE_DOC_REF = doc(db, 'gameConfig', 'balance');

// Mapping nom de classe → clé dans cooldowns
const CLASS_TO_CD_KEY = {
  'Guerrier': 'war',
  'Voleur': 'rog',
  'Paladin': 'pal',
  'Healer': 'heal',
  'Archer': 'arc',
  'Mage': 'mag',
  'Demoniste': 'dem',
  'Masochiste': 'maso',
  'Succube': 'succ',
  'Bastion': 'bast'
};

const deepClone = (value) => JSON.parse(JSON.stringify(value));

const applyNumericOverrides = (target, source) => {
  Object.entries(source || {}).forEach(([key, val]) => {
    if (!(key in target)) return;
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      if (!target[key] || typeof target[key] !== 'object') target[key] = {};
      applyNumericOverrides(target[key], val);
      return;
    }

    const parsed = Number(val);
    if (!Number.isNaN(parsed)) target[key] = parsed;
  });
};

export const buildCurrentBalanceConfig = () => {
  const raceAwakenings = {};
  Object.entries(races).forEach(([raceName, info]) => {
    raceAwakenings[raceName] = deepClone(info?.awakening?.effect || {});
  });

  const raceTexts = {};
  Object.entries(races).forEach(([raceName, info]) => {
    raceTexts[raceName] = {
      bonus: info?.bonus || '',
      awakeningDescription: info?.awakening?.description || ''
    };
  });

  const classTexts = {};
  Object.entries(classes).forEach(([className, info]) => {
    classTexts[className] = {
      ability: info?.ability || '',
      description: info?.description || ''
    };
  });

  return {
    raceConstants: deepClone(raceConstants),
    classConstants: deepClone(classConstants),
    raceAwakenings,
    raceTexts,
    classTexts
  };
};




const normalizeMindflayerConfig = (config) => {
  if (!config || typeof config !== 'object') return;

  const raceMindflayer = config?.raceConstants?.mindflayer;
  if (raceMindflayer && raceMindflayer.stealSpellCapDamageScale == null) {
    const legacyReduction = Number(raceMindflayer.enemyNoCooldownSpellReduction);
    if (!Number.isNaN(legacyReduction) && legacyReduction > 0) {
      raceMindflayer.stealSpellCapDamageScale = legacyReduction;
    }
  }

  const awakeningMindflayer = config?.raceAwakenings?.Mindflayer;
  if (awakeningMindflayer && awakeningMindflayer.mindflayerStealSpellCapDamageScale == null) {
    const legacyReduction = Number(awakeningMindflayer.mindflayerEnemyNoCooldownSpellReduction);
    if (!Number.isNaN(legacyReduction) && legacyReduction > 0) {
      awakeningMindflayer.mindflayerStealSpellCapDamageScale = legacyReduction;
    }
  }
};

const normalizeGnomeConfig = (config) => {
  if (!config || typeof config !== 'object') return;

  // Migration unique : ancienne version détectée si critDmgIfFaster absent
  const gnome = config?.raceConstants?.gnome;
  if (gnome && gnome.critDmgIfFaster == null) {
    config.raceConstants.gnome = {
      critIfFaster: 0.20, critDmgIfFaster: 0.20,
      dodgeIfSlower: 0.20, capBonusIfSlower: 0.20,
      critIfEqual: 0.05, critDmgIfEqual: 0.05,
      dodgeIfEqual: 0.05, capBonusIfEqual: 0.05,
      spd: 5, cap: 5
    };
  }

  const awakeningGnome = config?.raceAwakenings?.Gnome;
  if (awakeningGnome && awakeningGnome.speedDuelCritDmgHigh == null) {
    config.raceAwakenings.Gnome = {
      speedDuelCritHigh: 0.40, speedDuelCritDmgHigh: 0.40,
      speedDuelDodgeLow: 0.40, speedDuelCapBonusLow: 0.40,
      speedDuelEqualCrit: 0.10, speedDuelEqualCritDmg: 0.10,
      speedDuelEqualDodge: 0.10, speedDuelEqualCapBonus: 0.10,
      statMultipliers: { spd: 1.05, cap: 1.05 }
    };
  }

  if (config.raceTexts?.Gnome && (gnome && gnome.critDmgIfFaster == null || awakeningGnome && awakeningGnome.speedDuelCritDmgHigh == null)) {
    config.raceTexts.Gnome.bonus = races['Gnome']?.bonus;
    config.raceTexts.Gnome.awakeningDescription = races['Gnome']?.awakening?.description;
  }
};

const applyTextOverrides = (config) => {
  if (config.raceTexts) {
    Object.entries(config.raceTexts).forEach(([raceName, raceText]) => {
      if (!races[raceName] || !raceText) return;
      if (typeof raceText.bonus === 'string') races[raceName].bonus = raceText.bonus;
      if (typeof raceText.awakeningDescription === 'string' && races[raceName].awakening) {
        races[raceName].awakening.description = raceText.awakeningDescription;
      }
    });
  }

  if (config.classTexts) {
    Object.entries(config.classTexts).forEach(([className, classText]) => {
      if (!classes[className] || !classText) return;
      if (typeof classText.ability === 'string') classes[className].ability = classText.ability;
      if (typeof classText.description === 'string') classes[className].description = classText.description;
    });
  }

  // Synchroniser les CD affichés avec les valeurs réelles de combatMechanics
  Object.entries(CLASS_TO_CD_KEY).forEach(([className, cdKey]) => {
    if (classes[className]?.ability && cooldowns[cdKey] != null) {
      classes[className].ability = classes[className].ability.replace(
        /\(CD: \d+ tours?\)/,
        `(CD: ${cooldowns[cdKey]} tour${cooldowns[cdKey] > 1 ? 's' : ''})`
      );
    }
  });
};

export const applyBalanceConfig = (config) => {
  if (!config) return;

  normalizeMindflayerConfig(config);
  normalizeGnomeConfig(config);

  if (config.raceConstants) {
    applyNumericOverrides(raceConstants, config.raceConstants);
  }

  if (config.classConstants) {
    applyNumericOverrides(classConstants, config.classConstants);
  }

  if (config.raceAwakenings) {
    Object.entries(config.raceAwakenings).forEach(([raceName, effect]) => {
      const currentEffect = races?.[raceName]?.awakening?.effect;
      if (!currentEffect || !effect) return;
      applyNumericOverrides(currentEffect, effect);
    });
  }

  applyTextOverrides(config);
};

export const loadPersistedBalanceConfig = async () => {
  try {
    const snap = await getDoc(BALANCE_DOC_REF);
    if (!snap.exists()) {
      return { success: true, data: null };
    }

    const payload = snap.data();
    const config = payload?.config;

    if (config) applyBalanceConfig(config);

    return { success: true, data: config || null };
  } catch (error) {
    console.error('Erreur chargement balance config:', error);
    return { success: false, error: error.message || 'Impossible de charger la config d’équilibrage.' };
  }
};

export const savePersistedBalanceConfig = async ({ config, updatedBy = null }) => {
  try {
    await setDoc(BALANCE_DOC_REF, {
      config,
      updatedBy,
      updatedAt: serverTimestamp()
    }, { merge: true });

    applyBalanceConfig(config);

    return { success: true };
  } catch (error) {
    console.error('Erreur sauvegarde balance config:', error);
    return { success: false, error: error.message || 'Impossible de sauvegarder la config d’équilibrage.' };
  }
};
