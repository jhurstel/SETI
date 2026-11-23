import { useSyncExternalStore } from 'react';

/** Mise en page mobile (téléphone en portrait) : même seuil que les feuilles de style (`max-width: 600px`) */
export const MOBILE_LAYOUT_QUERY = '(max-width: 600px)';

/** Vrai tant que la requête média correspond (suivie au redimensionnement et au changement d'orientation) */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    listener => {
      const list = window.matchMedia?.(query);
      list?.addEventListener('change', listener);
      return () => list?.removeEventListener('change', listener);
    },
    () => window.matchMedia?.(query).matches ?? false,
    () => false,
  );
}
