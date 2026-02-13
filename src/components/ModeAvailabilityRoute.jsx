import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { shouldLockPveModes } from '../services/gameAvailabilityService';

function ModeAvailabilityRoute({ children }) {
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    let mounted = true;

    const checkAvailability = async () => {
      const result = await shouldLockPveModes();
      if (!mounted) return;
      setLocked(!!result.locked);
      setLoading(false);
    };

    checkAvailability();

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-amber-400 text-2xl">Chargement...</div>
      </div>
    );
  }

  if (!locked) return children;

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-2xl w-full text-center bg-stone-900/90 border-2 border-amber-600 rounded-xl px-6 py-8">
        <div className="text-6xl mb-4">🔒</div>
        <h2 className="text-3xl text-amber-300 font-bold mb-3">Modes temporairement bloqués</h2>
        <p className="text-stone-200 mb-6">
          Après le tournoi, les donjons, le PvP et le labyrinthe sont fermés jusqu'à lundi.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link to="/" className="bg-amber-600 hover:bg-amber-500 text-white px-5 py-2 font-semibold rounded">
            Retour à l'accueil
          </Link>
          <Link to="/tournament" className="bg-stone-700 hover:bg-stone-600 text-white px-5 py-2 font-semibold rounded border border-stone-500">
            Voir le replay du tournoi
          </Link>
        </div>
      </div>
    </div>
  );
}

export default ModeAvailabilityRoute;

