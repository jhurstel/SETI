import React from 'react';
import { Card, CardType, SectorColor } from '../core/types';

export const getSectorColorCode = (color: SectorColor) => {
  switch (color) {
    case SectorColor.BLUE: return '#4a9eff';
    case SectorColor.RED: return '#ff6b6b';
    case SectorColor.YELLOW: return '#ffd700';
    case SectorColor.BLACK: return '#aaaaaa';
    default: return '#fff';
  }
};

export const CardTooltip: React.FC<{ card: Card }> = ({ card }) => {
  const descriptionParts = card.description ? card.description.split('Mission:') : [card.description];
  const mainDescription = descriptionParts[0];
  const missionDescription = descriptionParts.length > 1 ? descriptionParts[1] : null;

  return (
    <div className="seti-card-tooltip">
      <div className="seti-card-tooltip-title">{card.name}</div>
      <div className="seti-card-tooltip-desc">
        {mainDescription}
        {missionDescription && (
            <div className="seti-card-tooltip-mission">
                <strong>Mission:</strong>{missionDescription}
            </div>
        )}
      </div>
      <div className="seti-card-tooltip-stats">
         <div>Coût: <span style={{ color: '#ffd700', fontWeight: 'bold' }}>{card.cost}</span></div>
         <div>Type: {card.type === CardType.ACTION ? 'Action' : card.type === CardType.END_GAME ? 'Fin de jeu' : 'Mission'} ({card.id})</div>
         <div>Act: <span style={{ color: '#aaffaa' }}>{card.freeAction}</span></div>
         <div>Rev: <span style={{ color: '#aaffaa' }}>{card.revenue}</span></div>
         <div className="seti-card-tooltip-scan">Scan: <span style={{ color: getSectorColorCode(card.scanSector), fontWeight: 'bold' }}>{card.scanSector}</span></div>
      </div>
    </div>
  );
};
