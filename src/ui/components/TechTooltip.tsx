import React from 'react';
import type { Technology } from '../../core/types';
import { TECHNOLOGY_STYLES } from '../styles/celestialStyles';
import { BonusIcons } from './BonusIcons';
import '../TechnologyBoardUI.css';

/**
 * Infobulle d'une technologie, la même partout (plateau des technologies, historique) comme CardTooltip pour les
 * cartes : niveau et catégorie à sa couleur, effet, gains immédiats ; sur le plateau, si elle est acquise et combien
 * d'exemplaires restent dans la pile.
 */
export const TechTooltip: React.FC<{ tech: Technology; acquired?: boolean; remaining?: number }> = ({ tech, acquired, remaining }) => {
  const style = TECHNOLOGY_STYLES[tech.type] || TECHNOLOGY_STYLES.DEFAULT;
  return (
    <div className="seti-tech-tooltip-content">
      <div className="seti-tech-tooltip-header">
        <span className="seti-tech-tooltip-name">{tech.name}</span>
        <span className="seti-tech-tooltip-category" style={{ color: style.color, borderColor: style.borderColor }}>{tech.type}</span>
      </div>
      {acquired && <div className="seti-tech-tooltip-acquired">Déjà acquis</div>}
      <div className="seti-tech-tooltip-desc">{tech.description || tech.shorttext}</div>
      <div className="seti-tech-tooltip-bonus">
        <div className="tech-tooltip-gains-label">Gains immédiats :</div>
        <div className="seti-tech-bonus-container"><BonusIcons bonus={tech.bonus} size={15} empty={null} /></div>
      </div>
      {remaining !== undefined && (
        <div className="seti-tech-tooltip-count">{remaining} exemplaire{remaining > 1 ? 's' : ''} restant{remaining > 1 ? 's' : ''}</div>
      )}
    </div>
  );
};
