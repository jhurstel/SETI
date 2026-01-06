import { Game, ActionType } from '../core/types';
import { ProbeSystem } from '../systems/ProbeSystem';

interface PlayerBoardProps {
  game: Game;
  onAction?: (actionType: ActionType) => void;
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

export const PlayerBoard: React.FC<PlayerBoardProps> = ({ game, onAction }) => {
  const currentPlayer = game.players[game.currentPlayerIndex];

  const hasProbeOnPlanetInfo = ProbeSystem.probeOnPlanetInfo(game, currentPlayer.id);

  const actionAvailability: Record<ActionType, boolean> = {
    [ActionType.LAUNCH_PROBE]: ProbeSystem.canLaunchProbe(game, currentPlayer.id).canLaunch,
    [ActionType.ORBIT]: currentPlayer.probes.some(probe => ProbeSystem.canOrbit(game, currentPlayer.id, probe.id).canOrbit),
    [ActionType.LAND]: currentPlayer.probes.some(probe => ProbeSystem.canLand(game, currentPlayer.id, probe.id).canLand),
    [ActionType.SCAN_SECTOR]: false, // TODO
    [ActionType.ANALYZE_DATA]: false, // TODO
    [ActionType.PLAY_CARD]: false, // TODO
    [ActionType.RESEARCH_TECH]: false, // TODO
    [ActionType.PASS]: true,
  };

  // Fonction helper pour générer le tooltip basé sur l'état du jeu (Interaction Engine -> UI)
  const getActionTooltip = (actionType: ActionType, available: boolean): string => {
    // Si l'action est disponible, on peut retourner une description simple ou rien
    if (available) {
       // On pourrait ajouter des descriptions génériques ici si voulu
       return ACTION_NAMES[actionType];
    }

    switch (actionType) {
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

      case ActionType.LAUNCH_PROBE:
        if (currentPlayer.credits < 2) return `Nécessite 2 crédits (vous avez ${currentPlayer.credits})`;
        return 'Lancer une sonde depuis la Terre (coût: 2 crédits)';

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
