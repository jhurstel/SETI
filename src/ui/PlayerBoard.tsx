import React, { useMemo } from 'react';
import { Game, ActionType } from '../core/types';
import { createRotationState, getObjectPosition } from '../core/SolarSystemPosition';

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

  // Calculer l'état de rotation actuel
  const rotationState = useMemo(() => {
    return createRotationState(
      game.board.solarSystem.rotationAngleLevel1 || 0,
      game.board.solarSystem.rotationAngleLevel2 || 0,
      game.board.solarSystem.rotationAngleLevel3 || 0
    );
  }, [
    game.board.solarSystem.rotationAngleLevel1,
    game.board.solarSystem.rotationAngleLevel2,
    game.board.solarSystem.rotationAngleLevel3
  ]);

  // Vérifier si le joueur a une sonde sur une planète autre que la Terre et obtenir les infos de la planète
  const probeOnPlanetInfo = useMemo(() => {
    const playerProbes = game.board.solarSystem.probes.filter(
      probe => probe.ownerId === currentPlayer.id && probe.solarPosition
    );

    // Liste des planètes (sans la Terre)
    const planets = ['venus', 'mercury', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];
    
    for (const probe of playerProbes) {
      if (!probe.solarPosition) continue;
      
      // Vérifier si la sonde est sur une planète
      for (const planetId of planets) {
        const planetPos = getObjectPosition(planetId, rotationState);
        if (planetPos && 
            planetPos.disk === probe.solarPosition.disk && 
            planetPos.absoluteSector === probe.solarPosition.sector) {
          // Trouver la planète dans le jeu pour vérifier les orbiteurs
          const planet = game.board.planets.find(p => p.id === planetId);
          const hasOrbiter = planet && planet.orbiters.length > 0;
          return { hasProbe: true, planetId, hasOrbiter };
        }
      }
    }
    
    return { hasProbe: false, planetId: null, hasOrbiter: false };
  }, [game.board.solarSystem.probes, game.board.planets, currentPlayer.id, rotationState]);

  const hasProbeOnOtherPlanet = probeOnPlanetInfo.hasProbe;

  // Vérifier si le joueur a la technologie exploration 3
  // La technologie exploration 3 est la 3ème technologie dans la catégorie EXPLORATION du technologyBoard
  const hasExploration3 = useMemo(() => {
    const explorationSlot = game.board.technologyBoard.categorySlots?.find(
      slot => slot.category === 'EXPLORATION'
    );
    if (!explorationSlot || explorationSlot.technologies.length < 3) {
      return false;
    }
    // La 3ème technologie d'exploration (index 2)
    const exploration3Tech = explorationSlot.technologies[2];
    // Vérifier si le joueur possède cette technologie
    return currentPlayer.technologies.some(
      tech => tech.id === exploration3Tech.id
    );
  }, [game.board.technologyBoard.categorySlots, currentPlayer.technologies]);

  // Vérification simple de disponibilité des actions
  const canLaunchProbe = currentPlayer.credits >= 2;
  const canScan = currentPlayer.credits >= 1 && currentPlayer.energy >= 2;
  const canResearch = currentPlayer.mediaCoverage >= 6;
  const canAnalyze = currentPlayer.dataComputer.canAnalyze && currentPlayer.energy >= 1;
  
  // ORBIT nécessite : une sonde sur une planète autre que la Terre + crédits >= 1 et énergie >= 1
  const canOrbit = hasProbeOnOtherPlanet && currentPlayer.credits >= 1 && currentPlayer.energy >= 1;
  const orbitTooltip = !hasProbeOnOtherPlanet 
    ? 'Nécessite une sonde sur une planète autre que la Terre'
    : currentPlayer.credits < 1 
    ? 'Nécessite 1 crédit (vous avez ' + currentPlayer.credits + ')'
    : currentPlayer.energy < 1
    ? 'Nécessite 1 énergie (vous avez ' + currentPlayer.energy + ')'
    : 'Mettre une sonde en orbite (coût: 1 crédit, 1 énergie)';
  
  // LAND nécessite : une sonde sur une planète autre que la Terre + coût variable en crédits
  // Coût de base : 3 crédits si pas d'orbiteur, 2 crédits si orbiteur présent
  // Réduction de 1 crédit si technologie exploration 3
  const landBaseCost = probeOnPlanetInfo.hasOrbiter ? 2 : 3;
  const landCost = Math.max(0, landBaseCost - (hasExploration3 ? 1 : 0));
  const canLand = hasProbeOnOtherPlanet && currentPlayer.credits >= landCost;
  
  const landTooltip = !hasProbeOnOtherPlanet
    ? 'Nécessite une sonde sur une planète autre que la Terre'
    : currentPlayer.credits < landCost
    ? `Nécessite ${landCost} crédit(s) (vous avez ${currentPlayer.credits})${hasExploration3 ? ' [Réduction exploration 3 appliquée]' : ''}`
    : `Poser une sonde sur une planète (coût: ${landCost} crédit(s)${probeOnPlanetInfo.hasOrbiter ? ', orbiteur présent' : ''}${hasExploration3 ? ', réduction exploration 3' : ''})`;

  const actionAvailability: Record<ActionType, boolean> = {
    [ActionType.LAUNCH_PROBE]: canLaunchProbe,
    [ActionType.MOVE_PROBE]: currentPlayer.energy > 0,
    [ActionType.ORBIT]: canOrbit,
    [ActionType.LAND]: canLand,
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
            {Object.entries(ACTION_NAMES)
              .filter(([action]) => action !== ActionType.MOVE_PROBE) // Exclure "Déplacer une sonde" car c'est une action gratuite
              .map(([action, name]) => {
                const available = actionAvailability[action as ActionType];
                const actionType = action as ActionType;
                
                // Déterminer le tooltip selon l'action
                let tooltip = '';
                if (actionType === ActionType.ORBIT) {
                  tooltip = orbitTooltip;
                } else if (actionType === ActionType.LAND) {
                  tooltip = landTooltip;
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

