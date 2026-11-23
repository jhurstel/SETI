import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChoiceFooterButton } from './ChoiceModal';
import './HandModal.css';

/**
 * Main en grand : les cartes de la main du plateau joueur (mêmes composants, mêmes boutons et infobulles), dans une fenêtre
 * qui se ferme par son bouton, par Échap ou par un clic hors de la fenêtre. Rendue dans le corps de la page : le plateau
 * joueur (flou d'arrière-plan) servirait sinon de cadre à la fenêtre.
 */
export const HandModal: React.FC<{
  title: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
}> = ({ title, onClose, children }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return createPortal(
    <div className="seti-modal-overlay" onClick={onClose}>
      <div className="seti-choice-modal wide seti-hand-modal" role="dialog" aria-label="Main en grand" onClick={e => e.stopPropagation()}>
        <div className="seti-choice-modal-title">{title}</div>
        <div className="seti-hand-modal-cards">{children}</div>
        <div className="seti-choice-modal-footer">
          <ChoiceFooterButton secondary onClick={onClose}>Fermer</ChoiceFooterButton>
        </div>
      </div>
    </div>,
    document.body
  );
};
