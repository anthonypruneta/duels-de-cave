import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function ProtectedRoute({ children }) {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-amber-400 text-2xl">Chargement...</div>
      </div>
    );
  }

  return currentUser ? children : <Navigate to="/auth" replace />;
}

export default ProtectedRoute;
