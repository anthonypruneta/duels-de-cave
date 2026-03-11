import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// Détection plateforme
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent);
const isAndroid = () => /Android/.test(navigator.userAgent);
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

const ADMIN_EMAIL = 'antho.pruneta@gmail.com';

function Header() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [showInstallBtn, setShowInstallBtn] = useState(false);
  const isAdmin = currentUser?.email === ADMIN_EMAIL;

  useEffect(() => {
    // Déjà installée en standalone → pas de bouton
    if (isStandalone()) return;

    const handler = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
      setShowInstallBtn(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => {
      setInstallPrompt(null);
      setShowInstallBtn(false);
    });

    // Sur mobile sans beforeinstallprompt (iOS, ou Android avant le prompt)
    // Afficher le bouton qui ouvre un guide
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (!dismissed && (isIOS() || isAndroid())) {
      setShowInstallBtn(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (installPrompt) {
      // Chrome/Android : prompt natif
      installPrompt.prompt();
      const result = await installPrompt.userChoice;
      if (result.outcome === 'accepted') {
        setInstallPrompt(null);
        setShowInstallBtn(false);
      }
    } else if (isIOS()) {
      // iOS : afficher le guide
      setShowIOSGuide(true);
    } else {
      // Android sans prompt encore prêt : guide aussi
      setShowIOSGuide(true);
    }
  };

  const dismissInstall = () => {
    setShowInstallBtn(false);
    setShowIOSGuide(false);
    localStorage.setItem('pwa-install-dismissed', '1');
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/auth');
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
    }
  };

  const navLinks = [
    { path: '/', label: '🏠', title: 'Accueil' },
    { path: '/dungeons', label: '🏰', title: 'Donjon' },
    { path: '/training', label: '🎯', title: 'Entraînement' },
    { path: '/labyrinthe-infini', label: '🌀', title: 'Labyrinthe' },
    { path: '/cataclysme', label: '☄️', title: 'Cataclysme' },
    { path: '/taverne', label: '🍺', title: 'Taverne' },
    { path: '/encyclopedie', label: '📚', title: 'Encyclopédie' },
    { path: '/tournament', label: '🏆', title: 'Tournoi' },
    { path: '/hall-of-fame', label: '👑', title: 'Hall of Fame' },
    { path: '/mes-anciens-personnages', label: '📜', title: 'Anciens Persos' },
    ...(isAdmin ? [{ path: '/combat', label: '⚔️', title: 'PvP' }] : []),
  ];

  return (
    <>
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-50">
        <div className="flex items-center gap-2">
          {currentUser && navLinks.map(link => (
            <button
              key={link.path}
              onClick={() => navigate(link.path)}
              title={link.title}
              className={`px-3 py-2 rounded text-lg transition border ${
                location.pathname === link.path
                  ? 'bg-amber-600 border-amber-400 shadow-lg'
                  : 'bg-stone-800/80 border-stone-600 hover:bg-stone-700 hover:border-amber-600/50'
              }`}
            >
              {link.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-4">
          {showInstallBtn && (
            <button
              onClick={handleInstall}
              title="Installer l'application"
              className="bg-amber-600 hover:bg-amber-500 text-white px-3 py-2 rounded border border-amber-400 transition text-sm font-bold animate-pulse"
            >
              📲 Installer
            </button>
          )}
          {currentUser && (
            <>
              {isAdmin && (
                <button
                  onClick={() => navigate('/admin')}
                  className="bg-amber-700 hover:bg-amber-600 text-white px-3 py-2 rounded border border-amber-500 transition text-sm font-bold"
                  title="Administration"
                >
                  🛠️ Admin
                </button>
              )}
              <span className="text-amber-300 text-sm hidden md:inline">
                {currentUser.email}
              </span>
              <button
                onClick={handleLogout}
                className="bg-stone-700 hover:bg-stone-600 text-amber-300 px-4 py-2 rounded border border-amber-600/50 transition"
              >
                Déconnexion
              </button>
            </>
          )}
        </div>
      </div>

      {/* Guide d'installation iOS / Android */}
      {showIOSGuide && (
        <div className="fixed inset-0 bg-black/80 flex items-end md:items-center justify-center z-[100] p-4" onClick={dismissInstall}>
          <div className="bg-stone-800 border-2 border-amber-500 rounded-xl p-6 max-w-sm w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-amber-400 mb-4 text-center">📲 Installer Duels de Cave</h3>

            {isIOS() ? (
              <div className="space-y-3 text-stone-300 text-sm">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">1.</span>
                  <p>Appuie sur le bouton <span className="inline-block bg-stone-700 px-2 py-0.5 rounded text-lg">⬆️</span> <strong>Partager</strong> en bas de Safari</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-2xl">2.</span>
                  <p>Fais défiler et appuie sur <strong>"Sur l'écran d'accueil"</strong> ➕</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-2xl">3.</span>
                  <p>Appuie sur <strong>"Ajouter"</strong> en haut à droite</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-stone-300 text-sm">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">1.</span>
                  <p>Appuie sur le menu <span className="inline-block bg-stone-700 px-2 py-0.5 rounded text-lg">⋮</span> en haut à droite de Chrome</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-2xl">2.</span>
                  <p>Appuie sur <strong>"Installer l'application"</strong> ou <strong>"Ajouter à l'écran d'accueil"</strong></p>
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button
                onClick={dismissInstall}
                className="flex-1 bg-stone-700 hover:bg-stone-600 text-stone-300 py-2 rounded-lg transition text-sm"
              >
                Plus tard
              </button>
              <button
                onClick={dismissInstall}
                className="flex-1 bg-amber-600 hover:bg-amber-500 text-white py-2 rounded-lg transition text-sm font-bold"
              >
                OK compris !
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Header;
