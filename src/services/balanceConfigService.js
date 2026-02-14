import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { classConstants, raceConstants } from '../data/combatMechanics';
import { races } from '../data/races';
import { classes } from '../data/classes';

const BALANCE_DOC_REF = doc(db, 'gameConfig', 'balance');

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
};

export const applyBalanceConfig = (config) => {
  if (!config) return;

  normalizeMindflayerConfig(config);

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
