import { Card, CardEffect, CardType, CostType, FreeActionType } from '../core/types';
import { effectAmount, effectNumber } from '../core/cardEffects';
import type { EvaluatorWeights } from './AIEvaluator';

/**
 * Valeur d'une carte en main pour les robots, en PV, à partir de ses usages lus dans le CSV :
 * la jouer (gains convertis avec les poids de l'évaluation, moins son coût) ou la défausser pour son action gratuite.
 * Valeur d'une carte = card + cardQuality × meilleur de ces usages : avec cardQuality = 0, toutes les cartes se valent.
 * Calcul sans simulation, mis en cache par carte et par jeu de poids (les effets des cartes sont figés).
 */
export class CardValue {
  private static cache = new WeakMap<EvaluatorWeights, Map<string, number>>();

  /** Valeur d'une carte en main */
  static of(card: Card, w: EvaluatorWeights): number {
    let byCard = this.cache.get(w);
    if (!byCard) {
      byCard = new Map();
      this.cache.set(w, byCard);
    }
    let value = byCard.get(card.id);
    if (value === undefined) {
      value = w.card + w.cardQuality * Math.max(this.netPlayValue(card, w), this.freeActionValue(card, w));
      byCard.set(card.id, value);
    }
    return value;
  }

  /**
   * Valeur de la main : les cartes les plus utiles d'abord, au plus maxUsefulCards
   * (au-delà, une carte ne vaut plus rien : on ne pourra pas toutes les utiliser)
   */
  static handValue(cards: Card[], w: EvaluatorWeights): number {
    const values = cards.map(card => this.of(card, w)).sort((a, b) => b - a);
    let total = 0;
    values.forEach((value, i) => { total += value * Math.max(0, Math.min(1, w.maxUsefulCards - i)); });
    return total;
  }

  /** Gains de la carte jouée moins son coût */
  static netPlayValue(card: Card, w: EvaluatorWeights): number {
    const cost = card.cost * (card.costType === CostType.ENERGY ? w.energy : w.credit);
    return this.playGain(card, w) - cost;
  }

  /** Gains de la carte jouée : effets immédiats, cercles de mission, carte Fin de partie */
  static playGain(card: Card, w: EvaluatorWeights): number {
    const immediate = card.immediateEffects.reduce((sum, effect) => sum + this.effectValue(effect, w), 0);
    // Chaque cercle de mission (GAIN_ON_…, GAIN_IF_…) ou carte Fin de partie compte comme une mission ouverte
    const circles = new Set([...card.passiveEffects, ...card.permanentEffects]
      .filter(e => /^GAIN_(ON|IF)_/.test(e.type))
      .map(e => `${e.type}:${String(e.target)}:${JSON.stringify(e.value)}`)).size;
    const missions = circles + (card.type === CardType.END_GAME ? 1 : 0);
    return immediate + missions * w.openMission;
  }

  /** Valeur d'un gain immédiat (colonne Gain du CSV) */
  private static effectValue(effect: CardEffect, w: EvaluatorWeights): number {
    // Une sonde lancée : à mi-chemin d'une planète en moyenne
    const probe = w.probeInSystem + Math.max(0, w.probeOnPlanet - w.probeInSystem) / 2;
    switch (effect.target) {
      case 'MEDIA': return effectNumber(effect) * w.media;
      case 'CREDIT': return effectNumber(effect) * w.credit;
      case 'ENERGY': return effectNumber(effect) * w.energy;
      case 'DATA': return effectNumber(effect) * w.data;
      case 'TOKEN': return effectNumber(effect) * w.media;
      case 'PROBE': return effectNumber(effect) * probe;
      case 'CARD':
      case 'ANYCARD': return effectNumber(effect) * w.card;
      case 'MOVEMENT': return effectNumber(effect) * w.probeStep;
      // Un signal marque le secteur et rapporte en général une donnée ; un scan en pose 2
      case 'SIGNAL': return effectAmount(effect).amount * (w.signal + w.data);
      case 'SCAN': return effectNumber(effect) * 2 * (w.signal + w.data);
      // Un atterrissage gratuit transforme une sonde arrivée sur une planète en atterrisseur
      case 'LAND': return effectNumber(effect) * Math.max(0, w.lander - w.probeOnPlanet);
      case 'TECH': return effectAmount(effect).amount * w.technology;
      case 'LIFETRACE': return effectAmount(effect).amount * w.lifeTrace;
      default: return 0;
    }
  }

  /** Valeur de l'action gratuite obtenue en défaussant la carte */
  static freeActionValue(card: Card, w: EvaluatorWeights): number {
    switch (card.freeAction) {
      case FreeActionType.MOVEMENT: return w.probeStep;
      case FreeActionType.DATA: return w.data;
      case FreeActionType.MEDIA: return w.media;
      case FreeActionType.PV_MOVEMENT: return 1 + w.probeStep;
      case FreeActionType.PV_DATA: return 1 + w.data;
      case FreeActionType.TWO_MEDIA: return 2 * w.media;
      default: return 0;
    }
  }
}
