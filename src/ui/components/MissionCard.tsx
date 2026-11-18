import React from 'react';
import { useTutorialFocus } from '../tutorialFocus';
import { Mission, Game } from '../../core/types';
import { CardSystem } from '../../systems/CardSystem';
import { CardFace, MissionCircleState } from './CardFace';
import { CardTooltip } from './CardTooltip';

interface MissionCardProps {
  mission: Mission;
  game: Game;
  playerId: string;
  currentPlayerColor: string;
  isCurrentTurn: boolean;
  isRobot: boolean;
  isInteractiveMode: boolean;
  onMissionClick: (missionId: string, requirementId: string) => void;
  handleTooltipHover: (e: React.MouseEvent, content: React.ReactNode) => void;
  handleTooltipLeave: () => void;
}

/**
 * Mission jouée : face de sa carte, cercles recouverts du marqueur du joueur ; un cercle réalisable (déclenché ou condition
 * remplie, même règle que l'avertissement de fin de tour) se clique pour le recouvrir.
 */
export const MissionCard: React.FC<MissionCardProps> = ({
  mission,
  game,
  playerId,
  currentPlayerColor,
  isCurrentTurn,
  isRobot,
  isInteractiveMode,
  onMissionClick,
  handleTooltipHover,
  handleTooltipLeave
}) => {
  const tutorialFocus = useTutorialFocus();
  // Tutoriel : un cercle ne clignote que si l'étape en cours décrit les missions (il reste cliquable)
  const missionsInFocus = !tutorialFocus.active || tutorialFocus.target === 'missions';

  const circleStates: MissionCircleState[] = mission.requirements.map(requirement => {
    const completed = !!requirement.id && mission.completedRequirementIds.includes(requirement.id);
    const claimable = !!requirement.id && CardSystem.isRequirementClaimable(game, playerId, mission, requirement.id);
    const canClick = !completed && claimable && isCurrentTurn && !isRobot && !isInteractiveMode;
    return {
      completed,
      fulfillable: canClick,
      flash: canClick && missionsInFocus,
      markerColor: currentPlayerColor,
      onClick: canClick && requirement.id ? () => onMissionClick(mission.id, requirement.id!) : undefined,
    };
  });

  const card = mission.originalCard;
  return (
    <div
      className={`seti-common-card seti-mission-card ${mission.completed ? 'completed' : ''} help-cursor`}
      onMouseEnter={e => { if (card) handleTooltipHover(e, <CardTooltip card={card} circleStates={circleStates} />); }}
      onMouseLeave={handleTooltipLeave}
    >
      {card ? <CardFace card={card} compact circleStates={circleStates} /> : <div className="seti-mission-title">{mission.name}</div>}
      {mission.completed && <span className="seti-mission-check">✓</span>}
    </div>
  );
};
