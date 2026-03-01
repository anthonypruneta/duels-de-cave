import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from './Header';
import { races } from '../data/races';
import { classes } from '../data/classes';
import { getWeaponFamilyInfo, getWeaponsByFamily, RARITY_COLORS } from '../data/weapons';
import { MAGE_TOWER_PASSIVES } from '../data/mageTowerPassives';
import { getRaceBonusText, getClassDescriptionText, buildRaceAwakeningDescription } from '../utils/descriptionBuilders';
import { SUBCLASSES_BY_CLASS } from '../data/subclasses';

const STAT_LABELS = {
  hp: 'HP',
  auto: 'Auto',
  def: 'Déf',
  cap: 'Cap',
  rescap: 'ResC',
  spd: 'VIT',
};

const STAT_DESCRIPTIONS = {
  hp: "Points de vie max. Quand tu tombes à 0, le combat est perdu.",
  auto: "Puissance des attaques de base (et certaines compétences qui scalent dessus).",
  def: "Réduit les dégâts physiques reçus.",
  cap: "Puissance des capacités (CAP) et scaling de plusieurs effets.",
  rescap: "Réduit les dégâts magiques/CAP reçus.",
  spd: "Détermine l'ordre d'action (le plus rapide joue en premier).",
};

const splitDescriptionLines = (text) => {
  if (!text) return [];
  return text
    .split('\n')
    .flatMap((chunk) => chunk.split(' - '))
    .flatMap((chunk) => chunk.split(', '))
    .flatMap((chunk) => chunk.split(' & '))
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => (line.startsWith('-') ? line.replace(/^-\s*/, '') : line));
};

const TABS = [
  { id: 'stats', label: '📊 Stats', short: 'Stats' },
  { id: 'races', label: '🎭 Races', short: 'Races' },
  { id: 'classes', label: '⚔️ Classes', short: 'Classes' },
  { id: 'subclasses', label: '🎓 Sous-classes', short: 'Sous-classes' },
  { id: 'weapons', label: '🗡️ Armes', short: 'Armes' },
  { id: 'passives', label: '✨ Passifs', short: 'Passifs' },
  { id: 'forge', label: '🔨 Forge', short: 'Forge' },
  { id: 'extension', label: '✨ Extension', short: 'Extension' },
];

function Encyclopedia() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('stats');
  const weaponFamilies = getWeaponFamilyInfo();

  return (
    <div className="min-h-screen text-stone-200">
      <Header />
      <div className="pt-24 pb-12 px-4 max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-amber-400 mb-2 text-center">📚 Encyclopédie du jeu</h1>
        <p className="text-stone-400 text-center mb-6 text-sm">Races, classes, sous-classes, armes et mécaniques</p>

        {/* Onglets */}
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 rounded-lg font-medium text-sm transition border ${
                activeTab === tab.id
                  ? 'bg-amber-600 border-amber-400 text-white shadow-lg'
                  : 'bg-stone-800 border-stone-600 text-stone-300 hover:bg-stone-700 hover:border-amber-600/50'
              }`}
              title={tab.label}
            >
              {tab.short}
            </button>
          ))}
        </div>

        {/* Contenu par onglet */}
        <div className="bg-stone-900/60 border border-stone-600 rounded-xl p-6 min-h-[400px]">
          {activeTab === 'stats' && (
            <section>
              <h2 className="text-xl text-amber-300 font-bold mb-4">📊 Description des stats</h2>
              <div className="grid md:grid-cols-2 gap-3">
                {Object.entries(STAT_LABELS).map(([key, label]) => (
                  <div key={key} className="bg-stone-800/80 border border-stone-700 p-4 rounded-lg">
                    <div className="font-bold text-white mb-1">{label}</div>
                    <div className="text-stone-300 text-sm">{STAT_DESCRIPTIONS[key]}</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {activeTab === 'races' && (
            <section>
              <h2 className="text-xl text-amber-300 font-bold mb-4">🎭 Races & Awakening</h2>
              <p className="text-stone-400 text-sm mb-6">
                Chaque race apporte des bonus de base. L'Awakening (éveil) se débloque au niveau indiqué et renforce ces effets.
              </p>
              <div className="space-y-6">
                {Object.entries(races).map(([name, info]) => {
                  const bonusLines = splitDescriptionLines(getRaceBonusText(name));
                  const awakeningLines = splitDescriptionLines(buildRaceAwakeningDescription(name));
                  return (
                    <div key={name} className="bg-stone-800/80 border border-stone-700 rounded-lg overflow-hidden">
                      <div className="bg-stone-700/50 px-4 py-2 font-bold text-amber-200 border-b border-stone-600">
                        {info.icon} {name}
                      </div>
                      <div className="p-4 grid md:grid-cols-2 gap-4">
                        <div className="bg-stone-900/60 border border-stone-700 p-4 rounded-lg">
                          <div className="text-stone-400 text-xs font-semibold mb-2 uppercase">Bonus racial</div>
                          <ul className="text-stone-300 text-sm space-y-1">
                            {bonusLines.map((line, idx) => (
                              <li key={`${name}-bonus-${idx}`}>• {line}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="bg-stone-900/60 border border-stone-700 p-4 rounded-lg">
                          <div className="text-emerald-400 text-xs font-semibold mb-2 uppercase">
                            Awakening (Niv. {info.awakening?.levelRequired})
                          </div>
                          <ul className="text-emerald-200/90 text-sm space-y-1">
                            {awakeningLines.map((line, idx) => (
                              <li key={`${name}-awak-${idx}`}>• {line}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {activeTab === 'classes' && (
            <section>
              <h2 className="text-xl text-amber-300 font-bold mb-4">⚔️ Classes détaillées</h2>
              <div className="grid md:grid-cols-2 gap-4">
                {Object.entries(classes).map(([name, info]) => (
                  <div key={name} className="bg-stone-800/80 border border-stone-700 p-4 rounded-lg">
                    <div className="font-bold text-white mb-2">{info.icon} {name}</div>
                    <div className="text-amber-200 text-sm font-medium mb-2">{info.ability}</div>
                    <div className="text-stone-300 text-sm">{getClassDescriptionText(name)}</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {activeTab === 'subclasses' && (
            <section>
              <h2 className="text-xl text-amber-300 font-bold mb-2">🎓 Sous-classes (Collège Kunugigaoka)</h2>
              <p className="text-stone-400 text-sm mb-6">
                Chaque classe possède deux sous-classes débloquées via le donjon Collège Kunugigaoka. Elles modifient la capacité de base et peuvent ajouter un bonus de stats.
              </p>
              <div className="space-y-6">
                {Object.entries(SUBCLASSES_BY_CLASS).map(([className, subList]) => {
                  const classInfo = classes[className];
                  return (
                    <div key={className} className="bg-stone-800/80 border border-stone-700 rounded-lg overflow-hidden">
                      <div className="bg-stone-700/50 px-4 py-2 font-bold text-amber-200 border-b border-stone-600">
                        {classInfo?.icon ?? '⚔️'} {className}
                      </div>
                      <div className="p-4 grid md:grid-cols-2 gap-4">
                        {subList.map((sub) => (
                          <div key={sub.id} className="bg-stone-900/60 border border-stone-700 p-4 rounded-lg">
                            <div className="font-bold text-white mb-1">{sub.name}</div>
                            {sub.bonus && (
                              <div className="text-amber-200 text-sm mb-2">{sub.bonus}</div>
                            )}
                            <div className="text-stone-400 text-xs font-semibold mb-1">Capacité</div>
                            <div className="text-stone-300 text-sm mb-2">{sub.abilityLabel}</div>
                            <div className="text-stone-400 text-xs font-semibold mb-1">Effet</div>
                            <div className="text-stone-300 text-sm">{sub.description}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {activeTab === 'weapons' && (
            <section>
              <h2 className="text-xl text-amber-300 font-bold mb-4">🗡️ Armes</h2>
              <div className="space-y-4">
                {Object.entries(weaponFamilies).map(([familyId, familyInfo]) => {
                  const familyWeapons = getWeaponsByFamily(familyId).sort((a, b) => {
                    const rank = { commune: 1, rare: 2, legendaire: 3 };
                    return rank[a.rarete] - rank[b.rarete];
                  });
                  return (
                    <div key={familyId} className="bg-stone-800/80 border border-stone-700 p-4 rounded-lg">
                      <div className="font-bold text-white mb-3">{familyInfo.icon} {familyInfo.nom}</div>
                      <div className="grid md:grid-cols-3 gap-3">
                        {familyWeapons.map((weapon) => (
                          <div key={weapon.id} className="bg-stone-900/80 border border-stone-700 p-3 rounded-lg">
                            <div className={`text-sm font-bold ${RARITY_COLORS[weapon.rarete] ?? 'text-stone-300'}`}>
                              {weapon.nom}
                            </div>
                            <div className="text-xs text-stone-500 mb-1 capitalize">{weapon.rarete}</div>
                            {(Object.entries(weapon.stats || {}).filter(([, v]) => v !== 0).length > 0) && (
                              <div className="text-xs text-stone-300 mb-1">
                                {Object.entries(weapon.stats || {})
                                  .filter(([, v]) => v !== 0)
                                  .map(([k, v]) => `${STAT_LABELS[k] || k} ${v > 0 ? `+${v}` : v}`)
                                  .join(' • ')}
                              </div>
                            )}
                            {weapon.effet && typeof weapon.effet === 'object' ? (
                              <div className="text-xs text-amber-200 mt-1">
                                Effet: {weapon.effet.nom} — {weapon.effet.description}
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {activeTab === 'passives' && (
            <section>
              <h2 className="text-xl text-amber-300 font-bold mb-4">✨ Passifs (Tour de Mage)</h2>
              <div className="grid md:grid-cols-2 gap-4">
                {MAGE_TOWER_PASSIVES.map((passive) => (
                  <div key={passive.id} className="bg-stone-800/80 border border-stone-700 p-4 rounded-lg">
                    <div className="font-bold text-white mb-3">{passive.icon} {passive.name}</div>
                    <div className="space-y-2">
                      {Object.entries(passive.levels || {}).map(([lvl, lvlData]) => (
                        <div key={`${passive.id}-${lvl}`} className="text-sm">
                          <span className="text-amber-200 font-semibold">Niv. {lvl}:</span>{' '}
                          <span className="text-stone-300">{lvlData.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {activeTab === 'forge' && (
            <section>
              <h2 className="text-xl text-amber-300 font-bold mb-4">🔨 Amélioration des armes (Forge des Légendes)</h2>
              <div className="space-y-4 text-stone-300 text-sm max-w-3xl">
                <p>
                  La <strong className="text-amber-200">Forge des Légendes</strong> est un donjon optionnel affrontant <strong>Ornn, le Dieu de la Forge</strong>. Il est accessible uniquement si vous équipez une <strong>arme légendaire</strong>.
                </p>
                <p>
                  En cas de victoire, votre arme reçoit un <strong className="text-emerald-300">upgrade permanent</strong> : des bonus en pourcentage sont appliqués sur chaque stat positive de l'arme (Auto, VIT, CAP, HP, DEF, ResC). Les plages de bonus sont tirées aléatoirement (environ +10 % à +20 % par stat concernée). Certaines armes peuvent aussi recevoir un <strong className="text-amber-300">malus</strong> sur une stat (ex. Vitesse). Les bonus et malus s'appliquent sur les stats totales du personnage en combat. Une fois forgée, l'arme conserve cet upgrade pour tous vos futurs combats.
                </p>
              </div>
            </section>
          )}

          {activeTab === 'extension' && (
            <section>
              <h2 className="text-xl text-amber-300 font-bold mb-4">✨ Fusion des passifs (Extension du Territoire)</h2>
              <div className="space-y-4 text-stone-300 text-sm max-w-3xl">
                <p>
                  L'<strong className="text-amber-200">Extension du Territoire</strong> est un donjon optionnel affrontant <strong>Satoru Gojo</strong>. Il est accessible uniquement si vous avez un <strong>passif Tour du Mage au niveau 3</strong>.
                </p>
                <p>
                  En cas de victoire, vous <strong className="text-emerald-300">conservez votre passif actuel</strong> (niveau 3) et vous gagnez un <strong className="text-emerald-300">second passif</strong>, tiré aléatoirement parmi les autres passifs du Tour du Mage. Le niveau du passif d'extension est tiré au sort : <strong className="text-amber-200">90 % niveau 1</strong>, <strong className="text-amber-200">9 % niveau 2</strong>, <strong className="text-amber-200">1 % niveau 3</strong>.
                </p>
                <p>
                  Le nom affiché est une <strong>fusion</strong> des deux passifs (ex. « Orbe du Sacrifice de la Licorne »). Si le passif d'extension est niveau 2 ou 3, le niveau apparaît à côté du nom. Au survol du nom fusionné, vous pouvez voir le détail des deux passifs. Vous cumulez les effets de votre passif principal (niv. 3) et ceux du passif secondaire pour tous vos combats.
                </p>
              </div>
            </section>
          )}
        </div>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="px-5 py-2.5 bg-stone-700 hover:bg-stone-600 border border-amber-600/50 text-amber-200 rounded-lg font-medium transition"
          >
            ← Retour à l'accueil
          </button>
        </div>
      </div>
    </div>
  );
}

export default Encyclopedia;
