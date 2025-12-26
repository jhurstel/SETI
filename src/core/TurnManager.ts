/**
 * Gestionnaire de tours et manches pour SETI
 * 
 * Gère :
 * - L'ordre de jeu (horaire)
 * - Les tours de chaque joueur
 * - La fin de manche (quand tous ont passé)
 * - Le passage à la manche suivante
 * - Le changement de premier joueur
 */

import {
  Game,
  GamePhase,
  Player,
  GAME_CONSTANTS
} from './types';

export class TurnManager {
  /**
   * Vérifie si c'est le tour du joueur spécifié
   */
  static isPlayerTurn(game: Game, playerId: string): boolean {
    const currentPlayer = game.players[game.currentPlayerIndex];
    return currentPlayer.id === playerId && game.phase === GamePhase.PLAYING;
  }

  /**
   * Passe au joueur suivant dans l'ordre horaire
   */
  static nextPlayer(game: Game): Game {
    const updatedGame = { ...game };
    const activePlayers = updatedGame.players.filter(p => !p.hasPassed);
    
    if (activePlayers.length === 0) {
      // Tous les joueurs ont passé, fin de manche
      return this.endRound(updatedGame);
    }

    // Trouver l'index du prochain joueur actif
    let nextIndex = (updatedGame.currentPlayerIndex + 1) % updatedGame.players.length;
    
    while (updatedGame.players[nextIndex].hasPassed) {
      nextIndex = (nextIndex + 1) % updatedGame.players.length;
    }

    updatedGame.currentPlayerIndex = nextIndex;
    return updatedGame;
  }

  /**
   * Termine la manche actuelle
   */
  static endRound(game: Game): Game {
    const updatedGame = { ...game };
    
    // Calculer les revenus de fin de manche
    updatedGame.players = updatedGame.players.map(player => 
      this.calculateRevenues(player)
    );

    // Réinitialiser l'état des joueurs
    updatedGame.players = updatedGame.players.map(player => ({
      ...player,
      hasPassed: false
    }));

    // Changer le premier joueur (rotation horaire)
    updatedGame.firstPlayerIndex = 
      (updatedGame.firstPlayerIndex + 1) % updatedGame.players.length;
    updatedGame.currentPlayerIndex = updatedGame.firstPlayerIndex;

    // Passer à la manche suivante ou fin de partie
    if (updatedGame.currentRound < updatedGame.maxRounds) {
      updatedGame.currentRound++;
      updatedGame.phase = GamePhase.PLAYING;
    } else {
      // Fin de partie
      updatedGame.phase = GamePhase.FINAL_SCORING;
    }

    return updatedGame;
  }

  /**
   * Calcule les revenus de fin de manche pour un joueur
   */
  private static calculateRevenues(player: Player): Player {
    const updatedPlayer = { ...player };
    
    // TODO: Implémenter le calcul des revenus selon les règles
    // Basé sur :
    // - Technologies possédées
    // - Missions accomplies
    // - Secteurs couverts
    // - Autres bonus
    
    // Exemple simplifié (à remplacer par la logique complète)
    const baseRevenue = {
      credits: 2,
      energy: 1
    };

    // Bonus des technologies
    player.technologies.forEach(tech => {
      if (tech.bonus.credits) {
        baseRevenue.credits += tech.bonus.credits;
      }
      if (tech.bonus.energy) {
        baseRevenue.energy += tech.bonus.energy;
      }
    });

    updatedPlayer.credits += baseRevenue.credits;
    updatedPlayer.energy += baseRevenue.energy;

    return updatedPlayer;
  }

  /**
   * Marque un joueur comme ayant passé
   */
  static markPlayerPassed(game: Game, playerId: string): Game {
    const updatedGame = { ...game };
    updatedGame.players = updatedGame.players.map(player => {
      if (player.id === playerId) {
        return { ...player, hasPassed: true };
      }
      return player;
    });
    return updatedGame;
  }

  /**
   * Vérifie si tous les joueurs ont passé
   */
  static allPlayersPassed(game: Game): boolean {
    return game.players.every(player => player.hasPassed);
  }

  /**
   * Obtient le joueur actuel
   */
  static getCurrentPlayer(game: Game): Player {
    return game.players[game.currentPlayerIndex];
  }

  /**
   * Obtient le premier joueur de la manche
   */
  static getFirstPlayer(game: Game): Player {
    return game.players[game.firstPlayerIndex];
  }

  /**
   * Vérifie si c'est le premier Pass de la manche
   * (déclenche la rotation du système solaire)
   */
  static isFirstPassOfRound(game: Game): boolean {
    const passedCount = game.players.filter(p => p.hasPassed).length;
    return passedCount === 1;
  }
}

