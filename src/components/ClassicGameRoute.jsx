import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { CAVE_DESTINY_ONLY_MODE } from '../config/maintenanceMode';
import { isAdminEmail } from './AdminOnlyRoute';

/**
 * Protège le contenu « Duels de Cave » classique.
 * En mode Cave Destiny only, seuls les admins y ont accès.
 */
function ClassicGameRoute({ children }) {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-amber-400 text-2xl">Chargement...</div>
      </div>
    );
  }

  if (!currentUser) return <Navigate to="/auth" replace />;

  if (CAVE_DESTINY_ONLY_MODE && !isAdminEmail(currentUser.email)) {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default ClassicGameRoute;
