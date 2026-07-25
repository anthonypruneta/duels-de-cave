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
import ClassicGameRoute from './components/ClassicGameRoute';
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
import CaveDestiny from './components/CaveDestiny';
import { loadPersistedBalanceConfig } from './services/balanceConfigService';
import MaintenanceShutdown from './components/MaintenanceShutdown';
import { FERMETURE_TEMPORAIRE_ACTIVE } from './config/maintenanceMode';

/** Repasser à `false` dans `src/config/maintenanceMode.js` pour rouvrir le site. */
export { FERMETURE_TEMPORAIRE_ACTIVE } from './config/maintenanceMode';

function classic(element) {
  return (
    <ProtectedRoute>
      <ClassicGameRoute>{element}</ClassicGameRoute>
    </ProtectedRoute>
  );
}

function classicMode(element) {
  return classic(
    <ModeAvailabilityRoute>{element}</ModeAvailabilityRoute>
  );
}

function Application() {
  useEffect(() => {
    if (!FERMETURE_TEMPORAIRE_ACTIVE) {
      loadPersistedBalanceConfig();
    }
  }, []);

  if (FERMETURE_TEMPORAIRE_ACTIVE) {
    return (
      <Router>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
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
            <Route path="*" element={<MaintenanceShutdown />} />
          </Routes>
        </AuthProvider>
      </Router>
    );
  }

  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/auth" element={<Auth />} />

          {/* Accueil public : Cave Destiny */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <CaveDestiny />
              </ProtectedRoute>
            }
          />
          <Route path="/cave-destiny" element={<Navigate to="/" replace />} />

          {/* Ancien accueil / création de perso — admins (ou tous si mode désactivé) */}
          <Route path="/perso" element={classic(<CharacterCreation />)} />

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
          <Route path="/pvp" element={classic(<PvpLobby />)} />
          <Route path="/pvp-classement" element={classic(<PvpLeaderboard />)} />
          <Route path="/dungeon" element={classicMode(<Dungeon />)} />
          <Route path="/dungeons" element={classicMode(<DungeonSelection />)} />
          <Route path="/coop-red" element={classicMode(<CoopRedDungeon />)} />
          <Route path="/forest" element={classicMode(<ForestDungeon />)} />
          <Route path="/mage-tower" element={classicMode(<MageTower />)} />
          <Route path="/tournament/history/:archiveId" element={classic(<Tournament />)} />
          <Route path="/tournament" element={classic(<Tournament />)} />
          <Route path="/hall-of-fame" element={classic(<HallOfFame />)} />
          <Route path="/taverne" element={classic(<Taverne />)} />
          <Route path="/mes-anciens-personnages" element={classic(<MesAnciensPersonnages />)} />
          <Route path="/encyclopedie" element={classic(<Encyclopedia />)} />
          <Route path="/training" element={classic(<Training />)} />
          <Route path="/labyrinthe-infini" element={classicMode(<InfiniteLabyrinth />)} />
          <Route path="/forge" element={classicMode(<ForgeDungeon />)} />
          <Route path="/extension" element={classicMode(<ExtensionDungeon />)} />
          <Route path="/sous-classe" element={classicMode(<SubclassDungeon />)} />
          <Route path="/boss-rush" element={classicMode(<BossRush />)} />
          <Route path="/mirror" element={classicMode(<MirrorMode />)} />
          <Route path="/cataclysme" element={classic(<WorldBoss />)} />

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
