import React from 'react';
import './CardBack.css';

/** Dos d'une carte (main d'un autre joueur, carte masquée) : même gabarit que les cartes de la main */
export const CardBack: React.FC<{ onMouseEnter?: (e: React.MouseEvent) => void; onMouseLeave?: () => void }> = ({ onMouseEnter, onMouseLeave }) => (
  <div className="seti-common-card seti-card-back" aria-label="Carte masquée" onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
    <div className="seti-card-back-rings" aria-hidden="true" />
    <img className="seti-card-back-logo" src="logo-seti.png" alt="" draggable={false} />
  </div>
);
