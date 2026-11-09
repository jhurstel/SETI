import React from 'react';
import { Card, CardType, CentaurienMarker } from '../../core/types';
import { CardTooltip } from './CardTooltip';
import { HoverTooltip } from './HoverTooltip';
import { SlotTooltip } from './SlotTooltip';
import { SLOT_COLORS } from '../styles/slotColors';

interface PlayedMissionCardProps {
  card: Card;
  /** Carte Centaurien : son palier sur la piste de score (la réception se fait d'elle-même en l'atteignant) */
  centaurienMarker?: CentaurienMarker;
  handleTooltipHover: (e: React.MouseEvent, content: React.ReactNode) => void;
  handleTooltipLeave: () => void;
}

export const PlayedMissionCard: React.FC<PlayedMissionCardProps> = ({ card, centaurienMarker, handleTooltipHover, handleTooltipLeave }) => {
  let missionRequirementStrings: string[] = [];
  if (card.description) {
    if (card.description.includes('Mission:')) {
      missionRequirementStrings = [card.description.split('Mission:')[1].trim()];
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
  // Centaurien : reçue une fois son palier atteint (rien à cliquer, l'étoile n'indique que l'état)
  const isCompleted = isCentaurien ? !!centaurienMarker?.resolved : !!card.completed;

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
        <div className="seti-mission-requirements-row played-mission-rewards">
            <HoverTooltip nested content={isCompleted
              ? <SlotTooltip status="Message reçu" statusColor="#ffd700" note={centaurienMarker?.resolved} />
              : <SlotTooltip status={centaurienMarker ? `Réception à ${centaurienMarker.score} PV` : 'Réception'} statusColor={SLOT_COLORS.neutral}
                  note="Effet appliqué en atteignant ce palier de score" />}>
              <div
                className="seti-mission-requirement-indicator"
                style={{
                  fontSize: '14px',
                  color: isCompleted ? '#ffd700' : '#555',
                  cursor: 'help',
                  textShadow: isCompleted ? '0 0 5px #ffd700' : 'none',
                }}
              >
                ★
              </div>
            </HoverTooltip>
        </div>
      )}
    </div>
  );
};
