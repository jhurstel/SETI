/** Partie : état complet, pioches, historique, validation, décompte final, événements, vérifications de règle */
import type { Board } from './board';
import type { Card } from './cards';
import { EventType, GamePhase } from './enums';
import type { InteractionState } from './interactions';
import type { Player } from './player';
import type { Species } from './species';

export interface GameLogEntry {
  id: string;
  message: string;
  timestamp: number;
  playerId?: string;
  sequenceId?: string;
  /** Première entrée de l'action principale du tour (barre de progression de l'historique) */
  mainAction?: boolean;
  previousState?: Game;
}

export interface Decks {
  cards: Card[];
  cardRow: Card[];
  discardPile: Card[];
  roundDecks: { [round: number]: Card[] };
}

export interface Game {
  id: string;
  /** Graine du générateur aléatoire de la partie (core/random.ts), pour la rejouer */
  seed?: number;
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
  isFirstToPass: boolean;
  isRoundEnd: boolean;
  gameLog: GameLogEntry[];
  neutralMilestonesAvailable: Record<number, number>;
  exertienMilestones?: number[];
  /** Décompte final, renseigné quand la partie passe en FINAL_SCORING */
  finalScores?: FinalScore[];
  isSpeciesDiscovered: boolean;
  /** Session (session/GameSession) : interaction en cours (absente : aucune) et file des suivantes */
  interaction?: InteractionState;
  pendingInteractions?: InteractionState[];
  /** Fin de tour commencée (paliers à résoudre) : elle reprend quand la file d'interactions est vide */
  endingTurn?: boolean;
  /** État du générateur aléatoire de la partie (core/random.ts), rétabli avant chaque commande */
  rngState?: number;
}

export interface HistoryEntry {
  id?: string;
  message: string;
  playerId: string;
  previousState?: Game;
  previousInteractionState?: InteractionState;
  previousPendingInteractions?: InteractionState[];
  timestamp?: number;
  sequenceId?: string;
  /** Première entrée de l'action principale du tour (barre de progression de l'historique) */
  mainAction?: boolean;
}

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

export interface ScoreCategories {
  missionEndGame: number;
  objectiveTiles: number;
  speciesBonuses: number;
  /** Cartes Exertiens jouées dont la condition de fin de partie est remplie */
  exertienCards: number;
  /** Somme des catégories (avant la pénalité de danger) */
  total: number;
}

/** Carte Exertien révélée au décompte final. */
export interface RevealedExertienCard {
  name: string;
  danger: number;
  points: number;
  conditionMet: boolean;
}

/** Décompte final d'un joueur, calculé une fois à la fin de la partie. */
export interface FinalScore {
  playerId: string;
  /** Score avant le décompte final */
  baseScore: number;
  categories: ScoreCategories;
  revealedExertienCards: RevealedExertienCard[];
  /** Danger total : cartes Exertiens jouées + marqueurs sur la piste Exertiens */
  danger: number;
  /** PV perdus (10 % arrondi à l'inférieur pour le joueur le plus exposé, 0 sinon) */
  dangerPenalty: number;
  finalScore: number;
  /** Détail des calculs, une ligne par élément (affiché dans l'écran de fin) */
  details?: ScoreDetails;
}

/** Détail du décompte final par catégorie */
export interface ScoreDetails {
  objectiveTiles: string[];
  missionEndGame: string[];
  speciesBonuses: string[];
  danger: string[];
}

export interface GameEvent {
  type: EventType;
  timestamp: number;
  data: unknown;
}

/**
 * Résultat d'une vérification de règle (`canLaunch`, `canScan`…) : un refus donne toujours sa raison,
 * une autorisation peut porter un avertissement et des informations en plus (coût…).
 */
export type RuleCheck<K extends string, Extra = object> =
  | ({ [P in K]: true } & { reason?: string } & Extra)
  | ({ [P in K]: false } & { reason: string } & Partial<Extra>);
