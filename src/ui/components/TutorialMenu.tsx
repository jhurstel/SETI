import React from 'react';
import type { TutorialChapter } from '../../tutorial/types';
import type { TutorialChapterText } from '../../tutorial/tutorialText';
import './TutorialOverlay.css';

interface TutorialMenuProps {
  chapters: TutorialChapter[];
  text: Record<string, TutorialChapterText> | null;
  done: string[];
  onStart: (chapterId: string) => void;
  onClose: () => void;
}

/** Menu des chapitres du tutoriel (accueil) : chapitres terminés cochés, n'importe lequel jouable */
export const TutorialMenu: React.FC<TutorialMenuProps> = ({ chapters, text, done, onStart, onClose }) => (
  <div className="seti-modal-overlay" onClick={onClose}>
    <div className="seti-tutorial-menu" role="dialog" aria-label="Tutoriel" onClick={e => e.stopPropagation()}>
      <h2 className="seti-modal-title">Tutoriel</h2>
      <p>Apprenez SETI pas à pas, sur le vrai plateau. Les chapitres se jouent dans n'importe quel ordre.</p>
      <div className="seti-tutorial-menu-list">
        {chapters.map((chapter, index) => {
          const isDone = done.includes(chapter.id);
          return (
            <button key={chapter.id} className={`seti-tutorial-menu-item ${isDone ? 'done' : ''}`} onClick={() => onStart(chapter.id)}
              aria-label={`${text?.[chapter.id]?.title ?? chapter.id}${isDone ? ' (terminé)' : ''}`}>
              <span className="seti-tutorial-menu-number">{isDone ? '✓' : index + 1}</span>
              <span className="seti-tutorial-menu-text">
                <span className="seti-tutorial-menu-title">{text?.[chapter.id]?.title ?? chapter.id}</span>
                <span className="seti-tutorial-menu-summary">{text?.[chapter.id]?.summary ?? ''}</span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="seti-tutorial-menu-footer">
        <button className="seti-modal-btn secondary" onClick={onClose}>Fermer</button>
      </div>
    </div>
  </div>
);
