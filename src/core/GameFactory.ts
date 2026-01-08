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
  GAME_CONSTANTS,
  Technology
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

    // Mélanger les technologies et appliquer les bonus de pile
    this.shuffleTechnologies(updatedGame);

    // TODO: Implémenter l'initialisation complète :
    // - Distribuer les cartes initiales
    // - Placer les signaux dans les secteurs
    // - Initialiser les technologies disponibles
    // - etc.

    updatedGame.phase = GamePhase.PLAYING;

    return updatedGame;
  }

  /**
   * Mélange les piles de technologies et applique le bonus à la première carte
   */
  private static shuffleTechnologies(game: Game): void {
    const shuffle = <T>(array: T[]): T[] => {
      const newArray = [...array];
      for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
      }
      return newArray;
    };

    if (game.board.technologyBoard.categorySlots) {
      game.board.technologyBoard.categorySlots.forEach(slot => {
        const stacks = new Map<string, Technology[]>();
        
        // Regrouper les technologies par pile (basé sur l'ID racine, ex: 'exploration-1')
        slot.technologies.forEach(tech => {
          const lastDashIndex = tech.id.lastIndexOf('-');
          const baseId = tech.id.substring(0, lastDashIndex);
          
          if (!stacks.has(baseId)) {
            stacks.set(baseId, []);
          }
          stacks.get(baseId)!.push(tech);
        });
        
        const shuffledTechnologies: Technology[] = [];
        
        // Mélanger chaque pile et appliquer le bonus
        stacks.forEach((stack) => {
          const shuffledStack = shuffle(stack);
          
          // La première carte (visible) gagne +2 PV
          if (shuffledStack.length > 0) {
            shuffledStack[0].bonus = {
              ...shuffledStack[0].bonus,
              pv: (shuffledStack[0].bonus.pv || 0) + 2
            };
          }
          
          shuffledTechnologies.push(...shuffledStack);
        });
        
        slot.technologies = shuffledTechnologies;
      });
      
      // Mettre à jour la liste globale des technologies disponibles
      game.board.technologyBoard.available = game.board.technologyBoard.categorySlots.flatMap(s => s.technologies);
    }
  }
}
