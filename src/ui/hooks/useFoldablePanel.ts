import { RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { useTutorialPanel } from '../tutorialFocus';
import { useCloseOnOutsideClick } from './useCloseOnOutsideClick';

interface FoldablePanelOptions {
  /** Zone du tutoriel (attribut data-tutorial) : l'étape qui la décrit ouvre le panneau */
  tutorialTarget: string;
  /** Un choix en cours force le panneau ouvert (technologie à choisir, trace de vie à placer…) */
  forcedOpen?: boolean;
  /** Ouvert au premier rendu (par défaut : s'il est forcé) */
  initiallyOpen?: boolean;
  /** Refermer le panneau à la fin du choix qui le forçait (sinon il reste ouvert, à refermer par le joueur) */
  closeWhenReleased?: boolean;
  /** Un clic ailleurs referme le panneau gardé ouvert */
  closeOnOutsideClick?: boolean;
}

/**
 * Panneau repliable (objectifs, technologies, rangée, planètes, plateaux Alien, historique) : un panneau replié
 * s'ouvre en aperçu au survol (CSS) ; un clic sur le bandeau le garde ouvert (classe `open`, flèche inversée), un
 * nouveau clic le replie aussitôt, même sous la souris (classe `no-hover` jusqu'à ce qu'elle sorte du panneau).
 * Un panneau forcé ouvert par un choix en cours ne se replie pas au clic.
 */
export function useFoldablePanel(ref: RefObject<HTMLElement | null>, options: FoldablePanelOptions) {
  const { tutorialTarget, forcedOpen = false, initiallyOpen = forcedOpen, closeWhenReleased = true, closeOnOutsideClick = true } = options;
  const [isOpen, setIsOpen] = useState(initiallyOpen);
  // Replié au clic sous la souris : pas d'aperçu au survol tant qu'elle n'est pas sortie du panneau
  const [noHover, setNoHover] = useState(false);

  // Le choix qui force le panneau l'ouvre, et sa fin le referme (sauf `closeWhenReleased` faux)
  const wasForced = useRef(forcedOpen);
  useEffect(() => {
    if (wasForced.current === forcedOpen) return;
    wasForced.current = forcedOpen;
    if (forcedOpen || closeWhenReleased) setIsOpen(forcedOpen);
  }, [forcedOpen, closeWhenReleased]);

  const tutorialHeld = useTutorialPanel(tutorialTarget, setIsOpen, forcedOpen);
  const close = useCallback(() => setIsOpen(false), []);
  useCloseOnOutsideClick(ref, isOpen, close, closeOnOutsideClick && !forcedOpen);

  const toggle = useCallback(() => {
    if (isOpen && forcedOpen) return;
    if (isOpen) setNoHover(true);
    setIsOpen(!isOpen);
  }, [isOpen, forcedOpen]);
  const onMouseLeave = useCallback(() => setNoHover(false), []);

  return {
    /** Gardé ouvert (clic, choix en cours ou tutoriel) */
    isOpen,
    setIsOpen,
    /** Replié au clic, souris encore sur le panneau : aucun aperçu au survol */
    noHover,
    toggle,
    /** À brancher sur la sortie de la souris du conteneur */
    onMouseLeave,
    /** L'étape du tutoriel décrit ce panneau */
    tutorialHeld,
    /** Classes d'état du conteneur `.seti-foldable-container` */
    stateClass: `${isOpen ? 'open' : 'collapsed'}${noHover ? ' no-hover' : ''}`,
  };
}
