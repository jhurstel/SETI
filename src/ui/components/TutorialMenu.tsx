import React, { useEffect } from 'react';
import type { TutorialChapter } from '../../tutorial/types';
import type { TutorialChapterText } from '../../tutorial/tutorialText';
import { isChapterUnlocked } from '../../tutorial/unlock';
import './TutorialOverlay.css';

interface TutorialMenuProps {
  chapters: TutorialChapter[];
  text: Record<string, TutorialChapterText> | null;
  done: string[];
  /** Espèces débloquées (découvertes en partie) : leurs chapitres sont jouables */
  unlockedSpecies?: string[];
  onStart: (chapterId: string) => void;
  onClose: () => void;
}

/**
 * Menu des chapitres du tutoriel (accueil) : chapitres terminés cochés, n'importe lequel jouable, sauf un chapitre
 * d'espèce pas encore rencontrée en partie : verrouillé, sans le nom de l'espèce
 */
export const TutorialMenu: React.FC<TutorialMenuProps> = ({ chapters, text, done, unlockedSpecies = [], onStart, onClose }) => {
  // Bouton Fermer (comme la documentation), Échap ou un clic hors de la fenêtre ramènent à l'accueil
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="seti-modal-overlay seti-modal-overlay--tutorial" onClick={onClose}>
      <div className="seti-tutorial-menu" role="dialog" aria-label="Tutoriel" onClick={e => e.stopPropagation()}>
        {/* Titre et explication en petit dessous : la place reste aux chapitres */}
        <div className="seti-tutorial-menu-header">
          <button type="button" onClick={onClose} className="seti-tutorial-menu-close" aria-label="Fermer">✕</button>
          <h2 className="seti-modal-title">Tutoriel</h2>
          <p className="seti-tutorial-menu-intro">Apprenez SETI pas à pas, sur le vrai plateau, dans l'ordre de votre choix.</p>
        </div>
        <div className="seti-tutorial-menu-list">
          {chapters.map((chapter, index) => {
            const isDone = done.includes(chapter.id);
            if (!isChapterUnlocked(chapter, unlockedSpecies)) {
              return (
                <button key={chapter.id} className="seti-tutorial-menu-item locked" aria-disabled="true" aria-label="Espèce inconnue (chapitre verrouillé)">
                  <span className="seti-tutorial-menu-number" aria-hidden="true">{index + 1}</span>
                  <span className="seti-tutorial-menu-text">
                    <span className="seti-tutorial-menu-title"><span aria-hidden="true">🔒 </span>Espèce inconnue</span>
                    <span className="seti-tutorial-menu-summary">Découvrez-la en partie pour la débloquer.</span>
                  </span>
                </button>
              );
            }
            return (
              <button key={chapter.id} className={`seti-tutorial-menu-item ${isDone ? 'done' : ''}`} onClick={() => onStart(chapter.id)}
                aria-label={`${text?.[chapter.id]?.title ?? chapter.id}${isDone ? ' (terminé)' : ''}`}>
                <span className="seti-tutorial-menu-number">{index + 1}</span>
                <span className="seti-tutorial-menu-text">
                  <span className="seti-tutorial-menu-title">{text?.[chapter.id]?.title ?? chapter.id}{isDone && <span className="seti-tutorial-menu-check" aria-hidden="true"> ✓</span>}</span>
                  <span className="seti-tutorial-menu-summary">{text?.[chapter.id]?.summary ?? ''}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
