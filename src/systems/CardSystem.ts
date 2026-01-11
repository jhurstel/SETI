import { Game, Card, CardType, FreeAction, SectorColor, RevenueBonus, Player } from '../core/types';

export class CardSystem {
  static drawCards(game: Game, playerId: string, count: number, source: string): Game {
    const updatedGame = { ...game };
    
    // Copie profonde des decks pour éviter la mutation
    updatedGame.decks = {
        ...updatedGame.decks,
        actionCards: [...updatedGame.decks.actionCards]
    };

    // Copie profonde du joueur et de ses cartes
    updatedGame.players = updatedGame.players.map(p => p.id === playerId ? { ...p, cards: [...p.cards] } : p);
    
    const playerIndex = updatedGame.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) return game;
    
    const player = updatedGame.players[playerIndex];

    for (let i = 0; i < count; i++) {
      if (updatedGame.decks.actionCards.length > 0) {
        const newCard = updatedGame.decks.actionCards.shift()!;
        player.cards.push(newCard);
      } else {
        // Fallback si le deck est vide (mock pour éviter les crashs)
        const newCard: Card = {
            id: `card_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 5)}`,
            name: 'Projet SETI (Mock)',
            type: CardType.ACTION,
            cost: Math.floor(Math.random() * 3) + 1,
            freeAction: [FreeAction.MEDIA, FreeAction.DATA, FreeAction.MOVEMENT][Math.floor(Math.random() * 3)],
            scanSector: [SectorColor.BLUE, SectorColor.RED, SectorColor.YELLOW, SectorColor.BLACK][Math.floor(Math.random() * 4)],
            revenue: [RevenueBonus.CREDIT, RevenueBonus.ENERGY, RevenueBonus.CARD][Math.floor(Math.random() * 3)],
            effects: [],
            description: source + " (Deck vide)",
        };
        player.cards.push(newCard);
      }
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

  static refillCardRow(game: Game): Game {
    const updatedGame = { ...game };
    
    // Copie profonde de la rangée de cartes
    updatedGame.board = {
        ...updatedGame.board,
        cardRow: updatedGame.board.cardRow ? [...updatedGame.board.cardRow] : []
    };
    
    // Copie profonde des decks
    updatedGame.decks = {
        ...updatedGame.decks,
        actionCards: [...updatedGame.decks.actionCards]
    };

    // Remplir jusqu'à 3 cartes
    while (updatedGame.board.cardRow.length < 3 && updatedGame.decks.actionCards.length > 0) {
      const newCard = updatedGame.decks.actionCards.shift();
      if (newCard) {
        updatedGame.board.cardRow.push(newCard);
      }
    }
    return updatedGame;
  }
}