import { parentPort } from 'worker_threads';
import type { AIWorkerRequest } from '../src/ai/aiWorkerProtocol';
import { answerRobotRequest } from '../src/ai/robotCompute';

/**
 * Fil de calcul des robots du serveur (worker_threads, compilé dans server/build/robotWorker.js) : même calcul que
 * le Web Worker du navigateur. Le fil principal reste libre pour le réseau et les autres salles pendant qu'un Expert
 * simule ses actions.
 */
parentPort?.on('message', (request: AIWorkerRequest) => {
  parentPort?.postMessage(answerRobotRequest(request));
});
