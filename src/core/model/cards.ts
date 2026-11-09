/** Cartes, effets de cartes, missions et bonus */
import { CardType, CostType, FreeActionType, LifeTraceType, RevenueType, SectorType, TechnologyCategory } from './enums';

export interface Card {
  id: string;
  name: string;
  description: string;
  type: CardType;
  cost: number;
  costType: CostType;
  freeAction: FreeActionType;
  scanSector: SectorType;
  revenue: RevenueType;
  ownerId: string;
  immediateEffects: CardEffect[];
  passiveEffects: CardEffect[];
  permanentEffects: CardEffect[];
  isRevealed: boolean;
  completed?: boolean;
  danger?: number;
}

/** Quantité + portée (ex: 2 signaux jaunes, 1 technologie Exploration, 1 trace de vie rouge). */
export interface EffectAmount<S = string> {
  amount: number;
  scope: S;
}

/**
 * Valeur d'un effet de carte, selon son type : nombre, drapeau, chaîne de mission (« GAIN_IF_… »),
 * quantité + portée, ou gains multiples. Lire via les accesseurs de core/cardEffects.ts.
 */
export type CardEffectValue = number | boolean | string | EffectAmount<string> | Bonus;

export interface CardEffect {
  id?: string;
  type: string;
  value: CardEffectValue;
  target?: string;
  source?: string;
  /** Effet limité à l'action de la carte (buff actif) : séquence de cette action */
  sequenceId?: string;
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
  /** Déclencheur de chaque cercle réalisable (prérequis → déclencheur) : un déclencheur ne recouvre qu'un cercle */
  fulfillableTriggers?: Record<string, string>;
  completed: boolean;
  originalCard?: Card;
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
  danger?: number;
  ignoreProbeLimit?: boolean;
  atmosphericEntry?: boolean;
  sampleReturn?: boolean;
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
  orbitOrLandAndSpecimen?: boolean;
  collectSpecimen?: boolean;
  consultSpecimen?: boolean;
  revealAndTriggerFreeAction?: boolean;
}
