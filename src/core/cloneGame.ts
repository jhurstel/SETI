import { Game } from './types';

/**
 * Copie profonde d'une partie, à utiliser avant toute modification d'état dans le moteur.
 *
 * Les instantanés de `history` ne sont jamais modifiés après leur création : seul le tableau
 * est copié, ce qui évite de recopier tout l'historique à chaque action.
 */
export function cloneGame(game: Game): Game {
  const { history, ...rest } = game;
  return {
    ...structuredClone(rest),
    history: history ? [...history] : [],
  };
}
