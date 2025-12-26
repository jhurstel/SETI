/**
 * Interface de base pour toutes les actions du jeu
 */

import {
  Game,
  ActionType,
  ValidationResult
} from '../core/types';

export interface IAction {
  id: string;
  type: ActionType;
  playerId: string;
  timestamp: number;
  
  /**
   * Exécute l'action et retourne le nouvel état du jeu
   */
  execute(game: Game): Game;
  
  /**
   * Valide si l'action peut être exécutée
   */
  validate(game: Game): ValidationResult;
  
  /**
   * Vérifie rapidement si l'action peut être exécutée
   */
  canExecute(game: Game): boolean;
}

/**
 * Classe de base pour les actions
 */
export abstract class BaseAction implements IAction {
  id: string;
  type: ActionType;
  playerId: string;
  timestamp: number;

  constructor(type: ActionType, playerId: string) {
    this.id = `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.type = type;
    this.playerId = playerId;
    this.timestamp = Date.now();
  }

  abstract execute(game: Game): Game;
  abstract validate(game: Game): ValidationResult;

  canExecute(game: Game): boolean {
    const validation = this.validate(game);
    return validation.valid;
  }

  /**
   * Crée un résultat de validation valide
   */
  protected createValidResult(): ValidationResult {
    return {
      valid: true,
      errors: [],
      warnings: []
    };
  }

  /**
   * Crée un résultat de validation invalide
   */
  protected createInvalidResult(reason: string): ValidationResult {
    return {
      valid: false,
      errors: [{
        code: this.type,
        message: reason
      }],
      warnings: []
    };
  }
}

