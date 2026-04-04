import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Header from './Header';
import { useAuth } from '../contexts/AuthContext';
import {
  fetchPvpDuelLeaderboard,
  getPvpLobbyMaxLevel,
  syncPvpLeaderboardEntriesForUser,
} from '../services/pvpLobbyService';

function PvpLeaderboard() {
  const { currentUser } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    if (currentUser?.uid) {
      await syncPvpLeaderboardEntriesForUser(currentUser.uid);
    }
    const res = await fetchPvpDuelLeaderboard(250);
    if (!res.success) {
      setError(res.error || 'Impossible de charger le classement.');
      setRows([]);
    } else {
      setRows(res.data || []);
    }
    setLoading(false);
  }, [currentUser?.uid]);

  useEffect(() => {
    load();
  }, [load]);

  const isPermissionError =
    error &&
    (/permission|insufficient|droits/i.test(error) ||
      /Missing or insufficient permissions/i.test(error));

  return (
    <div className="min-h-screen p-4 md:p-6 pb-24">
      <Header />
      <div className="max-w-5xl mx-auto pt-20 space-y-5 relative z-10">
        <section className="rounded-xl border-2 border-stone-600 bg-stone-950 px-5 py-5 shadow-2xl">
          <h1 className="text-3xl font-bold text-amber-400 text-center">
            🏆 Classement duels PvP
          </h1>
          <p className="text-stone-200 text-sm max-w-xl mx-auto mt-4 text-center leading-relaxed">
            Victoires et défaites uniquement pour les duels du lobby PvP (personnages archivés, niveau
            max {getPvpLobbyMaxLevel()}).
            <br />
            Pseudo compte et nom du perso affichés tels qu’au dernier duel enregistré.
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-5">
            <Link
              to="/pvp"
              className="inline-flex items-center rounded-lg border border-stone-500 bg-stone-800 px-4 py-2.5 text-sm font-semibold text-amber-300 hover:bg-stone-700 hover:text-amber-200 transition"
            >
              ← Retour au lobby PvP
            </Link>
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="inline-flex items-center rounded-lg border border-stone-500 bg-stone-800 px-4 py-2.5 text-sm font-semibold text-stone-200 hover:bg-stone-700 disabled:opacity-50 transition"
            >
              Actualiser
            </button>
          </div>
        </section>

        {error && (
          <section className="rounded-xl border-2 border-red-700 bg-red-950 px-4 py-4 shadow-xl">
            <p className="text-red-100 font-medium">{error}</p>
            {isPermissionError && (
              <div className="mt-3 rounded-lg border border-red-800/80 bg-black/30 px-3 py-2 text-xs text-red-100/90 leading-relaxed">
                <p className="font-semibold text-red-200">Firestore — lecture du classement</p>
                <p className="mt-1">
                  Déploie <code className="rounded bg-black/40 px-1">firestore.rules</code> et{' '}
                  <code className="rounded bg-black/40 px-1">firestore.indexes.json</code> :{' '}
                  <code className="rounded bg-black/40 px-1">firebase deploy --only firestore</code>.
                </p>
                <p className="mt-1">
                  Collection lue :{' '}
                  <code className="rounded bg-black/40 px-1 break-all">pvpDuelLeaderboardEntries</code>{' '}
                  (<code className="rounded bg-black/40 px-1">allow read: if request.auth != null</code>).
                </p>
              </div>
            )}
            {error.toLowerCase().includes('index') && (
              <p className="mt-3 text-xs text-red-200/90">
                Index : déploie{' '}
                <code className="rounded bg-black/40 px-1">firestore.indexes.json</code> (tri{' '}
                <code className="rounded bg-black/40 px-1">wins</code> DESC sur{' '}
                <code className="rounded bg-black/40 px-1">pvpDuelLeaderboardEntries</code>).
              </p>
            )}
          </section>
        )}

        <section className="rounded-xl border-2 border-stone-600 bg-stone-950 px-4 py-6 shadow-2xl min-h-[220px]">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="rounded-lg border border-stone-600 bg-stone-900 px-8 py-6 text-stone-200">
                Chargement du classement…
              </div>
            </div>
          ) : rows.length === 0 && !error ? (
            <div className="rounded-lg border border-stone-600 bg-stone-900 mx-auto max-w-lg px-6 py-8 text-center">
              <p className="text-stone-200 font-medium">
                Aucune entrée pour le moment.
              </p>
              <p className="text-stone-400 text-sm mt-2">
                Lance un duel depuis le lobby PvP pour apparaître ici.
              </p>
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-lg border border-stone-600 bg-stone-900 mx-auto max-w-lg px-6 py-8 text-center text-stone-400 text-sm">
              Impossible d’afficher le tableau tant que le chargement échoue.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-stone-600 bg-stone-900">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-stone-600 bg-stone-800 text-stone-200">
                    <th className="px-3 py-3 font-bold w-12 text-center">#</th>
                    <th className="px-3 py-3 font-bold">Personnage</th>
                    <th className="px-3 py-3 font-bold">Compte (pseudo)</th>
                    <th className="px-3 py-3 font-bold text-right text-emerald-400">Victoires</th>
                    <th className="px-3 py-3 font-bold text-right text-rose-400">Défaites</th>
                    <th className="px-3 py-3 font-bold text-right text-stone-300">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, idx) => {
                    const total = r.wins + r.losses;
                    const pct = total > 0 ? Math.round((r.wins / total) * 100) : 0;
                    return (
                      <tr
                        key={`${r.ownerUserId}_${r.id}`}
                        className="border-b border-stone-700/90 odd:bg-stone-900/80 even:bg-stone-900 hover:bg-stone-800/80 transition"
                      >
                        <td className="px-3 py-2.5 text-center text-stone-400 font-mono text-xs">
                          {idx + 1}
                        </td>
                        <td className="px-3 py-2.5 font-semibold text-white">{r.characterName}</td>
                        <td className="px-3 py-2.5 text-stone-200">{r.ownerPseudo}</td>
                        <td className="px-3 py-2.5 text-right text-emerald-400 font-semibold tabular-nums">
                          {r.wins}
                        </td>
                        <td className="px-3 py-2.5 text-right text-rose-400 font-semibold tabular-nums">
                          {r.losses}
                        </td>
                        <td className="px-3 py-2.5 text-right text-stone-300 tabular-nums">
                          {total}
                          {total > 0 && (
                            <span className="text-stone-500 text-xs ml-1">({pct}%)</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default PvpLeaderboard;
