import { useEffect, useRef } from 'react';

/**
 * Ferme une infobulle au clic. Une infobulle ne se ferme d'habitude qu'en quittant son élément, ce qui n'arrive
 * jamais quand le clic le fait disparaître ou le déplace (carte jouée ou sélectionnée, sonde posée sur une planète).
 * Le clic est traité d'abord par l'élément cliqué, puis l'infobulle se ferme.
 */
export function useCloseTooltipOnClick(close: () => void) {
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    const handleClick = () => closeRef.current();
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);
}
