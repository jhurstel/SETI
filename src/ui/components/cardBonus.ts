import { Bonus, FreeActionType, RevenueType } from '../../core/types';

/** Gain de l'action gratuite d'une carte, sous forme de bonus (pour l'afficher avec les icônes du livret) */
export const freeActionBonus = (freeAction: FreeActionType | undefined): Bonus | null => {
  switch (freeAction) {
    case FreeActionType.MOVEMENT: return { movements: 1 };
    case FreeActionType.DATA: return { data: 1 };
    case FreeActionType.MEDIA: return { media: 1 };
    case FreeActionType.PV_MOVEMENT: return { pv: 1, movements: 1 };
    case FreeActionType.PV_DATA: return { pv: 1, data: 1 };
    case FreeActionType.TWO_MEDIA: return { media: 2 };
    default: return null;
  }
};

/** Revenu d'une carte réservée, sous forme de bonus */
export const revenueBonus = (revenue: RevenueType | undefined): Bonus | null => {
  switch (revenue) {
    case RevenueType.CREDIT: return { credits: 1 };
    case RevenueType.ENERGY: return { energy: 1 };
    case RevenueType.CARD: return { anycard: 1 };
    case RevenueType.DATA: return { data: 1 };
    case RevenueType.MEDIA: return { media: 1 };
    default: return null;
  }
};
