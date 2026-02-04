import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import CharacterCreation from './components/CharacterCreation';
import Combat from './components/Combat';
import Dungeon from './components/Dungeon';
import DungeonSelection from './components/DungeonSelection';
import ForestDungeon from './components/ForestDungeon';
import MageTower from './components/MageTower';
import Auth from './components/Auth';
import Admin from './components/Admin';
import ProtectedRoute from './components/ProtectedRoute';

function Application() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <CharacterCreation />
              </ProtectedRoute>
            }
          />
          <Route
            path="/combat"
            element={
              <ProtectedRoute>
                <Combat />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dungeon"
            element={
              <ProtectedRoute>
                <Dungeon />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dungeons"
            element={
              <ProtectedRoute>
                <DungeonSelection />
              </ProtectedRoute>
            }
          />
          <Route
            path="/forest"
            element={
              <ProtectedRoute>
                <ForestDungeon />
              </ProtectedRoute>
            }
          />
          <Route
            path="/mage-tower"
            element={
              <ProtectedRoute>
                <MageTower />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <Admin />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default Application;
