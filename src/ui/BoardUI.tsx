import React, { useRef, useState } from 'react';
import { Game, ActionType } from '../core/types';
import { SolarSystemBoard, SolarSystemBoardRef } from './SolarSystemBoard';
import { TechnologyBoardUI } from './TechnologyBoardUI';
import { PlayerBoard } from './PlayerBoard';
import { LaunchProbeAction } from '../actions/LaunchProbeAction';
import { GameEngine } from '../core/Game';

interface BoardUIProps {
  game: Game;
}

export const BoardUI: React.FC<BoardUIProps> = ({ game: initialGame }) => {
  // État pour le jeu
  const [game, setGame] = useState<Game>(initialGame);
  const gameEngineRef = useRef<GameEngine | null>(null);
  
  // Initialiser le GameEngine
  if (!gameEngineRef.current) {
    gameEngineRef.current = new GameEngine(game);
  }

  // Ref pour contrôler le plateau solaire
  const solarSystemRef = useRef<SolarSystemBoardRef>(null);

  // Gestionnaire pour les actions
  const handleAction = (actionType: ActionType) => {
    if (!gameEngineRef.current) return;

    // Synchroniser l'état de GameEngine avec le jeu actuel (pour préserver les angles de rotation)
    gameEngineRef.current.setState(game);

    const currentPlayer = game.players[game.currentPlayerIndex];
    
    if (actionType === ActionType.LAUNCH_PROBE) {
      const action = new LaunchProbeAction(currentPlayer.id);
      const result = gameEngineRef.current.executeAction(action);
      if (result.success && result.updatedState) {
        console.log('Sonde lancée, nouvelles sondes:', result.updatedState.board.solarSystem.probes);
        setGame(result.updatedState);
      } else {
        console.error('Erreur lors du lancement de la sonde:', result.error);
        alert(result.error || 'Impossible de lancer la sonde');
      }
    }
    // TODO: Gérer les autres actions
  };

  // Utiliser les positions initiales depuis le jeu
  const initialSector1 = game.board.solarSystem.initialSectorLevel1 || 1;
  const initialSector2 = game.board.solarSystem.initialSectorLevel2 || 1;
  const initialSector3 = game.board.solarSystem.initialSectorLevel3 || 1;

  // Utiliser les angles initiaux depuis le jeu
  const initialAngle1 = game.board.solarSystem.initialAngleLevel1 || 0;
  const initialAngle2 = game.board.solarSystem.initialAngleLevel2 || 0;
  const initialAngle3 = game.board.solarSystem.initialAngleLevel3 || 0;

  // Obtenir les angles actuels depuis le jeu, ou utiliser les angles initiaux
  const getCurrentAngle1 = () => {
    return game.board.solarSystem.rotationAngleLevel1 ?? initialAngle1;
  };
  const getCurrentAngle2 = () => {
    return game.board.solarSystem.rotationAngleLevel2 ?? initialAngle2;
  };
  const getCurrentAngle3 = () => {
    return game.board.solarSystem.rotationAngleLevel3 ?? initialAngle3;
  };

  // Fonction pour mettre à jour les angles de rotation dans l'état du jeu
  const updateRotationAngles = (level1: number, level2: number, level3: number) => {
    setGame(prevGame => ({
      ...prevGame,
      board: {
        ...prevGame.board,
        solarSystem: {
          ...prevGame.board.solarSystem,
          rotationAngleLevel1: level1,
          rotationAngleLevel2: level2,
          rotationAngleLevel3: level3,
        }
      }
    }));
  };

  // Handlers pour les boutons de rotation
  const handleRotateLevel1 = () => {
    solarSystemRef.current?.rotateCounterClockwise1();
    // Mettre à jour l'angle dans l'état du jeu
    const currentAngle1 = getCurrentAngle1();
    const currentAngle2 = getCurrentAngle2();
    const currentAngle3 = getCurrentAngle3();
    updateRotationAngles(currentAngle1 - 45, currentAngle2 - 45, currentAngle3 - 45);
  };

  const handleRotateLevel2 = () => {
    solarSystemRef.current?.rotateCounterClockwise2();
    // Mettre à jour l'angle dans l'état du jeu
    const currentAngle2 = getCurrentAngle2();
    const currentAngle3 = getCurrentAngle3();
    updateRotationAngles(
      getCurrentAngle1(),
      currentAngle2 - 45,
      currentAngle3 - 45
    );
  };

  const handleRotateLevel3 = () => {
    solarSystemRef.current?.rotateCounterClockwise3();
    // Mettre à jour l'angle dans l'état du jeu
    const currentAngle3 = getCurrentAngle3();
    updateRotationAngles(
      getCurrentAngle1(),
      getCurrentAngle2(),
      currentAngle3 - 45
    );
  };

  return (
    <div className="seti-root">
      <div className="seti-root-inner">
        <div className="seti-board-layout">
          <TechnologyBoardUI game={game} />
          <div style={{ position: 'relative', height: '100%', width: '100%', overflow: 'visible' }}>
            <SolarSystemBoard ref={solarSystemRef} game={game} initialSector1={initialSector1} initialSector2={initialSector2} initialSector3={initialSector3} />
            {/* Boutons de rotation des plateaux */}
            <div style={{
              position: 'absolute',
              top: '10px',
              left: '10px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              zIndex: 1000,
            }}>
              <button
                onClick={handleRotateLevel1}
                style={{
                  backgroundColor: '#ffd700',
                  color: '#000',
                  border: '2px solid #ffed4e',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  fontSize: '0.9rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  const target = e.currentTarget as HTMLButtonElement;
                  target.style.backgroundColor = '#ffed4e';
                  target.style.transform = 'scale(1.05)';
                }}
                onMouseLeave={(e) => {
                  const target = e.currentTarget as HTMLButtonElement;
                  target.style.backgroundColor = '#ffd700';
                  target.style.transform = 'scale(1)';
                }}
              >
                Tourner Niveau 1
              </button>
              <button
                onClick={handleRotateLevel2}
                style={{
                  backgroundColor: '#ff6b6b',
                  color: '#fff',
                  border: '2px solid #ff8e8e',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  fontSize: '0.9rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  const target = e.currentTarget as HTMLButtonElement;
                  target.style.backgroundColor = '#ff8e8e';
                  target.style.transform = 'scale(1.05)';
                }}
                onMouseLeave={(e) => {
                  const target = e.currentTarget as HTMLButtonElement;
                  target.style.backgroundColor = '#ff6b6b';
                  target.style.transform = 'scale(1)';
                }}
              >
                Tourner Niveau 2
              </button>
              <button
                onClick={handleRotateLevel3}
                style={{
                  backgroundColor: '#4a9eff',
                  color: '#fff',
                  border: '2px solid #6bb3ff',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  fontSize: '0.9rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  const target = e.currentTarget as HTMLButtonElement;
                  target.style.backgroundColor = '#6bb3ff';
                  target.style.transform = 'scale(1.05)';
                }}
                onMouseLeave={(e) => {
                  const target = e.currentTarget as HTMLButtonElement;
                  target.style.backgroundColor = '#4a9eff';
                  target.style.transform = 'scale(1)';
                }}
              >
                Tourner Niveau 3
              </button>
            </div>
          </div>
        </div>
        <PlayerBoard game={game} onAction={handleAction} />
      </div>
    </div>
  );
};

