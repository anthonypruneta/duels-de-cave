import React from 'react';

/**
 * Écran de fermeture temporaire : bloque toute l’app (pas de routes, pas d’auth).
 * Désactivé via `FERMETURE_TEMPORAIRE_ACTIVE` dans Application.jsx.
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
