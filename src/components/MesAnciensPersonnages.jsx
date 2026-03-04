import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Header from './Header';
import UnifiedCharacterCard from './UnifiedCharacterCard';
import { getArchivedCharacters } from '../services/tournamentService';
import { getWeaponById, RARITY_COLORS } from '../data/weapons';
import WeaponNameWithForge from './WeaponWithForgeDisplay';
import { getMageTowerPassiveById, getMageTowerPassiveLevel } from '../data/mageTowerPassives';
import { getFusedPassiveDisplayData } from '../data/extensionDungeon';
import SharedTooltip from './SharedTooltip';
import { races, classes } from '../data/gameData';
import SubclassDetailBlock from './SubclassDetailBlock';

const MesAnciensPersonnages = () => {
  const { currentUser } = useAuth();
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      if (!currentUser) return;
      const result = await getArchivedCharacters(currentUser.uid);
      if (result.success) {
        // Afficher uniquement les personnages réellement archivés par le tournoi
        const sorted = [...result.data].sort((a, b) => {
          const aTs = a.archivedAt?.toMillis?.() || 0;
          const bTs = b.archivedAt?.toMillis?.() || 0;
          return bTs - aTs;
        });
        setCharacters(sorted);
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {characters.map((char) => {
              const weapon = char.equippedWeaponId ? getWeaponById(char.equippedWeaponId) : null;
              const fused = getFusedPassiveDisplayData(char);
              const passive = char.mageTowerPassive ? getMageTowerPassiveById(char.mageTowerPassive.id) : null;
              const passiveLevel = passive && char.mageTowerPassive ? getMageTowerPassiveLevel(char.mageTowerPassive.id, char.mageTowerPassive.level) : null;
              
              const formatWeaponStats = (w) => {
                if (!w?.stats) return null;
                return Object.entries(w.stats)
                  .filter(([, value]) => value !== 0)
                  .map(([stat, value]) => `${stat.toUpperCase()} ${value > 0 ? `+${value}` : value}`)
                  .join(' • ');
              };

              return (
                <div key={char.id} className={char.tournamentChampion ? 'relative' : ''}>
                  {char.tournamentChampion && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-yellow-500 text-black px-3 py-1 rounded-full text-xs font-bold z-20 shadow-lg">
                      👑 CHAMPION
                    </div>
                  )}
                  <UnifiedCharacterCard
                    header={`${char.race} • ${char.class} • Niveau ${char.level ?? 1}`}
                    name={char.name}
                    image={char.characterImage}
                    fallback={<span className="text-7xl">{races[char.race]?.icon || '❓'}</span>}
                    topStats={
                      <>
                        <span className="text-yellow-300 font-bold">HP: {char.base?.hp || 0}</span>
                        <span className="text-yellow-300 font-bold">VIT: {char.base?.spd || 0}</span>
                      </>
                    }
                    mainStats={
                      <>
                        <span className="text-stone-300 font-bold">Auto: {char.base?.auto || 0}</span>
                        <span className="text-stone-300 font-bold">Déf: {char.base?.def || 0}</span>
                        <span className="text-stone-300 font-bold">Cap: {char.base?.cap || 0}</span>
                        <span className="text-stone-300 font-bold">ResC: {char.base?.rescap || 0}</span>
                      </>
                    }
                    details={
                      <div className="space-y-2">
                        {weapon && (
                          <div className="border border-stone-600 bg-stone-900/60 p-2 text-xs text-stone-300">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xl">{weapon.icon}</span>
                              <span className="flex flex-col items-start">
                                <WeaponNameWithForge weapon={weapon} forgeUpgrade={char.forgeUpgrade} />
                              </span>
                            </div>
                            <div className="text-[11px] text-stone-400 space-y-1">
                              <div>{weapon.description}</div>
                              {weapon.effet && typeof weapon.effet === 'object' ? (
                                <div className="text-amber-200">
                                  Effet: {weapon.effet.nom} — {weapon.effet.description}
                                </div>
                              ) : null}
                              {weapon.stats && Object.keys(weapon.stats || {}).length > 0 ? (
                                <div className="text-stone-200">
                                  Stats: {formatWeaponStats(weapon)}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        )}
                        
                        {fused ? (
                          <div className="extension-territory-border extension-territory-glow overflow-visible">
                            <div className="flex items-start gap-2 border border-stone-600 bg-stone-900/60 p-2 text-xs text-stone-300 extension-territory-shine">
                              <span className="text-lg">{fused.primaryDetails.icon}</span>
                              <div className="flex-1">
                                <SharedTooltip
                                  content={
                                    <span className="whitespace-normal block text-left max-w-[260px]">
                                      <span className="text-amber-300 font-semibold">{fused.primaryDetails.icon} {fused.primaryDetails.name}</span>
                                      <span className="text-stone-400"> — Niv.{fused.primaryDetails.level} (principal)</span>
                                      <br />
                                      <span className="text-violet-300 font-semibold">{fused.extensionDetails.icon} {fused.extensionDetails.name}</span>
                                      <span className="text-stone-400"> — Niv.{fused.extensionDetails.level} (extension)</span>
                                    </span>
                                  }
                                >
                                  <div className="font-semibold extension-territory-text cursor-help">{fused.displayLabel}</div>
                                </SharedTooltip>
                                <div className="text-stone-400 text-[11px] mt-1 space-y-1">
                                  <div><span className="text-amber-300/90">Niv.{fused.primaryDetails.level} —</span> {fused.primaryDetails.levelData.description}</div>
                                  <div><span className="text-violet-300/90">Niv.{fused.extensionDetails.level} (Extension) —</span> {fused.extensionDetails.levelData.description}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : passive && (
                          <div className="flex items-start gap-2 border border-stone-600 bg-stone-900/60 p-2 text-xs text-stone-300">
                            <span className="text-lg">{passive.icon}</span>
                            <div className="flex-1">
                              <div className="font-semibold text-amber-200">
                                {passive.name} — Niveau {char.mageTowerPassive.level}
                              </div>
                              {passiveLevel && (
                                <div className="text-stone-400 text-[11px] mt-1">
                                  {passiveLevel.description}
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {char.forestBoosts && Object.values(char.forestBoosts).some(v => v > 0) && (
                          <div className="flex items-start gap-2 border border-stone-600 bg-stone-900/60 p-2 text-xs text-stone-300">
                            <span className="text-lg">🌲</span>
                            <div className="flex-1">
                              <div className="font-semibold text-amber-200">Boosts Forêt</div>
                              <div className="text-green-300 text-[11px] mt-1">
                                {Object.entries(char.forestBoosts)
                                  .filter(([, v]) => v > 0)
                                  .map(([stat, v]) => `${stat.toUpperCase()} +${v}`)
                                  .join(' • ')}
                              </div>
                            </div>
                          </div>
                        )}

                        {classes[char.class] && (
                          char.subclass ? (
                            <SubclassDetailBlock subclass={char.subclass} classIcon={classes[char.class].icon} />
                          ) : (
                            <div className="flex items-start gap-2 border border-stone-600 bg-stone-900/60 p-2 text-xs text-stone-300">
                              <span className="text-lg">{classes[char.class].icon}</span>
                              <div className="flex-1">
                                <div className="font-semibold text-amber-200">{classes[char.class].ability}</div>
                              </div>
                            </div>
                          )
                        )}

                        {char.archivedAt && (
                          <div className="text-stone-600 text-xs text-center mt-2 pt-2 border-t border-stone-700">
                            Archivé le {char.archivedAt.toDate?.().toLocaleDateString('fr-FR') || ''}
                          </div>
                        )}
                      </div>
                    }
                    cardClassName={char.tournamentChampion ? 'border-2 border-yellow-500 shadow-yellow-500/20' : ''}
                  />
                </div>
              );
            })}
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
