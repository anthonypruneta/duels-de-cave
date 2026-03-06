/**
 * Onglet Admin : combat HD-2D façon vrai jeu
 * Champ de bataille 2D, personnages générés en SVG qui se déplacent,
 * s'attaquent et réagissent avec animations.
 */
import React, { useState, useRef, useEffect } from 'react';
import { simulerMatch } from '../utils/tournamentCombat';
import { races as racesData } from '../data/races';
import { classes as classesData } from '../data/classes';
import { getSpriteRects, getSpritePalette, SPRITE_VIEWBOX } from './hd2dSpriteData';

const races = Object.fromEntries(Object.entries(racesData).map(([k, v]) => [k, v.icon]));
const classes = Object.fromEntries(Object.entries(classesData).map(([k, v]) => [k, v.icon]));

/** Sprite HD-2D pixel-art : grille générée à partir de la race (peau, cheveux) + classe (tenue, arme). Style Octopath, sans emoji. */
function HD2DCharacterSprite({ character, facing, state, scale = 1 }) {
  const isLeft = facing === 'left';
  const isHit = state === 'hit';
  const isDead = state === 'dead';
  const isAttack = state === 'attack';

  const rects = character ? getSpriteRects(character.race, character.class) : [];
  const palette = character ? getSpritePalette(character.race, character.class) : null;

  return (
    <div
      style={{
        transform: `scaleX(${isLeft ? -1 : 1}) scale(${scale})`,
        transformOrigin: 'center bottom'
      }}
      className="absolute bottom-0"
    >
      <div
        className={`
          ${state === 'idle' ? 'animate-hd2d-idle' : ''}
          ${isHit ? 'animate-hd2d-hit' : ''}
          ${isDead ? 'animate-hd2d-dead opacity-80' : ''}
        `}
      >
        <svg
          viewBox={`0 0 ${SPRITE_VIEWBOX.width} ${SPRITE_VIEWBOX.height}`}
          className="block w-16 h-20 md:w-20 md:h-24 drop-shadow-xl"
          style={{
            imageRendering: 'crisp-edges',
            filter: isDead ? 'grayscale(0.7) brightness(0.85)' : undefined
          }}
        >
          <defs>
            <filter id={`hd2d-rim-${character?.id ?? 'sprite'}`} x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="-1" stdDeviation="0.3" floodColor="rgba(255,255,255,0.35)" />
              <feDropShadow dx="0" dy="1" stdDeviation="0.2" floodColor="rgba(0,0,0,0.2)" />
            </filter>
          </defs>
          <g filter={`url(#hd2d-rim-${character?.id ?? 'sprite'})`}>
            {rects.map((r, i) => (
              <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} fill={r.fill} />
            ))}
          </g>
          {isAttack && palette && (
            <g className="animate-hd2d-weapon-swing" style={{ transformOrigin: '18px 24px' }}>
              <rect x="34" y="14" width="4" height="18" fill={palette.W} opacity="0.95" />
              <rect x="36" y="8" width="2" height="8" fill={palette.W} />
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}

/** Effet de slash au moment de l'impact */
function SlashEffect({ visible, fromLeft }) {
  if (!visible) return null;
  return (
    <div
      className="absolute inset-0 flex items-center justify-center pointer-events-none"
      style={{ zIndex: 20 }}
    >
      <div
        className={`w-32 h-2 bg-gradient-to-r from-amber-400/90 to-transparent rounded-full animate-hd2d-slash ${fromLeft ? '' : 'rotate-180'}`}
        style={{ boxShadow: '0 0 20px rgba(245,158,11,0.8)' }}
      />
    </div>
  );
}

/** Nombre de dégâts flottant */
function DamagePop({ value, isHeal, x, visible }) {
  if (!visible) return null;
  return (
    <div
      className="absolute animate-hd2d-damage-pop font-bold text-xl pointer-events-none"
      style={{
        left: `${x}%`,
        top: '35%',
        transform: 'translateX(-50%)',
        color: isHeal ? '#4ade80' : '#f87171',
        textShadow: '0 0 4px #000, 0 2px 4px #000'
      }}
    >
      {isHeal ? `+${value}` : `-${value}`}
    </div>
  );
}

/** Barre de vie au-dessus du champ */
function HPBar({ current, max, label, isP1 }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;
  return (
    <div className="flex flex-col items-center min-w-[100px]">
      <span className="text-stone-200 text-xs font-bold truncate max-w-full" title={label}>{label}</span>
      <div className="w-full h-2.5 bg-stone-800 rounded border border-stone-600 overflow-hidden mt-0.5">
        <div
          className={`h-full rounded transition-all duration-300 ${isP1 ? 'bg-amber-500' : 'bg-rose-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-stone-500 text-[10px]">{Math.max(0, current)}/{max}</span>
    </div>
  );
}

/** Délais pour le replay graphique (plus longs pour les animations) */
const ANIM = {
  intro: 1200,
  turnStart: 600,
  approach: 400,
  strike: 350,
  return: 400,
  victory: 1500
};

/** Parse les logs pour extraire un montant de dégâts ou soins */
function parseDamageFromLogs(logs) {
  if (!logs?.length) return null;
  for (const line of logs) {
    const damageMatch = line.match(/(\d+)\s*points?\s*de\s*dégâts?/i);
    if (damageMatch) return { value: parseInt(damageMatch[1], 10), isHeal: false };
    const healMatch = line.match(/(\d+)\s*points?\s*de\s*vie/i);
    if (healMatch) return { value: parseInt(healMatch[1], 10), isHeal: true };
  }
  return null;
}

export default function AdminCombatHD2D({ characters = [] }) {
  const [char1, setChar1] = useState(null);
  const [char2, setChar2] = useState(null);
  const [phase, setPhase] = useState('selection');
  const [combatLog, setCombatLog] = useState([]);
  const [p1HP, setP1HP] = useState(0);
  const [p2HP, setP2HP] = useState(0);
  const [p1MaxHP, setP1MaxHP] = useState(0);
  const [p2MaxHP, setP2MaxHP] = useState(0);
  const [winner, setWinner] = useState(null);
  const [isAnimating, setIsAnimating] = useState(false);

  // Position en % sur le champ (12 = gauche, 88 = droite)
  const [p1Pos, setP1Pos] = useState(12);
  const [p2Pos, setP2Pos] = useState(88);

  // Phase d'animation: null | 'approach' | 'strike' | 'return'
  const [animPhase, setAnimPhase] = useState(null);
  const [attacker, setAttacker] = useState(null); // 1 | 2
  const [showSlash, setShowSlash] = useState(false);
  const [damagePop, setDamagePop] = useState(null); // { value, isHeal, x }
  const [p1State, setP1State] = useState('idle'); // idle | walk | attack | hit | dead
  const [p2State, setP2State] = useState('idle');

  const logContainerRef = useRef(null);
  const stepsRef = useRef([]);
  const stepIndexRef = useRef(0);

  const activeChars = characters.filter((c) => !c.disabled);
  const p1Defeated = phase !== 'selection' && p1HP <= 0;
  const p2Defeated = phase !== 'selection' && p2HP <= 0;

  useEffect(() => {
    if (logContainerRef.current) logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
  }, [combatLog]);

  const runReplay = async (steps) => {
    const allLogs = [];
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      allLogs.push(...step.logs);
      setCombatLog([...allLogs]);
      setP1HP(step.p1HP ?? 0);
      setP2HP(step.p2HP ?? 0);

      if (step.phase === 'intro') {
        await new Promise((r) => setTimeout(r, ANIM.intro));
      } else if (step.phase === 'turn_start') {
        await new Promise((r) => setTimeout(r, ANIM.turnStart));
      } else if (step.phase === 'action') {
        const isP1Attacking = step.player === 1;
        setAttacker(step.player);
        setAnimPhase('approach');
        setP1State(isP1Attacking ? 'walk' : 'idle');
        setP2State(isP1Attacking ? 'idle' : 'walk');

        // Approche
        if (isP1Attacking) {
          setP1Pos(42);
          setP2Pos(88);
        } else {
          setP1Pos(12);
          setP2Pos(58);
        }
        await new Promise((r) => setTimeout(r, ANIM.approach));

        // Frappe
        setAnimPhase('strike');
        setP1State(isP1Attacking ? 'attack' : 'hit');
        setP2State(isP1Attacking ? 'hit' : 'attack');
        setShowSlash(true);
        const dmg = parseDamageFromLogs(step.logs);
        if (dmg) setDamagePop({ ...dmg, x: isP1Attacking ? 58 : 42 });
        setP1HP(step.p1HP ?? 0);
        setP2HP(step.p2HP ?? 0);
        await new Promise((r) => setTimeout(r, ANIM.strike));
        setShowSlash(false);
        setDamagePop(null);

        // Retour
        setAnimPhase('return');
        setP1State(isP1Attacking ? 'walk' : 'idle');
        setP2State(isP1Attacking ? 'idle' : 'walk');
        setP1Pos(12);
        setP2Pos(88);
        await new Promise((r) => setTimeout(r, ANIM.return));

        setAnimPhase(null);
        setAttacker(null);
        setP1State((step.p1HP ?? 0) <= 0 ? 'dead' : 'idle');
        setP2State((step.p2HP ?? 0) <= 0 ? 'dead' : 'idle');
      } else if (step.phase === 'victory') {
        setP1State((step.p1HP ?? 0) <= 0 ? 'dead' : 'idle');
        setP2State((step.p2HP ?? 0) <= 0 ? 'dead' : 'idle');
        await new Promise((r) => setTimeout(r, ANIM.victory));
      }
    }
  };

  const startFight = async () => {
    if (!char1 || !char2) return;
    setPhase('fighting');
    setCombatLog([]);
    setWinner(null);
    setIsAnimating(true);
    setP1Pos(12);
    setP2Pos(88);
    setP1State('idle');
    setP2State('idle');
    setAnimPhase(null);
    setAttacker(null);
    setShowSlash(false);
    setDamagePop(null);

    const result = simulerMatch(char1, char2);
    setP1MaxHP(result.p1MaxHP ?? 0);
    setP2MaxHP(result.p2MaxHP ?? 0);
    setP1HP(result.p1MaxHP ?? 0);
    setP2HP(result.p2MaxHP ?? 0);
    const steps = result.steps || [];
    stepsRef.current = steps;
    stepIndexRef.current = 0;

    await runReplay(steps);
    setWinner(result.winnerNom ?? null);
    setIsAnimating(false);
    setPhase('ended');
  };

  const reset = () => {
    setPhase('selection');
    setCombatLog([]);
    setWinner(null);
    setP1HP(0);
    setP2HP(0);
    setP1MaxHP(0);
    setP2MaxHP(0);
    setP1Pos(12);
    setP2Pos(88);
    setP1State('idle');
    setP2State('idle');
    setAnimPhase(null);
    setAttacker(null);
    setShowSlash(false);
    setDamagePop(null);
  };

  return (
    <div className="bg-stone-900/70 border-2 border-amber-600 rounded-xl p-6 mb-8">
      <h2 className="text-2xl font-bold text-amber-300 mb-4">⚔️ Combat HD-2D</h2>
      <p className="text-stone-400 text-sm mb-6">
        Choisis deux personnages. Les combattants sont générés en HD-2D, se déplacent sur le champ de bataille et s&apos;attaquent avec des animations.
      </p>

      {phase === 'selection' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="bg-stone-800/80 border border-stone-600 rounded-lg p-4">
              <h3 className="text-lg font-bold text-stone-200 mb-3">Combattant 1</h3>
              <select
                value={char1?.id ?? ''}
                onChange={(e) => setChar1(e.target.value ? activeChars.find((c) => c.id === e.target.value) ?? null : null)}
                className="w-full bg-stone-700 border border-stone-600 text-white rounded px-3 py-2"
              >
                <option value="">— Choisir —</option>
                {activeChars.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} • {c.race} {c.class}</option>
                ))}
              </select>
              {char1 && (
                <div className="mt-3 flex items-center gap-3">
                  <span className="text-3xl">{races[char1.race]}</span>
                  <span className="text-3xl">{classes[char1.class]}</span>
                  <span className="text-stone-200 font-bold">{char1.name}</span>
                </div>
              )}
            </div>
            <div className="bg-stone-800/80 border border-stone-600 rounded-lg p-4">
              <h3 className="text-lg font-bold text-stone-200 mb-3">Combattant 2</h3>
              <select
                value={char2?.id ?? ''}
                onChange={(e) => setChar2(e.target.value ? activeChars.find((c) => c.id === e.target.value) ?? null : null)}
                className="w-full bg-stone-700 border border-stone-600 text-white rounded px-3 py-2"
              >
                <option value="">— Choisir —</option>
                {activeChars.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} • {c.race} {c.class}</option>
                ))}
              </select>
              {char2 && (
                <div className="mt-3 flex items-center gap-3">
                  <span className="text-3xl">{races[char2.race]}</span>
                  <span className="text-3xl">{classes[char2.class]}</span>
                  <span className="text-stone-200 font-bold">{char2.name}</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-center">
            <button
              onClick={startFight}
              disabled={!char1 || !char2 || char1.id === char2.id}
              className="bg-amber-600 hover:bg-amber-500 disabled:bg-stone-700 disabled:text-stone-500 text-white px-8 py-3 rounded-lg font-bold transition"
            >
              ⚔️ Lancer le combat HD-2D
            </button>
          </div>
        </>
      )}

      {(phase === 'fighting' || phase === 'ended') && char1 && char2 && (
        <>
          {/* Barres de vie au-dessus */}
          <div className="flex justify-between items-start gap-4 mb-4 px-2">
            <HPBar current={p1HP} max={p1MaxHP} label={char1.name} isP1 />
            <span className="text-stone-500 font-bold text-sm">VS</span>
            <HPBar current={p2HP} max={p2MaxHP} label={char2.name} isP1={false} />
          </div>

          {/* Champ de bataille 2D */}
          <div
            className="relative rounded-xl overflow-hidden mb-6 border-2 border-amber-700/60"
            style={{
              minHeight: '280px',
              background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 40%, #292524 70%, #1c1917 100%)'
            }}
          >
            {/* Sol (ligne de combat) */}
            <div
              className="absolute left-0 right-0 bottom-0 h-20"
              style={{
                background: 'linear-gradient(180deg, transparent 0%, rgba(120,53,15,0.4) 30%, rgba(69,26,3,0.7) 100%)',
                borderTop: '3px solid rgba(245,158,11,0.3)'
              }}
            />
            {/* Motif dalles (optionnel) */}
            <div
              className="absolute left-0 right-0 bottom-0 h-20 opacity-20"
              style={{
                backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 40px, rgba(0,0,0,0.3) 40px, rgba(0,0,0,0.3) 41px)'
              }}
            />

            {/* Personnage 1 */}
            <div
              className="absolute bottom-4 transition-all duration-300 ease-out"
              style={{ left: `${p1Pos}%`, transform: 'translateX(-50%)' }}
            >
              <HD2DCharacterSprite
                character={{ ...char1, id: char1.id + '-p1' }}
                facing="right"
                state={p1Defeated ? 'dead' : p1State}
                scale={1}
              />
            </div>

            {/* Personnage 2 */}
            <div
              className="absolute bottom-4 transition-all duration-300 ease-out"
              style={{ left: `${p2Pos}%`, transform: 'translateX(-50%)' }}
            >
              <HD2DCharacterSprite
                character={{ ...char2, id: char2.id + '-p2' }}
                facing="left"
                state={p2Defeated ? 'dead' : p2State}
                scale={1}
              />
            </div>

            <SlashEffect visible={showSlash} fromLeft={attacker === 1} />
            <DamagePop
              value={damagePop?.value}
              isHeal={damagePop?.isHeal}
              x={damagePop?.x}
              visible={!!damagePop}
            />

            {/* Rim light */}
            <div
              className="absolute inset-0 pointer-events-none rounded-xl"
              style={{ background: 'linear-gradient(180deg, rgba(245,158,11,0.06) 0%, transparent 50%)' }}
            />
          </div>

          {/* Log */}
          <div className="bg-black/50 border border-stone-700 rounded-lg p-3 max-h-40 overflow-y-auto" ref={logContainerRef}>
            <h3 className="text-stone-300 font-bold text-sm mb-2">Journal de combat</h3>
            {combatLog.length === 0 ? (
              <p className="text-stone-500 italic text-sm">Combat en cours...</p>
            ) : (
              <div className="space-y-1 text-xs font-mono text-stone-300">
                {combatLog.map((line, idx) => <div key={`log-${idx}`}>{line}</div>)}
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
            {winner && phase === 'ended' && (
              <div className="bg-amber-900/50 border border-amber-600 rounded-lg px-4 py-2">
                <span className="text-amber-300 font-bold">🏆 {winner} remporte le combat</span>
              </div>
            )}
            <button onClick={reset} className="bg-stone-600 hover:bg-stone-500 text-white px-4 py-2 rounded-lg font-bold transition">
              ← Nouveau combat
            </button>
          </div>
        </>
      )}

      {activeChars.length < 2 && (
        <p className="text-amber-200/80 text-sm mt-4">Il faut au moins 2 personnages actifs.</p>
      )}
    </div>
  );
}
