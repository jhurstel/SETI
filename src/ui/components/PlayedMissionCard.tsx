import React from 'react';
import { Card, CardType, CentaurienMarker } from '../../core/types';
import { CardFace } from './CardFace';
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

/** Carte Fin de partie ou Centaurien posée devant le joueur : sa face, et pour un Centaurien l'état de sa réception */
export const PlayedMissionCard: React.FC<PlayedMissionCardProps> = ({ card, centaurienMarker, handleTooltipHover, handleTooltipLeave }) => {
  const isCentaurien = card.type === CardType.CENTAURIEN;
  // Centaurien : reçue une fois son palier atteint (rien à cliquer, l'étoile n'indique que l'état)
  const isCompleted = isCentaurien ? !!centaurienMarker?.resolved : !!card.completed;

  return (
    <div className={`seti-common-card seti-played-card ${isCompleted ? 'completed' : ''}`}
      onMouseEnter={(e) => handleTooltipHover(e, <CardTooltip card={card} />)}
      onMouseLeave={handleTooltipLeave}
    >
      <CardFace card={card} compact />
      {isCompleted && <span className="seti-mission-check">✓</span>}
      {isCentaurien && (
        <HoverTooltip nested className="seti-played-card-reception" content={isCompleted
          ? <SlotTooltip status="Message reçu" statusColor="#ffd700" note={centaurienMarker?.resolved} />
          : <SlotTooltip status={centaurienMarker ? `Réception à ${centaurienMarker.score} PV` : 'Réception'} statusColor={SLOT_COLORS.neutral}
              note="Effet appliqué en atteignant ce palier de score" />}>
          <span className={`seti-played-card-star ${isCompleted ? 'received' : ''}`}>★</span>
        </HoverTooltip>
      )}
    </div>
  );
};
