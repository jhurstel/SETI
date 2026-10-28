import { RefObject, useEffect } from 'react';

/**
 * Ferme un panneau ouvert quand on clique en dehors (les infobulles, affichées hors du panneau, ne comptent pas).
 * Désactivé quand le jeu force le panneau ouvert (ex : technologie à choisir, trace de vie à placer).
 */
export function useCloseOnOutsideClick(ref: RefObject<HTMLElement | null>, isOpen: boolean, close: () => void, enabled: boolean = true) {
  useEffect(() => {
    if (!isOpen || !enabled) return;
    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Element | null;
      if (!target || ref.current?.contains(target) || target.closest('.seti-tooltip')) return;
      close();
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [ref, isOpen, close, enabled]);
}
