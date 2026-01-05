import React from 'react';
import ReactDOM from 'react-dom/client';
import { BoardUI } from './ui/BoardUI';
import { GameFactory } from './core/GameFactory';
import { Game, Card } from './core/types';
import './ui/styles.css';

/**
 * Crée un jeu mock pour le développement de l'UI
 */
function createMockGame(): Game {

  const gameState = GameFactory.createGame(['Alice', 'Bob']);
  const initializedGame = GameFactory.initializeGame(gameState);

  // Cartes mock
  const cards: Card[] = [
    {
      id: 'card1',
      name: 'Mission d\'exploration',
      type: 0 as any,
      cost: 2,
      effects: [],
      isMission: false,
      isEndGame: false,
      description: 'Gagnez 2 PV pour chaque planète visitée cette manche.',
    },
    {
      id: 'card2',
      name: 'Découverte majeure',
      type: 0 as any,
      cost: 3,
      effects: [],
      isMission: false,
      isEndGame: false,
      description: 'Placez un marqueur de découverte supplémentaire.',
    },
    {
      id: 'card3',
      name: 'Financement public',
      type: 0 as any,
      cost: 1,
      effects: [],
      isMission: false,
      isEndGame: false,
      description: 'Gagnez 3 crédits et 1 point de couverture médiatique.',
    },
  ];

  initializedGame.players[0].cards = cards;
  
  return initializedGame;
}

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <BoardUI game={createMockGame()} />
  </React.StrictMode>
);

