import { Bonus, FreeActionType, RevenueType } from '../../core/types';
import { CardSystem } from '../../systems/CardSystem';

/** Gain de l'action gratuite d'une carte, sous forme de bonus (pour l'afficher avec les icônes du livret) */
export const freeActionBonus = (freeAction: FreeActionType | undefined): Bonus | null =>
  (freeAction && CardSystem.freeActionGain(freeAction)) || null;

/** Revenu d'une carte réservée, sous forme de bonus */
export const revenueBonus = (revenue: RevenueType | undefined): Bonus | null => {
  switch (revenue) {
    case RevenueType.CREDIT: return { credits: 1 };
    case RevenueType.ENERGY: return { energy: 1 };
    case RevenueType.CARD: return { card: 1 }; // carte piochée (pas de choix dans la rangée)
    case RevenueType.DATA: return { data: 1 };
    case RevenueType.MEDIA: return { media: 1 };
    default: return null;
  }
};
