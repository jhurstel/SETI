/**
 * Classe principale représentant l'état du jeu SETI
 * 
 * Gère :
 * - L'état du jeu
 * - L'exécution des actions
 * - La validation des actions
 * - Les transitions de phase
 */

import {
  Game,
  GamePhase,
  Player,
  Board,
  Decks,
  Species,
  GameState,
  GAME_CONSTANTS
} from './types';
import { BaseAction } from '../actions/Action';
import { ActionValidator } from '../validation/ActionValidator';
import { RuleEngine } from '../validation/RuleEngine';
import { TurnManager } from './TurnManager';
import { ScoreManager } from '../scoring/ScoreManager';

export class GameEngine {
  private state: Game;

  constructor(initialState: Game) {
    this.state = initialState;
  }

  /**
   * Obtient l'état actuel du jeu
   */
  getState(): Game {
    return { ...this.state };
  }

  /**
   * Met à jour l'état du jeu (pour synchroniser avec l'UI)
   */
  setState(newState: Game): void {
    this.state = newState;
  }

  /**
   * Obtient le joueur actuel
   */
  getCurrentPlayer(): Player {
    return this.state.players[this.state.currentPlayerIndex];
  }

  /**
   * Vérifie si la partie est terminée
   */
  isGameOver(): boolean {
    return this.state.currentRound > this.state.maxRounds || 
           this.state.phase === GamePhase.FINAL_SCORING;
  }

  /**
   * Vérifie si tous les joueurs ont passé
   */
  allPlayersPassed(): boolean {
    return TurnManager.allPlayersPassed(this.state);
  }

  /**
   * Exécute une action
   */
  executeAction(action: BaseAction): {
    success: boolean;
    error?: string;
    updatedState?: Game;
  } {
    // Valider l'action
    const validation = ActionValidator.validateAction(this.state, action);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.errors[0]?.message || 'Action invalide'
      };
    }

    // Sauvegarder l'état
    this.saveState();

    try {
      // Exécuter l'action
      this.state = action.execute(this.state);

      // Appliquer les règles
      this.state = RuleEngine.applyRules(this.state, action.type);

      // Vérifier les limites
      const limitsCheck = RuleEngine.checkLimits(this.state, action.playerId);
      if (!limitsCheck.valid) {
        console.warn('Limites violées:', limitsCheck.violations);
      }

      return {
        success: true,
        updatedState: this.getState()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      };
    }
  }

  /**
   * Passe au joueur suivant
   */
  nextPlayer(): void {
    this.state = TurnManager.nextPlayer(this.state);
  }

  /**
   * Termine la manche actuelle
   */
  endRound(): void {
    this.state = TurnManager.endRound(this.state);
  }

  /**
   * Calcule le score final de tous les joueurs
   */
  calculateFinalScores(): Array<{
    playerId: string;
    scores: import('../core/types').ScoreCategories;
  }> {
    if (this.state.phase !== GamePhase.FINAL_SCORING) {
      throw new Error('La partie n\'est pas terminée');
    }

    return ScoreManager.calculateAllScores(this.state);
  }

  /**
   * Détermine le(s) gagnant(s)
   */
  determineWinner(): string[] {
    const scores = this.calculateFinalScores();
    return ScoreManager.determineWinner(scores);
  }

  /**
   * Sauvegarde l'état actuel dans l'historique
   */
  saveState(): void {
    const gameState: GameState = {
      state: { ...this.state },
      timestamp: Date.now()
    };
    this.state.history.push(gameState);
  }

  /**
   * Annule la dernière action (undo)
   */
  undo(): boolean {
    if (this.state.history.length === 0) {
      return false;
    }

    const previousState = this.state.history.pop();
    if (previousState) {
      this.state = previousState.state;
      return true;
    }

    return false;
  }

  /**
   * Réinitialise le jeu pour une nouvelle partie
   */
  reset(): void {
    // TODO: Implémenter la réinitialisation complète
    this.state.currentRound = 1;
    this.state.currentPlayerIndex = 0;
    this.state.firstPlayerIndex = 0;
    this.state.phase = GamePhase.SETUP;
    this.state.history = [];
    
    // Réinitialiser les joueurs
    this.state.players.forEach(player => {
      player.hasPassed = false;
      player.score = 0;
      // TODO: Réinitialiser toutes les ressources
    });
  }
}


