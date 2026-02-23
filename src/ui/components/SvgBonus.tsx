import React from 'react';
import { Bonus } from '../../core/types';

export const SvgBonus: React.FC<{ bonus: Bonus }> = ({ bonus }) => {
  if (!bonus) return null;

  const hasPv = !!bonus.pv;
  const hasOther =
    bonus.media ||
    bonus.credits ||
    bonus.energy ||
    bonus.card ||
    bonus.data ||
    bonus.signals ||
    bonus.revenue ||
    bonus.anycard ||
    bonus.technologies ||
    bonus.lifetraces ||
    bonus.probe ||
    bonus.landing ||
    bonus.speciesCard;

  return (
    <>
      {hasPv && (
        <text
          y={hasOther ? "-5" : "1"}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#fff"
          fontSize="10"
          fontWeight="bold"
        >
          {bonus.pv}
        </text>
      )}
      {hasOther && (() => {
        let label = '';
        let color = '#fff';
        if (bonus.media) { label = 'M'; color = '#ff6b6b'; }
        else if (bonus.credits) { label = 'C'; color = '#ffd700'; }
        else if (bonus.energy) { label = 'E'; color = '#4caf50'; }
        else if (bonus.card) { label = '🃏'; color = '#aaffaa'; }
        else if (bonus.data) { label = 'D'; color = '#8affc0'; }
        else if (bonus.signals && bonus.signals.length > 0) { label = 'S'; color = '#fff'; }
        else if (bonus.revenue) { label = 'R'; color = '#fff'; }
        else if (bonus.anycard) { label = '🃏'; color = '#fff'; }
        else if (bonus.technologies && bonus.technologies.length > 0) { label = 'T'; color = '#fff'; }
        else if (bonus.lifetraces && bonus.lifetraces.length > 0) { label = 'Tr'; color = '#fff'; }
        else if (bonus.probe) { label = 'Pr'; color = '#fff'; }
        else if (bonus.landing) { label = 'La'; color = '#fff'; }
        else if (bonus.speciesCard) { label = '👽'; color = '#aaffaa'; }
        return (
          <text
            y={hasPv ? "6" : "1"}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={color}
            fontSize="10"
            fontWeight="bold"
          >
            {label}
          </text>
        );
      })()}
    </>
  );
};
