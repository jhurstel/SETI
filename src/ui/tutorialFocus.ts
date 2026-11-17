import { useEffect, useSyncExternalStore } from 'react';
import type { TutorialAction } from '../tutorial/types';

/**
 * Étape du tutoriel vue par les plateaux mémoïsés (comme tooltipStore) : quelles actions principales sont permises
 * (seules celles-là clignotent : la Terre pour un lancement, l'emplacement d'orbite pour une mise en orbite…) et
 * quelle zone est décrite (son panneau s'ouvre, les autres se referment). Hors tutoriel, rien ne change.
 */
export interface TutorialFocus {
  /** Un chapitre est en cours (étape affichée) */
  active: boolean;
  /** Raison pour laquelle l'étape refuse une action (absent : toutes permises) */
  block?: (action: TutorialAction) => string | null;
  /** Valeur de data-tutorial de la zone décrite */
  target?: string;
  /** L'étape se lit pendant le choix en cours : elle peut refermer le panneau que ce choix a ouvert */
  duringChoice?: boolean;
}

const INACTIVE: TutorialFocus = { active: false };
let focus: TutorialFocus = INACTIVE;
const listeners = new Set<() => void>();

export function setTutorialFocus(next: TutorialFocus) {
  if (next.active === focus.active && next.block === focus.block && next.target === focus.target && !!next.duringChoice === !!focus.duringChoice) return;
  focus = next.active ? next : INACTIVE;
  listeners.forEach(listener => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

export function useTutorialFocus(): TutorialFocus {
  return useSyncExternalStore(subscribe, () => focus, () => focus);
}

/** L'action est permise par l'étape en cours (toujours vrai hors tutoriel) */
export const tutorialAllows = (current: TutorialFocus, action: TutorialAction) => !current.block?.(action);

/**
 * Panneau repliable décrit par l'étape : `true` (l'ouvrir et le garder ouvert), `false` (le refermer : une autre
 * zone est décrite), `undefined` (hors tutoriel : le panneau garde son comportement).
 */
export const tutorialPanelOpen = (current: TutorialFocus, target: string): boolean | undefined =>
  current.active ? current.target === target : undefined;

/**
 * Panneau repliable et tutoriel : ouvert quand l'étape le décrit, refermé quand elle en décrit un autre. Comme en
 * partie, un clic ailleurs le referme (sauf dans la bulle). `forced` : un choix en cours a ouvert le panneau (trace
 * de vie à placer, technologie ou carte à choisir) ; le tutoriel ne le referme pas, sauf pendant une étape à lire
 * pendant ce choix (la rotation, avant de choisir la technologie). Renvoie vrai quand l'étape le décrit.
 */
export function useTutorialPanel(target: string, setOpen: (open: boolean) => void, forced = false): boolean {
  const focus = useTutorialFocus();
  const wanted = tutorialPanelOpen(focus, target);
  const keepOpen = forced && !focus.duringChoice;
  // À chaque changement de zone décrite (même si ce panneau reste refermé : un choix a pu l'ouvrir entre-temps)
  useEffect(() => {
    if (wanted === undefined || (!wanted && keepOpen)) return;
    setOpen(wanted);
  }, [wanted, keepOpen, focus.target, setOpen]);
  return wanted === true;
}
