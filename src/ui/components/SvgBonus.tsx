import React from 'react';
import { Bonus } from '../../core/types';
import { VictoryPointsIcon } from './GameIcons';
import { BonusIcons } from './BonusIcons';
import { atAngle, hasExtraGains, isEmptyBonus } from './bonusLayout';

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
export const SvgExtraGains: React.FC<{ bonus: Bonus; radius: number; size?: number; angle?: number; withPv?: boolean }> = ({ bonus, radius, size = 12, angle = 135, withPv = false }) => {
  if (withPv ? isEmptyBonus(bonus) : !hasExtraGains(bonus)) return null;
  const { x, y } = atAngle(radius + 1, angle);
  return (
    <foreignObject x={x - 6} y={y - 6} width={160} height={size + 12} style={{ overflow: 'visible', pointerEvents: 'none' }}>
      <div className="seti-slot-gains">
        <BonusIcons bonus={withPv ? bonus : { ...bonus, pv: undefined }} size={size} empty={null} />
      </div>
    </foreignObject>
  );
};

/**
 * Contenu d'une case (rayon `radius`) : ses PV (laurier) ou, sans PV, ses autres gains (données…) au centre.
 * Avec des PV et d'autres gains, les autres gains vont à côté (SvgExtraGains).
 */
export const SvgSlotBonus: React.FC<{ bonus: Bonus; radius: number }> = ({ bonus, radius }) => {
  if (isEmptyBonus(bonus)) return null;
  if (bonus.pv) {
    return (
      <>
        <SvgBonus bonus={bonus} />
        <SvgExtraGains bonus={bonus} radius={radius} />
      </>
    );
  }
  const box = radius * 2;
  return (
    <foreignObject x={-radius} y={-radius} width={box} height={box} style={{ overflow: 'visible', pointerEvents: 'none' }}>
      <div className="seti-slot-inner-gains">
        <BonusIcons bonus={bonus} size={Math.round(radius * 0.8)} empty={null} />
      </div>
    </foreignObject>
  );
};
