import type { Game } from '../core/types';
import type { AIStep, AITurn } from './AITurn';

/** Messages échangés avec le Web Worker des robots (src/ai/aiWorker.ts). */
export type AIWorkerRequest = { id: number; kind: 'playStep' | 'endTurn'; game: Game; rngState: number };

export type AIEndTurn = ReturnType<typeof AITurn.endTurn>;

export type AIWorkerResponse =
  | { id: number; kind: 'playStep'; step: AIStep; rngState: number }
  | { id: number; kind: 'endTurn'; end: AIEndTurn; rngState: number }
  | { id: number; kind: 'playStep' | 'endTurn'; error: string; rngState: number };
