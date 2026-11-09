/// <reference lib="webworker" />
import type { AIWorkerRequest } from './aiWorkerProtocol';
import { answerRobotRequest } from './robotCompute';
import { setTraceLevel } from '../core/trace';

/** Injecté par Vite : vrai en développement (traces des robots affichées) */
declare const __DEBUG_TOOLS__: boolean | undefined;
if (typeof __DEBUG_TOOLS__ === 'boolean' && __DEBUG_TOOLS__) setTraceLevel('info');

/**
 * Web Worker des robots : calcule une étape (AITurn.playStep) ou une fin de tour (AITurn.endTurn)
 * hors du fil principal, pour que l'interface reste fluide pendant les simulations des robots
 * (jusqu'à plusieurs centaines de millisecondes par étape pour un Expert).
 * L'état du générateur aléatoire fait l'aller-retour avec la partie (robotCompute) : les tirages restent ceux
 * qu'aurait faits le fil principal.
 */
const worker = self as unknown as DedicatedWorkerGlobalScope;

worker.onmessage = (event: MessageEvent<AIWorkerRequest>) => {
  worker.postMessage(answerRobotRequest(event.data));
};
