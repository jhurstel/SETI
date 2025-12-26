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
  TechnologyCategory,
  Technology,
  TechnologyType
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
    // Technologies d'exploration
    const exploration1: Technology = {
      id: 'exploration-1',
      name: 'Exploration Niveau 1',
      type: TechnologyType.SPECIAL,
      effects: [
        { type: 'MAX_PROBES_IN_SYSTEM', value: 2 },
        { type: 'FREE_LAUNCH_PROBE', value: true },
      ],
      bonus: {},
      description: 'Augmente la capacité maximale de sondes dans le système solaire à 2. Permet de lancer une sonde gratuitement (sans coût en crédits).',
    };

    const exploration2: Technology = {
      id: 'exploration-2',
      name: 'Exploration Niveau 2',
      type: TechnologyType.SPECIAL,
      effects: [
        { type: 'ASTEROID_MEDIA_BONUS', value: 1 },
        { type: 'ASTEROID_EXIT_COST', value: 1 },
      ],
      bonus: {},
      description: 'Lorsqu\'une sonde visite un champ d\'astéroïdes, le joueur gagne +1 point de couverture médiatique. Permet de quitter un champ d\'astéroïdes avec seulement 1 point de déplacement au lieu du coût normal.',
    };

    const exploration3: Technology = {
      id: 'exploration-3',
      name: 'Exploration Niveau 3',
      type: TechnologyType.SPECIAL,
      effects: [
        { type: 'LAND_COST_REDUCTION', value: 1 },
      ],
      bonus: {},
      description: 'Réduit le coût en crédits pour poser une sonde sur une planète de 1 crédit. Cette réduction s\'applique en plus des autres réductions (par exemple, si un orbiteur est déjà présent sur la planète, le coût passe de 2 à 1 crédit au lieu de 3 à 2).',
    };

    const exploration4: Technology = {
      id: 'exploration-4',
      name: 'Exploration Niveau 4',
      type: TechnologyType.SPECIAL,
      effects: [
        { type: 'ALLOW_LAND_ON_SATELLITES', value: true },
      ],
      bonus: {},
      description: 'Autorise le joueur à poser des sondes sur les lunes (satellites) des planètes. Sans cette technologie, seules les planètes principales peuvent recevoir des sondes en atterrissage.',
    };

    // Technologies d'observation
    const observation1: Technology = {
      id: 'observation-1',
      name: 'Observation Niveau 1',
      type: TechnologyType.SPECIAL,
      effects: [
        { type: 'SCAN_MARK_ADJACENT_EARTH', value: true },
        { type: 'SCAN_DATA_BONUS', value: 2 },
      ],
      bonus: {},
      description: 'Lors d\'un scan, permet de marquer un signal dans un secteur adjacent à celui de la Terre. De plus, gagnez 2 jetons de données supplémentaires lors du scan.',
    };

    const observation2: Technology = {
      id: 'observation-2',
      name: 'Observation Niveau 2',
      type: TechnologyType.SPECIAL,
      effects: [
        { type: 'SCAN_MARK_MERCURY', value: true },
        { type: 'SCAN_MERCURY_MEDIA_COST', value: 1 },
      ],
      bonus: {},
      description: 'Lors d\'un scan, vous pouvez payer 1 point de couverture médiatique pour marquer un signal supplémentaire dans le secteur de Mercure.',
    };

    const observation3: Technology = {
      id: 'observation-3',
      name: 'Observation Niveau 3',
      type: TechnologyType.SPECIAL,
      effects: [
        { type: 'SCAN_DISCARD_CARD_MARK_SIGNAL', value: true },
      ],
      bonus: {},
      description: 'Lors d\'un scan, vous pouvez défausser une carte de votre main pour marquer un signal supplémentaire dans un secteur correspondant à la couleur indiquée dans le coin supérieur droit de la carte défaussée.',
    };

    const observation4: Technology = {
      id: 'observation-4',
      name: 'Observation Niveau 4',
      type: TechnologyType.SPECIAL,
      effects: [
        { type: 'SCAN_LAUNCH_PROBE_OR_MOVEMENT', value: true },
        { type: 'SCAN_LAUNCH_PROBE_ENERGY_COST', value: 1 },
        { type: 'SCAN_MOVEMENT_BONUS', value: 1 },
      ],
      bonus: {},
      description: 'Lors d\'un scan, vous pouvez choisir : soit payer 1 énergie pour lancer une sonde, soit gagner 1 point de déplacement supplémentaire.',
    };

    // Technologies informatiques
    const computing1: Technology = {
      id: 'computing-1',
      name: 'Informatique Niveau 1',
      type: TechnologyType.SPECIAL,
      effects: [
        { type: 'TECH_TRACK_BONUS', value: { points: 2, credits: 1 } },
      ],
      bonus: {},
      description: 'Ajoutez cette carte à la piste de technologie pour gagner 2 points de victoire + 1 crédit.',
    };

    const computing2: Technology = {
      id: 'computing-2',
      name: 'Informatique Niveau 2',
      type: TechnologyType.SPECIAL,
      effects: [
        { type: 'TECH_TRACK_BONUS', value: { points: 2, cards: 1 } },
      ],
      bonus: {},
      description: 'Ajoutez cette carte à la piste de technologie pour gagner 2 points de victoire + 1 carte.',
    };

    const computing3: Technology = {
      id: 'computing-3',
      name: 'Informatique Niveau 3',
      type: TechnologyType.SPECIAL,
      effects: [
        { type: 'TECH_TRACK_BONUS', value: { points: 2, energy: 1 } },
      ],
      bonus: {},
      description: 'Ajoutez cette carte à la piste de technologie pour gagner 2 points de victoire + 1 énergie.',
    };

    const computing4: Technology = {
      id: 'computing-4',
      name: 'Informatique Niveau 4',
      type: TechnologyType.SPECIAL,
      effects: [
        { type: 'TECH_TRACK_BONUS', value: { points: 2, media: 2 } },
      ],
      bonus: {},
      description: 'Ajoutez cette carte à la piste de technologie pour gagner 2 points de victoire + 2 points de couverture médiatique.',
    };

    return {
      available: [],
      researched: [],
      mediaTrackMax: 10,
      rotationTokenPosition: 0,
      nextRingLevel: 1,
      categorySlots: [
        {
          category: TechnologyCategory.EXPLORATION,
          technologies: [exploration1, exploration2, exploration3, exploration4],
        },
        {
          category: TechnologyCategory.OBSERVATION,
          technologies: [observation1, observation2, observation3, observation4],
        },
        {
          category: TechnologyCategory.COMPUTING,
          technologies: [computing1, computing2, computing3, computing4],
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

