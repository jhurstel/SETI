import React from 'react';
import ReactDOM from 'react-dom/client';
import { BoardUI } from './ui/BoardUI';
import './ui/styles.css';
import './ui/styles/components.css';
import { setTraceLevel } from './core/trace';
import { DEBUG_AVAILABLE } from './ui/hooks/useDebugSetting';
import { ErrorBoundary } from './ui/components/ErrorBoundary';
import { installErrorListeners } from './ui/errorLog';

// Développement : traces des robots et du moteur dans la console (masquées en production)
if (DEBUG_AVAILABLE) setTraceLevel('info');

// Erreurs hors de l'affichage (actions, tâches de fond, promesses rejetées) : retenues pour le rapport de problème
installErrorListeners();

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    {/* Une erreur d'affichage montre l'écran d'erreur au lieu d'une page blanche */}
    <ErrorBoundary>
      <BoardUI/>
    </ErrorBoundary>
  </React.StrictMode>
);
