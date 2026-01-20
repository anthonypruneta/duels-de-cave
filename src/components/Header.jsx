import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function Header() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/auth');
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
    }
  };

  return (
    <div className="absolute top-4 right-4 flex items-center gap-4">
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
  );
}

export default Header;
