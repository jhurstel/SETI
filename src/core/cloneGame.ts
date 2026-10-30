import { Game } from './types';

/**
 * Copie profonde d'une partie, à utiliser avant toute modification d'état dans le moteur.
 */
export function cloneGame(game: Game): Game {
  return structuredClone(game);
}
