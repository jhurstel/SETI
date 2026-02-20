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

export const CardDescription: React.FC<{ description: string, type?: CardType, hideIntro?: boolean }> = ({ description, type, hideIntro }) => {
    if (!description) return null;

    const missionStyle: React.CSSProperties = type === CardType.END_GAME ? { color: '#ffd700' } : {};

    // Cas des missions conditionnelle (Mission:) ou Fin de jeu (Fin de jeu:)
    const missionRegex = /(Mission:|Fin de jeu:)/g;
    if (missionRegex.test(description)) {
      const parts = description.split(missionRegex);
      const elements = [];

      // Introduction (avant la première mission)
      if (parts[0] && parts[0].trim() && !hideIntro) {
        elements.push(<div key="intro">{parts[0]}</div>);
      } else if (type !== CardType.END_GAME && !hideIntro) {
        elements.push(<div key="intro" style={{ fontStyle: 'italic', color: '#aaa' }}>Aucune action bonus</div>);
      }

      // Paires Header + Contenu
      for (let i = 1; i < parts.length; i += 2) {
        const header = parts[i];
        const content = parts[i + 1];
        const displayHeader = header === 'Fin de jeu:' ? 'Mission:' : header;
        elements.push(
          <div
            key={`mission-${i}`}
            className="seti-card-tooltip-mission"
            style={{
              borderTop: hideIntro ? 'none' : '1px dash #333',
              ...missionStyle
            }}
          >
            <strong>{displayHeader}</strong>{content}
          </div>
        );
      }
      return <>{elements}</>;
    }

    return <>{description}</>;
};

export const CardTooltip: React.FC<{ card: Card, hideIntro?: boolean, hideStats?: boolean }> = ({ card, hideIntro, hideStats }) => {
  return (
    <div className="seti-card-tooltip">
      <div className="seti-card-tooltip-title">{card.name}</div>
      <div className="seti-card-tooltip-desc">
        <CardDescription description={card.description} type={card.type} hideIntro={hideIntro} />
      </div>
      {!hideStats && (
      <div className="seti-card-tooltip-stats">
         <div>Coût: <span style={{ color: '#ffd700', fontWeight: 'bold' }}>{card.cost}</span></div>
         <div>Type: {card.type === CardType.ACTION ? 'Action' : card.type === CardType.END_GAME ? 'Fin de jeu' : card.type === CardType.CONDITIONAL_MISSION ? 'Mission conditionnelle' : card.type === CardType.TRIGGERED_MISSION ? 'Mission déclenchable' : 'Autre'} ({card.id})</div>
         <div>Act: <span style={{ color: '#aaffaa' }}>{card.freeAction}</span></div>
         <div>Rev: <span style={{ color: '#aaffaa' }}>{card.revenue}</span></div>
         <div className="seti-card-tooltip-scan">Scan: <span style={{ color: getSectorTypeCode(card.scanSector), fontWeight: 'bold' }}>{card.scanSector}</span></div>
      </div>
      )}
    </div>
  );
};
