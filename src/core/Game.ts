import { Game, GamePhase, Player, GameState, MAIN_ACTION_TYPES, FinalScore } from './types';
import { BaseAction } from '../actions/Action';
import { ActionValidator } from './ActionValidator';
import { TurnManager } from './TurnManager';
import { ScoreManager } from './ScoreManager';
import { cloneGame } from './cloneGame';

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
    const previousPlayerIndex = this.state.currentPlayerIndex;
    console.log(`[Game] Executing action ${action.type} for player index ${previousPlayerIndex}`);

    try {
      // Exécuter l'action
      this.state = action.execute(this.state);

      const isMainAction = MAIN_ACTION_TYPES.includes(action.type);
      if (isMainAction && this.state.currentPlayerIndex === previousPlayerIndex) {
        this.state.players[previousPlayerIndex].hasPerformedMainAction = true;
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
  calculateFinalScores(): FinalScore[] {
    if (this.state.phase !== GamePhase.FINAL_SCORING || !this.state.finalScores) {
      throw new Error('La partie n\'est pas terminée');
    }
    return this.state.finalScores;
  }

  /**
   * Détermine le(s) gagnant(s) (score final, pénalité de danger comprise)
   */
  determineWinner(): string[] {
    return ScoreManager.determineWinner(this.calculateFinalScores());
  }

  /**
   * Sauvegarde l'état actuel dans l'historique
   */
  saveState(): void {
    // Instantané profond (sans l'historique, pour éviter la référence circulaire) :
    // une mutation ultérieure de l'état courant ne doit pas altérer ce qui sera restauré par undo
    const gameState: GameState = {
      state: { ...cloneGame(this.state), history: [] },
      timestamp: Date.now()
    };
    // Nouveau tableau : l'état fourni au moteur (ex: état React) ne doit pas être modifié
    this.state = { ...this.state, history: [...(this.state.history || []), gameState] };
  }

  /**
   * Annule la dernière action (undo)
   */
  undo(): boolean {
    if (this.state.history.length === 0) {
      return false;
    }

    const previousSnapshot = this.state.history.pop();
    if (previousSnapshot) {
      // On restaure l'état mais on conserve l'historique actuel (amputé du dernier état)
      this.state = {
        ...previousSnapshot.state,
        history: this.state.history
      };
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
      player.hasPerformedMainAction = false;
      player.score = 0;
      // TODO: Réinitialiser toutes les ressources
    });
  }
}
