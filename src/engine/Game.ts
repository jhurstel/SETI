import { Game, MAIN_ACTION_TYPES } from '../core/types';
import { BaseAction } from '../actions/Action';
import { ActionValidator } from './ActionValidator';

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

    const previousPlayerIndex = this.state.currentPlayerIndex;
    const previousRound = this.state.currentRound;
    console.log(`[Game] Executing action ${action.type} for player index ${previousPlayerIndex}`);

    try {
      // Exécuter l'action
      this.state = action.execute(this.state);

      // Les interactions déclenchées par l'action (gains de carte, bonus…) appartiennent à sa séquence :
      // l'historique les rattache à l'action et l'annulation les traite avec elle
      const actionSequenceId = action.historyEntries.find(e => e.sequenceId)?.sequenceId;
      if (actionSequenceId) {
        action.newPendingInteractions = action.newPendingInteractions.map(i => i.sequenceId ? i : { ...i, sequenceId: actionSequenceId });
      }

      // Pas si l'action a clos la manche (dernière passe) : le joueur peut ouvrir la suivante comme premier joueur
      const isMainAction = MAIN_ACTION_TYPES.includes(action.type);
      if (isMainAction && this.state.currentPlayerIndex === previousPlayerIndex && this.state.currentRound === previousRound) {
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
}
