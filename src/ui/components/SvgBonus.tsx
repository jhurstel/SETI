import React from 'react';
import { Bonus } from '../../core/types';

export const SvgBonus: React.FC<{ bonus: Bonus }> = ({ bonus }) => {
  if (!bonus) return null;
  const hasPv = !!bonus.pv;
  return (
    <>
      {hasPv && (
        <text
          x="0"
          y="1"
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#fff"
          fontSize="10"
          fontWeight="bold"
        >
          {bonus.pv}
        </text>
      )}
    </>
  );
};
