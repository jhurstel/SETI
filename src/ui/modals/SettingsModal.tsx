import React, { useState, useEffect } from 'react';
import { Game, InteractionState } from '../../core/types';
import { HistoryEntry } from '../HistoryBoardUI';
import { GameFactory } from '../../core/GameFactory';
import { GameEngine } from '../../core/Game';
import { NewGameModal } from './NewGameModal';
import './SettingsModal.css';

interface SettingsModalProps {
  visible: boolean;
  setVisible: (visible: boolean) => void;
  game: Game | null;
  setGame: (game: Game) => void;
  gameEngineRef: React.MutableRefObject<GameEngine | null>;
  historyLog: HistoryEntry[];
  setHistoryLog: React.Dispatch<React.SetStateAction<HistoryEntry[]>>;
  setInteractionState: (state: InteractionState) => void;
  setPendingInteractions: (interactions: InteractionState[]) => void;
  setToast: (toast: { message: string; visible: boolean } | null) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ 
  visible, 
  setVisible, 
  game, 
  setGame, 
  gameEngineRef, 
  historyLog, 
  setHistoryLog, 
  setInteractionState, 
  setPendingInteractions, 
  setToast 
}) => {
  const [newGameModalVisible, setNewGameModalVisible] = useState(false);
  const [hasAutosave, setHasAutosave] = useState(false);

  // Vérifier s'il y a une sauvegarde automatique au démarrage ou à l'ouverture
  useEffect(() => {
    const saved = localStorage.getItem('seti_autosave');
    setHasAutosave(!!saved);
  }, [visible]);

  const handleNewGameRequest = () => {
      setNewGameModalVisible(true);
      setVisible(false);
  };

  const handleNewGameConfirm = (playerCount: number, difficulty: string, isFirstPlayer: boolean) => {
      try {
          const robotNamesPool = ['R2-D2', 'C-3PO', 'HAL 9000', 'Wall-E', 'T-800', 'Data', 'Bender', 'Marvin', 'Bishop', 'GLaDOS', 'Auto', 'EVE'];
          const shuffledRobots = [...robotNamesPool].sort(() => 0.5 - Math.random());
          difficulty;

          const playerNames = ['Thierry'];
          for (let i = 1; i < playerCount; i++) {
              playerNames.push(shuffledRobots[i-1]);
          }
          
          let newGame = GameFactory.createGame(playerNames, isFirstPlayer);
          
          // Configure players based on selection
          newGame.players[0].type = 'human';
          for(let i=1; i<newGame.players.length; i++) {
              newGame.players[i].type = 'robot';
          }

          newGame = GameFactory.initializeGame(newGame);
          
          setGame(newGame);
          if (gameEngineRef.current) {
              gameEngineRef.current.setState(newGame);
          } else {
              gameEngineRef.current = new GameEngine(newGame);
          }
          
          // Reset logs and history
          if (newGame.gameLog && newGame.gameLog.length > 0) {
            setHistoryLog(newGame.gameLog.map(log => ({
              id: log.id,
              message: log.message,
              playerId: log.playerId,
              timestamp: log.timestamp,
              previousInteractionState: { type: 'IDLE' },
              previousPendingInteractions: [],
              sequenceId: log.sequenceId,
              previousState: log.previousState
            })));
          } else {
            setHistoryLog([]);
          }
          setInteractionState({ type: 'IDLE' });
          setPendingInteractions([]);
          
          setNewGameModalVisible(false);
          setToast({ message: "Nouvelle partie commencée !", visible: true });
      } catch (e) {
          console.error(e);
          setToast({ message: "Erreur lors de la création de la partie", visible: true });
      }
  };

  const handleSaveGame = async () => {
      if (!game) return;
      try {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { history, ...cleanGame } = game;

          // Préparer l'objet à sauvegarder avec l'historique à jour
          const gameToSave = { 
              ...cleanGame,
              gameLog: historyLog.map((entry, index) => {
                  const isLast = index === historyLog.length - 1;
                  let cleanPreviousState = undefined;
                  if (isLast && entry.previousState) {
                      // eslint-disable-next-line @typescript-eslint/no-unused-vars
                      const { gameLog, history, ...rest } = entry.previousState as any;
                      cleanPreviousState = rest;
                  }
                  return {
                      id: entry.id,
                      message: entry.message,
                      timestamp: entry.timestamp,
                      playerId: entry.playerId,
                      sequenceId: entry.sequenceId,
                      previousState: cleanPreviousState
                  };
              })
          };
          const gameState = JSON.stringify(gameToSave, null, 2);

          // Utiliser l'API File System Access si disponible pour ouvrir une boîte de dialogue "Enregistrer sous"
          // @ts-ignore
          if (window.showSaveFilePicker) {
              try {
                  // @ts-ignore
                  const handle = await window.showSaveFilePicker({
                      suggestedName: `seti_save_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`,
                      types: [{
                          description: 'Sauvegarde SETI',
                          accept: { 'application/json': ['.json'] },
                      }],
                  });
                  const writable = await handle.createWritable();
                  await writable.write(gameState);
                  await writable.close();
                  setVisible(false);
                  return;
              } catch (err: any) {
                  if (err.name === 'AbortError') return; // Annulation utilisateur
                  // Sinon continuer vers le fallback
              }
          }

          const blob = new Blob([gameState], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `seti_save_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
          a.style.display = 'none';
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }, 100);
          setVisible(false);
      } catch (e) {
          setToast({ message: "Erreur lors de la sauvegarde: " + e, visible: true });
      }
  };

  const handleLoadGame = () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.style.display = 'none';
      document.body.appendChild(input);
      input.onchange = (e) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (!file) {
            document.body.removeChild(input);
            return;
          }

          const reader = new FileReader();
          reader.onload = (event) => {
              try {
                  const savedState = event.target?.result as string;
                  if (savedState) {
                      const loadedGame = JSON.parse(savedState);
                      if (!loadedGame.history) {
                          loadedGame.history = [];
                      }
                      setGame(loadedGame);
                      if (gameEngineRef.current) {
                          gameEngineRef.current.setState(loadedGame);
                      } else {
                          gameEngineRef.current = new GameEngine(loadedGame);
                      }
                      
                      if (loadedGame.gameLog) {
                          setHistoryLog(loadedGame.gameLog.map((l: any) => ({
                              id: l.id,
                              message: l.message,
                              playerId: l.playerId,
                              timestamp: l.timestamp,
                              previousInteractionState: { type: 'IDLE' },
                              previousPendingInteractions: [],
                              sequenceId: l.sequenceId,
                              previousState: l.previousState
                          })));
                      } else {
                          setHistoryLog([]);
                      }
                      
                      setVisible(false);
                  }
              } catch (e) {
                  console.error(e);
                  setToast({ message: "Erreur lors du chargement.", visible: true });
              }
              document.body.removeChild(input);
          };
          reader.readAsText(file);
      };
      input.click();
  };

  const handleContinue = () => {
      try {
          const savedState = localStorage.getItem('seti_autosave');
          if (savedState) {
              const loadedGame = JSON.parse(savedState);
              if (!loadedGame.history) {
                  loadedGame.history = [];
              }
              setGame(loadedGame);
              if (gameEngineRef.current) {
                  gameEngineRef.current.setState(loadedGame);
              } else {
                  gameEngineRef.current = new GameEngine(loadedGame);
              }
              
              if (loadedGame.gameLog) {
                  setHistoryLog(loadedGame.gameLog.map((l: any) => ({
                      id: l.id,
                      message: l.message,
                      playerId: l.playerId,
                      timestamp: l.timestamp,
                      previousInteractionState: { type: 'IDLE' },
                      previousPendingInteractions: [],
                      sequenceId: l.sequenceId,
                      previousState: l.previousState
                  })));
              } else {
                  setHistoryLog([]);
              }
              
              setVisible(false);
          }
      } catch (e) {
          console.error(e);
          setToast({ message: "Erreur lors de la restauration.", visible: true });
      }
  };

  return (
    <>
      {visible && (
        <div className="seti-modal-overlay" style={{ zIndex: 2000 }}>
          <div className="seti-modal-content seti-settings-modal">
            <h2 className="seti-modal-title">Menu Principal</h2>
            <div className="seti-modal-buttons-vertical">
              {hasAutosave && <button onClick={handleContinue} className="seti-modal-btn primary">Continuer la partie</button>}
              <button onClick={handleNewGameRequest} className={`seti-modal-btn ${!hasAutosave ? 'primary' : ''}`}>Nouvelle Partie</button>
              <button onClick={handleSaveGame} className="seti-modal-btn">Sauvegarder Partie</button>
              <button onClick={handleLoadGame} className="seti-modal-btn">Restaurer Partie</button>
              {game && <button onClick={() => setVisible(false)} className="seti-modal-btn secondary">Fermer</button>}
            </div>
          </div>
        </div>
      )}
      <NewGameModal
        visible={newGameModalVisible}
        onConfirm={handleNewGameConfirm}
        onCancel={() => { setNewGameModalVisible(false); setVisible(true); }}
      />
    </>
  );
};
