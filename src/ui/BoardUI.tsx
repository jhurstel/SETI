import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Game, ActionType, DiskName, SectorNumber, FreeActionType, GAME_CONSTANTS, SectorType, Bonus, Technology, RevenueType, ProbeState, TechnologyCategory, GOLDEN_MILESTONES, NEUTRAL_MILESTONES, CardType, LifeTraceType, Mission, InteractionState, GamePhase } from '../core/types';
import { SolarSystemBoardUI } from './SolarSystemBoardUI';
import { TechnologyBoardUI } from './TechnologyBoardUI';
import { PlayerBoardUI } from './PlayerBoardUI';
import { ActionValidator } from '../core/ActionValidator';
import { LaunchProbeAction } from '../actions/LaunchProbeAction';
import { AnalyzeDataAction } from '../actions/AnalyzeDataAction';
import { LandAction } from '../actions/LandAction';
import { MoveProbeAction } from '../actions/MoveProbeAction';
import { OrbitAction } from '../actions/OrbitAction';
import { PassAction } from '../actions/PassAction';
import { PlayCardAction } from '../actions/PlayCardAction';
import { ResearchTechAction } from '../actions/ResearchTechAction';
import { ScanSectorAction } from '../actions/ScanSectorAction';
import { GameEngine } from '../core/Game';
import { GameFactory } from '../core/GameFactory';
import { ProbeSystem } from '../systems/ProbeSystem';
import { createRotationState, getCell, getObjectPosition, FIXED_OBJECTS, INITIAL_ROTATING_LEVEL1_OBJECTS, INITIAL_ROTATING_LEVEL2_OBJECTS, INITIAL_ROTATING_LEVEL3_OBJECTS, getAbsoluteSectorForProbe, performRotation } from '../core/SolarSystemPosition';
import { CardSystem } from '../systems/CardSystem';
import { ResourceSystem } from '../systems/ResourceSystem';
import { TechnologySystem } from '../systems/TechnologySystem';
import { ScanSystem } from '../systems/ScanSystem';
import { SpeciesSystem } from '../systems/SpeciesSystem';
import { AIBehavior } from '../ai/AIBehavior';
import { DebugPanel } from './DebugPanel';
import { PassModal } from './modals/PassModal';
import { ConfirmModal, AlienDiscoveryModal, MediaOrMoveModal, Observation2Modal, Observation3Modal, Observation4Modal, BonusChoiceModal, EndGameModal } from './modals/GameModals';
import { Tooltip } from './Tooltip';
import { ObjectiveBoardUI } from './ObjectiveBoardUI';
import { HistoryBoardUI, HistoryEntry } from './HistoryBoardUI';
import { CardRowUI } from './CardRowUI';
import { AlienBoardUI } from './AlienBoardUI';
import { SettingsModal } from './modals/SettingsModal';
import { NewGameModal } from './modals/NewGameModal';
import './BoardUI.css';

interface BoardUIProps {
  game?: Game;
}

// Helper pour les libellés des interactions
const getInteractionLabel = (state: InteractionState): string => {
  switch (state.type) {
    case 'RESERVING_CARD': return `Veuillez réservez ${state.count} carte${state.count > 1 ? 's' : ''}.`;
    case 'DISCARDING_CARD': return `Veuillez défausser ${state.count} carte${state.count > 1 ? 's' : ''}.`;
    case 'TRADING_CARD': return `Veuillez échanger ${state.count} carte${state.count > 1 ? 's' : ''} pour gagner ${state.targetGain}.`;
    case 'ACQUIRING_CARD': return state.isFree ? `Veuillez choisir ${state.count} carte${state.count > 1 ? 's' : ''}.` : `Veuillez acheter ${state.count} carte${state.count > 1 ? 's' : ''}.`;
    case 'MOVING_PROBE': return `Veuillez déplacer une sonde gratuitement (${state.count} déplacement${state.count > 1 ? 's' : ''}).`;
    case 'LANDING_PROBE': return `veuillez poser une sonde gratuitement.`;
    case 'ACQUIRING_TECH': return state.isBonus ? `Veuillez sélectionner une technologie ${state.category}.` : `Veuillez acheter une technologie ${state.category}.`;
    case 'SELECTING_COMPUTER_SLOT': return `Veuillez sélectionner un emplacement d'ordinateur pour technologie ${state.tech.shorttext}.`;
    case 'ANALYZING': return `Analyse en cours...`;
    case 'PLACING_LIFE_TRACE': return `Veuillez placer trace de vie (${state.color}).`;
    case 'PLACING_OBJECTIVE_MARKER': return `Veuillez placer un marqueur d'objectif pour avoir dépassé ${state.milestone} PV.`;
    case 'SELECTING_SCAN_CARD': return `Veuillez sélectionner une carte de la rangée pour marquer un signal.`;
    case 'SELECTING_SCAN_SECTOR': return `Veuillez sélectionner un secteur ${state.color} pour marquer un signal.`;
    case 'CHOOSING_MEDIA_OR_MOVE': return `Veuillez sélectionner le bonus de la carte 19.`;
    case 'CHOOSING_OBS2_ACTION': return `Veuillez sélectionner le bonus de technologie Observation II.`;
    case 'CHOOSING_OBS3_ACTION': return `Veuillez sélectionner le bonus de technologie Observation III.`;
    case 'CHOOSING_OBS4_ACTION': return `Veuillez sélectionner le bonus de technologie Observation IV.`;
    case 'DISCARDING_FOR_SIGNAL': return `Veuillez défausser ${state.count} carte${state.count > 1 ? 's' : ''} pour marquer un signal.`;
    case 'REMOVING_ORBITER': return "Veuillez retirer un orbiteur (bonus carte 15).";
    case 'CHOOSING_BONUS_ACTION': return `Veuillez choisir la prochaine action.`;
    default: return "Action inconnue";
  }
};

export const BoardUI: React.FC<BoardUIProps> = ({ game: initialGame }) => {
  // États pour le jeu
  const [game, setGame] = useState<Game | null>(null);
  const gameEngineRef = useRef<GameEngine | null>(null);

  // Ref pour accéder à l'état du jeu le plus récent dans les callbacks
  const gameRef = useRef(game);
  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  // Initialiser le GameEngine
  if (!gameEngineRef.current && game) {
    gameEngineRef.current = new GameEngine(game);
  }

  // États pour l'UI
  const [toast, setToast] = useState<{ message: string; visible: boolean } | null>(null);
  const [historyLog, setHistoryLog] = useState<HistoryEntry[]>([]);
  const [interactionState, setInteractionState] = useState<InteractionState>({ type: 'IDLE' });
  const [pendingInteractions, setPendingInteractions] = useState<InteractionState[]>([]);
  const [viewedPlayerId, setViewedPlayerId] = useState<string | null>(null);
  const [alienDiscoveryNotification, setAlienDiscoveryNotification] = useState<{ visible: boolean; message: string } | null>(null);
  const [activeTooltip, setActiveTooltip] = useState<{ content: React.ReactNode, rect: DOMRect, pointerEvents?: 'none' | 'auto', onMouseEnter?: () => void, onMouseLeave?: () => void } | null>(null);
  const [passModalState, setPassModalState] = useState<{ visible: boolean; cards: any[]; selectedCardId: string | null; cardsToKeep?: string[] }>({ visible: false, cards: [], selectedCardId: null });
  const [confirmModalState, setConfirmModalState] = useState<{ visible: boolean; cardId: string | null; message: string; onConfirm?: () => void }>({ visible: false, cardId: null, message: '', onConfirm: undefined });
  const [settingsVisible, setSettingsVisible] = useState(true); // Open at launch
  const [newGameModalVisible, setNewGameModalVisible] = useState(false);
  const [hasAutosave, setHasAutosave] = useState(false);

  // Effet pour afficher un message toast si l'interaction en contient un
  useEffect(() => {
    if (interactionState.type === 'IDLE') {
      setToast({ message: 'Veuillez sélectionner une action (principale, gratuite ou passer au joueur suivant).', visible: true });
    } else {
      setToast({ message: getInteractionLabel(interactionState), visible: true });
    }
  }, [interactionState]);

  // Effet pour la réservation initiale (Setup) pour le joueur humain
  useEffect(() => {
    if (game && game.phase === GamePhase.SETUP && interactionState.type === 'IDLE') {
        const currentPlayer = game.players[game.currentPlayerIndex];
        if (currentPlayer.type === 'human') {
            setInteractionState({ type: 'RESERVING_CARD', count: 1, selectedCards: [] });
            setViewedPlayerId(currentPlayer.id);
        }
    }
  }, [game, interactionState.type, game?.currentPlayerIndex]);

  // Vérifier s'il y a une sauvegarde automatique au démarrage
  useEffect(() => {
    const saved = localStorage.getItem('seti_autosave');
    setHasAutosave(!!saved);
  }, []);

  // Sauvegarde automatique à chaque modification du jeu
  useEffect(() => {
    if (game) {
      // Préparer l'objet à sauvegarder avec l'historique à jour
      const gameToSave = { 
          ...game,
          gameLog: historyLog.map(entry => ({
              id: entry.id,
              message: entry.message,
              timestamp: entry.timestamp,
              playerId: entry.playerId
          }))
      };
      // Sauvegarder l'état complet
      localStorage.setItem('seti_autosave', JSON.stringify(gameToSave));
      setHasAutosave(true);
    }
  }, [game, historyLog]);

  const handleNewGameRequest = () => {
      setNewGameModalVisible(true);
      setSettingsVisible(false);
  };

  const handleNewGameConfirm = (playerCount: number, difficulty: string, isFirstPlayer: boolean) => {
      try {
          const robotNamesPool = ['R2-D2', 'C-3PO', 'HAL 9000', 'Wall-E', 'T-800', 'Data', 'Bender', 'Marvin', 'Bishop', 'GLaDOS', 'Auto', 'EVE'];
          const shuffledRobots = [...robotNamesPool].sort(() => 0.5 - Math.random());

          const playerNames = ['Jérôme'];
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
              previousPendingInteractions: []
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
          // Préparer l'objet à sauvegarder avec l'historique à jour
          const gameToSave = { 
              ...game,
              gameLog: historyLog.map(entry => ({
                  id: entry.id,
                  message: entry.message,
                  timestamp: entry.timestamp,
                  playerId: entry.playerId
              }))
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
                  setSettingsVisible(false);
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
          setSettingsVisible(false);
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
                              previousPendingInteractions: []
                          })));
                      } else {
                          setHistoryLog([]);
                      }
                      
                      setSettingsVisible(false);
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
                      previousPendingInteractions: []
                  })));
              } else {
                  setHistoryLog([]);
              }
              
              setSettingsVisible(false);
          }
      } catch (e) {
          console.error(e);
          setToast({ message: "Erreur lors de la restauration.", visible: true });
      }
  };

  // Ref pour accéder à l'état d'interaction actuel dans addToHistory sans dépendance
  const interactionStateRef = useRef(interactionState);
  useEffect(() => { interactionStateRef.current = interactionState; }, [interactionState]);
  const pendingInteractionsRef = useRef(pendingInteractions);
  useEffect(() => { pendingInteractionsRef.current = pendingInteractions; }, [pendingInteractions]);

  // Helper pour ajouter une entrée à l'historique
  const addToHistory = useCallback((message: string, playerId?: string, previousState?: Game, customInteractionState?: InteractionState, sequenceId?: string) => {
    const entry: HistoryEntry = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      message,
      playerId,
      previousState,
      previousInteractionState: customInteractionState || interactionStateRef.current,
      previousPendingInteractions: pendingInteractionsRef.current,
      timestamp: Date.now(),
      sequenceId
    };
    setHistoryLog(prev => [...prev, entry]);
  }, []);

  // Gestionnaire pour annuler une action
  const handleUndo = () => {
    if (historyLog.length === 0) return;
    const lastEntry = historyLog[historyLog.length - 1];

    // Logique d'annulation de séquence (si sequenceId est présent)
    if (lastEntry.sequenceId) {
      // Trouver toutes les entrées de cette séquence
      const sequenceEntries = historyLog.filter(e => e.sequenceId === lastEntry.sequenceId);
      // L'état à restaurer est celui de la PREMIÈRE entrée de la séquence (l'action initiale)
      const firstEntry = sequenceEntries[0];

      if (firstEntry && firstEntry.previousState) {
        setGame(firstEntry.previousState);
        if (gameEngineRef.current) gameEngineRef.current.setState(firstEntry.previousState);

        // Supprimer toutes les entrées de la séquence
        setHistoryLog(prev => prev.filter(e => e.sequenceId !== lastEntry.sequenceId));

        // Restaurer les états depuis la première entrée
        setInteractionState(firstEntry.previousInteractionState || { type: 'IDLE' });
        if (firstEntry.previousPendingInteractions) {
          setPendingInteractions(firstEntry.previousPendingInteractions);
        }
      }
    } else if (lastEntry.previousState) {
      // Annulation standard (atomique)
      setGame(lastEntry.previousState);
      if (gameEngineRef.current) gameEngineRef.current.setState(lastEntry.previousState);
      setHistoryLog(prev => prev.slice(0, -1));
      setInteractionState(lastEntry.previousInteractionState || { type: 'IDLE' });

      if (lastEntry.previousPendingInteractions) {
        setPendingInteractions(lastEntry.previousPendingInteractions);
      }
    }
  };

  // Effet pour traiter la file d'attente des interactions (récompenses en chaîne) et le remplissage de la rangée
  useEffect(() => {
    if (interactionState.type === 'IDLE' && game) {
      if (pendingInteractions.length > 0) {
        const [next, ...rest] = pendingInteractions;
        setPendingInteractions(rest);
        setInteractionState(next);
      } else if (game.decks.cardRow.length < 3 && game.decks.cards.length > 0) {
        const updatedGame = CardSystem.refillCardRow(game);
        setGame(updatedGame);
        if (gameEngineRef.current) gameEngineRef.current.setState(updatedGame);
      }
    }
  }, [interactionState, pendingInteractions, game]);

  // Effet pour traiter les interactions non-bloquantes (effets de carte)
  useEffect(() => {
    if (interactionState.type === 'TRIGGER_CARD_EFFECT' && game) {
      const { effectType, value, sequenceId } = interactionState;
      const currentPlayer = game.players[game.currentPlayerIndex];
      let updatedGame = structuredClone(game);
      let player = updatedGame.players[updatedGame.currentPlayerIndex];
      let logMessage = "";

      // Carte 119 - PIXL
      if (effectType === 'SCORE_PER_MEDIA') {
        const pointsGained = player.mediaCoverage * value;
        if (pointsGained > 0) {
          player.score += pointsGained;
          logMessage = `gagne ${pointsGained} PV (Bonus PIXL)`;
        }
      }

      if (logMessage) {
        setGame(updatedGame);
        if (gameEngineRef.current) gameEngineRef.current.setState(updatedGame);
        addToHistory(logMessage, currentPlayer.id, game, undefined, sequenceId);
      }

      // Passer immédiatement à l'état suivant
      setInteractionState({ type: 'IDLE' });
    }
  }, [interactionState, game, addToHistory]);

  // Helper pour exécuter l'action Passer via PassAction
  const performPass = useCallback((cardsToKeep: string[], selectedCardId?: string) => {
    if (!gameEngineRef.current) return;

    // Synchroniser l'état
    const currentGame = gameRef.current;
    gameEngineRef.current.setState(currentGame);

    // Utiliser l'état du moteur pour garantir la cohérence
    const engineState = gameEngineRef.current.getState();
    const enginePlayer = engineState.players[engineState.currentPlayerIndex];

    const action = new PassAction(enginePlayer.id, cardsToKeep, selectedCardId);
    const result = gameEngineRef.current.executeAction(action);
    if (result.success && result.updatedState) {
      if (action.historyEntries) {
        action.historyEntries.forEach(e => addToHistory(e.message, e.playerId, result.updatedState));
      }

      // TODO: gerer la fin de partie
      // si newGame.phase === GamePhase.FINAL_SCORING
      
      setGame(result.updatedState);
    } else {
      console.error("Erreur lors de l'action Passer:", result.error);
      setToast({ message: `Erreur lors de l'action Passer: ${result.error}`, visible: true });
    }
  }, [addToHistory]);

  // Effet pour gérer le tour du joueur Mock
  useEffect(() => {
    if (!game) return;

    const currentPlayer = game.players[game.currentPlayerIndex];
    if (currentPlayer && currentPlayer.type === 'robot') {
      console.log(`[BoardUI] Robot ${currentPlayer.name} turn detected. Main action performed: ${currentPlayer.hasPerformedMainAction}`);
      // Synchroniser le moteur avec l'état actuel pour l'IA
      if (gameEngineRef.current) gameEngineRef.current.setState(game);

      const timer = setTimeout(() => {
        // Gestion de la phase de SETUP (Réservation)
        if (game.phase === GamePhase.SETUP) {
            const cardId = AIBehavior.decideReservation(game, currentPlayer);
            if (cardId) {
                let updatedGame = CardSystem.reserveCard(game, currentPlayer.id, cardId);
                
                // Logique de log pour la réservation (similaire à handleConfirmReservation)
                const card = currentPlayer.cards.find(c => c.id === cardId);
                let gainMsg = "";
                if (card) {
                    if (card.revenue === RevenueType.CREDIT) gainMsg = "1 Crédit";
                    else if (card.revenue === RevenueType.ENERGY) gainMsg = "1 Énergie";
                    else if (card.revenue === RevenueType.CARD) gainMsg = "1 Carte";
                    addToHistory(`réserve carte "${card.name}" et gagne ${gainMsg}`, currentPlayer.id, game);
                }

                // Passer au joueur suivant
                handleSetupNextPlayer(updatedGame);
            }
            return;
        }

        // Si le robot a déjà joué son action principale, il passe son tour
        if (currentPlayer.hasPerformedMainAction) {
          console.log(`[BoardUI] Robot ${currentPlayer.name} has already performed main action. Passing turn.`);
          handleNextPlayer();
          return;
        }

        // Décision de l'IA (Niveau FACILE)
        console.log(`[BoardUI] Requesting AI decision for ${currentPlayer.name}...`);
        const decision = AIBehavior.decideAction(game, currentPlayer, 'EASY');
        console.log(`[BoardUI] AI decision:`, decision);

        if (decision) {
          switch (decision.action) {
            case ActionType.LAUNCH_PROBE: {
              const action = new LaunchProbeAction(currentPlayer.id);
              const result = gameEngineRef.current!.executeAction(action);
              if (result.success && result.updatedState) {
                setGame(result.updatedState);
                if (action.historyEntries) {
                  action.historyEntries.forEach(e => addToHistory(e.message, e.playerId, game));
                }
              }
              break;
            }
            case ActionType.SCAN_SECTOR: {
              const action = new ScanSectorAction(currentPlayer.id);
              const result = gameEngineRef.current!.executeAction(action);
              
              if (result.success && result.updatedState) {
                let aiGame = result.updatedState;
                const sequenceId = `ai-scan-${Date.now()}`;
                
                if (action.historyEntries) {
                    action.historyEntries.forEach(e => addToHistory(e.message, e.playerId, game, undefined, sequenceId));
                }

                const queue = [...(action.newPendingInteractions || [])];
                
                while (queue.length > 0) {
                    const interaction = queue.shift()!;
                    
                    if (interaction.type === 'SELECTING_SCAN_SECTOR') {
                        // Filtre les secteurs déjà couverts
                        let validSectors = aiGame.board.sectors.filter(s => !s.isCovered);
                        
                        // Filtre les secteurs de la couleur demandée
                        if (interaction.color && interaction.color !== SectorType.ANY) {
                            validSectors = validSectors.filter(s => s.color === interaction.color);
                        }
                        
                        // Filtre les secteurs adjacents à la Terre
                        if (interaction.adjacents) {
                              const solarSystem = aiGame.board.solarSystem;
                              const earthPos = getObjectPosition('earth', solarSystem.rotationAngleLevel1, solarSystem.rotationAngleLevel2, solarSystem.rotationAngleLevel3);
                              if (earthPos) {
                                  validSectors = validSectors.filter(s => {
                                      const sNum = parseInt(s.id.replace('sector_', ''));
                                      const diff = Math.abs(earthPos.absoluteSector - sNum);
                                      return diff <= 1 || diff === 7;
                                  });
                              }
                        }
                        
                        if (validSectors.length > 0) {
                            const chosen = validSectors[Math.floor(Math.random() * validSectors.length)];
                            const initialLogs: string[] = [];
                            const stateBeforeStep = aiGame;

                            // Gestion de la défausse de carte (si issue de SELECTING_SCAN_CARD)
                            if (interaction.cardId) {
                                const { updatedGame, discardedCard } = CardSystem.discardFromRow(aiGame, interaction.cardId);
                                if (discardedCard) {
                                    aiGame = updatedGame;
                                    initialLogs.push(`défausse carte "${discardedCard.name}" (${discardedCard.scanSector}) de la rangée`);
                                }
                            }

                            const res = ScanSystem.performSignalAndCover(aiGame, currentPlayer.id, chosen.id, initialLogs, false, sequenceId);
                            aiGame = res.updatedGame;
                            res.historyEntries.forEach(e => addToHistory(e.message, e.playerId, stateBeforeStep, undefined, sequenceId));
                            if (res.newPendingInteractions) {
                                queue.unshift(...res.newPendingInteractions);
                            }
                        }
                    } else if (interaction.type === 'SELECTING_SCAN_CARD') {
                        const row = aiGame.decks.cardRow;
                        if (row.length > 0) {
                            const randomCard = row[Math.floor(Math.random() * row.length)];
                            queue.unshift({
                                type: 'SELECTING_SCAN_SECTOR',
                                color: randomCard.scanSector,
                                sequenceId: sequenceId,
                                cardId: randomCard.id
                            });
                        }
                    }
                }

                const pIndex = aiGame.players.findIndex(p => p.id === currentPlayer.id);
                if (pIndex !== -1) aiGame.players[pIndex].hasPerformedMainAction = true;

                setGame(aiGame);
                if (gameEngineRef.current) gameEngineRef.current.setState(aiGame);
              }
              break;
            }
            case ActionType.ANALYZE_DATA: {
              const action = new AnalyzeDataAction(currentPlayer.id);
              const result = gameEngineRef.current!.executeAction(action);
              if (result.success && result.updatedState) {
                // Simuler le choix de couleur aléatoire pour la trace
                const colors = [LifeTraceType.BLUE, LifeTraceType.RED, LifeTraceType.YELLOW];
                const randomColor = colors[Math.floor(Math.random() * colors.length)];
                const aiGame = result.updatedState;
                const board = aiGame.board.alienBoards[0]; // Toujours le premier plateau pour l'IA simple
                
                board.lifeTraces.push({
                  id: `trace-${Date.now()}`,
                  type: randomColor,
                  playerId: currentPlayer.id
                });
                
                setGame(aiGame);
                if (gameEngineRef.current) gameEngineRef.current.setState(aiGame);
                addToHistory(`analyse des données et place une trace ${randomColor}`, currentPlayer.id, game);
              }
              break;
            }
            case ActionType.RESEARCH_TECH: {
              const action = new ResearchTechAction(currentPlayer.id);
              const result = gameEngineRef.current!.executeAction(action);
              if (result.success && result.updatedState) {
                // Finaliser l'acquisition
                const { updatedGame } = TechnologySystem.acquireTechnology(result.updatedState, currentPlayer.id, decision.data.tech);
                setGame(updatedGame);
                if (gameEngineRef.current) gameEngineRef.current.setState(updatedGame);
                addToHistory(`recherche technologie "${decision.data.tech.name}"`, currentPlayer.id, game);
              }
              break;
            }
            case ActionType.PLAY_CARD: {
              const card = currentPlayer.cards.find(c => c.id === decision.data.cardId);
              if (card) {
                executePlayCard(card.id);
              }
              break;
            }
            case ActionType.ORBIT: {
              let { updatedGame } = ProbeSystem.orbitProbe(game, currentPlayer.id, decision.data.probeId, decision.data.planetId);
              const pIndex = updatedGame.players.findIndex(p => p.id === currentPlayer.id);
              if (pIndex !== -1) updatedGame.players[pIndex].hasPerformedMainAction = true;

              setGame(updatedGame);
              if (gameEngineRef.current) gameEngineRef.current.setState(updatedGame);
              addToHistory(`met une sonde en orbite`, currentPlayer.id, game);
              break;
            }
            case ActionType.LAND: {
              let { updatedGame } = ProbeSystem.landProbe(game, currentPlayer.id, decision.data.probeId, decision.data.planetId, false);
              const pIndex = updatedGame.players.findIndex(p => p.id === currentPlayer.id);
              if (pIndex !== -1) updatedGame.players[pIndex].hasPerformedMainAction = true;

              setGame(updatedGame);
              if (gameEngineRef.current) gameEngineRef.current.setState(updatedGame);
              addToHistory(`fait atterrir une sonde`, currentPlayer.id, game);
              break;
            }
            case ActionType.PASS: {
              performPass(decision.data.cardsToKeep);
              break;
            }
          }
        }
      }, 1500);
      return () => clearTimeout(timer);
    }
    return;
  }, [game, performPass, addToHistory]);

  // Gestionnaire pour passer au joueur suivant pendant la phase de SETUP
  const handleSetupNextPlayer = (currentGame: Game) => {
      let nextGame = { ...currentGame };
      let nextIndex = (nextGame.currentPlayerIndex + 1) % nextGame.players.length;
      
      if (nextIndex === nextGame.firstPlayerIndex) {
          nextGame.phase = GamePhase.PLAYING;
          nextGame.currentPlayerIndex = nextGame.firstPlayerIndex;
          addToHistory("--- DÉBUT DE LA PARTIE ---", undefined, nextGame);
          const firstPlayer = nextGame.players[nextGame.firstPlayerIndex];
          addToHistory(`--- Tour de ${firstPlayer.name} ---`, firstPlayer.id, nextGame);
      } else {
          nextGame.currentPlayerIndex = nextIndex;
      }
      
      setGame(nextGame);
      if (gameEngineRef.current) gameEngineRef.current.setState(nextGame);
  };

  // Gestionnaire pour passer au joueur suivant (fin de tour simple)
  const handleNextPlayer = () => {
    if (!gameEngineRef.current || !game) return;

    // Vérifier les paliers de score avant de passer au joueur suivant
    // Utiliser l'état du moteur pour avoir la version la plus à jour
    let currentState = gameEngineRef.current.getState();
    const currentPlayer = currentState.players[currentState.currentPlayerIndex];

    // Vérifier les paliers d'objectifs
    for (const m of GOLDEN_MILESTONES) {
      if (currentPlayer.score >= m && !currentPlayer.claimedGoldenMilestones.includes(m)) {
        setInteractionState({ type: 'PLACING_OBJECTIVE_MARKER', milestone: m });
        setToast({ message: `Palier de ${m} PV atteint ! Placez un marqueur sur un objectif.`, visible: true });
        return; // Interrompre le passage au joueur suivant
      }
    }

    // Vérifier les paliers neutres
    for (const m of NEUTRAL_MILESTONES) {
      if (currentPlayer.score >= m && !currentPlayer.claimedNeutralMilestones.includes(m)) {
        // Marquer comme réclamé pour ce joueur
        currentPlayer.claimedNeutralMilestones.push(m);

        // Utiliser SpeciesSystem pour la logique de placement
        const result = SpeciesSystem.placeNeutralMilestone(currentState, m);
       
        // Mettre à jour l'état local et le moteur
        const updatedGame = result.updatedGame;
        gameEngineRef.current.setState(updatedGame);
        
        interactionState.sequenceId = `neutral-${Date.now()}`

        // Traiter le code de retour
        if (result.code === 'PLACED' || result.code === 'DISCOVERED') {
            const { color } = result.data!;
            addToHistory(`déclenche un marqueur neutre (Palier ${m} PV) sur la trace ${color} du plateau Alien`, currentPlayer.id, currentState, undefined, interactionState.sequenceId);
            
            if (result.code === 'DISCOVERED') {
                setAlienDiscoveryNotification({ visible: true, message: "Découverte d'une nouvelle espèce Alien !" });
                setTimeout(() => setAlienDiscoveryNotification(null), 4000);
                addToHistory(`déclenche la découverte d'une nouvelle espèce Alien !`, currentPlayer.id, currentState, undefined, interactionState.sequenceId);
            }
        } else if (result.code === 'NO_SPACE') {
            addToHistory(`déclenche un marqueur neutre (Palier ${m} PV) mais aucun emplacement libre`, currentPlayer.id, currentState, undefined, interactionState.sequenceId);
        }
      }
    }

    // Applique la logique de passe au joueur suivant
    gameEngineRef.current.nextPlayer();

    // Sauvegarde l'état et réinitialise les interactions
    const nextState = gameEngineRef.current.getState();
    setGame(nextState);
    setInteractionState({ type: 'IDLE' });
    setPendingInteractions([]);
    setToast({ message: "Au tour du joueur suivant. Patientez...", visible: true });

    const nextPlayer = nextState.players[nextState.currentPlayerIndex];
    addToHistory(`--- Tour de ${nextPlayer.name} ---`, nextPlayer.id, nextState);
  };

  // Gestionnaire pour le clic sur une carte en mode défausse/échange/réservation/signal
  const handleCardClick = (cardId: string) => {
    if (!game) return;

    if (interactionState.type === 'DISCARDING_CARD') {
      const currentCards = interactionState.selectedCards;
      if (currentCards.includes(cardId)) {
        setInteractionState({ ...interactionState, selectedCards: currentCards.filter(id => id !== cardId) });
      } else {
        // Vérifier qu'on ne sélectionne pas plus que nécessaire
        const currentPlayer = game.players[game.currentPlayerIndex];
        const cardsToKeep = currentPlayer.cards.length - (currentCards.length + 1);
        if (cardsToKeep >= GAME_CONSTANTS.HAND_SIZE_AFTER_PASS) {
          setInteractionState({ ...interactionState, selectedCards: [...currentCards, cardId] });
        }
      }
    } else if (interactionState.type === 'TRADING_CARD') {
      const currentCards = interactionState.selectedCards;
      if (currentCards.includes(cardId)) {
        setInteractionState({ ...interactionState, selectedCards: currentCards.filter(id => id !== cardId) });
      } else if (currentCards.length < interactionState.count) {
        setInteractionState({ ...interactionState, selectedCards: [...currentCards, cardId] });
      }
    } else if (interactionState.type === 'RESERVING_CARD') {
      const currentCards = interactionState.selectedCards;
      if (currentCards.includes(cardId)) {
        setInteractionState({ ...interactionState, selectedCards: currentCards.filter(id => id !== cardId) });
      } else {
        // On peut sélectionner jusqu'à 'count' cartes
        // Si count est 1, on remplace la sélection
        if (interactionState.count === 1) {
          setInteractionState({ ...interactionState, selectedCards: [cardId] });
        } else if (currentCards.length < interactionState.count) {
          setInteractionState({ ...interactionState, selectedCards: [...currentCards, cardId] });
        }
      }
    } else if (interactionState.type === 'DISCARDING_FOR_SIGNAL') {
      const currentCards = interactionState.selectedCards;
      if (currentCards.includes(cardId)) {
        setInteractionState({ ...interactionState, selectedCards: currentCards.filter(id => id !== cardId) });
      } else {
        // On peut sélectionner jusqu'à 'count' cartes
        // Si count est 1, on remplace la sélection
        if (interactionState.count === 1) {
          setInteractionState({ ...interactionState, selectedCards: [cardId] });
        } else if (currentCards.length < interactionState.count) {
          setInteractionState({ ...interactionState, selectedCards: [...currentCards, cardId] });
        }
      }
    }
  };

  // Gestionnaire pour confirmer la défausse
  const handleConfirmDiscard = () => {
    if (!game) return;

    // Cas 1: Défausse pour fin de tour
    if (interactionState.type === 'DISCARDING_CARD') {
      const currentPlayer = game.players[game.currentPlayerIndex];
      const cardsToKeep = currentPlayer.cards.filter(c => !interactionState.selectedCards.includes(c.id)).map(c => c.id);

      // Réinitialiser l'état de défausse
      setInteractionState({ type: 'IDLE' });

      // Vérifier s'il y a un paquet de manche pour déclencher la modale (pas à la manche 5)
      const roundDeck = game.decks.roundDecks[game.currentRound];
      if (roundDeck && roundDeck.length > 0) {
        setPassModalState({ visible: true, cards: roundDeck, selectedCardId: null, cardsToKeep });
      } else {
        // S'il n'y a pas de paquet (ex: fin de la manche 5), on passe directement
        performPass(cardsToKeep);
      }
    }
    // Cas 2: Défausse pour signal
    else if (interactionState.type === 'DISCARDING_FOR_SIGNAL') {
      const currentPlayer = game.players[game.currentPlayerIndex];
      const sequenceId = interactionState.sequenceId;

      const selectedCards = interactionState.selectedCards;
      if (selectedCards.length === 0) {
        // Si aucune carte n'est sélectionnée, on annule/termine l'interaction sans rien faire
        setInteractionState({ type: 'IDLE' });
        addToHistory(`ne défausse aucune carte pour marquer des signaux`, currentPlayer.id, game, undefined, sequenceId);
        return;
      }

      let updatedGame = structuredClone(game);
      let updatedPlayer = updatedGame.players[updatedGame.currentPlayerIndex];

      const cardsToDiscard = updatedPlayer.cards.filter(c => selectedCards.includes(c.id));

      // Générer les interactions de signal pour chaque carte
      const newInteractions: InteractionState[] = [];

      cardsToDiscard.forEach(card => {
        newInteractions.push({ type: 'SELECTING_SCAN_SECTOR', color: card.scanSector, sequenceId, cardId: card.id });
      });

      setGame(updatedGame);
      if (gameEngineRef.current) gameEngineRef.current.setState(updatedGame);

      // Ajouter les interactions de marquage et lancer la première
      const [first, ...rest] = newInteractions;
      setInteractionState(first);
      setPendingInteractions(prev => [...rest, ...prev]);
    }
  };

  // Gestionnaire pour la réservation de carte
  const handleConfirmReservation = () => {
    if (!game) return;

    if (interactionState.type !== 'RESERVING_CARD') return;
    if (interactionState.selectedCards.length === 0) return;

    const updatedGame = { ...game };
    updatedGame.players = updatedGame.players.map(p => ({ ...p }));

    // Identifier le joueur concerné (celui qui possède la carte sélectionnée)
    const cardId = interactionState.selectedCards[0];
    let playerIndex = updatedGame.players.findIndex(p => p.cards.some(c => c.id === cardId));
    if (playerIndex === -1) {
      playerIndex = updatedGame.currentPlayerIndex;
    }
    let currentPlayer = updatedGame.players[playerIndex];

    currentPlayer.cards = [...currentPlayer.cards];
    currentPlayer.reservedCards = [...(currentPlayer.reservedCards || [])];

    // Traiter toutes les cartes sélectionnées
    for (const cardId of interactionState.selectedCards) {
      const cardIndex = currentPlayer.cards.findIndex(c => c.id === cardId);
      if (cardIndex === -1) continue;
      const card = currentPlayer.cards[cardIndex];

      if (!card.revenue) continue;

      // Retirer la carte
      const [reservedCard] = currentPlayer.cards.splice(cardIndex, 1);
      currentPlayer.reservedCards.push(reservedCard);

      // Appliquer le bonus
      let gainMsg = "";
      let drawnCardName = "";
      if (card.revenue === RevenueType.CREDIT) {
        currentPlayer.revenueCredits += 1;
        currentPlayer.credits += 1;
        gainMsg = ResourceSystem.formatResource(1, 'CREDIT');
      } else if (card.revenue === RevenueType.ENERGY) {
        currentPlayer.revenueEnergy += 1;
        currentPlayer.energy += 1;
        gainMsg = ResourceSystem.formatResource(1, 'ENERGY');
      } else if (card.revenue === RevenueType.CARD) {
        currentPlayer.revenueCards += 1;
        gainMsg = ResourceSystem.formatResource(1, 'CARD');
        
        // Pioche immédiate
        const res = CardSystem.drawCards(updatedGame, currentPlayer.id, 1, 'Bonus immédiat réservation');
        updatedGame.decks = res.decks;
        updatedGame.players = res.players;
        
        // Mettre à jour la référence locale du joueur et récupérer la carte piochée
        currentPlayer = updatedGame.players.find(p => p.id === currentPlayer.id)!;
        if (currentPlayer.cards.length > 0) {
            const newCard = currentPlayer.cards[currentPlayer.cards.length - 1];
            drawnCardName = ` "${newCard.name}"`;
        }
      }

      addToHistory(`réserve carte "${card.name}" et gagne ${gainMsg}${drawnCardName}`, currentPlayer.id, game, { type: 'IDLE' }, interactionState.sequenceId);
    }

    setGame(updatedGame);
    if (gameEngineRef.current) gameEngineRef.current.setState(updatedGame);

    // Mettre à jour l'état d'interaction
    const newCount = interactionState.count - interactionState.selectedCards.length;
    if (newCount > 0) {
      setInteractionState({ type: 'RESERVING_CARD', count: newCount, sequenceId: interactionState.sequenceId, selectedCards: [] });
    } else {
      setInteractionState({ type: 'IDLE' });
      
      // Si on est en phase de SETUP, on passe au joueur suivant
      if (game.phase === GamePhase.SETUP) {
          handleSetupNextPlayer(updatedGame);
      }
    }
  };

  // Gestionnaire pour le clic sur un secteur (Scan)
  const handleSectorClick = (sectorNumber: number) => {
    if (!game) return;

    // Cas 1: Mode Scan actif ou bonus
    if (interactionState.type === 'SELECTING_SCAN_SECTOR') {
      const currentPlayer = game.players[game.currentPlayerIndex];
      const sector = game.board.sectors[sectorNumber - 1];

      // Validate color
      if (interactionState.color !== SectorType.ANY && sector.color !== interactionState.color) {
        let isAdjacentAllowed = false;
        if (interactionState.adjacents) {
          const solarSystem = game.board.solarSystem;
          const earthPos = getObjectPosition('earth', solarSystem.rotationAngleLevel1, solarSystem.rotationAngleLevel2, solarSystem.rotationAngleLevel3);
          if (earthPos) {
            const diff = Math.abs(earthPos.absoluteSector - sectorNumber);
            if (diff === 1 || diff === 7 || diff === 0) isAdjacentAllowed = true;
          }
        }

        if (!isAdjacentAllowed) {
          setToast({ message: `Couleur incorrecte. Sélectionnez un secteur ${interactionState.color}.`, visible: true });
          return;
        }
      }

      // Validate onlyProbes (Card 120, etc.)
      if (interactionState.onlyProbes) {
        const rotationState = createRotationState(
          game.board.solarSystem.rotationAngleLevel1 || 0,
          game.board.solarSystem.rotationAngleLevel2 || 0,
          game.board.solarSystem.rotationAngleLevel3 || 0
        );
        const hasProbe = currentPlayer.probes.some(p => {
          if (p.state !== ProbeState.IN_SOLAR_SYSTEM || !p.solarPosition) return false;
          return getAbsoluteSectorForProbe(p.solarPosition, rotationState) === sectorNumber;
        });
        if (!hasProbe) {
          setToast({ message: "Veuillez sélectionner un secteur contenant une de vos sondes.", visible: true });
          return;
        }
      }

      let updatedGame = structuredClone(game);
      const initialLogs: string[] = [];

      if (interactionState.cardId) {
        let cardFoundAndProcessed = false;

        // Chercher et traiter dans la rangée de cartes
        const { updatedGame: gameAfterRowDiscard, discardedCard: rowCard } = CardSystem.discardFromRow(updatedGame, interactionState.cardId);
        if (rowCard) {
            updatedGame = gameAfterRowDiscard;
            initialLogs.push(`défausse carte "${rowCard.name}" (${rowCard.scanSector}) de la rangée`);
            cardFoundAndProcessed = true;
        }

        // Si non trouvée, chercher et traiter dans la pioche
        if (!cardFoundAndProcessed) {
          const cardFromDeck = game.decks.cards.find(c => c.id === interactionState.cardId);
          if (cardFromDeck) {
            const deck = updatedGame.decks.cards;
            const cardIndex = deck.findIndex(c => c.id === cardFromDeck.id);
            if (cardIndex !== -1) {
              const removedCard = deck.splice(cardIndex, 1)[0];
              if (!updatedGame.decks.discardPile) updatedGame.decks.discardPile = [];
              updatedGame.decks.discardPile.push(removedCard);
              initialLogs.push(`défausse carte "${removedCard.name}" (${removedCard.scanSector}) de la pioche`);
              cardFoundAndProcessed = true;
            }
          }
        }

        // Si non trouvée, chercher et traiter dans la main du joueur
        if (!cardFoundAndProcessed) {
          const cardFromHand = currentPlayer.cards.find(c => c.id === interactionState.cardId);
          if (cardFromHand) {
            const hand = updatedGame.players[updatedGame.currentPlayerIndex].cards;
            const cardIndex = hand.findIndex(c => c.id === cardFromHand.id);
            if (cardIndex !== -1) {
              const removedCard = hand.splice(cardIndex, 1)[0];
              if (!updatedGame.decks.discardPile) updatedGame.decks.discardPile = [];
              updatedGame.decks.discardPile.push(removedCard);
              initialLogs.push(`défausse carte "${removedCard.name}" (${removedCard.scanSector}) de la main`);
            }
          }
        }
      }

      const res = ScanSystem.performSignalAndCover(updatedGame, currentPlayer.id, sector.id, initialLogs, interactionState.noData, interactionState.sequenceId);
      updatedGame = res.updatedGame;
      // Log immediately for interactive scan
      res.historyEntries.forEach(entry => addToHistory(entry.message, entry.playerId, game, undefined, interactionState.sequenceId));

      // Handle keepCardIfOnly (Card 120)
      if (interactionState.keepCardIfOnly && interactionState.cardId) {
        const updatedSector = updatedGame.board.sectors[sectorNumber - 1];
        const playerSignals = updatedSector.signals.filter(s => s.markedBy === currentPlayer.id) || [];

        if (playerSignals.length === 1) {
          const discardPile = updatedGame.decks.discardPile || [];
          const cardId = interactionState.cardId;
          const cardIndex = discardPile.findIndex(c => c.id === cardId);

          if (cardIndex !== -1) {
            const card = discardPile[cardIndex];
            discardPile.splice(cardIndex, 1);

            const pIndex = updatedGame.players.findIndex(p => p.id === currentPlayer.id);
            if (pIndex !== -1) {
              updatedGame.players[pIndex].cards.push(card);
              addToHistory(`récupère la carte "${card.name}" en main (Condition remplie)`, currentPlayer.id, updatedGame, undefined, (interactionState as any).sequenceId);
            }
          }
        }
      }

      setGame(updatedGame);
      if (gameEngineRef.current) gameEngineRef.current.setState(updatedGame);

      setInteractionState({ type: 'IDLE' });
      return;
    }

    // Cas 2: Clic direct depuis Idle (Raccourci Action Scan)
    if (interactionState.type === 'IDLE' && !game.players[game.currentPlayerIndex].hasPerformedMainAction) {
      handleAction(ActionType.SCAN_SECTOR);
      return;
    }
  };

  // Gestionnaire pour les actions
  const handleAction = (actionType: ActionType) => {
    if (!gameEngineRef.current || !game) return;

    // Atomicité : Si on est dans un mode interactif, on ne peut pas lancer d'autre action
    if (interactionState.type !== 'IDLE') return;

    // Synchroniser l'état de GameEngine avec le jeu actuel (pour préserver les angles de rotation)
    gameEngineRef.current.setState(gameRef.current);
    console.log(gameRef.current);

    const currentGame = gameRef.current;
    const currentPlayer = currentGame.players[currentGame.currentPlayerIndex];

    /***
     * LAUNCH PROBE
     */
    if (actionType === ActionType.LAUNCH_PROBE) {
      const action = new LaunchProbeAction(currentPlayer.id);
      const result = gameEngineRef.current.executeAction(action);
      if (result.success && result.updatedState) {
        setGame(result.updatedState);
        addToHistory(`paye ${ResourceSystem.formatResource(GAME_CONSTANTS.PROBE_LAUNCH_COST, 'CREDIT')} pour <strong>Lancer une sonde</strong> depuis la Terre`, currentPlayer.id, game);
      } else {
        console.error('Erreur lors du lancement de la sonde:', result.error);
        alert(result.error || 'Impossible de lancer la sonde');
      }
    }
    /***
     * SCAN SECTOR
     */
    else if (actionType === ActionType.SCAN_SECTOR) {
      const action = new ScanSectorAction(currentPlayer.id);
      const result = gameEngineRef.current.executeAction(action);
      if (result.success && result.updatedState) {
        setGame(result.updatedState);
        action.historyEntries.forEach(entry => addToHistory(entry.message, entry.playerId, game, undefined, entry.sequenceId));

        // Ajouter les nouvelles interactions et lancer la première
        const [first, ...rest] = action.newPendingInteractions;
        setInteractionState(first);
        setPendingInteractions(prev => [...rest, ...prev]);
      } else {
        console.error("Erreur lors du scan d'un secteur:", result.error);
        alert(result.error || 'Impossible de scanner un secteur');
      }
    }
    /***
     * ORBIT PROBE
     */
    else if (actionType === ActionType.ORBIT) {
      // TODO: Ouvrir les tooltip des planetes ou une sonde du joueur est presente
      setToast({ message: "Veuillez sélectionner un emplacement d'orbite sur une planète.", visible: true });
    }
    /***
     * LAND PROBE
     */
    else if (actionType === ActionType.LAND) {
      // TODO: Ouvrir les tooltip des planetes ou une sonde du joueur est presente
      setToast({ message: "Veuillez sélectionner un emplacement d'atterrissage sur une planète.", visible: true });
    }
    /***
     * PLAY CARD
     */
    else if (actionType === ActionType.PLAY_CARD) {
      // TODO: Ouvrir les cartes qui peuvent être jouées
      setToast({ message: "Veuillez sélectionner une carte.", visible: true });
    }
    /***
     * RESEARCH TECH
     */
    else if (actionType === ActionType.RESEARCH_TECH) {
      const action = new ResearchTechAction(currentPlayer.id);
      const result = gameEngineRef.current.executeAction(action);
      if (result.success && result.updatedState) {
        setGame(result.updatedState);
        action.historyEntries.forEach(entry => addToHistory(entry.message, entry.playerId, game, undefined, entry.sequenceId));

        // Ajouter les nouvelles interactions et lancer la première
        const [first, ...rest] = action.newPendingInteractions;
        setInteractionState(first);
        setPendingInteractions(prev => [...rest, ...prev]);
      } else {
        console.error("Erreur lors de la recherche de technologie:", result.error);
        alert(result.error || 'Impossible de rechercher une technologie');
      }
    }
    /***
     * ANALYZE DATA
     */
    else if (actionType === ActionType.ANALYZE_DATA) {
      const action = new AnalyzeDataAction(currentPlayer.id);
      const validation = ActionValidator.validateAction(currentGame, action);
      if (!validation.valid) {
        setToast({ message: validation.errors[0]?.message || "Analyse impossible", visible: true });
        return;
      }

      // Déclencher l'animation
      setInteractionState({ type: 'ANALYZING' });

      // Capture state BEFORE analysis for undo (Deep copy to ensure computer data is saved)
      const previousState = structuredClone(currentGame);

      // Délai pour l'animation avant d'appliquer les effets
      setTimeout(() => {
        if (!gameEngineRef.current) return;
        gameEngineRef.current.setState(gameRef.current);

        const result = gameEngineRef.current.executeAction(action);
        if (result.success && result.updatedState) {
          const sequenceId = `analyze-${Date.now()}`;
          setGame(result.updatedState);
          setInteractionState({ type: 'PLACING_LIFE_TRACE', color: LifeTraceType.BLUE, sequenceId });
          addToHistory(`paye ${ResourceSystem.formatResource(1, 'ENERGY')} pour <strong>Analyser les données</strong>`, currentPlayer.id, previousState, { type: 'IDLE' }, sequenceId);
        } else {
          console.error("Erreur lors de l'analyse:", result.error);
          setToast({ message: result.error || "Erreur lors de l'analyse", visible: true });
          setInteractionState({ type: 'IDLE' });
        }
      }, 1500);
    }
    /***
     * PASS
     */
    else if (actionType === ActionType.PASS) {
      // 1. Vérifier la taille de la main
      const toDiscard = currentPlayer.cards.length - GAME_CONSTANTS.HAND_SIZE_AFTER_PASS
      if (toDiscard > 0) {
        setInteractionState({ type: 'DISCARDING_CARD', count: toDiscard, selectedCards: [] });
        setToast({ message: "Veuillez défausser pour ne garder que 4 cartes en main.", visible: true });
        return;
      }

      const cardsToKeep = currentPlayer.cards.map(c => c.id);

      // Vérifier s'il y a un paquet de manche pour déclencher la modale
      const roundDeck = game.decks.roundDecks[game.currentRound];
      if (roundDeck && roundDeck.length > 0) {
        setPassModalState({ visible: true, cards: roundDeck, selectedCardId: null, cardsToKeep });
      } else {
        performPass(cardsToKeep);
      }
    }
  };

  // Gestionnaire pour placer une trace de vie
  const handlePlaceLifeTrace = (boardIndex: number, color: LifeTraceType) => {
    if (!game) return;

    if (interactionState.type !== 'PLACING_LIFE_TRACE') return;

    if (interactionState.color !== color) {
      setToast({ message: `Veuillez placer une trace de vie ${interactionState.color}.`, visible: true });
      return;
    }

    const currentPlayer = game.players[game.currentPlayerIndex];
    let updatedGame = structuredClone(game);
    const board = updatedGame.board.alienBoards[boardIndex];
    const sequenceId = interactionState.sequenceId || `trace-${Date.now()}`;

    board.lifeTraces.push({
      id: `trace-${Date.now()}`,
      type: color,
      playerId: currentPlayer.id
    });

    // Vérifier si une espèce Alien est découverte (1 marqueur de chaque couleur sur ce plateau)
    const traces = board.lifeTraces;
    const hasRed = traces.some(t => t.type === LifeTraceType.RED);
    const hasYellow = traces.some(t => t.type === LifeTraceType.YELLOW);
    const hasBlue = traces.some(t => t.type === LifeTraceType.BLUE);

    const tracesBefore = traces.slice(0, -1);
    const hadRed = tracesBefore.some(t => t.type === LifeTraceType.RED);
    const hadYellow = tracesBefore.some(t => t.type === LifeTraceType.YELLOW);
    const hadBlue = tracesBefore.some(t => t.type === LifeTraceType.BLUE);

    let discoveryLog = "";
    if (hasRed && hasYellow && hasBlue && !(hadRed && hadYellow && hadBlue)) {
      // Assigner une espèce aléatoire au plateau si pas déjà fait
      const ALIEN_SPECIES = ['Centauriens', 'Exertiens', 'Oumuamua']
      if (!board.speciesId) {
        //const availableSpecies = Object.keys(ALIEN_SPECIES_TOPOLOGIES);
        // Filtrer les espèces déjà découvertes sur d'autres plateaux (si on veut l'unicité)
        // Pour l'instant, simple random
        const randomSpecies = ALIEN_SPECIES[Math.floor(Math.random() * ALIEN_SPECIES.length)];
        board.speciesId = randomSpecies;
      }

      setAlienDiscoveryNotification({ visible: true, message: "Découverte d'une nouvelle espèce Alien !" });
      setTimeout(() => setAlienDiscoveryNotification(null), 4000);
      discoveryLog = " et découvre une nouvelle espèce Alien !";
    }

    const track = board.lifeTraces.filter(t => t.type === color);

    const isFirst = track.length === 1;
    const bonus = isFirst ? board.firstBonus : board.nextBonus;

    const playerToUpdate = updatedGame.players.find(p => p.id === currentPlayer.id);
    if (playerToUpdate) {
      ProbeSystem.applyBonus(playerToUpdate, bonus);
    }

    const { updatedGame: gameAfterBonus, newPendingInteractions, passiveGains, logs, historyEntries } = ResourceSystem.processBonuses(bonus, updatedGame, currentPlayer.id, 'lifetrace', sequenceId);

    setGame(gameAfterBonus);
    if (gameEngineRef.current) gameEngineRef.current.setState(gameAfterBonus);

    let message = `place une trace de vie ${color} sur le plateau Alien ${boardIndex + 1}`;
    if (logs.length > 0) {
      message += ` et ${logs.join(', ')}`;
    }
    message += discoveryLog;
    addToHistory(message, currentPlayer.id, game, undefined, sequenceId);
    historyEntries.forEach(entry => addToHistory(entry.message, entry.playerId, gameAfterBonus, undefined, sequenceId));

    const interactionsWithSeqId = newPendingInteractions.map(i => ({ ...i, sequenceId }));
    const allNext = [...interactionsWithSeqId, ...pendingInteractions];

    if (allNext.length > 0) {
      const [next, ...rest] = allNext;
      setInteractionState(next);
      setPendingInteractions(rest);
    } else {
      setInteractionState({ type: 'IDLE' });
    }
  };

  // Gestionnaire pour les choix dans le menu de bonus
  const handleMenuChoice = (choiceIndex: number) => {
    if (interactionState.type !== 'CHOOSING_BONUS_ACTION') return;

    const choice = interactionState.choices[choiceIndex];
    if (choice.done) return;

    // Créer un nouvel état de menu avec ce choix marqué comme fait
    const updatedChoices = [...interactionState.choices];
    updatedChoices[choiceIndex] = { ...choice, done: true };

    const nextMenuState: InteractionState = {
      ...interactionState,
      choices: updatedChoices
    };

    // Définir l'interaction choisie comme active
    setInteractionState(choice.state);

    // Ajouter le menu mis à jour en tête de la file d'attente pour y revenir après l'action
    if (updatedChoices.some(c => !c.done)) {
      setPendingInteractions(prev => [nextMenuState, ...prev]);
    }
  };

  // Gestionnaire pour le choix Observation 2
  const handleObs2Choice = (accepted: boolean) => {
    if (!game) return;

    if (interactionState.type !== 'CHOOSING_OBS2_ACTION') return;

    const sequenceId = interactionState.sequenceId;

    if (accepted) {
      let updatedGame = structuredClone(game);
      const player = updatedGame.players[updatedGame.currentPlayerIndex];

      // Payer 1 Média
      player.mediaCoverage -= 1;
      addToHistory(`paye 1 Média pour utiliser Observation II`, player.id, game, undefined, sequenceId);

      // Scanner Mercure
      const rotationState = createRotationState(
        updatedGame.board.solarSystem.rotationAngleLevel1 || 0,
        updatedGame.board.solarSystem.rotationAngleLevel2 || 0,
        updatedGame.board.solarSystem.rotationAngleLevel3 || 0
      );
      const mercuryPos = getObjectPosition('earth', rotationState.level1Angle, rotationState.level2Angle, rotationState.level3Angle);
      if (mercuryPos) {
        const mercurySector = updatedGame.board.sectors[mercuryPos.absoluteSector - 1];
        const res = ScanSystem.performSignalAndCover(updatedGame, player.id, mercurySector.id, [], false, sequenceId);
        updatedGame = res.updatedGame;
        res.historyEntries.forEach(entry => addToHistory(entry.message, entry.playerId, updatedGame, undefined, sequenceId));
      }
      setGame(updatedGame);
      if (gameEngineRef.current) gameEngineRef.current.setState(updatedGame);
    }

    setInteractionState({ type: 'IDLE' });
  };

  // Gestionnaire pour le choix Observation 3
  const handleObs3Choice = (accepted: boolean) => {
    if (interactionState.type !== 'CHOOSING_OBS3_ACTION') return;

    const sequenceId = interactionState.sequenceId;

    if (accepted) {
      setInteractionState({ type: 'DISCARDING_FOR_SIGNAL', count: 1, selectedCards: [], sequenceId });
      setToast({ message: "Veuillez sélectionnez une carte à défausser.", visible: true });
    } else {
      // Passer à l'interaction suivante (ou IDLE)
      setInteractionState({ type: 'IDLE' });
    }
  };

  // Gestionnaire pour le choix Observation 4
  const handleObs4Choice = (choice: 'PROBE' | 'MOVE') => {
    if (!game) return;

    if (interactionState.type !== 'CHOOSING_OBS4_ACTION') return;

    const sequenceId = interactionState.sequenceId;
    let updatedGame = structuredClone(game);
    const player = updatedGame.players[updatedGame.currentPlayerIndex];

    if (choice === 'PROBE') {
      // Payer 1 Energie
      player.energy -= 1;
      addToHistory(`paye 1 Énergie pour utiliser Observation IV (Lancement de sonde)`, player.id, game, undefined, sequenceId);

      // Lancer une sonde (Gratuit en crédits, mais on a payé l'énergie)
      const launchRes = ProbeSystem.launchProbe(updatedGame, player.id, true, false);
      if (launchRes.probeId) {
        updatedGame = launchRes.updatedGame;
        addToHistory(`lance 1 sonde depuis la Terre (Observation IV)`, player.id, updatedGame, undefined, sequenceId);
      }
    } else {
      // Gain 1 Movement
      setPendingInteractions(prev => [{ type: 'MOVING_PROBE', count: 1, sequenceId }, ...prev]);
      addToHistory(`choisit de gagner 1 déplacement (Observation IV)`, player.id, game, undefined, sequenceId);
    }

    setGame(updatedGame);
    if (gameEngineRef.current) gameEngineRef.current.setState(updatedGame);
    setInteractionState({ type: 'IDLE' });
  };

  // Gestionnaire pour le choix Média ou Déplacement (Carte 19)
  const handleMediaOrMoveChoice = (choice: 'MEDIA' | 'MOVE') => {
    if (!game) return;

    if (interactionState.type !== 'CHOOSING_MEDIA_OR_MOVE') return;

    const currentPlayer = game.players[game.currentPlayerIndex];
    let updatedGame = { ...game };
    const sequenceId = interactionState.sequenceId;
    const remainingMoves = interactionState.remainingMoves || 0;

    if (choice === 'MEDIA') {
      const res = ResourceSystem.updateMedia(updatedGame, currentPlayer.id, 1);
      updatedGame = res.updatedGame;
      addToHistory(`choisit de gagner ${ResourceSystem.formatResource(1, 'MEDIA')}`, currentPlayer.id, game, { type: 'IDLE' }, sequenceId);
      setGame(updatedGame);
      if (gameEngineRef.current) gameEngineRef.current.setState(updatedGame);

      if (remainingMoves > 0) {
        setInteractionState({ type: 'MOVING_PROBE', count: remainingMoves });
      } else {
        setInteractionState({ type: 'IDLE' });
      }
    } else {
      // Transition vers le déplacement de sonde
      setInteractionState({ type: 'MOVING_PROBE', count: remainingMoves + 1 });
      setToast({ message: "Veuillez sélectionnez une sonde à déplacer.", visible: true });
      addToHistory(`choisit un déplacement gratuit`, currentPlayer.id, game, { type: 'IDLE' }, sequenceId);
    }
  };

  // Helper générique pour les interactions avec les planètes (Orbite/Atterrissage)
  const handlePlanetInteraction = (
    action: OrbitAction | LandAction,
    planetId: string,
    actionFn: (game: Game, playerId: string, probeId: string, targetId: string) => { updatedGame: Game, bonuses?: any },
    historyMessagePrefix: string,
    successMessage: string
  ): boolean => {
    if (!game) return false;

    const currentPlayer = game.players[game.currentPlayerIndex];

    // Résolution de l'ID de la planète parente si c'est un satellite
    let targetPlanetId = planetId;
    const parentPlanet = game.board.planets.find(p => p.satellites?.some(s => s.id === planetId));
    if (parentPlanet) {
      targetPlanetId = parentPlanet.id;
    }

    // Trouver la définition statique de la planète pour obtenir sa position relative
    const allObjects = [
      ...FIXED_OBJECTS,
      ...INITIAL_ROTATING_LEVEL1_OBJECTS,
      ...INITIAL_ROTATING_LEVEL2_OBJECTS,
      ...INITIAL_ROTATING_LEVEL3_OBJECTS
    ];
    const planetDef = allObjects.find(o => o.id === targetPlanetId);

    if (!planetDef) {
      console.error(`Planète introuvable: ${targetPlanetId}`);
      return false;
    }

    // Trouver une sonde du joueur sur cette planète (en comparant les positions relatives)
    const probe = currentPlayer.probes.find(p => {
      if (p.state !== ProbeState.IN_SOLAR_SYSTEM || !p.solarPosition) return false;
      // Comparaison souple pour le niveau (0, null, undefined sont équivalents pour le niveau fixe)
      const probeLevel = p.solarPosition.level || 0;
      const planetLevel = planetDef.level || 0;

      return p.solarPosition.disk === planetDef.position.disk &&
        p.solarPosition.sector === planetDef.position.sector &&
        probeLevel === planetLevel;
    });

    if (!probe) return false;

    // Générer un ID de séquence pour grouper l'action et ses bonus
    const sequenceId = interactionState.sequenceId || `seq-${Date.now()}`;

    // Sauvegarder l'état avant l'action pour l'historique (Undo annulera tout, y compris les bonus)
    const stateBeforeAction = structuredClone(game);

    try {
      const result = actionFn(game, currentPlayer.id, probe.id, planetId);

      const { updatedGame, newPendingInteractions, passiveGains, logs: allBonusLogs, historyEntries } = ResourceSystem.processBonuses(result.bonuses, result.updatedGame, currentPlayer.id, 'land/orbit', sequenceId);

      // Marquer l'action principale comme effectuée manuellement
      const playerIndex = updatedGame.players.findIndex(p => p.id === currentPlayer.id);
      if (playerIndex !== -1) updatedGame.players[playerIndex].hasPerformedMainAction = true;

      setGame(updatedGame);
      if (gameEngineRef.current) gameEngineRef.current.setState(updatedGame);

      let interactionTriggered = false;
      if (newPendingInteractions.length > 1) {
        // Créer le menu de choix en injectant le sequenceId dans les états
        const choices = newPendingInteractions.map((interaction, index) => ({
          id: `choice-${Date.now()}-${index}`,
          label: getInteractionLabel(interaction),
          state: { ...interaction, sequenceId },
          done: false
        }));

        const summary = passiveGains.length > 0 ? `Vous avez gagné : ${passiveGains.join(', ')}.` : "Gains interactifs :";

        setInteractionState({
          type: 'CHOOSING_BONUS_ACTION',
          bonusesSummary: summary,
          choices: choices,
          sequenceId
        });
        interactionTriggered = true;
      } else if (newPendingInteractions.length === 1) {
        setInteractionState({ ...newPendingInteractions[0], sequenceId });
        interactionTriggered = true;
      }

      let message = `${historyMessagePrefix} ${planetDef.name}`;
      if (passiveGains.length > 0) {
        message += ` et gagne ${passiveGains.join(', ')}`;
      }

      addToHistory(message, currentPlayer.id, stateBeforeAction, undefined, sequenceId);

      const otherLogs = allBonusLogs.filter(log => !log.startsWith('gagne '));
      if (otherLogs.length > 0) {
        otherLogs.forEach(log => addToHistory(log, currentPlayer.id, updatedGame, undefined, sequenceId));
      }

      if (historyEntries.length > 0) {
        historyEntries.forEach(entry => addToHistory(entry.message, entry.playerId, updatedGame, undefined, sequenceId));
      }
      if (newPendingInteractions.length === 0) {
        setToast({ message: successMessage, visible: true });
      }
      return interactionTriggered;
    } catch (e: any) {
      setToast({ message: e.message, visible: true });
      return false;
    }
  };

  // Gestionnaire pour la mise en orbite via la hover card
  const handleOrbit = (planetId: string, slotIndex?: number) => {
    if (!game) return;

    const currentPlayer = game.players[game.currentPlayerIndex];
    const probeOnPlanet = ProbeSystem.probeOnPlanetInfo(game, currentPlayer.id);
    
    // Trouver la sonde sur la planète pour la validation
    const probe = currentPlayer.probes.find(p => {
      if (p.state !== ProbeState.IN_SOLAR_SYSTEM || !p.solarPosition) return false;
      const planetDef = [...FIXED_OBJECTS, ...INITIAL_ROTATING_LEVEL1_OBJECTS, ...INITIAL_ROTATING_LEVEL2_OBJECTS, ...INITIAL_ROTATING_LEVEL3_OBJECTS].find(o => o.id === probeOnPlanet.planetId);
      if (!planetDef) return false;
      return p.solarPosition.disk === planetDef.position.disk && p.solarPosition.sector === planetDef.position.sector && (p.solarPosition.level || 0) === (planetDef.level || 0);
    });
    if (!probe) return;

    // Gestion de la carte 15 : Retirer un orbiteur
    if (interactionState.type === 'REMOVING_ORBITER') {
      const planet = game.board.planets.find(p => p.id === planetId);

      if (!planet) return;

      // Vérifier si le joueur a un orbiteur sur cette planète
      let orbiterIndex = -1;

      // Si un slot spécifique est cliqué, vérifier s'il appartient au joueur
      if (slotIndex !== undefined && planet.orbiters[slotIndex]?.ownerId === currentPlayer.id) {
        orbiterIndex = slotIndex;
      } else {
        // Sinon (fallback), prendre le premier orbiteur du joueur
        orbiterIndex = planet.orbiters.findIndex(p => p.ownerId === currentPlayer.id);
      }
      if (orbiterIndex === -1) return;

      // Retirer l'orbiteur
      let updatedGame = structuredClone(game);
      const updatedPlanet = updatedGame.board.planets.find(p => p.id === planetId)!;
      const removedProbe = updatedPlanet.orbiters[orbiterIndex];

      // Retirer de la planète
      updatedPlanet.orbiters.splice(orbiterIndex, 1);

      // Retirer de la liste globale des sondes du système solaire
      updatedGame.board.solarSystem.probes = updatedGame.board.solarSystem.probes.filter(p => p.id !== removedProbe.id);

      // Retirer de la liste du joueur
      const updatedPlayer = updatedGame.players.find(p => p.id === currentPlayer.id)!;
      updatedPlayer.probes = updatedPlayer.probes.filter(p => p.id !== removedProbe.id);

      // Appliquer les gains : 3 PV, 1 Donnée, 1 Carte
      updatedPlayer.score += 3;
      updatedPlayer.data = Math.min((updatedPlayer.data || 0) + 1, GAME_CONSTANTS.MAX_DATA);
      updatedGame = CardSystem.drawCards(updatedGame, currentPlayer.id, 1, 'Bonus Rentrée Atmosphérique');

      setGame(updatedGame);
      if (gameEngineRef.current) gameEngineRef.current.setState(updatedGame);
      setInteractionState({ type: 'IDLE' });
      addToHistory(`retire un orbiteur de ${planet.name} et gagne 3 PV, 1 Donnée, 1 Carte`, currentPlayer.id, game, undefined, interactionState.sequenceId);
      return;
    }

    const action = new OrbitAction(currentPlayer.id, probe.id, planetId);
    const validation = ActionValidator.validateAction(game, action);
    if (!validation.valid) {
      setToast({ message: validation.errors[0]?.message || "Mise en orbite impossible", visible: true });
      return;
    }

    const executeOrbit = () => {
      handlePlanetInteraction(
        action,
        planetId,
        (g, pid, prid, targetId) => ProbeSystem.orbitProbe(g, pid, prid, targetId), // Orbit is not free via LANDING_PROBE
        "paye 1 Energie et 1 Crédit pour <strong>Mettre en orbite</strong> une sonde autour de",
        "Sonde mise en orbite"
      );
    };

    // Check for bonus warnings
    if (slotIndex !== undefined) {
      const planet = game.board.planets.find(p => p.id === planetId);
      if (planet && planet.orbitSlots && planet.orbitSlots[slotIndex]) {
        const bonus = planet.orbitSlots[slotIndex];
        if (bonus.revenue && currentPlayer.cards.length === 0) {
          setConfirmModalState({
            visible: true,
            cardId: null,
            message: "Vous n'avez aucune carte en main pour effectuer la réservation (bonus). Le bonus sera perdu. Voulez-vous continuer ?",
            onConfirm: executeOrbit
          });
          return;
        }

        if (bonus.data && (currentPlayer.data || 0) >= GAME_CONSTANTS.MAX_DATA) {
          setConfirmModalState({
            visible: true,
            cardId: null,
            message: "Vous avez atteint la limite de données. Le gain de données (bonus) sera perdu. Voulez-vous continuer ?",
            onConfirm: executeOrbit
          });
          return;
        }

        if (bonus.media && currentPlayer.mediaCoverage >= GAME_CONSTANTS.MAX_MEDIA_COVERAGE) {
          setConfirmModalState({
            visible: true,
            cardId: null,
            message: "Vous avez atteint la limite de couverture médiatique. Le gain de médias (bonus) sera perdu. Voulez-vous continuer ?",
            onConfirm: executeOrbit
          });
          return;
        }

        if (bonus.technologies) {
          const isTechLost = bonus.technologies.some(t => {
            const cat = t.scope === TechnologyCategory.ANY ? undefined : t.scope;
            return !TechnologySystem.canAcquireTech(game, currentPlayer.id, cat);
          });
          if (isTechLost) {
            setConfirmModalState({
              visible: true,
              cardId: null,
              message: "Vous avez déjà toutes les technologies disponibles. Le gain de technologie (bonus) sera perdu. Voulez-vous continuer ?",
              onConfirm: executeOrbit
            });
            return;
          }
        }
      }
    }

    executeOrbit();
  };

  // Gestionnaire pour l'atterrissage via la hover card
  const handleLand = (planetId: string, slotIndex?: number) => {
    if (!game) return;

    const currentPlayer = game.players[game.currentPlayerIndex];
    const probeOnPlanet = ProbeSystem.probeOnPlanetInfo(game, currentPlayer.id);

    const probe = currentPlayer.probes.find(p => {
      if (p.state !== ProbeState.IN_SOLAR_SYSTEM || !p.solarPosition) return false;
      const planetDef = [...FIXED_OBJECTS, ...INITIAL_ROTATING_LEVEL1_OBJECTS, ...INITIAL_ROTATING_LEVEL2_OBJECTS, ...INITIAL_ROTATING_LEVEL3_OBJECTS].find(o => o.id === probeOnPlanet.planetId);
      if (!planetDef) return false;
      return p.solarPosition.disk === planetDef.position.disk && p.solarPosition.sector === planetDef.position.sector && (p.solarPosition.level || 0) === (planetDef.level || 0);
    });
    if (!probe) return;

    const executeLand = () => {
      // Vérifier si on est en mode atterrissage gratuit
      if (interactionState.type === 'LANDING_PROBE') {
        const interactionTriggered = handlePlanetInteraction(
          new LandAction(currentPlayer.id, probe.id, planetId), // Action pour le type, pas pour la validation ici
          planetId, // planetId pour la logique interne
          (g, pid, prid, targetId) => {
            const result = ProbeSystem.landProbe(g, pid, prid, targetId, true, slotIndex); // Toujours gratuit en mode LANDING_PROBE

            // Logique spécifique Carte 13 (Rover Perseverance)
            // "Si vous posez une sonde sur Mars, Mercure ou n'importe quelle lune avec cette action, gagnez 4 PVs."
            if ((interactionState as any).source === '13') {
              const isMars = targetId === 'mars';
              const isMercury = targetId === 'mercury';
              // Vérifier si c'est une lune (satellite)
              const isMoon = g.board.planets.some(p => p.satellites?.some(s => s.id === targetId));

              if (isMars || isMercury || isMoon) {
                if (!result.bonuses) result.bonuses = {};
                result.bonuses.pv = (result.bonuses.pv || 0) + 4;

                // Appliquer le gain de PV à l'état du jeu
                const pIndex = result.updatedGame.players.findIndex(p => p.id === pid);
                if (pIndex !== -1) {
                  const p = { ...result.updatedGame.players[pIndex] };
                  p.score += 4;
                  result.updatedGame.players = [...result.updatedGame.players];
                  result.updatedGame.players[pIndex] = p;
                }
              }
            }
            return result;
          },
          "fait atterrir une sonde (Bonus) sur",
          "Atterrissage réussi"
        );

        if (interactionTriggered) {
          // Si une interaction a été déclenchée (bonus), on doit s'assurer que les atterrissages restants sont mis en file d'attente
          if (interactionState.count > 1) {
            const remainingState: InteractionState = { ...interactionState, count: interactionState.count - 1 };
            setPendingInteractions(prev => [...prev, remainingState]);
          }
          return;
        }

        // Décrémenter ou terminer l'interaction
        if (interactionState.count > 1) {
          setInteractionState({ ...interactionState, count: interactionState.count - 1 });
        } else {
          // Si on vient d'un menu de choix, on retourne à IDLE (le menu gère la suite via pendingInteractions)
          // Sinon IDLE
          setInteractionState({ type: 'IDLE' });
        }
        return;
      }

      const action = new LandAction(currentPlayer.id, probe.id, planetId);
      const validation = ActionValidator.validateAction(game, action);
      if (!validation.valid) {
        setToast({ message: validation.errors[0]?.message || "Atterrissage impossible", visible: true });
        return;
      }

      handlePlanetInteraction(
        action,
        planetId,
        // On passe planetId comme targetId pour supporter l'atterrissage sur les satellites
        (g, pid, prid, targetId) => ProbeSystem.landProbe(g, pid, prid, targetId, false, slotIndex),
        "fait atterrir une sonde sur",
        "Atterrissage réussi"
      );
    };

    // Check for bonus warnings
    if (slotIndex !== undefined) {
      let bonus: Bonus | undefined;

      // Check if planet
      const planet = game.board.planets.find(p => p.id === planetId);
      if (planet && planet.landSlots) {
        bonus = planet.landSlots[slotIndex];
      } else {
        // Check if satellite
        const parentPlanet = game.board.planets.find(p => p.satellites?.some(s => s.id === planetId));
        if (parentPlanet) {
          const sat = parentPlanet.satellites?.find(s => s.id === planetId);
          if (sat) {
            bonus = sat.landBonus;
          }
        }
      }

      if (bonus) {
        if (bonus.revenue && currentPlayer.cards.length === 0) {
          setConfirmModalState({
            visible: true,
            cardId: null,
            message: "Vous n'avez aucune carte en main pour effectuer la réservation (bonus). Le bonus sera perdu. Voulez-vous continuer ?",
            onConfirm: executeLand
          });
          return;
        }

        if (bonus.data && (currentPlayer.data || 0) >= GAME_CONSTANTS.MAX_DATA) {
          setConfirmModalState({
            visible: true,
            cardId: null,
            message: "Vous avez atteint la limite de données. Le gain de données (bonus) sera perdu. Voulez-vous continuer ?",
            onConfirm: executeLand
          });
          return;
        }

        if (bonus.media && currentPlayer.mediaCoverage >= GAME_CONSTANTS.MAX_MEDIA_COVERAGE) {
          setConfirmModalState({
            visible: true,
            cardId: null,
            message: "Vous avez atteint la limite de couverture médiatique. Le gain de médias (bonus) sera perdu. Voulez-vous continuer ?",
            onConfirm: executeLand
          });
          return;
        }

        if (bonus.technologies) {
          const isTechLost = bonus.technologies.some(t => {
            const cat = t.scope === TechnologyCategory.ANY ? undefined : t.scope;
            return !TechnologySystem.canAcquireTech(game, currentPlayer.id, cat);
          });
          if (isTechLost) {
            setConfirmModalState({
              visible: true,
              cardId: null,
              message: "Vous avez déjà toutes les technologies disponibles. Le gain de technologie (bonus) sera perdu. Voulez-vous continuer ?",
              onConfirm: executeLand
            });
            return;
          }
        }
      }
    }

    executeLand();
  };

  // Gestionnaire pour le déplacement des sondes
  const handleProbeMove = async (probeId: string, path: string[]) => {
    if (!gameEngineRef.current || !game || !gameRef.current) return;

    // Synchroniser l'état de GameEngine avec le jeu actuel
    gameEngineRef.current.setState(gameRef.current);
    let currentGame = gameRef.current; // Utiliser la ref pour avoir l'état le plus frais
    const currentPlayerId = currentGame.players[currentGame.currentPlayerIndex].id;

    let freeMovements = interactionState.type === 'MOVING_PROBE' ? interactionState.count : 0;
    let interruptedForChoice = false;

    // Parcourir le chemin étape par étape (en ignorant le point de départ à l'index 0)
    for (let i = 1; i < path.length; i++) {
      const cellKey = path[i];
      const disk = cellKey[0] as DiskName;
      const sector = parseInt(cellKey.substring(1)) as SectorNumber;

      // Sauvegarder l'état avant le mouvement pour l'historique (copie profonde)
      const stateBeforeMove = structuredClone(currentGame);

      // Utiliser l'action pour effectuer le mouvement
      const useFree = freeMovements > 0;
      const action = new MoveProbeAction(currentPlayerId, probeId, { disk, sector }, useFree);
      const result = gameEngineRef.current.executeAction(action);

      if (result.success && result.updatedState) {
        const updatedGame = result.updatedState;

        // Récupérer le message généré par ProbeSystem via l'action
        const message = action.executionMessage;

        if (message) {
          const updatedPlayer = updatedGame.players.find(p => p.id === currentPlayerId);
          const oldPlayer = currentGame.players.find(p => p.id === currentPlayerId);

          // Détection Card 19 (Assistance Gravitationnelle)
          const targetCell = getCell(disk, sector, createRotationState(updatedGame.board.solarSystem.rotationAngleLevel1 || 0, updatedGame.board.solarSystem.rotationAngleLevel2 || 0, updatedGame.board.solarSystem.rotationAngleLevel3 || 0));
          const hasChoiceBuff = oldPlayer?.activeBuffs.some(b => b.type === 'CHOICE_MEDIA_OR_MOVE');

          if (hasChoiceBuff && targetCell?.hasPlanet && targetCell.planetId !== 'earth') {
            // Calculer les mouvements restants après ce pas (si gratuit)
            const remaining = useFree ? freeMovements - 1 : freeMovements;
            setInteractionState({
              type: 'CHOOSING_MEDIA_OR_MOVE',
              sequenceId: `move-${Date.now()}`,
              remainingMoves: remaining
            });
            interruptedForChoice = true;
            if (i < path.length - 1) {
              setToast({ message: "Déplacement interrompu. Choisissez un bonus.", visible: true });
            }
          }

          addToHistory(message, currentPlayerId, stateBeforeMove, undefined, interactionState.sequenceId);
        }

        currentGame = updatedGame;
        gameRef.current = currentGame; // Mettre à jour la ref locale pour garantir la fraîcheur
        setGame(currentGame);
        if (gameEngineRef.current) gameEngineRef.current.setState(currentGame); // Mettre à jour l'état du moteur pour la prochaine étape du mouvement

        // Mettre à jour le compteur de mouvements gratuits
        if (useFree) {
          // On ne décrémente que si le mouvement a réellement été gratuit (pas de dépense d'énergie)
          if (!message.includes('paye')) {
            freeMovements--;
          }
        }

        // Petit délai pour l'animation
        await new Promise(resolve => setTimeout(resolve, 300));

        if (interruptedForChoice) {
          break;
        }

      } else {
        console.error('Erreur lors du déplacement de la sonde (étape):', result.error);
        setToast({ message: result.error || 'Impossible de déplacer la sonde', visible: true });
        break; // Arrêter le mouvement en cas d'erreur
      }
    }
    if (interactionState.type === 'MOVING_PROBE' && !interruptedForChoice) {
      if (freeMovements > 0) {
        setInteractionState({ type: 'MOVING_PROBE', count: freeMovements });
        setToast({ message: `Encore ${freeMovements} déplacement${freeMovements > 1 ? 's' : ''} gratuit${freeMovements > 1 ? 's' : ''}. Sélectionnez une sonde à déplacer.`, visible: true });
      } else {
        setInteractionState({ type: 'IDLE' });
      }
    }
  };

  // Gestionnaire pour jouer une carte (payer son coût en crédits)
  const handlePlayCardRequest = (cardId: string) => {
    if (!game || !gameRef.current) return;

    const currentGame = gameRef.current;
    const currentPlayer = currentGame.players[currentGame.currentPlayerIndex];
    const card = currentPlayer.cards.find(c => c.id === cardId);

    const action = new PlayCardAction(currentPlayer.id, cardId);
    const validation = ActionValidator.validateAction(currentGame, action);
    if (!validation.valid) {
      setToast({ message: validation.errors[0]?.message || "Impossible de jouer cette carte", visible: true });
      return;
    }

    // Vérifier si la carte donne une sonde et si le joueur peut la lancer
    if (card && card.immediateEffects) {
      const probeEffect = card.immediateEffects.find(e => e.type === 'GAIN' && e.target === 'PROBE');
      if (probeEffect) {
        const ignoreLimit = card.passiveEffects?.some(e => e.type === 'IGNORE_PROBE_LIMIT' && e.value === true);
        // Vérifier la limite de sondes (sans vérifier le coût car c'est un gain)
        const canLaunch = ProbeSystem.canLaunchProbe(currentGame, currentPlayer.id, false, ignoreLimit);
        if (!canLaunch.canLaunch && canLaunch.reason && canLaunch.reason.includes('Limite')) {
          setConfirmModalState({
            visible: true,
            cardId: cardId,
            message: "Vous avez atteint la limite de sondes dans le système solaire. L'action de lancer une sonde sera perdue. Voulez-vous continuer ?"
          });
          return;
        }
      }
    }

    // Vérifier si la carte donne des données et si le joueur peut les stocker
    if (card && card.immediateEffects) {
      const dataEffect = card.immediateEffects.find(e => e.type === 'GAIN' && e.target === 'DATA');
      if (dataEffect) {
        if ((currentPlayer.data || 0) >= GAME_CONSTANTS.MAX_DATA) {
          setConfirmModalState({
            visible: true,
            cardId: cardId,
            message: "Vous avez atteint la limite de données. Le gain de données sera perdu. Voulez-vous continuer ?"
          });
          return;
        }
      }
    }

    // Vérifier si la carte donne des médias et si le joueur peut les stocker
    if (card && card.immediateEffects) {
      const mediaEffect = card.immediateEffects.find(e => e.type === 'GAIN' && e.target === 'MEDIA');
      if (mediaEffect) {
        if ((currentPlayer.mediaCoverage || 0) >= GAME_CONSTANTS.MAX_MEDIA_COVERAGE) {
          setConfirmModalState({
            visible: true,
            cardId: cardId,
            message: "Vous avez atteint la limite de couverture médiatique. Le gain de médias sera perdu. Voulez-vous continuer ?"
          });
          return;
        }
      }
    }

    // Vérifier si la carte donne des atterisages et si le joueur n'a pas de sonde sur une planète
    if (card && card.immediateEffects) {
      const landEffect = card.immediateEffects.find(e => e.type === 'ACTION' && e.target === 'LAND');
      if (landEffect) {
        const probeInfo = ProbeSystem.probeOnPlanetInfo(currentGame, currentPlayer.id);
        if (!probeInfo.hasProbe) {
          setConfirmModalState({
            visible: true,
            cardId: cardId,
            message: "Vous n'avez aucune sonde sur une planète pour effectuer l'atterrissage. L'action sera perdue. Voulez-vous continuer ?"
          });
          return;
        }
      }
    }

    // Vérifier si la carte donne une technologie et si le joueur peut l'acquérir
    if (card && card.immediateEffects) {
      const techEffect = card.immediateEffects.find(e => e.type === 'GAIN' && (e.target === 'TECHNOLOGY' || e.target === 'ANY_TECHNOLOGY'));
      if (techEffect) {
        let catToCheck: TechnologyCategory | undefined = undefined;
        if (typeof techEffect.value === 'string') {
          catToCheck = techEffect.value as TechnologyCategory;
        } else if (techEffect.value) {
          catToCheck = techEffect.value.color || techEffect.value.category;
        }
        if (!TechnologySystem.canAcquireTech(currentGame, currentPlayer.id, catToCheck)) {
          setConfirmModalState({
            visible: true,
            cardId: cardId,
            message: "Vous avez déjà toutes les technologies disponibles. Le gain de technologie sera perdu. Voulez-vous continuer ?"
          });
          return;
        }
      }
    }

    executePlayCard(cardId);
  };

  const executePlayCard = (cardId: string) => {
    if (!game || !gameRef.current) return;

    const currentGame = gameRef.current;
    const currentPlayer = currentGame.players[currentGame.currentPlayerIndex];

    const result = CardSystem.playCard(currentGame, currentPlayer.id, cardId);
    if (result.error) {
      setToast({ message: result.error, visible: true });
      return;
    }

    const sequenceId = `seq-${Date.now()}`;

    console.log(result);
    const { updatedGame: gameAfterBonuses, newPendingInteractions, passiveGains, logs: allBonusLogs, historyEntries: bonusHistoryEntries } = ResourceSystem.processBonuses(result.bonuses || {}, result.updatedGame, currentPlayer.id, cardId, sequenceId);
    console.log(newPendingInteractions);

    // Marquer l'action principale comme effectuée manuellement
    const playerIndex = gameAfterBonuses.players.findIndex(p => p.id === currentPlayer.id);
    if (playerIndex !== -1) gameAfterBonuses.players[playerIndex].hasPerformedMainAction = true;

    // Ajouter la carte jouée à la pile de défausse ou aux cartes jouées (Missions Fin de partie)
    const cardPlayed = currentPlayer.cards.find(c => c.id === cardId);
    if (cardPlayed) {
      const playerInNewGame = gameAfterBonuses.players.find(p => p.id === currentPlayer.id);

      if (cardPlayed.type === CardType.END_GAME) {
        if (playerInNewGame) {
          if (!playerInNewGame.playedCards) playerInNewGame.playedCards = [];
          playerInNewGame.playedCards.push(cardPlayed);
        }
      } else if (cardPlayed.type === CardType.CONDITIONAL_MISSION || cardPlayed.type === CardType.TRIGGERED_MISSION) {
        if (playerInNewGame) {
          if (!playerInNewGame.missions) playerInNewGame.missions = [];
          const newMission: Mission = {
            id: `mission-${cardPlayed.id}-${Date.now()}`,
            cardId: cardPlayed.id,
            name: cardPlayed.name,
            description: cardPlayed.description,
            ownerId: currentPlayer.id,
            requirements: cardPlayed.permanentEffects || [],
            progress: { current: 0, target: cardPlayed.permanentEffects?.length || 0 },
            completed: false,
            originalCard: cardPlayed
          };
          playerInNewGame.missions.push(newMission);
        }
      } else {
        if (!gameAfterBonuses.decks.discardPile) gameAfterBonuses.decks.discardPile = [];
        gameAfterBonuses.decks.discardPile.push(cardPlayed);
      }
    }

    const card = currentGame.players[currentGame.currentPlayerIndex].cards.find(c => c.id === cardId)!;
    setGame(gameAfterBonuses);
    if (gameEngineRef.current) gameEngineRef.current.setState(gameAfterBonuses);

    // Construction du message d'historique unifié
    let message = `paye ${card.cost} crédit${card.cost > 1 ? 's' : ''} pour jouer carte "${card.name}"`;

    if (result.bonuses && result.bonuses.subventionDetails) {
      const { cardName, bonusText } = result.bonuses.subventionDetails;
      message += ` et pioche la carte "${cardName}" pour gagner ${bonusText}`;

      if (bonusText === "1 Donnée") {
        const idx = passiveGains.indexOf(ResourceSystem.formatResource(1, 'DATA'));
        if (idx > -1) passiveGains.splice(idx, 1);
      } else if (bonusText === "1 Média") {
        const idx = passiveGains.indexOf(ResourceSystem.formatResource(1, 'MEDIA'));
        if (idx > -1) passiveGains.splice(idx, 1);
      }
    }

    // Filtrer les logs pour séparer ce qu'on fusionne de ce qu'on garde séparé
    const isPassiveLog = (log: string) => log.startsWith('gagne ') || log.startsWith('pioche ');
    const isMovementLog = (log: string) => log.includes('déplacement') && log.includes('gratuit');

    const movementLogs = allBonusLogs.filter(isMovementLog);
    const otherLogs = allBonusLogs.filter(log => !isPassiveLog(log) && !isMovementLog(log));

    const extras = [];
    if (passiveGains.length > 0) {
      extras.push(`gagne ${passiveGains.join(', ')}`);
    }
    if (movementLogs.length > 0) {
      extras.push(movementLogs.join(', '));
    }
    if (extras.length > 0) {
      message += ` et ${extras.join(' et ')}`;
    }

    addToHistory(message, currentPlayer.id, currentGame, undefined, sequenceId);
    if (otherLogs.length > 0) {
      otherLogs.forEach(log => addToHistory(log, currentPlayer.id, gameAfterBonuses, undefined, sequenceId));
    }

    // Add history entries from processBonuses (objects)
    if (bonusHistoryEntries && bonusHistoryEntries.length > 0) {
      bonusHistoryEntries.forEach(entry => addToHistory(entry.message, entry.playerId, gameAfterBonuses, undefined, sequenceId));
    }

    // Gérer les interactions en attente (ex: Mouvements, Tech, Signals, etc.)
    if (newPendingInteractions.length > 0) {
      const interactionsWithSeqId = newPendingInteractions.map(i => ({ ...i, sequenceId }));
      setPendingInteractions(prev => [...interactionsWithSeqId, ...prev]);
    }
  };

  // Gestionnaire pour l'action gratuite (défausse de carte)
  const handleDiscardCardAction = (cardId: string) => {
    if (!game) return;

    let updatedGame = game;
    const currentPlayer = updatedGame.players[updatedGame.currentPlayerIndex];
    const card = currentPlayer.cards.find(c => c.id === cardId);
    if (!card) return;

    // Appliquer l'effet de l'action gratuite
    if (card.freeAction === FreeActionType.MEDIA) {
      const res = ResourceSystem.updateMedia(updatedGame, currentPlayer.id, 1);
      updatedGame = res.updatedGame;
      addToHistory(`défausse carte "${card.name}" et gagne ${ResourceSystem.formatResource(1, 'MEDIA')}`, currentPlayer.id, game);
    } else if (card.freeAction === FreeActionType.DATA) {
      const res = ResourceSystem.updateData(updatedGame, currentPlayer.id, 1);
      updatedGame = res.updatedGame;
      addToHistory(`défausse carte "${card.name}" et gagne ${ResourceSystem.formatResource(1, 'DATA')}`, currentPlayer.id, game);
    } else if (card.freeAction === FreeActionType.MOVEMENT) {
      const probes = currentPlayer.probes.filter(p => p.state === ProbeState.IN_SOLAR_SYSTEM);
      const autoSelectProbeId = probes.length === 1 ? probes[0].id : undefined;
      interactionState.sequenceId = `move-${Date.now()}`;
      setInteractionState({ type: 'MOVING_PROBE', count: 1, autoSelectProbeId, sequenceId: interactionState.sequenceId});
      setToast({ message: "Veuillez sélectionnez une sonde à déplacer.", visible: true });
      addToHistory(`défausse carte "${card.name}" et gagne 1 déplacement gratuit`, currentPlayer.id, game, undefined, interactionState.sequenceId);
    }

    // Défausser la carte
    updatedGame = CardSystem.discardCard(updatedGame, currentPlayer.id, cardId);

    setGame(updatedGame);
    if (gameEngineRef.current) gameEngineRef.current.setState(updatedGame);
  };

  // Gestionnaire pour l'action d'achat de carte avec du média
  const handleBuyCardAction = () => {
    if (interactionState.type !== 'IDLE') return;

    setInteractionState({ type: 'ACQUIRING_CARD', count: 1 });
    setToast({ message: "Veuillez sélectionnez une carte dans la rangée ou la pioche.", visible: true });
  };

  // Gestionnaire pour les échanges directs (via les boutons rapides)
  const handleDirectTrade = (spendType: string, gainType: string) => {
    if (!game) return;

    if (interactionState.type !== 'IDLE') return;
    const currentPlayer = game.players[game.currentPlayerIndex];

    // Mettre à jour GameEngine
    const result = ResourceSystem.tradeResources(game, currentPlayer.id, spendType, gainType);
    if (result.error) {
      setToast({ message: result.error, visible: true });
      return;
    }

    // Détecter si une carte a été piochée (pour l'afficher dans le log)
    let extraMsg = "";
    if (gainType === 'card') {
        const updatedPlayer = result.updatedGame.players.find(p => p.id === currentPlayer.id);
        if (updatedPlayer && updatedPlayer.cards.length > currentPlayer.cards.length) {
            const newCard = updatedPlayer.cards[updatedPlayer.cards.length - 1];
            extraMsg = ` "${newCard.name}"`;
        }
    }

    // Finaliser la transaction
    setGame(result.updatedGame);
    if (gameEngineRef.current) gameEngineRef.current.setState(result.updatedGame);
    setInteractionState({ type: 'IDLE' });
    addToHistory(`échange ${ResourceSystem.formatResource(2, spendType)} contre ${ResourceSystem.formatResource(1, gainType)}${extraMsg}`, currentPlayer.id, game);
  };

  // Gestionnaire pour la sélection d'une carte de la pioche ou de la rangée principale
  const handleCardRowClick = (cardId?: string) => { // cardId undefined means deck
    if (!game) return;

    // Cas 1: Sélection pour 2eme action scan
    if (interactionState.type === 'SELECTING_SCAN_CARD') {
      if (!cardId) return; // Cannot select deck for scan color
      const card = game.decks.cardRow.find(c => c.id === cardId);
      if (!card) return;

      setInteractionState({ type: 'SELECTING_SCAN_SECTOR', color: card.scanSector, sequenceId: interactionState.sequenceId, cardId: card.id });
    // Cas 2: Sélection pour achat de carte
    } else if (interactionState.type === 'ACQUIRING_CARD') {
        const currentPlayer = game.players[game.currentPlayerIndex];
        let result: { updatedGame: Game, error?: string };

        // Passer interactionState.isFree
        result = ResourceSystem.buyCard(game, currentPlayer.id, cardId, interactionState.isFree);
        if (result.error) {
          setToast({ message: result.error, visible: true });
          // On reste dans l'état ACQUIRING_CARD pour permettre de réessayer ou d'annuler via l'overlay
          return;
        }

        // Traite l'effet de Subventions (carte 11)
        let freeActionLog = "";
        if (interactionState.triggerFreeAction) {
          const player = result.updatedGame.players.find(p => p.id === currentPlayer.id);
          if (player && player.cards.length > 0) {
            const card = player.cards[player.cards.length - 1];
            card.isRevealed = true;

            if (card.freeAction === FreeActionType.MEDIA) {
              player.mediaCoverage = Math.min(player.mediaCoverage + 1, GAME_CONSTANTS.MAX_MEDIA_COVERAGE);
              freeActionLog = " et gagne 1 Média (Action gratuite)";
            } else if (card.freeAction === FreeActionType.DATA) {
              player.data = Math.min(player.data + 1, GAME_CONSTANTS.MAX_DATA);
              freeActionLog = " et gagne 1 Donnée (Action gratuite)";
            } else if (card.freeAction === FreeActionType.MOVEMENT) {
              setPendingInteractions(prev => [{ type: 'MOVING_PROBE', count: 1 }, ...prev]);
              setToast({ message: "Veuillez sélectionnez une sonde à déplacer.", visible: true });
              freeActionLog = " et gagne 1 Déplacement (Action gratuite)";
            }
          }
        }

        // Récupérer le nom de la carte pour le log
        let cardName = "Inconnue";
        if (cardId) {
          const card = game.decks.cardRow.find(c => c.id === cardId);
          if (card) cardName = card.name;
        } else {
          // Depuis le deck
          const updatedPlayer = result.updatedGame.players.find(p => p.id === currentPlayer.id);
          if (updatedPlayer && updatedPlayer.cards.length > 0) {
            cardName = updatedPlayer.cards[updatedPlayer.cards.length - 1].name;
          }
        }

        setGame(result.updatedGame);
        if (gameEngineRef.current) gameEngineRef.current.setState(result.updatedGame);

        const logMsg = interactionState.isFree
          ? (cardId ? `choisit la carte "${cardName}"` : `pioche la carte "${cardName}"`)
          : (cardId ? `paye 3 médias pour acheter la carte "${cardName}" depuis la rangée` : `paye 3 médias pour acheter la carte "${cardName}" depuis la pioche`);

        const sequenceId = interactionState.sequenceId;

        // Pour l'achat normal, on veut que l'undo revienne à IDLE (pas à la sélection)
        const undoState: InteractionState = !interactionState.isFree ? { type: 'IDLE' } : interactionState;

        addToHistory(logMsg + freeActionLog, currentPlayer.id, game, undoState, sequenceId);

        // Gérer le compteur pour les sélections multiples
        if (interactionState.count > 1) {
          setInteractionState({ ...interactionState, count: interactionState.count - 1 });
        } else {
          setInteractionState({ type: 'IDLE' });
        }
    }
  };

  // Gestionnaire pour l'échange de cartes contre des resources crédit/énergie
  const handleTradeCardAction = (payload?: any) => {
    if (interactionState.type !== 'IDLE') return;
    const targetGain = payload?.targetGain;
    if (!targetGain) return;

    setInteractionState({ type: 'TRADING_CARD', count: 2, targetGain, selectedCards: [] });
  }

  // Gestionnaire unifié pour les échanges
  const handleConfirmTrade = () => {
    if (!game) return;

    if (interactionState.type !== 'TRADING_CARD') return;
    const currentPlayer = game.players[game.currentPlayerIndex];

    // Capturer les cartes avant qu'elles ne soient retirées
    const cardsToDiscard = currentPlayer.cards.filter(c => interactionState.selectedCards.includes(c.id));
    const cardNames = cardsToDiscard.map(c => `"${c.name}"`).join(' et ');

    // Mettre à jour GameEngine
    const result = ResourceSystem.tradeResources(game, currentPlayer.id, 'card', interactionState.targetGain, interactionState.selectedCards);
    if (result.error) {
      setToast({ message: result.error, visible: true });
      return;
    }

    // Ajouter à la pile de défausse
    if (cardsToDiscard.length > 0) {
      if (!result.updatedGame.decks.discardPile) result.updatedGame.decks.discardPile = [];
      result.updatedGame.decks.discardPile.push(...cardsToDiscard);
    }

    // Finaliser la transaction
    setGame(result.updatedGame);
    if (gameEngineRef.current) gameEngineRef.current.setState(result.updatedGame);
    setInteractionState({ type: 'IDLE' });
    addToHistory(`échange ${cardNames} contre ${ResourceSystem.formatResource(1, interactionState.targetGain)}`, currentPlayer.id, game, { type: 'IDLE' });
  };

  // Fonction interne pour traiter l'achat (commune à l'achat direct et après sélection)
  const processTechPurchase = (tech: Technology, targetComputerCol?: number, noTileBonus?: boolean, baseGame?: Game) => {
    if (!game) return;

    const currentGame = baseGame || gameRef.current;
    const currentPlayer = currentGame.players[currentGame.currentPlayerIndex];

    // Mettre à jour GameEngine
    const { updatedGame, gains } = TechnologySystem.acquireTechnology(currentGame, currentPlayer.id, tech, targetComputerCol, noTileBonus);

    // Finaliser la transaction
    setGame(updatedGame);
    if (gameEngineRef.current) gameEngineRef.current.setState(updatedGame);
    setInteractionState({ type: 'IDLE' });
    addToHistory(`acquiert technologie "${tech.type} ${tech.name}"${gains.length > 0 ? ` et gagne ${gains.join(', ')}` : ''}`, currentPlayer.id, currentGame, undefined, interactionState.sequenceId);
  };

  // Gestionnaire pour l'achat de technologie (clic initial)
  const handleTechClick = (tech: Technology) => {
    if (!game) return;

    // Cas 1: Mode recherche actif ou bonus
    if (interactionState.type === 'ACQUIRING_TECH') {
      if (tech.type === TechnologyCategory.COMPUTING) {
        // Sélection du slot
        const { sequenceId } = interactionState;
        setInteractionState({ type: 'SELECTING_COMPUTER_SLOT', tech, sequenceId });
      } else {
        // Finaliser l'achat
        const { noTileBonus } = interactionState;
        processTechPurchase(tech, undefined, noTileBonus);
      }
    } else
      // Cas 2: Clic direct depuis IDLE (Raccourci Action Recherche)
      if (interactionState.type === 'IDLE' && !game.players[game.currentPlayerIndex].hasPerformedMainAction) {
        const currentPlayer = game.players[game.currentPlayerIndex];
        const action = new ResearchTechAction(currentPlayer.id);
        const validation = ActionValidator.validateAction(game, action);
        if (!validation.valid) {
          setToast({ message: validation.errors[0]?.message || "Recherche impossible", visible: true });
          return;
        }

        let updatedGame = structuredClone(game);
        const player = updatedGame.players[updatedGame.currentPlayerIndex];

        // Initier la séquence
        interactionState.sequenceId = `tech-${Date.now()}`;

        // Payer le coût
        player.mediaCoverage -= GAME_CONSTANTS.TECH_RESEARCH_COST_MEDIA;
        addToHistory(`paye ${GAME_CONSTANTS.TECH_RESEARCH_COST_MEDIA} médias pour <strong>Rechercher une technologie</strong>`, player.id, game, undefined, interactionState.sequenceId);

        // Faire tourner le systeme solaire
        const rotationResult = performRotation(updatedGame);
        updatedGame = rotationResult.updatedGame;
        addToHistory(rotationResult.logs.join(', '), player.id, game, undefined, interactionState.sequenceId);

        const playerIndex = updatedGame.players.findIndex(p => p.id === player.id);
        if (playerIndex !== -1) updatedGame.players[playerIndex].hasPerformedMainAction = true;

        if (tech.type === TechnologyCategory.COMPUTING) {
          // Sélection du slot
          setGame(updatedGame);
          if (gameEngineRef.current) gameEngineRef.current.setState(updatedGame);
          setInteractionState({ type: 'SELECTING_COMPUTER_SLOT', tech, sequenceId: interactionState.sequenceId });
        } else {
          // Finaliser l'achat
          processTechPurchase(tech, undefined, false, updatedGame);
        }
      }
  };

  // Gestionnaire pour la sélection de la colonne ordinateur
  const handleComputerColumnSelect = (col: number) => {
    if (!game || !gameRef.current) return;

    if (interactionState.type !== 'SELECTING_COMPUTER_SLOT') return;

    // Vérifier que c'est une colonne valide (1, 3, 5, 6)
    if (![1, 3, 5, 6].includes(col)) return;

    // Vérifier si la colonne est déjà occupée par une technologie
    const currentGame = gameRef.current;
    const currentPlayer = currentGame.players[currentGame.currentPlayerIndex];
    if (currentPlayer.dataComputer.slots?.[`${col}a`]?.bonus === '2pv') {
      setToast({ message: "Emplacement déjà occupé. Sélectionnez un autre emplacement.", visible: true });
      return;
    }

    // Finaliser l'achat
    processTechPurchase(interactionState.tech, col, false);
  };

  // Gestionnaire pour la pioche de carte depuis le PlayerBoardUI (ex: bonus ordinateur)
  const handleDrawCard = (count: number, source: string) => {
    if (!game) return;

    const updatedGame = CardSystem.drawCards(game, game.players[game.currentPlayerIndex].id, count, source);

    setGame(updatedGame);
    if (gameEngineRef.current) gameEngineRef.current.setState(updatedGame);
    addToHistory(`pioche ${count} carte${count > 1 ? 's' : ''} (${source})`, game.players[game.currentPlayerIndex].id, game);
  };

  // Gestionnaire pour le clic sur une planète (ex: Terre pour lancer une sonde)
  const handlePlanetClick = (planetId: string) => {
    if (planetId === 'earth') {
      handleAction(ActionType.LAUNCH_PROBE);
    }
  };

  // Gestionnaire pour les bonus ordinateur (déclenché depuis PlayerBoardUI)
  const handleComputerBonus = (type: string, amount: number, sequenceId?: string) => {
    if (!game || !gameRef.current) return;

    if (type === 'reservation') {
      const currentPlayer = gameRef.current.players[gameRef.current.currentPlayerIndex];
      const count = Math.min(amount, currentPlayer.cards.length);
      if (count > 0) {
        const seqId = sequenceId || interactionState.sequenceId;
        setInteractionState({ type: 'RESERVING_CARD', count: count, sequenceId: seqId, selectedCards: [] });
      }
    }
  };

  // Gestionnaire pour le clic sur un objectif (placement de marqueur de palier)
  const handleObjectiveClick = (tileId: string) => {
    if (!game) return;

    if (interactionState.type !== 'PLACING_OBJECTIVE_MARKER') return;

    const tile = game.board.objectiveTiles.find(t => t.id === tileId);
    if (!tile) return;

    const currentPlayer = game.players[game.currentPlayerIndex];

    // Vérifier si le joueur a déjà un marqueur sur cet objectif
    if (tile.markers.includes(currentPlayer.id)) {
      setToast({ message: "Emplacement déjà occupé. Sélectionnez un autre objectif.", visible: true });
      return;
    }

    // Mettre à jour le jeu
    const updatedGame = structuredClone(game);
    const upTile = updatedGame.board.objectiveTiles.find(t => t.id === tileId)!;
    const upPlayer = updatedGame.players[updatedGame.currentPlayerIndex];

    upTile.markers.push(upPlayer.id);
    upPlayer.claimedGoldenMilestones.push(interactionState.milestone);

    setGame(updatedGame);
    if (gameEngineRef.current) gameEngineRef.current.setState(updatedGame);

    addToHistory(`a atteint le palier ${interactionState.milestone} PV et place un marqueur sur "${tile.name}" (Points fin de partie)`, upPlayer.id, game, interactionState);
    setInteractionState({ type: 'IDLE' });

    // Continuer la fin de tour (vérifier d'autres paliers ou passer au joueur suivant)
    handleNextPlayer();
  };

  // Gestionnaire pour le clic sur le background
  const handleBackgroundClick = () => {
    if (interactionState.type === 'MOVING_PROBE') {
      setInteractionState({ type: 'IDLE' });
    }
  }

  // Si le jeu n'est pas initialisé, afficher uniquement les modales de démarrage
  if (!game) {
    return (
      <div className="seti-root">
        <SettingsModal 
          visible={settingsVisible}
          onNewGame={handleNewGameRequest}
          onSaveGame={handleSaveGame}
          onLoadGame={handleLoadGame}
          onContinue={handleContinue}
          hasAutosave={hasAutosave}
          onClose={() => setSettingsVisible(false)}
          canClose={false}
        />
        <NewGameModal
          visible={newGameModalVisible}
          onConfirm={handleNewGameConfirm}
          onCancel={() => { setNewGameModalVisible(false); setSettingsVisible(true); }}
        />
      </div>
    );
  }

  const humanPlayer = game.players.find(p => p.type === 'human');
  const currentPlayer = game.players[game.currentPlayerIndex];
  const currentPlayerIdToDisplay = viewedPlayerId || humanPlayer?.id || currentPlayer.id;

  return (
    <div className="seti-root">
      {/* Panneau de débogage pour le développement */}
      <DebugPanel
        game={game}
        setGame={setGame}
        onHistory={addToHistory}
        interactionState={interactionState} />

      {activeTooltip && (
        <Tooltip 
          content={activeTooltip.content} 
          targetRect={activeTooltip.rect} 
          pointerEvents={activeTooltip.pointerEvents}
          onMouseEnter={activeTooltip.onMouseEnter}
          onMouseLeave={activeTooltip.onMouseLeave}
        />
      )}

      {/* Modale de sélection de carte de fin de manche */}
      <PassModal
        visible={passModalState.visible}
        cards={passModalState.cards}
        onConfirm={(selectedCardId) => {
          const currentPlayer = game.players[game.currentPlayerIndex];
          const cardsToKeep = passModalState.cardsToKeep || currentPlayer.cards.map(c => c.id);
          performPass(cardsToKeep, selectedCardId);
          setPassModalState({ visible: false, cards: [], selectedCardId: null });
        }}
      />

      {/* Modale de choix Média ou Déplacement (Carte 19) */}
      {interactionState.type === 'CHOOSING_MEDIA_OR_MOVE' && (
        <MediaOrMoveModal onChoice={handleMediaOrMoveChoice} />
      )}

      {/* Modale pour Observation 2 (Scanner un secteur) */}
      {interactionState.type === 'CHOOSING_OBS2_ACTION' && (
        <Observation2Modal onChoice={handleObs2Choice} />
      )}

      {/* Modale pour Observation 3 (Scanner un secteur) */}
      {interactionState.type === 'CHOOSING_OBS3_ACTION' && (
        <Observation3Modal onChoice={handleObs3Choice} />
      )}

      {/* Modale pour Observation 4 (Scanner un secteur) */}
      {interactionState.type === 'CHOOSING_OBS4_ACTION' && (() => {
        const canLaunch = currentPlayer.energy >= 1 && ProbeSystem.canLaunchProbe(game, currentPlayer.id, false).canLaunch;
        const canMove = currentPlayer.probes.some(p => p.state === ProbeState.IN_SOLAR_SYSTEM);
        return (
          <Observation4Modal onChoice={handleObs4Choice} canLaunch={canLaunch} canMove={canMove} />
        );
      })()}

      {/* Menu de choix des bonus interactifs */}
      <BonusChoiceModal
        interactionState={interactionState}
        onChoice={handleMenuChoice}
        onFinish={() => setInteractionState({ type: 'IDLE' })}
      />

      {/* Alien Discovery Notification */}
      <AlienDiscoveryModal
        visible={alienDiscoveryNotification?.visible || false}
        message={alienDiscoveryNotification?.message || ''}
      />

      {/* Modale de confirmation */}
      <ConfirmModal
        visible={confirmModalState.visible}
        message={confirmModalState.message}
        onCancel={() => setConfirmModalState({ visible: false, cardId: null, message: '', onConfirm: undefined })}
        onConfirm={() => {
          if (confirmModalState.onConfirm) {
            confirmModalState.onConfirm();
          } else if (confirmModalState.cardId) {
            executePlayCard(confirmModalState.cardId);
          }
          setConfirmModalState({ visible: false, cardId: null, message: '', onConfirm: undefined });
        }}
      />

      <SettingsModal 
        visible={settingsVisible}
        onNewGame={handleNewGameRequest}
        onSaveGame={handleSaveGame}
        onLoadGame={handleLoadGame}
        onContinue={handleContinue}
        hasAutosave={false} // Pas besoin de montrer "Continuer" si on est déjà en jeu (Fermer suffit)
        onClose={() => setSettingsVisible(false)}
        canClose={!!game}
      />

      <NewGameModal
        visible={newGameModalVisible}
        onConfirm={handleNewGameConfirm}
        onCancel={() => { setNewGameModalVisible(false); setSettingsVisible(true); }}
      />

      {/* Ecran de fin de partie */}
      {game.phase === GamePhase.FINAL_SCORING && <EndGameModal game={game} />}

      {/* Overlay pour la recherche de technologie ou l'achat de carte */}
      {/*(interactionState.type === 'ACQUIRING_TECH' || interactionState.type === 'ACQUIRING_CARD' || interactionState.type === 'RESERVING_CARD' || interactionState.type === 'SELECTING_SCAN_CARD') && (
        <div className="seti-interaction-overlay" onClick={() => {
          if (interactionState.type === 'ACQUIRING_CARD') {
            setInteractionState({ type: 'IDLE' });
          } else if (interactionState.type === 'SELECTING_SCAN_CARD') {
            // Cannot cancel easily in middle of sequence, maybe toast warning?
          } else if (interactionState.type === 'RESERVING_CARD') {
            setToast({ message: "Veuillez sélectionner une carte à réserver.", visible: true });
          } else {
            setToast({ message: "Veuillez sélectionner une technologie.", visible: true });
          }
        }} />
      )*/}

      <div className="seti-root-inner">
        <div className="seti-left-panel">
          <div className={`seti-left-panel-wrapper ${interactionState.type === 'RESERVING_CARD' ? 'reserving' : ''}`}>
            <PlayerBoardUI
              game={game}
              playerId={currentPlayerIdToDisplay}
              interactionState={interactionState}
              onViewPlayer={setViewedPlayerId}
              onAction={handleAction}
              onCardClick={handleCardClick}
              onDiscardCardAction={handleDiscardCardAction}
              onConfirmDiscardForEndTurn={handleConfirmDiscard}
              onTradeCardAction={(targetGain) => handleTradeCardAction({ targetGain })}
              onConfirmTrade={handleConfirmTrade}
              onConfirmReserve={handleConfirmReservation}
              onBuyCardAction={handleBuyCardAction}
              onDirectTradeAction={handleDirectTrade}
              onDrawCard={handleDrawCard}
              onPlayCard={handlePlayCardRequest}
              onGameUpdate={(newGame) => { setGame(newGame); if (gameEngineRef.current) gameEngineRef.current.setState(newGame); }}
              onComputerSlotSelect={handleComputerColumnSelect}
              onNextPlayer={handleNextPlayer}
              onHistory={(message, sequenceId) => addToHistory(message, game.players[game.currentPlayerIndex].id, game, undefined, sequenceId)}
              onComputerBonus={handleComputerBonus}
              onConfirmDiscardForSignal={handleConfirmDiscard}
              setActiveTooltip={setActiveTooltip}
              onSettingsClick={() => setSettingsVisible(true)}
            />
          </div>
        </div>
        <div className="seti-right-panel">
          <SolarSystemBoardUI
            game={game}
            interactionState={interactionState}
            onProbeMove={handleProbeMove}
            onPlanetClick={handlePlanetClick}
            onOrbit={handleOrbit}
            onLand={handleLand}
            onSectorClick={handleSectorClick}
            onBackgroundClick={handleBackgroundClick}
            setActiveTooltip={setActiveTooltip}
          />

          {/* Toast Notification */}
          {toast && toast.visible && (
            <div className="seti-toast">
              {toast.message}
            </div>
          )}

          {/* Plateaux annexes en haut à gauche */}
          <div className={`seti-side-panels-container ${(interactionState.type === 'ACQUIRING_TECH' || interactionState.type === 'ACQUIRING_CARD' || interactionState.type === 'SELECTING_SCAN_CARD') ? 'high-z-index' : ''}`}>
            {/* Objectifs */}
            <ObjectiveBoardUI
              game={game}
              interactionState={interactionState}
              onObjectiveClick={handleObjectiveClick}
              setActiveTooltip={setActiveTooltip}
            />

            {/* Technologies */}
            <TechnologyBoardUI
              game={game}
              interactionState={interactionState}
              onTechClick={handleTechClick}
              setActiveTooltip={setActiveTooltip}
            />

            {/* Rangée de Cartes */}
            <CardRowUI
              game={game}
              interactionState={interactionState}
              onCardClick={handleCardRowClick}
              setActiveTooltip={setActiveTooltip}
            />
          </div>

          {/* Historique en haut à droite */}
          <HistoryBoardUI
            historyLog={historyLog}
            game={game}
            onUndo={handleUndo}
            setActiveTooltip={setActiveTooltip}
          />

          {/* Plateau Alien en bas à gauche */}
          <AlienBoardUI
            game={game}
            boardIndex={0}
            interactionState={interactionState}
            onPlaceLifeTrace={handlePlaceLifeTrace}
            setActiveTooltip={setActiveTooltip}
          />

          {/* Plateau Alien en bas à droite */}
          <AlienBoardUI
            game={game}
            boardIndex={1}
            interactionState={interactionState}
            onPlaceLifeTrace={handlePlaceLifeTrace}
            setActiveTooltip={setActiveTooltip}
          />
        </div>
      </div>
    </div>
  );
};