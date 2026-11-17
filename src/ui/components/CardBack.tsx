import React from 'react';
import { SpeciesSymbol } from './SpeciesSymbol';
import './CardBack.css';

// Face d'un dos de carte : ondes radio et logo ; carte d'une espèce Alien : son symbole sous le logo
const CardBackFace: React.FC<{ species?: string }> = ({ species }) => (
  <>
    <div className="seti-card-back-rings" aria-hidden="true" />
    <img className="seti-card-back-logo" src="logo-seti.png" alt="" draggable={false} />
    {species && <span className="seti-card-back-species" data-species={species}><SpeciesSymbol species={species} size={22} /></span>}
  </>
);

/**
 * Dos d'une carte (main d'un autre joueur, carte masquée) : même gabarit que les cartes de la main.
 * `species` : carte Alien de cette espèce (symbole de l'espèce) ; à omettre pour une espèce masquée par le tutoriel.
 */
export const CardBack: React.FC<{ className?: string; species?: string; onMouseEnter?: (e: React.MouseEvent) => void; onMouseLeave?: () => void }> = ({ className = '', species, onMouseEnter, onMouseLeave }) => (
  <div className={`seti-common-card seti-card-back ${className}`} aria-label="Carte masquée" onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
    <CardBackFace species={species} />
  </div>
);

/** Pioche : dos de carte empilés (jusqu'à 3 selon les cartes restantes) et nombre de cartes restantes */
export const DeckPile: React.FC<{
  count: number;
  /** Pioche d'une espèce Alien : son symbole sur le dos */
  species?: string;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
  onMouseEnter?: (e: React.MouseEvent) => void;
  onMouseLeave?: () => void;
}> = ({ count, species, className = '', onClick, onMouseEnter, onMouseLeave }) => (
  <div className={`seti-common-card seti-card-back seti-deck-pile stack-${Math.min(Math.max(count - 1, 0), 2)} ${count === 0 ? 'empty' : ''} ${className}`}
    aria-label={`Pioche : ${count} carte(s)`} onClick={onClick} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
    <CardBackFace species={species} />
    <span className="seti-deck-pile-count">{count}</span>
  </div>
);
