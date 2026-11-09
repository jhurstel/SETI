import React from 'react';
import './CardBack.css';

// Face d'un dos de carte : ondes radio et logo
const CardBackFace: React.FC = () => (
  <>
    <div className="seti-card-back-rings" aria-hidden="true" />
    <img className="seti-card-back-logo" src="logo-seti.png" alt="" draggable={false} />
  </>
);

/** Dos d'une carte (main d'un autre joueur, carte masquée) : même gabarit que les cartes de la main */
export const CardBack: React.FC<{ className?: string; onMouseEnter?: (e: React.MouseEvent) => void; onMouseLeave?: () => void }> = ({ className = '', onMouseEnter, onMouseLeave }) => (
  <div className={`seti-common-card seti-card-back ${className}`} aria-label="Carte masquée" onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
    <CardBackFace />
  </div>
);

/** Pioche : dos de carte empilés (jusqu'à 3 selon les cartes restantes) et nombre de cartes restantes */
export const DeckPile: React.FC<{
  count: number;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
  onMouseEnter?: (e: React.MouseEvent) => void;
  onMouseLeave?: () => void;
}> = ({ count, className = '', onClick, onMouseEnter, onMouseLeave }) => (
  <div className={`seti-common-card seti-card-back seti-deck-pile stack-${Math.min(Math.max(count - 1, 0), 2)} ${count === 0 ? 'empty' : ''} ${className}`}
    aria-label={`Pioche : ${count} carte(s)`} onClick={onClick} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
    <CardBackFace />
    <span className="seti-deck-pile-count">{count}</span>
  </div>
);
