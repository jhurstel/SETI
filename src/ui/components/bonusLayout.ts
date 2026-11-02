import { Bonus } from '../../core/types';

/** Le gain a autre chose que des PV (les PV sont dessinés dans la case) */
export const hasExtraGains = (bonus?: Bonus): boolean =>
  !!bonus && Object.entries(bonus).some(([key, value]) => key !== 'pv' && value !== undefined && value !== 0 && !(Array.isArray(value) && value.length === 0));

/** Position (x, y) à `distance` du centre, selon un angle compté depuis le haut dans le sens horaire (135° : en bas à droite) */
export const atAngle = (distance: number, angle: number) => {
  const rad = (angle * Math.PI) / 180;
  return { x: Math.sin(rad) * distance, y: -Math.cos(rad) * distance };
};
