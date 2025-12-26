import React from 'react';
import { Game, ActionType } from '../core/types';

interface PlayerBoardProps {
  game: Game;
  onAction?: (actionType: ActionType) => void;
}

const ACTION_NAMES: Record<ActionType, string> = {
  [ActionType.LAUNCH_PROBE]: 'Lancer une sonde',
  [ActionType.MOVE_PROBE]: 'Déplacer une sonde',
  [ActionType.ORBIT]: 'Mettre en orbite',
  [ActionType.LAND]: 'Poser une sonde',
  [ActionType.SCAN_SECTOR]: 'Scanner un secteur',
  [ActionType.ANALYZE_DATA]: 'Analyser des données',
  [ActionType.PLAY_CARD]: 'Jouer une carte',
  [ActionType.RESEARCH_TECH]: 'Rechercher une technologie',
  [ActionType.PASS]: 'Passer',
  [ActionType.FREE_ACTION]: 'Action gratuite',
};

export const PlayerBoard: React.FC<PlayerBoardProps> = ({ game, onAction }) => {
  const currentPlayer = game.players[game.currentPlayerIndex];

  // Vérification simple de disponibilité des actions
  const canLaunchProbe = currentPlayer.credits >= 2;
  const canScan = currentPlayer.credits >= 1 && currentPlayer.energy >= 2;
  const canResearch = currentPlayer.mediaCoverage >= 6;
  const canAnalyze = currentPlayer.dataComputer.canAnalyze && currentPlayer.energy >= 1;

  const actionAvailability: Record<ActionType, boolean> = {
    [ActionType.LAUNCH_PROBE]: canLaunchProbe,
    [ActionType.MOVE_PROBE]: currentPlayer.energy > 0,
    [ActionType.ORBIT]: currentPlayer.credits >= 1 && currentPlayer.energy >= 1,
    [ActionType.LAND]: currentPlayer.energy >= 3,
    [ActionType.SCAN_SECTOR]: canScan,
    [ActionType.ANALYZE_DATA]: canAnalyze,
    [ActionType.PLAY_CARD]: currentPlayer.cards.length > 0,
    [ActionType.RESEARCH_TECH]: canResearch,
    [ActionType.PASS]: true,
    [ActionType.FREE_ACTION]: true,
  };

  return (
    <div className="seti-player-panel">
      <div className="seti-player-panel-title">Plateau Joueur - {currentPlayer.name}</div>
      
      <div className="seti-player-layout">
        {/* Ressources */}
        <div className="seti-player-section">
          <div className="seti-player-section-title">Ressources</div>
          <div className="seti-player-resources">
            <div className="seti-res-badge">
              <span>Score:</span> <strong>{currentPlayer.score}</strong>
            </div>
            <div className="seti-res-badge">
              <span>Média:</span> <strong>{currentPlayer.mediaCoverage}</strong>
            </div>
            <div className="seti-res-badge">
              <span>Crédits:</span> <strong>{currentPlayer.credits}</strong>
            </div>
            <div className="seti-res-badge">
              <span>Énergie:</span> <strong>{currentPlayer.energy}</strong>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="seti-player-section">
          <div className="seti-player-section-title">Actions</div>
          <div className="seti-player-actions">
            {Object.entries(ACTION_NAMES).map(([action, name]) => {
              const available = actionAvailability[action as ActionType];
              const actionType = action as ActionType;
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
          <div className="seti-player-list">
            {currentPlayer.cards.length > 0 ? (
              currentPlayer.cards.map((card) => (
                <div key={card.id} className="seti-player-list-item">
                  <div className="seti-card-name">{card.name}</div>
                  {card.description && (
                    <div className="seti-card-description">{card.description}</div>
                  )}
                </div>
              ))
            ) : (
              <div className="seti-player-list-empty">Aucune carte</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

