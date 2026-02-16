import { Game, ActionType, ValidationResult } from '../core/types';
import { BaseAction } from './Action';
import { TurnManager } from '../core/TurnManager';
import { CardSystem } from '../systems/CardSystem';
import { performRotation } from '../core/SolarSystemPosition';
import { ResourceSystem } from '../systems/ResourceSystem';

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

    // Vérifier le nombre de cartes à garder
    if (this.cardIdsToKeep.length > 4) {
      return { valid: false, errors: [{ code: 'INVALID_CARDS', message: 'Cartes à garder trop nombreuses' }], warnings: [] };
    }

    // Vérifier que les cartes existent
    const invalidCards = this.cardIdsToKeep.filter(
      cardId => !player.cards.some(c => c.id === cardId)
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
    const sequenceId = `pass-${Date.now()}`;

    let updatedGame = { ...game };
    updatedGame.isFirstToPass = false;
    // Copie profonde des joueurs et du board pour éviter les mutations
    updatedGame.players = updatedGame.players.map(p => ({ ...p }));
    updatedGame.board = { ...updatedGame.board };
    const playerIndex = updatedGame.players.findIndex(p => p.id === this.playerId);

    // Log des cartes défaussées
    const originalPlayer = game.players.find(p => p.id === this.playerId);
    if (originalPlayer) {
      const discardedCards = originalPlayer.cards.filter(c => !this.cardIdsToKeep.includes(c.id));
      if (discardedCards.length > 0) {
        const cardNames = discardedCards.map(c => `"${c.name}"`).join(', ');
        this.historyEntries.push({ message: `défausse ${cardNames}`, playerId: this.playerId, sequenceId: sequenceId });
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
      } else if (deck.length > 0) {
        // Si aucune carte n'est sélectionnée (ex: Robot), on prend la première
        cardIndex = 0;
      }
      
      if (cardIndex !== -1) {
        const [card] = deck.splice(cardIndex, 1);
        updatedPlayer.cards.push(card);
        if (updatedPlayer.type === 'robot') {
          this.historyEntries.push({ message: `choisit carte Fin de Manche`, playerId: this.playerId, sequenceId: sequenceId });
        } else {
          this.historyEntries.push({ message: `choisit carte "${card.name}" de fin de manche`, playerId: this.playerId, sequenceId: sequenceId });
        }
      }
    }

    // Marquer le joueur comme ayant passé
    updatedPlayer.hasPassed = true;
    updatedGame.players[playerIndex] = updatedPlayer;

    // Vérifier si c'est le premier Pass de la manche
    // (déclenche la rotation du système solaire)
    if (TurnManager.isFirstPassOfRound(updatedGame)) {      
      this.historyEntries.unshift({ message: `<strong>passe son tour</strong> (premier de la manche)`, playerId: this.playerId, sequenceId: sequenceId });
      const result = performRotation(updatedGame);
      result.logs.forEach(log => this.historyEntries.push({ message: log, playerId: this.playerId, sequenceId: sequenceId}));
      updatedGame = result.updatedGame;
      updatedGame.isFirstToPass = true;
    } else {
      this.historyEntries.unshift({ message: "<strong>passe son tour</strong>", playerId: updatedPlayer.id, sequenceId: sequenceId });
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

      // Log du changement de premier joueur
      this.historyEntries.push({ message: `devient le Premier Joueur`, playerId: updatedGame.players[updatedGame.firstPlayerIndex].id, sequenceId: '' });
      
      const firstPlayer = updatedGame.players[updatedGame.firstPlayerIndex];
      this.historyEntries.push({ message: `--- Tour de ${firstPlayer.name} ---`, playerId: firstPlayer.id, sequenceId: '' });
    } else {
      const nextPlayer = updatedGame.players[updatedGame.currentPlayerIndex];
      this.historyEntries.push({ message: `--- Tour de ${nextPlayer.name} ---`, playerId: nextPlayer.id, sequenceId: '' });
    }

    return updatedGame;
  }
}
