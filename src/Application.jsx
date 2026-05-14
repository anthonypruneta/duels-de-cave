import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import CharacterCreation from './components/CharacterCreation';
import Combat from './components/Combat';
import Dungeon from './components/Dungeon';
import DungeonSelection from './components/DungeonSelection';
import CoopRedDungeon from './components/CoopRedDungeon';
import ForestDungeon from './components/ForestDungeon';
import MageTower from './components/MageTower';
import Tournament from './components/Tournament';
import HallOfFame from './components/HallOfFame';
import MesAnciensPersonnages from './components/MesAnciensPersonnages';
import Auth from './components/Auth';
import Admin from './components/Admin';
import InfiniteLabyrinth from './components/InfiniteLabyrinth';
import RogueLike from './components/RogueLike';
import Training from './components/Training';
import ProtectedRoute from './components/ProtectedRoute';
import ModeAvailabilityRoute from './components/ModeAvailabilityRoute';
import AdminOnlyRoute from './components/AdminOnlyRoute';
import AdminCharacterDirectory from './components/AdminCharacterDirectory';
import AdminBalance from './components/AdminBalance';
import WorldBoss from './components/WorldBoss';
import Taverne from './components/Taverne';
import ForgeDungeon from './components/ForgeDungeon';
import ExtensionDungeon from './components/ExtensionDungeon';
import SubclassDungeon from './components/SubclassDungeon';
import Encyclopedia from './components/Encyclopedia';
import BossRush from './components/BossRush';
import MirrorMode from './components/MirrorMode';
import PvpLobby from './components/PvpLobby';
import PvpLeaderboard from './components/PvpLeaderboard';
import { loadPersistedBalanceConfig } from './services/balanceConfigService';
import MaintenanceShutdown from './components/MaintenanceShutdown';

/** Repasser à `false` pour rouvrir le site (routes, auth, jeu). */
export const FERMETURE_TEMPORAIRE_ACTIVE = true;

function Application() {
  useEffect(() => {
    if (!FERMETURE_TEMPORAIRE_ACTIVE) {
      loadPersistedBalanceConfig();
    }
  }, []);

  if (FERMETURE_TEMPORAIRE_ACTIVE) {
    return <MaintenanceShutdown />;
  }

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
            path="/pvp"
            element={
              <ProtectedRoute>
                <PvpLobby />
              </ProtectedRoute>
            }
          />
          <Route
            path="/pvp-classement"
            element={
              <ProtectedRoute>
                <PvpLeaderboard />
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
            path="/coop-red"
            element={
              <ProtectedRoute>
                <ModeAvailabilityRoute>
                  <CoopRedDungeon />
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
            path="/tournament/history/:archiveId"
            element={
              <ProtectedRoute>
                <Tournament />
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
            path="/taverne"
            element={
              <ProtectedRoute>
                <Taverne />
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
            path="/encyclopedie"
            element={
              <ProtectedRoute>
                <Encyclopedia />
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
            path="/forge"
            element={
              <ProtectedRoute>
                <ModeAvailabilityRoute>
                  <ForgeDungeon />
                </ModeAvailabilityRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/extension"
            element={
              <ProtectedRoute>
                <ModeAvailabilityRoute>
                  <ExtensionDungeon />
                </ModeAvailabilityRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/sous-classe"
            element={
              <ProtectedRoute>
                <ModeAvailabilityRoute>
                  <SubclassDungeon />
                </ModeAvailabilityRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/boss-rush"
            element={
              <ProtectedRoute>
                <ModeAvailabilityRoute>
                  <BossRush />
                </ModeAvailabilityRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/mirror"
            element={
              <ProtectedRoute>
                <ModeAvailabilityRoute>
                  <MirrorMode />
                </ModeAvailabilityRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/cataclysme"
            element={
              <ProtectedRoute>
                <WorldBoss />
              </ProtectedRoute>
            }
          />
          <Route
            path="/roguelike"
            element={
              <ProtectedRoute>
                <AdminOnlyRoute>
                  <RogueLike />
                </AdminOnlyRoute>
              </ProtectedRoute>
            }
          />
          <Route
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
          <Route
            path="/admin/annuaire"
            element={
              <ProtectedRoute>
                <AdminOnlyRoute>
                  <AdminCharacterDirectory />
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
