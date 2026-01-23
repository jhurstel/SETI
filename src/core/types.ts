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
  TRANSFERE_DATA = "TRANSFERE_DATA",
  DRAW_CARDS = "DRAW_CARDS",
  DISCARD_CARDS = "DISCARD_CARDS",
  PLAY_CARD = "PLAY_CARD",
  RESERVE_CARD = "RESERVE_CARD",
  BUY_CARD = "BUY_CARD",
  RESEARCH_TECH = "RESEARCH_TECH",
  TRADE_RESOURCES = "TRADE_RESOURCES",
  PASS = "PASS"
}

export type DiskName = 'A' | 'B' | 'C' | 'D' | 'E';
export type SectorNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export enum ProbeState {
  IN_SOLAR_SYSTEM = "IN_SOLAR_SYSTEM",
  IN_ORBIT = "IN_ORBIT",
  LANDED = "LANDED"
}

export enum SignalType {
  DATA = "Donnée",
  MEDIA = "Média",
  OTHER = "OTHER"
}

export enum CardType {
  ACTION = "Action",
  CONDITIONAL_MISSION = "Mission Conditionnelle",
  TRIGGERED_MISSION = "Mission Déclenchable",
  END_GAME = "Fin de partie"
}

export enum FreeActionType {
  MOVEMENT = "Déplacement",
  DATA = "Donnée",
  MEDIA = "Média"
}

export enum RevenueType {
  CREDIT = "Crédit",
  ENERGY = "Energie",
  CARD = "Carte"
}

export enum SectorColor {
  BLUE = "Bleu",
  RED = "Rouge",
  YELLOW = "Jaune",
  BLACK = "Noir",
  ANY = "Tout"
}

export enum TechnologyCategory {
  EXPLORATION = "Exploration",
  OBSERVATION = "Observation",
  COMPUTING = "Informatique"
}

export enum LifeTraceType {
  RED = "Rouge",
  YELLOW = "Jaune",
  BLUE = "Bleu"
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

export enum ObjectiveCategory {
  TECHNOLOGY = "TECHNOLOGY",
  MISSION = "MISSION",
  REVENUE = "REVENUE",
  OTHER = "OTHER"
}

// ============================================================================
// INTERFACES DE BASE
// ============================================================================

export interface Position {
  x: number;
  y: number;
}

export interface GameLogEntry {
  id: string;
  message: string;
  timestamp: number;
  playerId?: string;
}

export interface GameState {
  state: Game;
  timestamp: number;
}

export interface Decks {
  cards: Card[];
  speciesCards: Card[];
  cardRow: Card[];
  discardPile: Card[];
  roundDecks: { [round: number]: Card[] };
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
  isFirstToPass: boolean;
  gameLog?: GameLogEntry[];
  neutralMilestonesAvailable: Record<number, number>;
}

export interface Player {
  id: string;
  name: string;
  credits: number;
  revenueCredits: number;
  energy: number;
  data: number;
  revenueEnergy: number;
  revenueCards: number;
  mediaCoverage: number;
  probes: Probe[];
  technologies: Technology[];
  cards: Card[];
  playedCards: Card[]; // Cartes jouées qui restent en jeu (ex: Missions Fin de partie)
  missions: Mission[];
  dataComputer: DataComputer;
  lifeTraces: LifeTrace[];
  score: number;
  hasPassed: boolean;
  type: 'human' | 'robot';
  color: string;
  claimedGoldenMilestones: number[];
  claimedNeutralMilestones: number[];
  visitedPlanetsThisTurn: string[]; // Planètes visitées ce tour-ci
  activeBuffs: CardEffect[]; // Effets passifs temporaires (ex: bonus de visite)
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
  rotationDisks: RotationDisk[];
  currentRotation: number;
  probes: Probe[];
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
  nextRingLevel: number; // Prochain niveau à tourner (1, 2 ou 3)
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
  isOrbiter: boolean;
  isLander: boolean;
  planetSlotIndex?: number;
}

export interface Sector {
  id: string;
  name: string;
  color: SectorColor;
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

export interface DataComputer {
  canAnalyze: boolean;
  slots: Record<string, ComputerSlot>;
}

export interface ComputerSlot {
  id: string;
  bonus?: string;
  isOccupied: boolean;
  technologyId?: string;
  filled: boolean;
  type: 'top' | 'bottom';
  col: number;
  parentId?: string;
}

export interface AlienBoard {
  lifeTraces: LifeTrace[];
  firstBonus: Bonus;
  nextBonus: Bonus;
  isFirstBoard: boolean;
  speciesId?: string; // ID de l'espèce découverte sur ce plateau
}

export interface LifeTrace {
  id: string;
  type: LifeTraceType;
  playerId: string
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
  value: any;
}

export interface Card {
  id: string;
  name: string;
  description: string;
  type: CardType;
  cost: number;
  freeAction: FreeActionType;
  scanSector: SectorColor;
  revenue: RevenueType;
  effects: CardEffect[];
  ownerId?: string;
  immediateEffects?: CardEffect[];
  passiveEffects?: CardEffect[];
  scoringModifiers?: ScoringModifier[];
  isRevealed?: boolean;
}

export interface CardEffect {
  type: string;
  value: any;
  target?: string;
  condition?: string;
  source?: string;
}

export interface Mission {
  id: string;
  cardId: string;
  name: string;
  description: string;
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
  orbitFirstBonus?: Bonus;
  orbitNextBonus?: Bonus;
  landFirstBonus?: Bonus;
  landSecondBonus?: Bonus;
  landNextBonus?: Bonus;
  orbitSlots: Bonus[];
  landSlots: Bonus[];
  satellites?: Satellite[];
}

export interface Satellite {
  id: string;
  name: string;
  planetId: string;
  landers: Probe[];
  landBonus: Bonus;
}

export interface Bonus {
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
  probescan?: number;
  earthscan?: number;
  rowscan?: number;
  deckscan?: number;
  anyscan?: number;
  keplerscan?: number;
  barnardscan?: number;
  procyonscan?: number;
  vegascan?: number;
  scanAction?: number;
  card?: number;
  anycard?: number;
  yellowlifetrace?: number;
  redlifetrace?: number;
  bluelifetrace?: number;
  revenue?: number;
  rotation?: number;
  anytechnology?: number;
  probe?: number;
  movements?: number;
  landing?: number;
  ignoreProbeLimit?: boolean;
  atmosphericEntry?: boolean;
  sharedOnly?: boolean;
  noTileBonus?: boolean;
  gainSignal?: { amount: number; scope: string }[];
  gainSignalFromHand?: number;
  keepCardIfOnly?: boolean;
  noData?: boolean;
  anyProbe?: boolean;
  gainSignalAdjacents?: boolean;
  scorePerMedia?: number;
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
  missionEndGame: number;
  objectiveTiles: number;
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
  MAX_DATA: 6,
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
  INITIAL_CREDITS: 4,
  INITIAL_ENERGY: 3,
  INITIAL_DATA: 0,
  INITIAL_HAND_SIZE: 5,
  INITIAL_MEDIA_COVERAGE: 4,
  INITIAL_REVENUE_CREDITS: 3,
  INITIAL_REVENUE_ENERGY: 2,
  INITIAL_REVENUE_CARDS: 1,
} as const;

export const GOLDEN_MILESTONES = [25, 50, 70] as const;
export const NEUTRAL_MILESTONES = [20, 30] as const;

export const DISK_NAMES: Record<DiskName, number> = {
  A: 0,
  B: 1,
  C: 2,
  D: 3,
  E: 4,
} as const;
