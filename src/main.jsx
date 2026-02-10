import React from 'react'
import ReactDOM from 'react-dom/client'
import Application from './Application'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Application />
  </React.StrictMode>,
)

// Enregistrer le service worker pour la PWA
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}