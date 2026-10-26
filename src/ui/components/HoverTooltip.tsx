import React, { useState } from 'react';
import { Tooltip } from '../Tooltip';

/**
 * Affiche une infobulle du jeu (même aspect que les autres) au survol de son contenu,
 * à la place de l'attribut HTML `title` et de l'infobulle native du navigateur.
 */
export const HoverTooltip = ({ content, children, className, style }: {
  content: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) => {
  const [rect, setRect] = useState<DOMRect | null>(null);
  return (
    <span
      className={className}
      style={{ display: 'inline-flex', ...style }}
      onMouseEnter={e => setRect(e.currentTarget.getBoundingClientRect())}
      onMouseLeave={() => setRect(null)}
    >
      {children}
      {rect && content && <Tooltip content={content} targetRect={rect} />}
    </span>
  );
};
