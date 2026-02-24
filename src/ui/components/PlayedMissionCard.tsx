import React from 'react';
import { Card } from '../../core/types';
import { CardTooltip } from './CardTooltip';

interface PlayedMissionCardProps {
  card: Card;
  handleTooltipHover: (e: React.MouseEvent, content: React.ReactNode) => void;
  handleTooltipLeave: () => void;
}

export const PlayedMissionCard: React.FC<PlayedMissionCardProps> = ({ card, handleTooltipHover, handleTooltipLeave }) => {
  let missionRequirementStrings: string[] = [];
  if (card.description) {
    if (card.description.includes('Mission:')) {
      missionRequirementStrings = card.description.split('Mission:').slice(1).filter(s => s.trim() !== '');
    } else if (card.description.includes('Fin de jeu:')) {
      missionRequirementStrings = [card.description.split('Fin de jeu:')[1].trim()];
    } else {
      missionRequirementStrings = [card.description];
    }
  }
  return (
    <div className="seti-common-card seti-played-card"
      onMouseEnter={(e) => handleTooltipHover(e, <CardTooltip card={card} hideIntro={true} hideStats={true} />)}
      onMouseLeave={handleTooltipLeave}
    >
      <div className="seti-mission-header">
        <div className="seti-mission-title">{card.name}</div>
        <span className="seti-played-card-tag">FIN</span>
      </div>
      {missionRequirementStrings.length > 0 && (
        <div className="seti-mission-desc">
          {missionRequirementStrings.map((text, idx) => (
            <div key={idx}>{text}</div>
          ))}
        </div>
      )}
    </div>
  );
};
