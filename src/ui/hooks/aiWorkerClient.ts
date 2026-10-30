import AIWorker from '../../ai/aiWorker?worker';
import { AITurn, AIStep } from '../../ai/AITurn';
import type { AIEndTurn, AIWorkerRequest, AIWorkerResponse } from '../../ai/aiWorkerProtocol';
import { Game } from '../../core/types';
import { getRandomState, setRandomState } from '../../core/random';

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
    target.postMessage({ id, kind, game, rngState: getRandomState() } satisfies AIWorkerRequest);
  });
}

/** Étape d'un robot (AITurn.playStep), calculée dans le Worker. */
export async function playAIStep(game: Game): Promise<AIStep> {
  try {
    const response = await post('playStep', game);
    if ('error' in response) throw new Error(response.error);
    setRandomState(response.rngState);
    if (response.kind !== 'playStep') throw new Error('Réponse inattendue du Web Worker');
    return response.step;
  } catch {
    return AITurn.playStep(game);
  }
}

/** Fin de tour d'un robot (AITurn.endTurn), calculée dans le Worker. */
export async function endAITurn(game: Game): Promise<AIEndTurn> {
  try {
    const response = await post('endTurn', game);
    if ('error' in response) throw new Error(response.error);
    setRandomState(response.rngState);
    if (response.kind !== 'endTurn') throw new Error('Réponse inattendue du Web Worker');
    return response.end;
  } catch {
    return AITurn.endTurn(game);
  }
}
