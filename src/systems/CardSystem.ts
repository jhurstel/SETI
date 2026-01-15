import { Game, Card, CardType, GameLogEntry } from '../core/types';

export class CardSystem {
  /**
   * Pioche des cartes pour un joueur
   */
  static drawCards(game: Game, playerId: string, count: number, source: string): Game {
    const updatedGame = structuredClone(game);
    const player = updatedGame.players.find(p => p.id === playerId);
    
    if (!player) return game;

    for (let i = 0; i < count; i++) {
      if (updatedGame.decks.actionCards.length > 0) {
        const card = updatedGame.decks.actionCards.shift();
        if (card) {
          player.cards.push(card);
        }
      }
    }

    return updatedGame;
  }

  /**
   * Joue une carte de la main du joueur
   */
  static playCard(game: Game, playerId: string, cardId: string): { updatedGame: Game, error?: string, bonuses?: any } {
    const updatedGame = structuredClone(game);
    const player = updatedGame.players.find(p => p.id === playerId);

    if (!player) return { updatedGame: game, error: "Joueur non trouvé" };

    const cardIndex = player.cards.findIndex(c => c.id === cardId);
    if (cardIndex === -1) return { updatedGame: game, error: "Carte non trouvée en main" };

    const card = player.cards[cardIndex];

    // Vérification du coût
    if (player.credits < card.cost) {
      return { updatedGame: game, error: "Crédits insuffisants" };
    }

    // Payer le coût
    player.credits -= card.cost;

    // Retirer la carte de la main
    player.cards.splice(cardIndex, 1);

    // Ajouter aux cartes jouées (pour les effets passifs/tags)
    // Note: Dans SETI, les cartes jouées vont souvent dans un tableau personnel ou sont défaussées selon le type.
    // Ici on suppose qu'elles restent actives pour les passifs ou sont défaussées si instantanées.
    // Pour simplifier, on ne les stocke pas dans une liste "playedCards" explicite dans Player pour l'instant,
    // mais on applique les effets immédiats.
    
    // Traitement des effets immédiats
    const bonuses: any = {};

    if (card.immediateEffects) {
      card.immediateEffects.forEach(effect => {
        if (effect.type === 'GAIN') {
          switch (effect.target) {
            case 'CREDIT':
              player.credits += effect.value;
              bonuses.credits = (bonuses.credits || 0) + effect.value;
              break;
            case 'ENERGY':
              player.energy += effect.value;
              bonuses.energy = (bonuses.energy || 0) + effect.value;
              break;
            case 'DATA':
              player.data = (player.data || 0) + effect.value;
              bonuses.data = (bonuses.data || 0) + effect.value;
              break;
            case 'MEDIA':
              player.mediaCoverage += effect.value;
              bonuses.media = (bonuses.media || 0) + effect.value;
              break;
            case 'CARD':
              // La pioche est gérée par le bonus retourné
              bonuses.card = (bonuses.card || 0) + effect.value;
              break;
            case 'PROBE':
              // Gain de sonde (stock)
              // TODO: Implémenter la logique de stock de sondes si nécessaire
              // Pour l'instant on considère que c'est un gain virtuel ou interactif
              bonuses.probe = (bonuses.probe || 0) + effect.value;
              break;
            case 'MOVEMENT':
              bonuses.movements = (bonuses.movements || 0) + effect.value;
              break;
          }
        } else if (effect.type === 'ACTION') {
           switch (effect.target) {
               case 'ROTATION':
                   bonuses.rotation = (bonuses.rotation || 0) + effect.value;
                   break;
               case 'LAND':
                   bonuses.landing = (bonuses.landing || 0) + effect.value;
                   break;
               case 'TECH':
                   if (typeof effect.value === 'object' && effect.value !== null) {
                       bonuses.technology = {
                           amount: (bonuses.technology?.amount || 0) + effect.value.amount,
                           color: effect.value.color // last one wins, which is fine for single tech bonus
                       };
                   } else { // fallback for old format
                       bonuses.technology = { amount: (bonuses.technology?.amount || 0) + effect.value };
                   }
                   break;
           }
        }
      });
    }

    return { updatedGame, bonuses };
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