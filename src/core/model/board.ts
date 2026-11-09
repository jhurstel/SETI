/** Plateau : système solaire, sondes, secteurs, planètes, plateaux Alien, tuiles objectif, technologies */
import type { Bonus } from './cards';
import { AlienBoardType, DiskName, LifeTraceLocation, LifeTraceType, ObjectiveCategory, ProbeState, SectorNumber, SectorType, SignalType, TechnologyCategory } from './enums';
import type { MascamitesToken } from './species';

export interface Position {
  x: number;
  y: number;
}

/**
 * Position d'un objet céleste
 */
export interface CelestialPosition {
  disk: DiskName; // A, B, C, D, ou E
  sector: SectorNumber; // 1 à 8
  x: number; // Position X en pourcentage (0-100)
  y: number; // Position Y en pourcentage (0-100)
}

/**
 * Type d'objet céleste
 */
export type CelestialObjectType = 'planet' | 'comet' | 'asteroid' | 'hollow' | 'empty' | 'anomaly';

/**
 * Objet céleste avec sa position relative
 */
export interface CelestialObject {
  id: string;
  type: CelestialObjectType;
  name: string;
  position: CelestialPosition;
  level?: 0 | 1 | 2 | 3; // Niveau du plateau (0 = fixe, 1-3 = rotatif)
  anomalyData?: {
    color: LifeTraceType;
    side: 'head' | 'tail';
    bonus: Bonus;
  };
}

export interface Board {
  solarSystem: SolarSystem;
  sectors: Sector[];
  planets: Planet[];
  technologyBoard: TechnologyBoard;
  alienBoards: AlienBoard[];
  objectiveTiles: ObjectiveTile[];
}

export interface SolarSystem {
  currentRotation: number;
  probes: Probe[];
  // Positions initiales des plateaux rotatifs (1-8)
  initialSectorLevel1: number; // Position initiale du plateau niveau 1 (1-8)
  initialSectorLevel2: number; // Position initiale du plateau niveau 2 (1-8)
  initialSectorLevel3: number; // Position initiale du plateau niveau 3 (1-8)
  // Angles de rotation initiaux (en degrés)
  initialAngleLevel1: number; // Angle de rotation initiale du plateau niveau 1 (en degrés)
  initialAngleLevel2: number; // Angle de rotation initiale du plateau niveau 2 (en degrés)
  initialAngleLevel3: number; // Angle de rotation initiale du plateau niveau 3 (en degrés)
  // Angles de rotation actuels (en degrés)
  rotationAngleLevel1: number; // Angle de rotation actuel du plateau niveau 1 (en degrés)
  rotationAngleLevel2: number; // Angle de rotation actuel du plateau niveau 2 (en degrés)
  rotationAngleLevel3: number; // Angle de rotation actuel du plateau niveau 3 (en degrés)
  nextRingLevel: number; // Prochain niveau à tourner (1, 2 ou 3)
  extraCelestialObjects?: CelestialObject[];
}

export interface Probe {
  id: string;
  ownerId: string;
  position: Position; // Position générale (peut être utilisé pour d'autres contextes)
  solarPosition: { // Position dans le système solaire (obligatoire)
    disk: DiskName;
    sector: SectorNumber;
    level: number;
  };
  state: ProbeState;
  planetId?: string;
  specimen?: MascamitesToken; // Capsule : spécimen transporté (planetId = planète d'origine)
  isOrbiter: boolean;
  isLander: boolean;
  planetSlotIndex?: number;
}

export interface Sector {
  id: string;
  name: string;
  color: SectorType;
  signals: Signal[];
  playerMarkers: PlayerMarker[];
  isCovered: boolean;
  coveredBy: string[];
  firstBonus: Bonus;
  nextBonus: Bonus;
}

export interface Signal {
  id: string;
  type: SignalType;
  marked: boolean;
  markedBy?: string;
  bonus?: Bonus;
}

export interface PlayerMarker {
  id: string;
  playerId: string;
}

export interface AlienBoard {
  lifeTraces: LifeTrace[];
  firstBonus: Bonus;
  nextBonus: Bonus;
  isFirstBoard: boolean;
  speciesId: AlienBoardType;
  isDiscovered: boolean;
}

export interface LifeTrace {
  id: string;
  type: LifeTraceType;
  playerId: string;
  location?: LifeTraceLocation;
  slotIndex?: number;
}

export interface ObjectiveTile {
  id: string;
  category: ObjectiveCategory;
  side: 'A' | 'B';
  name: string;
  description: string;
  rewards: {
    first: number;
    second: number;
    others: number;
  };
  markers: string[];
}

export interface Technology {
  id: string;
  name: string;
  type: TechnologyCategory;
  effects: TechnologyEffect[];
  bonus: Bonus;
  ownerId?: string;
  description: string;
  shorttext: string;
}

export interface TechnologyEffect {
  type: string;
  value: number | boolean | { points: number; credits?: number; energy?: number; cards?: number; media?: number };
}

export interface Planet {
  id: string;
  name: string;
  orbiters: Probe[];
  landers: Probe[];
  orbitFirstBonus?: Bonus;
  orbitNextBonus?: Bonus;
  landFirstBonus?: Bonus;
  landSecondBonus?: Bonus;
  landThirdBonus?: Bonus;
  landNextBonus?: Bonus;
  orbitSlots: Bonus[];
  landSlots: Bonus[];
  satellites?: Satellite[];
  /** Spécimens Mascamites, face cachée */
  mascamiteTokens?: MascamitesToken[];
  /** Joueurs qui ont regardé les spécimens de la planète (en en prélevant ou en en étudiant un) : ils les voient ensuite */
  mascamiteSeenBy?: string[];
}

export interface Satellite {
  id: string;
  name: string;
  planetId: string;
  landers: Probe[];
  landBonus: Bonus;
}

export interface RotationDisk {
  id: string;
  sectorIndex: number;
  diskName: DiskName;
  level: number;
}

export interface TechnologyBoard {
  available: Technology[];
  researched: Technology[];
  mediaTrackMax?: number;
  rotationTokenPosition?: number;
  categorySlots?: TechnologyCategorySlots[];
}

export interface TechnologyCategorySlots {
  category: TechnologyCategory;
  technologies: Technology[];
}
