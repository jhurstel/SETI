import AIWorker from '../../ai/aiWorker?worker';
import type { AIWorkerRequest, AIWorkerResponse } from '../../ai/aiWorkerProtocol';
import { computeEndTurn, computeStep, RobotComputer } from '../../ai/robotCompute';
import { Game } from '../../core/types';
import { getRandomState } from '../../core/random';

/**
 * Lance les calculs des robots dans un Web Worker (src/ai/aiWorker.ts) et renvoie une promesse.
 * Sans Worker disponible (ou s'il échoue), le calcul se fait sur le fil principal : même résultat.
 */
let worker: Worker | null | undefined;
let nextId = 1;
const pending = new Map<number, { resolve: (response: AIWorkerResponse) => void; reject: (error: Error) => void }>();

function getWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    worker = typeof Worker === 'undefined' ? null : new AIWorker();
  } catch (error) {
    console.warn('[AI] Web Worker indisponible, calcul sur le fil principal :', error);
    worker = null;
  }
  if (worker) {
    worker.onmessage = (event: MessageEvent<AIWorkerResponse>) => {
      const request = pending.get(event.data.id);
      pending.delete(event.data.id);
      request?.resolve(event.data);
    };
    worker.onerror = event => {
      console.warn('[AI] Erreur du Web Worker, calcul sur le fil principal :', event.message);
      pending.forEach(request => request.reject(new Error(event.message)));
      pending.clear();
      worker?.terminate();
      worker = null;
    };
  }
  return worker;
}

function post(kind: AIWorkerRequest['kind'], game: Game): Promise<AIWorkerResponse> {
  const target = getWorker();
  if (!target) return Promise.reject(new Error('Pas de Web Worker'));
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    target.postMessage({ id, kind, game, rngState: game.rngState ?? getRandomState() } satisfies AIWorkerRequest);
  });
}

/**
 * Calculs des robots dans le Worker (repli sur le fil principal : même résultat). Chaque calcul rend l'état du
 * générateur atteint, repris par GameSession.applyRobotStep.
 */
export const workerRobotComputer: RobotComputer = {
  async playStep(game: Game) {
    try {
      const response = await post('playStep', game);
      if ('error' in response) throw new Error(response.error);
      if (response.kind !== 'playStep') throw new Error('Réponse inattendue du Web Worker');
      return { step: response.step, rngState: response.rngState };
    } catch {
      return computeStep(game);
    }
  },
  async endTurn(game: Game) {
    try {
      const response = await post('endTurn', game);
      if ('error' in response) throw new Error(response.error);
      if (response.kind !== 'endTurn') throw new Error('Réponse inattendue du Web Worker');
      return { end: response.end, rngState: response.rngState };
    } catch {
      return computeEndTurn(game);
    }
  },
};
