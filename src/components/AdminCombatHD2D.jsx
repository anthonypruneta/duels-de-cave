/**
 * Onglet Admin : zone de combat HD-2D dynamique
 * Reprend les règles de combat du jeu, affiche une arène style Octopath avec
 * des "sprites" générés à partir des races/classes (emojis).
 */
import React, { useState, useRef, useEffect } from 'react';
import { simulerMatch } from '../utils/tournamentCombat';
import { replayCombatSteps } from '../utils/combatReplay';
import { races as racesData } from '../data/races';
import { classes as classesData } from '../data/classes';

const races = Object.fromEntries(Object.entries(racesData).map(([k, v]) => [k, v.icon]));
const classes = Object.fromEntries(Object.entries(classesData).map(([k, v]) => [k, v.icon]));

// Couleur d'accent par classe (pour bordure / glow du sprite)
const CLASS_COLORS = {
  'Guerrier': 'from-amber-700 to-amber-900',
  'Voleur': 'from-slate-600 to-slate-800',
  'Paladin': 'from-yellow-600 to-amber-800',
  'Healer': 'from-green-600 to-emerald-800',
  'Archer': 'from-lime-600 to-green-800',
  'Mage': 'from-violet-600 to-purple-900',
  'Demoniste': 'from-fuchsia-700 to-purple-900',
  'Masochiste': 'from-red-800 to-rose-900',
  'Briseur de Sort': 'from-stone-600 to-stone-800',
  'Succube': 'from-pink-600 to-rose-800',
  'Bastion': 'from-amber-800 to-stone-700'
};

function getClassColor(className) {
  return CLASS_COLORS[className] || 'from-stone-600 to-stone-800';
}

/** Sprite HD-2D : race + classe en "standee" sans image */
function CombatSprite({ character, side, isAttacking, isDefeated }) {
  const raceIcon = races[character?.race] || '❓';
  const classIcon = classes[character?.class] || '❓';
  const gradient = getClassColor(character?.class);

  return (
    <div
      className={`
        relative flex flex-col items-center justify-end transition-all duration-300
        ${side === 'left' ? 'origin-right' : 'origin-left'}
        ${isAttacking ? (side === 'left' ? 'animate-hd2d-attack-left' : 'animate-hd2d-attack-right') : ''}
        ${isDefeated ? 'opacity-50 scale-90' : ''}
      `}
      style={{ minHeight: '160px' }}
    >
      {/* Standee / silhouette HD-2D */}
      <div
        className={`
          relative w-24 h-32 rounded-lg border-4 flex flex-col items-center justify-center
          bg-gradient-to-b ${gradient} border-amber-600/80
          shadow-[0_0_20px_rgba(245,158,11,0.3),inset_0_1px_0_rgba(255,255,255,0.2)]
          ${isDefeated ? 'grayscale' : ''}
        `}
      >
        <span className="text-4xl drop-shadow-lg" title={character?.race}>{raceIcon}</span>
        <span className="text-2xl mt-1 drop-shadow-lg" title={character?.class}>{classIcon}</span>
      </div>
      <p className="mt-2 text-stone-200 font-bold text-sm text-center character-card-name drop-shadow-md max-w-[120px] truncate" title={character?.name}>
        {character?.name || '—'}
      </p>
    </div>
  );
}

/** Barre de vie style HD-2D */
function HPBar({ current, max, label, isLeft }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;
  return (
    <div className="w-full">
      <p className="text-stone-300 text-xs font-bold mb-1">{label}</p>
      <div className="h-4 bg-stone-800 rounded border border-stone-600 overflow-hidden shadow-inner">
        <div
          className={`h-full rounded transition-all duration-500 ${isLeft ? 'bg-amber-500' : 'bg-rose-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-stone-400 text-xs mt-0.5">{Math.max(0, current)} / {max}</p>
    </div>
  );
}

export default function AdminCombatHD2D({ characters = [] }) {
  const [char1, setChar1] = useState(null);
  const [char2, setChar2] = useState(null);
  const [phase, setPhase] = useState('selection'); // 'selection' | 'fighting' | 'ended'
  const [combatLog, setCombatLog] = useState([]);
  const [p1HP, setP1HP] = useState(0);
  const [p2HP, setP2HP] = useState(0);
  const [p1MaxHP, setP1MaxHP] = useState(0);
  const [p2MaxHP, setP2MaxHP] = useState(0);
  const [currentAction, setCurrentAction] = useState(null);
  const [winner, setWinner] = useState(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const logContainerRef = useRef(null);

  const activeChars = characters.filter((c) => !c.disabled);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [combatLog]);

  const startFight = () => {
    if (!char1 || !char2) return;
    setPhase('fighting');
    setCombatLog([]);
    setWinner(null);
    setCurrentAction(null);
    setIsAnimating(true);

    const result = simulerMatch(char1, char2);
    setP1MaxHP(result.p1MaxHP ?? 0);
    setP2MaxHP(result.p2MaxHP ?? 0);
    setP1HP(result.p1MaxHP ?? 0);
    setP2HP(result.p2MaxHP ?? 0);

    const steps = result.steps || [];

    (async () => {
      await replayCombatSteps(steps, {
        setCombatLog,
        onStepHP: (step) => {
          setP1HP(step.p1HP ?? 0);
          setP2HP(step.p2HP ?? 0);
        },
        setCurrentAction,
        speed: 'normal'
      });
      setWinner(result.winnerNom ?? null);
      setCurrentAction(null);
      setIsAnimating(false);
      setPhase('ended');
    })();
  };

  const reset = () => {
    setPhase('selection');
    setCombatLog([]);
    setCurrentAction(null);
    setWinner(null);
    setP1HP(0);
    setP2HP(0);
    setP1MaxHP(0);
    setP2MaxHP(0);
  };

  const attackingLeft = currentAction?.player === 1;
  const attackingRight = currentAction?.player === 2;
  const p1Defeated = phase !== 'selection' && p1HP <= 0;
  const p2Defeated = phase !== 'selection' && p2HP <= 0;

  return (
    <div className="bg-stone-900/70 border-2 border-amber-600 rounded-xl p-6 mb-8">
      <h2 className="text-2xl font-bold text-amber-300 mb-4">⚔️ Combat HD-2D</h2>
      <p className="text-stone-400 text-sm mb-6">
        Choisis deux personnages : le combat utilise les vraies règles du jeu et s&apos;affiche dans une arène style Octopath. Les sprites sont générés à partir de la race et de la classe (emojis).
      </p>

      {phase === 'selection' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="bg-stone-800/80 border border-stone-600 rounded-lg p-4">
              <h3 className="text-lg font-bold text-stone-200 mb-3">Combattant 1</h3>
              <select
                value={char1?.id ?? ''}
                onChange={(e) => {
                  const id = e.target.value;
                  setChar1(id ? activeChars.find((c) => c.id === id) ?? null : null);
                }}
                className="w-full bg-stone-700 border border-stone-600 text-white rounded px-3 py-2"
              >
                <option value="">— Choisir —</option>
                {activeChars.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} • {c.race} {c.class}
                  </option>
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
                onChange={(e) => {
                  const id = e.target.value;
                  setChar2(id ? activeChars.find((c) => c.id === id) ?? null : null);
                }}
                className="w-full bg-stone-700 border border-stone-600 text-white rounded px-3 py-2"
              >
                <option value="">— Choisir —</option>
                {activeChars.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} • {c.race} {c.class}
                  </option>
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
          {/* Arène HD-2D : scène avec perspective */}
          <div
            className="relative rounded-xl overflow-hidden mb-6 border-2 border-amber-700/60"
            style={{
              perspective: '1000px',
              background: 'linear-gradient(180deg, #1c1917 0%, #292524 30%, #1f2937 70%, #111827 100%)',
              minHeight: '320px'
            }}
          >
            {/* Sol / scène inclinée */}
            <div
              className="absolute inset-0 flex items-end justify-center pb-4"
              style={{
                transform: 'rotateX(8deg) scale(1.02)',
                transformStyle: 'preserve-3d',
                background: 'linear-gradient(180deg, transparent 0%, rgba(120, 53, 15, 0.25) 60%, rgba(69, 26, 3, 0.5) 100%)'
              }}
            >
              <div className="flex items-end justify-between w-full max-w-2xl px-8 md:px-16">
                <div className="flex flex-col items-center flex-1">
                  <CombatSprite
                    character={char1}
                    side="left"
                    isAttacking={attackingLeft}
                    isDefeated={p1Defeated}
                  />
                  <div className="w-full max-w-[140px] mt-2">
                    <HPBar current={p1HP} max={p1MaxHP} label={char1.name} isLeft />
                  </div>
                </div>
                <div className="flex-shrink-0 w-16 md:w-24 flex items-center justify-center text-4xl opacity-80">
                  {isAnimating && (attackingLeft || attackingRight) ? '⚔️' : '⚔️'}
                </div>
                <div className="flex flex-col items-center flex-1">
                  <CombatSprite
                    character={char2}
                    side="right"
                    isAttacking={attackingRight}
                    isDefeated={p2Defeated}
                  />
                  <div className="w-full max-w-[140px] mt-2">
                    <HPBar current={p2HP} max={p2MaxHP} label={char2.name} isLeft={false} />
                  </div>
                </div>
              </div>
            </div>
            {/* Effet de rim light en haut */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: 'linear-gradient(180deg, rgba(245,158,11,0.08) 0%, transparent 40%)'
              }}
            />
          </div>

          {/* Log de combat */}
          <div className="bg-black/50 border border-stone-700 rounded-lg p-3 max-h-48 overflow-y-auto" ref={logContainerRef}>
            <h3 className="text-stone-300 font-bold text-sm mb-2">Journal de combat</h3>
            {combatLog.length === 0 ? (
              <p className="text-stone-500 italic text-sm">Combat en cours...</p>
            ) : (
              <div className="space-y-1 text-xs font-mono text-stone-300">
                {combatLog.map((line, idx) => (
                  <div key={`log-${idx}`}>{line}</div>
                ))}
              </div>
            )}
          </div>

          {/* Victoire + bouton reset */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
            {winner && phase === 'ended' && (
              <div className="bg-amber-900/50 border border-amber-600 rounded-lg px-4 py-2">
                <span className="text-amber-300 font-bold">🏆 {winner} remporte le combat</span>
              </div>
            )}
            <button
              onClick={reset}
              className="bg-stone-600 hover:bg-stone-500 text-white px-4 py-2 rounded-lg font-bold transition"
            >
              ← Nouveau combat
            </button>
          </div>
        </>
      )}

      {activeChars.length < 2 && (
        <p className="text-amber-200/80 text-sm mt-4">Il faut au moins 2 personnages actifs pour combattre.</p>
      )}
    </div>
  );
}
