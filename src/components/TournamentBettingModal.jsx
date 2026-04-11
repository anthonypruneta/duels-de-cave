import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getPlayerDungeonSummary } from '../services/dungeonService';
import { getAllCharacters } from '../services/characterService';
import {
  subscribeCurrentTournamentForBetting,
  subscribeBettingPool,
  subscribeMyBet,
  placeBet,
  cancelBet,
  aggregateStakesByParticipant,
  MAX_RUNS_PER_BET_ADD,
  MIN_RUNS_PER_BET,
} from '../services/tournamentBettingService';

/** Même périmètre que chargerParticipants() côté tournoi : persos actifs, non archivés / désactivés. */
function mapCharactersToBettingRows(characters) {
  return characters
    .filter((c) => c && !c.archived && !c.disabled)
    .map((c) => {
      const uid = c.id || c.userId;
      return {
        userId: uid,
        participantId: uid,
        nom: c.name || '???',
        race: c.race,
        classe: c.class,
        characterImage: c.characterImage || null,
        ownerPseudo: c.ownerPseudo || null,
      };
    });
}

function mergeParticipantRows(fromCharacters, tournamentList) {
  const byPid = new Map();
  for (const row of fromCharacters) {
    if (row?.participantId) byPid.set(row.participantId, row);
  }
  if (Array.isArray(tournamentList)) {
    for (const row of tournamentList) {
      if (row?.participantId && !byPid.has(row.participantId)) {
        byPid.set(row.participantId, row);
      }
    }
  }
  return Array.from(byPid.values());
}

export default function TournamentBettingModal({ open, onClose, userId }) {
  const [tournament, setTournament] = useState(null);
  const [characterRows, setCharacterRows] = useState([]);
  const [charactersLoading, setCharactersLoading] = useState(false);
  const [firestoreError, setFirestoreError] = useState(null);
  const [bets, setBets] = useState([]);
  const [myBet, setMyBet] = useState(null);
  const [runsRemaining, setRunsRemaining] = useState(0);
  const [selectedParticipantId, setSelectedParticipantId] = useState('');
  const [amountStr, setAmountStr] = useState('1');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  const stakesByPid = useMemo(() => aggregateStakesByParticipant(bets), [bets]);
  const totalPool = useMemo(() => Object.values(stakesByPid).reduce((a, b) => a + b, 0), [stakesByPid]);

  const participantsList = useMemo(
    () => mergeParticipantRows(characterRows, tournament?.participantsList),
    [characterRows, tournament?.participantsList]
  );

  const refreshRuns = useCallback(async () => {
    if (!userId) return;
    const res = await getPlayerDungeonSummary(userId);
    if (res.success && res.data) {
      setRunsRemaining(res.data.runsRemaining ?? 0);
    }
  }, [userId]);

  useEffect(() => {
    if (!open) return;
    setMessage(null);
    refreshRuns();
  }, [open, refreshRuns]);

  const handleFirestoreListenError = useCallback((err) => {
    console.error('TournamentBettingModal Firestore:', err);
    setFirestoreError(
      'Impossible de joindre la base de données. Si la console affiche « ERR_BLOCKED_BY_CLIENT » sur firestore.googleapis.com, désactivez temporairement le bloqueur de pubs / le bouclier du navigateur pour ce site.'
    );
  }, []);

  useEffect(() => {
    if (!open) {
      setCharacterRows([]);
      setCharactersLoading(false);
      setFirestoreError(null);
      setTournament(null);
      return;
    }
    let cancelled = false;
    setCharactersLoading(true);
    setFirestoreError(null);
    (async () => {
      const res = await getAllCharacters();
      if (cancelled) return;
      setCharactersLoading(false);
      if (!res.success) {
        setFirestoreError(res.error || 'Impossible de charger les personnages actifs.');
        setCharacterRows([]);
        return;
      }
      setCharacterRows(mapCharactersToBettingRows(res.data || []));
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const unsubT = subscribeCurrentTournamentForBetting(setTournament, handleFirestoreListenError);
    const unsubB = subscribeBettingPool(setBets, handleFirestoreListenError);
    return () => {
      unsubT();
      unsubB();
    };
  }, [open, handleFirestoreListenError]);

  useEffect(() => {
    if (!open || !userId) return undefined;
    return subscribeMyBet(userId, setMyBet, handleFirestoreListenError);
  }, [open, userId, handleFirestoreListenError]);

  useEffect(() => {
    if (!open || !myBet?.participantId) return;
    setSelectedParticipantId((prev) => prev || myBet.participantId);
  }, [open, myBet?.participantId]);

  const statut = tournament?.statut;
  /** Paris autorisés : pas de doc tournoi, ou tournoi encore en préparation (avant le premier combat). */
  const bettingLocked = Boolean(tournament && statut !== 'preparation');
  const canPlaceBets = !bettingLocked;

  const isOwnParticipant = useCallback(
    (p) => p && userId && String(p.userId ?? '') === String(userId),
    [userId]
  );

  const handlePlaceBet = async (e) => {
    e.preventDefault();
    setMessage(null);
    if (!userId || !canPlaceBets) {
      setMessage(!userId ? 'Session expirée, reconnectez-vous.' : 'Les paris sont fermés pour ce tournoi.');
      return;
    }
    const amount = parseInt(amountStr, 10);
    if (!Number.isFinite(amount) || amount < MIN_RUNS_PER_BET) {
      setMessage(`Indiquez au moins ${MIN_RUNS_PER_BET} run(s).`);
      return;
    }
    if (amount > MAX_RUNS_PER_BET_ADD) {
      setMessage(`Maximum ${MAX_RUNS_PER_BET_ADD} runs par ajout.`);
      return;
    }
    if (!selectedParticipantId) {
      setMessage('Choisissez un combattant.');
      return;
    }
    const selRow = participantsList.find((p) => p.participantId === selectedParticipantId);
    if (selRow && isOwnParticipant(selRow)) {
      setMessage('Vous ne pouvez pas parier sur votre propre personnage.');
      return;
    }
    if (myBet && myBet.participantId !== selectedParticipantId) {
      setMessage('Annulez d’abord votre pari pour changer de combattant.');
      return;
    }
    setBusy(true);
    try {
      const res = await placeBet({ userId, participantId: selectedParticipantId, amount });
      if (!res.success) {
        setMessage(res.error || 'Erreur');
        return;
      }
      setAmountStr('1');
      setMessage('Pari enregistré.');
      try {
        await refreshRuns();
      } catch (err) {
        console.error('refreshRuns après pari:', err);
        setMessage('Pari enregistré. Rechargez la page si vos runs ne se mettent pas à jour.');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = async () => {
    setMessage(null);
    if (!userId || !canPlaceBets) {
      setMessage(!userId ? 'Session expirée, reconnectez-vous.' : 'Les paris sont fermés — annulation impossible depuis cette fenêtre.');
      return;
    }
    setBusy(true);
    try {
      const res = await cancelBet(userId);
      if (!res.success) {
        setMessage(res.error || 'Erreur');
        return;
      }
      setSelectedParticipantId('');
      setMessage('Pari annulé — vos runs ont été rendus.');
      try {
        await refreshRuns();
      } catch (err) {
        console.error('refreshRuns après annulation:', err);
        setMessage('Pari annulé. Rechargez la page si vos runs ne se mettent pas à jour.');
      }
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/75"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-stone-900 border-2 border-amber-600 rounded-xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="betting-modal-title"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-2 px-4 py-3 border-b border-stone-700 bg-stone-900/95">
          <h2 id="betting-modal-title" className="text-lg font-bold text-amber-400">
            Paris du tournoi (runs)
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 text-sm bg-stone-700 hover:bg-stone-600 rounded text-stone-200"
          >
            Fermer
          </button>
        </div>

        <div className="p-4 space-y-4 text-stone-200">
          {firestoreError && (
            <p className="text-red-400 text-sm border border-red-900/50 rounded-lg p-3 bg-red-950/20">{firestoreError}</p>
          )}
          {charactersLoading && !firestoreError && (
            <p className="text-stone-400 text-sm">Chargement des personnages actifs…</p>
          )}

          {bettingLocked && (
            <div className="space-y-2 text-sm">
              <p className="text-amber-200/90">
                {statut === 'en_cours'
                  ? 'Le tournoi a commencé : plus aucun pari ni modification (y compris annulation).'
                  : statut === 'termine'
                    ? 'Tournoi terminé — paris clos.'
                    : 'Paris fermés pour cet état du tournoi.'}
              </p>
              {statut === 'en_cours' && myBet && (
                <p className="text-stone-400 text-xs border border-stone-600 rounded-lg p-2 bg-stone-950/40">
                  Votre mise actuelle : <span className="text-amber-200 font-semibold">{myBet.runsStaked ?? 0} runs</span> sur{' '}
                  {participantsList.find((p) => p.participantId === myBet.participantId)?.nom || '…'} — verrouillée jusqu’à la fin du
                  tournoi.
                </p>
              )}
              <Link
                to="/tournament"
                className="inline-block text-amber-400 hover:text-amber-300 underline text-sm"
              >
                Voir le tournoi
              </Link>
              {!charactersLoading && !firestoreError && participantsList.length > 0 && (
                <div className="pt-2">
                  <p className="text-xs text-stone-500 uppercase tracking-wide mb-2">Combattants (lecture seule)</p>
                  <ul className="max-h-40 overflow-y-auto space-y-1 border border-stone-600 rounded-lg p-2 bg-stone-950/40">
                    {participantsList.map((p) => {
                      const pid = p.participantId;
                      const poolOn = stakesByPid[pid] || 0;
                      const own = isOwnParticipant(p);
                      return (
                        <li
                          key={pid}
                          className="w-full text-left px-2 py-1.5 rounded text-sm flex justify-between gap-2 text-stone-100"
                        >
                          <span className="truncate font-medium">
                            {p.nom || '???'}
                            {own ? <span className="text-stone-500 font-normal"> (vous)</span> : null}
                          </span>
                          <span className="shrink-0 text-stone-500 text-xs">{poolOn} en jeu</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          )}

          {canPlaceBets && !charactersLoading && !firestoreError && (
            <>
              {!tournament && (
                <p className="text-emerald-200/90 text-sm border border-emerald-900/40 rounded-lg p-2 bg-emerald-950/20">
                  Paris ouverts : le document tournoi n’existe pas encore ou le tirage n’a pas été créé — vous pouvez miser
                  sur un personnage actif. Les mises restent valides jusqu’au lancement des combats.
                </p>
              )}
              {tournament && statut === 'preparation' && (
                <p className="text-stone-400 text-sm">
                  Phase préparation : vous pouvez encore miser ou annuler jusqu’au premier combat.
                </p>
              )}
              <div className="flex flex-wrap justify-between gap-2 text-sm border border-stone-600 rounded-lg p-3 bg-stone-800/50">
                <div>
                  <span className="text-stone-500">Vos runs disponibles</span>
                  <div className="text-xl font-bold text-amber-300">{runsRemaining}</div>
                </div>
                <div>
                  <span className="text-stone-500">Pool total</span>
                  <div className="text-xl font-bold text-emerald-300">{totalPool}</div>
                </div>
              </div>

              {myBet && (
                <div className="text-sm bg-amber-900/20 border border-amber-700/50 rounded-lg p-3">
                  <span className="text-amber-200 font-semibold">Votre mise : </span>
                  <span className="text-stone-100">{myBet.runsStaked ?? 0} runs</span>
                  <span className="text-stone-500"> sur </span>
                  <span className="text-stone-200">
                    {participantsList.find((p) => p.participantId === myBet.participantId)?.nom || '…'}
                  </span>
                </div>
              )}

              <div>
                <p className="text-xs text-stone-500 uppercase tracking-wide mb-2">
                  Personnages actifs — choisissez votre pari
                </p>
                <ul className="max-h-48 overflow-y-auto space-y-1 border border-stone-600 rounded-lg p-2 bg-stone-950/40">
                  {participantsList.length === 0 && (
                    <li className="text-stone-500 text-sm">Aucun participant listé.</li>
                  )}
                  {participantsList.map((p) => {
                    const pid = p.participantId;
                    const selected = selectedParticipantId === pid;
                    const poolOn = stakesByPid[pid] || 0;
                    const own = isOwnParticipant(p);
                    return (
                      <li key={pid}>
                        <button
                          type="button"
                          disabled={busy || own || (myBet && myBet.participantId !== pid)}
                          onClick={() => !own && setSelectedParticipantId(pid)}
                          className={`w-full text-left px-2 py-1.5 rounded text-sm flex justify-between gap-2 transition ${
                            selected ? 'bg-amber-600/30 border border-amber-500/60' : 'hover:bg-stone-800 border border-transparent'
                          } ${own || (myBet && myBet.participantId !== pid) ? 'opacity-40 cursor-not-allowed' : ''}`}
                        >
                          <span className="truncate font-medium text-stone-100">
                            {p.nom || '???'}
                            {own ? <span className="text-stone-500 font-normal"> (vous)</span> : null}
                          </span>
                          <span className="shrink-0 text-stone-500 text-xs">{poolOn} en jeu</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <form onSubmit={handlePlaceBet} className="space-y-2">
                <label className="block text-sm text-stone-400">
                  Ajouter des runs au pari
                  <input
                    type="number"
                    min={MIN_RUNS_PER_BET}
                    max={MAX_RUNS_PER_BET_ADD}
                    value={amountStr}
                    onChange={(e) => setAmountStr(e.target.value)}
                    className="mt-1 w-full px-3 py-2 bg-stone-800 border border-stone-600 rounded-lg text-stone-100 focus:border-amber-500 focus:outline-none"
                  />
                </label>
                <button
                  type="submit"
                  disabled={
                    busy ||
                    !selectedParticipantId ||
                    isOwnParticipant(participantsList.find((p) => p.participantId === selectedParticipantId))
                  }
                  className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-stone-900 font-bold rounded-lg border border-amber-500"
                >
                  {myBet ? 'Ajouter à ma mise' : 'Placer le pari'}
                </button>
              </form>

              {myBet && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleCancel}
                  className="w-full py-2 text-sm bg-stone-800 hover:bg-red-900/40 border border-stone-600 text-red-300 rounded-lg disabled:opacity-60"
                >
                  {busy ? 'Annulation en cours…' : 'Annuler mon pari (remboursement)'}
                </button>
              )}

              <p className="text-xs text-stone-500 leading-relaxed">
                Pas de pari sur votre propre personnage. Un seul combattant par compte ; vous pouvez augmenter votre
                mise ou annuler tant que le tournoi n’a pas commencé (y compris avant la création du document tournoi).
                Dès le lancement des matchs, aucune modification n’est possible. Les gains (si vous avez parié sur le
                champion) sont ajoutés à vos runs lorsque vous créez votre prochain personnage après la fin de saison.
                Si personne n’a parié sur le champion, les mises sont remboursées sur votre personnage actuel.
              </p>
            </>
          )}

          {message && (
            <p className={`text-sm ${message.startsWith('Pari') || message.includes('rendus') ? 'text-emerald-400' : 'text-red-400'}`}>
              {message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
