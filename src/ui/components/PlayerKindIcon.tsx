import React from 'react';
import { Player } from '../../core/types';
import { HoverTooltip } from './HoverTooltip';
import './PlayerKindIcon.css';

/** Niveaux des robots : nom affiché et force (1 à 3 barres), comme dans la fenêtre Nouvelle partie */
const ROBOT_LEVELS: Record<'EASY' | 'MEDIUM' | 'EXPERT', { name: string; strength: number }> = {
  EASY: { name: 'Débutant', strength: 1 },
  MEDIUM: { name: 'Avancé', strength: 2 },
  EXPERT: { name: 'Expert', strength: 3 },
};

/** Force d'un niveau de robot : 1 à 3 barres */
export const LevelStrength: React.FC<{ value: number }> = ({ value }) => (
  <span className="seti-level-strength" aria-hidden="true">
    {[1, 2, 3].map(i => <span key={i} className={i <= value ? 'on' : ''} style={{ height: 4 + i * 4 }} />)}
  </span>
);

/** Silhouette d'un joueur humain */
export const HumanIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" className="seti-human-icon">
    <circle cx="8" cy="4.6" r="3.1" fill="currentColor" />
    <path d="M2 15.5c0-3.6 2.7-6 6-6s6 2.4 6 6z" fill="currentColor" />
  </svg>
);

/** Devant le nom d'un joueur : silhouette pour un humain, force du niveau pour un robot (infobulle : le niveau) */
export const PlayerKindIcon: React.FC<{ player: Pick<Player, 'type' | 'aiDifficulty'> }> = ({ player }) => {
  if (player.type !== 'robot') {
    return <HoverTooltip content="Joueur humain" className="seti-player-kind"><HumanIcon /></HoverTooltip>;
  }
  const level = ROBOT_LEVELS[(player.aiDifficulty ?? 'EASY') as keyof typeof ROBOT_LEVELS] ?? ROBOT_LEVELS.EASY;
  return <HoverTooltip content={`Robot ${level.name}`} className="seti-player-kind"><LevelStrength value={level.strength} /></HoverTooltip>;
};
