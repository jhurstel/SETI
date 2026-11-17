import { AlienBoardType, Card, CardType } from '../core/types';

/** Premier numéro des cartes de chaque espèce (ET.1 à ET.10 : Mascamites…, public/cards/<espèce>.csv) */
const SPECIES_CARD_RANGES: [number, AlienBoardType][] = [
  [41, AlienBoardType.EXERTIENS],
  [31, AlienBoardType.CENTAURIENS],
  [21, AlienBoardType.OUMUAMUA],
  [11, AlienBoardType.ANOMALIES],
  [1, AlienBoardType.MASCAMITES],
];

/**
 * Espèce d'une carte Alien d'après son numéro (ET.n), ou son type pour une carte Exertien cachée (vue d'un adversaire
 * en ligne) ; aucune pour une carte de la pioche principale ou une carte cachée quelconque
 */
export function cardSpecies(card: Pick<Card, 'id' | 'type'>): AlienBoardType | undefined {
  if (card.type === CardType.EXERTIEN) return AlienBoardType.EXERTIENS;
  const match = /^ET\.(\d+)$/.exec(card.id);
  if (!match) return undefined;
  const number = Number(match[1]);
  return SPECIES_CARD_RANGES.find(([first]) => number >= first)?.[1];
}
