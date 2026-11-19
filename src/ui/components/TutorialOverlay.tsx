import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { renderMarkdown } from './markdown';
import type { TutorialStepText } from '../../tutorial/tutorialText';
import './TutorialOverlay.css';

interface TutorialOverlayProps {
  chapterTitle: string;
  /** Texte de l'étape (absent : textes pas encore chargés) */
  text?: TutorialStepText;
  stepNumber: number;
  stepCount: number;
  /** Valeur de data-tutorial des éléments mis en avant */
  target?: string;
  /** Étape d'explication : bouton « Suivant » ; sinon le joueur agit */
  isExplanation: boolean;
  finished: boolean;
  hasDocLink: boolean;
  nextChapterTitle?: string;
  /** Libellés des boutons (conseils en partie : « Compris », « Ne plus afficher ») */
  nextLabel?: string;
  quitLabel?: string;
  /** Sans numéro d'étape (conseil en partie) */
  hideCount?: boolean;
  /** Au-dessus des fenêtres (écran de fin de partie, étape affichée pendant une fenêtre de choix) */
  aboveModals?: boolean;
  onNext: () => void;
  onDocLink: () => void;
  onQuit: () => void;
  onNextChapter: () => void;
  onMenu: () => void;
}

interface Rect { top: number; left: number; width: number; height: number }

const BUBBLE_WIDTH = 340;
const MARGIN = 14;

/** Rectangle englobant les éléments ciblés, ou null s'ils ne sont pas à l'écran */
function targetRect(target?: string): Rect | null {
  if (!target) return null;
  const rects = [...document.querySelectorAll(`[data-tutorial="${target}"]`)]
    .map(el => el.getBoundingClientRect())
    .filter(r => r.width > 0 && r.height > 0);
  if (rects.length === 0) return null;
  const top = Math.min(...rects.map(r => r.top));
  const left = Math.min(...rects.map(r => r.left));
  return { top, left, width: Math.max(...rects.map(r => r.right)) - left, height: Math.max(...rects.map(r => r.bottom)) - top };
}

/** Place la bulle du côté de la cible qui a le plus de place, dans l'écran */
function bubblePosition(rect: Rect | null, bubbleHeight: number): React.CSSProperties {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (!rect) return { left: Math.max(MARGIN, (vw - BUBBLE_WIDTH) / 2), bottom: 32 };
  const clampTop = (top: number) => Math.min(Math.max(MARGIN, top), vh - bubbleHeight - MARGIN);
  const clampLeft = (left: number) => Math.min(Math.max(MARGIN, left), vw - BUBBLE_WIDTH - MARGIN);
  const space = {
    right: vw - (rect.left + rect.width),
    left: rect.left,
    below: vh - (rect.top + rect.height),
    above: rect.top,
  };
  // Zone du plateau joueur (à gauche) : bulle dessous, sur ce plateau, pour laisser le système solaire visible
  if (rect.left + rect.width < vw / 2 && space.below >= bubbleHeight + 2 * MARGIN) {
    return { left: clampLeft(rect.left), top: rect.top + rect.height + MARGIN };
  }
  if (space.right >= BUBBLE_WIDTH + 2 * MARGIN) return { left: rect.left + rect.width + MARGIN, top: clampTop(rect.top) };
  if (space.left >= BUBBLE_WIDTH + 2 * MARGIN) return { left: rect.left - BUBBLE_WIDTH - MARGIN, top: clampTop(rect.top) };
  if (space.below >= bubbleHeight + 2 * MARGIN) return { left: clampLeft(rect.left), top: rect.top + rect.height + MARGIN };
  if (space.above >= bubbleHeight + 2 * MARGIN) return { left: clampLeft(rect.left), top: rect.top - bubbleHeight - MARGIN };
  // Cible très grande (système solaire) : bulle dans un coin bas, par-dessus
  return { left: clampLeft(rect.left + rect.width - BUBBLE_WIDTH - MARGIN), top: clampTop(rect.top + rect.height - bubbleHeight - MARGIN) };
}

/**
 * Bulle du tutoriel : texte de l'étape près de l'élément décrit, entouré d'une surbrillance. La surbrillance ne capte
 * aucun clic : le plateau reste jouable. La position suit la cible (redimensionnement, panneaux qui s'ouvrent).
 */
export const TutorialOverlay: React.FC<TutorialOverlayProps> = props => {
  const { text, target, finished } = props;
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [bubbleHeight, setBubbleHeight] = useState(180);

  useEffect(() => {
    const update = () => {
      const next = finished ? null : targetRect(target);
      setRect(current => (JSON.stringify(current) === JSON.stringify(next) ? current : next));
    };
    update();
    const timer = window.setInterval(update, 400);
    window.addEventListener('resize', update);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('resize', update);
    };
  }, [target, finished]);

  // Zone décrite amenée à l'écran (la main ou les missions sont en bas du plateau joueur, qui défile)
  useEffect(() => {
    if (!target || finished) return;
    const element = document.querySelector(`[data-tutorial="${target}"]`);
    element?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }, [target, finished]);

  // Hauteur de la bulle (pour la placer au-dessus d'une cible) : mesurée à chaque changement de contenu
  useLayoutEffect(() => {
    const height = bubbleRef.current?.offsetHeight;
    if (height) setBubbleHeight(height);
  }, [text, finished, props.stepNumber]);

  const body = useMemo(() => (text?.body ? renderMarkdown(text.body).html : ''), [text]);

  return (
    <>
      {rect && (
        <div className="seti-tutorial-highlight" aria-hidden="true"
          style={{ top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12 }} />
      )}
      <div ref={bubbleRef} className={`seti-tutorial-bubble${props.aboveModals ? ' above-modals' : ''}`} role="dialog" aria-label="Tutoriel" style={bubblePosition(rect, bubbleHeight)}>
        <div className="seti-tutorial-header">
          <span className="seti-tutorial-chapter">{props.chapterTitle}</span>
          {!finished && !props.hideCount && <span className="seti-tutorial-count">{props.stepNumber} / {props.stepCount}</span>}
        </div>
        {finished ? (
          <>
            <div className="seti-tutorial-title">Chapitre terminé !</div>
            <p className="seti-tutorial-body">Bravo, vous avez terminé ce chapitre.</p>
            <div className="seti-tutorial-buttons">
              {props.nextChapterTitle && <button className="seti-modal-btn primary" onClick={props.onNextChapter}>Chapitre suivant : {props.nextChapterTitle}</button>}
              <button className="seti-modal-btn secondary" onClick={props.onMenu}>Menu des chapitres</button>
              <button className="seti-modal-btn secondary seti-tutorial-quit" onClick={props.onQuit}>Fermer</button>
            </div>
          </>
        ) : (
          <>
            <div className="seti-tutorial-title">{text?.title ?? '…'}</div>
            <div className="seti-tutorial-body" dangerouslySetInnerHTML={{ __html: body }} />
            {!props.isExplanation && <div className="seti-tutorial-hint">À vous de jouer</div>}
            <div className="seti-tutorial-buttons">
              {props.isExplanation && <button className="seti-modal-btn primary" onClick={props.onNext}>{props.nextLabel ?? 'Suivant'}</button>}
              {props.hasDocLink && <button className="seti-modal-btn secondary" onClick={props.onDocLink}>En savoir plus</button>}
              <button className="seti-modal-btn secondary seti-tutorial-quit" onClick={props.onQuit}>{props.quitLabel ?? 'Quitter'}</button>
            </div>
          </>
        )}
      </div>
    </>
  );
};
