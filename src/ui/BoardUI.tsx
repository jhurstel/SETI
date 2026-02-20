import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Game, ActionType, DiskName, SectorNumber, FreeActionType, GAME_CONSTANTS, SectorType, Bonus, Technology, RevenueType, ProbeState, TechnologyCategory, GOLDEN_MILESTONES, NEUTRAL_MILESTONES, LifeTraceType, InteractionState, GamePhase, Mission, Player, SignalType } from '../core/types';
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
import { ProbeSystem } from '../systems/ProbeSystem';
import { createRotationState, getCell, getObjectPosition, FIXED_OBJECTS, INITIAL_ROTATING_LEVEL1_OBJECTS, INITIAL_ROTATING_LEVEL2_OBJECTS, INITIAL_ROTATING_LEVEL3_OBJECTS, getAbsoluteSectorForProbe, performRotation, calculateReachableCellsWithEnergy, calculateAbsolutePosition } from '../core/SolarSystemPosition';
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
import { ComputerSystem } from '../systems/ComputerSystem';
import './BoardUI.css';

// Helper pour les libellés des interactions
const getInteractionLabel = (state: InteractionState): string => {
  switch (state.type) {
    case 'RESERVING_CARD': return `Veuillez réservez ${state.count} carte${state.count > 1 ? 's' : ''}.`;
    case 'DISCARDING_CARD': return `Veuillez défausser ${state.count} carte${state.count > 1 ? 's' : ''}.`;
    case 'TRADING_CARD': return `Veuillez échanger ${state.count} carte${state.count > 1 ? 's' : ''} pour gagner ${state.targetGain}.`;
    case 'ACQUIRING_CARD': return state.isFree ? `Veuillez choisir ${state.count} carte${state.count > 1 ? 's' : ''}.` : `Veuillez acheter ${state.count} carte${state.count > 1 ? 's' : ''}.`;
    case 'MOVING_PROBE': return `Veuillez déplacer une sonde gratuitement (${state.count} déplacement${state.count > 1 ? 's' : ''}).`;
    case 'LANDING_PROBE': return `Veuillez poser une sonde gratuitement.`;
    case 'ACQUIRING_TECH': return state.isBonus ? `Veuillez sélectionner une technologie ${state.category}.` : `Veuillez acheter une technologie ${state.category}.`;
    case 'SELECTING_COMPUTER_SLOT': return `Veuillez sélectionner un emplacement d'ordinateur pour technologie ${state.tech.shorttext}.`;
    case 'ANALYZING': return `Analyse en cours...`;
    case 'PLACING_LIFE_TRACE': return `Veuillez placer trace de vie (${state.color}).`;
    case 'PLACING_OBJECTIVE_MARKER': return `Veuillez placer un marqueur d'objectif pour avoir dépassé ${state.milestone} PV.`;
    case 'SELECTING_SCAN_CARD': return `Veuillez sélectionner une carte de la rangée pour marquer un signal.`;
    case 'SELECTING_SCAN_SECTOR': return state.adjacents ? `Veuillez sélectionner un secteur adjacent à la Terre pour marquer un signal.` : `Veuillez sélectionner un secteur ${state.color} pour marquer un signal.`;
    case 'CHOOSING_MEDIA_OR_MOVE': return `Veuillez sélectionner le bonus de la carte 19.`;
    case 'CHOOSING_OBS2_ACTION': return `Veuillez sélectionner le bonus de technologie Observation II.`;
    case 'CHOOSING_OBS3_ACTION': return `Veuillez sélectionner le bonus de technologie Observation III.`;
    case 'CHOOSING_OBS4_ACTION': return `Veuillez sélectionner le bonus de technologie Observation IV.`;
    case 'DISCARDING_FOR_SIGNAL': return `Veuillez défausser ${state.count} carte${state.count > 1 ? 's' : ''} pour marquer un signal.`;
    case 'REMOVING_ORBITER': return "Veuillez retirer un orbiteur (bonus carte 15).";
    case 'CHOOSING_BONUS_ACTION': return `Veuillez choisir la prochaine action.`;
    case 'RESOLVING_SECTOR': return `Résolution du secteur complété...`;
    case 'DRAW_AND_SCAN': return `Pioche d'une carte pour signal...`;
    case 'CLAIMING_MISSION_REQUIREMENT': return `Validation d'une mission...`;
    case 'ACQUIRING_ALIEN_CARD': return `Veuillez choisir ${state.count} carte${state.count > 1 ? 's' : ''} Alien (Pioche ou Rangée).`;
    default: return "Action inconnue";
  }
};

interface BoardUIProps {
  game?: Game;
}

export const BoardUI: React.FC<BoardUIProps> = ({ game: initialGame }) => {
  // États pour le jeu
  const [game, setGame] = useState<Game | null>(initialGame || null);
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
  const [isPassModalMinimized, setIsPassModalMinimized] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(true); // Open at launch

  // Effet pour afficher un message toast si l'interaction en contient un
  useEffect(() => {
    if (interactionState.type === 'IDLE') {
      setToast({ message: 'Veuillez sélectionner une action ou passer au prochain joueur.', visible: true });
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

  // Réinitialiser l'état minimisé lorsque la modale se ferme
  useEffect(() => {
    if (!passModalState.visible) {
      setIsPassModalMinimized(false);
    }
  }, [passModalState.visible]);

  const checkDataLimitAndProceed = (
    potentialDataGain: number,
    onConfirm: () => void
  ) => {
    if (!game) return;
    const currentPlayer = game.players[game.currentPlayerIndex];
    if (potentialDataGain > 0 && (currentPlayer.data || 0) >= GAME_CONSTANTS.MAX_DATA) {
        setConfirmModalState({
            visible: true,
            cardId: null,
            message: "Vous avez atteint la limite de données. Le gain de données sera perdu. Voulez-vous continuer ?",
            onConfirm: onConfirm
        });
    } else {
        onConfirm();
    }
  };

  const triggerSignalMission = (game: Game, playerId: string, sectorId: string): Game => {
    const updatedGame = structuredClone(game);
    const player = updatedGame.players.find(p => p.id === playerId);
    const sector = updatedGame.board.sectors.find(s => s.id === sectorId);
    if (!player || !sector) return game;

    const processedSources = new Set<string>();
    player.permanentBuffs.forEach(buff => {
        let buffTypeMatches = false;
        if (sector.color === SectorType.YELLOW && buff.type === 'GAIN_ON_YELLOW_SIGNAL') buffTypeMatches = true;
        if (sector.color === SectorType.RED && buff.type === 'GAIN_ON_RED_SIGNAL') buffTypeMatches = true;
        if (sector.color === SectorType.BLUE && buff.type === 'GAIN_ON_BLUE_SIGNAL') buffTypeMatches = true;
        
        if (buffTypeMatches) {
            if (buff.id && buff.source && (player.missions.find(m => m.name === buff.source)?.completedRequirementIds.includes(buff.id) || player.missions.find(m => m.name === buff.source)?.fulfillableRequirementIds?.includes(buff.id))) return;
            if (buff.source && processedSources.has(buff.source)) return;
            if (buff.source) processedSources.add(buff.source);
            CardSystem.markMissionRequirementFulfillable(player, buff);
        }
    });
    return updatedGame;
  }

  // Sauvegarde automatique à chaque modification du jeu
  useEffect(() => {
    if (game) {
      try {
        // Préparer l'objet à sauvegarder avec l'historique à jour
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { history, ...cleanGame } = game;

        const gameToSave = { 
            ...cleanGame,
            gameLog: historyLog.map((entry, index) => {
                // Sauvegarder le previousState uniquement pour la dernière entrée
                // pour permettre l'undo immédiat après rechargement
                const isLast = index === historyLog.length - 1;
                let cleanPreviousState = undefined;
                if (isLast && entry.previousState) {
                    // Exclure gameLog et history du previousState pour éviter la récursion/taille
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
        // Sauvegarder l'état complet
        localStorage.setItem('seti_autosave', JSON.stringify(gameToSave));
      } catch (e) {
        console.warn("Erreur lors de la sauvegarde automatique (QuotaExceededError probable) :", e);
      }
    }
  }, [game, historyLog]);


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

  // Helper pour gérer les nouvelles interactions (avec choix si multiple, sauf si forcé)
  const handleNewInteractions = (newInteractions: InteractionState[], sequenceId?: string, summary?: string, forceStacking: boolean = false): boolean => {
    if (newInteractions.length === 0) return false;

    // Séparer les résolutions de secteur des autres interactions
    const resolutions = newInteractions.filter(i => i.type === 'RESOLVING_SECTOR');
    const others = newInteractions.filter(i => i.type !== 'RESOLVING_SECTOR');

    if (others.length > 0) {
      if (others.length > 1 && !forceStacking) {
        const choices = others.map((interaction, index) => ({
          id: `choice-${Date.now()}-${index}`,
          label: getInteractionLabel(interaction),
          state: { ...interaction, sequenceId: interaction.sequenceId || sequenceId },
          done: false
        }));

        setInteractionState({
          type: 'CHOOSING_BONUS_ACTION',
          bonusesSummary: summary || "Plusieurs actions disponibles. Choisissez l'ordre de résolution :",
          choices,
          sequenceId: sequenceId || others[0].sequenceId
        });

        // Ajouter les résolutions à la fin de la file d'attente
        if (resolutions.length > 0) {
             setPendingInteractions(prev => [...prev, ...resolutions.map(i => ({ ...i, sequenceId: i.sequenceId || sequenceId }))]);
        }
      } else {
        const [first, ...rest] = others;
        setInteractionState({ ...first, sequenceId: first.sequenceId || sequenceId });
        
        // Placer les autres interactions au début, et les résolutions à la toute fin
        setPendingInteractions(prev => [
            ...rest.map(i => ({ ...i, sequenceId: i.sequenceId || sequenceId })), 
            ...prev,
            ...resolutions.map(i => ({ ...i, sequenceId: i.sequenceId || sequenceId }))
        ]);
      }
    } else {
      // S'il n'y a que des résolutions
      const [first, ...rest] = resolutions;
      setInteractionState({ ...first, sequenceId: first.sequenceId || sequenceId });
      
      if (rest.length > 0) {
          setPendingInteractions(prev => [...rest.map(i => ({ ...i, sequenceId: i.sequenceId || sequenceId })), ...prev]);
      }
    }
    return true;
  };

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

  // Effet pour traiter les interactions automatiques (effets de carte, résolution de secteur)
  useEffect(() => {
    if (game && (interactionState.type === 'TRIGGER_CARD_EFFECT' || interactionState.type === 'RESOLVING_SECTOR' || interactionState.type === 'DRAW_AND_SCAN' || interactionState.type === 'CLAIMING_MISSION_REQUIREMENT')) {
      const { sequenceId } = interactionState;
      const currentPlayer = game.players[game.currentPlayerIndex];
      let updatedGame = structuredClone(game);
      let player = updatedGame.players[updatedGame.currentPlayerIndex];
      let logMessage = "";

      // Carte 119 - PIXL
      if (interactionState.type === 'TRIGGER_CARD_EFFECT') {
        const { effectType, value } = interactionState;
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
        setInteractionState({ type: 'IDLE' });
      }
      
      // Résolution de secteur
      else if (interactionState.type === 'RESOLVING_SECTOR') {
        const { sectorId } = interactionState;
        const coverageResult = ScanSystem.coverSector(updatedGame, currentPlayer.id, sectorId);
        updatedGame = coverageResult.updatedGame;
        
        const coverageLogs = [...coverageResult.logs];
        let newInteractions: InteractionState[] = [];

        if (coverageResult.bonuses) {
            const bonusRes = ResourceSystem.processBonuses(coverageResult.bonuses, updatedGame, currentPlayer.id, 'scan', sequenceId || '');
            updatedGame = bonusRes.updatedGame;
            
            // Fusionner "couvre le secteur" avec le premier gain (ex: "couvre le secteur et obtient 1 trace de vie")
            if (coverageLogs.length > 0 && coverageLogs[0] === 'couvre le secteur' && bonusRes.logs.length > 0) {
                const firstBonusLog = bonusRes.logs[0];
                if (firstBonusLog.startsWith('obtient') || firstBonusLog.startsWith('gagne')) {
                     coverageLogs[0] = `couvre le secteur et ${firstBonusLog}`;
                     bonusRes.logs.shift();
                }
            }
            
            coverageLogs.push(...bonusRes.logs);
            
            bonusRes.historyEntries.forEach(e => addToHistory(e.message, e.playerId, updatedGame, undefined, sequenceId));
            if (bonusRes.newPendingInteractions.length > 0) {
                newInteractions = bonusRes.newPendingInteractions.map(i => ({ ...i, sequenceId }));
            }
        }

        setGame(updatedGame);
        if (gameEngineRef.current) gameEngineRef.current.setState(updatedGame);
        
        if (coverageLogs.length > 0) {
            addToHistory(coverageLogs.join(', '), coverageResult.winnerId || currentPlayer.id, game, undefined, sequenceId);
        }

        // Traitement des interactions pour les autres joueurs (ex: gagnant de la majorité)
        if (coverageResult.newPendingInteractions && coverageResult.newPendingInteractions.length > 0) {
            const otherInteractions = coverageResult.newPendingInteractions.map(item => ({
                ...item.interaction,
                playerId: item.playerId,
                sequenceId: sequenceId
            }));

            // Séparer IA et Humain
            const humanInteractions = otherInteractions.filter(i => {
                const p = updatedGame.players.find(p => p.id === i.playerId);
                return p && p.type === 'human';
            });

            const aiInteractions = otherInteractions.filter(i => {
                const p = updatedGame.players.find(p => p.id === i.playerId);
                return p && p.type === 'robot';
            });

            // Ajouter les interactions humaines à la file d'attente
            newInteractions.push(...humanInteractions);

            // Résoudre automatiquement les interactions IA simples (ex: placer trace de vie) pour ne pas bloquer
            aiInteractions.forEach(interaction => {
                if (interaction.type === 'PLACING_LIFE_TRACE' && interaction.playerId) {
                     const slotType = Math.random() < 0.5 ? 'triangle' : 'species';
                     const { updatedGame: ug, isDiscovered, historyEntries } = SpeciesSystem.placeLifeTrace(updatedGame, 0, interaction.color, interaction.playerId, sequenceId, slotType);
                     updatedGame = ug;
                     historyEntries.forEach(e => addToHistory(e.message, e.playerId, updatedGame, undefined, sequenceId));
                     if (isDiscovered) {
                         addToHistory("découvre une nouvelle espèce Alien !", interaction.playerId, undefined, undefined, sequenceId);
                     }
                }
            });
            
            // Mettre à jour le jeu après résolution IA
            setGame(updatedGame);
            if (gameEngineRef.current) gameEngineRef.current.setState(updatedGame);
        }

        const summary = coverageLogs.length > 0 ? `Secteur résolu. ${coverageLogs.join(', ')}` : "Secteur résolu.";
        if (!handleNewInteractions(newInteractions, sequenceId, summary)) {
            setInteractionState({ type: 'IDLE' });
        }
      }
      
      // Pioche et Scan (Astronomes Amateurs)
      else if (interactionState.type === 'DRAW_AND_SCAN') {
        if (updatedGame.decks.cards.length > 0) {
            const drawnCard = updatedGame.decks.cards.shift();
            if (drawnCard) {
                if (!updatedGame.decks.discardPile) updatedGame.decks.discardPile = [];
                updatedGame.decks.discardPile.push(drawnCard);
                
                addToHistory(`révèle carte "${drawnCard.name}" (${drawnCard.scanSector}) de la pioche`, currentPlayer.id, game, undefined, sequenceId);
                
                const scanInteraction: InteractionState = { 
                    type: 'SELECTING_SCAN_SECTOR', 
                    color: drawnCard.scanSector, 
                    cardId: drawnCard.id, 
                    message: `Marquez un signal dans un secteur ${drawnCard.scanSector} (Carte "${drawnCard.name}")`, 
                    sequenceId 
                };
                
                setGame(updatedGame);
                if (gameEngineRef.current) gameEngineRef.current.setState(updatedGame);
                
                handleNewInteractions([scanInteraction], sequenceId, undefined, true);
            } else { setInteractionState({ type: 'IDLE' }); }
        } else { setInteractionState({ type: 'IDLE' }); }
      }

      // Validation de mission
      else if (interactionState.type === 'CLAIMING_MISSION_REQUIREMENT') {
        const { missionId, requirementId } = interactionState;
        const mission = player.missions.find(m => m.id === missionId);
        
        if (mission && !mission.completedRequirementIds.includes(requirementId)) {
            const requirement = mission.requirements.find(r => r.id === requirementId);
            let bonuses: Bonus = {};
            
            // Vérifier si on doit sauter la vérification (cas GAIN_ON_... déjà validé par le système)
            const skipCheck = mission.fulfillableRequirementIds?.includes(requirementId);

            if (requirement && (requirement.type.startsWith('GAIN_IF_') || requirement.type.startsWith('GAIN_ON_'))) {
                 const bonus = CardSystem.evaluateMission(updatedGame, player.id, requirement.value, skipCheck);
                 if (bonus) {
                     ResourceSystem.accumulateBonus(bonus, bonuses);
                 } else {
                     setToast({ message: "Conditions non remplies.", visible: true });
                     setInteractionState({ type: 'IDLE' });
                     return;
                 }
            }

            mission.completedRequirementIds.push(requirementId);
            const isCompleted = mission.completedRequirementIds.length >= mission.requirements.length;
            if (isCompleted) {
                mission.completed = true;
            }
            
            const seqId = sequenceId || `mission-claim-${Date.now()}`;
            const res = ResourceSystem.processBonuses(bonuses, updatedGame, player.id, 'mission-claim', seqId);
            
            setGame(res.updatedGame);
            if (gameEngineRef.current) gameEngineRef.current.setState(res.updatedGame);
            
            const actionText = isCompleted ? "accomplit" : "valide un objectif de";
            addToHistory(`${actionText} la mission "${mission.name}"${res.logs.length > 0 ? ' et ' + res.logs.join(', ') : ''}`, player.id, game, { type: 'IDLE' }, seqId);
            res.historyEntries.forEach(e => addToHistory(e.message, e.playerId, updatedGame, undefined, seqId));

            if (!handleNewInteractions(res.newPendingInteractions.map(i => ({ ...i, sequenceId: seqId })), seqId)) {
                setInteractionState({ type: 'IDLE' });
            }
        } else {
            setInteractionState({ type: 'IDLE' });
        }
      }
    }
  }, [interactionState, game, addToHistory]);

  // Helper pour exécuter l'action Passer via PassAction
  const performPass = useCallback((cardsToKeep: string[], selectedCardId?: string) => {
    if (!gameEngineRef.current || !gameRef.current) return;

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
        action.historyEntries.forEach(e => addToHistory(e.message, e.playerId, currentGame, undefined, e.sequenceId));
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
    
    // Bloquer l'IA si une interaction est en cours (ex: joueur humain doit placer une trace de vie)
    if (interactionState.type !== 'IDLE') return;

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

        // Tentative d'actions gratuites (avant ou après l'action principale)
        if (performAIFreeActions(game, currentPlayer)) return;

        // Si le robot a déjà joué son action principale et n'a plus d'actions gratuites à faire
        if (currentPlayer.hasPerformedMainAction) {
            console.log(`[BoardUI] Robot ${currentPlayer.name} has already performed main action. Passing turn.`);
            handleNextPlayer();
            return;
        }

        // Décision de l'IA (Niveau FACILE)
        console.log(`[BoardUI] Requesting AI decision for ${currentPlayer.name}...`);
        const decision = AIBehavior.decideAction(game, currentPlayer, 'EASY');
        console.log(`[BoardUI] AI decision:`, decision);

        // Helper pour traiter la file d'attente des interactions pour l'IA
        const processAIInteractions = (initialGame: Game, initialQueue: InteractionState[], sequenceId: string) => {
            let aiGame = initialGame;
            const queue = [...initialQueue];
            
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
                                initialLogs.push(`utilise carte "${discardedCard.name}" (${discardedCard.scanSector}) de la rangée`);
                            }
                        }

                        const res = ScanSystem.performSignalAndCover(aiGame, currentPlayer.id, chosen.id, initialLogs, false, sequenceId);
                        aiGame = res.updatedGame;
                        res.historyEntries.forEach(e => addToHistory(e.message, e.playerId, stateBeforeStep, undefined, sequenceId));
                        if (res.newPendingInteractions) {
                            queue.unshift(...res.newPendingInteractions);
                        }
                    }
                } else if (interaction.type === 'DRAW_AND_SCAN') {
                    if (aiGame.decks.cards.length > 0) {
                        const drawnCard = aiGame.decks.cards.shift();
                        if (drawnCard) {
                            if (!aiGame.decks.discardPile) aiGame.decks.discardPile = [];
                            aiGame.decks.discardPile.push(drawnCard);
                            addToHistory(`révèle carte "${drawnCard.name}" (${drawnCard.scanSector}) de la pioche`, currentPlayer.id, aiGame, undefined, sequenceId);
                            
                            queue.unshift({ 
                                type: 'SELECTING_SCAN_SECTOR', 
                                color: drawnCard.scanSector, 
                                cardId: drawnCard.id, 
                                message: `Marquez un signal dans un secteur ${drawnCard.scanSector} (Carte "${drawnCard.name}")`, 
                                sequenceId 
                            });
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
                } else if (interaction.type === 'RESOLVING_SECTOR') {
                    const { sectorId } = interaction;
                    const coverageResult = ScanSystem.coverSector(aiGame, currentPlayer.id, sectorId);
                    aiGame = coverageResult.updatedGame;
                    
                    const coverageLogs = [...coverageResult.logs];

                    if (coverageResult.bonuses) {
                        const bonusRes = ResourceSystem.processBonuses(coverageResult.bonuses, aiGame, currentPlayer.id, 'scan', sequenceId || '');
                        aiGame = bonusRes.updatedGame;
                        coverageLogs.push(...bonusRes.logs);
                        
                        bonusRes.historyEntries.forEach(e => addToHistory(e.message, e.playerId, aiGame, undefined, sequenceId));
                        if (bonusRes.newPendingInteractions.length > 0) {
                            queue.unshift(...bonusRes.newPendingInteractions.map(i => ({ ...i, sequenceId })));
                        }
                    }
                    
                    if (coverageLogs.length > 0) {
                        addToHistory(coverageLogs.join(', '), coverageResult.winnerId || currentPlayer.id, aiGame, undefined, sequenceId);
                    }
                } else if (interaction.type === 'PLACING_LIFE_TRACE') {
                     const slotType = Math.random() < 0.5 ? 'triangle' : 'species';
                     const { updatedGame, isDiscovered, historyEntries, newPendingInteractions } = SpeciesSystem.placeLifeTrace(aiGame, 0, interaction.color, currentPlayer.id, sequenceId, slotType);
                     
                     historyEntries.forEach((e, index) => addToHistory(e.message, e.playerId, index === 0 ? aiGame : undefined, undefined, sequenceId));

                     if (isDiscovered) {
                         addToHistory("découvre une nouvelle espèce Alien !", currentPlayer.id, undefined, undefined, sequenceId);
                     }

                     aiGame = updatedGame;
                     
                     
                     if (newPendingInteractions.length > 0) {
                        queue.unshift(...newPendingInteractions.map(i => ({ ...i, sequenceId })));
                     }
                } else if (interaction.type === 'RESERVING_CARD') {
                    const player = aiGame.players.find(p => p.id === currentPlayer.id);
                    if (player && player.cards.length > 0) {
                        const count = Math.min(interaction.count, player.cards.length);
                        const shuffled = [...player.cards].sort(() => 0.5 - Math.random());
                        const cardsToReserve = shuffled.slice(0, count);
                        
                        cardsToReserve.forEach(card => {
                            aiGame = CardSystem.reserveCard(aiGame, player.id, card.id);
                            addToHistory(`réserve carte "${card.name}"`, player.id, aiGame, undefined, sequenceId);
                        });
                    }
                } else if (interaction.type === 'ACQUIRING_CARD') {
                    for (let i = 0; i < interaction.count; i++) {
                        const row = aiGame.decks.cardRow;
                        let cardId: string | undefined = undefined;
                        if (row.length > 0) {
                            cardId = row[Math.floor(Math.random() * row.length)].id;
                        }
                        
                        const res = CardSystem.buyCard(aiGame, currentPlayer.id, cardId, interaction.isFree);
                        if (!res.error) {
                            aiGame = res.updatedGame;
                            const cardName = cardId ? row.find(c => c.id === cardId)?.name : "Pioche";
                            addToHistory(`acquiert carte ${cardId ? `"${cardName}"` : "de la pioche"}`, currentPlayer.id, aiGame, undefined, sequenceId);
                            
                            if (interaction.triggerFreeAction) {
                                const p = aiGame.players.find(p => p.id === currentPlayer.id);
                                if (p && p.cards.length > 0) {
                                    const card = p.cards[p.cards.length - 1];
                                    if (card.freeAction === FreeActionType.MEDIA) {
                                        p.mediaCoverage = Math.min(p.mediaCoverage + 1, GAME_CONSTANTS.MAX_MEDIA_COVERAGE);
                                    } else if (card.freeAction === FreeActionType.DATA) {
                                        p.data = Math.min(p.data + 1, GAME_CONSTANTS.MAX_DATA);
                                    } else if (card.freeAction === FreeActionType.MOVEMENT) {
                                        queue.unshift({ type: 'MOVING_PROBE', count: 1, sequenceId });
                                    }
                                }
                            }
                        }
                    }
                } else if (interaction.type === 'MOVING_PROBE') {
                    const player = aiGame.players.find(p => p.id === currentPlayer.id);
                    if (player) {
                        const probes = player.probes.filter(p => p.state === ProbeState.IN_SOLAR_SYSTEM && p.solarPosition);
                        if (probes.length > 0) {
                            const probe = probes[Math.floor(Math.random() * probes.length)];
                            const rotationState = createRotationState(
                                aiGame.board.solarSystem.rotationAngleLevel1 || 0,
                                aiGame.board.solarSystem.rotationAngleLevel2 || 0,
                                aiGame.board.solarSystem.rotationAngleLevel3 || 0
                            );
                            const absPos = getAbsoluteSectorForProbe(probe.solarPosition!, rotationState);
                            
                            const reachable = calculateReachableCellsWithEnergy(
                                probe.solarPosition!.disk,
                                absPos,
                                1, player.energy, rotationState, false
                            );
                            
                            const destinations = Array.from(reachable.keys());
                            const currentKey = `${probe.solarPosition!.disk}${absPos}`;
                            const validDestinations = destinations.filter(k => k !== currentKey);
                            
                            if (validDestinations.length > 0) {
                                const destKey = validDestinations[Math.floor(Math.random() * validDestinations.length)];
                                const disk = destKey[0] as DiskName;
                                const sector = parseInt(destKey.substring(1)) as SectorNumber;
                                
                                const stepCost = ProbeSystem.getMovementCost(aiGame, player.id, probe.id);
                                const energyCost = Math.max(0, stepCost - 1);

                                const moveRes = ProbeSystem.moveProbe(aiGame, player.id, probe.id, energyCost, disk, sector);
                                aiGame = moveRes.updatedGame;
                                addToHistory(moveRes.message, player.id, aiGame, undefined, sequenceId);
                            }
                        }
                    }
                    if (interaction.count > 1) {
                        queue.unshift({ ...interaction, count: interaction.count - 1 });
                    }
                } else if (interaction.type === 'ACQUIRING_TECH') {
                    const availableTechs = TechnologySystem.getAvailableTechs(aiGame);
                    const player = aiGame.players.find(p => p.id === currentPlayer.id);
                    let validTechs = availableTechs;
                    
                    if (player) {
                        validTechs = validTechs.filter(tech => {
                            const baseId = tech.id.substring(0, tech.id.lastIndexOf('-'));
                            return !player.technologies.some(t => t.id.startsWith(baseId));
                        });
                    }

                    if (interaction.category) {
                        validTechs = validTechs.filter(t => t.type === interaction.category);
                    }
                    
                    if (validTechs.length > 0) {
                        const tech = validTechs[Math.floor(Math.random() * validTechs.length)];
                        let targetCol = undefined;
                        if (tech.type === TechnologyCategory.COMPUTING) {
                            targetCol = [1, 3, 5, 6][Math.floor(Math.random() * 4)];
                        }
                        
                        const res = TechnologySystem.acquireTechnology(aiGame, currentPlayer.id, tech, targetCol, interaction.noTileBonus);
                        aiGame = res.updatedGame;
                        addToHistory(`acquiert technologie "${tech.name}"`, currentPlayer.id, aiGame, undefined, sequenceId);
                        if (res.historyEntries) {
                             res.historyEntries.forEach(e => addToHistory(e.message, e.playerId, aiGame, undefined, sequenceId));
                        }
                        if (res.newPendingInteractions && res.newPendingInteractions.length > 0) {
                            queue.unshift(...res.newPendingInteractions.map(i => ({ ...i, sequenceId })));
                        }
                    }
                } else if (interaction.type === 'SELECTING_COMPUTER_SLOT') {
                    const tech = interaction.tech;
                    const targetCol = [1, 3, 5, 6][Math.floor(Math.random() * 4)];
                    const player = aiGame.players.find(p => p.id === currentPlayer.id);
                    if (player) {
                        ComputerSystem.assignTechnology(player, tech, targetCol);
                        addToHistory(`assigne technologie "${tech.name}" au slot ${targetCol}`, currentPlayer.id, aiGame, undefined, sequenceId);
                    }
                } else if (interaction.type === 'CHOOSING_OBS2_ACTION') {
                    const player = aiGame.players.find(p => p.id === currentPlayer.id);
                    if (player && player.mediaCoverage > 0) {
                        player.mediaCoverage -= 1;
                        const rotationState = createRotationState(aiGame.board.solarSystem.rotationAngleLevel1 || 0, aiGame.board.solarSystem.rotationAngleLevel2 || 0, aiGame.board.solarSystem.rotationAngleLevel3 || 0);
                        const mercuryPos = getObjectPosition('mercury', rotationState.level1Angle, rotationState.level2Angle, rotationState.level3Angle);
                        if (mercuryPos) {
                            const mercurySector = aiGame.board.sectors[mercuryPos.absoluteSector - 1];
                            const res = ScanSystem.performSignalAndCover(aiGame, player.id, mercurySector.id, [`paye 1 Média pour utiliser Observation II`], false, sequenceId);
                            aiGame = res.updatedGame;
                            res.historyEntries.forEach(e => addToHistory(e.message, e.playerId, aiGame, undefined, sequenceId));
                            if (res.newPendingInteractions) queue.unshift(...res.newPendingInteractions);
                        }
                    }
                } else if (interaction.type === 'CHOOSING_OBS3_ACTION') {
                    const player = aiGame.players.find(p => p.id === currentPlayer.id);
                    if (player && player.cards.length > 0) {
                        const card = player.cards[0];
                        aiGame = CardSystem.discardCard(aiGame, player.id, card.id);
                        queue.unshift({ type: 'SELECTING_SCAN_SECTOR', color: card.scanSector, sequenceId: sequenceId, cardId: card.id });
                        addToHistory(`utilise carte "${card.name}" pour Observation III`, player.id, aiGame, undefined, sequenceId);
                    }
                } else if (interaction.type === 'CHOOSING_OBS4_ACTION') {
                    const choice = Math.random() > 0.5 ? 'PROBE' : 'MOVE';
                    const player = aiGame.players.find(p => p.id === currentPlayer.id);
                    if (player) {
                        if (choice === 'PROBE' && player.energy >= 1) {
                            player.energy -= 1;
                            const launchRes = ProbeSystem.launchProbe(aiGame, player.id, true, false);
                            if (launchRes.probeId) {
                                aiGame = launchRes.updatedGame;
                                addToHistory(`lance 1 sonde (Observation IV)`, player.id, aiGame, undefined, sequenceId);
                            }
                        } else {
                            queue.unshift({ type: 'MOVING_PROBE', count: 1, sequenceId });
                            addToHistory(`choisit 1 déplacement (Observation IV)`, player.id, aiGame, undefined, sequenceId);
                        }
                    }
                }
            }
            return aiGame;
        };

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

                aiGame = processAIInteractions(aiGame, action.newPendingInteractions || [], sequenceId);

                setGame(aiGame);
                if (gameEngineRef.current) gameEngineRef.current.setState(aiGame);
              }
              break;
            }
            case ActionType.ANALYZE_DATA: {
              const action = new AnalyzeDataAction(currentPlayer.id);
              const result = gameEngineRef.current!.executeAction(action);
              if (result.success && result.updatedState) {
                let aiGame = result.updatedState;
                const sequenceId = `ai-analyze-${Date.now()}`;

                addToHistory(`paye ${ResourceSystem.formatResource(1, 'ENERGY')} pour <strong>Analyser les données</strong>`, currentPlayer.id, game, undefined, sequenceId);
                const slotType = Math.random() < 0.5 ? 'triangle' : 'species';
                const res = SpeciesSystem.placeLifeTrace(aiGame, 0, LifeTraceType.BLUE, currentPlayer.id, sequenceId, slotType);
                res.historyEntries.forEach((e, index) => addToHistory(e.message, e.playerId, index === 0 ? aiGame : undefined, undefined, sequenceId));

                if (res.isDiscovered) {
                    addToHistory("découvre une nouvelle espèce Alien !", currentPlayer.id, undefined, undefined, sequenceId);
                }

                aiGame = res.updatedGame;

                if (res.newPendingInteractions.length > 0) {
                     aiGame = processAIInteractions(aiGame, res.newPendingInteractions, sequenceId);
                }

                setGame(aiGame);
                if (gameEngineRef.current) gameEngineRef.current.setState(aiGame);
              }
              break;
            }
            case ActionType.RESEARCH_TECH: {
              const action = new ResearchTechAction(currentPlayer.id);
              const result = gameEngineRef.current!.executeAction(action);
              if (result.success && result.updatedState) {
                // Finaliser l'acquisition
                const res = TechnologySystem.acquireTechnology(result.updatedState, currentPlayer.id, decision.data.tech);
                let aiGame = res.updatedGame;
                
                if (action.historyEntries) {
                  action.historyEntries.forEach(e => addToHistory(e.message, e.playerId, aiGame, undefined, e.sequenceId));
                }
                if (res.historyEntries) {
                  res.historyEntries.forEach(e => addToHistory(e.message, e.playerId, aiGame, undefined, e.sequenceId));
                }
                if (res.newPendingInteractions && res.newPendingInteractions.length > 0) {
                     const sequenceId = `ai-tech-${Date.now()}`;
                     aiGame = processAIInteractions(aiGame, res.newPendingInteractions, sequenceId);
                }
                setGame(aiGame);
                if (gameEngineRef.current) gameEngineRef.current.setState(aiGame);
              }
              break;
            }
            case ActionType.PLAY_CARD: {
              const card = currentPlayer.cards.find(c => c.id === decision.data.cardId);
              if (card) {
                const action = new PlayCardAction(currentPlayer.id, card.id);
                const result = gameEngineRef.current!.executeAction(action);
                if (result.success && result.updatedState) {
                  let aiGame = result.updatedState;
                  const sequenceId = `ai-play-${Date.now()}`;

                  if (action.historyEntries) {
                    action.historyEntries.forEach(e => addToHistory(e.message, e.playerId, game, undefined, sequenceId));
                  }

                  aiGame = processAIInteractions(aiGame, action.newPendingInteractions || [], sequenceId);

                  setGame(aiGame);
                  if (gameEngineRef.current) gameEngineRef.current.setState(aiGame);
                }
              }
              break;
            }
            case ActionType.ORBIT: {
              const result = ProbeSystem.orbitProbe(game, currentPlayer.id, decision.data.probeId, decision.data.planetId);
              let aiGame = result.updatedGame;
              const sequenceId = `ai-orbit-${Date.now()}`;

              const bonusRes = ResourceSystem.processBonuses(result.bonuses, aiGame, currentPlayer.id, 'orbit', sequenceId);
              aiGame = bonusRes.updatedGame;

              const pIndex = aiGame.players.findIndex(p => p.id === currentPlayer.id);
              if (pIndex !== -1) aiGame.players[pIndex].hasPerformedMainAction = true;

              let message = `met une sonde en orbite`;
              if (bonusRes.passiveGains && bonusRes.passiveGains.length > 0) {
                  message += ` et gagne ${bonusRes.passiveGains.join(', ')}`;
              }
              if (result.completedMissions && result.completedMissions.length > 0) {
                  message += ` et accomplit la mission "${result.completedMissions.join('", "')}"`;
              }

              addToHistory(message, currentPlayer.id, game, undefined, sequenceId);
              bonusRes.historyEntries.forEach(e => addToHistory(e.message, e.playerId, aiGame, undefined, sequenceId));

              if (bonusRes.newPendingInteractions.length > 0) {
                   aiGame = processAIInteractions(aiGame, bonusRes.newPendingInteractions, sequenceId);
              }

              setGame(aiGame);
              if (gameEngineRef.current) gameEngineRef.current.setState(aiGame);
              break;
            }
            case ActionType.LAND: {
              const result = ProbeSystem.landProbe(game, currentPlayer.id, decision.data.probeId, decision.data.planetId, false);
              let aiGame = result.updatedGame;
              const sequenceId = `ai-land-${Date.now()}`;

              const bonusRes = ResourceSystem.processBonuses(result.bonuses, aiGame, currentPlayer.id, 'land', sequenceId);
              aiGame = bonusRes.updatedGame;

              const pIndex = aiGame.players.findIndex(p => p.id === currentPlayer.id);
              if (pIndex !== -1) aiGame.players[pIndex].hasPerformedMainAction = true;

              let message = `fait atterrir une sonde`;
              if (bonusRes.passiveGains && bonusRes.passiveGains.length > 0) {
                  message += ` et gagne ${bonusRes.passiveGains.join(', ')}`;
              }
              if (result.completedMissions && result.completedMissions.length > 0) {
                  message += ` et accomplit la mission "${result.completedMissions.join('", "')}"`;
              }

              addToHistory(message, currentPlayer.id, game, undefined, sequenceId);
              bonusRes.historyEntries.forEach(e => addToHistory(e.message, e.playerId, aiGame, undefined, sequenceId));

              if (bonusRes.newPendingInteractions.length > 0) {
                   aiGame = processAIInteractions(aiGame, bonusRes.newPendingInteractions, sequenceId);
              }

              setGame(aiGame);
              if (gameEngineRef.current) gameEngineRef.current.setState(aiGame);
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

  // Helper pour les actions gratuites de l'IA
  const performAIFreeActions = (currentGame: Game, player: Player): boolean => {
    // 1. Complete Missions
    if (player.missions && Math.random() < 0.4) {
        for (const mission of player.missions) {
            if (mission.completed) continue;
            for (const req of mission.requirements) {
                if (!req.id) continue;
                if ((mission.completedRequirementIds || []).includes(req.id)) continue;
                if (req.type.startsWith('GAIN_IF_')) {
                    const bonus = CardSystem.evaluateMission(currentGame, player.id, req.value);
                    if (bonus) {
                        const updatedGame = structuredClone(currentGame);
                        const p = updatedGame.players.find((p: Player) => p.id === player.id);
                        if (!p) {
                            // If player not found, exit early
                            break;
                        }
                        const m = p.missions.find((m: Mission) => m.id === mission.id);
                        if (!m) {
                            // If mission not found, exit early
                            break;
                        }
                        m.completedRequirementIds.push(req.id);
                        if (m.completedRequirementIds.length >= m.requirements.length) {
                            m.completed = true;
                        }
                        const sequenceId = `ai-mission-${Date.now()}`;
                        const res = ResourceSystem.processBonuses(bonus, updatedGame, player.id, 'mission-claim', sequenceId);
                        
                        setGame(res.updatedGame);
                        if (gameEngineRef.current) gameEngineRef.current.setState(res.updatedGame);
                        
                        const actionText = m.completed ? "accomplit" : "valide un objectif de";
                        addToHistory(`${actionText} la mission "${m.name}" ${res.logs.length > 0 ? ' et ' + res.logs.join(', ') : ''}`, player.id, currentGame, undefined, sequenceId);
                        res.historyEntries.forEach(e => addToHistory(e.message, e.playerId, updatedGame, undefined, sequenceId));

                        if (res.newPendingInteractions.length > 0) {
                          const interactionsWithSeqId = res.newPendingInteractions.map(i => ({ ...i, sequenceId }));
                          handleNewInteractions(interactionsWithSeqId, sequenceId);
                        }
                        return true;
                    }
                }
            }
        }
    }

    // 2. Transfer Data
    if (player.data > 0 && Math.random() < 0.4) {
        for (const slotId in player.dataComputer.slots) {
            if (ComputerSystem.canFillSlot(player, slotId)) {
                const { updatedGame, gains, bonusEffects } = ComputerSystem.fillSlot(currentGame, player.id, slotId);
                const sequenceId = `ai-computer-${Date.now()}`;
                
                let aiGame = updatedGame;
                bonusEffects.forEach(effect => {
                     if (effect.type === 'card') {
                         aiGame = CardSystem.drawCards(aiGame, player.id, effect.amount);
                     } else if (effect.type === 'reservation') {
                         const row = aiGame.decks.cardRow;
                         if (row.length > 0) {
                             const card = row[Math.floor(Math.random() * row.length)];
                             aiGame = CardSystem.reserveCard(aiGame, player.id, card.id);
                         }
                     }
                });

                setGame(aiGame);
                if (gameEngineRef.current) gameEngineRef.current.setState(aiGame);
                let gainText = gains.length > 0 ? ` et gagne ${gains.join(', ')}` : '';
                addToHistory(`transfère 1 donnée vers l'ordinateur ${gainText}`, player.id, currentGame, undefined, sequenceId);
                return true;
            }
        }
    }

    // 3. Buy Card (Media >= 3)
    if (player.mediaCoverage >= 3 && Math.random() < 0.1) {
        const row = currentGame.decks.cardRow;
        if (row.length > 0) {
            const card = row[Math.floor(Math.random() * row.length)];
            const res = CardSystem.buyCard(currentGame, player.id, card.id, false);
            if (!res.error) {
                setGame(res.updatedGame);
                if (gameEngineRef.current) gameEngineRef.current.setState(res.updatedGame);
                addToHistory(`achète la carte "${card.name}"`, player.id, currentGame);
                return true;
            }
        }
    }

    // 4. Discard Card (Free Action)
    if (player.cards.length > 0 && Math.random() < 0.1) {
        const cardsWithAction = player.cards.filter((c: any) => c.freeAction);
        const card = cardsWithAction.length > 0 ? cardsWithAction[Math.floor(Math.random() * cardsWithAction.length)] : player.cards[Math.floor(Math.random() * player.cards.length)];
        
        if (card.freeAction) {
             let updatedGame = structuredClone(currentGame);
             let logMsg = "";
             if (card.freeAction === FreeActionType.MEDIA) {
                 const res = ResourceSystem.updateMedia(updatedGame, player.id, 1);
                 updatedGame = res.updatedGame;
                 logMsg = "gagne 1 Média";
             } else if (card.freeAction === FreeActionType.DATA) {
                 const res = ResourceSystem.updateData(updatedGame, player.id, 1);
                 updatedGame = res.updatedGame;
                 logMsg = "gagne 1 Donnée";
             } else if (card.freeAction === FreeActionType.MOVEMENT) {
                 const probes = player.probes.filter((p: any) => p.state === ProbeState.IN_SOLAR_SYSTEM && p.solarPosition);
                 if (probes.length > 0) {
                     const probe = probes[Math.floor(Math.random() * probes.length)];
                     const rotationState = createRotationState(
                          updatedGame.board.solarSystem.rotationAngleLevel1 || 0,
                          updatedGame.board.solarSystem.rotationAngleLevel2 || 0,
                          updatedGame.board.solarSystem.rotationAngleLevel3 || 0
                      );
                      const absPos = getAbsoluteSectorForProbe(probe.solarPosition!, rotationState);
                      const reachable = calculateReachableCellsWithEnergy(
                          probe.solarPosition!.disk,
                          absPos,
                          1, player.energy, rotationState, false
                      );
                      const destinations = Array.from(reachable.keys()).filter(k => k !== `${probe.solarPosition!.disk}${absPos}`);
                      if (destinations.length > 0) {
                          const destKey = destinations[Math.floor(Math.random() * destinations.length)];
                          const disk = destKey[0] as DiskName;
                          const sector = parseInt(destKey.substring(1)) as SectorNumber;
                          
                          const stepCost = ProbeSystem.getMovementCost(updatedGame, player.id, probe.id);
                          const energyCost = Math.max(0, stepCost - 1);

                          const moveRes = ProbeSystem.moveProbe(updatedGame, player.id, probe.id, energyCost, disk, sector);
                          updatedGame = moveRes.updatedGame;
                          logMsg = "déplace une sonde";
                      } else {
                          logMsg = "gagne 1 déplacement (inutilisé)";
                      }
                 } else {
                     logMsg = "gagne 1 déplacement (inutilisé)";
                 }
             }
             
             updatedGame = CardSystem.discardCard(updatedGame, player.id, card.id);
             setGame(updatedGame);
             if (gameEngineRef.current) gameEngineRef.current.setState(updatedGame);
             addToHistory(`défausse "${card.name}" et ${logMsg}`, player.id, currentGame);
             return true;
        }
    }

    return false;
  };

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
    const neutralMilestonesToCheck = currentState.players.length < 4 ? NEUTRAL_MILESTONES : [];
    for (const m of neutralMilestonesToCheck) {
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
            addToHistory(`a atteint le palier neutre ${m} PV ce qui place une trace de vie ${color} sur le plateau Alien`, currentPlayer.id, currentState, undefined, interactionState.sequenceId);
            
            let message = `Palier ${m} PV : Trace de vie ${color} placée`;

            if (result.code === 'DISCOVERED') {
                message += " - Espèce découverte !";
                addToHistory(`déclenche la découverte d'une nouvelle espèce Alien !`, currentPlayer.id, currentState, undefined, interactionState.sequenceId);
                if (result.logs) {
                    result.logs.forEach(log => addToHistory(log, undefined, currentState, undefined, interactionState.sequenceId));
                }
            }
            
            setAlienDiscoveryNotification({ visible: true, message });
            setTimeout(() => setAlienDiscoveryNotification(null), 4000);
        } else if (result.code === 'NO_SPACE') {
            addToHistory(`a atteint le palier neutre ${m} PV mais aucun emplacement libre sur le plateaux Alien`, currentPlayer.id, currentState, undefined, interactionState.sequenceId);
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

      if (!handleNewInteractions(newInteractions, sequenceId)) {
        setInteractionState({ type: 'IDLE' });
      }
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
        const res = CardSystem.drawCards(updatedGame, currentPlayer.id, 1);
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
  const handleSectorClick = (sectorId: string) => {
    const performInteractiveScan = () => {
      // NOTE: This function's body is simplified for brevity. 
      // It should contain the full logic for an interactive scan.
      // The key change is adding the triggerSignalMission call.
      if (!game || interactionState.type !== 'SELECTING_SCAN_SECTOR') return;
      const currentPlayer = game.players[game.currentPlayerIndex];
      const sector = ScanSystem.getSectorById(game, sectorId);
      if (!sector) return;

      // Validate color
      // Special case for Oumuamua: allowed if Oumuamua is in a sector matching the color
      let isOumuamuaValid = false;
      if (sector.id === 'oumuamua') {
          const oumuamua = (game.board.solarSystem.extraCelestialObjects || []).find(o => o.id === 'oumuamua');
          if (oumuamua) {
              const rotationState = createRotationState(
                  game.board.solarSystem.rotationAngleLevel1 || 0,
                  game.board.solarSystem.rotationAngleLevel2 || 0,
                  game.board.solarSystem.rotationAngleLevel3 || 0
              );
              const absPos = calculateAbsolutePosition(oumuamua, rotationState, game.board.solarSystem.extraCelestialObjects);
              const hostSector = game.board.sectors[absPos.absoluteSector - 1];
              
              if (interactionState.color === SectorType.ANY || interactionState.color === SectorType.PROBE || interactionState.color === SectorType.OUMUAMUA) {
                  isOumuamuaValid = true;
              } else if (hostSector.color === interactionState.color) {
                  isOumuamuaValid = true;
              } else if (interactionState.adjacents) {
                  const earthPos = getObjectPosition('earth', rotationState.level1Angle, rotationState.level2Angle, rotationState.level3Angle, game.board.solarSystem.extraCelestialObjects);
                  if (earthPos) {
                      const diff = Math.abs(earthPos.absoluteSector - absPos.absoluteSector);
                      if (diff === 1 || diff === 7 || diff === 0) isOumuamuaValid = true;
                  }
              }
          }
      } else if (interactionState.color === SectorType.OUMUAMUA && sector.id.startsWith('sector_')) {
          const oumuamua = (game.board.solarSystem.extraCelestialObjects || []).find(o => o.id === 'oumuamua');
          if (oumuamua) {
              const rotationState = createRotationState(
                  game.board.solarSystem.rotationAngleLevel1 || 0,
                  game.board.solarSystem.rotationAngleLevel2 || 0,
                  game.board.solarSystem.rotationAngleLevel3 || 0
              );
              const absPos = calculateAbsolutePosition(oumuamua, rotationState, game.board.solarSystem.extraCelestialObjects);
              if (`sector_${absPos.absoluteSector}` === sector.id) {
                  isOumuamuaValid = true;
              }
          }
      }

      if (!isOumuamuaValid && interactionState.color !== SectorType.ANY && interactionState.color !== SectorType.PROBE && sector.color !== interactionState.color) {
        let isAdjacentAllowed = false;
        if (interactionState.adjacents) {
          const solarSystem = game.board.solarSystem;
          const earthPos = getObjectPosition('earth', solarSystem.rotationAngleLevel1, solarSystem.rotationAngleLevel2, solarSystem.rotationAngleLevel3);
          if (earthPos) {
            // Extract sector number from ID "sector_N"
            const sectorNum = parseInt(sectorId.replace('sector_', ''));
            const diff = Math.abs(earthPos.absoluteSector - sectorNum);
            if (diff === 1 || diff === 7 || diff === 0) isAdjacentAllowed = true;
          }
        }

        if (!isAdjacentAllowed) {
          setToast({ message: `Couleur incorrecte. Sélectionnez un secteur ${interactionState.color}.`, visible: true });
          return;
        }
      }

      // Validate onlyProbes (Card 120, etc.)
      let usedProbeId: string | undefined;

      if (interactionState.onlyProbes) {
        const rotationState = createRotationState(
          game.board.solarSystem.rotationAngleLevel1 || 0,
          game.board.solarSystem.rotationAngleLevel2 || 0,
          game.board.solarSystem.rotationAngleLevel3 || 0
        );
        
        // Récupérer toutes les sondes du système (ou seulement celles du joueur)
        const candidateProbes = interactionState.anyProbe ? game.board.solarSystem.probes : currentPlayer.probes;

        const validProbes = candidateProbes.filter(p => {
            if (p.state !== ProbeState.IN_SOLAR_SYSTEM || !p.solarPosition) return false;
            // If scanning Oumuamua, check if probe is on Oumuamua? No, Oumuamua is a sector.
            // If scanning a normal sector, check if probe is in that sector.
            if (sector.id === 'oumuamua') {
              // Check if probe is on Oumuamua planet
              // Oumuamua planet ID is 'oumuamua'
              // Probe position must match Oumuamua position
              const oumuamua = (game.board.solarSystem.extraCelestialObjects || []).find(o => o.id === 'oumuamua');
              if (!oumuamua) return false;
              return p.solarPosition.disk === oumuamua.position.disk && 
                     p.solarPosition.sector === oumuamua.position.sector && 
                     (p.solarPosition.level || 0) === (oumuamua.level || 0);
          } else {
              const sectorNum = parseInt(sectorId.replace('sector_', ''));
              return getAbsoluteSectorForProbe(p.solarPosition, rotationState) === sectorNum;
          }
      });

        // Filtrer les sondes déjà utilisées dans cette séquence
        const availableProbes = validProbes.filter(p => !(interactionState.usedProbeIds || []).includes(p.id));

        if (availableProbes.length === 0) {
          if (validProbes.length > 0) {
             setToast({ message: "Cette sonde a déjà été sélectionnée pour cette action.", visible: true });
          } else {
             setToast({ message: interactionState.anyProbe ? "Veuillez sélectionner un secteur contenant une sonde." : "Veuillez sélectionner un secteur contenant une de vos sondes.", visible: true });
          }
          return;
        }
        
        // On utilise la première sonde disponible (arbitraire si plusieurs dans le même secteur, mais suffisant pour le tracking)
        usedProbeId = availableProbes[0].id;
      }

      let updatedGame = structuredClone(game);
      const initialLogs: string[] = [];

      if (interactionState.cardId) {
        let cardFoundAndProcessed = false;

        // Chercher et traiter dans la rangée de cartes
        const { updatedGame: gameAfterRowDiscard, discardedCard: rowCard } = CardSystem.discardFromRow(updatedGame, interactionState.cardId);
        if (rowCard) {
            updatedGame = gameAfterRowDiscard;
            initialLogs.push(`utilise carte "${rowCard.name}" (${rowCard.scanSector}) de la rangée`);
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
              initialLogs.push(`utilise carte "${removedCard.name}" (${removedCard.scanSector}) de la pioche`);
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
              initialLogs.push(`utilise carte "${removedCard.name}" (${removedCard.scanSector}) de la main`);
            }
          }
        }
      }

      const sequenceId = interactionState.sequenceId || `scan-${Date.now()}`;
      let res = ScanSystem.performSignalAndCover(updatedGame, currentPlayer.id, sector.id, initialLogs, interactionState.noData, sequenceId);
      updatedGame = res.updatedGame;
      // Log immediately for interactive scan
      res.historyEntries.forEach(entry => addToHistory(entry.message, entry.playerId, game, undefined, sequenceId));
      
      let allNewInteractions = [...res.newPendingInteractions];

      if (interactionState.markAdjacents) {
          const sectorNumber = parseInt(sectorId.replace('sector_', ''));
          const prevSectorNum = sectorNumber === 1 ? 8 : sectorNumber - 1;
          const nextSectorNum = sectorNumber === 8 ? 1 : sectorNumber + 1;
          
          // Mark prev
          const prevSector = updatedGame.board.sectors[prevSectorNum - 1];
          const resPrev = ScanSystem.performSignalAndCover(updatedGame, currentPlayer.id, prevSector.id, [], interactionState.noData, sequenceId);
          updatedGame = resPrev.updatedGame;
          resPrev.historyEntries.forEach(entry => addToHistory(entry.message, entry.playerId, game, undefined, sequenceId));
          allNewInteractions.push(...resPrev.newPendingInteractions);

          // Mark next
          const nextSector = updatedGame.board.sectors[nextSectorNum - 1];
          const resNext = ScanSystem.performSignalAndCover(updatedGame, currentPlayer.id, nextSector.id, [], interactionState.noData, sequenceId);
          updatedGame = resNext.updatedGame;
          resNext.historyEntries.forEach(entry => addToHistory(entry.message, entry.playerId, game, undefined, sequenceId));
          allNewInteractions.push(...resNext.newPendingInteractions);
      }

      // Handle keepCardIfOnly (Card 120)
      if (interactionState.keepCardIfOnly && interactionState.cardId) {
        const updatedSector = ScanSystem.getSectorById(updatedGame, sectorId)!;
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

      let currentPending = [...pendingInteractions];

      // Propager la sonde utilisée aux interactions suivantes de la même séquence
      if (usedProbeId) {
          const newUsedProbeIds = [...(interactionState.usedProbeIds || []), usedProbeId];
          currentPending = currentPending.map(i => {
              if (i.type === 'SELECTING_SCAN_SECTOR' && i.sequenceId === interactionState.sequenceId) {
                  return { ...i, usedProbeIds: newUsedProbeIds };
              }
              return i;
          });
      }

      const resolutions = allNewInteractions.filter(i => i.type === 'RESOLVING_SECTOR');
      const others = allNewInteractions.filter(i => i.type !== 'RESOLVING_SECTOR');

      if (others.length > 0) {
        const [next, ...rest] = others;
        setInteractionState(next);
        setPendingInteractions([...rest, ...currentPending, ...resolutions]);
      } else if (currentPending.length > 0) {
        const [next, ...rest] = currentPending;
        setInteractionState(next);
        setPendingInteractions([...rest, ...resolutions]);
      } else if (resolutions.length > 0) {
        const [next, ...rest] = resolutions;
        setInteractionState(next);
        setPendingInteractions([...rest]);
      } else {
        setInteractionState({ type: 'IDLE' });
      }
    };

    const performDirectScan = () => {
      if (!game) return;
      const sector = ScanSystem.getSectorById(game, sectorId);
      if (!sector) return;
      const currentPlayer = game.players[game.currentPlayerIndex];
      const action = new ScanSectorAction(currentPlayer.id, sector.id);
      
      if (gameEngineRef.current) {
        gameEngineRef.current.setState(game);
        const result = gameEngineRef.current.executeAction(action);
        if (result.success && result.updatedState) {
          let gameAfterScan = result.updatedState;
          gameAfterScan = triggerSignalMission(gameAfterScan, currentPlayer.id, sector.id);
          setGame(gameAfterScan);
          action.historyEntries.forEach(entry => addToHistory(entry.message, entry.playerId, game, undefined, entry.sequenceId));
          handleNewInteractions(action.newPendingInteractions);
        } else {
          setToast({ message: result.error || "Impossible de scanner ce secteur", visible: true });
        }
      }
    };

    if (!game) return;

    // Cas 1: Mode Scan actif ou bonus
    if (interactionState.type === 'SELECTING_SCAN_SECTOR') {
      const sector = ScanSystem.getSectorById(game, sectorId);
      if (!sector) return;
      const nextSignalIndex = sector.signals.findIndex(s => !s.marked);
      let potentialDataGain = 0;
      if (nextSignalIndex !== -1) {
        const signal = sector.signals[nextSignalIndex];
        potentialDataGain = (signal.type !== SignalType.OTHER && !interactionState.noData) ? 1 : 0;
      }
      checkDataLimitAndProceed(potentialDataGain, performInteractiveScan);
    } else if (interactionState.type === 'IDLE' && !game.players[game.currentPlayerIndex].hasPerformedMainAction) {
      // Cas 2: Clic direct depuis Idle (Raccourci Action Scan)
      const sector = ScanSystem.getSectorById(game, sectorId);
      if (!sector) return;
      const nextSignalIndex = sector.signals.findIndex(s => !s.marked);
      let potentialDataGain = 0;
      if (nextSignalIndex !== -1) {
        const signal = sector.signals[nextSignalIndex];
        potentialDataGain = (signal.type !== SignalType.OTHER) ? 1 : 0;
      }
      checkDataLimitAndProceed(potentialDataGain, performDirectScan);
    }
  };

  // Gestionnaire pour les actions
  const handleAction = (actionType: ActionType) => {
    if (!gameEngineRef.current || !game || !gameRef.current) return;

    // Atomicité : Si on est dans un mode interactif, on ne peut pas lancer d'autre action
    if (interactionState.type !== 'IDLE') return;

    // Synchroniser l'état de GameEngine avec le jeu actuel (pour préserver les angles de rotation)
    gameEngineRef.current.setState(gameRef.current);

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
        handleNewInteractions(action.newPendingInteractions);
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
        handleNewInteractions(action.newPendingInteractions);
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
        if (!gameEngineRef.current || !gameRef.current) return;
        gameEngineRef.current.setState(gameRef.current);

        const result = gameEngineRef.current.executeAction(action);
        if (result.success && result.updatedState) {
          const sequenceId = `analyze-${Date.now()}`;
          setGame(result.updatedState);
          setInteractionState({ type: 'PLACING_LIFE_TRACE', color: LifeTraceType.BLUE, sequenceId });
          addToHistory(`paye ${ResourceSystem.formatResource(1, 'ENERGY')} pour <strong>Analyser les données</strong> et gagne une trace de vie Bleu`, currentPlayer.id, previousState, { type: 'IDLE' }, sequenceId);
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

  // Gestionnaire pour le clic sur une trace de vie
  const handlePlaceLifeTrace = (boardIndex: number, color: LifeTraceType, slotType: 'triangle' | 'species', slotIndex?: number) => {
    if (!game) return;
    if (interactionState.type !== 'PLACING_LIFE_TRACE') return;
    if (interactionState.color !== color) return;

    // Utiliser le playerId de l'interaction s'il est défini (cas du bonus hors tour), sinon le joueur actif
    const targetPlayerId = interactionState.playerId || game.players[game.currentPlayerIndex].id;

    // Create sequence id
    const sequenceId = interactionState.sequenceId || `trace-${Date.now()}`;

    // Utilisation de SpeciesSystem pour placer la trace
    const { updatedGame, isDiscovered, historyEntries, newPendingInteractions } = SpeciesSystem.placeLifeTrace(game, boardIndex, color, targetPlayerId, sequenceId, slotType, slotIndex);

    historyEntries.forEach((entry, index) => addToHistory(entry.message, entry.playerId, index === 0 ? game : undefined, undefined, sequenceId));

    if (isDiscovered) {
      setAlienDiscoveryNotification({ visible: true, message: "Découverte d'une nouvelle espèce Alien !" });
      setTimeout(() => setAlienDiscoveryNotification(null), 4000);
      addToHistory("découvre une nouvelle espèce Alien !", targetPlayerId, undefined, undefined, sequenceId);
    }

    setGame(updatedGame);
    if (gameEngineRef.current) gameEngineRef.current.setState(updatedGame);

    if (!handleNewInteractions(newPendingInteractions, sequenceId)) {
      setInteractionState({ type: 'IDLE' });
    }
  };

  // Gestionnaire pour le clic sur une carte Alien
  const handleSpeciesCardClick = (speciesId: string, cardId: string) => {
    if (!game) return;
    if (interactionState.type !== 'ACQUIRING_ALIEN_CARD') return;
    if (interactionState.speciesId !== speciesId) return;

    const currentPlayer = game.players[game.currentPlayerIndex];
    const { updatedGame, drawnCard } = SpeciesSystem.acquireAlienCard(game, currentPlayer.id, speciesId, cardId);
    
    if (drawnCard) {
        setGame(updatedGame);
        if (gameEngineRef.current) gameEngineRef.current.setState(updatedGame);
        
        const source = cardId === 'deck' ? "de la pioche" : "de la rangée";
        addToHistory(`acquiert la carte Alien "${drawnCard.name}" ${source}`, currentPlayer.id, game, undefined, interactionState.sequenceId);

        if (interactionState.count > 1) {
            setInteractionState({ ...interactionState, count: interactionState.count - 1 });
        } else {
            setInteractionState({ type: 'IDLE' });
        }
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

    // Create sequence id
    const sequenceId = interactionState.sequenceId || `obs2-${Date.now()}`;

    if (accepted) {
      let updatedGame = structuredClone(game);
      const player = updatedGame.players[updatedGame.currentPlayerIndex];

      // Payer 1 Média
      const res = ResourceSystem.updateMedia(updatedGame, player.id, -1);
      updatedGame = res.updatedGame;
      
      // Scanner Mercure
      const rotationState = createRotationState(
        updatedGame.board.solarSystem.rotationAngleLevel1 || 0,
        updatedGame.board.solarSystem.rotationAngleLevel2 || 0,
        updatedGame.board.solarSystem.rotationAngleLevel3 || 0
      );
      const mercuryPos = getObjectPosition('mercury', rotationState.level1Angle, rotationState.level2Angle, rotationState.level3Angle);
      if (mercuryPos) {
        const mercurySector = updatedGame.board.sectors[mercuryPos.absoluteSector - 1];
        const res = ScanSystem.performSignalAndCover(updatedGame, player.id, mercurySector.id, [`paye 1 Média pour utiliser Observation II`], false, sequenceId);
        updatedGame = res.updatedGame;
        res.historyEntries.forEach(entry => addToHistory(entry.message, entry.playerId, game, undefined, sequenceId));
        if (res.newPendingInteractions.length > 0) {
            const interactionsWithSeqId = res.newPendingInteractions.map(i => ({ ...i, sequenceId }));
            handleNewInteractions(interactionsWithSeqId, sequenceId);
        } else {
            setInteractionState({ type: 'IDLE' });
        }
      }
      setGame(updatedGame);
      if (gameEngineRef.current) gameEngineRef.current.setState(updatedGame);
    } else {
      setInteractionState({ type: 'IDLE' });
    }

  };

  // Gestionnaire pour le choix Observation 3
  const handleObs3Choice = (accepted: boolean) => {
    if (interactionState.type !== 'CHOOSING_OBS3_ACTION') return;

    const sequenceId = interactionState.sequenceId || `obs3-${Date.now()}`;

    if (accepted) {
      setInteractionState({ type: 'DISCARDING_FOR_SIGNAL', count: 1, selectedCards: [], sequenceId });
    } else {
      // Passer à l'interaction suivante (ou IDLE)
      setInteractionState({ type: 'IDLE' });
    }
  };

  // Gestionnaire pour le choix Observation 4
  const handleObs4Choice = (choice: 'PROBE' | 'MOVE') => {
    if (!game) return;

    if (interactionState.type !== 'CHOOSING_OBS4_ACTION') return;

    const sequenceId = interactionState.sequenceId || `obs4-${Date.now()}`;
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
        setInteractionState({ type: 'MOVING_PROBE', count: remainingMoves, sequenceId });
      } else {
        setInteractionState({ type: 'IDLE' });
      }
    } else { // choice === 'MOVE'
      // Transition vers le déplacement de sonde
      setInteractionState({ type: 'MOVING_PROBE', count: remainingMoves + 1, sequenceId });
      addToHistory(`choisit un déplacement gratuit`, currentPlayer.id, game, { type: 'IDLE' }, sequenceId);
    }
  };

  // Helper générique pour les interactions avec les planètes (Orbite/Atterrissage)
  const handlePlanetInteraction = (
    action: OrbitAction | LandAction,
    planetId: string,
    actionFn: (game: Game, playerId: string, probeId: string, targetId: string) => { updatedGame: Game, bonuses?: any, completedMissions?: string[] },
    historyMessagePrefix: string,
    successMessage: string
  ): boolean => {
    if (!game) return false;
    const currentPlayer = game.players[game.currentPlayerIndex];
    action;

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
      ...INITIAL_ROTATING_LEVEL3_OBJECTS,
      ...(game.board.solarSystem.extraCelestialObjects || [])
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

      // Identifier l'espèce associée à la planète (ex: Oumuamua) pour les bonus de carte Alien
      const species = game.species.find(s => s.planet?.id === planetId);
      const speciesId = species?.id;

      const { updatedGame, newPendingInteractions, passiveGains, logs: allBonusLogs, historyEntries } = ResourceSystem.processBonuses(result.bonuses, result.updatedGame, currentPlayer.id, 'land/orbit', sequenceId, speciesId);

      // Marquer l'action principale comme effectuée manuellement
      const playerIndex = updatedGame.players.findIndex(p => p.id === currentPlayer.id);
      if (playerIndex !== -1) updatedGame.players[playerIndex].hasPerformedMainAction = true;

      setGame(updatedGame);
      if (gameEngineRef.current) gameEngineRef.current.setState(updatedGame);

      const summary = passiveGains.length > 0 ? `Vous avez gagné : ${passiveGains.join(', ')}.` : "Gains interactifs :";
      const interactionTriggered = handleNewInteractions(newPendingInteractions, sequenceId, summary);

      let message = `${historyMessagePrefix} ${planetDef.name}`;
      if (passiveGains.length > 0) {
        message += ` et gagne ${passiveGains.join(', ')}`;
      }
      
      if (result.completedMissions && result.completedMissions.length > 0) {
        message += ` et accomplit la mission "${result.completedMissions.join('", "')}"`;
      }

      addToHistory(message, currentPlayer.id, stateBeforeAction, undefined, sequenceId);

      const otherLogs = allBonusLogs.filter(log => !log.startsWith('gagne ') && !log.startsWith('pioche '));
      if (otherLogs.length > 0) {
        otherLogs.forEach(log => addToHistory(log, currentPlayer.id, updatedGame, undefined, sequenceId));
      }

      if (historyEntries.length > 0) {
        historyEntries.forEach(entry => addToHistory(entry.message, entry.playerId, updatedGame, undefined, sequenceId));
      }
      if (!interactionTriggered) {
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

      // Appliquer les gains via ResourceSystem : 3 PV, 1 Donnée, 1 Carte
      const bonuses: Bonus = { pv: 3, data: 1, card: 1 };
      const res = ResourceSystem.processBonuses(bonuses, updatedGame, currentPlayer.id, 'atmospheric_entry', interactionState.sequenceId || '');
      updatedGame = res.updatedGame;

      setGame(updatedGame);
      if (gameEngineRef.current) gameEngineRef.current.setState(updatedGame);
      setInteractionState({ type: 'IDLE' });
      addToHistory(`retire un orbiteur de ${planet.name}`, currentPlayer.id, game, undefined, interactionState.sequenceId);
      res.historyEntries.forEach(e => addToHistory(e.message, e.playerId, updatedGame, undefined, interactionState.sequenceId));
      if (res.logs.length > 0) {
          addToHistory(res.logs.join(', '), currentPlayer.id, updatedGame, undefined, interactionState.sequenceId);
      }
      return;
    }

    const probeOnPlanet = ProbeSystem.probeOnPlanetInfo(game, currentPlayer.id);

    // Trouver la sonde sur la planète pour la validation
    const probe = currentPlayer.probes.find(p => {
      if (p.state !== ProbeState.IN_SOLAR_SYSTEM || !p.solarPosition) return false;
      const planetDef = [...FIXED_OBJECTS, ...INITIAL_ROTATING_LEVEL1_OBJECTS, ...INITIAL_ROTATING_LEVEL2_OBJECTS, ...INITIAL_ROTATING_LEVEL3_OBJECTS, ...(game.board.solarSystem.extraCelestialObjects || [])].find(o => o.id === probeOnPlanet.planetId);
      if (!planetDef) return false;
      return p.solarPosition.disk === planetDef.position.disk && p.solarPosition.sector === planetDef.position.sector && (p.solarPosition.level || 0) === (planetDef.level || 0);
    });
    if (!probe) return;

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
      const planetDef = [...FIXED_OBJECTS, ...INITIAL_ROTATING_LEVEL1_OBJECTS, ...INITIAL_ROTATING_LEVEL2_OBJECTS, ...INITIAL_ROTATING_LEVEL3_OBJECTS, ...(game.board.solarSystem.extraCelestialObjects || [])].find(o => o.id === probeOnPlanet.planetId);
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
    let currentSequenceId = interactionState.sequenceId;

    // Parcourir le chemin étape par étape (en ignorant le point de départ à l'index 0)
    for (let i = 1; i < path.length; i++) {
      const cellKey = path[i];
      const disk = cellKey[0] as DiskName;
      const sector = parseInt(cellKey.substring(1)) as SectorNumber;

      // Sauvegarder l'état avant le mouvement pour l'historique (copie profonde)
      const stateBeforeMove = structuredClone(currentGame);

      // Utiliser l'action pour effectuer le mouvement
      const cost = ProbeSystem.getMovementCost(currentGame, currentPlayerId, probeId);
      const usedFree = Math.min(cost, freeMovements);
      const action = new MoveProbeAction(currentPlayerId, probeId, { disk, sector }, freeMovements);
      const result = gameEngineRef.current.executeAction(action);

      if (result.success && result.updatedState) {
        const updatedGame = result.updatedState;

        // Récupérer le message généré par ProbeSystem via l'action
        const message = action.executionMessage;

        if (message) {
          const oldPlayer = currentGame.players.find(p => p.id === currentPlayerId);

          // Détection Card 19 (Assistance Gravitationnelle)
          const targetCell = getCell(disk, sector, createRotationState(updatedGame.board.solarSystem.rotationAngleLevel1 || 0, updatedGame.board.solarSystem.rotationAngleLevel2 || 0, updatedGame.board.solarSystem.rotationAngleLevel3 || 0));
          const hasChoiceBuff = oldPlayer?.activeBuffs.some(b => b.type === 'CHOICE_MEDIA_OR_MOVE');

          if (hasChoiceBuff && targetCell?.hasPlanet && targetCell.planetId !== 'earth') {
            // Calculer les mouvements restants après ce pas (si gratuit)
            const remaining = freeMovements - usedFree;
            if (!currentSequenceId) currentSequenceId = `move-${Date.now()}`;
            setInteractionState({ type: 'CHOOSING_MEDIA_OR_MOVE', sequenceId: currentSequenceId, remainingMoves: remaining });
            interruptedForChoice = true;
            if (i < path.length - 1) {
              setToast({ message: "Déplacement interrompu. Choisissez un bonus.", visible: true });
            }
          }

          let logMessage = message;
          if (freeMovements > 0) {
             const remaining = freeMovements - usedFree;
             logMessage += ` (${remaining} mouvement${remaining > 1 ? 's' : ''} gratuit${remaining > 1 ? 's' : ''} restant${remaining > 1 ? 's' : ''})`;
          }
          addToHistory(logMessage, currentPlayerId, stateBeforeMove, undefined, currentSequenceId);
        }

        currentGame = updatedGame;
        gameRef.current = currentGame; // Mettre à jour la ref locale pour garantir la fraîcheur
        setGame(currentGame);
        if (gameEngineRef.current) gameEngineRef.current.setState(currentGame); // Mettre à jour l'état du moteur pour la prochaine étape du mouvement

        // Mettre à jour le compteur de mouvements gratuits
        freeMovements -= usedFree;

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
        setInteractionState({ type: 'MOVING_PROBE', count: freeMovements, sequenceId: currentSequenceId });
        setToast({ message: `Encore ${freeMovements} déplacement${freeMovements > 1 ? 's' : ''} gratuit${freeMovements > 1 ? 's' : ''}. Sélectionnez une sonde à déplacer.`, visible: true });
      } else {
        setInteractionState({ type: 'IDLE' });
      }
    }
  };

  // Gestionnaire pour jouer une carte (payer son coût en crédits)
  const handlePlayCardRequest = (cardId: string) => {
    if (!game || !gameRef.current || !gameEngineRef.current) return;

    const currentGame = structuredClone(game);
    const currentPlayer = currentGame.players[currentGame.currentPlayerIndex];
    const card = currentPlayer.cards.find(c => c.id === cardId);
    if (!card) return;

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

    // Vérifier si la carte donne des déplacements et si le joueur n'a pas de sonde
    if (card && card.immediateEffects) {
      const moveEffect = card.immediateEffects.find(e => e.type === 'ACTION' && e.target === 'MOVEMENT');
      if (moveEffect) {
        const hasProbeInSystem = currentPlayer.probes.some(p => p.state === ProbeState.IN_SOLAR_SYSTEM);
        const givesProbe = card.immediateEffects.some(e => e.type === 'GAIN' && e.target === 'PROBE');
        
        if (!hasProbeInSystem && !givesProbe) {
          setConfirmModalState({
            visible: true,
            cardId: cardId,
            message: "Vous n'avez aucune sonde dans le système solaire pour effectuer le déplacement. L'action sera perdue. Voulez-vous continuer ?"
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

    // Validation pour Rentrée Atmosphérique (Carte 15)
    if (card && card.passiveEffects?.some(e => e.type === 'ATMOSPHERIC_ENTRY')) {
        const hasOrbiter = currentPlayer.probes.some(p => p.state === ProbeState.IN_ORBIT);
        if (!hasOrbiter) {
             setConfirmModalState({
                visible: true,
                cardId: cardId,
                message: "Vous n'avez aucun orbiteur à retirer. L'effet de la carte sera perdu. Voulez-vous continuer ?"
             });
             return;
        }
    }

    const action = new PlayCardAction(currentPlayer.id, cardId);
    const result = gameEngineRef.current.executeAction(action);
    if (result.success && result.updatedState) {
      setGame(result.updatedState);
      if (gameEngineRef.current) gameEngineRef.current.setState(result.updatedState);
        // Add history entries from processBonuses (objects)
        if (action.historyEntries && action.historyEntries.length > 0) {
          action.historyEntries.forEach(entry => addToHistory(entry.message, entry.playerId, currentGame, undefined, entry.sequenceId));
        }
        // Add pending interactions from processBonuses (objects)
        if (action.newPendingInteractions && action.newPendingInteractions.length > 0) {
          const forceStacking = ['27', '28', '29', '30'].includes(cardId);
          handleNewInteractions(action.newPendingInteractions, undefined, undefined, forceStacking);
        }
    }
  };

  // Gestionnaire pour l'action gratuite (défausse de carte)
  const handleDiscardCardAction = (cardId: string) => {
    if (!game || !gameRef.current) return;
    if (interactionState.type !== 'IDLE') return;

    const currentPlayer = game.players[game.currentPlayerIndex];
    
    const result = CardSystem.discardCardForFreeAction(game, currentPlayer.id, cardId);

    setGame(result.updatedGame);
    if (gameEngineRef.current) gameEngineRef.current.setState(result.updatedGame);

    result.historyEntries.forEach(entry => addToHistory(entry.message, entry.playerId, game, undefined, entry.sequenceId));
    handleNewInteractions(result.newPendingInteractions);
  };

  // Gestionnaire pour l'action d'achat de carte (payer avec 3 média)
  const handleBuyCardAction = () => {
    if (interactionState.type !== 'IDLE') return;
    setInteractionState({ type: 'ACQUIRING_CARD', count: 1 });
  };

  // Gestionnaire pour les échanges directs (via les boutons rapides)
  /**
   * @param spendType - Type de ressource à dépenser (ex: 'energy', 'credits', etc.)
   * @param gainType - Type de ressource à gagner (ex: 'media', 'card', etc.)
   */
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
    
    
    
    // Cas 2: Sélection pour achat ou gain de carte (bonus)
    } else if (interactionState.type === 'ACQUIRING_CARD') {
        const currentPlayer = game.players[game.currentPlayerIndex];
        let result: { updatedGame: Game, error?: string };

        // Passer interactionState.isFree
        result = CardSystem.buyCard(game, currentPlayer.id, cardId, interactionState.isFree);
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
              freeActionLog = " et gagne 1 Média";
            } else if (card.freeAction === FreeActionType.DATA) {
              player.data = Math.min(player.data + 1, GAME_CONSTANTS.MAX_DATA);
              freeActionLog = " et gagne 1 Donnée";
            } else if (card.freeAction === FreeActionType.MOVEMENT) {
              setPendingInteractions(prev => [{ type: 'MOVING_PROBE', count: 1, autoSelectProbeId: undefined, sequenceId: interactionState.sequenceId}, ...prev]);
              freeActionLog = " et gagne 1 Déplacement";
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
          ? (cardId ? `choisit carte "${cardName}"` : `pioche carte "${cardName}"`)
          : (cardId ? `paye 3 médias pour acheter carte "${cardName}" depuis la rangée` : `paye 3 médias pour acheter carte "${cardName}" depuis la pioche`);

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
    if (!game || !gameRef.current) return;

    const currentGame = baseGame || gameRef.current;
    const currentPlayer = currentGame.players[currentGame.currentPlayerIndex];

    // Mettre à jour GameEngine
    const result = TechnologySystem.acquireTechnology(currentGame, currentPlayer.id, tech, targetComputerCol, noTileBonus);

    // Finaliser la transaction
    setGame(result.updatedGame);
    if (gameEngineRef.current) gameEngineRef.current.setState(result.updatedGame);
    setInteractionState({ type: 'IDLE' });
    addToHistory(`acquiert technologie "${tech.type} ${tech.name}"${result.gains.length > 0 ? ` et gagne ${result.gains.join(', ')}` : ''}`, currentPlayer.id, currentGame, undefined, interactionState.sequenceId);
    result.historyEntries.forEach(entry => addToHistory(entry.message, entry.playerId, currentGame, undefined, interactionState.sequenceId));

    if (result.newPendingInteractions && result.newPendingInteractions.length > 0) {
        const interactionsWithSeqId = result.newPendingInteractions.map(i => ({ ...i, sequenceId: interactionState.sequenceId }));
        handleNewInteractions(interactionsWithSeqId, interactionState.sequenceId);
    } else {
        setInteractionState({ type: 'IDLE' });
    }
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
    } else if (interactionState.type === 'IDLE') {
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

  // Gestionnaire pour le clic sur une planète (ex: Terre pour lancer une sonde)
  const handlePlanetClick = (planetId: string) => {
    if (interactionState.type === 'REMOVING_ORBITER') {
        handleOrbit(planetId);
        return;
    }

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
    } else if (type === 'anycard') {
        const seqId = sequenceId || interactionState.sequenceId;
        setInteractionState({ type: 'ACQUIRING_CARD', count: amount, isFree: true, sequenceId: seqId });
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

    addToHistory(`a atteint le palier objectif ${interactionState.milestone} PV et place un marqueur sur "${tile.name}" (Points fin de partie)`, upPlayer.id, game, interactionState);
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

  // Gestionnaire pour le clic sur une mission (validation manuelle)
  const handleMissionClick = (missionId: string, requirementId?: string) => {
    if (!game) return;
    
    const updatedGame = structuredClone(game);
    const player = updatedGame.players.find(p => p.id === game.players[game.currentPlayerIndex].id);
    if (!player) return;

    const mission = player.missions.find(m => m.id === missionId);
    if (!mission) return;

    if (requirementId) {
        setInteractionState({ type: 'CLAIMING_MISSION_REQUIREMENT', missionId, requirementId });
    } else {
        // Auto-détection des conditions remplies
        const fulfillableReqs = mission.requirements.map((req, index) => {
            if ((mission.completedRequirementIds || []).includes(req.id!)) return null;
            
            // Vérifier si la condition est marquée comme "fulfillable" (GAIN_ON_...)
            if (mission.fulfillableRequirementIds?.includes(req.id!)) {
                return { req, index, skipCheck: true };
            }
            
            // Vérifier si la condition est remplie par l'état du jeu (GAIN_IF_...)
            if (req.type.startsWith('GAIN_IF_')) {
                const bonus = CardSystem.evaluateMission(updatedGame, player.id, req.value);
                if (bonus) return { req, index, skipCheck: false };
            }
            return null;
        }).filter(r => r !== null) as { req: any, index: number, skipCheck: boolean }[];

        if (fulfillableReqs.length === 0) {
             setToast({ message: "Aucune condition remplie pour cette mission.", visible: true });
        } else if (fulfillableReqs.length === 1) {
             setInteractionState({ type: 'CLAIMING_MISSION_REQUIREMENT', missionId, requirementId: fulfillableReqs[0].req.id });
        } else {
             // Choix multiple
             const missionRequirementStrings = mission.description.split('Mission:').slice(1).filter(s => s.trim() !== '');
             setInteractionState({
                type: 'CHOOSING_BONUS_ACTION',
                bonusesSummary: "Plusieurs conditions remplies. Choisissez laquelle valider :",
                choices: fulfillableReqs.map(item => ({
                    id: item.req.id,
                    label: missionRequirementStrings[item.index]?.trim() || `Condition ${item.index + 1}`,
                    state: { type: 'CLAIMING_MISSION_REQUIREMENT', missionId, requirementId: item.req.id },
                    done: false
                }))
             });
        }
    }
  };

  // Si le jeu n'est pas initialisé, afficher uniquement les modales de démarrage
  if (!game) {
    return (
      <div className="seti-root">
        <SettingsModal 
          visible={settingsVisible}
          setVisible={setSettingsVisible}
          game={game}
          setGame={(newGame) => { setGame(newGame); if (gameEngineRef.current) gameEngineRef.current.setState(newGame); }}
          gameEngineRef={gameEngineRef}
          historyLog={historyLog}
          setHistoryLog={setHistoryLog}
          setInteractionState={setInteractionState}
          setPendingInteractions={setPendingInteractions}
          setToast={setToast}
        />
      </div>
    );
  }

  const humanPlayer = game.players.find(p => p.type === 'human');
  const currentPlayer = game.players[game.currentPlayerIndex];
  const currentPlayerIdToDisplay = viewedPlayerId || humanPlayer?.id || currentPlayer.id;

  return (
    <div className="seti-root">
      {currentPlayer.type === 'robot' && interactionState.type === 'IDLE' && (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(20, 30, 50, 0.6)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 9000,
            backdropFilter: 'blur(3px)',
            color: 'white',
            textAlign: 'center'
        }}>
            <style>
            {`
                @keyframes spin { to { transform: rotate(360deg); } }
            `}
            </style>
            <div style={{
                width: '60px',
                height: '60px',
                border: '6px solid rgba(255, 255, 255, 0.2)',
                borderTopColor: '#fff',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
            }}></div>
            <p style={{ marginTop: '20px', fontSize: '1.2em', textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
                Tour de l'IA ({currentPlayer.name})
            </p>
        </div>
      )}
      {/* Panneau de débogage pour le développement */}
      <DebugPanel
        game={game}
        setGame={(newGame) => {
          setGame(newGame);
          if (gameEngineRef.current) gameEngineRef.current.setState(newGame);
        }}
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

      {/* Bouton pour masquer/afficher la modale de fin de manche */}
      {passModalState.visible && (
        <button
            onClick={() => setIsPassModalMinimized(!isPassModalMinimized)}
            style={{
                position: 'fixed',
                top: '20px',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 10000,
                padding: '8px 16px',
                backgroundColor: isPassModalMinimized ? 'rgba(33, 150, 243, 0.9)' : 'rgba(0, 0, 0, 0.6)',
                color: 'white',
                border: '1px solid rgba(255, 255, 255, 0.5)',
                borderRadius: '20px',
                cursor: 'pointer',
                fontWeight: 'bold',
                boxShadow: '0 2px 10px rgba(0,0,0,0.5)',
                backdropFilter: 'blur(4px)',
                transition: 'all 0.2s ease'
            }}
        >
            {isPassModalMinimized ? "Revenir au choix de carte" : "Voir le plateau"}
        </button>
      )}

      {/* Modale de sélection de carte de fin de manche */}
      <PassModal
        visible={passModalState.visible && !isPassModalMinimized}
        cards={passModalState.cards}
        onConfirm={(selectedCardId) => {
          const currentPlayer = game.players[game.currentPlayerIndex];
          const cardsToKeep = passModalState.cardsToKeep || currentPlayer.cards.map(c => c.id);
          performPass(cardsToKeep, selectedCardId);
          setPassModalState({ visible: false, cards: [], selectedCardId: null });
        }}
        currentRound={game.currentRound}
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
            handlePlayCardRequest(confirmModalState.cardId);
          }
          setConfirmModalState({ visible: false, cardId: null, message: '', onConfirm: undefined });
        }}
      />

      <SettingsModal 
        visible={settingsVisible}
        setVisible={setSettingsVisible}
        game={game}
        setGame={(newGame) => { setGame(newGame); if (gameEngineRef.current) gameEngineRef.current.setState(newGame); }}
        gameEngineRef={gameEngineRef}
        historyLog={historyLog}
        setHistoryLog={setHistoryLog}
        setInteractionState={setInteractionState}
        setPendingInteractions={setPendingInteractions}
        setToast={setToast}
      />

      {/* Ecran de fin de partie */}
      {game.phase === GamePhase.FINAL_SCORING && <EndGameModal game={game} />}

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
              onPlayCard={handlePlayCardRequest}
              onGameUpdate={(newGame) => { setGame(newGame); if (gameEngineRef.current) gameEngineRef.current.setState(newGame); }}
              onComputerSlotSelect={handleComputerColumnSelect}
              onNextPlayer={handleNextPlayer}
              onHistory={(message, sequenceId) => addToHistory(message, game.players[game.currentPlayerIndex].id, game, undefined, sequenceId)}
              onComputerBonus={handleComputerBonus}
              onConfirmDiscardForSignal={handleConfirmDiscard}
              setActiveTooltip={setActiveTooltip}
              onSettingsClick={() => setSettingsVisible(true)}
              onMissionClick={handleMissionClick}
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
            onSpeciesCardClick={handleSpeciesCardClick}
            setActiveTooltip={setActiveTooltip}
            forceOpen={interactionState.type === 'ACQUIRING_ALIEN_CARD' && game.species.find(s => s.id === interactionState.speciesId)?.name === game.board.alienBoards[0].speciesId}
          />

          {/* Plateau Alien en bas à droite */}
          <AlienBoardUI
            game={game}
            boardIndex={1}
            interactionState={interactionState}
            onPlaceLifeTrace={handlePlaceLifeTrace}
            onSpeciesCardClick={handleSpeciesCardClick}
            setActiveTooltip={setActiveTooltip}
            forceOpen={interactionState.type === 'ACQUIRING_ALIEN_CARD' && game.species.find(s => s.id === interactionState.speciesId)?.name === game.board.alienBoards[1].speciesId}
          />
        </div>
      </div>
    </div>
  );
};