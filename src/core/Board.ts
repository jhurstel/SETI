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
  TechnologyType,
  AlienBoard,
  LifeTraceTrack,
  TechnologyBonus
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
      technologyBoard: this.createTechnologyBoard(),
      alienBoard: this.createAlienBoard()
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
    const initialSector1 = Math.floor(Math.random() * 8) + 1;
    const initialSector2 = Math.floor(Math.random() * 8) + 1;
    const initialSector3 = Math.floor(Math.random() * 8) + 1;
    const sectorToIndex: { [key: number]: number } = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 7 };
    const sectorIndex1 = sectorToIndex[initialSector1] || 0;
    const initialAngle1 = sectorIndex1 * 45;
    const sectorIndex2 = sectorToIndex[initialSector2] || 0;
    const initialAngle2 = sectorIndex2 * 45;
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
      initialAngleLevel1: initialAngle1,
      initialAngleLevel2: initialAngle2,
      initialAngleLevel3: initialAngle3,
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
    // Planètes avec satellites
    const planets: Planet[] = [
      {
        id: 'mercury',
        name: 'Mercure',
        orbiters: [],
        landers: [],
        orbitFirstBonus: { pv: 3 },
        orbitNextBonuses: [{ card: 1 }, { planetscan: 2 }, { revenue: 1 }],
        landFirstBonus: { data: 3 },
        landNextBonuses: [{ pv: 12 }, { yellowlifetrace: 1 }],
      },
      {
        id: 'venus',
        name: 'Vénus',
        orbiters: [],
        landers: [],
        orbitFirstBonus: { pv: 3 },
        orbitNextBonuses: [{ pv: 6 }, { revenue: 1 }],
        landFirstBonus: { data: 2 },
        landNextBonuses: [{ pv: 5 }, { yellowlifetrace: 1 }],
      },
      {
        id: 'mars',
        name: 'Mars',
        orbiters: [],
        landers: [],
        orbitFirstBonus: { pv: 3 },
        orbitNextBonuses: [{ anycard: 1 }, { planetscan: 1 }, { revenue: 1 }],
        landFirstBonus: { data: 2 },
        landSecondBonus: { data: 1 },
        landNextBonuses: [{ pv: 6 }, { yellowlifetrace: 1 }],
        satellites: [
          { id: 'phobosdeimos', name: 'Phobos, Deimos', planetId: 'mars', landers: [], landBonuses: [{ pv: 8 }, { revenue: 2}] },
        ],
      },
      {
        id: 'jupiter',
        name: 'Jupiter',
        orbiters: [],
        landers: [],
        orbitFirstBonus: { pv: 3 },
        orbitNextBonuses: [{ data: 1 }, { planetscan: 1 }, { revenue: 1 }],
        landFirstBonus: { data: 2 },
        landNextBonuses: [{ pv: 7 }, { yellowlifetrace: 1 }],
        satellites: [
          { id: 'io', name: 'Io', planetId: 'jupiter', landers: [], landBonuses: [{ pv: 10 }, { energy: 4 }] },
          { id: 'europa', name: 'Europe', planetId: 'jupiter', landers: [], landBonuses: [{ pv: 7 }, { yellowlifetrace: 2 }] },
          { id: 'ganymede', name: 'Ganymède', planetId: 'jupiter', landers: [], landBonuses: [{ pv: 12 }, { media: 5 }] },
          { id: 'callisto', name: 'Callisto', planetId: 'jupiter', landers: [], landBonuses: [{ pv: 1 }, { data: 4 }] },
        ],
      },
      {
        id: 'saturn',
        name: 'Saturne',
        orbiters: [],
        landers: [],
        orbitFirstBonus: { pv: 3 },
        orbitNextBonuses: [{ media: 2 }, { planetscan: 1 }, { revenue: 1 }],
        landFirstBonus: { data: 2 },
        landNextBonuses: [{ pv: 8 }, { yellowlifetrace: 1 }],
        satellites: [
          { id: 'titan', name: 'Titan', planetId: 'saturn', landers: [], landBonuses: [{ pv: 7 }, { anytechnology: 2 }] },
          { id: 'enceladus', name: 'Encelade', planetId: 'saturn', landers: [], landBonuses: [{ pv: 12 }, { redscan: 1 }, { bluescan: 1 }, { yellowscan: 1 }] },
        ],
      },
      {
        id: 'uranus',
        name: 'Uranus',
        orbiters: [],
        landers: [],
        orbitFirstBonus: { pv: 3 },
        orbitNextBonuses: [{ pv: 8 }, { card: 3 }, { blackscan: 1 }],
        landFirstBonus: { data: 3 },
        landNextBonuses: [{ pv: 9 }, { yellowlifetrace: 1 }],
        satellites: [
          { id: 'titania', name: 'Titania', planetId: 'uranus', landers: [], landBonuses: [{ pv: 25 }] },
        ],
      },
      {
        id: 'neptune',
        name: 'Neptune',
        orbiters: [],
        landers: [],
        orbitFirstBonus: { pv: 3 },
        orbitNextBonuses: [{ pv: 7 }, { data: 4 }, { blackscan: 1 }],
        landFirstBonus: { data: 3 },
        landNextBonuses: [{ pv: 10 }, { yellowlifetrace: 1 }],
        satellites: [
          { id: 'triton', name: 'Triton', planetId: 'neptune', landers: [], landBonuses: [{ pv: 26 }] },
        ],
      },
    ];

    return planets as Planet[];
  }

  /**
   * Crée le plateau de technologies
   */
  private static createTechnologyBoard(): TechnologyBoard {
    const createTechStack = (
      id: string,
      name: string,
      type: TechnologyType,
      effects: any[],
      description: string,
      shorttext: string,
      extraBonus?: TechnologyBonus
    ): Technology[] => {
      const baseBonuses: TechnologyBonus[] = [
        { pv: 3 },
        { media: 1 },
        { card: 1 },
        { energy: 1 }
      ];
      
      const cards = baseBonuses.map((bonus, idx) => ({
        id: `${id}-${idx + 1}`,
        name,
        type,
        effects,
        bonus: { ...bonus, ...extraBonus },
        description,
        shorttext
      }));

      return cards;
    };

    // Technologies d'exploration
    const exploration1 = createTechStack(
      'exploration-1',
      'I',
      TechnologyType.SPECIAL,
      [{ type: 'MAX_PROBES_IN_SYSTEM', value: 2 }, { type: 'FREE_LAUNCH_PROBE', value: true }],
      'Augmente la capacité maximale de sondes dans le système solaire à 2. Permet de lancer une sonde gratuitement (sans coût en crédits).',
      'Max 2 sondes',
      { probe: 1 }
    );

    const exploration2 = createTechStack(
      'exploration-2',
      'II',
      TechnologyType.SPECIAL,
      [{ type: 'ASTEROID_MEDIA_BONUS', value: 1 }, { type: 'ASTEROID_EXIT_COST', value: 1 }],
      'Lorsqu\'une sonde visite un champ d\'astéroïdes, le joueur gagne +1 point de couverture médiatique. Permet de quitter un champ d\'astéroïdes avec seulement 1 point de déplacement au lieu du coût normal.',
      'Bonus Astéroïdes'
    );

    const exploration3 = createTechStack(
      'exploration-3',
      'III',
      TechnologyType.SPECIAL,
      [{ type: 'LAND_COST_REDUCTION', value: 1 }],
      'Réduit le coût en crédits pour poser une sonde sur une planète de 1 crédit. Cette réduction s\'applique en plus des autres réductions (par exemple, si un orbiteur est déjà présent sur la planète, le coût passe de 2 à 1 crédit au lieu de 3 à 2).',
      'Atterrissage réduit'
    );

    const exploration4 = createTechStack(
      'exploration-4',
      'IV',
      TechnologyType.SPECIAL,
      [{ type: 'ALLOW_LAND_ON_SATELLITES', value: true }],
      'Autorise le joueur à poser des sondes sur les lunes (satellites) des planètes. Sans cette technologie, seules les planètes principales peuvent recevoir des sondes en atterrissage.',
      'Atterrissage Lune'
    );

    // Technologies d'observation
    const observation1 = createTechStack(
      'observation-1',
      'I',
      TechnologyType.SPECIAL,
      [{ type: 'SCAN_MARK_ADJACENT_EARTH', value: true }, { type: 'SCAN_DATA_BONUS', value: 2 }],
      'Lors d\'un scan, permet de marquer un signal dans un secteur adjacent à celui de la Terre. De plus, gagnez 2 jetons de données supplémentaires lors du scan.',
      'Scan adjacent Terre',
      { data: 2 }
    );

    const observation2 = createTechStack(
      'observation-2',
      'II',
      TechnologyType.SPECIAL,
      [{ type: 'SCAN_MARK_MERCURY', value: true }, { type: 'SCAN_MERCURY_MEDIA_COST', value: 1 }],
      'Lors d\'un scan, vous pouvez payer 1 point de couverture médiatique pour marquer un signal supplémentaire dans le secteur de Mercure.',
      'Scan Mercure'
    );

    const observation3 = createTechStack(
      'observation-3',
      'III',
      TechnologyType.SPECIAL,
      [{ type: 'SCAN_DISCARD_CARD_MARK_SIGNAL', value: true }],
      'Lors d\'un scan, vous pouvez défausser une carte de votre main pour marquer un signal supplémentaire dans un secteur correspondant à la couleur indiquée dans le coin supérieur droit de la carte défaussée.',
      'Défausse Signal'
    );

    const observation4 = createTechStack(
      'observation-4',
      'IV',
      TechnologyType.SPECIAL,
      [{ type: 'SCAN_LAUNCH_PROBE_OR_MOVEMENT', value: true }, { type: 'SCAN_LAUNCH_PROBE_ENERGY_COST', value: 1 }, { type: 'SCAN_MOVEMENT_BONUS', value: 1 }],
      'Lors d\'un scan, vous pouvez choisir : soit payer 1 énergie pour lancer une sonde, soit gagner 1 point de déplacement supplémentaire.',
      'Scan Sonde'
    );

    // Technologies informatiques
    const computing1 = createTechStack(
      'computing-1',
      'I',
      TechnologyType.SPECIAL,
      [{ type: 'TECH_TRACK_BONUS', value: { points: 2, credits: 1 } }],
      'Ajoutez cette carte à la piste de technologie pour gagner 2 points de victoire + 1 crédit.',
      '2 PV + 1 Crédit'
    );

    const computing2 = createTechStack(
      'computing-2',
      'II',
      TechnologyType.SPECIAL,
      [{ type: 'TECH_TRACK_BONUS', value: { points: 2, cards: 1 } }],
      'Ajoutez cette carte à la piste de technologie pour gagner 2 points de victoire + 1 carte.',
      '2PV + 1 Carte'
    );

    const computing3 = createTechStack(
      'computing-3',
      'III',
      TechnologyType.SPECIAL,
      [{ type: 'TECH_TRACK_BONUS', value: { points: 2, energy: 1 } }],
      'Ajoutez cette carte à la piste de technologie pour gagner 2 points de victoire + 1 énergie.',
      '2 PV + 1 Énergie'
    );

    const computing4 = createTechStack(
      'computing-4',
      'IV',
      TechnologyType.SPECIAL,
      [{ type: 'TECH_TRACK_BONUS', value: { points: 2, media: 2 } }],
      'Ajoutez cette carte à la piste de technologie pour gagner 2 points de victoire + 1 point de couverture médiatique.',
      '2 PV + 1 Média'
    );

    const allExploration = [...exploration1, ...exploration2, ...exploration3, ...exploration4];
    const allObservation = [...observation1, ...observation2, ...observation3, ...observation4];
    const allComputing = [...computing1, ...computing2, ...computing3, ...computing4];

    return {
      available: [...allExploration, ...allObservation, ...allComputing],
      researched: [],
      nextRingLevel: 1,
      categorySlots: [
        {
          category: TechnologyCategory.EXPLORATION,
          technologies: allExploration,
        },
        {
          category: TechnologyCategory.OBSERVATION,
          technologies: allObservation,
        },
        {
          category: TechnologyCategory.COMPUTING,
          technologies: allComputing,
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

  /**
   * Crée le plateau Alien avec les pistes de traces de vie
   */
  private static createAlienBoard(): AlienBoard {
    const createTrack = (): LifeTraceTrack => ({
      slot1: { bonus: { pv: 5, media: 1 } },
      slot2: { bonus: { pv: 3, media: 1 } }
    });

    return {
      red: createTrack(),
      yellow: createTrack(),
      blue: createTrack()
    };
  }
}
