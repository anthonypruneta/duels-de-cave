/**
 * RNG injectable pour des combats déterministes (ex. donjon Red coop).
 * Par défaut : Math.random() — ne change pas le tournoi / PvP existant.
 */

let _impl = () => Math.random();
const _stack = [];

export function combatRandom01() {
  return _impl();
}

/** Remplace le RNG jusqu’au pop correspondant. */
export function pushCombatRandom01(nextImpl) {
  _stack.push(_impl);
  _impl = typeof nextImpl === 'function' ? nextImpl : () => Math.random();
}

export function popCombatRandom01() {
  _impl = _stack.pop() ?? (() => Math.random());
}

/**
 * @param {() => void} fn
 * @param {() => number} rng01 — doit retourner un float dans [0, 1)
 */
export function runWithCombatRandom01(rng01, fn) {
  pushCombatRandom01(rng01);
  try {
    return fn();
  } finally {
    popCombatRandom01();
  }
}
