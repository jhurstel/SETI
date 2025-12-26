import React from 'react';
import ReactDOM from 'react-dom/client';
import { BoardUI } from './ui/BoardUI';
import { Game, SolarRing, SolarRingSector, SectorColor, RotationDisk, Planet, Satellite, Technology, TechnologyCategory, Card } from './core/types';
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

  // Technologies mock
  const tech1: Technology = {
    id: 'tech1',
    name: 'Propulsion avancée',
    type: 0 as any,
    effects: [],
    bonus: { energy: 1 },
  };
  const tech2: Technology = {
    id: 'tech2',
    name: 'Télécommunications',
    type: 0 as any,
    effects: [],
    bonus: { media: 1 },
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
        technologies: [tech1],
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
        available: [tech2],
        researched: [],
        mediaTrackMax: 10,
        rotationTokenPosition: 0,
        nextRingLevel: 1,
        categorySlots: [
          {
            category: TechnologyCategory.EXPLORATION,
            technologies: [tech1, tech2],
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

