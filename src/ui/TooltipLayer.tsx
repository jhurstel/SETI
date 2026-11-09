import React from 'react';
import { Tooltip } from './Tooltip';
import { useActiveTooltip } from './tooltipStore';

/** Affiche l'infobulle active de l'écran de jeu (un seul exemplaire, dans BoardUI) : seul ce composant se redessine au survol */
export const TooltipLayer: React.FC = () => {
  const tooltip = useActiveTooltip();
  if (!tooltip) return null;
  return (
    <Tooltip
      content={tooltip.content}
      targetRect={tooltip.rect}
      pointerEvents={tooltip.pointerEvents}
      onMouseEnter={tooltip.onMouseEnter}
      onMouseLeave={tooltip.onMouseLeave}
    />
  );
};
