import React from 'react';
import { TechTileIcon } from './GameIcons';

/**
 * Emplacement d'une tuile Technologie sur une piste du plateau joueur (ordinateur, observation).
 * Toutes les tuiles ont la même taille : le cadre aussi, quel que soit son contenu (centré).
 */
export const TechSpot: React.FC<{
  /** Une technologie occupe l'emplacement */
  acquired?: boolean;
  /** L'emplacement peut être choisi (ex : placer une technologie informatique) */
  selectable?: boolean;
  /** Tuile de cette technologie, dessinée en fond (pâle tant qu'elle n'est pas acquise) */
  tile?: string;
  className?: string;
  onClick?: () => void;
  children: React.ReactNode;
}> = ({ acquired, selectable, tile, className, onClick, children }) => (
  <div
    className={`seti-tech-spot ${acquired ? 'acquired' : ''} ${selectable ? 'selectable' : ''} ${className ?? ''}`}
    onClick={onClick}
  >
    {tile && <div className={`seti-tech-spot-tile ${acquired ? 'acquired' : ''}`}><TechTileIcon techId={tile} width={56} height={80} /></div>}
    {children}
  </div>
);
