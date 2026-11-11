import { Card, CardType, Game } from '../core/types';
import { cloneGame } from '../core/cloneGame';
import { random } from '../core/random';

/**
 * Partie vue par un joueur, où ce qu'il ne voit pas est redistribué au hasard (déterminisation, pour les
 * simulations des robots) : les cartes de la pioche, des piles de fin de manche et des mains adverses sont
 * mélangées puis redonnées en mêmes nombres. Les cartes Exertiens (hors de la main) ne bougent pas. Le joueur
 * ne garde que ce qu'il sait : sa main, la rangée, les cartes posées. Renvoie une copie ; la partie reçue n'est
 * pas modifiée.
 */
export function determinize(game: Game, viewerId: string): Game {
  const updated = cloneGame(game);
  const hidden = (card: Card) => card.type !== CardType.EXERTIEN;
  const opponents = updated.players.filter(p => p.id !== viewerId);
  const rounds = Object.keys(updated.decks.roundDecks).map(Number);

  const pool: Card[] = [
    ...updated.decks.cards,
    ...rounds.flatMap(round => updated.decks.roundDecks[round]),
    ...opponents.flatMap(p => p.cards.filter(hidden)),
  ];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  let next = 0;
  const deal = (count: number) => pool.slice(next, (next += count));
  opponents.forEach(p => { p.cards = [...p.cards.filter(c => !hidden(c)), ...deal(p.cards.filter(hidden).length)]; });
  rounds.forEach(round => { updated.decks.roundDecks[round] = deal(updated.decks.roundDecks[round].length); });
  updated.decks.cards = pool.slice(next);
  return updated;
}
