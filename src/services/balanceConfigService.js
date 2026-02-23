import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { classConstants, cooldowns, raceConstants, weaponConstants } from '../data/combatMechanics';
import { races } from '../data/races';
import { classes } from '../data/classes';
import { weapons } from '../data/weapons';
import { MAGE_TOWER_PASSIVES } from '../data/mageTowerPassives';

const BALANCE_DOC_REF = doc(db, 'gameConfig', 'balance');

/**
 * À incrémenter à chaque modification des données d'équilibrage dans le code
 * (combatMechanics, races, classes, weapons, mageTowerPassives).
 * Si cette version est supérieure à celle en Firestore, le code est appliqué et poussé vers Firestore.
 */
export const BALANCE_CONFIG_VERSION = 8;

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
    weaponConstants: deepClone(weapons),
    mageTowerPassives: deepClone(MAGE_TOWER_PASSIVES),
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

  if (awakeningGnome && awakeningGnome.speedDuelCapBonusLow == null && awakeningGnome.speedDuelCapBonusHigh != null) {
    awakeningGnome.speedDuelCapBonusLow = awakeningGnome.speedDuelCapBonusHigh;
  }

  if (config.raceTexts?.Gnome && (gnome && gnome.critDmgIfFaster == null || awakeningGnome && awakeningGnome.speedDuelCritDmgHigh == null)) {
    config.raceTexts.Gnome.bonus = races['Gnome']?.bonus;
    config.raceTexts.Gnome.awakeningDescription = races['Gnome']?.awakening?.description;
  }
};


const normalizeMageTowerPassivesConfig = (config) => {
  if (!config || typeof config !== 'object' || !Array.isArray(config.mageTowerPassives)) return;

  const lastStandText = 'Vous survivez à 1 HP (1 fois par combat).';
  const onctionConfig = config.mageTowerPassives.find((passive) => passive?.id === 'onction_eternite');
  if (!onctionConfig?.levels) return;

  Object.values(onctionConfig.levels).forEach((levelData) => {
    if (!levelData || typeof levelData !== 'object') return;
    const current = typeof levelData.description === 'string' ? levelData.description.trim() : '';
    if (!current) return;
    if (!current.includes(lastStandText)) {
      levelData.description = `${current} ${lastStandText}`.trim();
    }
  });
};

const applyWeaponAndPassiveTextOverrides = (config) => {
  if (config.weaponConstants) {
    Object.entries(config.weaponConstants).forEach(([weaponId, weaponConfig]) => {
      const weapon = weapons[weaponId];
      if (!weapon || !weaponConfig) return;

      if (typeof weaponConfig.description === 'string') {
        weapon.description = weaponConfig.description;
      }

      if (weapon.effet && weaponConfig.effet && typeof weaponConfig.effet.description === 'string') {
        weapon.effet.description = weaponConfig.effet.description;
      }
    });
  }

  if (Array.isArray(config.mageTowerPassives)) {
    config.mageTowerPassives.forEach((passiveConfig, index) => {
      const passive = MAGE_TOWER_PASSIVES[index];
      if (!passive || !passiveConfig?.levels) return;

      Object.entries(passiveConfig.levels).forEach(([level, levelConfig]) => {
        if (!passive.levels?.[level] || !levelConfig) return;
        if (typeof levelConfig.description === 'string') {
          passive.levels[level].description = levelConfig.description;
        }
      });
    });
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

/**
 * Synchronise les constantes d'armes (config / admin) vers weaponConstants du combat,
 * pour que les valeurs modifiées en équilibrage soient utilisées en gameplay.
 * Exporté pour que la page équilibrage puisse l'appliquer au draft avant simulation.
 */
export const syncWeaponConstantsToCombat = (configWeaponConstants) => {
  if (!configWeaponConstants || typeof weaponConstants !== 'object') return;

  const get = (w, ...path) => {
    let cur = w;
    for (const k of path) cur = cur?.[k];
    return cur;
  };

  const mappings = [
    { weaponId: 'baton_legendaire', key: 'yggdrasil', build: (w) => ({ ...get(w, 'effet', 'values') }) },
    { weaponId: 'bouclier_legendaire', key: 'egide', build: (w) => ({ ...get(w, 'effet', 'values') }) },
    { weaponId: 'epee_legendaire', key: 'zweihander', build: (w) => ({ triggerEveryNTurns: get(w, 'effet', 'trigger', 'n'), ...get(w, 'effet', 'values') }) },
    { weaponId: 'dague_legendaire', key: 'laevateinn', build: (w) => ({ triggerEveryNTurns: get(w, 'effet', 'trigger', 'n'), ...get(w, 'effet', 'values') }) },
    { weaponId: 'marteau_legendaire', key: 'mjollnir', build: (w) => ({ triggerEveryNAttacks: get(w, 'effet', 'trigger', 'n'), ...get(w, 'effet', 'values') }) },
    { weaponId: 'lance_legendaire', key: 'gungnir', build: (w) => ({ ...get(w, 'effet', 'values') }) },
    { weaponId: 'arc_legendaire', key: 'arcCieux', build: (w) => ({ triggerEveryNTurns: get(w, 'effet', 'trigger', 'n'), ...get(w, 'effet', 'values') }) },
    { weaponId: 'tome_legendaire', key: 'codexArchon', build: (w) => ({ doubleCastTriggers: get(w, 'effet', 'trigger', 'spellCounts') ?? [2, 4], ...get(w, 'effet', 'values') }) },
    { weaponId: 'fleau_legendaire', key: 'fleauAnatheme', build: (w) => ({ ...get(w, 'effet', 'values') }) },
    { weaponId: 'arbalete_legendaire', key: 'arbaleteVerdict', build: (w) => ({ ...get(w, 'effet', 'values') }) },
    { weaponId: 'hache_legendaire', key: 'labrysAres', build: (w) => ({ ...get(w, 'effet', 'values') }) },
  ];

  mappings.forEach(({ weaponId, key, build }) => {
    const weaponConfig = configWeaponConstants[weaponId];
    if (!weaponConfig?.effet) return;
    const built = build(weaponConfig);
    if (!weaponConstants[key]) return;
    Object.keys(built).forEach((k) => {
      const v = built[k];
      if (v !== undefined && v !== null) weaponConstants[key][k] = v;
    });
  });
};

export const applyBalanceConfig = (config) => {
  if (!config) return;

  normalizeMindflayerConfig(config);
  normalizeGnomeConfig(config);
  normalizeMageTowerPassivesConfig(config);

  if (config.raceConstants) {
    applyNumericOverrides(raceConstants, config.raceConstants);
  }

  if (config.classConstants) {
    applyNumericOverrides(classConstants, config.classConstants);
  }

  if (config.weaponConstants) {
    applyNumericOverrides(weapons, config.weaponConstants);
    syncWeaponConstantsToCombat(config.weaponConstants);
  }

  if (Array.isArray(config.mageTowerPassives)) {
    config.mageTowerPassives.forEach((passive, index) => {
      if (!MAGE_TOWER_PASSIVES[index]) return;
      applyNumericOverrides(MAGE_TOWER_PASSIVES[index], passive);
    });
  }

  if (config.raceAwakenings) {
    Object.entries(config.raceAwakenings).forEach(([raceName, effect]) => {
      const currentEffect = races?.[raceName]?.awakening?.effect;
      if (!currentEffect || !effect) return;
      applyNumericOverrides(currentEffect, effect);
    });
  }

  applyWeaponAndPassiveTextOverrides(config);
  applyTextOverrides(config);
};

export const loadPersistedBalanceConfig = async () => {
  try {
    const snap = await getDoc(BALANCE_DOC_REF);
    const storedVersion = (snap.exists() && snap.data())?.sourceVersion ?? 0;
    const config = snap.exists() ? snap.data()?.config : null;

    // Si le code a une version plus récente, le code prime : on l'applique et on pousse vers Firestore
    if (BALANCE_CONFIG_VERSION > storedVersion) {
      const codeConfig = buildCurrentBalanceConfig();
      applyBalanceConfig(codeConfig);
      await setDoc(BALANCE_DOC_REF, {
        config: codeConfig,
        sourceVersion: BALANCE_CONFIG_VERSION,
        updatedBy: 'code-sync',
        updatedAt: serverTimestamp()
      }, { merge: true });
      console.log(`✅ Équilibrage: code (v${BALANCE_CONFIG_VERSION}) appliqué et synchronisé vers Firestore.`);
      return { success: true, data: codeConfig };
    }

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
      sourceVersion: BALANCE_CONFIG_VERSION,
      updatedBy: updatedBy ?? 'admin',
      updatedAt: serverTimestamp()
    }, { merge: true });

    applyBalanceConfig(config);

    return { success: true };
  } catch (error) {
    console.error('Erreur sauvegarde balance config:', error);
    return { success: false, error: error.message || 'Impossible de sauvegarder la config d’équilibrage.' };
  }
};


/**
 * Réinitialise la config Firebase avec les valeurs par défaut du code
 * Utile après une mise à jour du code pour synchroniser Firebase
 */
export const resetBalanceConfigToDefaults = async (updatedBy = 'system') => {
  try {
    const defaultConfig = buildCurrentBalanceConfig();
    await setDoc(BALANCE_DOC_REF, {
      config: defaultConfig,
      sourceVersion: BALANCE_CONFIG_VERSION,
      updatedBy,
      updatedAt: serverTimestamp(),
      resetToDefaults: true
    });

    applyBalanceConfig(defaultConfig);
    console.log('✅ Config Firebase réinitialisée aux valeurs par défaut (code)');
    return { success: true, config: defaultConfig };
  } catch (error) {
    console.error('Erreur reset balance config:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Supprime la config Firebase pour forcer l'utilisation des valeurs par défaut au prochain chargement
 */
export const clearPersistedBalanceConfig = async () => {
  try {
    const { deleteDoc } = await import('firebase/firestore');
    await deleteDoc(BALANCE_DOC_REF);
    console.log('✅ Config Firebase supprimée');
    return { success: true };
  } catch (error) {
    console.error('Erreur suppression balance config:', error);
    return { success: false, error: error.message };
  }
};
