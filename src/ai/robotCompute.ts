import type { Game } from '../core/types';
import { withRandomState } from '../core/random';
import { AITurn, AIStep } from './AITurn';
import type { AIEndTurn, AIWorkerRequest, AIWorkerResponse } from './aiWorkerProtocol';

/**
 * Calculs des robots avec le générateur de leur partie : chaque calcul repart de `game.rngState` et rend l'état
 * atteint, que l'application de l'étape (GameSession.applyRobotStep) reprend. Le calcul peut donc se faire ailleurs
 * (Web Worker du navigateur, worker_thread du serveur) ou plus tard, sans dépendre de ce qui a tiré entre-temps.
 */
export function computeStep(game: Game): { step: AIStep; rngState: number } {
  const { result, rngState } = withRandomState(game.rngState, () => AITurn.playStep(game));
  return { step: result, rngState };
}

export function computeEndTurn(game: Game): { end: AIEndTurn; rngState: number } {
  const { result, rngState } = withRandomState(game.rngState, () => AITurn.endTurn(game));
  return { end: result, rngState };
}

/** Où se font les calculs des robots : sur place, ou dans un fil séparé (même résultat) */
export interface RobotComputer {
  playStep(game: Game): Promise<{ step: AIStep; rngState: number }>;
  endTurn(game: Game): Promise<{ end: AIEndTurn; rngState: number }>;
}

/** Calculs faits sur place (tests, repli si un fil séparé est indisponible) */
export const localRobotComputer: RobotComputer = {
  playStep: async game => computeStep(game),
  endTurn: async game => computeEndTurn(game),
};

/** Réponse d'un fil de calcul à une demande (Web Worker du navigateur, worker_thread du serveur) */
export function answerRobotRequest(request: AIWorkerRequest): AIWorkerResponse {
  const { id, kind, game } = request;
  // L'état envoyé avec la demande prime (partie d'une ancienne sauvegarde sans rngState)
  const withState = { ...game, rngState: request.rngState };
  try {
    if (kind === 'playStep') {
      const { step, rngState } = computeStep(withState);
      return { id, kind, step, rngState };
    }
    const { end, rngState } = computeEndTurn(withState);
    return { id, kind, end, rngState };
  } catch (error) {
    return { id, kind, error: error instanceof Error ? error.message : String(error), rngState: request.rngState };
  }
}
