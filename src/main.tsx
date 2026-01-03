import React from 'react';
import ReactDOM from 'react-dom/client';
import { BoardUI } from './ui/BoardUI';
import { Game, SolarRing, SolarRingSector, SectorColor, RotationDisk, Planet, Satellite, Technology, TechnologyCategory, TechnologyType, Card } from './core/types';
import './ui/styles.css';

/**
 * Crée un jeu mock pour le développement de l'UI
 */
function createMockGame(): Game {
  // Créer des anneaux solaires avec secteurs
  const rings: SolarRing[] = [
    {
      level: 1,
      sectors: [
        { index: 0, color: SectorColor.BLUE, tileIds: [] },
        { index: 1, color: SectorColor.RED, tileIds: [] },
        { index: 2, color: SectorColor.YELLOW, tileIds: [] },
        { index: 3, color: SectorColor.BLACK, tileIds: [] },
        { index: 4, color: SectorColor.BLUE, tileIds: [] },
        { index: 5, color: SectorColor.RED, tileIds: [] },
        { index: 6, color: SectorColor.YELLOW, tileIds: [] },
        { index: 7, color: SectorColor.BLACK, tileIds: [] },
      ],
    },
    {
      level: 2,
      sectors: [
        { index: 0, color: SectorColor.BLUE, tileIds: [] },
        { index: 1, color: SectorColor.RED, tileIds: [] },
        { index: 2, color: SectorColor.YELLOW, tileIds: [] },
        { index: 3, color: SectorColor.BLACK, tileIds: [] },
        { index: 4, color: SectorColor.BLUE, tileIds: [] },
        { index: 5, color: SectorColor.RED, tileIds: [] },
        { index: 6, color: SectorColor.YELLOW, tileIds: [] },
        { index: 7, color: SectorColor.BLACK, tileIds: [] },
      ],
    },
    {
      level: 3,
      sectors: [
        { index: 0, color: SectorColor.BLUE, tileIds: [] },
        { index: 1, color: SectorColor.RED, tileIds: [] },
        { index: 2, color: SectorColor.YELLOW, tileIds: [] },
        { index: 3, color: SectorColor.BLACK, tileIds: [] },
        { index: 4, color: SectorColor.BLUE, tileIds: [] },
        { index: 5, color: SectorColor.RED, tileIds: [] },
        { index: 6, color: SectorColor.YELLOW, tileIds: [] },
        { index: 7, color: SectorColor.BLACK, tileIds: [] },
      ],
    },
    {
      level: 4,
      sectors: [
        { index: 0, color: SectorColor.BLUE, tileIds: [] },
        { index: 1, color: SectorColor.RED, tileIds: [] },
        { index: 2, color: SectorColor.YELLOW, tileIds: [] },
        { index: 3, color: SectorColor.BLACK, tileIds: [] },
        { index: 4, color: SectorColor.BLUE, tileIds: [] },
        { index: 5, color: SectorColor.RED, tileIds: [] },
        { index: 6, color: SectorColor.YELLOW, tileIds: [] },
        { index: 7, color: SectorColor.BLACK, tileIds: [] },
      ],
    },
  ];

  // Disques de rotation
  const rotationDisks: RotationDisk[] = [
    { id: 'disk-1', positions: [], currentPosition: 0 },
    { id: 'disk-2', positions: [], currentPosition: 1 },
    { id: 'disk-3', positions: [], currentPosition: 2 },
    { id: 'disk-4', positions: [], currentPosition: 0 },
  ];

  // Planètes avec satellites
  const planets: Planet[] = [
    {
      id: 'mercury',
      name: 'Mercure',
      orbiters: [],
      landers: [],
      bonus: {},
      orbitFirstPV: 2,
      orbitNextPV: 1,
      landFirstPV: 3,
      landNextPV: 2,
    },
    {
      id: 'venus',
      name: 'Vénus',
      orbiters: [],
      landers: [],
      bonus: {},
      orbitFirstPV: 2,
      orbitNextPV: 1,
      landFirstPV: 3,
      landNextPV: 2,
    },
    {
      id: 'mars',
      name: 'Mars',
      orbiters: [],
      landers: [],
      bonus: {},
      orbitFirstPV: 3,
      orbitNextPV: 2,
      landFirstPV: 4,
      landNextPV: 3,
      satellites: [
        { id: 'phobos', name: 'Phobos', planetId: 'mars', bonus: { pv: 1 } },
        { id: 'deimos', name: 'Deimos', planetId: 'mars', bonus: { pv: 1 } },
      ],
    },
    {
      id: 'jupiter',
      name: 'Jupiter',
      orbiters: [],
      landers: [],
      bonus: {},
      orbitFirstPV: 4,
      orbitNextPV: 3,
      landFirstPV: 5,
      landNextPV: 4,
      satellites: [
        { id: 'io', name: 'Io', planetId: 'jupiter', bonus: { pv: 2 } },
        { id: 'europa', name: 'Europe', planetId: 'jupiter', bonus: { pv: 2 } },
        { id: 'ganymede', name: 'Ganymède', planetId: 'jupiter', bonus: { pv: 2 } },
        { id: 'callisto', name: 'Callisto', planetId: 'jupiter', bonus: { pv: 2 } },
      ],
    },
    {
      id: 'saturn',
      name: 'Saturne',
      orbiters: [],
      landers: [],
      bonus: {},
      orbitFirstPV: 4,
      orbitNextPV: 3,
      landFirstPV: 5,
      landNextPV: 4,
      satellites: [
        { id: 'titan', name: 'Titan', planetId: 'saturn', bonus: { pv: 3 } },
        { id: 'enceladus', name: 'Encelade', planetId: 'saturn', bonus: { pv: 2 } },
      ],
    },
    {
      id: 'uranus',
      name: 'Uranus',
      orbiters: [],
      landers: [],
      bonus: {},
      orbitFirstPV: 3,
      orbitNextPV: 2,
      landFirstPV: 4,
      landNextPV: 3,
      satellites: [
        { id: 'miranda', name: 'Miranda', planetId: 'uranus', bonus: { pv: 2 } },
      ],
    },
    {
      id: 'neptune',
      name: 'Neptune',
      orbiters: [],
      landers: [],
      bonus: {},
      orbitFirstPV: 3,
      orbitNextPV: 2,
      landFirstPV: 4,
      landNextPV: 3,
      satellites: [
        { id: 'triton', name: 'Triton', planetId: 'neptune', bonus: { pv: 2 } },
      ],
    },
  ];

  // Technologies d'exploration (utiliser celles définies dans Board.ts)
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

  // Cartes mock
  const cards: Card[] = [
    {
      id: 'card1',
      name: 'Mission d\'exploration',
      type: 0 as any,
      cost: 2,
      effects: [],
      isMission: false,
      isEndGame: false,
      description: 'Gagnez 2 PV pour chaque planète visitée cette manche.',
    },
    {
      id: 'card2',
      name: 'Découverte majeure',
      type: 0 as any,
      cost: 3,
      effects: [],
      isMission: false,
      isEndGame: false,
      description: 'Placez un marqueur de découverte supplémentaire.',
    },
    {
      id: 'card3',
      name: 'Financement public',
      type: 0 as any,
      cost: 1,
      effects: [],
      isMission: false,
      isEndGame: false,
      description: 'Gagnez 3 crédits et 1 point de couverture médiatique.',
    },
  ];

  return {
    id: 'mock-game',
    currentRound: 1,
    maxRounds: 5,
    currentPlayerIndex: 0,
    firstPlayerIndex: 0,
    phase: 0 as any,
    players: [
      {
        id: 'player1',
        name: 'Joueur 1',
        credits: 5,
        energy: 3,
        mediaCoverage: 2,
        probes: [],
        technologies: [],
        cards,
        missions: [],
        dataComputer: { topRow: [], bottomRow: [], canAnalyze: false },
        lifeTraces: [],
        score: 0,
        hasPassed: false,
      },
    ],
    board: {
      solarSystem: {
        tiles: [],
        rotationDisks,
        currentRotation: 0,
        probes: [],
        rings: [],
        solarTiles: [],
        // Positions initiales des plateaux rotatifs
        initialSectorLevel1: 1,
        initialSectorLevel2: 1,
        initialSectorLevel3: 1,
        // Calculer les angles initiaux
        rotationAngleLevel1: 0, // secteur 1 = index 0 = 0°
        rotationAngleLevel2: 0, // secteur 1 = index 0 = 0°
        rotationAngleLevel3: 0, // secteur 1 = index 0 = 0°
      },
      sectors: [],
      planets,
      technologyBoard: {
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
      },
    },
    decks: {
      actionCards: [],
      missionCards: [],
      endGameCards: [],
      speciesCards: [],
    },
    species: [],
    discoveredSpecies: [],
    history: [],
  };
}

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <BoardUI game={createMockGame()} />
  </React.StrictMode>
);

