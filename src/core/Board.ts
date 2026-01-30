/**
 * Plateau de jeu SETI
 * 
 * Gère l'initialisation et la structure du plateau :
 * - Système solaire
 * - Secteurs
 * - Planètes
 * - Plateau de technologies
 */

import { Board, SolarSystem, Sector, Planet, Bonus, TechnologyBoard, RotationDisk, TechnologyCategory, Technology, TechnologyEffect, AlienBoard, ObjectiveTile, ObjectiveCategory, SectorType, SignalType, Signal, LifeTraceType } from './types';
import { sectorToIndex } from './SolarSystemPosition';

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
      alienBoards: this.createAlienBoards(),
      objectiveTiles: this.createObjectiveTiles()
    };
  }

  /**
   * Crée le système solaire initial
   */
  private static createSolarSystem(): SolarSystem {
    // Implémenter la création complète du système solaire
    // Basé sur la configuration exacte du plateau physique
    const rotationDisks: RotationDisk[] = this.createRotationDisks();

    // Calculer les angles initiaux à partir des secteurs initiaux
    const initialSector1 = Math.floor(Math.random() * 8) + 1;
    const initialSector2 = Math.floor(Math.random() * 8) + 1;
    const initialSector3 = Math.floor(Math.random() * 8) + 1;
    const sectorIndex1 = sectorToIndex[initialSector1] || 0;
    const initialAngle1 = sectorIndex1 * 45;
    const sectorIndex2 = sectorToIndex[initialSector2] || 0;
    const initialAngle2 = sectorIndex2 * 45;
    const sectorIndex3 = sectorToIndex[initialSector3] || 0;
    const initialAngle3 = sectorIndex3 * 45;

    return {
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
      nextRingLevel: 1,
    };
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
    // Définition des 4 plateaux doubles (Gauche/Droite)
    const plates = [
      { 
        right: { name: 'Kepler 22', color: SectorType.YELLOW, slots: 5, firstBonus: { lifetraces: [{ amount: 1, scope: LifeTraceType.RED }] }, nextBonus: { pv: 3 } },
        left: { name: 'Proxima Centauri', color: SectorType.RED, slots: 6, firstBonus: { lifetraces: [{ amount: 1, scope: LifeTraceType.RED }] }, nextBonus: { lifetraces: [{ amount: 1, scope: LifeTraceType.RED }] } } 
      },
      { 
        right: { name: 'Sirius A', color: SectorType.BLUE, slots: 6, firstBonus: { lifetraces: [{ amount: 1, scope: LifeTraceType.RED }] }, nextBonus: { lifetraces: [{ amount: 1, scope: LifeTraceType.RED }] } }, 
        left: { name: "Barnard's Star", color: SectorType.RED, slots: 5, firstBonus: { lifetraces: [{ amount: 1, scope: LifeTraceType.RED }] }, nextBonus: { pv: 3 } } 
      },
      { 
        right: { name: '61 Virginis', color: SectorType.YELLOW, slots: 6, firstBonus: { lifetraces: [{ amount: 1, scope: LifeTraceType.RED }] }, nextBonus: { lifetraces: [{ amount: 1, scope: LifeTraceType.RED }] } }, 
        left: { name: 'Beta Pictoris', color: SectorType.BLACK, slots: 5, firstBonus: { lifetraces: [{ amount: 1, scope: LifeTraceType.RED }], pv: 3 }, nextBonus: { lifetraces: [{ amount: 1, scope: LifeTraceType.RED }] } } 
      },
      { 
        right: { name: 'Procyon', color: SectorType.BLUE, slots: 5, firstBonus: { lifetraces: [{ amount: 1, scope: LifeTraceType.RED }] }, nextBonus: { pv: 3 } }, 
        left: { name: 'Vega', color: SectorType.BLACK, slots: 4, firstBonus: { lifetraces: [{ amount: 1, scope: LifeTraceType.RED }], pv: 2}, nextBonus: { pv: 5 } } 
      },
    ];

    // Mélanger l'ordre des plateaux
    const shuffledPlates = this.shuffle(plates);

    // Aplatir pour obtenir la séquence des 8 secteurs
    const sectorSequence: { name: string, color: SectorType, slots: number, firstBonus: Bonus, nextBonus: Bonus }[] = [];
    shuffledPlates.forEach(plate => {
      sectorSequence.push(plate.left);
      sectorSequence.push(plate.right);
    });

    // Appliquer une rotation aléatoire (angle initial sur le disque E)
    const rotationOffset = Math.floor(Math.random() * 8);
    const rotatedSequence = [
      ...sectorSequence.slice(rotationOffset),
      ...sectorSequence.slice(0, rotationOffset)
    ];

    // Créer les objets Sector
    return rotatedSequence.map((config, index) => {
      // Les secteurs sont numérotés de 1 à 8
      const sectorId = `sector_${index + 1}`;
      return {
        id: sectorId,
        name: config.name,
        color: config.color,
        signals: this.createSignals(config.slots),
        playerMarkers: [],
        isCovered: false,
        coveredBy: [],
        firstBonus: config.firstBonus,
        nextBonus: config.nextBonus
      };
    });
  }

  /**
   * Crée les signaux pour un secteur
   */
  private static createSignals(count: number): Signal[] {
    const signals = Array.from({ length: count }).map((_, i) => ({
      id: `sig_${Math.random().toString(36).substr(2, 9)}`,
      type: SignalType.DATA,
      marked: false,
      bonus: i === 1 ? { pv: 2 } : undefined
    }));

    // Ajout du slot supplémentaire blanc (sans bonus de donnée)
    signals.push({
      id: `sig_white_${Math.random().toString(36).substr(2, 9)}`,
      type: SignalType.OTHER,
      marked: false,
      bonus: undefined
    });

    return signals;
  }

  /**
   * Utilitaire de mélange
   */
  private static shuffle<T>(array: T[]): T[] {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  }

  /**
   * Helper pour fusionner les bonus
   */
  private static mergeBonuses(...bonuses: (Bonus | undefined)[]): Bonus {
    const result: Bonus = {};
    bonuses.forEach(b => {
      if (!b) return;
      (Object.keys(b) as Array<keyof Bonus>).forEach(key => {
        const k = key as keyof Bonus;
        const val = b[k];
        if (typeof val === 'number') {
          (result as any)[k] = ((result[k] as number) || 0) + val;
        } else if (val !== undefined) {
          if (k === 'gainSignal' && Array.isArray(val)) {
            const existing = (result[k] as any[]) || [];
            (result as any)[k] = [...existing, ...val];
          } else {
            (result as any)[k] = val;
          }
        }
      });
    });
    return result;
  }

  /**
   * Crée les planètes
   */
  private static createPlanets(): Planet[] {
    const planets: Planet[] = [
      {
        id: 'mercury',
        name: 'Mercure',
        orbiters: [],
        landers: [],
        orbitFirstBonus: { pv: 3 },
        orbitNextBonus: { card: 1, signals: [{ amount: 2, scope: SectorType.MERCURY }], revenue: 1 },
        landFirstBonus: { data: 3 },
        landNextBonus: { pv: 12, lifetraces: [{ amount: 1, scope: LifeTraceType.YELLOW }] },
        orbitSlots: [],
        landSlots: []
      },
      {
        id: 'venus',
        name: 'Vénus',
        orbiters: [],
        landers: [],
        orbitFirstBonus: { pv: 3 },
        orbitNextBonus: { pv: 6, revenue: 1 },
        landFirstBonus: { data: 2 },
        landNextBonus: { pv: 5, lifetraces: [{ amount: 1, scope: LifeTraceType.YELLOW }]},
        orbitSlots: [],
        landSlots: []
      },
      {
        id: 'mars',
        name: 'Mars',
        orbiters: [],
        landers: [],
        orbitFirstBonus: { pv: 3 },
        orbitNextBonus: { anycard: 1, signals: [{ amount: 1, scope: SectorType.MARS }], revenue: 1 },
        landFirstBonus: { data: 2 },
        landSecondBonus: { data: 1 },
        landNextBonus: { pv: 6, lifetraces: [{ amount: 1, scope: LifeTraceType.YELLOW }] },
        satellites: [
          { id: 'phobosdeimos', name: 'Phobos, Deimos', planetId: 'mars', landers: [], landBonus: { pv: 8, revenue: 2} },
        ],
        orbitSlots: [],
        landSlots: []
      },
      {
        id: 'jupiter',
        name: 'Jupiter',
        orbiters: [],
        landers: [],
        orbitFirstBonus: { pv: 3 },
        orbitNextBonus: { data: 1, signals: [{ amount: 1, scope: SectorType.JUPITER }], revenue: 1 },
        landFirstBonus: { data: 2 },
        landNextBonus: { pv: 7, lifetraces: [{ amount: 1, scope: LifeTraceType.YELLOW }] },
        satellites: [
          { id: 'io', name: 'Io', planetId: 'jupiter', landers: [], landBonus: { pv: 10, energy: 4 } },
          { id: 'europa', name: 'Europe', planetId: 'jupiter', landers: [], landBonus: { pv: 7, lifetraces: [{ amount: 2, scope: LifeTraceType.YELLOW }] } },
          { id: 'ganymede', name: 'Ganymède', planetId: 'jupiter', landers: [], landBonus: { pv: 12, media: 5 } },
          { id: 'callisto', name: 'Callisto', planetId: 'jupiter', landers: [], landBonus: { pv: 1, data: 4 } },
        ],
        orbitSlots: [],
        landSlots: []
      },
      {
        id: 'saturn',
        name: 'Saturne',
        orbiters: [],
        landers: [],
        orbitFirstBonus: { pv: 3 },
        orbitNextBonus: { media: 2, signals: [{ amount: 1, scope: SectorType.SATURN }], revenue: 1 },
        landFirstBonus: { data: 2 },
        landNextBonus: { pv: 8, lifetraces: [{ amount: 1, scope: LifeTraceType.YELLOW }] },
        satellites: [
          { id: 'titan', name: 'Titan', planetId: 'saturn', landers: [], landBonus: { pv: 7, technologies: [{ amount: 2, scope: TechnologyCategory.ANY }] } },
          { id: 'enceladus', name: 'Encelade', planetId: 'saturn', landers: [], landBonus: { pv: 12, signals: [{ amount: 1, scope: SectorType.RED }, { amount: 1, scope: SectorType.BLUE }, { amount: 1, scope: SectorType.YELLOW }] } },
        ],
        orbitSlots: [],
        landSlots: []
      },
      {
        id: 'uranus',
        name: 'Uranus',
        orbiters: [],
        landers: [],
        orbitFirstBonus: { pv: 3 },
        orbitNextBonus: { pv: 8, card: 3, signals: [{ amount: 1, scope: SectorType.BLACK }] },
        landFirstBonus: { data: 3 },
        landNextBonus: { pv: 9, lifetraces: [{ amount: 1, scope: LifeTraceType.YELLOW }] },
        satellites: [
          { id: 'titania', name: 'Titania', planetId: 'uranus', landers: [], landBonus: { pv: 25 } },
        ],
        orbitSlots: [],
        landSlots: []
      },
      {
        id: 'neptune',
        name: 'Neptune',
        orbiters: [],
        landers: [],
        orbitFirstBonus: { pv: 3 },
        orbitNextBonus: { pv: 7, data: 4, signals: [{ amount: 1, scope: SectorType.BLACK }] },
        landFirstBonus: { data: 3 },
        landNextBonus: { pv: 10, lifetraces: [{ amount: 1, scope: LifeTraceType.YELLOW }] },
        satellites: [
          { id: 'triton', name: 'Triton', planetId: 'neptune', landers: [], landBonus: { pv: 26 } },
        ],
        orbitSlots: [],
        landSlots: []
      },
    ];

    return planets.map(p => {
      const orbitSlots = new Array(5).fill(null).map((_, i) => {
        if (i === 0) return this.mergeBonuses(p.orbitFirstBonus, p.orbitNextBonus);
        return p.orbitNextBonus || {};
      });

      const landSlots = new Array(4).fill(null).map((_, i) => {
        if (i === 0) return this.mergeBonuses(p.landFirstBonus, p.landNextBonus);
        if (i === 1) return this.mergeBonuses(p.landSecondBonus, p.landNextBonus);
        return p.landNextBonus || {};
      });

      return { ...p, orbitSlots, landSlots } as Planet;
    });
  }

  /**
   * Crée le plateau de technologies
   */
  private static createTechnologyBoard(): TechnologyBoard {
    const createTechStack = (
      id: string,
      name: string,
      type: TechnologyCategory,
      effects: TechnologyEffect[],
      description: string,
      shorttext: string,
      extraBonus?: Bonus
    ): Technology[] => {
      const baseBonuses: Bonus[] = [
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
      TechnologyCategory.EXPLORATION,
      [{ type: 'MAX_PROBES_IN_SYSTEM', value: 2 }, { type: 'FREE_LAUNCH_PROBE', value: true }],
      'Augmente la capacité maximale de sondes dans le système solaire à 2. Permet de lancer une sonde gratuitement (sans coût en crédits).',
      'Max 2 sondes',
      { probe: 1 }
    );

    const exploration2 = createTechStack(
      'exploration-2',
      'II',
      TechnologyCategory.EXPLORATION,
      [{ type: 'ASTEROID_MEDIA_BONUS', value: 1 }, { type: 'ASTEROID_EXIT_COST', value: 1 }],
      'Lorsqu\'une sonde visite un champ d\'astéroïdes, le joueur gagne +1 point de couverture médiatique. Permet de quitter un champ d\'astéroïdes avec seulement 1 point de déplacement au lieu du coût normal.',
      'Bonus Astéroïdes'
    );

    const exploration3 = createTechStack(
      'exploration-3',
      'III',
      TechnologyCategory.EXPLORATION,
      [{ type: 'LAND_COST_REDUCTION', value: 1 }],
      'Réduit le coût en énergie pour poser une sonde sur une planète de 1 énergie. Cette réduction s\'applique en plus des autres réductions (par exemple, si un orbiteur est déjà présent sur la planète, le coût passe de 2 à 1 énergie au lieu de 3 à 2).',
      'Atterrissage réduit'
    );

    const exploration4 = createTechStack(
      'exploration-4',
      'IV',
      TechnologyCategory.EXPLORATION,
      [{ type: 'ALLOW_LAND_ON_SATELLITES', value: true }],
      'Autorise le joueur à poser des sondes sur les lunes (satellites) des planètes. Sans cette technologie, seules les planètes principales peuvent recevoir des sondes en atterrissage.',
      'Atterrissage Lune'
    );

    // Technologies d'observation
    const observation1 = createTechStack(
      'observation-1',
      'I',
      TechnologyCategory.OBSERVATION,
      [{ type: 'SCAN_MARK_ADJACENT_EARTH', value: true }, { type: 'SCAN_DATA_BONUS', value: 2 }],
      'Lors d\'un scan, permet de marquer un signal dans un secteur adjacent à celui de la Terre.',
      'Scan adjacent Terre',
      { data: 2 }
    );

    const observation2 = createTechStack(
      'observation-2',
      'II',
      TechnologyCategory.OBSERVATION,
      [{ type: 'SCAN_MARK_MERCURY', value: true }, { type: 'SCAN_MERCURY_MEDIA_COST', value: 1 }],
      'Lors d\'un scan, vous pouvez payer 1 point de couverture médiatique pour marquer un signal supplémentaire dans le secteur de Mercure.',
      'Scan Mercure'
    );

    const observation3 = createTechStack(
      'observation-3',
      'III',
      TechnologyCategory.OBSERVATION,
      [{ type: 'SCAN_DISCARD_CARD_MARK_SIGNAL', value: true }],
      'Lors d\'un scan, vous pouvez défausser une carte de votre main pour marquer un signal supplémentaire dans un secteur correspondant à la couleur indiquée dans le coin supérieur droit de la carte défaussée.',
      'Défausse Signal'
    );

    const observation4 = createTechStack(
      'observation-4',
      'IV',
      TechnologyCategory.OBSERVATION,
      [{ type: 'SCAN_LAUNCH_PROBE_OR_MOVEMENT', value: true }, { type: 'SCAN_LAUNCH_PROBE_ENERGY_COST', value: 1 }, { type: 'SCAN_MOVEMENT_BONUS', value: 1 }],
      'Lors d\'un scan, vous pouvez choisir : soit payer 1 énergie pour lancer une sonde, soit gagner 1 point de déplacement supplémentaire.',
      'Scan Sonde'
    );

    // Technologies informatiques
    const computing1 = createTechStack(
      'computing-1',
      'I',
      TechnologyCategory.COMPUTING,
      [{ type: 'TECH_TRACK_BONUS', value: { points: 2, credits: 1 } }],
      'Ajoutez cette carte à la piste de technologie pour gagner 2 points de victoire + 1 crédit.',
      '2 PV + 1 Crédit'
    );

    const computing2 = createTechStack(
      'computing-2',
      'II',
      TechnologyCategory.COMPUTING,
      [{ type: 'TECH_TRACK_BONUS', value: { points: 2, cards: 1 } }],
      'Ajoutez cette carte à la piste de technologie pour gagner 2 points de victoire + 1 carte.',
      '2PV + 1 Carte'
    );

    const computing3 = createTechStack(
      'computing-3',
      'III',
      TechnologyCategory.COMPUTING,
      [{ type: 'TECH_TRACK_BONUS', value: { points: 2, energy: 1 } }],
      'Ajoutez cette carte à la piste de technologie pour gagner 2 points de victoire + 1 énergie.',
      '2 PV + 1 Énergie'
    );

    const computing4 = createTechStack(
      'computing-4',
      'IV',
      TechnologyCategory.COMPUTING,
      [{ type: 'TECH_TRACK_BONUS', value: { points: 2, media: 2 } }],
      'Ajoutez cette carte à la piste de technologie pour gagner 2 points de victoire + 2 point de couverture médiatique.',
      '2 PV + 2 Média'
    );

    const allExploration = [...exploration1, ...exploration2, ...exploration3, ...exploration4];
    const allObservation = [...observation1, ...observation2, ...observation3, ...observation4];
    const allComputing = [...computing1, ...computing2, ...computing3, ...computing4];

    return {
      available: [...allExploration, ...allObservation, ...allComputing],
      researched: [],
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
   * Crée le plateau Alien avec les pistes de traces de vie
   */
  private static createAlienBoards(): AlienBoard[] {
    return [{
      lifeTraces: [],
      firstBonus: { pv: 5, media: 1 },
      nextBonus: { pv: 3, media: 1 },
      isFirstBoard: true
    },
    {
      lifeTraces: [],
      firstBonus: { pv: 3, media: 1 },
      nextBonus: { pv: 3, media: 1 },
      isFirstBoard: false
    }];
  }

  /**
   * Crée les tuiles objectifs (4 tuiles, face aléatoire A ou B)
   */
  private static createObjectiveTiles(): ObjectiveTile[] {
    const tiles: ObjectiveTile[] = [];
    
    // 1. Technology
    const techSide = Math.random() > 0.5 ? 'A' : 'B';
    tiles.push({
      id: 'obj_tech',
      category: ObjectiveCategory.TECHNOLOGY,
      side: techSide,
      name: 'Technologies',
      description: techSide === 'A'
        ? 'Gagnez les PV indiqués pour chaque série de 3 types de technologies'
        : 'Gagnez les PV indiqués pour chaque paire de technologie que vous possédez',
      rewards: techSide === 'A' ? { first: 11, second: 8, others: 5 } : { first: 7, second: 5, others: 3 },
      markers: []
    });

    // 2. Mission
    const missionSide = Math.random() > 0.5 ? 'A' : 'B';
    tiles.push({
      id: 'obj_mission',
      category: ObjectiveCategory.MISSION,
      side: missionSide,
      name: 'Missions',
      description: missionSide === 'A'
        ? 'Gagnez les PV indiqués pour chaque mission que vous avez accomplie'
        : 'Gagnez les PV indiqués pour chaque paire de cartes Mission accomplies et/ou Fin de partie',
      rewards: missionSide === 'A' ? { first: 4, second: 3, others: 2 } : { first: 8, second: 6, others: 4 },
      markers: []
    });

    // 3. Revenue
    const revenueSide = Math.random() > 0.5 ? 'A' : 'B';
    tiles.push({
      id: 'obj_revenue',
      category: ObjectiveCategory.REVENUE,
      side: revenueSide,
      name: 'Revenus',
      description: revenueSide === 'A'
        ? 'Gagnez les PV indiqués pour chaque série de 3 types de cartes réservées sous vos revenus'
        : 'Gagnez les PV indiqués pour chaque carte du type que vous avez réservé le plus souvent',
      rewards: revenueSide === 'A' ? { first: 11, second: 8, others: 5 } : { first: 5, second: 4, others: 3 },
      markers: []
    });

    // 4. Other
    const otherSide = Math.random() > 0.5 ? 'A' : 'B';
    tiles.push({
      id: 'obj_other',
      category: ObjectiveCategory.OTHER,
      side: otherSide,
      name: 'Autres',
      description: otherSide === 'A'
        ? 'Gagnez les PV indiqués pour chaque série de 3 types de traces de vie que vous avez marqués'
        : 'Gagnez les PV indiqués pour chaque paire secteur couvert / orbiteur ou atterrisseur',
      rewards: { first: 8, second: 6, others: 4 },
      markers: []
    });

    return tiles;
  }
}
