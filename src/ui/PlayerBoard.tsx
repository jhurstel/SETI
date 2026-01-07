import React, { useState } from 'react';
import { Game, ActionType, GAME_CONSTANTS, FreeAction, ProbeState } from '../core/types';
import { ProbeSystem } from '../systems/ProbeSystem';

interface PlayerBoardProps {
  game: Game;
  onAction?: (actionType: ActionType) => void;
  isDiscarding?: boolean;
  selectedCardIds?: string[];
  onCardClick?: (cardId: string) => void;
  onConfirmDiscard?: () => void;
  onFreeAction?: (cardId: string) => void;
}

const ACTION_NAMES: Record<ActionType, string> = {
  [ActionType.LAUNCH_PROBE]: 'Lancer une sonde',
  [ActionType.ORBIT]: 'Mettre en orbite',
  [ActionType.LAND]: 'Poser une sonde',
  [ActionType.SCAN_SECTOR]: 'Scanner un secteur',
  [ActionType.ANALYZE_DATA]: 'Analyser des données',
  [ActionType.PLAY_CARD]: 'Jouer une carte',
  [ActionType.RESEARCH_TECH]: 'Rechercher une technologie',
  [ActionType.PASS]: 'Passer',
};

export const PlayerBoard: React.FC<PlayerBoardProps> = ({ game, onAction, isDiscarding = false, selectedCardIds = [], onCardClick, onConfirmDiscard, onFreeAction }) => {
  const currentPlayer = game.players[game.currentPlayerIndex];
  const isRobot = (currentPlayer as any).type === 'robot';
  const [highlightedCardId, setHighlightedCardId] = useState<string | null>(null);

  const hasProbeOnPlanetInfo = ProbeSystem.probeOnPlanetInfo(game, currentPlayer.id);
  const hasProbesInSystem = (currentPlayer.probes || []).some(p => p.state === ProbeState.IN_SOLAR_SYSTEM);

  const actionAvailability: Record<ActionType, boolean> = {
    [ActionType.LAUNCH_PROBE]: !isRobot && ProbeSystem.canLaunchProbe(game, currentPlayer.id).canLaunch,
    [ActionType.ORBIT]: !isRobot && currentPlayer.probes.some(probe => ProbeSystem.canOrbit(game, currentPlayer.id, probe.id).canOrbit),
    [ActionType.LAND]: !isRobot && currentPlayer.probes.some(probe => ProbeSystem.canLand(game, currentPlayer.id, probe.id).canLand),
    [ActionType.SCAN_SECTOR]: false, // TODO
    [ActionType.ANALYZE_DATA]: false, // TODO
    [ActionType.PLAY_CARD]: false, // TODO
    [ActionType.RESEARCH_TECH]: false, // TODO
    [ActionType.PASS]: !isRobot,
  };

  // Fonction helper pour générer le tooltip basé sur l'état du jeu (Interaction Engine -> UI)
  const getActionTooltip = (actionType: ActionType, available: boolean): string => {
    // Si l'action est disponible, on peut retourner une description simple ou rien
    if (available) {
       // On pourrait ajouter des descriptions génériques ici si voulu
       return ACTION_NAMES[actionType];
    }

    switch (actionType) {
      case ActionType.LAUNCH_PROBE:
        // si joueur a exploration1, il peut lancer 2 sondes
        const maxProbes = currentPlayer.technologies.some(tech => tech.id === 'exploration-1')
          ? GAME_CONSTANTS.MAX_PROBES_PER_SYSTEM_WITH_TECHNOLOGY
          : GAME_CONSTANTS.MAX_PROBES_PER_SYSTEM;
        if (currentPlayer.probes.length >= maxProbes) return `Limite de sondes atteinte (max ${maxProbes} dans le système solaire)`;
        if (currentPlayer.credits < 2) return `Nécessite 2 crédits (vous avez ${currentPlayer.credits})`;
        return 'Lancer une sonde depuis la Terre (coût: 2 crédits)';

      case ActionType.ORBIT:
        if (!hasProbeOnPlanetInfo.hasProbe) return 'Nécessite une sonde sur une planète autre que la Terre';
        if (currentPlayer.credits < 1) return `Nécessite 1 crédit (vous avez ${currentPlayer.credits})`;
        if (currentPlayer.energy < 1) return `Nécessite 1 énergie (vous avez ${currentPlayer.energy})`;
        return 'Mettre une sonde en orbite (coût: 1 crédit, 1 énergie)';
      
      case ActionType.LAND:
        if (!hasProbeOnPlanetInfo.hasProbe) return 'Nécessite une sonde sur une planète autre que la Terre';
        const cost = hasProbeOnPlanetInfo.landCost || 0;
        if (currentPlayer.credits < cost) {
          return `Nécessite ${cost} crédit(s) (vous avez ${currentPlayer.credits})${hasProbeOnPlanetInfo.hasExploration3 ? ' [Réduction exploration 3 appliquée]' : ''}`;
        }
        return `Poser une sonde sur une planète (coût: ${cost} crédit(s)${hasProbeOnPlanetInfo.hasOrbiter ? ', orbiteur présent' : ''}${hasProbeOnPlanetInfo.hasExploration3 ? ', réduction exploration 3' : ''})`;

      case ActionType.SCAN_SECTOR:
        if (currentPlayer.credits < 1 || currentPlayer.energy < 2) {
          return `Nécessite 1 crédit et 2 énergies (vous avez ${currentPlayer.credits} crédit(s) et ${currentPlayer.energy} énergie(s))`;
        }
        return 'Scanner un secteur (coût: 1 crédit, 2 énergies)';

      case ActionType.ANALYZE_DATA:
        if (!currentPlayer.dataComputer.canAnalyze) return 'Nécessite des données à analyser dans l\'ordinateur de données';
        if (currentPlayer.energy < 1) return `Nécessite 1 énergie (vous avez ${currentPlayer.energy})`;
        return 'Analyser des données (coût: 1 énergie)';

      case ActionType.RESEARCH_TECH:
        if (currentPlayer.mediaCoverage < 6) return `Nécessite 6 points de couverture médiatique (vous avez ${currentPlayer.mediaCoverage})`;
        return 'Rechercher une technologie (coût: 6 couverture médiatique)';

      case ActionType.PLAY_CARD:
        return currentPlayer.cards.length === 0 ? 'Aucune carte en main' : 'Jouer une carte de votre main';
      
      default:
        return '';
    }
  };

  return (
    <div className="seti-player-panel" style={{ borderTop: `4px solid ${currentPlayer.color || '#444'}` }}>
      <div className="seti-player-panel-title" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
        <span>
          Plateau Joueur - {currentPlayer.name} {currentPlayer.type === 'robot' ? '🤖' : '👤'} - Score: {currentPlayer.score} PV
        </span>
      </div>
      
      <div className="seti-player-layout">
        {/* Ressources */}
        <div className="seti-player-section">
          <div className="seti-player-section-title">Ressources</div>
          <div className="seti-player-resources">
            <div className="seti-res-badge">
              <span>Média:</span> <strong>{currentPlayer.mediaCoverage}</strong>
            </div>
            <div className="seti-res-badge">
              <span>Crédit:</span> <strong>{currentPlayer.credits}</strong>
            </div>
            <div className="seti-res-badge">
              <span>Énergie:</span> <strong>{currentPlayer.energy}</strong>
            </div>
          </div>
          <div className="seti-player-section-title">Revenues</div>
          <div className="seti-player-revenues">
            <div className="seti-res-badge">
              <span>Crédit:</span> <strong>{currentPlayer.revenueCredits}</strong>
            </div>
            <div className="seti-res-badge">
              <span>Énergie:</span> <strong>{currentPlayer.revenueEnergy}</strong>
            </div>
            <div className="seti-res-badge">
              <span>Cartes:</span> <strong>{currentPlayer.revenueCards}</strong>
            </div>
          </div>
      </div>

        {/* Actions */}
        <div className="seti-player-section">
          <div className="seti-player-section-title">Actions</div>
          <div className="seti-player-actions">
            {Object.entries(ACTION_NAMES)
              .filter(([action]) => action)
              .map(([action, name]) => {
                const available = actionAvailability[action as ActionType];
                const actionType = action as ActionType;
                const tooltip = getActionTooltip(actionType, available);
                return (
                  <div
                    key={action}
                    className={available ? 'seti-player-action-available' : 'seti-player-action-unavailable'}
                    onClick={() => {
                      if (available && onAction) {
                        onAction(actionType);
                      }
                    }}
                    style={{
                      cursor: available && onAction ? 'pointer' : 'not-allowed',
                    }}
                    title={tooltip}
                  >
                    {name}
                  </div>
                );
              })}
          </div>
        </div>

        {/* Technologies */}
        <div className="seti-player-section">
          <div className="seti-player-section-title">Technologies</div>
          <div className="seti-player-list">
            {currentPlayer.technologies.length > 0 ? (
              currentPlayer.technologies.map((tech) => (
                <div key={tech.id} className="seti-player-list-item">
                  {tech.name}
                </div>
              ))
            ) : (
              <div className="seti-player-list-empty">Aucune technologie</div>
            )}
          </div>
        </div>

        {/* Cartes */}
        <div className="seti-player-section">
          <div className="seti-player-section-title">Cartes</div>
          {isDiscarding && (
            <div style={{ marginBottom: '10px', color: '#ff6b6b', fontSize: '0.9em' }}>
              Veuillez défausser des cartes pour n'en garder que 4.
              <br />
              Sélectionnées : {selectedCardIds.length} / {Math.max(0, currentPlayer.cards.length - 4)}
              {currentPlayer.cards.length - selectedCardIds.length === 4 && (
                <button 
                  onClick={onConfirmDiscard}
                  style={{ marginLeft: '10px', cursor: 'pointer', padding: '2px 8px' }}
                >
                  Confirmer la défausse
                </button>
              )}
            </div>
          )}
          <div className="seti-player-list">
            {currentPlayer.cards.length > 0 ? (
              currentPlayer.cards.map((card) => {
                const isSelectedForDiscard = selectedCardIds.includes(card.id);
                const isHighlighted = highlightedCardId === card.id;
                const isMovementAction = card.freeAction === FreeAction.MOVEMENT;
                const canPerformFreeAction = !isMovementAction || hasProbesInSystem;
                
                let actionTooltip = "";
                if (!canPerformFreeAction) {
                  actionTooltip = "Nécessite une sonde dans le système solaire";
                } else if (card.freeAction === FreeAction.MEDIA) {
                  actionTooltip = "Vous gagnez 1 media";
                }

                return (
                  <div 
                    key={card.id} 
                    className="seti-player-list-item"
                    onClick={() => {
                      if (isDiscarding && onCardClick) {
                        onCardClick(card.id);
                      } else {
                        setHighlightedCardId(isHighlighted ? null : card.id);
                      }
                    }}
                    style={{
                      cursor: 'pointer',
                      border: isDiscarding 
                        ? (isSelectedForDiscard ? '1px solid #ff6b6b' : '1px solid #444')
                        : (isHighlighted ? '1px solid #4a9eff' : '1px solid #444'),
                      backgroundColor: isDiscarding
                        ? (isSelectedForDiscard ? 'rgba(255, 107, 107, 0.1)' : 'transparent')
                        : (isHighlighted ? 'rgba(74, 158, 255, 0.1)' : 'transparent'),
                      transition: 'all 0.2s ease',
                      position: 'relative',
                    }}
                  >
                    {isHighlighted && !isDiscarding && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (canPerformFreeAction && onFreeAction) {
                            onFreeAction(card.id);
                            setHighlightedCardId(null);
                          }
                        }}
                        onMouseEnter={(e) => {
                          if (!canPerformFreeAction) return;
                          const target = e.currentTarget as HTMLButtonElement;
                          target.style.backgroundColor = '#6bb3ff';
                          target.style.transform = 'translateX(2px);';
                        }}
                        onMouseLeave={(e) => {
                          if (!canPerformFreeAction) return;
                          const target = e.currentTarget as HTMLButtonElement;
                          target.style.backgroundColor = '#4a9eff';
                          target.style.transform = 'translateX(-2px);';
                        }}
                        title={actionTooltip}
                        style={{
                          position: 'absolute',
                          top: '5px',
                          right: '5px',
                          zIndex: 10,
                          backgroundColor: canPerformFreeAction ? '#4a9eff' : '#555',
                          color: canPerformFreeAction ? 'white' : '#aaa',
                          border: canPerformFreeAction ? '2px solid #6bb3ff' : '2px solid #444',
                          borderRadius: '6px',
                          padding: '3px 12px',
                          fontSize: '0.65rem',
                          cursor: canPerformFreeAction ? 'pointer' : 'not-allowed',
                          fontWeight: 'normal',
                          boxShadow: canPerformFreeAction ? '0 2px 4px rgba(0,0,0,0.3)' : 'none',
                          transition: 'all 0.2s',
                        }}
                      >
                        Défausser
                      </button>
                    )}
                    <div className="seti-card-name">{card.name} ({card.type})</div>
                    {card.description && (
                      <div className="seti-card-description">{card.description}</div>
                    )}
                    <div className="seti-card-details" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px', marginTop: '4px' }}>
                      <div className="seti-card-detail">
                        {card.freeAction && <><strong>Action:</strong> {card.freeAction}</>}
                      </div>
                      <div className="seti-card-detail">
                        {card.scanSector && <><strong>Scan:</strong> {card.scanSector}</>}
                      </div>
                      <div className="seti-card-detail">
                        {card.revenue && <><strong>Revenu:</strong> {card.revenue}</>}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="seti-player-list-empty">Aucune carte</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
