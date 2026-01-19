import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import CharacterCreation from './components/CharacterCreation';
import Combat from './components/Combat';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<CharacterCreation />} />
        <Route path="/combat" element={<Combat />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
