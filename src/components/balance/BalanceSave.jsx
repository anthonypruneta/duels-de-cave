import React from 'react';
import { BALANCE_CONFIG_VERSION, getLastLoadedStoredVersion } from '../../services/balanceConfigService';

export default function BalanceSave({ saving, saveMessage, syncing, syncMessage, onApplyChanges, onForceSyncFromCode }) {
  return (
    <div className="space-y-4">
      <div className="bg-stone-900/70 border border-amber-500 rounded-lg p-5">
        <h2 className="text-lg text-amber-300 font-bold mb-3">Sauvegarder les modifications</h2>
        <p className="text-stone-400 text-sm mb-4">
          Sauvegarde les valeurs modifiées dans Firebase Storage et les applique immédiatement à tout le jeu.
        </p>
        <button
          onClick={onApplyChanges}
          disabled={saving}
          className="w-full bg-green-600 hover:bg-green-500 disabled:bg-stone-700 text-white py-3 rounded font-bold transition-colors"
        >
          {saving ? '⏳ Sauvegarde...' : '✅ Sauvegarder et appliquer à tout le jeu'}
        </button>
        {saveMessage && <p className="text-sm text-green-300 mt-3">{saveMessage}</p>}
      </div>

      <div className="bg-stone-900/70 border border-stone-600 rounded-lg p-5">
        <h2 className="text-lg text-amber-300 font-bold mb-3">Synchronisation</h2>
        <p className="text-xs text-stone-400 mb-2">
          Version config : <strong className="text-amber-200">code v{BALANCE_CONFIG_VERSION}</strong>
          {getLastLoadedStoredVersion() != null && (
            <> · fichier Storage (au chargement) : <strong className="text-amber-200">v{getLastLoadedStoredVersion()}</strong></>
          )}
        </p>
        <p className="text-xs text-stone-400 mb-3">Si le fichier balance.json ne se met pas à jour au chargement :</p>
        <button
          type="button"
          onClick={onForceSyncFromCode}
          disabled={syncing}
          className="w-full bg-amber-700 hover:bg-amber-600 disabled:bg-stone-700 text-white py-2 rounded text-sm font-medium transition-colors"
        >
          {syncing ? '⏳ Synchro...' : '🔄 Forcer synchro code → Storage'}
        </button>
        {syncMessage && <p className="text-sm text-amber-200 mt-2">{syncMessage}</p>}
      </div>
    </div>
  );
}
