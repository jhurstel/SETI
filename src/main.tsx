import React from 'react';
import ReactDOM from 'react-dom/client';
import { BoardUI } from './ui/BoardUI';
import { GameFactory } from './core/GameFactory';
import { Game } from './core/types';
import './ui/styles.css';

/**
 * Crée un jeu mock pour le développement de l'UI
 */
function createMockGame(): Game {

  const gameState = GameFactory.createGame(['Alice', 'Bob', 'Charlie']);
  const initializedGame = GameFactory.initializeGame(gameState);

  // Configuration des joueurs : 1er humain, autres robots + couleurs
  const colors = ['#4a90e2', '#ff6b6b', '#ffd700', '#4caf50'];
  initializedGame.players = initializedGame.players.map((p, index) => ({
    ...p,
    type: index === 0 ? 'human' : 'robot',
    color: colors[index % colors.length],
  }));
  
  return initializedGame;
}

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <BoardUI game={createMockGame()} />
  </React.StrictMode>
);
