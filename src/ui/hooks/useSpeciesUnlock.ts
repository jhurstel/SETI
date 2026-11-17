import { useEffect, useRef } from 'react';
import type { Game } from '../../core/types';
import { discoveredSpecies } from '../../tutorial/unlock';
import { unlockSpecies } from '../tutorialProgress';

/**
 * Déblocage des espèces : toute espèce découverte dans la partie affichée (locale, en ligne ou reprise, quel que soit
 * le joueur qui l'a découverte) est débloquée dans ce navigateur ; `ignored` pour un chapitre du tutoriel, dont les
 * découvertes ne débloquent rien. `onUnlock` reçoit les espèces débloquées pour la première fois.
 */
export function useSpeciesUnlock(game: Game | null, ignored: boolean, onUnlock: (species: string[]) => void): void {
  const onUnlockRef = useRef(onUnlock);
  onUnlockRef.current = onUnlock;
  // Clé stable : l'effet ne repasse que quand l'ensemble des espèces découvertes change
  const key = game && !ignored ? discoveredSpecies(game).join('|') : '';
  useEffect(() => {
    if (!key) return;
    const added = unlockSpecies(key.split('|'));
    if (added.length > 0) onUnlockRef.current(added);
  }, [key]);
}
