import React from 'react';
import { Bonus } from '../../core/types';
import { VictoryPointsIcon } from './GameIcons';

/** Gain d'un emplacement dessiné dans un SVG (centré sur l'origine, cercle de rayon 10) : laurier PV chiffré */
export const SvgBonus: React.FC<{ bonus: Bonus }> = ({ bonus }) => {
  if (!bonus?.pv) return null;
  return (
    <g transform="translate(-9 -9)" style={{ pointerEvents: 'none' }}>
      <VictoryPointsIcon amount={bonus.pv} size={18} />
    </g>
  );
};
