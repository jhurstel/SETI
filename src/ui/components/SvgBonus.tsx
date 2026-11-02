import React from 'react';
import { Bonus } from '../../core/types';
import { VictoryPointsIcon } from './GameIcons';
import { BonusIcons } from './BonusIcons';
import { atAngle, hasExtraGains } from './bonusLayout';

/** Gain d'un emplacement dessiné dans un SVG (centré sur l'origine, cercle de rayon 10) : laurier PV chiffré */
export const SvgBonus: React.FC<{ bonus: Bonus }> = ({ bonus }) => {
  if (!bonus?.pv) return null;
  return (
    <g transform="translate(-9 -9)" style={{ pointerEvents: 'none' }}>
      <VictoryPointsIcon amount={bonus.pv} size={18} />
    </g>
  );
};

/**
 * Gains d'un emplacement autres que les PV (données, traces de vie, réservations…), posés à côté de la case
 * comme sur le plateau du livret : à 135° (en bas à droite), contre le bord de la case de rayon `radius` (unités SVG = px).
 */
export const SvgExtraGains: React.FC<{ bonus: Bonus; radius: number; size?: number; angle?: number }> = ({ bonus, radius, size = 12, angle = 135 }) => {
  if (!hasExtraGains(bonus)) return null;
  const { x, y } = atAngle(radius + 1, angle);
  return (
    <foreignObject x={x - 6} y={y - 6} width={120} height={size + 10} style={{ overflow: 'visible', pointerEvents: 'none' }}>
      <div className="seti-slot-gains">
        <BonusIcons bonus={{ ...bonus, pv: undefined }} size={size} empty={null} />
      </div>
    </foreignObject>
  );
};
