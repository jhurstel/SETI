/** Joueur : ressources, ordinateur de données, paliers Centauriens */
import type { AIDifficulty } from './ai';
import type { LifeTrace, Probe, Technology } from './board';
import type { Card, CardEffect, Mission } from './cards';

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
  danger: number;
  hasPassed: boolean;
  hasPerformedMainAction: boolean;
  type: 'human' | 'robot';
  aiDifficulty?: AIDifficulty; // Niveau du robot (absent : EASY, anciennes sauvegardes)
  color: string;
  claimedGoldenMilestones: number[];
  claimedNeutralMilestones: number[];
  visitedPlanetsThisTurn: string[]; // Planètes visitées ce tour-ci
  activeBuffs: CardEffect[]; // Effets passifs temporaires (ex: bonus de visite)
  permanentBuffs: CardEffect[]; // Effets passifs permanents (ex: carte mission)
  centaurienMilestones: CentaurienMarker[]; // Paliers de message Centaurien sur la piste de score (restent affichés une fois atteints)
  revenueMedia?: number; // Revenus en Médias (cartes Centauriens « augmentez vos revenus »)
  revenueData?: number; // Revenus en Données
  claimedExertienMilestones?: number[]; // Paliers Exertiens déjà utilisés par ce joueur (optionnel : anciennes sauvegardes)
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

/** Palier de message Centaurien d'un joueur : message de l'espèce (choix d'une tuile) ou réception d'une carte */
export interface CentaurienMarker {
  id: string;
  /** Score à atteindre */
  score: number;
  /** Carte Centaurien dont c'est la réception (absent : message de l'espèce) */
  cardId?: string;
  cardName?: string;
  /** Une fois atteint : ce qui a été obtenu (affiché sur la piste de score) */
  resolved?: string;
}
