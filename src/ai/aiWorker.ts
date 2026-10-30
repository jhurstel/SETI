/// <reference lib="webworker" />
import { AITurn } from './AITurn';
import { getRandomState, setRandomState } from '../core/random';
import type { AIWorkerRequest, AIWorkerResponse } from './aiWorkerProtocol';

/**
 * Web Worker des robots : calcule une étape (AITurn.playStep) ou une fin de tour (AITurn.endTurn)
 * hors du fil principal, pour que l'interface reste fluide pendant les simulations des robots
 * (jusqu'à plusieurs centaines de millisecondes par étape pour un Expert).
 * L'état du générateur aléatoire fait l'aller-retour avec la partie : les tirages restent ceux
 * qu'aurait faits le fil principal.
 */
const worker = self as unknown as DedicatedWorkerGlobalScope;

worker.onmessage = (event: MessageEvent<AIWorkerRequest>) => {
  const { id, kind, game, rngState } = event.data;
  setRandomState(rngState);
  let response: AIWorkerResponse;
  try {
    response = kind === 'playStep'
      ? { id, kind, step: AITurn.playStep(game), rngState: getRandomState() }
      : { id, kind, end: AITurn.endTurn(game), rngState: getRandomState() };
  } catch (error) {
    response = { id, kind, error: error instanceof Error ? error.message : String(error), rngState: getRandomState() };
  }
  worker.postMessage(response);
};
