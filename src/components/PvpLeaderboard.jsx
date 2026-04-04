import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Header from './Header';
import { fetchPvpDuelLeaderboard } from '../services/pvpLobbyService';

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

  return (
    <div className="min-h-screen p-4 md:p-6">
      <Header />
      <div className="max-w-5xl mx-auto pt-20 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-amber-400">🏆 Classement duels PvP</h1>
          <p className="text-stone-400 text-sm max-w-xl mx-auto">
            Victoires et défaites uniquement pour les duels du lobby PvP (personnages archivés).
            Pseudo compte et nom du perso affichés tels qu’au dernier duel enregistré.
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Link
              to="/pvp"
              className="text-amber-300 hover:text-amber-200 text-sm font-semibold underline"
            >
              ← Retour au lobby PvP
            </Link>
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="text-stone-400 hover:text-stone-200 text-sm disabled:opacity-50"
            >
              Actualiser
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-950/50 border border-red-600 text-red-200 px-4 py-3 rounded-lg text-sm">
            {error}
            {error.includes('index') && (
              <p className="mt-2 text-xs text-red-300/90">
                Si le message mentionne un index Firestore, déploie{' '}
                <code className="bg-black/30 px-1 rounded">firestore.indexes.json</code> avec la CLI
                Firebase.
              </p>
            )}
          </div>
        )}

        {loading ? (
          <div className="text-center text-stone-400 py-16">Chargement du classement…</div>
        ) : rows.length === 0 ? (
          <div className="text-center text-stone-500 py-16 border border-stone-700 rounded-xl bg-stone-900/50">
            Aucune entrée pour le moment. Lance un duel depuis le lobby PvP pour apparaître ici.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-stone-600 bg-stone-900/80 shadow-xl">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-stone-600 bg-stone-950/90 text-stone-300">
                  <th className="px-3 py-3 font-bold w-12 text-center">#</th>
                  <th className="px-3 py-3 font-bold">Personnage</th>
                  <th className="px-3 py-3 font-bold">Compte (pseudo)</th>
                  <th className="px-3 py-3 font-bold text-right text-emerald-400">Victoires</th>
                  <th className="px-3 py-3 font-bold text-right text-rose-400">Défaites</th>
                  <th className="px-3 py-3 font-bold text-right text-stone-400">Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => {
                  const total = r.wins + r.losses;
                  const pct = total > 0 ? Math.round((r.wins / total) * 100) : 0;
                  return (
                    <tr
                      key={`${r.ownerUserId}_${r.id}`}
                      className="border-b border-stone-700/80 hover:bg-stone-800/50 transition"
                    >
                      <td className="px-3 py-2.5 text-center text-stone-500 font-mono text-xs">
                        {idx + 1}
                      </td>
                      <td className="px-3 py-2.5 font-semibold text-white">{r.characterName}</td>
                      <td className="px-3 py-2.5 text-stone-300">{r.ownerPseudo}</td>
                      <td className="px-3 py-2.5 text-right text-emerald-400 font-semibold tabular-nums">
                        {r.wins}
                      </td>
                      <td className="px-3 py-2.5 text-right text-rose-400 font-semibold tabular-nums">
                        {r.losses}
                      </td>
                      <td className="px-3 py-2.5 text-right text-stone-400 tabular-nums">
                        {total}
                        {total > 0 && (
                          <span className="text-stone-600 text-xs ml-1">({pct}%)</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default PvpLeaderboard;
