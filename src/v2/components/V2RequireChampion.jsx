import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ensureV2Prototype, hasV2Champion } from '../services/v2PrototypeService';

/**
 * Garde : redirige vers /v2 si le champion n’est pas encore créé.
 */
export default function V2RequireChampion({ children }) {
  const { currentUser } = useAuth();
  const [state, setState] = useState({ loading: true, ok: false });

  useEffect(() => {
    if (!currentUser?.uid) return;
    let cancelled = false;
    (async () => {
      const res = await ensureV2Prototype(currentUser.uid);
      if (cancelled) return;
      setState({
        loading: false,
        ok: res.success && hasV2Champion(res.data),
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUser?.uid]);

  if (state.loading) {
    return (
      <div className="min-h-screen bg-stone-950 text-stone-400 flex items-center justify-center text-sm">
        Chargement…
      </div>
    );
  }

  if (!state.ok) {
    return <Navigate to="/v2" replace />;
  }

  return children;
}
