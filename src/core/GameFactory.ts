/**
 * Factory pour créer et initialiser une nouvelle partie de SETI
 */

import {
  Game,
  GamePhase,
  Player,
  Decks,
  Species,
  DataComputer,
  GAME_CONSTANTS
} from './types';
import { BoardManager } from './Board';

export class GameFactory {
  /**
   * Crée une nouvelle partie
   */
  static createGame(playerNames: string[]): Game {
    if (playerNames.length < GAME_CONSTANTS.MIN_PLAYERS || playerNames.length > GAME_CONSTANTS.MAX_PLAYERS) {
      throw new Error(
        `Nombre de joueurs invalide (min ${GAME_CONSTANTS.MIN_PLAYERS}, max ${GAME_CONSTANTS.MAX_PLAYERS})`
      );
    }

    // Créer les joueurs
    const players: Player[] = playerNames.map((name, index) => 
      this.createPlayer(`player_${index}`, name)
    );

    // Créer le plateau
    const board = BoardManager.createInitialBoard();

    // Créer les decks
    const decks: Decks = {
      actionCards: [],
      missionCards: [],
      endGameCards: [],
      speciesCards: []
    };

    // Créer les espèces (non découvertes initialement)
    const species: Species[] = [];

    const game: Game = {
      id: `game_${Date.now()}`,
      currentRound: 1,
      maxRounds: GAME_CONSTANTS.MAX_ROUNDS,
      currentPlayerIndex: 0,
      firstPlayerIndex: 0,
      phase: GamePhase.SETUP,
      players,
      board,
      decks,
      species,
      discoveredSpecies: [],
      history: []
    };

    return game;
  }

  /**
   * Crée un joueur initialisé
   */
  private static createPlayer(id: string, name: string): Player {
    return {
      id,
      name,
      credits: GAME_CONSTANTS.INITIAL_CREDITS,
      energy: GAME_CONSTANTS.INITIAL_ENERGY,
      data: GAME_CONSTANTS.INITIAL_DATA,
      mediaCoverage: GAME_CONSTANTS.INITIAL_MEDIA_COVERAGE,
      revenueCredits: GAME_CONSTANTS.INITIAL_REVENUE_CREDITS,
      revenueEnergy: GAME_CONSTANTS.INITIAL_REVENUE_ENERGY,
      revenueCards: GAME_CONSTANTS.INITIAL_REVENUE_CARDS,
      probes: [],
      technologies: [],
      cards: [],
      missions: [],
      dataComputer: this.createDataComputer(),
      lifeTraces: [],
      score: 0,
      hasPassed: false,
      type: 'human',
      color: '#4a90e2' as string
    };
  }

  /**
   * Crée un ordinateur de données vide
   */
  private static createDataComputer(): DataComputer {
    return {
      topRow: [],
      bottomRow: [],
      canAnalyze: false
    };
  }

  /**
   * Initialise une partie (après le SETUP)
   */
  static initializeGame(game: Game): Game {
    if (game.phase !== GamePhase.SETUP) {
      throw new Error('La partie doit être en phase SETUP');
    }

    const updatedGame = { ...game };

    // TODO: Implémenter l'initialisation complète :
    // - Distribuer les cartes initiales
    // - Placer les signaux dans les secteurs
    // - Initialiser les technologies disponibles
    // - etc.

    updatedGame.phase = GamePhase.PLAYING;

    return updatedGame;
  }
}

