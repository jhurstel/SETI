import { Game, ActionType, ValidationResult, HistoryEntry, InteractionState } from '../core/types';
import { BaseAction } from './Action';
import { TurnManager } from '../engine/TurnManager';
import { CardSystem } from '../systems/CardSystem';
import { performRotation } from '../systems/RotationSystem';
import { cloneGame } from '../core/cloneGame';
import { uniqueId } from '../core/ids';
import { requirePlayer } from '../core/players';

export class PassAction extends BaseAction {
  constructor(
    playerId: string,
    public cardIdsToKeep: string[] // Cartes à garder (max 4)
  ) {
    super(playerId, ActionType.PASS);
  }

  validate(game: Game): ValidationResult {
    const player = requirePlayer(game, this.playerId);

    // Cartes gardées : des cartes de la main (pas les cartes Exertiens), exactement autant que la main
    // ramenée à 4 cartes (ni plus, ni moins : on ne défausse que l'excédent)
    const hand = CardSystem.getHandCards(player);
    const expected = hand.length - CardSystem.cardsToDiscardAtPass(player);
    if (new Set(this.cardIdsToKeep).size !== this.cardIdsToKeep.length || this.cardIdsToKeep.length !== expected) {
      return { valid: false, errors: [{ code: 'INVALID_CARDS', message: `Gardez exactement ${expected} carte${expected > 1 ? 's' : ''} de votre main` }], warnings: [] };
    }

    // Vérifier que les cartes existent
    const invalidCards = this.cardIdsToKeep.filter(
      cardId => !hand.some(c => c.id === cardId)
    );
    if (invalidCards.length > 0) {
      return { valid: false, errors: [{ code: 'INVALID_CARDS', message: 'Cartes à garder invalides' }], warnings: [] };
    }

    return { valid: true, errors: [], warnings: [] };
  }

  execute(game: Game): Game {
    const sequenceId = `pass-${uniqueId()}`;
    const playerId = this.playerId;

    let updatedGame = cloneGame(game);
    updatedGame.isFirstToPass = false;
    const playerIndex = updatedGame.players.findIndex(p => p.id === this.playerId);

    // Log des cartes défaussées
    const discardedCards = CardSystem.getHandCards(requirePlayer(game, this.playerId)).filter(c => !this.cardIdsToKeep.includes(c.id));
    if (discardedCards.length > 0) {
      const cardNames = discardedCards.map(c => `"${c.name}"`).join(', ');
      this.historyEntries.push({ message: `défausse ${cardNames}`, playerId, sequenceId });
    }

    // Défausser à 4 cartes
    updatedGame = CardSystem.discardToHandSize(updatedGame, this.playerId, this.cardIdsToKeep);
    const updatedPlayer = updatedGame.players[playerIndex];

    // Marquer le joueur comme ayant passé
    updatedPlayer.hasPassed = true;
    updatedGame.players[playerIndex] = updatedPlayer;

    // Vérifier si c'est le premier Pass de la manche
    // (déclenche la rotation du système solaire)
    if (TurnManager.isFirstPassOfRound(updatedGame)) {
      this.historyEntries.unshift({ message: `<strong>passe son tour</strong> (premier de la manche)`, playerId, sequenceId });
      const result = performRotation(updatedGame);
      result.logs.forEach(log => this.historyEntries.push({ message: log, playerId, sequenceId }));
      result.pushes.forEach(push => this.historyEntries.push({ ...push, sequenceId }));
      this.newPendingInteractions.push(...result.interactions);
      updatedGame = result.updatedGame;
      updatedGame.isFirstToPass = true;
    } else {
      this.historyEntries.unshift({ message: "<strong>passe son tour</strong>", playerId: updatedPlayer.id, sequenceId });
    }

    // Carte de fin de manche : la pile est cachée, le joueur la découvre une fois passé et la choisit pendant
    // son tour ; le tour passe ensuite (InteractionChoices.chooseRoundCard → finishPass)
    const currentRound = updatedGame.currentRound;
    if (updatedGame.decks.roundDecks[currentRound]?.length) {
      this.newPendingInteractions.push({ type: 'CHOOSING_ROUND_CARD', round: currentRound, playerId, sequenceId });
      return updatedGame;
    }

    const finished = PassAction.finishPass(updatedGame);
    this.historyEntries.push(...finished.historyEntries);
    this.newPendingInteractions.push(...finished.pendingInteractions);
    this.notification = finished.notification;
    return finished.updatedGame;
  }

  /**
   * Fin de la passe = fin du tour du joueur : paliers de score vérifiés (comme « Fin du tour »), puis joueur suivant
   * ou fin de manche. Si un palier demande un choix (marqueur d'objectif…), le tour reste ouvert : les choix sont
   * renvoyés (`pendingInteractions`) et `endingTurn` laisse la session finir le tour une fois la file vide.
   */
  static finishPass(game: Game): { updatedGame: Game; historyEntries: HistoryEntry[]; pendingInteractions: InteractionState[]; notification?: string } {
    const turn = TurnManager.finishTurn(game);
    const notification = turn.discoveryNotification?.message;
    if (!turn.turnEnded) {
      return { updatedGame: { ...turn.updatedGame, endingTurn: true }, historyEntries: turn.milestoneEntries, pendingInteractions: turn.pendingInteractions || [], notification };
    }
    return { updatedGame: turn.updatedGame, historyEntries: [...turn.milestoneEntries, ...turn.turnEntries], pendingInteractions: [], notification };
  }
}
