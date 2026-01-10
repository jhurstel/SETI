import { Game, Card, CardType, FreeAction, SectorColor, RevenueBonus, Player } from '../core/types';

export class CardSystem {
  static drawCards(game: Game, playerId: string, count: number, source: string): Game {
    const updatedGame = { ...game };
    updatedGame.players = updatedGame.players.map(p => ({ ...p }));
    const playerIndex = updatedGame.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) return game;
    
    const player = updatedGame.players[playerIndex];

    for (let i = 0; i < count; i++) {
      const newCard: Card = {
          id: `card_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 5)}`,
          name: 'Projet SETI',
          type: CardType.ACTION,
          cost: Math.floor(Math.random() * 3) + 1,
          freeAction: [FreeAction.MEDIA, FreeAction.DATA, FreeAction.MOVEMENT][Math.floor(Math.random() * 3)],
          scanSector: [SectorColor.BLUE, SectorColor.RED, SectorColor.YELLOW, SectorColor.BLACK][Math.floor(Math.random() * 4)],
          revenue: [RevenueBonus.CREDIT, RevenueBonus.ENERGY, RevenueBonus.CARD][Math.floor(Math.random() * 3)],
          effects: [],
          description: source,
      };
      player.cards.push(newCard);
    }
    
    return updatedGame;
  }

  static playCard(game: Game, playerId: string, cardId: string): { updatedGame: Game, error?: string } {
    const updatedGame = { ...game };
    updatedGame.players = updatedGame.players.map(p => ({ ...p }));
    const player = updatedGame.players.find(p => p.id === playerId);
    if (!player) return { updatedGame: game, error: "Joueur non trouvé" };
    
    const cardIndex = player.cards.findIndex(c => c.id === cardId);
    if (cardIndex === -1) return { updatedGame: game, error: "Carte non trouvée" };
    const card = player.cards[cardIndex];

    if (player.credits < card.cost) {
        return { updatedGame: game, error: "Crédits insuffisants" };
    }

    player.credits -= card.cost;
    player.cards = player.cards.filter(c => c.id !== cardId);

    return { updatedGame };
  }

  static discardToHandSize(player: Player, cardIdsToKeep: string[]): Player {
    const updatedPlayer = { ...player };
    updatedPlayer.cards = player.cards.filter(c => cardIdsToKeep.includes(c.id));
    return updatedPlayer;
  }
}