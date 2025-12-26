/**
 * Plateau de jeu SETI
 * 
 * Gère l'initialisation et la structure du plateau :
 * - Système solaire
 * - Secteurs
 * - Planètes
 * - Plateau de technologies
 */

import {
  Board,
  SolarSystem,
  Sector,
  Planet,
  TechnologyBoard,
  SystemTile,
  TileType,
  Position,
  RotationDisk,
  TechnologyCategory
} from './types';

export class BoardManager {
  /**
   * Crée un plateau de jeu initialisé
   */
  static createInitialBoard(): Board {
    return {
      solarSystem: this.createSolarSystem(),
      sectors: this.createSectors(),
      planets: this.createPlanets(),
      technologyBoard: this.createTechnologyBoard()
    };
  }

  /**
   * Crée le système solaire initial
   */
  private static createSolarSystem(): SolarSystem {
    // TODO: Implémenter la création complète du système solaire
    // Basé sur la configuration exacte du plateau physique
    // Pour l'instant, structure de base
    
    const tiles: SystemTile[][] = this.createSystemTiles();
    const rotationDisks: RotationDisk[] = this.createRotationDisks();

    // Calculer les angles initiaux à partir des secteurs initiaux
    const initialSector1 = 1;
    const initialSector2 = 1;
    const initialSector3 = 1;
    const sectorToIndex: { [key: number]: number } = { 1: 0, 8: 1, 7: 2, 6: 3, 5: 4, 4: 5, 3: 6, 2: 7 };
    const sectorIndex1 = sectorToIndex[initialSector1] || 0;
    const initialAngle1 = sectorIndex1 * 45;
    const sectorIndex2 = sectorToIndex[initialSector2] || 0;
    const initialAngle2 = sectorIndex2 * 45 - 45; // Décalé d'un cran (45°) dans le sens anti-horaire
    const sectorIndex3 = sectorToIndex[initialSector3] || 0;
    const initialAngle3 = sectorIndex3 * 45;

    return {
      tiles,
      rotationDisks,
      currentRotation: 0,
      probes: [],
      initialSectorLevel1: initialSector1,
      initialSectorLevel2: initialSector2,
      initialSectorLevel3: initialSector3,
      rotationAngleLevel1: initialAngle1, // Angle de rotation initial calculé
      rotationAngleLevel2: initialAngle2, // Angle de rotation initial calculé
      rotationAngleLevel3: initialAngle3, // Angle de rotation initial calculé
    };
  }

  /**
   * Crée la grille de cases du système solaire
   */
  private static createSystemTiles(): SystemTile[][] {
    // TODO: Implémenter selon la configuration exacte du plateau
    // Structure de base pour l'instant
    const tiles: SystemTile[][] = [];
    
    // Exemple simplifié - à remplacer par la vraie configuration
    // Le plateau SETI a une structure spécifique avec :
    // - Terre au centre
    // - Planètes positionnées autour
    // - Champs d'astéroïdes
    // - Soleil (infranchissable)
    
    return tiles;
  }

  /**
   * Crée les disques rotatifs
   */
  private static createRotationDisks(): RotationDisk[] {
    // TODO: Implémenter selon la configuration exacte
    // Le plateau SETI a des disques rotatifs qui changent les positions
    return [];
  }

  /**
   * Crée les secteurs initiaux
   */
  private static createSectors(): Sector[] {
    // TODO: Implémenter selon le nombre exact de secteurs
    // Chaque secteur a des signaux initiaux
    return [];
  }

  /**
   * Crée les planètes
   */
  private static createPlanets(): Planet[] {
    // TODO: Implémenter toutes les planètes du jeu
    // Chaque planète a :
    // - Un bonus spécifique
    // - Des lunes (accessibles via effets)
    return [];
  }

  /**
   * Crée le plateau de technologies
   */
  private static createTechnologyBoard(): TechnologyBoard {
    return {
      available: [],
      researched: [],
      mediaTrackMax: 10,
      rotationTokenPosition: 0,
      nextRingLevel: 1,
      categorySlots: [
        {
          category: TechnologyCategory.EXPLORATION,
          technologies: [],
        },
        {
          category: TechnologyCategory.INFORMATION,
          technologies: [],
        },
        {
          category: TechnologyCategory.COMPUTING,
          technologies: [],
        },
      ],
    };
  }

  /**
   * Trouve une case par position
   */
  static findTileByPosition(
    board: Board,
    position: Position
  ): SystemTile | null {
    for (const row of board.solarSystem.tiles) {
      for (const tile of row) {
        if (tile.position.x === position.x && tile.position.y === position.y) {
          return tile;
        }
      }
    }
    return null;
  }

  /**
   * Trouve une case par type
   */
  static findTilesByType(
    board: Board,
    type: TileType
  ): SystemTile[] {
    const tiles: SystemTile[] = [];
    for (const row of board.solarSystem.tiles) {
      for (const tile of row) {
        if (tile.type === type) {
          tiles.push(tile);
        }
      }
    }
    return tiles;
  }

  /**
   * Trouve la case Terre
   */
  static findEarthTile(board: Board): SystemTile | null {
    const earthTiles = this.findTilesByType(board, TileType.EARTH);
    return earthTiles.length > 0 ? earthTiles[0] : null;
  }
}

