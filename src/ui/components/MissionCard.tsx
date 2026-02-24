import React from 'react';
import { Mission, Game } from '../../core/types';
import { CardSystem } from '../../systems/CardSystem';

interface MissionCardProps {
  mission: Mission;
  game: Game;
  playerId: string;
  currentPlayerColor: string;
  isCurrentTurn: boolean;
  isRobot: boolean;
  isInteractiveMode: boolean;
  onMissionClick?: (missionId: string, requirementId?: string) => void;
  handleTooltipHover: (e: React.MouseEvent, content: React.ReactNode) => void;
  handleTooltipLeave: () => void;
}

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
  const missionRequirementStrings = mission.description.split('Mission:').slice(1).filter(s => s.trim() !== '');
  const displayCount = Math.max(missionRequirementStrings.length, mission.requirements.length);
  const displayItems = Array.from({ length: displayCount });

  const renderTooltipContent = () => (
    <div className="seti-card-tooltip">
      <div className="seti-card-tooltip-title">{mission.name}</div>
      <div className="seti-card-tooltip-desc">
        {displayItems.map((_, index) => {
          const requirement = mission.requirements[index];
          const isCompleted = requirement && requirement.id ? (mission.completedRequirementIds || []).includes(requirement.id) : false;
          const text = missionRequirementStrings[index] || (requirement ? `Condition ${index + 1}` : `Mission ${index + 1}`);

          const isConditional = requirement && requirement.type.startsWith('GAIN_IF_');
          const icon = isCompleted ? '✅' : (isConditional ? '⬜' : '⚪');

          return (
            <div key={index} style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '4px' }}>
              <span style={{ marginRight: '8px', color: isCompleted ? '#4caf50' : '#aaa', fontSize: '1.2em', lineHeight: '1' }}>
                {icon}
              </span>
              <span>
                <span style={{ fontWeight: 'bold' }}>Mission:</span> {text.trim()}
              </span>
            </div>
          );
        })}
      </div>
      {mission.completed && (
        <div className="seti-card-tooltip-stats" style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#4caf50', fontWeight: 'bold', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #555' }}>
          MISSION ACCOMPLIE
        </div>
      )}
    </div>
  );

  return (
    <div
      className={`seti-common-card seti-mission-card ${mission.completed ? 'completed' : ''}`}
      style={{ cursor: 'default' }}
      onMouseEnter={e => { handleTooltipHover(e, renderTooltipContent()); }}
      onMouseLeave={handleTooltipLeave}
    >
      <div className="seti-mission-header">
        <div className="seti-mission-title">{mission.name}</div>
        <span className="seti-played-card-tag">MIS</span>
        {mission.completed && <span className="seti-mission-check">✓</span>}
      </div>

      {mission.description && (
        <div className="seti-mission-desc">
          {mission.description}
        </div>
      )}

      <div className="seti-mission-requirements-row" style={{ display: 'flex', width: '100%', padding: '8px 0 4px 0', marginTop: 'auto', justifyContent: 'space-evenly' }}>
        {displayItems.map((_, index) => {
          const requirement = mission.requirements[index];
          const isCompleted = requirement && requirement.id ? (mission.completedRequirementIds || []).includes(requirement.id) : false;
          const text = missionRequirementStrings[index] || (requirement ? `Condition ${index + 1}` : `Mission ${index + 1}`);

          let isFulfillable = false;
          let isConditional = false;

          // Vérifier si la condition est marquée comme "fulfillable" (GAIN_ON_...)
          if (requirement?.id && mission.fulfillableRequirementIds?.includes(requirement.id)) {
            isFulfillable = true;
          }

          if (requirement) {
            if (requirement.type.startsWith('GAIN_IF_')) {
              isConditional = true;
              const bonus = CardSystem.evaluateMission(game, playerId, requirement.value);
              if (bonus) isFulfillable = true;
            }
          }

          const canClick = !isCompleted && isFulfillable && isCurrentTurn && !isRobot && !isInteractiveMode;
          const isHighlighted = isCompleted || canClick;

          return (
            <div
              key={index}
              className="seti-mission-requirement-indicator"
              style={{
                width: '12px',
                height: '12px',
                borderRadius: isConditional ? '2px' : '50%',
                border: `1px solid ${currentPlayerColor}`,
                backgroundColor: isCompleted ? currentPlayerColor : 'transparent',
                cursor: canClick ? 'pointer' : 'default',
                zIndex: canClick ? 20 : 10,
                opacity: isHighlighted ? 1 : 0.3,
                boxShadow: canClick ? `0 0 8px ${currentPlayerColor}, 0 0 12px #fff` : (isCompleted ? `0 0 5px ${currentPlayerColor}` : 'none'),
                transform: canClick ? 'scale(1.3)' : 'scale(1)',
                transition: 'all 0.3s ease'
              }}
              onMouseEnter={(e) => {
                e.stopPropagation();
                handleTooltipHover(e, <div style={{ padding: '4px', maxWidth: '200px' }}>{text.trim()}</div>);
              }}
              onMouseLeave={(e) => {
                e.stopPropagation();
                handleTooltipLeave();
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (canClick && onMissionClick && requirement?.id) {
                  onMissionClick(mission.id, requirement.id);
                }
              }}
            />
          );
        })}
      </div>
    </div>
  );
};
