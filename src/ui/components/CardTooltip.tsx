import React from 'react';
import { Card } from '../../core/types';
import { CardFace, MissionCircleState } from './CardFace';

/** Infobulle d'une carte : sa face en grande taille, texte compris (état des cercles pour une mission jouée) */
export const CardTooltip: React.FC<{ card: Card; circleStates?: MissionCircleState[] }> = ({ card, circleStates }) => (
  <div className="seti-card-tooltip">
    <CardFace card={card} circleStates={circleStates} />
  </div>
);
