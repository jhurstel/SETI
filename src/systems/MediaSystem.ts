/**
 * Système de gestion de la couverture médiatique
 * 
 * Gère :
 * - Couverture médiatique (max 10)
 * - Dépenses (cartes, technologies)
 * - Gains passifs
 */

import {
  Game,
  Player,
  GAME_CONSTANTS
} from '../core/types';

export class MediaSystem {
  /**
   * Vérifie si un joueur peut dépenser de la couverture médiatique
   */
  static canSpendMedia(
    player: Player,
    amount: number
  ): {
    canSpend: boolean;
    reason?: string;
  } {
    if (player.mediaCoverage < amount) {
      return { 
        canSpend: false, 
        reason: `Couverture médiatique insuffisante (nécessite ${amount}, a ${player.mediaCoverage})` 
      };
    }

    return { canSpend: true };
  }

  /**
   * Dépense de la couverture médiatique
   */
  static spendMedia(
    player: Player,
    amount: number
  ): Player {
    const validation = this.canSpendMedia(player, amount);
    if (!validation.canSpend) {
      throw new Error(validation.reason || 'Dépense impossible');
    }

    return {
      ...player,
      mediaCoverage: player.mediaCoverage - amount
    };
  }

  /**
   * Ajoute de la couverture médiatique (avec limite max)
   */
  static addMedia(
    player: Player,
    amount: number
  ): Player {
    return {
      ...player,
      mediaCoverage: Math.min(
        player.mediaCoverage + amount,
        GAME_CONSTANTS.MAX_MEDIA_COVERAGE
      )
    };
  }

  /**
   * Vérifie si la couverture médiatique est au maximum
   */
  static isAtMax(player: Player): boolean {
    return player.mediaCoverage >= GAME_CONSTANTS.MAX_MEDIA_COVERAGE;
  }
}

