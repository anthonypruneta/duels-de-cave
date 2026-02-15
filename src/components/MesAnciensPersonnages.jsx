import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Header from './Header';
import { getDisabledCharacters } from '../services/characterService';
import { getWeaponById, RARITY_COLORS } from '../data/weapons';
import { getMageTowerPassiveById, getMageTowerPassiveLevel } from '../data/mageTowerPassives';

const MesAnciensPersonnages = () => {
  const { currentUser } = useAuth();
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      if (!currentUser) return;
      const result = await getDisabledCharacters(currentUser.uid);
      if (result.success) {
        // Dédoublonner par ID (getDisabledCharacters renvoie disabled + archived)
        const unique = [];
        const seen = new Set();
        for (const c of result.data) {
          if (!seen.has(c.id)) {
            seen.add(c.id);
            unique.push(c);
          }
        }
        setCharacters(unique);
      }
      setLoading(false);
    };
    load();
  }, [currentUser]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Header />
        <div className="text-amber-400 text-2xl">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      <Header />
      <div className="max-w-3xl mx-auto pt-20">
        <div className="text-center mb-8">
          <div className="bg-stone-900/70 border-2 border-amber-600 rounded-xl px-6 py-4 shadow-xl inline-block">
            <h1 className="text-4xl font-bold text-amber-400">📜 Mes Anciens Personnages</h1>
            <p className="text-stone-400 mt-1">Les héros qui ont participé aux tournois</p>
          </div>
        </div>

        {characters.length === 0 ? (
          <div className="bg-stone-800/90 p-8 border-2 border-stone-600 rounded-xl text-center">
            <p className="text-stone-400 text-xl">Aucun ancien personnage</p>
            <p className="text-stone-500 mt-2">Tes personnages apparaîtront ici après chaque tournoi</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {characters.map((char) => (
              <div
                key={char.id}
                className={`bg-stone-800/90 border-2 ${
                  char.tournamentChampion ? 'border-yellow-500' :
                  char.disabled ? 'border-red-600' : 'border-stone-600'
                } rounded-xl p-4`}
              >
                {char.characterImage && (
                  <img
                    src={char.characterImage}
                    alt={char.name}
                    className="w-full max-h-48 object-contain mb-3 bg-stone-900 rounded"
                  />
                )}
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-xl font-bold text-white">{char.name}</h3>
                  {char.tournamentChampion && <span className="text-yellow-400">👑</span>}
                  {char.disabled && <span className="text-red-400 text-xs bg-red-900/50 px-2 py-0.5 rounded">Désactivé</span>}
                </div>
                <p className="text-amber-300 text-sm">
                  {char.race} • {char.class}
                  {(char.level ?? 1) > 1 && <span className="text-stone-400 ml-2">Niv. {char.level}</span>}
                </p>

                <div className="bg-stone-900/50 rounded-lg p-3 mt-3 text-xs">
                  <div className="grid grid-cols-3 gap-2 text-stone-400">
                    <div>HP: <span className="text-white font-bold">{char.base?.hp}</span></div>
                    <div>Auto: <span className="text-white font-bold">{char.base?.auto}</span></div>
                    <div>Déf: <span className="text-white font-bold">{char.base?.def}</span></div>
                    <div>Cap: <span className="text-white font-bold">{char.base?.cap}</span></div>
                    <div>ResC: <span className="text-white font-bold">{char.base?.rescap}</span></div>
                    <div>VIT: <span className="text-white font-bold">{char.base?.spd}</span></div>
                  </div>
                </div>

                {/* Arme équipée */}
                {char.equippedWeaponId && (() => {
                  const weapon = getWeaponById(char.equippedWeaponId);
                  if (!weapon) return null;
                  return (
                    <div className="bg-stone-900/50 rounded-lg p-2 mt-2 text-xs border border-stone-700">
                      <span className="text-stone-500">Arme: </span>
                      <span className={RARITY_COLORS[weapon.rarete] || 'text-white'}>
                        {weapon.icon} {weapon.nom}
                      </span>
                    </div>
                  );
                })()}

                {/* Passif tour du mage */}
                {char.mageTowerPassive && (() => {
                  const passive = getMageTowerPassiveById(char.mageTowerPassive.id);
                  const passiveLevel = passive ? getMageTowerPassiveLevel(char.mageTowerPassive.id, char.mageTowerPassive.level) : null;
                  if (!passive) return null;
                  return (
                    <div className="bg-stone-900/50 rounded-lg p-2 mt-2 text-xs border border-purple-900/50">
                      <span className="text-stone-500">Passif: </span>
                      <span className="text-purple-300">
                        {passive.icon} {passive.name} (Niv. {char.mageTowerPassive.level})
                      </span>
                      {passiveLevel && (
                        <p className="text-stone-500 mt-1">{passiveLevel.description}</p>
                      )}
                    </div>
                  );
                })()}

                {/* Boosts forêt */}
                {char.forestBoosts && Object.values(char.forestBoosts).some(v => v > 0) && (
                  <div className="bg-stone-900/50 rounded-lg p-2 mt-2 text-xs border border-green-900/50">
                    <span className="text-stone-500">Boosts forêt: </span>
                    <span className="text-green-300">
                      {Object.entries(char.forestBoosts).filter(([, v]) => v > 0).map(([stat, v]) => `${stat.toUpperCase()} +${v}`).join(' • ')}
                    </span>
                  </div>
                )}

                {char.archivedAt && (
                  <p className="text-stone-600 text-xs mt-2">
                    Archivé le {char.archivedAt.toDate?.().toLocaleDateString('fr-FR') || ''}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 text-center">
          <button onClick={() => navigate('/')} className="bg-stone-700 hover:bg-stone-600 text-white px-6 py-2 rounded-lg transition">
            ← Retour
          </button>
        </div>
      </div>
    </div>
  );
};

export default MesAnciensPersonnages;
