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
  ORBIT = "ORBIT",
  LAND = "LAND",
  SCAN_SECTOR = "SCAN_SECTOR",
  ANALYZE_DATA = "ANALYZE_DATA",
  PLAY_CARD = "PLAY_CARD",
  RESEARCH_TECH = "RESEARCH_TECH",
  PASS = "PASS",
  MOVE_PROBE = "MOVE_PROBE",
  TRANSFERE_DATA = "TRANSFERE_DATA",
  DISCARD_CARD = "DISCARD_CARD",
  BUY_CARD = "BUY_CARD",
  TRADE_RESOURCES = "TRADE_RESOURCES",
  ACCOMPLISH_MISSION = "ACCOMPLISH_MISSION"
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
  TOKEN = "Token",
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

export enum SectorType {
  BLUE = "Bleu",
  RED = "Rouge",
  YELLOW = "Jaune",
  BLACK = "Noir",
  DECK = "Pioche",
  ROW = "Rangée",
  PROBE = "Sonde",
  EARTH = "Terre",
  MERCURY = "Mercure",
  VENUS = "Venus",
  MARS = "Mars",
  JUPITER = "Jupiter",
  SATURN = "Saturne",
  VIRGINIS = "61 Virginis",
  KEPLER = "Kepler 22",
  PROXIMA = "Proxima Centauri",
  BARNARD = "Etoile de Barnard",
  SIRIUS = "Sirius A",
  PROCYON = "Procyon",
  VEGA = "Vega",
  PICTORIS = "Beta Pictoris",
  OUMUAMUA = "Oumuamua",
  ANY = "N'importe quelle couleur"
}

export enum TechnologyCategory {
  EXPLORATION = "Exploration",
  OBSERVATION = "Observation",
  COMPUTING = "Informatique",
  ANY = "N'importe quelle type"
}

export enum LifeTraceType {
  RED = "Rouge",
  YELLOW = "Jaune",
  BLUE = "Bleu",
  ANY = "N'importe quelle couleur"
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

export enum AlienBoardType {
  ANOMALIES = "Anomalies",
  OUMUAMUA = "Oumuamua",
  EXERTIENS = "Exertiens",
  MASCAMITES = "Mascamites",
  CENTAURIENS = "Centauriens"
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

export interface GameLogEntry {
  id: string;
  message: string;
  timestamp: number;
  playerId?: string;
  sequenceId?: string;
  previousState?: Game;
}

export interface GameState {
  state: Game;
  timestamp: number;
}

export interface Decks {
  cards: Card[];
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
  isRoundEnd: boolean;
  gameLog: GameLogEntry[];
  neutralMilestonesAvailable: Record<number, number>;
}

export interface Player {
  id: string;
  name: string;
  credits: number;
  revenueCredits: number;
  energy: number;
  data: number;
  tokens?: number;
  revenueEnergy: number;
  revenueCards: number;
  mediaCoverage: number;
  probes: Probe[];
  technologies: Technology[];
  cards: Card[];
  playedCards: Card[]; // Cartes jouées qui restent en jeu (ex: Missions Fin de partie)
  reservedCards: Card[]; // Cartes réservées sous le plateau
  missions: Mission[];
  dataComputer: DataComputer;
  lifeTraces: LifeTrace[];
  score: number;
  hasPassed: boolean;
  hasPerformedMainAction: boolean;
  type: 'human' | 'robot';
  color: string;
  claimedGoldenMilestones: number[];
  claimedNeutralMilestones: number[];
  visitedPlanetsThisTurn: string[]; // Planètes visitées ce tour-ci
  activeBuffs: CardEffect[]; // Effets passifs temporaires (ex: bonus de visite)
  permanentBuffs: CardEffect[]; // Effets passifs permanents (ex: carte mission)
  centaurienMilestone?: number; // Palier de score pour le message Centaurien
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
  speciesId: AlienBoardType;
  isDiscovered: boolean;
}

export interface LifeTrace {
  id: string;
  type: LifeTraceType;
  playerId: string;
  location?: 'triangle' | 'species';
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
  value: any;
}

export interface Card {
  id: string;
  name: string;
  description: string;
  type: CardType;
  cost: number;
  freeAction: FreeActionType;
  scanSector: SectorType;
  revenue: RevenueType;
  ownerId?: string;
  immediateEffects?: CardEffect[];
  passiveEffects?: CardEffect[];
  permanentEffects?: CardEffect[];
  isRevealed?: boolean;
}

export interface CardEffect {
  id?: string;
  type: string;
  value: any;
  target?: string;
  source?: string;
}

export interface Mission {
  id: string;
  cardId: string;
  name: string;
  description: string;
  ownerId: string;
  requirements: CardEffect[];
  completedRequirementIds: string[];
  fulfillableRequirementIds: string[];
  completed: boolean;
  originalCard?: Card;
}

export interface Species {
  id: string;
  name: string;
  description: string;
  fixedSlots: {
    redlifetrace: Bonus[],
    yellowlifetrace: Bonus[],
    bluelifetrace: Bonus[],
  };
  infiniteSlots: {
    redlifetrace: Bonus,
    yellowlifetrace: Bonus,
    bluelifetrace: Bonus,
  };
  cards: Card[];
  cardRow: Card[];
  discovered: boolean;
  sector?: Sector;
  planet?: Planet;
  anomalie?: AnomalieToken[];
  message?: CentaurienToken[];
  specimen?: MascamitesToken[];
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
  signals?: { amount: number, scope: SectorType }[];
  scan?: number;
  card?: number;
  speciesCard?: number;
  anycard?: number;
  lifetraces?: { amount: number, scope: LifeTraceType }[];
  revenue?: number;
  rotation?: number;
  technologies?: { amount: number, scope: TechnologyCategory }[];
  probe?: number;
  movements?: number;
  landing?: number;
  token?: number;
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
  ignoreSatelliteLimit?: boolean;
  revealAndTriggerFreeAction?: boolean;
  chooseTechType?: boolean;
}

export interface AnomalieToken {
  color: LifeTraceType;
  head: Bonus;
  tail: Bonus;
}

export interface CentaurienToken {
  bonus: Bonus;
  isAvailable: boolean;
}

export interface MascamitesToken {
  bonus: Bonus;
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

export interface HistoryEntry {
  message: string;
  playerId: string;
  sequenceId: string;
}

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

/**
 * Représente les différents états d'interaction possibles pour le joueur.
 * L'état 'IDLE' est l'état par défaut où le joueur peut initier une action principale.
 * Tous les autres états représentent une interaction en cours qui bloque les actions principales.
 */
export type InteractionState =
  /** Le joueur est en attente, aucune interaction en cours. */
  | { type: 'IDLE', sequenceId?: string }
  /** Le joueur a un bonus de réservation et doit choisir une carte à glisser sous son plateau. */
  | { type: 'RESERVING_CARD', count: number, sequenceId?: string, selectedCards: string[] }
  /** Le joueur doit défausser des cartes (ex: fin de manche). */
  | { type: 'DISCARDING_CARD', count: number, selectedCards: string[], sequenceId?: string }
  /** Le joueur a initié un échange et doit choisir la ressource à dépenser. */
  | { type: 'TRADING_CARD', count: number, targetGain: string, selectedCards: string[], sequenceId?: string }
  /** Le joueur acquiert une carte (gratuitement ou en payant) et doit la sélectionner dans la pioche ou la rangée. */
  | { type: 'ACQUIRING_CARD', count: number, isFree?: boolean, sequenceId?: string, triggerFreeAction?: boolean }
  /** Le joueur a des déplacements gratuits à effectuer. */
  | { type: 'MOVING_PROBE', count: number, autoSelectProbeId?: string, sequenceId?: string }
  /** Le joueur a un atterrissage gratuit (ex: Carte 13). */
  | { type: 'LANDING_PROBE', count: number, source?: string, sequenceId?: string, ignoreSatelliteLimit?: boolean }
  /** Le joueur acquiert une technologie (en payant ou en bonus) et doit la sélectionner. */
  | { type: 'ACQUIRING_TECH', isBonus: boolean, sequenceId?: string, category?: TechnologyCategory, sharedOnly?: boolean, noTileBonus?: boolean }
  /** Le joueur a choisi une technologie "Informatique" et doit sélectionner une colonne sur son ordinateur. */
  | { type: 'SELECTING_COMPUTER_SLOT', tech: Technology, sequenceId?: string }
  /** Le joueur a lancé l'action "Analyser", principalement pour l'animation. */
  | { type: 'ANALYZING', sequenceId?: string }
  /** Le joueur doit placer une trace de vie sur le plateau Alien. */
  | { type: 'PLACING_LIFE_TRACE', color: LifeTraceType, sequenceId?: string, playerId?: string }
  /** Le joueur a atteint un palier de score et doit placer un marqueur sur un objectif. */
  | { type: 'PLACING_OBJECTIVE_MARKER', milestone: number, sequenceId?: string }
  /** Le joueur scanne un secteur (2ème étape : choix de la carte). */
  | { type: 'SELECTING_SCAN_CARD', sequenceId?: string }
  /** Le joueur scanne un secteur (3ème étape : choix du secteur couleur). */
  | { type: 'SELECTING_SCAN_SECTOR', color: SectorType, noData?: boolean, onlyProbes?: boolean, anyProbe?: boolean, adjacents?: boolean, keepCardIfOnly?: boolean, sequenceId?: string, cardId?: string, message?: string, markAdjacents?: boolean, usedProbeIds?: string[] }
  /** Le joueur doit choisir entre un gain de média ou un déplacement (Carte 19). */
  | { type: 'CHOOSING_MEDIA_OR_MOVE', sequenceId?: string, remainingMoves?: number }
  /** Le joueur doit choisir s'il utilise la technologie Observation 2 (Payer 1 Média pour scanner Mercure). */
  | { type: 'CHOOSING_OBS2_ACTION', sequenceId?: string }
  /** Le joueur doit choisir s'il utilise la technologie Observation 3 (Défausser une carte pour un signal). */
  | { type: 'CHOOSING_OBS3_ACTION', sequenceId?: string }
  /** Le joueur doit choisir s'il utilise la technologie Observation 4 (Payer 1 Energie pour lancer une sonde OU gagner 1 déplacement). */
  | { type: 'CHOOSING_OBS4_ACTION', sequenceId?: string }
  /** Le joueur doit défausser des cartes de sa main pour leurs signaux. */
  | { type: 'DISCARDING_FOR_SIGNAL', count: number, selectedCards: string[], sequenceId?: string }
  /** Le joueur doit retirer un orbiteur (Carte 15). */
  | { type: 'REMOVING_ORBITER', sequenceId?: string }
  /** Le joueur doit retirer un atterrisseur (Carte 84). */
  | { type: 'REMOVING_LANDER', sequenceId?: string }
  /** Le joueur a reçu plusieurs bonus interactifs et doit choisir l'ordre de résolution. */
  | { type: 'CHOOSING_BONUS_ACTION', bonusesSummary: string, choices: { id: string, label: string, state: InteractionState, done: boolean }[], sequenceId?: string }
  /** Le joueur doit résoudre un secteur complété. */
  | { type: 'RESOLVING_SECTOR', sectorId: string, sequenceId?: string }
  /** Un effet de carte non-interactif est déclenché. */
  | { type: 'TRIGGER_CARD_EFFECT', effectType: string, value: any, sequenceId?: string }
  /** Le joueur doit piocher une carte et scanner son secteur (Bonus Deck). */
  | { type: 'DRAW_AND_SCAN', count: number, sequenceId?: string }
  /** Le joueur valide une condition de mission. */
  | { type: 'CLAIMING_MISSION_REQUIREMENT', missionId: string, requirementId: string, sequenceId?: string }
  /** Le joueur acquiert une carte Alien (bonus) et doit la sélectionner dans la pioche ou la rangée de l'espèce. */
  | { type: 'ACQUIRING_ALIEN_CARD', count: number, speciesId: string, sequenceId?: string }
  /** Le joueur doit choisir une récompense Centaurienne. */
  | { type: 'CHOOSING_CENTAURIEN_REWARD', sequenceId?: string };

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
  BUY_CARD_COST_MEDIA: 3,
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
