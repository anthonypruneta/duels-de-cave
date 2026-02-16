import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import CharacterCreation from './components/CharacterCreation';
import Combat from './components/Combat';
import Dungeon from './components/Dungeon';
import DungeonSelection from './components/DungeonSelection';
import ForestDungeon from './components/ForestDungeon';
import MageTower from './components/MageTower';
import Tournament from './components/Tournament';
import HallOfFame from './components/HallOfFame';
import MesAnciensPersonnages from './components/MesAnciensPersonnages';
import Auth from './components/Auth';
import Admin from './components/Admin';
import InfiniteLabyrinth from './components/InfiniteLabyrinth';
import Training from './components/Training';
import ProtectedRoute from './components/ProtectedRoute';
import ModeAvailabilityRoute from './components/ModeAvailabilityRoute';
import AdminOnlyRoute from './components/AdminOnlyRoute';
import AdminBalance from './components/AdminBalance';
import { loadPersistedBalanceConfig } from './services/balanceConfigService';
<<<<<<< HEAD
import { ensureWorldBossAutoStart } from './services/worldBossService';
import WorldBoss from './components/WorldBoss';
=======
>>>>>>> parent of 8fa3e24 (Avoid WorldBoss symbol collision in app routes)

function Application() {

  useEffect(() => {
    loadPersistedBalanceConfig();
  }, []);

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
                <AdminOnlyRoute>
                  <Combat />
                </AdminOnlyRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/dungeon"
            element={
              <ProtectedRoute>
                <ModeAvailabilityRoute>
                  <Dungeon />
                </ModeAvailabilityRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/dungeons"
            element={
              <ProtectedRoute>
                <ModeAvailabilityRoute>
                  <DungeonSelection />
                </ModeAvailabilityRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/forest"
            element={
              <ProtectedRoute>
                <ModeAvailabilityRoute>
                  <ForestDungeon />
                </ModeAvailabilityRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/mage-tower"
            element={
              <ProtectedRoute>
                <ModeAvailabilityRoute>
                  <MageTower />
                </ModeAvailabilityRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/tournament"
            element={
              <ProtectedRoute>
                <Tournament />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hall-of-fame"
            element={
              <ProtectedRoute>
                <HallOfFame />
              </ProtectedRoute>
            }
          />
          <Route
            path="/mes-anciens-personnages"
            element={
              <ProtectedRoute>
                <MesAnciensPersonnages />
              </ProtectedRoute>
            }
          />

          <Route
            path="/training"
            element={
              <ProtectedRoute>
                <Training />
              </ProtectedRoute>
            }
          />
          <Route
            path="/labyrinthe-infini"
            element={
              <ProtectedRoute>
                <ModeAvailabilityRoute>
                  <InfiniteLabyrinth />
                </ModeAvailabilityRoute>
              </ProtectedRoute>
            }
          />
          <Route
<<<<<<< HEAD
            path="/cataclysme"
            element={
              <ProtectedRoute>
                <WorldBoss />
              </ProtectedRoute>
            }
          />
          <Route
=======
>>>>>>> parent of 8fa3e24 (Avoid WorldBoss symbol collision in app routes)
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminOnlyRoute>
                  <Admin />
                </AdminOnlyRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/balance"
            element={
              <ProtectedRoute>
                <AdminOnlyRoute>
                  <AdminBalance />
                </AdminOnlyRoute>
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
