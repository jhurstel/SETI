import React from 'react';
import ReactDOM from 'react-dom/client';
import { BoardUI } from './ui/BoardUI';
import { GameFactory } from './core/GameFactory';
import { Game, Card, CardType, FreeAction, RevenueBonus, SectorColor } from './core/types';
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

  // Cartes mock
  const cards: Card[] = [
    {
      id: 'card1',
      name: 'Mission d\'exploration',
      type: CardType.ACTION,
      cost: 2,
      freeAction: FreeAction.MOVEMENT,
      scanSector: SectorColor.BLUE,
      revenue: RevenueBonus.CREDIT,
      effects: [],
      description: 'Gagnez 2 PV pour chaque planète visitée cette manche.',
    },
    {
      id: 'card2',
      name: 'Découverte majeure',
      type: CardType.CONDITIONAL_MISSION,
      cost: 3,
      freeAction: FreeAction.DATA,
      scanSector: SectorColor.RED,
      revenue: RevenueBonus.ENERGY,
      effects: [],
      description: 'Placez un marqueur de découverte supplémentaire.',
    },
    {
      id: 'card3',
      name: 'Financement public',
      type: CardType.END_GAME,
      cost: 1,
      freeAction: FreeAction.MEDIA,
      scanSector: SectorColor.YELLOW,
      revenue: RevenueBonus.CARD,
      effects: [],
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
