import React from 'react';
import { Card, CardType, Game } from '../../core/types';
import { CardTooltip } from './CardTooltip';

interface PlayedMissionCardProps {
  card: Card;
  game?: Game;
  playerId?: string;
  isCurrentTurn?: boolean;
  isRobot?: boolean;
  onMissionClick?: (missionId: string, requirementId?: string) => void;
  handleTooltipHover: (e: React.MouseEvent, content: React.ReactNode) => void;
  handleTooltipLeave: () => void;
}

export const PlayedMissionCard: React.FC<PlayedMissionCardProps> = ({ card, game, playerId, isCurrentTurn, isRobot, onMissionClick, handleTooltipHover, handleTooltipLeave }) => {
  let missionRequirementStrings: string[] = [];
  if (card.description) {
    if (card.description.includes('Mission:')) {
      missionRequirementStrings = card.description.split('Mission:').slice(1).filter(s => s.trim() !== '');
    } else if (card.description.includes('Fin de jeu:')) {
      missionRequirementStrings = [card.description.split('Fin de jeu:')[1].trim()];
    } else if (card.description.includes('Réception:')) {
      missionRequirementStrings = [card.description.split('Réception:')[1].trim()];
    } else {
      missionRequirementStrings = [card.description];
    }
  }

  const isCentaurien = card.type === CardType.CENTAURIEN;
  const tag = isCentaurien ? 'ET' : 'FIN';
  const isCompleted = !!card.completed;
  const canClick = isCentaurien && !isCompleted && isCurrentTurn && !isRobot && !!onMissionClick;

  return (
    <div className={`seti-common-card seti-played-card ${isCompleted ? 'completed' : ''}`}
      onMouseEnter={(e) => handleTooltipHover(e, <CardTooltip card={card} hideIntro={true} hideStats={true} />)}
      onMouseLeave={handleTooltipLeave}
    >
      <div className="seti-mission-header">
        <div className="seti-mission-title">{card.name}</div>
        <span className="seti-played-card-tag">{tag}</span>
        {isCompleted && <span className="seti-mission-check">✓</span>}
      </div>
      {missionRequirementStrings.length > 0 && (
        <div className="seti-mission-desc">
          {missionRequirementStrings.map((text, idx) => (
            <div key={idx}>{text}</div>
          ))}
        </div>
      )}
      {isCentaurien && (
        <div className="seti-mission-requirements-row" style={{ display: 'flex', width: '100%', padding: '4px 0', marginTop: 'auto', justifyContent: 'center' }}>
            <div
              className="seti-mission-requirement-indicator"
              style={{
                fontSize: '14px',
                color: isCompleted ? '#ffd700' : '#555',
                cursor: canClick ? 'pointer' : 'default',
                textShadow: isCompleted ? '0 0 5px #ffd700' : 'none',
                transform: canClick ? 'scale(1.2)' : 'scale(1)',
                transition: 'all 0.2s'
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (canClick && onMissionClick) {
                  onMissionClick(card.id);
                }
              }}
            >
              ★
            </div>
        </div>
      )}
    </div>
  );
};
