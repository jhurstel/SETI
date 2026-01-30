import React from 'react';
import { Card, CardType, SectorType } from '../core/types';

export const getSectorTypeCode = (color: SectorType) => {
  switch (color) {
    case SectorType.BLUE: return '#4a9eff';
    case SectorType.RED: return '#ff6b6b';
    case SectorType.YELLOW: return '#ffd700';
    case SectorType.BLACK: return '#aaaaaa';
    default: return '#fff';
  }
};

export const CardDescription: React.FC<{ description: string, type?: CardType }> = ({ description, type }) => {
    if (!description) return null;

    const missionStyle: React.CSSProperties = type === CardType.END_GAME ? { color: '#ffd700' } : {};

    // Cas des missions conditionnelle (Mission:, Mission:, etc.)
    const missionRegex = /(Mission:)/g;
    if (missionRegex.test(description)) {
      const parts = description.split(missionRegex);
      const elements = [];

      // Introduction (avant la première mission)
      if (parts[0] && parts[0].trim()) {
        elements.push(<div key="intro">{parts[0]}</div>);
      } else {
        elements.push(<div key="intro" style={{ fontStyle: 'italic', color: '#aaa' }}>Aucune action bonus</div>);
      }

      // Paires Header + Contenu
      for (let i = 1; i < parts.length; i += 2) {
        const header = parts[i];
        const content = parts[i + 1];
        elements.push(
          <div key={`mission-${i}`} className="seti-card-tooltip-mission" style={{ marginTop: '4px', ...missionStyle }}>
            <strong>{header}</strong>{content}
          </div>
        );
      }
      return <>{elements}</>;
    }

    // Cas standard (Fin de jeu: unique ou pas de mission)
    const descriptionParts = description.split('Fin de jeu:');
    const mainDescription = descriptionParts[0];
    const missionDescription = descriptionParts.length > 1 ? descriptionParts[1] : null;

    return (
      <>
        {mainDescription}
        {missionDescription && (
          <div className="seti-card-tooltip-mission" style={missionStyle}>
            <strong>Mission:</strong>{missionDescription}
          </div>
        )}
      </>
    );
};

export const CardTooltip: React.FC<{ card: Card }> = ({ card }) => {
  return (
    <div className="seti-card-tooltip">
      <div className="seti-card-tooltip-title">{card.name}</div>
      <div className="seti-card-tooltip-desc">
        <CardDescription description={card.description} type={card.type} />
      </div>
      <div className="seti-card-tooltip-stats">
         <div>Coût: <span style={{ color: '#ffd700', fontWeight: 'bold' }}>{card.cost}</span></div>
         <div>Type: {card.type === CardType.ACTION ? 'Action' : card.type === CardType.END_GAME ? 'Fin de jeu' : card.type === CardType.CONDITIONAL_MISSION ? 'Mission conditionnelle' : card.type === CardType.TRIGGERED_MISSION ? 'Mission déclenchable' : 'Autre'} ({card.id})</div>
         <div>Act: <span style={{ color: '#aaffaa' }}>{card.freeAction}</span></div>
         <div>Rev: <span style={{ color: '#aaffaa' }}>{card.revenue}</span></div>
         <div className="seti-card-tooltip-scan">Scan: <span style={{ color: getSectorTypeCode(card.scanSector), fontWeight: 'bold' }}>{card.scanSector}</span></div>
      </div>
    </div>
  );
};
