/**
 * Types de base pour le jeu SETI
 */

// ============================================================================
// ENUMS
// ============================================================================

export enum GamePhase {
  SETUP = "SETUP",
  PLAYING = "PLAYING",
  ROUND_END = "ROUND_END",
  FINAL_SCORING = "FINAL_SCORING"
}

export enum ActionType {
  LAUNCH_PROBE = "LAUNCH_PROBE",
  MOVE_PROBE = "MOVE_PROBE",
  ORBIT = "ORBIT",
  LAND = "LAND",
  SCAN_SECTOR = "SCAN_SECTOR",
  ANALYZE_DATA = "ANALYZE_DATA",
  PLAY_CARD = "PLAY_CARD",
  RESEARCH_TECH = "RESEARCH_TECH",
  PASS = "PASS",
  FREE_ACTION = "FREE_ACTION"
}

export enum TileType {
  EARTH = "EARTH",
  PLANET = "PLANET",
  ASTEROID = "ASTEROID",
  COMET = "COMET",
  SUN = "SUN",
  SPACE = "SPACE"
}

export type DiskName = 'A' | 'B' | 'C' | 'D' | 'E';
export type SectorNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export interface SolarSystemTile {
  disk: DiskName;
  sector: SectorNumber;
  type: TileType;
  planetId?: string; // Pour Neptune, Uranus, etc.
  probes: Probe[];
}

export enum ProbeState {
  IN_SOLAR_SYSTEM = "IN_SOLAR_SYSTEM",
  IN_ORBIT = "IN_ORBIT",
  LANDED = "LANDED"
}

export enum SignalType {
  DATA = "DATA",
  MEDIA = "MEDIA",
  OTHER = "OTHER"
}

export enum CardType {
  ACTION = "ACTION",
  MISSION = "MISSION",
  END_GAME = "END_GAME"
}

export enum TechnologyType {
  MOVEMENT = "MOVEMENT",
  RESOURCE = "RESOURCE",
  SCORING = "SCORING",
  SPECIAL = "SPECIAL"
}

export enum SectorColor {
  BLUE = "BLUE",
  RED = "RED",
  YELLOW = "YELLOW",
  BLACK = "BLACK"
}

export enum TechnologyCategory {
  EXPLORATION = "EXPLORATION",
  OBSERVATION = "OBSERVATION",
  COMPUTING = "COMPUTING"
}

export enum LifeTraceType {
  TYPE_A = "TYPE_A",
  TYPE_B = "TYPE_B",
  TYPE_C = "TYPE_C"
}

export enum EventType {
  PROBE_LAUNCHED = "PROBE_LAUNCHED",
  PROBE_MOVED = "PROBE_MOVED",
  PROBE_ORBITED = "PROBE_ORBITED",
  PROBE_LANDED = "PROBE_LANDED",
  SECTOR_SCANNED = "SECTOR_SCANNED",
  SECTOR_COVERED = "SECTOR_COVERED",
  DATA_ANALYZED = "DATA_ANALYZED",
  SPECIES_DISCOVERED = "SPECIES_DISCOVERED",
  TECHNOLOGY_RESEARCHED = "TECHNOLOGY_RESEARCHED",
  SYSTEM_ROTATED = "SYSTEM_ROTATED",
  ROUND_ENDED = "ROUND_ENDED",
  GAME_ENDED = "GAME_ENDED"
}

// ============================================================================
// INTERFACES DE BASE
// ============================================================================

export interface Position {
  x: number;
  y: number;
}

export interface Game {
  id: string;
  currentRound: number;
  maxRounds: number;
  currentPlayerIndex: number;
  firstPlayerIndex: number;
  phase: GamePhase;
  players: Player[];
  board: Board;
  decks: Decks;
  species: Species[];
  discoveredSpecies: Species[];
  history: GameState[];
}

export interface Player {
  id: string;
  name: string;
  credits: number;
  energy: number;
  mediaCoverage: number;
  probes: Probe[];
  technologies: Technology[];
  cards: Card[];
  missions: Mission[];
  dataComputer: DataComputer;
  lifeTraces: LifeTrace[];
  score: number;
  hasPassed: boolean;
}

export interface Board {
  solarSystem: SolarSystem;
  sectors: Sector[];
  planets: Planet[];
  technologyBoard: TechnologyBoard;
}

export interface SolarSystem {
  tiles: SystemTile[][];
  rotationDisks: RotationDisk[];
  currentRotation: number;
  probes: Probe[];
  rings?: SolarRing[];
  solarTiles?: SolarSystemTile[]; // Nouvelle structure avec disques A-E et secteurs 1-8
  // Positions initiales des plateaux rotatifs (1-8)
  initialSectorLevel1?: number; // Position initiale du plateau niveau 1 (1-8)
  initialSectorLevel2?: number; // Position initiale du plateau niveau 2 (1-8)
  initialSectorLevel3?: number; // Position initiale du plateau niveau 3 (1-8)
  // Angles de rotation initiaux (en degrés)
  initialAngleLevel1?: number; // Angle de rotation initiale du plateau niveau 1 (en degrés)
  initialAngleLevel2?: number; // Angle de rotation initiale du plateau niveau 2 (en degrés)
  initialAngleLevel3?: number; // Angle de rotation initiale du plateau niveau 3 (en degrés)
  // Angles de rotation actuels (en degrés)
  rotationAngleLevel1?: number; // Angle de rotation actuel du plateau niveau 1 (en degrés)
  rotationAngleLevel2?: number; // Angle de rotation actuel du plateau niveau 2 (en degrés)
  rotationAngleLevel3?: number; // Angle de rotation actuel du plateau niveau 3 (en degrés)
}

export interface SolarRing {
  level: number;               // 1 (intérieur) → 4 (extérieur)
  sectors: SolarRingSector[];  // Toujours 8 secteurs
}

export interface SolarRingSector {
  index: number;       // 0-7
  color: SectorColor;  // Couleur du secteur
  tileIds: string[];   // IDs des cases appartenant à ce secteur/anneau
}

export interface SystemTile {
  id: string;
  type: TileType;
  position: Position;
  planetId?: string;
  mediaBonus?: number;
  probes: Probe[];
}

export interface Probe {
  id: string;
  ownerId: string;
  position?: Position; // Position générale (peut être utilisé pour d'autres contextes)
  solarPosition: { // Position dans le système solaire (obligatoire)
    disk: DiskName;
    sector: SectorNumber;
    level: number;
  };
  state: ProbeState;
  planetId?: string;
  isOrbiter: boolean;
  isLander: boolean;
}

export interface Sector {
  id: string;
  signals: Signal[];
  playerMarkers: PlayerMarker[];
  coveredBy?: string;
  coveredAt?: number;
  isCovered: boolean;
  color?: SectorColor;
  dataSlots?: string[];
}

export interface Signal {
  id: string;
  type: SignalType;
  marked: boolean;
  markedBy?: string;
}

export interface PlayerMarker {
  id: string;
  playerId: string;
  placedAt: number;
}

export interface DataComputer {
  topRow: DataToken[];
  bottomRow: DataToken[];
  canAnalyze: boolean;
}

export interface DataToken {
  id: string;
  type: string;
}

export interface LifeTrace {
  id: string;
  type: LifeTraceType;
  discoveredAt: number;
}

export interface Technology {
  id: string;
  name: string;
  type: TechnologyType;
  effects: TechnologyEffect[];
  bonus: TechnologyBonus;
  ownerId?: string;
  description?: string;
}

export interface TechnologyEffect {
  type: string;
  value: any;
}

export interface TechnologyBonus {
  credits?: number;
  energy?: number;
  media?: number;
  pv?: number;
}

export interface Card {
  id: string;
  name: string;
  type: CardType;
  cost: number;
  effects: CardEffect[];
  ownerId?: string;
  isMission: boolean;
  isEndGame: boolean;
  description?: string;
}

export interface CardEffect {
  type: string;
  value: any;
}

export interface Mission {
  id: string;
  cardId: string;
  ownerId: string;
  requirements: MissionRequirement[];
  progress: MissionProgress;
  completed: boolean;
  completedAt?: number;
}

export interface MissionRequirement {
  type: string;
  target: number;
}

export interface MissionProgress {
  current: number;
  target: number;
}

export interface Species {
  id: string;
  name: string;
  lifeTraceTypes: LifeTraceType[];
  rules: SpeciesRules;
  cards: Card[];
  scoringModifiers: ScoringModifier[];
  discovered: boolean;
  discoveredAt?: number;
}

export interface SpeciesRules {
  modifications: RuleModification[];
}

export interface RuleModification {
  type: string;
  target: string;
  value: any;
}

export interface ScoringModifier {
  category: string;
  value: number;
}

export interface Planet {
  id: string;
  name: string;
  orbiters: Probe[];
  landers: Probe[];
  orbitFirstBonus?: PlanetBonus;
  orbitNextBonuses?: PlanetBonus[];
  landFirstBonus?: PlanetBonus;
  landSecondBonus?: PlanetBonus;
  landNextBonuses?: PlanetBonus[];
  satellites?: Satellite[];
}

export interface Satellite {
  id: string;
  name: string;
  planetId: string;
  landers: Probe[];
  landBonuses: PlanetBonus[];
}

export interface PlanetBonus {
  credits?: number;
  energy?: number;
  media?: number;
  data?: number;
  pv?: number;
  planetscan?: number;
  redscan?: number;
  bluescan?: number;
  yellowscan?: number;
  blackscan?: number;
  card?: number;
  anycard?: number;
  yellowlifetrace?: number;
  redlifetrace?: number;
  bluelifetrace?: number;
  revenue?: number;
  anytechnology?: number;
}

export interface RotationDisk {
  id: string;
  //positions: Position[];
  //currentPosition: number;
  sectorIndex: number;
  diskName: DiskName;
  level: number;
}

export interface TechnologyBoard {
  available: Technology[];
  researched: Technology[];
  mediaTrackMax?: number;
  rotationTokenPosition?: number;
  nextRingLevel?: number;
  categorySlots?: TechnologyCategorySlots[];
}

export interface TechnologyCategorySlots {
  category: TechnologyCategory;
  technologies: Technology[];
}

export interface Decks {
  actionCards: Card[];
  missionCards: Card[];
  endGameCards: Card[];
  speciesCards: Card[];
}

export interface GameState {
  state: Game;
  timestamp: number;
}

// ============================================================================
// ACTIONS
// ============================================================================

// Action interface moved to actions/Action.ts
// Keeping for backward compatibility
export type Action = import('../actions/Action').IAction;

// ============================================================================
// VALIDATION
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  code: string;
  message: string;
  field?: string;
}

export interface ValidationWarning {
  code: string;
  message: string;
}

// ============================================================================
// SCORING
// ============================================================================

export interface ScoreCategories {
  goldenTiles: number;
  technologySeries: number;
  completedMissions: number;
  reservedRevenue: number;
  lifeTraceSets: number;
  sectorProbePairs: number;
  missionEndGamePairs: number;
  speciesBonuses: number;
  total: number;
}

// ============================================================================
// EVENTS
// ============================================================================

export interface GameEvent {
  type: EventType;
  timestamp: number;
  data: any;
}

// ============================================================================
// CONSTANTES
// ============================================================================

export const GAME_CONSTANTS = {
  MAX_ROUNDS: 5,
  MAX_PLAYERS: 4,
  MIN_PLAYERS: 2,
  MAX_MEDIA_COVERAGE: 10,
  MAX_PROBES_PER_SYSTEM: 1,
  MAX_PROBES_PER_SYSTEM_WITH_TECHNOLOGY: 2,
  PROBE_LAUNCH_COST: 2,
  ORBIT_COST_CREDITS: 1,
  ORBIT_COST_ENERGY: 1,
  LAND_COST_ENERGY: 3,
  LAND_COST_ENERGY_WITH_ORBITER: 2,
  LAND_COST_ENERGY_WITH_TECHNOLOGY: 2,
  LAND_COST_ENERGY_WITH_TECHNOLOGY_AND_ORBITER: 1,
  SCAN_COST_CREDITS: 1,
  SCAN_COST_ENERGY: 2,
  ANALYZE_COST_ENERGY: 1,
  TECH_RESEARCH_COST_MEDIA: 6,
  SPECIES_DISCOVERY_TRACES: 3,
  HAND_SIZE_AFTER_PASS: 4,
  INITIAL_CREDITS: 3,
  INITIAL_ENERGY: 2,
  INITIAL_MEDIA_COVERAGE: 4,
} as const;

export const DISK_NAMES: Record<DiskName, number> = {
  A: 0,
  B: 1,
  C: 2,
  D: 3,
  E: 4,
} as const;
