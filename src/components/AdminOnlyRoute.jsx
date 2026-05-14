import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/** Comptes autorisés sur /admin, uploads Storage, règles Firestore (isAdmin). */
export const ADMIN_EMAILS = [
  'antho.pruneta@gmail.com',
  'cronos2a@hotmail.fr'
];

export function isAdminEmail(email) {
  if (typeof email !== 'string') return false;
  const key = email.trim().toLowerCase();
  return ADMIN_EMAILS.some((a) => a.toLowerCase() === key);
}

function AdminOnlyRoute({ children }) {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-amber-400 text-2xl">Chargement...</div>
      </div>
    );
  }

  if (!currentUser) return <Navigate to="/auth" replace />;
  if (!isAdminEmail(currentUser.email)) return <Navigate to="/" replace />;

  return children;
}

export default AdminOnlyRoute;
