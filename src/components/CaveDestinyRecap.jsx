/**
 * Écran de récapitulatif de fin de run Cave Destiny.
 */
import React, { useMemo, useState } from 'react';
import { getRaceIcon, getClassIcon } from '../data/caveDestiny';
import { buildCareerRecap } from '../utils/caveDestinyRecap';
import { shareCaveDestinyRecapImage } from '../utils/caveDestinyShareCard';

function CharacterPortrait({ src, alt, className = '' }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div
        className={`w-24 cave-destiny-tcg ${className} bg-stone-800 border border-amber-800/40 rounded-md flex items-center justify-center text-stone-500 text-xs`}
      >
        ?
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt || ''}
      referrerPolicy="no-referrer"
      className={`w-24 cave-destiny-tcg ${className} object-cover object-top bg-stone-900 border border-amber-700/50 rounded-md shadow-[0_4px_14px_rgba(0,0,0,0.45)]`}
      onError={() => setFailed(true)}
    />
  );
}

function Section({ title, children, className = '' }) {
  return (
    <section className={`mt-5 ${className}`}>
      {title ? (
        <h3 className="text-[11px] uppercase tracking-[0.2em] font-bold text-amber-500/90 mb-2.5">
          {title}
        </h3>
      ) : null}
      {children}
    </section>
  );
}

function Panel({ children, className = '' }) {
  return (
    <div
      className={`rounded-xl border border-stone-700/80 bg-stone-900/60 px-3.5 py-3 ${className}`}
    >
      {children}
    </div>
  );
}

function StatRow({ label, value, icon }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 border-b border-stone-800/80 last:border-0">
      <span className="text-sm text-stone-400">
        {icon ? <span className="mr-1.5">{icon}</span> : null}
        {label}
      </span>
      <span className="text-sm font-bold text-amber-50 tabular-nums">{value}</span>
    </div>
  );
}

const BADGE_TONE = {
  stone: 'bg-stone-800/80 text-stone-300 border-stone-600/60',
  amber: 'bg-amber-950/60 text-amber-200 border-amber-700/50',
  gold: 'bg-yellow-950/50 text-yellow-200 border-yellow-700/40',
  rose: 'bg-rose-950/40 text-rose-200 border-rose-800/40',
  violet: 'bg-violet-950/50 text-violet-200 border-violet-700/40',
  orange: 'bg-orange-950/50 text-orange-200 border-orange-700/40',
};

function ParcoursTimeline({ parcours }) {
  if (!parcours?.length) return null;
  return (
    <div className="relative pl-4">
      <div
        className="absolute left-[7px] top-2 bottom-2 w-px bg-gradient-to-b from-amber-600/70 via-stone-600/50 to-amber-700/40"
        aria-hidden="true"
      />
      <ul className="space-y-3.5">
        {parcours.map((m, i) => (
          <li key={`${m.season}-${m.title}-${i}`} className="relative pl-5">
            <span
              className="absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.55)] border border-amber-300/40"
              aria-hidden="true"
            />
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-amber-300">{m.label}</span>
              {m.badge ? (
                <span
                  className={`text-[10px] uppercase tracking-wide font-bold px-1.5 py-0.5 rounded border ${
                    BADGE_TONE[m.badgeTone] || BADGE_TONE.stone
                  }`}
                >
                  {m.badge}
                </span>
              ) : null}
            </div>
            <p className="text-sm font-semibold text-amber-50 mt-0.5">{m.title}</p>
            {m.detail ? (
              <p className="text-xs text-stone-400 mt-0.5 leading-relaxed">{m.detail}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function FaceOff({ faceOff, youName, youTitle }) {
  if (!faceOff) return null;
  return (
    <div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <Panel className="!px-2.5 !py-2.5">
          <p className="text-[10px] uppercase tracking-wide text-stone-500">Vous</p>
          <p className="text-sm font-bold text-amber-50 truncate">{youName}</p>
          <p className="text-[11px] text-amber-400/90 mt-0.5 leading-snug">{youTitle}</p>
        </Panel>
        <Panel className="!px-2.5 !py-2.5">
          <p className="text-[10px] uppercase tracking-wide text-stone-500">
            {faceOff.fromPantheon ? 'Rival (Panthéon)' : 'Rival'}
          </p>
          <p className="text-sm font-bold text-amber-50 truncate">{faceOff.rivalName}</p>
          <p className="text-[11px] text-orange-300/90 mt-0.5 leading-snug">{faceOff.rivalTitle}</p>
        </Panel>
      </div>
      <Panel>
        {faceOff.rows.map((row) => {
          const youWins = row.you > row.rival;
          const rivalWins = row.rival > row.you;
          return (
            <div
              key={row.key}
              className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 py-1.5 border-b border-stone-800/80 last:border-0"
            >
              <span
                className={`text-sm font-bold tabular-nums text-right ${
                  youWins ? 'text-amber-300' : 'text-stone-400'
                }`}
              >
                {row.you}
              </span>
              <span className="text-[11px] text-stone-500 text-center px-1">{row.label}</span>
              <span
                className={`text-sm font-bold tabular-nums ${
                  rivalWins ? 'text-orange-300' : 'text-stone-400'
                }`}
              >
                {row.rival}
              </span>
            </div>
          );
        })}
      </Panel>
      <p className="mt-3 text-sm italic text-stone-400 leading-relaxed">{faceOff.narrative}</p>
    </div>
  );
}

/**
 * @param {{
 *   career: object,
 *   pantheon?: object[],
 *   onReplay: () => void,
 *   onHome: () => void,
 *   onMyRuns?: () => void,
 * }} props
 */
export default function CaveDestinyRecap({
  career,
  pantheon = [],
  onReplay,
  onHome,
  onMyRuns,
}) {
  const [shareMsg, setShareMsg] = useState(null);
  const [sharing, setSharing] = useState(false);
  const [showAllParcours, setShowAllParcours] = useState(false);

  const recap = useMemo(
    () => buildCareerRecap(career, { pantheon }),
    [career, pantheon]
  );

  const id = recap.identity;
  const parcoursVisible = showAllParcours
    ? recap.parcours
    : recap.parcours.slice(0, 6);

  const handleShare = async () => {
    if (sharing) return;
    setSharing(true);
    setShareMsg('Génération de la carte…');
    try {
      const result = await shareCaveDestinyRecapImage(recap);
      if (result === 'shared') setShareMsg('Carte partagée');
      else if (result === 'downloaded') setShareMsg('Image téléchargée');
      else setShareMsg(null);
    } catch (err) {
      console.error('Partage carte Cave Destiny:', err);
      setShareMsg('Partage image impossible');
    } finally {
      setSharing(false);
      setTimeout(() => setShareMsg(null), 2400);
    }
  };

  return (
    <div className="space-y-4">
      {/* Carte identité */}
      <div className="rounded-2xl border-2 border-amber-600/45 bg-stone-950/90 p-5 shadow-[0_0_34px_rgba(245,158,11,0.14)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-stone-300">
              <span className="font-semibold text-amber-50">{id.name}</span>
              <span className="text-stone-600 mx-1.5">·</span>
              <span className="text-stone-400">Retraite · {id.seasons} saisons</span>
            </p>
            <span className="inline-block mt-2 text-[10px] uppercase tracking-[0.18em] font-black px-2.5 py-1 rounded-full border border-amber-500/60 bg-amber-950/70 text-amber-200">
              {recap.legendBadge}
            </span>
            {career?.endReason === 'death' && (
              <span className="inline-block mt-2 ml-2 text-[10px] uppercase tracking-[0.18em] font-black px-2.5 py-1 rounded-full border border-red-600/60 bg-red-950/70 text-red-200">
                Mort au combat
              </span>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className={`text-3xl font-black tabular-nums ${recap.tier.color}`}>
              {recap.score}
              <span className="text-base font-bold text-stone-500">/100</span>
            </p>
            <p className="text-[10px] uppercase tracking-wide text-stone-500">score</p>
            {career?.endReason === 'death' && (
              <p className="mt-0.5 text-[10px] text-red-400/90">÷2 mort</p>
            )}
          </div>
        </div>

        <h2 className="font-[Cinzel,serif] text-xl sm:text-2xl font-bold text-amber-50 mt-3 leading-tight uppercase tracking-wide">
          {recap.headline}
        </h2>
        <p className="mt-1.5 text-sm italic text-sky-300/90">{recap.nickname}</p>

        <div className="mt-3 flex gap-3 items-start">
          <CharacterPortrait
            src={id.characterImage}
            alt={id.name}
            className="shrink-0"
          />
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="text-xs text-amber-200/90">
              <span aria-hidden="true">{getRaceIcon(id.race)}</span> {id.race || '—'}
              <span className="text-stone-600 mx-1.5">·</span>
              <span aria-hidden="true">{getClassIcon(id.class)}</span> {id.class || '—'}
              {id.subclass ? (
                <>
                  <span className="text-stone-600 mx-1.5">·</span>
                  <span className="text-violet-300">{id.subclass}</span>
                </>
              ) : null}
            </p>
            {id.ambitionName ? (
              <p className="text-xs text-stone-400 mt-1.5">
                {id.ambitionIcon ? `${id.ambitionIcon} ` : ''}
                Ambition : {id.ambitionName}
              </p>
            ) : null}
            {id.mentorName ? (
              <p className="text-xs text-stone-500 mt-0.5">
                {id.mentorIcon ? `${id.mentorIcon} ` : ''}
                Mentor : {id.mentorName}
              </p>
            ) : null}
            {id.weaponName ? (
              <p className="text-xs text-amber-200/80 mt-0.5">
                {id.weaponIcon ? `${id.weaponIcon} ` : ''}
                {id.weaponName}
                {id.weaponRarityLabel ? ` · ${id.weaponRarityLabel}` : ''}
              </p>
            ) : null}
          </div>
        </div>

        {recap.traits.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {recap.traits.map((tr) => (
              <span
                key={tr.id}
                className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full border border-stone-600/70 bg-stone-900/80 text-stone-200"
              >
                <span aria-hidden="true">{tr.icon}</span>
                {tr.label}
              </span>
            ))}
          </div>
        )}

        <p
          className={`mt-4 text-sm flex items-start gap-2 ${
            recap.percentile?.ready ? 'text-amber-300/95' : 'text-stone-500'
          }`}
        >
          <span aria-hidden="true">{recap.percentile?.ready ? '🌐' : '📭'}</span>
          <span>{recap.percentile?.label}</span>
        </p>

        {recap.ambition?.id && (
          <p
            className={`mt-2 text-sm ${
              recap.ambition.succeeded ? 'text-emerald-400' : 'text-stone-500'
            }`}
          >
            {recap.ambition.succeeded
              ? `🎯 Ambition réussie · +${recap.ambition.bonus} pts · ${recap.ambition.detail}`
              : `Ambition non réussie · ${recap.ambition.detail}`}
          </p>
        )}
      </div>

      {/* Stats */}
      <Section title="Statistiques">
        <Panel>
          {recap.statRows.map((row) => (
            <StatRow key={row.label} label={row.label} value={row.value} icon={row.icon} />
          ))}
        </Panel>
        <div className="mt-2 grid grid-cols-5 gap-1 text-center rounded-xl border border-stone-700/80 bg-stone-900/60 px-2 py-2.5">
          {[
            ['Auto', id.stats.auto],
            ['Déf', id.stats.def],
            ['Cap', id.stats.cap],
            ['VIT', id.stats.spd],
            ['CHA', id.stats.charisme],
          ].map(([label, value]) => (
            <div key={label}>
              <p className="text-[10px] uppercase tracking-wide text-stone-500">{label}</p>
              <p className="text-sm font-bold text-amber-100 tabular-nums">
                {Math.round(value || 0)}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* Palmarès */}
      <Section title="Palmarès">
        <Panel>
          {recap.palmares.length === 0 ? (
            <p className="text-sm text-stone-500 py-1">Aucun trophée cette run… la Taverne a des histoires quand même.</p>
          ) : (
            recap.palmares.map((p) => (
              <div
                key={p.key}
                className="flex items-center justify-between gap-3 py-1.5 border-b border-stone-800/80 last:border-0"
              >
                <span className="text-sm text-stone-300">
                  <span className="mr-1.5" aria-hidden="true">
                    {p.icon}
                  </span>
                  {p.label}
                </span>
                <span
                  className={`text-sm font-bold tabular-nums ${
                    p.count > 0 ? 'text-amber-300' : 'text-stone-600'
                  }`}
                >
                  {p.count}
                </span>
              </div>
            ))
          )}
        </Panel>
      </Section>

      {/* Distinctions */}
      {recap.badges.length > 0 && (
        <Section title="Distinctions">
          <Panel>
            <p className="text-xs font-bold text-amber-400/90 mb-2">Badges débloqués</p>
            <ul className="space-y-2">
              {recap.badges.map((b) => (
                <li key={b.id} className="flex items-start gap-2 text-sm">
                  <span aria-hidden="true" className="mt-0.5">
                    {b.icon}
                  </span>
                  <span>
                    <span className="font-semibold text-amber-50">{b.label}</span>
                    {b.detail ? (
                      <span className="text-stone-500"> · {b.detail}</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
            {recap.ambition?.succeeded && (
              <p className="mt-3 text-sm text-amber-300/90">
                🎯 Quête accomplie :{' '}
                <span className="font-semibold text-amber-100">{recap.ambition.name}</span>
              </p>
            )}
          </Panel>
        </Section>
      )}

      {/* Parcours */}
      <Section title="Parcours">
        <Panel>
          <ParcoursTimeline parcours={parcoursVisible} />
          {recap.parcours.length > 6 && (
            <button
              type="button"
              onClick={() => setShowAllParcours((v) => !v)}
              className="mt-3 w-full text-center text-xs font-semibold text-amber-300/90 hover:text-amber-200 transition"
            >
              {showAllParcours
                ? 'Réduire le parcours'
                : 'Voir la carrière saison par saison'}
            </button>
          )}
        </Panel>
      </Section>

      {/* Face à face */}
      <Section title="Face à face">
        <FaceOff
          faceOff={recap.faceOff}
          youName={id.name}
          youTitle={recap.tier.label}
        />
      </Section>

      {/* Narratif */}
      <Section title="Destin">
        <Panel>
          <p className="text-sm text-stone-300 leading-relaxed whitespace-pre-line">{recap.story}</p>
          {recap.narratives.paragraphs.map((p) => (
            <p key={p.slice(0, 40)} className="mt-3 text-sm text-stone-400 leading-relaxed">
              {p}
            </p>
          ))}
          <p className="mt-4 text-sm italic text-stone-500 leading-relaxed border-t border-stone-800 pt-3">
            {recap.narratives.whatIf}
          </p>
        </Panel>
      </Section>

      {/* Actions */}
      <div className="pt-2 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleShare}
            disabled={sharing}
            className="py-3 rounded-xl border border-stone-500 bg-stone-100 text-stone-900 text-xs font-bold uppercase tracking-wide hover:bg-white transition disabled:opacity-60"
          >
            {sharing ? '⏳ Carte…' : '📤 Partager'}
          </button>
          <button
            type="button"
            onClick={onMyRuns || onHome}
            className="py-3 rounded-xl border border-stone-500 bg-stone-100 text-stone-900 text-xs font-bold uppercase tracking-wide hover:bg-white transition"
          >
            💾 Mes runs
          </button>
        </div>
        {shareMsg ? (
          <p className="text-center text-xs text-emerald-400">{shareMsg}</p>
        ) : null}
        <button
          type="button"
          onClick={onReplay}
          className="w-full py-3.5 rounded-xl border-2 border-amber-500/80 bg-amber-700/40 text-amber-50 text-sm font-bold uppercase tracking-wide hover:bg-amber-600/50 transition"
        >
          Rejouer une carrière
        </button>
        <button
          type="button"
          onClick={onHome}
          className="w-full py-3 rounded-xl border border-stone-600 text-stone-300 text-sm hover:bg-stone-800/70 transition"
        >
          Accueil
        </button>
      </div>
    </div>
  );
}
