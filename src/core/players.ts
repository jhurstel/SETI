import { Game, Player } from './types';

/**
 * Joueur de la partie. Un identifiant inconnu est une erreur de programmation : la session ne transmet que
 * des joueurs de la partie (tour, propriétaire de l'interaction), d'où une exception plutôt qu'un refus.
 */
export function requirePlayer(game: Game, playerId: string): Player {
  const player = game.players.find(p => p.id === playerId);
  if (!player) throw new Error(`Joueur introuvable : ${playerId}`);
  return player;
}
