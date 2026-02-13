import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { classConstants, raceConstants } from '../data/combatMechanics';
import { races } from '../data/races';

const BALANCE_DOC_REF = doc(db, 'gameConfig', 'balance');

const deepClone = (value) => JSON.parse(JSON.stringify(value));

const applyNumericOverrides = (target, source) => {
  Object.entries(source || {}).forEach(([key, val]) => {
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

  return {
    raceConstants: deepClone(raceConstants),
    classConstants: deepClone(classConstants),
    raceAwakenings
  };
};

export const applyBalanceConfig = (config) => {
  if (!config) return;

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
