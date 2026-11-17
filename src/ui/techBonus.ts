import type { Bonus } from '../core/types';

/**
 * La tuile du dessus d'une pile de technologies porte le bonus de 2 PV ajouté à la mise en place (GameFactory) :
 * 3 + 2 PV pour la tuile à 3 PV, sinon 2 PV en plus de son gain (Média, carte au choix ou de la pioche, énergie).
 * Affiché en badge en haut de la tuile, et retiré des gains du bas.
 */
export function hasExtraTechPv(bonus: Bonus): boolean {
  if (bonus.pv === 5) return true;
  return bonus.pv === 2 && !!(bonus.media || bonus.card || bonus.anycard || bonus.energy);
}
