import React from 'react';

/**
 * Emplacement d'une tuile Technologie sur une piste du plateau joueur (ordinateur, observation).
 * Toutes les tuiles ont la même taille : le cadre aussi, quel que soit son contenu (centré).
 */
export const TechSpot: React.FC<{
  /** Une technologie occupe l'emplacement */
  acquired?: boolean;
  /** L'emplacement peut être choisi (ex : placer une technologie informatique) */
  selectable?: boolean;
  className?: string;
  onClick?: () => void;
  children: React.ReactNode;
}> = ({ acquired, selectable, className, onClick, children }) => (
  <div
    className={`seti-tech-spot ${acquired ? 'acquired' : ''} ${selectable ? 'selectable' : ''} ${className ?? ''}`}
    onClick={onClick}
  >
    {children}
  </div>
);
