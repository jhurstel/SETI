import React, { useState } from 'react';
import { Tooltip } from '../Tooltip';
import { useCloseTooltipOnClick } from '../hooks/useCloseTooltipOnClick';

/**
 * Affiche une infobulle du jeu (même aspect que les autres) au survol de son contenu,
 * à la place de l'attribut HTML `title` et de l'infobulle native du navigateur.
 */
export const HoverTooltip = ({ content, children, className, style, nested = false }: {
  content: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  /** Dans une autre infobulle : collée à son élément, sans s'écarter des infobulles ouvertes */
  nested?: boolean;
}) => {
  const [rect, setRect] = useState<DOMRect | null>(null);
  useCloseTooltipOnClick(() => setRect(null));
  return (
    <span
      className={className}
      style={{ display: 'inline-flex', ...style }}
      onMouseEnter={e => setRect(e.currentTarget.getBoundingClientRect())}
      onMouseLeave={() => setRect(null)}
    >
      {children}
      {/* Texte seul (libellé d'un symbole) : infobulle à la taille du texte, centrée */}
      {rect && content && <Tooltip content={typeof content === 'string' ? <div className="seti-tooltip-label">{content}</div> : content} targetRect={rect} disableCollision={nested} />}
    </span>
  );
};
