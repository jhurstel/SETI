import { Game, ActionType, ValidationResult, GamePhase } from '../core/types';
import { ScoreManager } from '../core/ScoreManager';
import { BaseAction } from './Action';
import { TurnManager } from '../core/TurnManager';
import { CardSystem } from '../systems/CardSystem';
import { performRotation } from '../core/SolarSystemPosition';
import { ResourceSystem } from '../systems/ResourceSystem';
import { cloneGame } from '../core/cloneGame';
import { uniqueId } from '../core/ids';

export class PassAction extends BaseAction {
  constructor(
    playerId: string,
    public cardIdsToKeep: string[], // Cartes à garder (max 4)
    public selectedCardId?: string // Carte du paquet de manche choisie
  ) {
    super(playerId, ActionType.PASS);
  }

  validate(game: Game): ValidationResult {
    const player = game.players.find(p => p.id === this.playerId);
    if (!player) {
      return { valid: false, errors: [{ code: 'INVALID_PLAYER', message: 'Joueur non trouvé' }], warnings: [] };
    }

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

    // Vérifier si une carte de manche doit être choisie
    const currentRound = game.currentRound;
    const roundDeck = game.decks.roundDecks[currentRound];

    // Si le paquet existe et n'est pas vide, une carte doit être sélectionnée (sauf si géré automatiquement pour robot, mais l'action doit valider la cohérence)
    if (roundDeck && roundDeck.length > 0 && this.selectedCardId) {
      if (!roundDeck.some(c => c.id === this.selectedCardId)) {
        return { valid: false, errors: [{ code: 'INVALID_CARDS', message: 'Carte sélectionnée invalides' }], warnings: [] };
      }
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
    const originalPlayer = game.players.find(p => p.id === this.playerId);
    if (originalPlayer) {
      const discardedCards = CardSystem.getHandCards(originalPlayer).filter(c => !this.cardIdsToKeep.includes(c.id));
      if (discardedCards.length > 0) {
        const cardNames = discardedCards.map(c => `"${c.name}"`).join(', ');
        this.historyEntries.push({ message: `défausse ${cardNames}`, playerId, sequenceId });
      }
    }

    // Défausser à 4 cartes
    updatedGame = CardSystem.discardToHandSize(updatedGame, this.playerId, this.cardIdsToKeep);
    const updatedPlayer = updatedGame.players[playerIndex];

    // Gérer la carte de fin de manche
    const currentRound = updatedGame.currentRound;
    if (updatedGame.decks.roundDecks[currentRound] && updatedGame.decks.roundDecks[currentRound].length > 0) {
      const deck = updatedGame.decks.roundDecks[currentRound];
      let cardIndex = -1;

      if (this.selectedCardId) {
        cardIndex = deck.findIndex(c => c.id === this.selectedCardId);
      } else {
        // Si aucune carte n'est sélectionnée (ex: Robot), on prend la première
        cardIndex = 0;
      }

      if (cardIndex !== -1) {
        const [card] = deck.splice(cardIndex, 1);
        updatedPlayer.cards.push(card);
        if (updatedPlayer.type === 'robot') {
          this.historyEntries.push({ message: `choisit carte Fin de Manche`, playerId, sequenceId });
        } else {
          this.historyEntries.push({ message: `choisit carte "${card.name}" de fin de manche`, playerId, sequenceId });
        }
      }
    }

    // Marquer le joueur comme ayant passé
    updatedPlayer.hasPassed = true;
    updatedGame.players[playerIndex] = updatedPlayer;

    // Vérifier si c'est le premier Pass de la manche
    // (déclenche la rotation du système solaire)
    if (TurnManager.isFirstPassOfRound(updatedGame)) {
      this.historyEntries.unshift({ message: `<strong>passe son tour</strong> (premier de la manche)`, playerId, sequenceId });
      const result = performRotation(updatedGame);
      result.logs.forEach(log => this.historyEntries.push({ message: log, playerId, sequenceId }));
      updatedGame = result.updatedGame;
      updatedGame.isFirstToPass = true;
    } else {
      this.historyEntries.unshift({ message: "<strong>passe son tour</strong>", playerId: updatedPlayer.id, sequenceId });
    }

    // Passer au joueur suivant ou terminer la manche
    updatedGame = TurnManager.nextPlayer(updatedGame);
    if (updatedGame.isRoundEnd) {
      this.historyEntries.push({ message: `--- FIN DE LA MANCHE ${game.currentRound} ---`, playerId: '', sequenceId: '' });

      // Log des revenus pour chaque joueur
      updatedGame.players.forEach(player => {
        const gains: string[] = [];
        if (player.revenueCredits > 0) gains.push(ResourceSystem.formatResource(player.revenueCredits, 'CREDIT'));
        if (player.revenueEnergy > 0) gains.push(ResourceSystem.formatResource(player.revenueEnergy, 'ENERGY'));
        if (player.revenueCards > 0) gains.push(ResourceSystem.formatResource(player.revenueCards, 'CARD'));
        if (gains.length > 0) this.historyEntries.push({ message: `perçoit ses revenus : ${gains.join(', ')}`, playerId: player.id, sequenceId: '' });
      });

      if (updatedGame.phase === GamePhase.FINAL_SCORING && updatedGame.finalScores) {
        // Dernière manche terminée : décompte final
        this.historyEntries.push(...ScoreManager.describeFinalScores(updatedGame, updatedGame.finalScores).map(e => ({ ...e, sequenceId: '' })));
        return updatedGame;
      }

      // Log du changement de premier joueur
      this.historyEntries.push({ message: `devient le Premier Joueur`, playerId: updatedGame.players[updatedGame.firstPlayerIndex].id, sequenceId: '' });

      const firstPlayer = updatedGame.players[updatedGame.firstPlayerIndex];
      this.historyEntries.push({ message: `--- Manche ${updatedGame.currentRound} / ${updatedGame.maxRounds} ---`, playerId: '', sequenceId: '' });
      this.historyEntries.push({ message: `--- Tour de ${firstPlayer.name} ---`, playerId: firstPlayer.id, sequenceId: '' });
    } else {
      const nextPlayer = updatedGame.players[updatedGame.currentPlayerIndex];
      this.historyEntries.push({ message: `--- Tour de ${nextPlayer.name} ---`, playerId: nextPlayer.id, sequenceId: '' });
    }

    return updatedGame;
  }
}
