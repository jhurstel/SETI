import { Worker } from 'worker_threads';
import type { Game } from '../src/core/types';
import type { AIWorkerRequest, AIWorkerResponse } from '../src/ai/aiWorkerProtocol';
import { computeEndTurn, computeStep, RobotComputer } from '../src/ai/robotCompute';

interface PoolWorker {
  worker: Worker;
  /** Demandes en cours sur ce fil */
  pending: Map<number, (response: AIWorkerResponse | Error) => void>;
}

/**
 * Fils de calcul des robots du serveur (worker_threads) : chaque demande va au fil le moins occupé. Le calcul d'un
 * Expert (jusqu'à une seconde) ne bloque ni le réseau ni les autres salles. Un fil qui échoue est remplacé, et la
 * demande calculée sur place (même résultat : l'état du générateur voyage avec la partie).
 */
export class RobotPool implements RobotComputer {
  private readonly workers: PoolWorker[] = [];
  private nextId = 1;
  private closed = false;

  /** `file` : fil compilé (server/build/robotWorker.js) ; `size` : nombre de fils */
  constructor(private readonly file: string, size: number) {
    for (let i = 0; i < Math.max(1, size); i++) this.workers.push(this.spawn());
  }

  private spawn(): PoolWorker {
    const entry: PoolWorker = { worker: new Worker(this.file), pending: new Map() };
    entry.worker.on('message', (response: AIWorkerResponse) => {
      const resolve = entry.pending.get(response.id);
      entry.pending.delete(response.id);
      resolve?.(response);
    });
    const fail = (error: Error) => {
      entry.pending.forEach(resolve => resolve(error));
      entry.pending.clear();
      // Fil remplacé (sauf à l'arrêt du serveur)
      const index = this.workers.indexOf(entry);
      if (index !== -1 && !this.closed) this.workers[index] = this.spawn();
    };
    entry.worker.on('error', fail);
    entry.worker.on('exit', code => { if (code !== 0) fail(new Error(`Fil des robots arrêté (code ${code})`)); });
    return entry;
  }

  private request(kind: AIWorkerRequest['kind'], game: Game): Promise<AIWorkerResponse> {
    if (this.closed) return Promise.reject(new Error('Fils des robots arrêtés'));
    const entry = this.workers.reduce((best, w) => (w.pending.size < best.pending.size ? w : best));
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      entry.pending.set(id, response => (response instanceof Error ? reject(response) : resolve(response)));
      entry.worker.postMessage({ id, kind, game, rngState: game.rngState ?? 0 } satisfies AIWorkerRequest);
    });
  }

  async playStep(game: Game) {
    try {
      const response = await this.request('playStep', game);
      if ('error' in response || response.kind !== 'playStep') throw new Error('error' in response ? response.error : 'Réponse inattendue');
      return { step: response.step, rngState: response.rngState };
    } catch (error) {
      console.warn('[Serveur] calcul du robot sur place :', error instanceof Error ? error.message : error);
      return computeStep(game);
    }
  }

  async endTurn(game: Game) {
    try {
      const response = await this.request('endTurn', game);
      if ('error' in response || response.kind !== 'endTurn') throw new Error('error' in response ? response.error : 'Réponse inattendue');
      return { end: response.end, rngState: response.rngState };
    } catch (error) {
      console.warn('[Serveur] fin de tour du robot sur place :', error instanceof Error ? error.message : error);
      return computeEndTurn(game);
    }
  }

  /** Demandes en cours (tous fils confondus) */
  get busy(): number {
    return this.workers.reduce((sum, w) => sum + w.pending.size, 0);
  }

  async close(): Promise<void> {
    this.closed = true;
    await Promise.all(this.workers.map(w => w.worker.terminate()));
  }
}
