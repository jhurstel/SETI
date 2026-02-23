import { ActionType, Game, MAIN_ACTION_TYPES, ValidationResult } from './types';
import { BaseAction } from '../actions/Action';

export class ActionValidator {
  /**
   * Valide une action avant son exécution
   */
  static validateAction(game: Game, action: BaseAction): ValidationResult {
    // Vérifier que c'est le tour du joueur
    if (game.currentPlayerIndex < 0 || game.currentPlayerIndex >= game.players.length) {
      return {
        valid: false,
        errors: [{
          code: 'INVALID_TURN',
          message: 'Tour invalide'
        }],
        warnings: []
      };
    }

    const currentPlayer = game.players[game.currentPlayerIndex];
    if (currentPlayer.id !== action.playerId) {
      return {
        valid: false,
        errors: [{
          code: 'NOT_PLAYER_TURN',
          message: 'Ce n\'est pas votre tour'
        }],
        warnings: []
      };
    }

    // Vérifier que le joueur n'a pas passé
    if (currentPlayer.hasPassed) {
      return {
        valid: false,
        errors: [{
          code: 'PLAYER_PASSED',
          message: 'Vous avez déjà passé ce tour'
        }],
        warnings: []
      };
    }

    // Vérifier si une action principale a déjà été effectuée
    const isMainAction = MAIN_ACTION_TYPES.includes(action.type as ActionType);

    // Cas spécial pour MoveProbeAction qui peut être une action principale (payante) ou une action gratuite (bonus)
    if (isMainAction && currentPlayer.hasPerformedMainAction) {
      return {
        valid: false,
        errors: [{
          code: 'MAIN_ACTION_ALREADY_PERFORMED',
          message: 'Vous avez déjà effectué votre action principale pour ce tour'
        }],
        warnings: []
      };
    }

    // Valider l'action elle-même
    return action.validate(game);
  }

  /**
   * Vérifie si une action peut être exécutée
   */
  static canExecuteAction(game: Game, action: BaseAction): boolean {
    const validation = this.validateAction(game, action);
    return validation.valid;
  }
}
