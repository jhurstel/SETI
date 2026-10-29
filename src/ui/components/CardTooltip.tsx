import React from 'react';
import { Card, CardType, CostType } from '../../core/types';
import { SECTOR_STYLES } from '../styles/celestialStyles';
import { ResourceIcon } from './GameIcons';

export const CardDescription: React.FC<{ description: string, type?: CardType, hideIntro?: boolean }> = ({ description, type, hideIntro }) => {
    if (!description) return null;

    const missionStyle: React.CSSProperties = type === CardType.END_GAME ? { color: '#ffd700' } : {};

    // Cas des missions conditionnelle (Mission:) ou Fin de jeu (Fin de jeu:)
    const missionRegex = /(Mission:|Fin de jeu:|Réception:)/g;
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
        elements.push(
          <div
            key={`mission-${i}`}
            className="seti-card-tooltip-mission"
            style={{
              borderTop: hideIntro ? 'none' : '1px dash #333',
              ...missionStyle
            }}
          >
            <strong>{header}</strong>{content}
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
        card.type === CardType.EXERTIEN ? (
          // Carte Exertien : ni coût, ni action, ni revenu, ni scan ; seul son danger compte
          <div className="seti-card-tooltip-stats">
            <div>Danger: <span style={{ color: '#ff6b6b', fontWeight: 'bold' }}>{card.danger ?? 0}</span></div>
            <div>Type: {card.type} ({card.id})</div>
          </div>
        ) : (
          <div className="seti-card-tooltip-stats">
            <div>Coût: <span style={{ color: '#ffd700', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '3px', verticalAlign: 'middle' }}>{card.cost} <ResourceIcon kind={card.costType === CostType.ENERGY ? 'energy' : 'credit'} size={14} /></span></div>
            <div>Type: {card.type} ({card.id})</div>
            <div>Act: <span style={{ color: '#aaffaa' }}>{card.freeAction}</span></div>
            <div>Rev: <span style={{ color: '#aaffaa' }}>{card.revenue}</span></div>
            <div>Scan: <span style={{ color: `${SECTOR_STYLES[card.scanSector]?.color || '#fff'}` }}>{card.scanSector}</span></div>
          </div>
        )
      )}
    </div>
  );
};
