import React, { useCallback, useEffect, useRef } from 'react';

/** Infobulle du jeu telle que la reçoit BoardUI (setActiveTooltip) */
export type ActiveTooltip = { content: React.ReactNode, rect: DOMRect, pointerEvents?: 'none' | 'auto', onMouseEnter?: () => void, onMouseLeave?: () => void };

/**
 * Infobulle où la souris peut entrer (elle reste ouverte) : pour survoler les symboles d'une carte ou cliquer une action.
 * `show` l'ouvre sur l'élément survolé, `scheduleClose` la ferme après un court délai (annulé si la souris y entre).
 */
export const useInteractiveTooltip = (setActiveTooltip: (tooltip: ActiveTooltip | null) => void) => {
  const closeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelClose = useCallback(() => {
    if (closeRef.current) clearTimeout(closeRef.current);
    closeRef.current = null;
  }, []);
  const scheduleClose = useCallback(() => {
    cancelClose();
    closeRef.current = setTimeout(() => setActiveTooltip(null), 250);
  }, [cancelClose, setActiveTooltip]);
  useEffect(() => cancelClose, [cancelClose]);
  const show = useCallback((e: React.MouseEvent, content: React.ReactNode) => {
    cancelClose();
    setActiveTooltip({ content, rect: e.currentTarget.getBoundingClientRect(), pointerEvents: 'auto', onMouseEnter: cancelClose, onMouseLeave: scheduleClose });
  }, [cancelClose, scheduleClose, setActiveTooltip]);
  return { show, scheduleClose };
};
