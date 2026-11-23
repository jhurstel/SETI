import { useEffect, useRef } from 'react';

/*
 * Écran tactile : un appui simule le survol (l'infobulle s'ouvre) puis le clic, qui la refermait aussitôt.
 * Les éléments marqués `data-tap-tooltip` (cartes, planètes, objets du système solaire) gardent leur infobulle
 * ouverte après un appui ; l'appui suivant ailleurs la referme.
 */
let lastPointerType = 'mouse';
if (typeof document !== 'undefined') {
  document.addEventListener('pointerdown', (e: PointerEvent) => { lastPointerType = e.pointerType; }, true);
}

/** Le clic vient d'un appui tactile sur un élément dont l'infobulle doit rester ouverte */
function keepsTooltipOpen(e: MouseEvent): boolean {
  if (lastPointerType !== 'touch' && lastPointerType !== 'pen') return false;
  const target = e.target as Element | null;
  return !!target?.closest?.('[data-tap-tooltip]');
}

/**
 * Ferme une infobulle au clic. Une infobulle ne se ferme d'habitude qu'en quittant son élément, ce qui n'arrive
 * jamais quand le clic le fait disparaître ou le déplace (carte jouée ou sélectionnée, sonde posée sur une planète).
 * Le clic est traité d'abord par l'élément cliqué, puis l'infobulle se ferme (sauf appui tactile sur un élément
 * `data-tap-tooltip`).
 */
export function useCloseTooltipOnClick(close: () => void) {
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    const handleClick = (e: MouseEvent) => { if (!keepsTooltipOpen(e)) closeRef.current(); };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);
}
