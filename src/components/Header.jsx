import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function Header() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

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
    { path: '/tournament', label: '🏆', title: 'Tournoi' },
    { path: '/hall-of-fame', label: '👑', title: 'Hall of Fame' },
    { path: '/mes-anciens-personnages', label: '📜', title: 'Anciens Persos' },
  ];

  return (
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
        {currentUser && (
          <>
            <span className="text-amber-300 text-sm">
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
  );
}

export default Header;
