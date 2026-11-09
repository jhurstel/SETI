import { useSyncExternalStore } from 'react';
import type { ActiveTooltip } from './hooks/useInteractiveTooltip';

/*
 * Infobulle active de l'écran de jeu, hors de l'état de BoardUI : un survol ne redessine que TooltipLayer,
 * pas tout le plateau (avant : un rendu complet par infobulle ouverte ou fermée, système solaire compris).
 * `setActiveTooltip` est stable : les composants le reçoivent comme avant (prop setActiveTooltip).
 */

let current: ActiveTooltip | null = null;
const listeners = new Set<() => void>();

export function setActiveTooltip(tooltip: ActiveTooltip | null): void {
  if (tooltip === current) return;
  current = tooltip;
  listeners.forEach(listener => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

const snapshot = () => current;

/** Infobulle active (null : aucune), relue à chaque changement */
export function useActiveTooltip(): ActiveTooltip | null {
  return useSyncExternalStore(subscribe, snapshot);
}
