import { Bonus, CardEffect, EffectAmount } from './types';

/*
 * Accesseurs typés pour CardEffect.value, dont la forme dépend du type d'effet :
 * nombre (le plus courant), chaîne (missions « GAIN_IF_… »), objet quantité + portée, ou gains multiples.
 * Une forme inattendue donne une valeur neutre (0, '', {}) au lieu d'un NaN silencieux.
 */

export function effectNumber(effect: CardEffect): number {
  return typeof effect.value === 'number' ? effect.value : 0;
}

export function effectString(effect: CardEffect): string {
  return typeof effect.value === 'string' ? effect.value : '';
}

export function effectAmount<S>(effect: CardEffect): EffectAmount<S> {
  const value = effect.value;
  if (typeof value === 'object' && value !== null && 'amount' in value) return value as EffectAmount<S>;
  return { amount: typeof value === 'number' ? value : 0, scope: undefined as S };
}

export function effectBonus(effect: CardEffect): Bonus {
  const value = effect.value;
  return typeof value === 'object' && value !== null && !('amount' in value) ? value : {};
}
