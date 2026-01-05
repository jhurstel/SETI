import { Game, ActionType } from '../core/types';
import { ProbeSystem } from '../systems/ProbeSystem';

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

  const hasProbeOnPlanetInfo = ProbeSystem.probeOnPlanetInfo(game, currentPlayer.id);

  const actionAvailability: Record<ActionType, boolean> = {
    [ActionType.LAUNCH_PROBE]: ProbeSystem.canLaunchProbe(game, currentPlayer.id).canLaunch,
    [ActionType.MOVE_PROBE]: false,//currentPlayer.probes.some(probe => ProbeSystem.canMoveProbe(game, currentPlayer.id, probe.id, targetPosition).canMove),
    [ActionType.ORBIT]: currentPlayer.probes.some(probe => ProbeSystem.canOrbit(game, currentPlayer.id, probe.id).canOrbit),
    [ActionType.LAND]: currentPlayer.probes.some(probe => ProbeSystem.canLand(game, currentPlayer.id, probe.id).canLand),
    [ActionType.SCAN_SECTOR]: false, // TODO
    [ActionType.ANALYZE_DATA]: false, // TODO
    [ActionType.PLAY_CARD]: false, // TODO
    [ActionType.RESEARCH_TECH]: false, // TODO
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
              <span>Crédit:</span> <strong>{currentPlayer.credits}</strong>
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
            {Object.entries(ACTION_NAMES)
              .filter(([action]) => action !== ActionType.MOVE_PROBE) // Exclure "Déplacer une sonde" car c'est une action gratuite
              .map(([action, name]) => {
                const available = actionAvailability[action as ActionType];
                const actionType = action as ActionType;
                
                // Déterminer le tooltip selon l'action
                let tooltip = '';
                if (actionType === ActionType.ORBIT) {
                  tooltip = !hasProbeOnPlanetInfo.hasProbe 
                  ? 'Nécessite une sonde sur une planète autre que la Terre'
                  : currentPlayer.credits < 1 
                  ? 'Nécessite 1 crédit (vous avez ' + currentPlayer.credits + ')'
                  : currentPlayer.energy < 1
                  ? 'Nécessite 1 énergie (vous avez ' + currentPlayer.energy + ')'
                  : 'Mettre une sonde en orbite (coût: 1 crédit, 1 énergie)';
                } else if (actionType === ActionType.LAND) {
                  tooltip = !hasProbeOnPlanetInfo.hasProbe
                  ? 'Nécessite une sonde sur une planète autre que la Terre'
                  : currentPlayer.credits < hasProbeOnPlanetInfo.landCost! || 0
                  ? `Nécessite ${hasProbeOnPlanetInfo.landCost} crédit(s) (vous avez ${currentPlayer.credits})${hasProbeOnPlanetInfo.hasExploration3 ? ' [Réduction exploration 3 appliquée]' : ''}`
                  : `Poser une sonde sur une planète (coût: ${hasProbeOnPlanetInfo.landCost} crédit(s)${hasProbeOnPlanetInfo.hasOrbiter ? ', orbiteur présent' : ''}${hasProbeOnPlanetInfo.hasExploration3 ? ', réduction exploration 3' : ''})`;
                } else if (actionType === ActionType.LAUNCH_PROBE) {
                  tooltip = currentPlayer.credits < 2 
                    ? 'Nécessite 2 crédits (vous avez ' + currentPlayer.credits + ')'
                    : 'Lancer une sonde depuis la Terre (coût: 2 crédits)';
                } else if (actionType === ActionType.SCAN_SECTOR) {
                  tooltip = currentPlayer.credits < 1 || currentPlayer.energy < 2
                    ? 'Nécessite 1 crédit et 2 énergies (vous avez ' + currentPlayer.credits + ' crédit(s) et ' + currentPlayer.energy + ' énergie(s))'
                    : 'Scanner un secteur (coût: 1 crédit, 2 énergies)';
                } else if (actionType === ActionType.ANALYZE_DATA) {
                  tooltip = !currentPlayer.dataComputer.canAnalyze
                    ? 'Nécessite des données à analyser dans l\'ordinateur de données'
                    : currentPlayer.energy < 1
                    ? 'Nécessite 1 énergie (vous avez ' + currentPlayer.energy + ')'
                    : 'Analyser des données (coût: 1 énergie)';
                } else if (actionType === ActionType.RESEARCH_TECH) {
                  tooltip = currentPlayer.mediaCoverage < 6
                    ? 'Nécessite 6 points de couverture médiatique (vous avez ' + currentPlayer.mediaCoverage + ')'
                    : 'Rechercher une technologie (coût: 6 couverture médiatique)';
                } else if (actionType === ActionType.PLAY_CARD) {
                  tooltip = currentPlayer.cards.length === 0
                    ? 'Aucune carte en main'
                    : 'Jouer une carte de votre main';
                }

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

