import React from 'react';
import ReactDOM from 'react-dom/client';
import { BoardUI } from './ui/BoardUI';
import './ui/styles.css';
import './ui/styles/components.css';
import { setTraceLevel } from './core/trace';
import { DEBUG_AVAILABLE } from './ui/hooks/useDebugSetting';

// Développement : traces des robots et du moteur dans la console (masquées en production)
if (DEBUG_AVAILABLE) setTraceLevel('info');

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <BoardUI/>
  </React.StrictMode>
);
