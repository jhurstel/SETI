/**
 * Système de gestion des cartes
 * 
 * Gère :
 * - Achat de cartes
 * - Jouer des cartes
 * - Missions
 * - Cartes fin de partie
 */

import {
  Game,
  Player,
  Card,
  Mission,
  GAME_CONSTANTS,
  CardType
} from '../core/types';
import { MediaSystem } from './MediaSystem';

export class CardSystem {
  /**
   * Vérifie si un joueur peut acheter une carte
   */
  static canBuyCard(
    game: Game,
    playerId: string,
    cardId: string
  ): {
    canBuy: boolean;
    reason?: string;
  } {
    const player = game.players.find(p => p.id === playerId);
    if (!player) {
      return { canBuy: false, reason: 'Joueur introuvable' };
    }

    // Trouver la carte (dans les decks ou disponibles)
    const card = this.findCard(game, cardId);
    if (!card) {
      return { canBuy: false, reason: 'Carte introuvable' };
    }

    // Vérifier la couverture médiatique
    const mediaValidation = MediaSystem.canSpendMedia(player, card.cost);
    if (!mediaValidation.canSpend) {
      return { canBuy: false, reason: mediaValidation.reason };
    }

    return { canBuy: true };
  }

  /**
   * Trouve une carte dans les decks
   */
  private static findCard(game: Game, cardId: string): Card | null {
    // Chercher dans tous les decks
    const allCards = [
      ...game.decks.actionCards,
      ...game.decks.missionCards,
      ...game.decks.endGameCards,
      ...game.decks.speciesCards
    ];

    return allCards.find(c => c.id === cardId) || null;
  }

  /**
   * Achète une carte
   */
  static buyCard(
    game: Game,
    playerId: string,
    cardId: string
  ): {
    updatedGame: Game;
    card: Card;
  } {
    const validation = this.canBuyCard(game, playerId, cardId);
    if (!validation.canBuy) {
      throw new Error(validation.reason || 'Achat impossible');
    }

    const updatedGame = { ...game };
    updatedGame.players = [...game.players];
    const playerIndex = updatedGame.players.findIndex(p => p.id === playerId);
    const player = updatedGame.players[playerIndex];
    const card = this.findCard(game, cardId)!;

    // Débiter la couverture médiatique
    let updatedPlayer = MediaSystem.spendMedia(player, card.cost);

    // Ajouter la carte au joueur
    const playerCard: Card = {
      ...card,
      ownerId: playerId
    };
    updatedPlayer.cards.push(playerCard);

    // Retirer de la liste des cartes disponibles
    // TODO: Implémenter selon le système de pioche exact

    updatedGame.players[playerIndex] = updatedPlayer;

    return {
      updatedGame,
      card: playerCard
    };
  }

  /**
   * Vérifie si un joueur peut jouer une carte
   */
  static canPlayCard(
    game: Game,
    playerId: string,
    cardId: string
  ): {
    canPlay: boolean;
    reason?: string;
  } {
    const player = game.players.find(p => p.id === playerId);
    if (!player) {
      return { canPlay: false, reason: 'Joueur introuvable' };
    }

    const card = player.cards.find(c => c.id === cardId);
    if (!card) {
      return { canPlay: false, reason: 'Carte introuvable' };
    }

    // Vérifier les conditions spécifiques de la carte
    // TODO: Implémenter selon les règles de chaque carte

    return { canPlay: true };
  }

  /**
   * Joue une carte
   */
  static playCard(
    game: Game,
    playerId: string,
    cardId: string
  ): {
    updatedGame: Game;
    card: Card;
    missionCreated?: Mission;
  } {
    const validation = this.canPlayCard(game, playerId, cardId);
    if (!validation.canPlay) {
      throw new Error(validation.reason || 'Jouer la carte impossible');
    }

    const updatedGame = { ...game };
    updatedGame.players = [...game.players];
    const playerIndex = updatedGame.players.findIndex(p => p.id === playerId);
    const player = updatedGame.players[playerIndex];
    const card = player.cards.find(c => c.id === cardId)!;

    // Appliquer les effets de la carte
    // TODO: Implémenter selon les effets spécifiques

    let missionCreated: Mission | undefined;

    // Si c'est une mission, créer la mission
    if (card.type === CardType.CONDITIONAL_MISSION || card.type === CardType.TRIGGERED_MISSION) {
      missionCreated = this.createMission(playerId, card);
      const updatedPlayer = {
        ...player,
        missions: [...player.missions, missionCreated]
      };
      updatedGame.players[playerIndex] = updatedPlayer;
    // Si ce n'est pas une mission ou une carte fin de partie, défausser
    } else if (card.type !== CardType.END_GAME) {
      const updatedPlayer = {
        ...player,
        cards: player.cards.filter(c => c.id !== cardId)
      };
      updatedGame.players[playerIndex] = updatedPlayer;
    }

    return {
      updatedGame,
      card,
      missionCreated
    };
  }

  /**
   * Crée une mission à partir d'une carte
   */
  private static createMission(playerId: string, card: Card): Mission {
    // TODO: Implémenter selon les règles exactes des missions
    return {
      id: `mission_${Date.now()}_${playerId}`,
      cardId: card.id,
      ownerId: playerId,
      requirements: [], // TODO: Extraire depuis card.effects
      progress: {
        current: 0,
        target: 0 // TODO: Déterminer depuis les requirements
      },
      completed: false
    };
  }

  /**
   * Vérifie et met à jour les missions d'un joueur
   */
  static updateMissions(game: Game, playerId: string): {
    updatedGame: Game;
    completedMissions: Mission[];
  } {
    const updatedGame = { ...game };
    updatedGame.players = [...game.players];
    const playerIndex = updatedGame.players.findIndex(p => p.id === playerId);
    const player = updatedGame.players[playerIndex];

    const completedMissions: Mission[] = [];

    const updatedMissions = player.missions.map(mission => {
      // TODO: Vérifier la progression selon les requirements
      // Pour l'instant, structure de base

      if (mission.progress.current >= mission.progress.target && !mission.completed) {
        const completedMission = {
          ...mission,
          completed: true,
          completedAt: Date.now()
        };
        completedMissions.push(completedMission);
        return completedMission;
      }

      return mission;
    });

    updatedGame.players[playerIndex] = {
      ...player,
      missions: updatedMissions
    };

    return {
      updatedGame,
      completedMissions
    };
  }

  /**
   * Gère la défausse après Pass (max 4 cartes)
   */
  static discardToHandSize(
    player: Player,
    cardIdsToKeep: string[]
  ): Player {
    // Garder les cartes spécifiées
    const keptCards = player.cards.filter(c => cardIdsToKeep.includes(c.id));

    // Si plus de 4 cartes gardées, erreur
    if (keptCards.length > GAME_CONSTANTS.HAND_SIZE_AFTER_PASS) {
      throw new Error(`Maximum ${GAME_CONSTANTS.HAND_SIZE_AFTER_PASS} cartes à garder`);
    }

    return {
      ...player,
      cards: keptCards
    };
  }
}
