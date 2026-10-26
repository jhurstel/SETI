import { Game, GamePhase, Player, HistoryEntry, InteractionState, GAME_CONSTANTS } from './types';
import { CardSystem } from '../systems/CardSystem';
import { ScoreManager } from './ScoreManager';
import { cloneGame } from './cloneGame';

export class TurnManager {
  /**
   * Marque l'action principale du joueur comme effectuée
   * (actions principales résolues hors GameEngine.executeAction, ex: orbite/atterrissage payants depuis l'UI)
   */
  static markMainActionPerformed(game: Game, playerId: string): Game {
    const updatedGame = cloneGame(game);
    const player = updatedGame.players.find(p => p.id === playerId);
    if (player) player.hasPerformedMainAction = true;
    return updatedGame;
  }

  /**
   * Phase de SETUP (réservation) : passe au joueur suivant, ou démarre la partie
   * quand on revient au premier joueur.
   */
  static advanceSetup(game: Game): { updatedGame: Game; historyEntries: HistoryEntry[]; started: boolean } {
    const updatedGame = cloneGame(game);
    const nextIndex = (updatedGame.currentPlayerIndex + 1) % updatedGame.players.length;

    if (nextIndex !== updatedGame.firstPlayerIndex) {
      updatedGame.currentPlayerIndex = nextIndex;
      return { updatedGame, historyEntries: [], started: false };
    }

    updatedGame.phase = GamePhase.PLAYING;
    updatedGame.currentPlayerIndex = updatedGame.firstPlayerIndex;
    updatedGame.players.forEach(p => (p.hasPerformedMainAction = false));

    const firstPlayer = updatedGame.players[updatedGame.firstPlayerIndex];
    return {
      updatedGame,
      historyEntries: [
        { message: '--- DÉBUT DE LA PARTIE ---', playerId: '' },
        { message: `--- Manche ${updatedGame.currentRound} / ${updatedGame.maxRounds} ---`, playerId: '' },
        { message: `--- Tour de ${firstPlayer.name} ---`, playerId: firstPlayer.id },
      ],
      started: true,
    };
  }

  /**
   * Fin de tour du joueur courant : vérifie les paliers de score puis passe au joueur suivant.
   * Si un palier exige un choix (marqueur d'objectif, récompense centaurienne…), le tour
   * n'est pas terminé : `pendingInteraction` est renvoyée et `turnEnded` vaut false.
   */
  static finishTurn(game: Game): {
    updatedGame: Game;
    milestoneEntries: HistoryEntry[];
    turnEntries: HistoryEntry[];
    discoveryNotification?: { message: string };
    pendingInteraction?: InteractionState;
    turnEnded: boolean;
  } {
    const currentPlayer = game.players[game.currentPlayerIndex];
    const milestone = ScoreManager.checkScoreMilestones(game, currentPlayer.id);
    const base = {
      milestoneEntries: milestone.historyEntries,
      discoveryNotification: milestone.discoveryNotification,
    };

    if (milestone.shouldStop && milestone.newInteraction) {
      return { ...base, updatedGame: milestone.updatedGame, turnEntries: [], pendingInteraction: milestone.newInteraction, turnEnded: false };
    }

    const updatedGame = this.nextPlayer(milestone.updatedGame);
    const nextPlayer = updatedGame.players[updatedGame.currentPlayerIndex];
    return {
      ...base,
      updatedGame,
      turnEntries: [{ message: `--- Tour de ${nextPlayer.name} ---`, playerId: nextPlayer.id }],
      turnEnded: true,
    };
  }

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
    const updatedGame = cloneGame(game);
    updatedGame.isRoundEnd = false;
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

    // Réinitialiser les données temporaires du nouveau joueur actif
    updatedGame.players[nextIndex].visitedPlanetsThisTurn = [];
    updatedGame.players[nextIndex].activeBuffs = [];
    updatedGame.players[nextIndex].hasPerformedMainAction = false;

    return updatedGame;
  }

  /**
   * Termine la manche actuelle
   */
  static endRound(game: Game): Game {
    let updatedGame = cloneGame(game);
    updatedGame.isRoundEnd = true;

    // Calculer les revenus de fin de manche
    updatedGame.players = updatedGame.players.map(player =>
      this.calculateRevenues(player)
    );

    // Distribuer les revenus en cartes
    updatedGame.players.forEach(player => {
      if (player.revenueCards > 0) {
        updatedGame = CardSystem.drawCards(updatedGame, player.id, player.revenueCards);
      }
    });

    // Réinitialiser l'état des joueurs
    updatedGame.players = updatedGame.players.map(player => ({
      ...player,
      hasPassed: false,
      visitedPlanetsThisTurn: [],
      activeBuffs: [],
      hasPerformedMainAction: false
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
      // Fin de partie : décompte final (catégories, cartes Exertiens, pénalité de danger)
      updatedGame.phase = GamePhase.FINAL_SCORING;
      return ScoreManager.applyFinalScoring(updatedGame).updatedGame;
    }

    return updatedGame;
  }

  /**
   * Calcule les revenus de fin de manche pour un joueur
   */
  private static calculateRevenues(player: Player): Player {
    const updatedPlayer = { ...player };

    updatedPlayer.credits += player.revenueCredits || 0;
    updatedPlayer.energy += player.revenueEnergy || 0;
    // Revenus des cartes Centauriens
    updatedPlayer.mediaCoverage = Math.min(player.mediaCoverage + (player.revenueMedia || 0), GAME_CONSTANTS.MAX_MEDIA_COVERAGE);
    updatedPlayer.data = Math.min(player.data + (player.revenueData || 0), GAME_CONSTANTS.MAX_DATA);

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
