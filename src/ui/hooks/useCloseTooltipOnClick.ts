import { useEffect, useRef } from 'react';

/*
 * Infobulles sur écran tactile (téléphone, tablette). Un appui simule le survol (l'infobulle s'ouvre) puis le clic,
 * qui la refermait aussitôt.
 * - Appui simple sur un élément marqué `data-tap-tooltip` (cartes, planètes, objets du système solaire, ressources) :
 *   l'infobulle reste ouverte ; un nouvel appui sur le même élément la referme, un appui ailleurs aussi.
 * - Appui long sur n'importe quel élément qui a une infobulle : elle s'ouvre (survol simulé) et reste ouverte, sans
 *   déclencher le clic ni le menu du navigateur.
 */
const LONG_PRESS_MS = 450;
const LONG_PRESS_TOLERANCE = 10;

let lastPointerType = 'mouse';
/** Élément `data-tap-tooltip` dont l'infobulle a été gardée ouverte par le dernier appui */
let tapAnchor: Element | null = null;
/** Décision prise pour le clic en cours (une fois pour tous les écouteurs) : garder l'infobulle ouverte */
let decidedClick: Event | null = null;
let keepOnThisClick = false;
/** Appui long en cours ou déclenché : le clic qui le suit éventuellement est ignoré */
let longPressTimer: ReturnType<typeof setTimeout> | null = null;
let longPressStart: { x: number; y: number; target: Element } | null = null;
let longPressFired = false;
let hoveredSincePress = false;

const isTouch = () => lastPointerType === 'touch' || lastPointerType === 'pen';

function cancelLongPress() {
  if (longPressTimer) clearTimeout(longPressTimer);
  longPressTimer = null;
  longPressStart = null;
}

/** Survol simulé de l'élément pressé : ouvre son infobulle (onMouseEnter de React, comme à la souris) */
function simulateHover(target: Element) {
  target.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true, view: window }));
}

if (typeof document !== 'undefined') {
  // Survol (réel ou simulé) depuis le dernier appui : sans lui, l'infobulle de l'élément touché ne s'est pas ouverte
  document.addEventListener('mouseover', () => { hoveredSincePress = true; }, true);

  document.addEventListener('pointerdown', (e: PointerEvent) => {
    lastPointerType = e.pointerType;
    hoveredSincePress = false;
    longPressFired = false;
    cancelLongPress();
    if (!isTouch() || !(e.target instanceof Element)) return;
    // Dans le jeu seulement (pas dans un champ de saisie)
    if (e.target.closest('input, textarea')) return;
    longPressStart = { x: e.clientX, y: e.clientY, target: e.target };
    longPressTimer = setTimeout(() => {
      const start = longPressStart;
      longPressTimer = null;
      if (!start) return;
      longPressFired = true;
      simulateHover(start.target);
      // L'infobulle ouverte ainsi reste ouverte : un nouvel appui sur le même élément la referme
      tapAnchor = start.target.closest('[data-tap-tooltip]') ?? start.target;
    }, LONG_PRESS_MS);
  }, true);

  document.addEventListener('pointermove', (e: PointerEvent) => {
    if (!longPressStart) return;
    if (Math.hypot(e.clientX - longPressStart.x, e.clientY - longPressStart.y) > LONG_PRESS_TOLERANCE) cancelLongPress();
  }, true);
  document.addEventListener('pointerup', cancelLongPress, true);
  document.addEventListener('pointercancel', cancelLongPress, true);

  // Pas de menu du navigateur après un appui long dans le jeu
  document.addEventListener('contextmenu', (e: Event) => {
    if (isTouch() && (longPressFired || longPressTimer)) e.preventDefault();
  }, true);

  // Décision du clic, avant les écouteurs des composants : ignorer le clic d'un appui long, garder ou fermer l'infobulle
  document.addEventListener('click', (e: MouseEvent) => {
    decidedClick = e;
    keepOnThisClick = false;
    if (!isTouch()) { tapAnchor = null; return; }
    if (longPressFired) {
      longPressFired = false;
      keepOnThisClick = true;
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    const target = e.target as Element | null;
    const anchor = target?.closest?.('[data-tap-tooltip]') ?? null;
    if (!anchor) { tapAnchor = null; return; }
    if (anchor === tapAnchor) {
      // Nouvel appui sur l'élément dont l'infobulle est ouverte : elle se ferme
      tapAnchor = null;
      return;
    }
    // Le navigateur ne renvoie pas de survol quand on touche de nouveau l'élément déjà « survolé » (infobulle refermée
    // par l'appui précédent) : on le simule pour la rouvrir
    if (!hoveredSincePress && target) simulateHover(target);
    tapAnchor = anchor;
    keepOnThisClick = true;
  }, true);
}

/** Le clic doit laisser l'infobulle ouverte (appui tactile qui vient de l'ouvrir, ou appui long) */
function keepsTooltipOpen(e: MouseEvent): boolean {
  return e === decidedClick && keepOnThisClick;
}

/**
 * Ferme une infobulle au clic. Une infobulle ne se ferme d'habitude qu'en quittant son élément, ce qui n'arrive
 * jamais quand le clic le fait disparaître ou le déplace (carte jouée ou sélectionnée, sonde posée sur une planète).
 * Le clic est traité d'abord par l'élément cliqué, puis l'infobulle se ferme (sauf sur écran tactile, voir plus haut).
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
