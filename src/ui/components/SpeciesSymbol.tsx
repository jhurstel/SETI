import React from 'react';
import { AlienBoardType } from '../../core/types';
import { AnomalyIcon, CentaurienMessageIcon, MascamiteIcon, ResourceIcon } from './GameIcons';
import { ANOMALY_COLORS } from '../styles/anomalyColors';

/** Symbole d'une espèce Alien (celui du glossaire et de son plateau) : dos de ses cartes, glossaire */
export const SpeciesSymbol: React.FC<{ species: string; size?: number }> = ({ species, size = 22 }) => {
  switch (species) {
    case AlienBoardType.MASCAMITES: return <MascamiteIcon size={size} />;
    case AlienBoardType.ANOMALIES: return <AnomalyIcon color={Object.values(ANOMALY_COLORS)[0]} size={size} />;
    case AlienBoardType.OUMUAMUA: return <ResourceIcon kind="token" size={size} />;
    case AlienBoardType.CENTAURIENS: return <CentaurienMessageIcon size={size} />;
    case AlienBoardType.EXERTIENS: return <span className="seti-species-symbol-emoji" style={{ fontSize: size * 0.8 }}>☣️</span>;
    default: return null;
  }
};
