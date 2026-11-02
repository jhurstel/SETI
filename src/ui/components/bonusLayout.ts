import { Bonus } from '../../core/types';

/** Le gain a autre chose que des PV (les PV sont dessinés dans la case) */
export const hasExtraGains = (bonus?: Bonus): boolean =>
  !!bonus && Object.entries(bonus).some(([key, value]) => key !== 'pv' && value !== undefined && value !== 0 && !(Array.isArray(value) && value.length === 0));

/** Position (x, y) à `distance` du centre, selon un angle compté depuis le haut dans le sens horaire (135° : en bas à droite) */
export const atAngle = (distance: number, angle: number) => {
  const rad = (angle * Math.PI) / 180;
  return { x: Math.sin(rad) * distance, y: -Math.cos(rad) * distance };
};

/** Le gain est vide (aucune clé renseignée) */
export const isEmptyBonus = (bonus?: Bonus): boolean =>
  !bonus || Object.values(bonus).every(value => value === undefined || value === 0 || (Array.isArray(value) && value.length === 0));

/**
 * Cases d'une piste (orbiteurs, atterrisseurs) : `common` réunit ce que toutes les cases donnent (affiché une seule
 * fois, comme sur le plateau du livret), `specific[i]` ce qui est propre à la case i. Pour une quantité, la part
 * commune est le minimum de toutes les cases et chaque case garde son surplus (Neptune : 7 PV communs, 3 PV de plus
 * pour le premier orbiteur ; Mars : 2 puis 1 donnée pour les premiers atterrisseurs). Une piste d'une case n'a rien de commun.
 */
export function splitSlotBonuses(slots: Bonus[]): { common: Bonus; specific: Bonus[] } {
  if (slots.length < 2) return { common: {}, specific: slots };
  const records = slots.map(slot => (slot || {}) as Record<string, unknown>);
  const keys = new Set(records.flatMap(slot => Object.keys(slot)));
  const common: Record<string, unknown> = {};
  keys.forEach(key => {
    const values = records.map(slot => slot[key]);
    if (values.every(value => typeof value === 'number')) {
      const min = Math.min(...(values as number[]));
      if (min > 0) common[key] = min;
    } else if (values[0] !== undefined && values.every(value => JSON.stringify(value) === JSON.stringify(values[0]))) {
      common[key] = values[0];
    }
  });
  const specific = records.map(slot => {
    const own: Record<string, unknown> = {};
    Object.entries(slot).forEach(([key, value]) => {
      if (typeof value === 'number' && typeof common[key] === 'number') {
        const rest = value - (common[key] as number);
        if (rest > 0) own[key] = rest;
      } else if (!(key in common)) {
        own[key] = value;
      }
    });
    return own as Bonus;
  });
  return { common: common as Bonus, specific };
}
