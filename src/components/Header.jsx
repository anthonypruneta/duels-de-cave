import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

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

  // Mobile: menu repliable pour éviter les soucis d'affichage/recouvrement.
  const [isMobile, setIsMobile] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // --- Son global ---
  const [volume, setVolume] = useState(() => {
    const saved = localStorage.getItem('game-volume');
    return saved !== null ? Number(saved) : 0.05;
  });
  const [isMuted, setIsMuted] = useState(() => localStorage.getItem('game-muted') === 'true');
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const volumeRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('game-volume', String(volume));
  }, [volume]);
  useEffect(() => {
    localStorage.setItem('game-muted', String(isMuted));
  }, [isMuted]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(max-width: 767px)');
    const sync = () => {
      const mobileNow = mq.matches;
      setIsMobile(mobileNow);
      // si on repasse sur desktop, on force l'ouverture (comportement actuel).
      if (!mobileNow) setIsMenuOpen(false);
    };
    sync();
    mq.addEventListener?.('change', sync);
    return () => mq.removeEventListener?.('change', sync);
  }, []);

  useEffect(() => {
    const sync = () => {
      document.querySelectorAll('audio').forEach(a => {
        a.volume = volume;
        a.muted = isMuted;
      });
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [volume, isMuted]);

  useEffect(() => {
    if (!showVolumeSlider) return;
    const handleClickOutside = (e) => {
      if (volumeRef.current && !volumeRef.current.contains(e.target)) {
        setShowVolumeSlider(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showVolumeSlider]);

  const handleToggleMute = () => {
    setIsMuted(prev => !prev);
    if (isMuted && volume === 0) setVolume(0.05);
  };

  const handleVolumeChange = (e) => {
    const v = Number(e.target.value);
    setVolume(v);
    setIsMuted(v === 0);
  };

  // --- PWA ---
  useEffect(() => {
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
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (!dismissed && (isIOS() || isAndroid())) {
      setShowInstallBtn(true);
    }
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (installPrompt) {
      installPrompt.prompt();
      const result = await installPrompt.userChoice;
      if (result.outcome === 'accepted') {
        setInstallPrompt(null);
        setShowInstallBtn(false);
      }
    } else {
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
    { path: '/', label: '🏠 Accueil' },
    { path: '/dungeons', label: '🏰 Donjons' },
    { path: '/coop-red', label: '🔴 Rouge coop' },
    { path: '/labyrinthe-infini', label: '🌀 Labyrinthe infini' },
    { path: '/boss-rush', label: '💀 Boss Rush' },
    { path: '/mirror', label: '🪞 Miroir' },
    { path: '/cataclysme', label: '☄️ Cataclysme' },
    { path: '/tournament', label: '🏆 Tournoi' },
    { path: '/training', label: '🎯 Entraînement' },
    { path: '/taverne', label: '🍺 Taverne' },
    { path: '/encyclopedie', label: '📚 Encyclopédie' },
    { path: '/hall-of-fame', label: '👑 Hall of Fame' },
    { path: '/mes-anciens-personnages', label: '📜 Mes anciens persos' },
    ...(isAdmin ? [{ path: '/roguelike', label: '🟣 Rogue-like', rogueLike: true }] : []),
    ...(isAdmin ? [{ path: '/combat', label: '⚔️ PvP' }] : []),
  ];

  return (
    <>
      <div className="absolute top-0 left-0 right-0 z-[200]">
        <div className="bg-stone-950/95 border-b border-stone-700/60 px-2 py-2">
          {currentUser && (
            <div className="flex flex-wrap items-center gap-1.5">
              {/* Mobile: bouton plié/déplié */}
              {isMobile ? (
                <button
                  type="button"
                  onClick={() => setIsMenuOpen(v => !v)}
                  className="text-[10px] font-bold text-amber-400/80 uppercase tracking-widest flex-shrink-0 mr-0.5 px-1.5 py-1 rounded border border-stone-700/60 bg-stone-900/30 hover:bg-stone-900/50 transition"
                  aria-expanded={isMenuOpen}
                >
                  Menu {isMenuOpen ? '▴' : '▾'}
                </button>
              ) : (
                <span className="text-[10px] font-bold text-amber-400/80 uppercase tracking-widest flex-shrink-0 mr-0.5">
                  Menu
                </span>
              )}

              {/* Desktop: tout affiché. Mobile: affichage conditionnel */}
              {(!isMobile || isMenuOpen) && navLinks.map(link => (
                <button
                  key={link.path}
                  onClick={() => {
                    navigate(link.path);
                    if (isMobile) setIsMenuOpen(false);
                  }}
                  className={`px-2.5 py-1.5 rounded text-xs font-medium transition border whitespace-nowrap flex-shrink-0 ${
                    location.pathname === link.path
                      ? (link.rogueLike
                        ? 'bg-violet-700 border-violet-300 text-white shadow-lg'
                        : 'bg-amber-600 border-amber-400 text-white shadow-lg')
                      : (link.rogueLike
                        ? 'bg-violet-900/50 border-violet-600 text-stone-200 hover:bg-violet-800/50 hover:border-violet-400/60 hover:text-white'
                        : 'bg-stone-800/80 border-stone-600 text-stone-300 hover:bg-stone-700 hover:border-amber-600/50 hover:text-white')
                  }`}
                >
                  {link.label}
                </button>
              ))}
              {/* Actions : suivent les liens et sont poussées à droite sur la dernière ligne */}
              <div className="ml-auto flex items-center gap-1.5 flex-shrink-0">
                <div ref={volumeRef} className="relative"
                  onMouseEnter={() => setShowVolumeSlider(true)}
                  onMouseLeave={() => setShowVolumeSlider(false)}
                >
                  <button
                    onClick={handleToggleMute}
                    className="px-2.5 py-1.5 rounded text-xs font-medium transition border bg-stone-800/80 border-stone-600 text-stone-300 hover:bg-stone-700 hover:border-amber-600/50 hover:text-white"
                  >
                    {isMuted || volume === 0 ? '🔇' : '🔊'}
                  </button>
                  {showVolumeSlider && (
                    <div className="absolute top-full right-0 bg-stone-900 border border-stone-600 rounded-lg p-3 w-48 shadow-xl z-50">
                      <div className="flex items-center gap-2">
                        <input
                          type="range" min="0" max="1" step="0.05"
                          value={isMuted ? 0 : volume}
                          onChange={handleVolumeChange}
                          className="w-full accent-amber-500"
                        />
                        <span className="text-xs text-stone-200 w-8 text-right">
                          {Math.round((isMuted ? 0 : volume) * 100)}%
                        </span>
                      </div>
                    </div>
                  )}
                </div>
                {showInstallBtn && (
                  <button onClick={handleInstall} title="Installer l'application"
                    className="bg-amber-600 hover:bg-amber-500 text-white px-2.5 py-1.5 rounded border border-amber-400 transition text-xs font-bold animate-pulse">
                    📲
                  </button>
                )}
                {isAdmin && (
                  <button onClick={() => navigate('/admin')}
                    className="bg-amber-700 hover:bg-amber-600 text-white px-2.5 py-1.5 rounded border border-amber-500 transition text-xs font-bold">
                    🛠️
                  </button>
                )}
                <button onClick={handleLogout}
                  className="bg-stone-700 hover:bg-stone-600 text-amber-300 px-2.5 py-1.5 rounded border border-amber-600/50 transition text-xs">
                  ×
                </button>
              </div>
            </div>
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
