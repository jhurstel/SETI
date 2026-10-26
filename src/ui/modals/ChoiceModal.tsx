import React, { useState } from 'react';
import { HoverTooltip } from '../components/HoverTooltip';

/**
 * Fenêtre de choix commune (fin de manche, réservation, messages Centauriens, paliers Exertiens, bonus…) :
 * titre, explication, options, et bouton « Voir le plateau » pour masquer la fenêtre le temps de regarder le jeu.
 */
export const ChoiceModal = ({ title, subtitle, children, footer, wide = false }: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Fenêtre large (choix de cartes) */
  wide?: boolean;
}) => {
  const [minimized, setMinimized] = useState(false);
  return (
    <>
      <button className={`seti-minimize-modal-btn ${minimized ? 'minimized' : ''}`} onClick={() => setMinimized(!minimized)}>
        {minimized ? 'Revenir au choix' : 'Voir le plateau'}
      </button>
      {!minimized && (
        <div className="seti-modal-overlay">
          <div className={`seti-choice-modal ${wide ? 'wide' : ''}`}>
            <div className="seti-choice-modal-title">{title}</div>
            {subtitle && <div className="seti-choice-modal-subtitle">{subtitle}</div>}
            <div className="seti-choice-modal-options">{children}</div>
            {footer && <div className="seti-choice-modal-footer">{footer}</div>}
          </div>
        </div>
      )}
    </>
  );
};

/**
 * Une option d'une fenêtre de choix. Indisponible, elle est grisée et son infobulle explique pourquoi
 * (ex : « Déjà choisi par R2-D2 »).
 */
export const ChoiceOption = ({ icon, label, detail, onClick, disabled = false, disabledReason, selected = false, done = false }: {
  icon?: React.ReactNode;
  label: React.ReactNode;
  detail?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  disabledReason?: React.ReactNode;
  selected?: boolean;
  done?: boolean;
}) => {
  const button = (
    <button
      className={`seti-choice-option ${selected ? 'selected' : ''} ${done ? 'done' : ''}`}
      onClick={onClick}
      disabled={disabled || done}
    >
      {icon && <span className="seti-choice-option-icon">{icon}</span>}
      <span className="seti-choice-option-label">{label}</span>
      {detail && <span className="seti-choice-option-detail">{detail}</span>}
      {done && <span className="seti-choice-option-check">✓</span>}
    </button>
  );
  return disabled && disabledReason ? <HoverTooltip content={disabledReason}>{button}</HoverTooltip> : button;
};

/** Bouton d'action en pied de fenêtre (confirmer, passer, terminer…) */
export const ChoiceFooterButton = ({ children, onClick, disabled = false, secondary = false }: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  secondary?: boolean;
}) => (
  <button className={`seti-choice-footer-btn ${secondary ? 'secondary' : ''}`} onClick={onClick} disabled={disabled}>
    {children}
  </button>
);
