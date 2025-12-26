/**
 * Moteur de règles pour SETI
 * 
 * Gère :
 * - Application des règles du jeu
 * - Résolution des conflits
 * - Ordre de résolution des effets
 * - Gestion des exceptions
 */

import {
  Game,
  Player,
  ActionType
} from '../core/types';

export class RuleEngine {
  /**
   * Applique les règles après une action
   */
  static applyRules(game: Game, actionType: ActionType): Game {
    // Préserver explicitement tous les champs du jeu, notamment les angles de rotation
    let updatedGame = {
      ...game,
      board: {
        ...game.board,
        solarSystem: {
          ...game.board.solarSystem,
          // Préserver explicitement les angles de rotation
          rotationAngleLevel1: game.board.solarSystem.rotationAngleLevel1,
          rotationAngleLevel2: game.board.solarSystem.rotationAngleLevel2,
          rotationAngleLevel3: game.board.solarSystem.rotationAngleLevel3,
        }
      }
    };

    // Appliquer les règles selon le type d'action
    switch (actionType) {
      case ActionType.ANALYZE_DATA:
        // Vérifier la découverte d'espèces
        updatedGame = this.checkSpeciesDiscovery(updatedGame);
        break;
      
      case ActionType.SCAN_SECTOR:
        // Vérifier les majorités
        updatedGame = this.updateSectorMajorities(updatedGame);
        break;
      
      case ActionType.RESEARCH_TECH:
        // Les effets de technologie sont gérés dans TechnologySystem
        break;
      
      default:
        break;
    }

    // Vérifier les missions
    updatedGame = this.updateMissions(updatedGame);

    return updatedGame;
  }

  /**
   * Vérifie la découverte d'espèces
   */
  private static checkSpeciesDiscovery(game: Game): Game {
    // Cette logique est gérée dans DataSystem.analyzeData
    // Mais on peut ajouter des vérifications supplémentaires ici
    return game;
  }

  /**
   * Met à jour les majorités des secteurs
   */
  private static updateSectorMajorities(game: Game): Game {
    // Cette logique est gérée dans SectorSystem.scanSector
    // Mais on peut ajouter des vérifications supplémentaires ici
    return game;
  }

  /**
   * Met à jour les missions de tous les joueurs
   */
  private static updateMissions(game: Game): Game {
    // TODO: Implémenter la mise à jour des missions
    // Vérifier la progression de chaque mission
    return game;
  }

  /**
   * Résout un conflit (ex: égalité dans un secteur)
   */
  static resolveConflict(
    game: Game,
    conflictType: string,
    data: any
  ): any {
    switch (conflictType) {
      case 'SECTOR_TIE':
        // En cas d'égalité, le dernier marqueur posé gagne
        // Cette logique est dans SectorSystem.calculateMajority
        return data.lastMarker;
      
      default:
        return null;
    }
  }

  /**
   * Vérifie les limites du jeu
   */
  static checkLimits(game: Game, playerId: string): {
    valid: boolean;
    violations: string[];
  } {
    const player = game.players.find(p => p.id === playerId);
    if (!player) {
      return { valid: false, violations: ['Joueur introuvable'] };
    }

    const violations: string[] = [];

    // Vérifier la couverture médiatique (max 10)
    if (player.mediaCoverage > 10) {
      violations.push('Couverture médiatique dépasse le maximum');
    }

    // Vérifier les sondes dans le système solaire
    const probesInSystem = player.probes.filter(
      p => p.state === 'IN_SOLAR_SYSTEM'
    );
    if (probesInSystem.length > 1) {
      // TODO: Vérifier les technologies qui permettent plusieurs sondes
      violations.push('Trop de sondes dans le système solaire');
    }

    return {
      valid: violations.length === 0,
      violations
    };
  }
}

