import { Game, GamePhase, Player, HistoryEntry, InteractionState, GAME_CONSTANTS } from '../core/types';
import { CardSystem } from '../systems/CardSystem';
import { ScoreManager } from './ScoreManager';
import { SpeciesSystem, discoveryNotice } from '../systems/SpeciesSystem';
import { ResourceSystem } from '../systems/ResourceSystem';
import { cloneGame } from '../core/cloneGame';

export class TurnManager {
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
   * L'interaction en cours empêche-t-elle de finir son tour ? Toute interaction doit être menée à terme
   * (ex : choisir la technologie payée par « Rechercher une technologie »), sauf les déplacements gratuits
   * restants (perdus en fin de tour) et l'échange de cartes, facultatif.
   */
  static blocksEndOfTurn(interaction: InteractionState): boolean {
    return !['IDLE', 'MOVING_PROBE', 'TRADING_CARD'].includes(interaction.type);
  }

  /**
   * Fin de tour du joueur courant : vérifie les paliers de score puis passe au joueur suivant.
   * Si un palier exige un choix (marqueur d'objectif, récompense centaurienne…), le tour
   * n'est pas terminé : `pendingInteractions` (le premier choix, puis les autres) est renvoyée et `turnEnded` vaut false.
   */
  static finishTurn(game: Game): {
    updatedGame: Game;
    milestoneEntries: HistoryEntry[];
    turnEntries: HistoryEntry[];
    discoveryNotification?: { message: string };
    pendingInteractions?: InteractionState[];
    turnEnded: boolean;
  } {
    const currentPlayer = game.players[game.currentPlayerIndex];
    const milestone = ScoreManager.checkScoreMilestones(game, currentPlayer.id);
    const base = {
      milestoneEntries: milestone.historyEntries,
      discoveryNotification: milestone.discoveryNotification,
    };

    if (milestone.shouldStop && milestone.newInteraction) {
      return { ...base, updatedGame: milestone.updatedGame, turnEntries: [], pendingInteractions: [milestone.newInteraction, ...(milestone.moreInteractions || [])], turnEnded: false };
    }

    // Espèces complétées pendant le tour : découvertes maintenant, après les paliers (règles, p. 20)
    const discovery = SpeciesSystem.resolvePendingDiscoveries(milestone.updatedGame, currentPlayer.id);
    const withDiscovery = {
      milestoneEntries: [...milestone.historyEntries, ...discovery.historyEntries],
      // Annonce nommée de l'espèce révélée (la générique a été faite à la pose de la dernière trace)
      discoveryNotification: discovery.revealed.length > 0 ? { message: discoveryNotice(discovery.revealed.join(' et ')) } : milestone.discoveryNotification,
    };
    if (discovery.interactions.length > 0) {
      // Choix ouverts par la découverte (cartes Exertiens) : le tour se termine une fois qu'ils sont faits
      return { ...withDiscovery, updatedGame: discovery.updatedGame, turnEntries: [], pendingInteractions: discovery.interactions, turnEnded: false };
    }

    const advanced = this.advance(discovery.updatedGame);
    return { ...withDiscovery, updatedGame: { ...advanced.updatedGame, endingTurn: false }, turnEntries: advanced.historyEntries, turnEnded: true };
  }

  /**
   * Joueur suivant, ou fin de manche quand tous ont passé (revenus, nouveau premier joueur, décompte final
   * après la dernière), avec les entrées d'historique correspondantes. Les paliers sont vérifiés avant (finishTurn).
   */
  static advance(game: Game): { updatedGame: Game; historyEntries: HistoryEntry[] } {
    const historyEntries: HistoryEntry[] = [];
    const updatedGame = this.nextPlayer(game);
    if (!updatedGame.isRoundEnd) {
      const nextPlayer = updatedGame.players[updatedGame.currentPlayerIndex];
      historyEntries.push({ message: `--- Tour de ${nextPlayer.name} ---`, playerId: nextPlayer.id });
      return { updatedGame, historyEntries };
    }

    historyEntries.push({ message: `--- FIN DE LA MANCHE ${game.currentRound} ---`, playerId: '', sequenceId: '' });
    // Revenus de chaque joueur
    updatedGame.players.forEach(player => {
      const gains: string[] = [];
      if (player.revenueCredits > 0) gains.push(ResourceSystem.formatResource(player.revenueCredits, 'CREDIT'));
      if (player.revenueEnergy > 0) gains.push(ResourceSystem.formatResource(player.revenueEnergy, 'ENERGY'));
      if (player.revenueCards > 0) gains.push(ResourceSystem.formatResource(player.revenueCards, 'DRAW'));
      if (gains.length > 0) historyEntries.push({ message: `perçoit ses revenus : ${gains.join(', ')}`, playerId: player.id, sequenceId: '' });
    });

    if (updatedGame.phase === GamePhase.FINAL_SCORING && updatedGame.finalScores) {
      // Dernière manche terminée : décompte final
      historyEntries.push(...ScoreManager.describeFinalScores(updatedGame, updatedGame.finalScores).map(e => ({ ...e, sequenceId: '' })));
      return { updatedGame, historyEntries };
    }

    const firstPlayer = updatedGame.players[updatedGame.firstPlayerIndex];
    historyEntries.push({ message: `devient le Premier Joueur`, playerId: firstPlayer.id, sequenceId: '' });
    historyEntries.push({ message: `--- Manche ${updatedGame.currentRound} / ${updatedGame.maxRounds} ---`, playerId: '', sequenceId: '' });
    historyEntries.push({ message: `--- Tour de ${firstPlayer.name} ---`, playerId: firstPlayer.id, sequenceId: '' });
    return { updatedGame, historyEntries };
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
   * Vérifie si c'est le premier Pass de la manche
   * (déclenche la rotation du système solaire)
   */
  static isFirstPassOfRound(game: Game): boolean {
    const passedCount = game.players.filter(p => p.hasPassed).length;
    return passedCount === 1;
  }

  /**
   * Joueur qui a commencé une manche passée ou en cours : le premier joueur tourne d'une place à chaque fin de manche
   * (endRound), y compris après la dernière, une fois la partie au décompte final.
   */
  static roundFirstPlayer(game: Game, round: number): Player {
    const count = game.players.length;
    const roundsSince = game.currentRound - round + (game.phase === GamePhase.FINAL_SCORING ? 1 : 0);
    return game.players[(((game.firstPlayerIndex - roundsSince) % count) + count) % count];
  }
}
