import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ADMIN_EMAIL = 'antho.pruneta@gmail.com';

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
  if (currentUser.email !== ADMIN_EMAIL) return <Navigate to="/" replace />;

  return children;
}

export default AdminOnlyRoute;
