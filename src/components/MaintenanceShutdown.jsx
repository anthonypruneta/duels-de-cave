import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Écran de fermeture temporaire pour les visiteurs.
 * Désactivé via `FERMETURE_TEMPORAIRE_ACTIVE` dans `src/config/maintenanceMode.js`.
 * Les admins peuvent encore ouvrir `/auth` puis `/admin/annuaire` (voir Application.jsx).
 */
export default function MaintenanceShutdown() {
  return (
    <div
      className="fixed inset-0 z-[99999] flex min-h-[100dvh] flex-col items-center justify-center overflow-auto bg-stone-950 px-6 py-12 text-stone-100"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="maintenance-titre"
      aria-describedby="maintenance-desc"
    >
      <div className="max-w-lg text-center">
        <p className="mb-2 text-4xl" aria-hidden="true">
          ⚔️
        </p>
        <h1
          id="maintenance-titre"
          className="font-serif text-2xl font-bold tracking-tight text-amber-400 sm:text-3xl"
        >
          Fermeture temporaire
        </h1>
        <div className="mt-6 w-full max-w-md rounded-xl border-2 border-amber-500/80 bg-stone-900/90 p-4 shadow-lg">
          <p className="text-center text-xs font-bold uppercase tracking-wide text-amber-200/90">
            Accès organisateur
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-center sm:gap-3">
            <Link
              to="/auth"
              className="inline-flex items-center justify-center rounded-lg bg-amber-600 px-4 py-2.5 text-center text-sm font-bold text-stone-950 shadow hover:bg-amber-500"
            >
              Connexion
            </Link>
            <Link
              to="/admin/annuaire"
              className="inline-flex items-center justify-center rounded-lg border-2 border-amber-500/70 bg-stone-800 px-4 py-2.5 text-center text-sm font-bold text-amber-100 hover:bg-stone-700"
            >
              Annuaire personnages
            </Link>
          </div>
          <p className="mt-2 text-center text-[11px] text-stone-500">
            Après connexion compte admin, tu es redirigé automatiquement vers l’annuaire.
          </p>
        </div>
        <p
          id="maintenance-desc"
          className="mt-6 text-base leading-relaxed text-stone-300 sm:text-lg"
        >
          <strong className="font-semibold text-stone-100">Duels de Cave</strong> est
          momentanément indisponible. Nous préparons la suite : soit le jeu revient avec
          de grosses mises à jour, soit un tout nouveau jeu fait son entrée. Merci pour
          votre patience et votre fidélité.
        </p>
        <p className="mt-8 text-sm text-stone-500">— L’équipe</p>
      </div>
    </div>
  );
}
