import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Header from './Header';
import { fetchPvpDuelLeaderboard, getPvpLobbyMaxLevel } from '../services/pvpLobbyService';

function PvpLeaderboard() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetchPvpDuelLeaderboard(250);
    if (!res.success) {
      setError(res.error || 'Impossible de charger le classement.');
      setRows([]);
    } else {
      setRows(res.data || []);
    }
    setLoading(false);
  }, []);

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
        <section className="rounded-xl border-2 border-stone-500 bg-stone-700/95 backdrop-blur-sm px-5 py-5 shadow-2xl">
          <h1 className="text-3xl font-bold text-amber-300 text-center drop-shadow-sm">
            🏆 Classement duels PvP
          </h1>
          <p className="text-stone-100 text-sm max-w-xl mx-auto mt-4 text-center leading-relaxed bg-stone-800/80 rounded-lg px-4 py-3 border border-stone-600/80">
            Victoires et défaites uniquement pour les duels du lobby PvP (personnages archivés, niveau
            max {getPvpLobbyMaxLevel()}).
            <br />
            Pseudo compte et nom du perso affichés tels qu’au dernier duel enregistré.
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-5">
            <Link
              to="/pvp"
              className="inline-flex items-center rounded-lg border border-stone-500 bg-stone-600 px-4 py-2.5 text-sm font-semibold text-amber-100 hover:bg-stone-500 hover:text-white transition shadow-md"
            >
              ← Retour au lobby PvP
            </Link>
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="inline-flex items-center rounded-lg border border-stone-500 bg-stone-600 px-4 py-2.5 text-sm font-semibold text-stone-50 hover:bg-stone-500 disabled:opacity-50 transition shadow-md"
            >
              Actualiser
            </button>
          </div>
        </section>

        {error && (
          <section className="rounded-xl border-2 border-red-600 bg-red-900/90 backdrop-blur-sm px-4 py-4 shadow-xl">
            <div className="rounded-lg bg-stone-700/90 border border-stone-500 px-3 py-2">
              <p className="text-red-50 font-medium">{error}</p>
            </div>
            {isPermissionError && (
              <div className="mt-3 rounded-lg border border-stone-500 bg-stone-600/95 px-3 py-3 text-xs text-stone-50 leading-relaxed shadow-inner">
                <p className="font-semibold text-amber-200">Firestore — lecture du classement</p>
                <p className="mt-2">
                  Déploie Firestore depuis ce dépôt :{' '}
                  <code className="rounded bg-stone-800 px-1.5 py-0.5 text-stone-100">firebase deploy --only firestore</code>{' '}
                  (le fichier <code className="rounded bg-stone-800 px-1.5 py-0.5">firebase.json</code> inclut maintenant règles + index).
                </p>
                <p className="mt-2">
                  Chemin des documents :{' '}
                  <code className="rounded bg-stone-800 px-1.5 py-0.5 break-all">
                    pvpDuelStatsByUser/&#123;userId&#125;/pvpDuelCharStats/&#123;charId&#125;
                  </code>{' '}
                  — règle attendue : <code className="rounded bg-stone-800 px-1.5 py-0.5">allow read: if request.auth != null</code>.
                </p>
              </div>
            )}
            {error.toLowerCase().includes('index') && (
              <p className="mt-3 text-xs text-stone-100 rounded-lg bg-stone-600/90 border border-stone-500 px-3 py-2">
                Index collection group : déploie{' '}
                <code className="rounded bg-stone-800 px-1">firestore.indexes.json</code> (champ{' '}
                <code className="rounded bg-stone-800 px-1">wins</code> DESC sur{' '}
                <code className="rounded bg-stone-800 px-1">pvpDuelCharStats</code>).
              </p>
            )}
          </section>
        )}

        <section className="rounded-xl border-2 border-stone-500 bg-stone-700/95 backdrop-blur-sm px-4 py-6 shadow-2xl min-h-[220px]">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="rounded-lg border border-stone-500 bg-stone-600 px-8 py-6 text-stone-50 font-medium shadow-md">
                Chargement du classement…
              </div>
            </div>
          ) : rows.length === 0 && !error ? (
            <div className="rounded-lg border border-stone-500 bg-stone-600/95 mx-auto max-w-lg px-6 py-8 text-center shadow-md">
              <p className="text-stone-50 font-medium">
                Aucune entrée pour le moment.
              </p>
              <p className="text-stone-200 text-sm mt-2">
                Lance un duel depuis le lobby PvP pour apparaître ici.
              </p>
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-lg border border-stone-500 bg-stone-600/95 mx-auto max-w-lg px-6 py-8 text-center text-stone-200 text-sm shadow-md">
              Impossible d’afficher le tableau tant que le chargement échoue.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-stone-500 bg-stone-600/95">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-stone-500 bg-stone-600 text-stone-50">
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
                        className="border-b border-stone-500/80 odd:bg-stone-700/70 even:bg-stone-600/60 hover:bg-stone-500/50 transition"
                      >
                        <td className="px-3 py-2.5 text-center text-stone-300 font-mono text-xs">
                          {idx + 1}
                        </td>
                        <td className="px-3 py-2.5 font-semibold text-white">{r.characterName}</td>
                        <td className="px-3 py-2.5 text-stone-100">{r.ownerPseudo}</td>
                        <td className="px-3 py-2.5 text-right text-emerald-400 font-semibold tabular-nums">
                          {r.wins}
                        </td>
                        <td className="px-3 py-2.5 text-right text-rose-400 font-semibold tabular-nums">
                          {r.losses}
                        </td>
                        <td className="px-3 py-2.5 text-right text-stone-100 tabular-nums">
                          {total}
                          {total > 0 && (
                            <span className="text-stone-300 text-xs ml-1">({pct}%)</span>
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
