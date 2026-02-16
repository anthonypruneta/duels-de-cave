import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from './Header';
import WorldBossAdmin from './WorldBossAdmin';
import { useAuth } from '../contexts/AuthContext';
import { getUserCharacter } from '../services/characterService';

const WorldBoss = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [character, setCharacter] = useState(null);

  useEffect(() => {
    let mounted = true;

    const loadCharacter = async () => {
      if (!currentUser?.uid) {
        if (mounted) setLoading(false);
        return;
      }

      const result = await getUserCharacter(currentUser.uid);
      if (!mounted) return;

      if (result.success) {
        setCharacter(result.data || null);
      }
      setLoading(false);
    };

    loadCharacter();
    return () => { mounted = false; };
  }, [currentUser]);

  const characters = useMemo(() => (character ? [character] : []), [character]);

  return (
    <div className="min-h-screen p-6">
      <Header />
      <div className="max-w-[1800px] mx-auto pt-16">
        <button
          onClick={() => navigate('/')}
          className="mb-4 bg-stone-700 hover:bg-stone-600 text-white px-4 py-2 rounded"
        >
          ← Retour
        </button>

        {loading ? (
          <div className="text-stone-400">Chargement...</div>
        ) : !character ? (
          <div className="bg-stone-900/70 border border-stone-700 rounded-xl p-6 text-stone-300">
            Aucun personnage trouvé pour ce compte.
          </div>
        ) : (
          <WorldBossAdmin characters={characters} isAdmin={false} />
        )}
      </div>
    </div>
  );
};

export default WorldBoss;
