/**
 * Système de gestion des technologies
 * 
 * Gère :
 * - Recherche de technologies
 * - Effets des technologies
 * - Bonus des technologies
 * - Rotation du système solaire (déclenchée par recherche)
 */

import {
  Game,
  Player,
  Technology,
  GAME_CONSTANTS
} from '../core/types';
import { MediaSystem } from './MediaSystem';
import { SolarSystemRotation } from './SolarSystemRotation';

export class TechnologySystem {
  /**
   * Vérifie si un joueur peut rechercher une technologie
   */
  static canResearchTechnology(
    game: Game,
    playerId: string,
    technologyId: string
  ): {
    canResearch: boolean;
    reason?: string;
  } {
    const player = game.players.find(p => p.id === playerId);
    if (!player) {
      return { canResearch: false, reason: 'Joueur introuvable' };
    }

    // Vérifier la couverture médiatique
    const mediaValidation = MediaSystem.canSpendMedia(
      player,
      GAME_CONSTANTS.TECH_RESEARCH_COST_MEDIA
    );
    if (!mediaValidation.canSpend) {
      return mediaValidation;
    }

    // Vérifier que la technologie est disponible
    const technology = game.board.technologyBoard.available.find(
      t => t.id === technologyId
    );
    if (!technology) {
      return { canResearch: false, reason: 'Technologie introuvable ou déjà recherchée' };
    }

    // Vérifier que le joueur ne possède pas déjà cette technologie
    if (player.technologies.some(t => t.id === technologyId)) {
      return { canResearch: false, reason: 'Technologie déjà possédée' };
    }

    return { canResearch: true };
  }

  /**
   * Recherche une technologie
   */
  static researchTechnology(
    game: Game,
    playerId: string,
    technologyId: string
  ): {
    updatedGame: Game;
    technology: Technology;
  } {
    const validation = this.canResearchTechnology(game, playerId, technologyId);
    if (!validation.canResearch) {
      throw new Error(validation.reason || 'Recherche impossible');
    }

    const updatedGame = { ...game };
    updatedGame.players = [...game.players];
    updatedGame.board = { ...game.board };
    updatedGame.board.technologyBoard = { ...game.board.technologyBoard };
    updatedGame.board.technologyBoard.researched = [...game.board.technologyBoard.researched];
    const playerIndex = updatedGame.players.findIndex(p => p.id === playerId);
    const player = updatedGame.players[playerIndex];
    const technology = game.board.technologyBoard.available.find(
      t => t.id === technologyId
    )!;

    // Débiter la couverture médiatique
    let updatedPlayer = MediaSystem.spendMedia(
      player,
      GAME_CONSTANTS.TECH_RESEARCH_COST_MEDIA
    );

    // Ajouter la technologie au joueur
    const playerTechnology: Technology = {
      ...technology,
      ownerId: playerId
    };
    updatedPlayer.technologies.push(playerTechnology);

    // Appliquer le bonus immédiat
    if (technology.bonus) {
      if (technology.bonus.credits) {
        updatedPlayer.credits += technology.bonus.credits;
      }
      if (technology.bonus.energy) {
        updatedPlayer.energy += technology.bonus.energy;
      }
      if (technology.bonus.media) {
        updatedPlayer = MediaSystem.addMedia(
          updatedPlayer,
          technology.bonus.media
        );
      }
      if (technology.bonus.pv) {
        updatedPlayer.score += technology.bonus.pv;
      }
    }

    // Retirer de la liste des technologies disponibles
    updatedGame.board.technologyBoard.available = 
      updatedGame.board.technologyBoard.available.filter(
        t => t.id !== technologyId
      );

    // Ajouter à la liste des technologies recherchées
    updatedGame.board.technologyBoard.researched.push(playerTechnology);

    updatedGame.players[playerIndex] = updatedPlayer;

    // ⚠️ ROTATION DU SYSTÈME SOLAIRE (obligatoire)
    const rotationResult = SolarSystemRotation.rotate(updatedGame.board.solarSystem);
    updatedGame.board.solarSystem = rotationResult.rotatedSystem;

    // TODO: Appliquer les bonus de couverture médiatique de la rotation
    const mediaBonus = SolarSystemRotation.checkMediaCoverageBonus(
      updatedGame.board.solarSystem,
      rotationResult.events
    );
    if (mediaBonus > 0) {
      updatedPlayer = MediaSystem.addMedia(updatedPlayer, mediaBonus);
      updatedGame.players[playerIndex] = updatedPlayer;
    }

    return {
      updatedGame,
      technology: playerTechnology
    };
  }

  /**
   * Applique les effets d'une technologie
   */
  static applyTechnologyEffects(
    game: Game,
    playerId: string,
    technology: Technology
  ): Game {
    // TODO: Implémenter les effets spécifiques de chaque technologie
    // Les effets peuvent modifier :
    // - Les limites (ex: max sondes dans le système)
    // - Les coûts d'actions
    // - Les bonus de ressources
    // - Les règles de déplacement
    // etc.

    return game;
  }

  /**
   * Obtient les technologies disponibles
   */
  static getAvailableTechnologies(game: Game): Technology[] {
    return game.board.technologyBoard.available;
  }

  /**
   * Obtient les technologies d'un joueur
   */
  static getPlayerTechnologies(game: Game, playerId: string): Technology[] {
    const player = game.players.find(p => p.id === playerId);
    return player ? player.technologies : [];
  }
}
