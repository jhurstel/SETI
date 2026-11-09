import { Card, CardType, Player } from './types';

/*
 * La main d'un joueur, sans dépendance vers les règles : utilisable par tous les systèmes
 * (CardSystem.getHandCards et CardSystem.isExertienCard y renvoient).
 */

/**
 * Cartes Exertiens : stockées dans player.cards mais elles ne sont pas « en main ».
 * Elles ne comptent pas dans la limite de 4 cartes et ne peuvent être ni défaussées,
 * ni réservées, ni jouées normalement (uniquement via un palier Exertien).
 */
export function isExertienCard(card: Card): boolean {
  return card.type === CardType.EXERTIEN;
}

/** Cartes réellement en main (hors cartes Exertiens). */
export function handCards(player: Player): Card[] {
  return player.cards.filter(card => !isExertienCard(card));
}
