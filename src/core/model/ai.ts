/** Robots : décision d'action principale et niveaux */
import type { Technology } from './board';
import { ActionType } from './enums';

export type AIDecision =
  | { action: ActionType.RESEARCH_TECH; data: { tech: Technology } }
  | { action: ActionType.PLAY_CARD; data: { cardId: string } }
  | { action: ActionType.ORBIT | ActionType.LAND; data: { probeId: string; planetId: string } }
  | { action: ActionType.PASS; data: { cardsToKeep: string[] } }
  | { action: ActionType.LAUNCH_PROBE | ActionType.SCAN_SECTOR | ActionType.ANALYZE_DATA; data?: undefined };

export type AIDifficulty = 'PASS' | 'EASY' | 'MEDIUM' | 'EXPERT';
