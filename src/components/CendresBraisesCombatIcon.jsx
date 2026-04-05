/**
 * Pastille combat : braises Cendrés (pool au 1er sort, jauge PV perdus vers la prochaine braise).
 */
const R = 11;
const C = 2 * Math.PI * R;

export function CendresBraisesCombatIcon({
  pool = 0,
  firstSpellThisTurn = true,
  cumulativeHpDamage = 0,
  threshold = 0.1,
  maxHpRef = 1,
}) {
  const chunk = Math.max(1e-9, threshold * maxHpRef);
  const remainder = cumulativeHpDamage - Math.floor(cumulativeHpDamage / chunk) * chunk;
  const progress = Math.min(1, Math.max(0, remainder / chunk));
  const dashOffset = C * (1 - progress);
  const hasPool = firstSpellThisTurn && pool > 0;
  const spent = !firstSpellThisTurn;

  return (
    <span className="relative inline-flex w-full h-full min-w-0 min-h-0 items-center justify-center overflow-visible">
      <svg
        viewBox="0 0 32 32"
        className="absolute inset-0 m-auto h-[22px] w-[22px] shrink-0"
        aria-hidden
      >
        <circle cx="16" cy="16" r={R} fill="none" stroke="#44403c" strokeWidth="2.2" />
        <circle
          cx="16"
          cy="16"
          r={R}
          fill="none"
          stroke={spent ? '#57534e' : '#d97706'}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={dashOffset}
          transform="rotate(-90 16 16)"
          style={{ transition: 'stroke-dashoffset 0.25s ease' }}
        />
        <path
          d="M16 22c-1.2-2.4-.8-4.2 0-5.8.6 1.4 1.4 2.6 1.2 4.2.8-1.6 1-3.4.3-5.1-.2 2.1-1.1 3.8-1.5 6.7z"
          fill={hasPool ? '#f59e0b' : spent ? '#57534e' : '#78716c'}
          opacity={hasPool ? 1 : 0.75}
        />
        <path
          d="M14.5 20.5c-.5-1.8.2-3.1 1-4.2-.2 1.5-.1 2.8.4 4z"
          fill={hasPool ? '#fbbf24' : '#57534e'}
          opacity={hasPool ? 0.9 : 0.5}
        />
      </svg>
      <span
        className={`relative z-[1] mt-0.5 font-bold leading-none tabular-nums ${
          pool > 9 ? 'text-[7px]' : 'text-[9px]'
        } ${hasPool ? 'text-amber-300' : spent ? 'text-stone-500' : 'text-stone-400'}`}
      >
        {spent ? '·' : pool}
      </span>
    </span>
  );
}
