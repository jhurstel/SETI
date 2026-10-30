import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Game, ActionType, Card, DiskName, SectorNumber, GAME_CONSTANTS, Bonus, Technology, ProbeState, TechnologyCategory, LifeTraceType, InteractionState, GamePhase, SignalType, HistoryEntry, getInteractionLabel, LifeTraceLocation } from '../core/types';
import { ConfirmModal, AlienDiscoveryModal, MediaOrMoveModal, Observation2Modal, Observation3Modal, Observation4Modal, BonusChoiceModal, EndGameModal, CentaurienRewardModal, ExertienCardModal } from './modals/GameModals';
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
import { cloneGame } from '../core/cloneGame';
import { InteractionChoices } from '../core/InteractionChoices';
import { TurnManager } from '../core/TurnManager';
import { InteractionResolver, isAutomaticInteraction } from '../core/InteractionResolver';
import { ProbeSystem } from '../systems/ProbeSystem';
import { CardSystem } from '../systems/CardSystem';
import { ResourceSystem } from '../systems/ResourceSystem';
import { TechnologySystem } from '../systems/TechnologySystem';
import { ComputerSystem } from '../systems/ComputerSystem';
import { ScanSystem } from '../systems/ScanSystem';
import { useAITurn } from './hooks/useAITurn';
import { useAutosave } from './hooks/useAutosave';
import { DebugPanel } from './DebugPanel';
import { useDebugSetting } from './hooks/useDebugSetting';
import { PassModal } from './modals/PassModal';
import { CardPickModal } from './modals/CardPickModal';
import { findTurnUndoPoint } from '../core/TurnUndo';
import { Tooltip } from './Tooltip';
import { ObjectiveBoardUI } from './ObjectiveBoardUI';
import { HistoryBoardUI } from './HistoryBoardUI';
import { CardRowUI } from './CardRowUI';
import { AlienBoardUI } from './AlienBoardUI';
import { SettingsModal } from './modals/SettingsModal';
import { PlanetBoardUI } from './PlanetBoardUI';
import './BoardUI.css';
import { SpeciesSystem } from '../systems/SpeciesSystem';
import { uniqueId } from '../core/ids';

export const BoardUI: React.FC = () => {
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
  const [showDebug, setShowDebug] = useDebugSetting();
  const [interactionState, setInteractionState] = useState<InteractionState>({ type: 'IDLE' });
  // Action Orbite / Atterrissage / Jouer une carte choisie : planètes ou cartes jouables mises en avant
  const [actionFocus, setActionFocus] = useState<'orbit' | 'land' | 'card' | null>(null);
  const focusPlayer = game?.players[game.currentPlayerIndex];
  useEffect(() => {
    // L'action effectuée, une interaction ou un changement de joueur referme la mise en avant
    setActionFocus(null);
  }, [focusPlayer?.id, focusPlayer?.hasPerformedMainAction, interactionState.type]);
  const [pendingInteractions, setPendingInteractions] = useState<InteractionState[]>([]);
  const [viewedPlayerId, setViewedPlayerId] = useState<string | null>(null);
  const [alienDiscoveryNotification, setAlienDiscoveryNotification] = useState<{ visible: boolean; message: string } | null>(null);
  const [activeTooltip, setActiveTooltip] = useState<{ content: React.ReactNode, rect: DOMRect, pointerEvents?: 'none' | 'auto', onMouseEnter?: () => void, onMouseLeave?: () => void } | null>(null);
  const [passModalState, setPassModalState] = useState<{ visible: boolean; cards: Card[]; selectedCardId: string | null; cardsToKeep?: string[] }>({ visible: false, cards: [], selectedCardId: null });
  const [confirmModalState, setConfirmModalState] = useState<{ visible: boolean; cardId: string | null; message: string; onConfirm?: () => void }>({ visible: false, cardId: null, message: '', onConfirm: undefined });
  const [settingsVisible, setSettingsVisible] = useState(true); // Open at launch

  // Effet pour afficher un message toast si l'interaction en contient un
  useEffect(() => {
    if (interactionState.type === 'IDLE') {
      if (game && game.players[game.currentPlayerIndex].hasPerformedMainAction) {
        setToast({ message: 'Action principale effectuée. Veuillez effectuer une action gratuite ou passer au prochain joueur.', visible: true });
      } else {
        setToast({ message: "Veuillez sélectionner une action gratuite ou votre action principale.", visible: true });
      }
    } else {
      setToast({ message: getInteractionLabel(interactionState), visible: true });
    }
  }, [interactionState, game]);

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

  // Joueur qui résout l'interaction en cours : celui qu'elle désigne (gain reçu pendant le tour
  // d'un autre joueur, ex. secteur couvert par un robot), sinon le joueur actif
  const actingPlayer = (g: Game) => g.players.find(p => p.id === interactionState.playerId) ?? g.players[g.currentPlayerIndex];

  // Réservation d'une carte par le joueur humain : fenêtre centrale, comme le choix de fin de manche
  const reservingPlayer = game && interactionState.type === 'RESERVING_CARD' ? actingPlayer(game) : undefined;
  const isReservationModalActive = !!reservingPlayer && reservingPlayer.type === 'human';


  const checkDataLimitAndProceed = (
    potentialDataGain: number,
    onConfirm: () => void
  ) => {
    if (!game) return;
    const warning = ResourceSystem.lostBonusWarning(game, game.players[game.currentPlayerIndex].id, { data: potentialDataGain });
    if (warning) {
        setConfirmModalState({ visible: true, cardId: null, message: warning, onConfirm });
    } else {
        onConfirm();
    }
  };

  // Sauvegarde automatique à chaque modification du jeu
  useAutosave(game, historyLog);


  // Ref pour accéder à l'état d'interaction actuel dans addToHistory sans dépendance
  const interactionStateRef = useRef(interactionState);
  useEffect(() => { interactionStateRef.current = interactionState; }, [interactionState]);
  const pendingInteractionsRef = useRef(pendingInteractions);
  useEffect(() => { pendingInteractionsRef.current = pendingInteractions; }, [pendingInteractions]);

  // Helper pour ajouter une entrée à l'historique
  const addToHistory = useCallback((message: string, playerId?: string, previousState?: Game, customInteractionState?: InteractionState, sequenceId?: string) => {
    const entry: HistoryEntry = {
      id: uniqueId(),
      message,
      playerId: playerId ?? "",
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
          id: `choice-${uniqueId()}-${index}`,
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

  // Retour au début du dernier tour du joueur humain (annule aussi les tours des robots qui ont suivi)
  const humanPlayerId = game?.players.find(p => p.type === 'human')?.id;
  const turnUndoPoint = humanPlayerId ? findTurnUndoPoint(historyLog, humanPlayerId) : null;
  const handleUndoTurn = () => {
    if (!turnUndoPoint) return;
    setConfirmModalState({
      visible: true,
      cardId: null,
      message: "Revenir au début de votre dernier tour ? Toutes les actions jouées depuis, y compris celles des robots, seront annulées.",
      onConfirm: () => {
        setGame(turnUndoPoint.state);
        if (gameEngineRef.current) gameEngineRef.current.setState(turnUndoPoint.state);
        setHistoryLog(prev => prev.slice(0, turnUndoPoint.keepCount));
        setPendingInteractions([]);
        setInteractionState({ type: 'IDLE' });
        setPassModalState({ visible: false, cards: [], selectedCardId: null });
      }
    });
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

  // Effet pour traiter les interactions automatiques (effets de carte, résolution de secteur, missions)
  // La logique de jeu est dans InteractionResolver ; l'UI applique le résultat
  useEffect(() => {
    if (!game || !isAutomaticInteraction(interactionState)) return;

    const { sequenceId } = interactionState;
    const playerId = game.players[game.currentPlayerIndex].id;
    const result = InteractionResolver.resolve(game, playerId, interactionState);

    if (result.error) {
      setToast({ message: result.error, visible: true });
      setInteractionState({ type: 'IDLE' });
      return;
    }

    if (result.updatedGame !== game) {
      setGame(result.updatedGame);
      if (gameEngineRef.current) gameEngineRef.current.setState(result.updatedGame);
    }
    // L'état à restaurer en cas d'annulation est celui d'avant la résolution
    result.historyEntries.forEach(e => addToHistory(e.message, e.playerId, game, undefined, e.sequenceId || sequenceId));

    if (!handleNewInteractions(result.newInteractions, sequenceId, result.summary, result.forceStacking)) {
      setInteractionState({ type: 'IDLE' });
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

      // Fin de partie : le décompte final est fait par le moteur (TurnManager.endRound),
      // l'écran de fin s'affiche dès que la phase passe à FINAL_SCORING

      // Patch de sécurité : Si une nouvelle manche commence, réinitialiser hasPerformedMainAction
      if (result.updatedState.currentRound > currentGame.currentRound) {
        result.updatedState.players = result.updatedState.players.map(p => ({ ...p, hasPerformedMainAction: false }));
      }

      setGame(result.updatedState);
    } else {
      console.error("Erreur lors de l'action Passer:", result.error);
      setToast({ message: `Erreur lors de l'action Passer: ${result.error}`, visible: true });
    }
  }, [addToHistory]);

  // Tour des robots (logique dans AITurn, cadence dans useAITurn)
  useAITurn(game, interactionState, {
    applyGame: (updatedGame) => {
      setGame(updatedGame);
      if (gameEngineRef.current) gameEngineRef.current.setState(updatedGame);
    },
    addToHistory,
    onSetupReserved: (updatedGame) => handleSetupNextPlayer(updatedGame),
    onPass: (cardsToKeep) => performPass(cardsToKeep),
    onDiscovery: (message) => {
      setAlienDiscoveryNotification({ visible: true, message });
      setTimeout(() => setAlienDiscoveryNotification(null), 4000);
    },
    onTurnEnded: () => {
      setPendingInteractions([]);
      setToast({ message: "Au tour du joueur suivant. Patientez...", visible: true });
    },
    onHumanInteractions: (interactions) => handleNewInteractions(interactions, interactions[0]?.sequenceId),
  });

  // Gestionnaire pour passer au joueur suivant pendant la phase de SETUP
  const handleSetupNextPlayer = (currentGame: Game) => {
      const { updatedGame: nextGame, historyEntries } = TurnManager.advanceSetup(currentGame);
      historyEntries.forEach(e => addToHistory(e.message, e.playerId || undefined, nextGame));

      setGame(nextGame);
      if (gameEngineRef.current) gameEngineRef.current.setState(nextGame);
  };

  // Gestionnaire pour passer au joueur suivant (fin de tour simple)
  // Bouton « Prochain joueur » : le tour ne se termine pas tant qu'une interaction obligatoire est en cours ou en attente
  const handleNextPlayer = () => {
    if (TurnManager.blocksEndOfTurn(interactionState) || pendingInteractions.length > 0) {
      setToast({ message: "Terminez d'abord l'action en cours avant de finir votre tour.", visible: true });
      return;
    }
    continueEndOfTurn();
  };

  // Fin de tour (paliers, puis joueur suivant) ; aussi reprise après le choix demandé par un palier
  const continueEndOfTurn = () => {
    if (!gameEngineRef.current || !game) return;

    // Vérifier les paliers de score avant de passer au joueur suivant
    // Utiliser l'état du moteur pour avoir la version la plus à jour
    const stateBeforeMilestones = gameEngineRef.current.getState();
    const turn = TurnManager.finishTurn(stateBeforeMilestones);

    gameEngineRef.current.setState(turn.updatedGame);
    setGame(turn.updatedGame);

    // L'état à restaurer en cas d'undo est celui d'avant la vérification des paliers
    turn.milestoneEntries.forEach(entry => addToHistory(entry.message, entry.playerId, stateBeforeMilestones, undefined, entry.sequenceId));
    if (turn.discoveryNotification) {
      setAlienDiscoveryNotification({ visible: true, message: turn.discoveryNotification.message });
      setTimeout(() => setAlienDiscoveryNotification(null), 4000);
    }

    // Un palier exige un choix : on s'arrête là et on laisse le joueur interagir
    if (!turn.turnEnded && turn.pendingInteraction) {
      const interaction = turn.pendingInteraction;
      setInteractionState(interaction);
      let toastMessage = getInteractionLabel(interaction);
      if (interaction.type === 'PLACING_OBJECTIVE_MARKER') {
        toastMessage = `Palier de ${interaction.milestone} PV atteint ! Placez un marqueur sur un objectif.`;
      } else if (interaction.type === 'CHOOSING_CENTAURIEN_REWARD') {
        toastMessage = `Message Centaurien décodé ! Choisissez une récompense.`;
      }
      setToast({ message: toastMessage, visible: true });
      return;
    }

    // Le joueur suivant est déjà actif dans turn.updatedGame : réinitialiser les interactions
    setInteractionState({ type: 'IDLE' });
    setPendingInteractions([]);
    setToast({ message: "Au tour du joueur suivant. Patientez...", visible: true });
    turn.turnEntries.forEach(e => addToHistory(e.message, e.playerId, turn.updatedGame));
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
        const currentPlayer = actingPlayer(game);
        const cardsToKeep = CardSystem.getHandCards(currentPlayer).length - (currentCards.length + 1);
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
      const cardsToKeep = CardSystem.getHandCards(currentPlayer).filter(c => !interactionState.selectedCards.includes(c.id)).map(c => c.id);

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

      const res = CardSystem.discardForSignals(game, currentPlayer.id, interactionState.selectedCards, sequenceId);
      res.historyEntries.forEach(e => addToHistory(e.message, e.playerId, game, undefined, sequenceId));
      if (!handleNewInteractions(res.newPendingInteractions, sequenceId)) {
        setInteractionState({ type: 'IDLE' });
      }
    }
  };

  // Gestionnaire pour la réservation de carte
  const handleConfirmReservation = (cardIds?: string[]) => {
    if (!game) return;

    if (interactionState.type !== 'RESERVING_CARD') return;
    const selectedCards = cardIds ?? interactionState.selectedCards;
    if (selectedCards.length === 0) return;

    // Le joueur concerné est celui qui possède la carte sélectionnée (sinon le joueur actif)
    const owner = game.players.find(p => p.cards.some(c => c.id === selectedCards[0])) ?? game.players[game.currentPlayerIndex];
    const { updatedGame, historyEntries } = CardSystem.reserveCards(game, owner.id, selectedCards, interactionState.sequenceId);
    historyEntries.forEach(e => addToHistory(e.message, e.playerId, game, { type: 'IDLE' }, interactionState.sequenceId));

    setGame(updatedGame);
    if (gameEngineRef.current) gameEngineRef.current.setState(updatedGame);

    // Mettre à jour l'état d'interaction
    const newCount = interactionState.count - selectedCards.length;
    if (newCount > 0) {
      setInteractionState({ type: 'RESERVING_CARD', count: newCount, selectedCards: [], sequenceId: interactionState.sequenceId });
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
      if (!game || interactionState.type !== 'SELECTING_SCAN_SECTOR') return;
      const currentPlayer = actingPlayer(game);

      const sequenceId = interactionState.sequenceId || `scan-${uniqueId()}`;
      const res = ScanSystem.resolveScanSectorSelection(game, currentPlayer.id, interactionState, sectorId, sequenceId);
      if (res.error) {
        setToast({ message: res.error, visible: true });
        return;
      }
      const updatedGame = res.updatedGame;
      const usedProbeId = res.usedProbeId;
      res.historyEntries.forEach(entry => addToHistory(entry.message, entry.playerId, game, undefined, sequenceId));
      const allNewInteractions = [...res.newPendingInteractions];

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
          const gameAfterScan = result.updatedState;
          setGame(gameAfterScan);
          action.historyEntries.forEach(entry => addToHistory(entry.message, entry.playerId, game, undefined, entry.sequenceId));
          handleNewInteractions(action.newPendingInteractions, action.historyEntries[0]?.sequenceId);
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
        action.historyEntries.forEach(entry => addToHistory(entry.message, entry.playerId, game, undefined, entry.sequenceId));
        handleNewInteractions(action.newPendingInteractions, action.historyEntries[0]?.sequenceId);
      } else {
        console.error('Erreur lors du lancement de la sonde:', result.error);
        setToast({ message: result.error || 'Impossible de lancer la sonde', visible: true });
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
        handleNewInteractions(action.newPendingInteractions, action.historyEntries[0]?.sequenceId);
      } else {
        console.error("Erreur lors du scan d'un secteur:", result.error);
        setToast({ message: result.error || 'Impossible de scanner un secteur', visible: true });
      }
    }
    /***
     * ORBIT PROBE
     */
    else if (actionType === ActionType.ORBIT) {
      setActionFocus('orbit');
      setToast({ message: "Veuillez sélectionner un emplacement d'orbite sur une planète.", visible: true });
    }
    /***
     * LAND PROBE
     */
    else if (actionType === ActionType.LAND) {
      setActionFocus('land');
      setToast({ message: "Veuillez sélectionner un emplacement d'atterrissage sur une planète.", visible: true });
    }
    /***
     * PLAY CARD
     */
    else if (actionType === ActionType.PLAY_CARD) {
      setActionFocus('card');
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
        handleNewInteractions(action.newPendingInteractions, action.historyEntries[0]?.sequenceId);
      } else {
        console.error("Erreur lors de la recherche de technologie:", result.error);
        setToast({ message: result.error || 'Impossible de rechercher une technologie', visible: true });
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
      const previousState = cloneGame(currentGame);

      // Délai pour l'animation avant d'appliquer les effets
      setTimeout(() => {
        if (!gameEngineRef.current || !gameRef.current) return;
        gameEngineRef.current.setState(gameRef.current);

        const result = gameEngineRef.current.executeAction(action);
        if (result.success && result.updatedState) {
          setGame(result.updatedState);
          action.historyEntries.forEach(e => addToHistory(e.message, e.playerId, previousState, { type: 'IDLE' }, e.sequenceId));
          if (!handleNewInteractions(action.newPendingInteractions, action.historyEntries[0]?.sequenceId)) setInteractionState({ type: 'IDLE' });
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
      const handSize = CardSystem.getHandCards(currentPlayer).length;
      const toDiscard = handSize - GAME_CONSTANTS.HAND_SIZE_AFTER_PASS;
      if (toDiscard > 0) {
        // Avertir avant de passer : le joueur ne jouera plus de la manche et perdra des cartes
        setConfirmModalState({
          visible: true,
          cardId: null,
          message: `Passer définitivement ? Vous ne pourrez plus agir avant la prochaine manche. Vous avez ${handSize} cartes en main : vous devrez en défausser ${toDiscard} pour n'en garder que ${GAME_CONSTANTS.HAND_SIZE_AFTER_PASS}.`,
          onConfirm: () => {
            setInteractionState({ type: 'DISCARDING_CARD', count: toDiscard, selectedCards: [] });
            setToast({ message: `Veuillez défausser pour ne garder que ${GAME_CONSTANTS.HAND_SIZE_AFTER_PASS} cartes en main.`, visible: true });
          }
        });
        return;
      }

      const cardsToKeep = CardSystem.getHandCards(currentPlayer).map(c => c.id);

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
  const handlePlaceLifeTrace = (boardIndex: number, color: LifeTraceType, slotType: LifeTraceLocation, slotIndex?: number) => {
    if (!game) return;
    if (interactionState.type !== 'PLACING_LIFE_TRACE') return;

    const sequenceId = interactionState.sequenceId || `trace-${uniqueId()}`;
    const playerId = interactionState.playerId || game.players[game.currentPlayerIndex].id;

    // Appel métier (trace « de n'importe quelle couleur » : la couleur cliquée)
    const result = InteractionChoices.placeLifeTrace(game, playerId, { ...interactionState, sequenceId }, boardIndex, color, slotType, slotIndex);
    if (result.error) return;
    const { updatedGame, historyEntries, newPendingInteractions } = result;

    if (result.discoveredSpecies) {
      setAlienDiscoveryNotification({ visible: true, message: "Découverte d'une nouvelle espèce Alien !" });
      setTimeout(() => setAlienDiscoveryNotification(null), 4000);
    }

    // End transaction
    setGame(updatedGame);
    if (gameEngineRef.current) gameEngineRef.current.setState(updatedGame);
    historyEntries.forEach((e, i) => { addToHistory(e.message, e.playerId, i === 0 ? game : undefined, undefined, sequenceId); });
    if (!handleNewInteractions(newPendingInteractions, sequenceId)) setInteractionState({ type: 'IDLE' });
  };

  // Gestionnaire pour le choix de récompense Centaurienne
  const handleCentaurienRewardClick = (tokenIndex: number) => {
    if (!game) return;
    if (interactionState.type !== 'CHOOSING_CENTAURIEN_REWARD') return;

    // Create sequence id and player id
    const sequenceId = interactionState.sequenceId || `trace-${uniqueId()}`;
    const playerId = game.players[game.currentPlayerIndex].id;

    // Appel métier
    const result = SpeciesSystem.claimCentaurienReward(game, playerId, tokenIndex);
    const updatedGame = result.updatedGame;
    const historyEntries = result.historyEntries;
    const newPendingInteractions = result.newPendingInteractions;

    // End transaction
    setGame(updatedGame);
    if (gameEngineRef.current) gameEngineRef.current.setState(updatedGame);
    historyEntries.forEach(e => addToHistory(e.message, e.playerId, game, undefined, sequenceId));
    if (!handleNewInteractions(newPendingInteractions, sequenceId)) setInteractionState({ type: 'IDLE' });

    // Continuer la fin de tour
    continueEndOfTurn();
  };

  // Gestionnaire pour le choix d'une carte Exertien à un palier (cardId absent = renoncer)
  const handleExertienCardChoice = (cardId?: string) => {
    if (!game) return;
    if (interactionState.type !== 'CHOOSING_EXERTIEN_CARD') return;

    const playerId = game.players[game.currentPlayerIndex].id;
    const result = SpeciesSystem.playExertienCard(game, playerId, interactionState.milestone, cardId);
    if (result.error) {
      setToast({ message: result.error, visible: true });
      return;
    }

    setGame(result.updatedGame);
    if (gameEngineRef.current) gameEngineRef.current.setState(result.updatedGame);
    result.historyEntries.forEach(e => addToHistory(e.message, e.playerId, game, interactionState));
    setInteractionState({ type: 'IDLE' });

    // Continuer la fin de tour
    continueEndOfTurn();
  };

  // Gestionnaire pour le clic sur une carte Alien
  const handleSpeciesCardClick =(speciesId: string, cardId: string) => {
    if (!game) return;
    if (interactionState.type !== 'ACQUIRING_ALIEN_CARD') return;
    if (interactionState.speciesId !== speciesId) return;

    const sequenceId = interactionState.sequenceId || `alien-card-${uniqueId()}`;
    const playerId = actingPlayer(game).id;

    const result = InteractionChoices.acquireAlienCard(game, playerId, { ...interactionState, sequenceId }, cardId);
    if (result.error) return;

    setGame(result.updatedGame);
    if (gameEngineRef.current) gameEngineRef.current.setState(result.updatedGame);
    result.historyEntries.forEach(e => addToHistory(e.message, e.playerId, game, undefined, sequenceId));
    // Plusieurs cartes à prendre : la même interaction continue avec une carte de moins
    setInteractionState(result.newPendingInteractions[0] ?? { type: 'IDLE' });
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
    // Exception : Pour les missions, on ne force pas la résolution de toutes les conditions d'un coup
    const isMissionClaim = choice.state.type === 'CLAIMING_MISSION_REQUIREMENT';
    if (!isMissionClaim && updatedChoices.some(c => !c.done)) {
      setPendingInteractions(prev => [nextMenuState, ...prev]);
    }
  };

  // Gestionnaire pour le choix Observation 2
  const handleObs2Choice = (accepted: boolean) => {
    if (!game) return;
    if (interactionState.type !== 'CHOOSING_OBS2_ACTION') return;

    // Create sequence id
    const sequenceId = interactionState.sequenceId || `obs2-${uniqueId()}`;

    if (accepted) {
      const res = ScanSystem.applyObservation2(game, game.players[game.currentPlayerIndex].id, sequenceId);
      if (res.error) {
        setToast({ message: res.error, visible: true });
        setInteractionState({ type: 'IDLE' });
        return;
      }
      res.historyEntries.forEach(entry => addToHistory(entry.message, entry.playerId, game, undefined, sequenceId));
      setGame(res.updatedGame);
      if (gameEngineRef.current) gameEngineRef.current.setState(res.updatedGame);
      if (res.newPendingInteractions.length > 0) {
        handleNewInteractions(res.newPendingInteractions, sequenceId);
      } else {
        setInteractionState({ type: 'IDLE' });
      }
    } else {
      setInteractionState({ type: 'IDLE' });
    }

  };

  // Gestionnaire pour le choix Observation 3
  const handleObs3Choice = (accepted: boolean) => {
    if (interactionState.type !== 'CHOOSING_OBS3_ACTION') return;

    const sequenceId = interactionState.sequenceId || `obs3-${uniqueId()}`;

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

    const sequenceId = interactionState.sequenceId || `obs4-${uniqueId()}`;
    const res = ScanSystem.applyObservation4(game, game.players[game.currentPlayerIndex].id, choice, sequenceId);
    if (res.error) {
      setToast({ message: res.error, visible: true });
      return;
    }
    res.historyEntries.forEach(entry => addToHistory(entry.message, entry.playerId, game, undefined, sequenceId));
    if (res.newPendingInteractions.length > 0) {
      setPendingInteractions(prev => [...res.newPendingInteractions, ...prev]);
    }
    setGame(res.updatedGame);
    if (gameEngineRef.current) gameEngineRef.current.setState(res.updatedGame);
    setInteractionState({ type: 'IDLE' });
  };

  // Gestionnaire pour le choix Média ou Déplacement (Carte 19)
  const handleMediaOrMoveChoice = (choice: 'MEDIA' | 'MOVE') => {
    if (!game) return;

    if (interactionState.type !== 'CHOOSING_MEDIA_OR_MOVE') return;

    const currentPlayer = actingPlayer(game);
    const sequenceId = interactionState.sequenceId;
    const res = ProbeSystem.chooseMediaOrMove(game, currentPlayer.id, choice, interactionState.remainingMoves || 0, sequenceId);
    res.historyEntries.forEach(e => addToHistory(e.message, e.playerId, game, { type: 'IDLE' }, sequenceId));
    setGame(res.updatedGame);
    if (gameEngineRef.current) gameEngineRef.current.setState(res.updatedGame);
    setInteractionState(res.nextInteraction ?? { type: 'IDLE' });
  };

  /** Exécute une action principale par le moteur ; en cas de refus, lève l'erreur (affichée par l'appelant) */
  const runEngineAction = (action: OrbitAction | LandAction) => {
    if (!gameEngineRef.current || !gameRef.current) throw new Error('Moteur indisponible');
    gameEngineRef.current.setState(gameRef.current);
    const result = gameEngineRef.current.executeAction(action);
    if (!result.success || !result.updatedState) throw new Error(result.error || 'Action impossible');
    return { updatedGame: result.updatedState, historyEntries: action.historyEntries, newPendingInteractions: action.newPendingInteractions };
  };

  // Helper générique pour les interactions avec les planètes (Orbite/Atterrissage)
  // Renvoie true si de nouvelles interactions ont été déclenchées (bonus à résoudre)
  const handlePlanetInteraction = (
    planetId: string,
    actionFn: (game: Game, playerId: string, probeId: string, targetId: string, sequenceId: string) => { updatedGame: Game, historyEntries: HistoryEntry[], newPendingInteractions: InteractionState[] },
    successMessage: string
  ): boolean => {
    if (!game) return false;
    const currentPlayer = actingPlayer(game);
    const found = ProbeSystem.findProbeAtPlanet(game, currentPlayer.id, planetId);
    if (!found) return false;

    // Générer un ID de séquence pour grouper l'action et ses bonus
    const sequenceId = interactionState.sequenceId || `seq-${uniqueId()}`;

    try {
      const result = actionFn(game, currentPlayer.id, found.probe.id, planetId, sequenceId);

      // Les actions payantes (OrbitAction, LandAction) marquent elles-mêmes l'action principale
      const updatedGame = result.updatedGame;

      setGame(updatedGame);
      if (gameEngineRef.current) gameEngineRef.current.setState(updatedGame);
      const interactionTriggered = handleNewInteractions(result.newPendingInteractions, sequenceId);

      // Le moteur rédige le message de l'action puis ses gains ; l'annulation restaure l'état d'avant l'action
      result.historyEntries.forEach((entry, i) => addToHistory(entry.message, entry.playerId, i === 0 ? game : updatedGame, undefined, sequenceId));

      if (!interactionTriggered) {
        setToast({ message: successMessage, visible: true });
      }
      return interactionTriggered;
    } catch (e) {
      setToast({ message: e instanceof Error ? e.message : String(e), visible: true });
      return false;
    }
  };

  // Après une orbite/un atterrissage bonus : décrémente le compteur ou termine l'interaction
  const continueBonusPlacement = (interactionTriggered: boolean) => {
    if (interactionState.type !== 'ORBITING_PROBE' && interactionState.type !== 'LANDING_PROBE') return;
    const remaining = interactionState.count - 1;
    if (interactionTriggered) {
      // Des bonus sont à résoudre d'abord : les placements restants sont mis en file d'attente
      if (remaining > 0) setPendingInteractions(prev => [...prev, { ...interactionState, count: remaining }]);
      return;
    }
    setInteractionState(remaining > 0 ? { ...interactionState, count: remaining } : { type: 'IDLE' });
  };

  // Retrait d'un orbiteur (carte 15) ou d'un atterrisseur (carte 84)
  const handleRemoveProbe = (removeFn: () => { updatedGame: Game, historyEntries: HistoryEntry[], newPendingInteractions: InteractionState[] }) => {
    if (!game) return;
    try {
      const result = removeFn();
      setGame(result.updatedGame);
      if (gameEngineRef.current) gameEngineRef.current.setState(result.updatedGame);
      result.historyEntries.forEach(e => addToHistory(e.message, e.playerId, game, undefined, e.sequenceId));
      if (!handleNewInteractions(result.newPendingInteractions, interactionState.sequenceId)) {
        setInteractionState({ type: 'IDLE' });
      }
    } catch (e) {
      setToast({ message: e instanceof Error ? e.message : String(e), visible: true });
    }
  };

  // Gestionnaire pour la mise en orbite via la hover card
  const handleOrbit = (planetId: string, slotIndex?: number) => {
    if (!game) return;
    const currentPlayer = actingPlayer(game);

    // Carte 15 : retirer un orbiteur
    if (interactionState.type === 'REMOVING_ORBITER') {
      const orbiterIndex = slotIndex ?? game.board.planets.find(p => p.id === planetId)?.orbiters.findIndex(p => p.ownerId === currentPlayer.id);
      if (orbiterIndex === undefined || orbiterIndex === -1) return;
      handleRemoveProbe(() => ProbeSystem.removeOrbiter(game, currentPlayer.id, planetId, orbiterIndex, interactionState.sequenceId));
      return;
    }

    const found = ProbeSystem.findProbeAtPlanet(game, currentPlayer.id, planetId);
    if (!found) return;

    const executeOrbit = () => {
      // Orbite bonus (gratuite)
      if (interactionState.type === 'ORBITING_PROBE') {
        const source = interactionState.source;
        continueBonusPlacement(handlePlanetInteraction(
          planetId,
          (g, pid, prid, targetId, seqId) => ProbeSystem.orbitProbe(g, pid, prid, targetId, seqId, true, source),
          "Sonde mise en orbite"
        ));
        return;
      }

      const action = new OrbitAction(currentPlayer.id, found.probe.id, planetId);
      const validation = ActionValidator.validateAction(game, action);
      if (!validation.valid) {
        setToast({ message: validation.errors[0]?.message || "Mise en orbite impossible", visible: true });
        return;
      }

      handlePlanetInteraction(planetId, () => runEngineAction(action), "Sonde mise en orbite");
    };

    // Avertissement si le bonus de l'emplacement serait perdu
    const bonus = slotIndex !== undefined ? ProbeSystem.getSlotBonus(game, planetId, 'orbit', slotIndex) : undefined;
    if (bonus && checkBonusAndConfirm(bonus, executeOrbit)) return;

    executeOrbit();
  };

  // Gestionnaire pour le clic sur un token Mascamite
  const handleMascamiteClick = (planetId: string, tokenIndex: number) => {
    if (!game) return;
    if (interactionState.type !== 'COLLECTING_SPECIMEN' && interactionState.type !== 'CONSULTING_SPECIMEN') return;
    const playerId = actingPlayer(game).id;
    const allowed = interactionState.type === 'COLLECTING_SPECIMEN'
      ? interactionState.planetId === planetId
      : SpeciesSystem.consultablePlanets(game, playerId, interactionState).includes(planetId);
    if (!allowed) return;

    const sequenceId = interactionState.sequenceId || `mascamite-${uniqueId()}`;
    const mode = interactionState.type === 'CONSULTING_SPECIMEN' ? 'consult' : 'collect';
    const result = SpeciesSystem.takeMascamiteSpecimen(game, playerId, planetId, tokenIndex, mode, sequenceId);
    if (!result) {
      setInteractionState({ type: 'IDLE' });
      return;
    }

    setGame(result.updatedGame);
    if (gameEngineRef.current) gameEngineRef.current.setState(result.updatedGame);
    result.historyEntries.forEach(e => addToHistory(e.message, e.playerId, game, undefined, sequenceId));
    if (!handleNewInteractions(result.newPendingInteractions, sequenceId)) {
      setInteractionState({ type: 'IDLE' });
    }
  };

  // Gestionnaire pour l'atterrissage via la hover card
  const handleLand = (planetId: string, slotIndex?: number) => {
    if (!game) return;
    const currentPlayer = actingPlayer(game);

    // Carte 84 : retirer un atterrisseur
    if (interactionState.type === 'REMOVING_LANDER') {
      const landerIndex = slotIndex ?? game.board.planets.find(p => p.id === planetId)?.landers.findIndex(p => p.ownerId === currentPlayer.id);
      if (landerIndex === undefined || landerIndex === -1) return;
      handleRemoveProbe(() => ProbeSystem.removeLander(game, currentPlayer.id, planetId, landerIndex, interactionState.sequenceId));
      return;
    }

    const found = ProbeSystem.findProbeAtPlanet(game, currentPlayer.id, planetId);
    if (!found) return;

    const executeLand = () => {
      // Atterrissage bonus (gratuit)
      if (interactionState.type === 'LANDING_PROBE') {
        const source = interactionState.source;
        continueBonusPlacement(handlePlanetInteraction(
          planetId,
          (g, pid, prid, targetId, seqId) => ProbeSystem.landProbe(g, pid, prid, targetId, true, slotIndex, source, seqId),
          "Atterrissage réussi"
        ));
        return;
      }

      const action = new LandAction(currentPlayer.id, found.probe.id, planetId, slotIndex);
      const validation = ActionValidator.validateAction(game, action);
      if (!validation.valid) {
        setToast({ message: validation.errors[0]?.message || "Atterrissage impossible", visible: true });
        return;
      }

      handlePlanetInteraction(planetId, () => runEngineAction(action), "Atterrissage réussi");
    };

    // Avertissement si le bonus de l'emplacement serait perdu
    const bonus = slotIndex !== undefined ? ProbeSystem.getSlotBonus(game, planetId, 'land', slotIndex) : undefined;
    if (bonus && checkBonusAndConfirm(bonus, executeLand)) return;

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

      // Utiliser l'action pour effectuer le mouvement
      const cost = ProbeSystem.getMovementCost(currentGame, currentPlayerId, probeId);
      const usedFree = Math.min(cost, freeMovements);
      if (!currentSequenceId) currentSequenceId = `move-${uniqueId()}`;
      const action = new MoveProbeAction(currentPlayerId, probeId, { disk, sector }, freeMovements, currentSequenceId);
      const result = gameEngineRef.current.executeAction(action);

      if (result.success && result.updatedState) {
        const updatedGame = result.updatedState;

        action.historyEntries.forEach(entry => addToHistory(entry.message, entry.playerId, game, undefined, entry.sequenceId));
        // Ajouter les nouvelles interactions et lancer la première
        handleNewInteractions(action.newPendingInteractions, action.historyEntries[0]?.sequenceId);

        // Carte 19 : le moteur propose le choix Média / déplacement, qui interrompt le chemin
        if (action.newPendingInteractions.some(i => i.type === 'CHOOSING_MEDIA_OR_MOVE')) {
          interruptedForChoice = true;
          if (i < path.length - 1) {
            setToast({ message: "Déplacement interrompu. Choisissez un bonus.", visible: true });
          }
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

  const checkBonusAndConfirm = useCallback((
    bonus: Bonus,
    onConfirm: () => void,
    cardId: string | null = null
  ): boolean => {
    if (!game) return false;
    const warning = ResourceSystem.lostBonusWarning(game, game.players[game.currentPlayerIndex].id, bonus);
    if (!warning) return false;
    setConfirmModalState({ visible: true, cardId, message: warning, onConfirm });
    return true;
  }, [game]);

  // Gestionnaire pour jouer une carte (payer son coût en crédits)
  const handlePlayCardRequest = (cardId: string, force: boolean = false) => {
    if (!game || !gameRef.current || !gameEngineRef.current) return;

    const currentGame = cloneGame(game);
    const currentPlayer = currentGame.players[currentGame.currentPlayerIndex];
    const card = currentPlayer.cards.find(c => c.id === cardId);
    if (!card) return;

    if (!force) {
      const bonusToCheck = CardSystem.previewImmediateBonuses(card);
      if (checkBonusAndConfirm(bonusToCheck, () => handlePlayCardRequest(cardId, true), cardId)) {
        return;
      }
    }

    // Synchroniser le moteur avec l'état affiché : sinon il peut refuser la carte sur un état périmé
    gameEngineRef.current.setState(gameRef.current);
    const action = new PlayCardAction(currentPlayer.id, cardId);
    const result = gameEngineRef.current.executeAction(action);
    if (!result.success || !result.updatedState) {
      setToast({ message: result.error || 'Impossible de jouer cette carte', visible: true });
      return;
    }
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
          handleNewInteractions(action.newPendingInteractions, action.historyEntries[0]?.sequenceId, undefined, forceStacking);
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
    handleNewInteractions(result.newPendingInteractions, result.historyEntries[0]?.sequenceId);
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

    // Carte : à choisir dans la rangée ou à piocher (le coût est payé, puis la rangée s'ouvre)
    if (gainType === 'card' && (spendType === 'credit' || spendType === 'energy')) {
      const trade = ResourceSystem.tradeForCard(game, currentPlayer.id, spendType);
      if (trade.error) {
        setToast({ message: trade.error, visible: true });
        return;
      }
      setGame(trade.updatedGame);
      if (gameEngineRef.current) gameEngineRef.current.setState(trade.updatedGame);
      const sequenceId = `trade-${uniqueId()}`;
      trade.historyEntries.forEach(e => addToHistory(e.message, e.playerId, game, undefined, sequenceId));
      handleNewInteractions(trade.newPendingInteractions, sequenceId);
      return;
    }

    const result = ResourceSystem.tradeResources(game, currentPlayer.id, spendType, gainType);
    if (result.error) {
      setToast({ message: result.error, visible: true });
      return;
    }
    setGame(result.updatedGame);
    if (gameEngineRef.current) gameEngineRef.current.setState(result.updatedGame);
    setInteractionState({ type: 'IDLE' });
    result.historyEntries.forEach(e => addToHistory(e.message, e.playerId, game));
  };

  // Gestionnaire pour la sélection d'une carte de la pioche ou de la rangée principale
  const handleCardRowClick = (cardId?: string) => { // cardId undefined means deck
    if (!game) return;

    // Cas 1: Sélection pour 2eme action scan
    if (interactionState.type === 'SELECTING_SCAN_CARD') {
      if (!cardId) return; // Cannot select deck for scan color
      
      const { updatedGame, discardedCard } = CardSystem.discardFromRow(game, cardId);
      if (!discardedCard) return;

      setGame(updatedGame);
      if (gameEngineRef.current) gameEngineRef.current.setState(updatedGame);

      setTimeout(() => {
        setInteractionState({ 
            type: 'SELECTING_SCAN_SECTOR', 
            color: discardedCard.scanSector, 
            sequenceId: interactionState.sequenceId, 
            cardId: discardedCard.id,
            cardProcessed: true,
            message: `utilise carte "${discardedCard.name}" (${discardedCard.scanSector}) de la rangée`
        });
      }, 200);
    
    
    
    // Cas 2: Sélection pour achat ou gain de carte (bonus)
    } else if (interactionState.type === 'ACQUIRING_CARD') {
        const currentPlayer = actingPlayer(game);

        const sequenceId = interactionState.sequenceId;
        const result = CardSystem.acquireCard(game, currentPlayer.id, cardId, { isFree: interactionState.isFree, triggerFreeAction: interactionState.triggerFreeAction }, sequenceId);
        if (result.error) {
          setToast({ message: result.error, visible: true });
          // On reste dans l'état ACQUIRING_CARD pour permettre de réessayer ou d'annuler via l'overlay
          return;
        }
        setGame(result.updatedGame);
        if (gameEngineRef.current) gameEngineRef.current.setState(result.updatedGame);
        if (result.newPendingInteractions.length > 0) {
          setPendingInteractions(prev => [...result.newPendingInteractions, ...prev]);
        }
        // Pour l'achat normal, l'annulation revient à IDLE (pas à la sélection)
        const undoState: InteractionState = !interactionState.isFree ? { type: 'IDLE' } : interactionState;
        result.historyEntries.forEach(e => addToHistory(e.message, e.playerId, game, undoState, sequenceId));

        // Gérer le compteur pour les sélections multiples
        if (interactionState.count > 1) {
          setInteractionState({ ...interactionState, count: interactionState.count - 1 });
        } else {
          setInteractionState({ type: 'IDLE' });
        }
    }
  };

  // Gestionnaire pour l'échange de cartes contre des resources crédit/énergie
  const handleTradeCardAction = (targetGain?: string) => {
    if (interactionState.type !== 'IDLE') return;
    if (!targetGain) return;

    setInteractionState({ type: 'TRADING_CARD', count: 2, targetGain, selectedCards: [] });
  }

  // Gestionnaire unifié pour les échanges
  const handleConfirmTrade = () => {
    if (!game) return;

    if (interactionState.type !== 'TRADING_CARD') return;
    const currentPlayer = game.players[game.currentPlayerIndex];

    const result = ResourceSystem.tradeResources(game, currentPlayer.id, 'card', interactionState.targetGain, interactionState.selectedCards);
    if (result.error) {
      setToast({ message: result.error, visible: true });
      return;
    }
    setGame(result.updatedGame);
    if (gameEngineRef.current) gameEngineRef.current.setState(result.updatedGame);
    setInteractionState({ type: 'IDLE' });
    result.historyEntries.forEach(e => addToHistory(e.message, e.playerId, game, { type: 'IDLE' }));
  };

  // Gestionnaire pour le clic sur une planète (ex: Terre pour lancer une sonde)
  const handlePlanetClick = (planetId: string) => {
    if (!gameEngineRef.current) return;
    if (interactionState.type === 'REMOVING_ORBITER') {
        handleOrbit(planetId);
    } else if (interactionState.type === 'REMOVING_LANDER') {
        handleLand(planetId);
    } else if (planetId === 'earth') {
        if (!gameRef.current) return;
        gameEngineRef.current.setState(gameRef.current);
        const action = new LaunchProbeAction(currentPlayer.id);
        const result = gameEngineRef.current.executeAction(action);
        if (result.success && result.updatedState) {
          setGame(result.updatedState);
          action.historyEntries.forEach(entry => addToHistory(entry.message, entry.playerId, gameRef.current ?? undefined, undefined, entry.sequenceId));
          handleNewInteractions(action.newPendingInteractions, action.historyEntries[0]?.sequenceId);
        } else {
          setToast({ message: result.error || 'Impossible de lancer une sonde', visible: true });
        }
    }
  };

  // Fonction interne pour traiter l'achat (commune à l'achat direct et après sélection)
  const processTechPurchase = (tech: Technology, targetComputerCol?: number, noTileBonus?: boolean, baseGame?: Game, sequenceId: string | undefined = interactionState.sequenceId) => {
    if (!game || !gameRef.current) return;

    const currentGame = baseGame || gameRef.current;
    const currentPlayer = actingPlayer(currentGame);

    // Mettre à jour GameEngine
    const result = TechnologySystem.acquireTechnology(currentGame, currentPlayer.id, tech, targetComputerCol, noTileBonus);

    // Finaliser la transaction
    setGame(result.updatedGame);
    if (gameEngineRef.current) gameEngineRef.current.setState(result.updatedGame);
    result.historyEntries.forEach(entry => addToHistory(entry.message, entry.playerId, currentGame, undefined, sequenceId));

    if (result.newPendingInteractions && result.newPendingInteractions.length > 0) {
        const interactionsWithSeqId = result.newPendingInteractions.map(i => ({ ...i, sequenceId }));
        handleNewInteractions(interactionsWithSeqId, sequenceId);
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
      const playerId = game.players[game.currentPlayerIndex].id;
      const action = new ResearchTechAction(playerId);
      const validation = ActionValidator.validateAction(game, action);
      if (!validation.valid) {
        setToast({ message: validation.errors[0]?.message || "Recherche impossible", visible: true });
        return;
      }

      // Paiement + rotation via l'action moteur (marque aussi l'action principale)
      const engine = new GameEngine(game);
      const result = engine.executeAction(action);
      if (!result.success || !result.updatedState) {
        setToast({ message: result.error || "Recherche impossible", visible: true });
        return;
      }
      const updatedGame = result.updatedState;
      const sequenceId = action.historyEntries[0]?.sequenceId || `tech-${uniqueId()}`;
      action.historyEntries.forEach(e => addToHistory(e.message, e.playerId, game, undefined, sequenceId));

      if (tech.type === TechnologyCategory.COMPUTING) {
        // Sélection du slot
        setGame(updatedGame);
        if (gameEngineRef.current) gameEngineRef.current.setState(updatedGame);
        setInteractionState({ type: 'SELECTING_COMPUTER_SLOT', tech, sequenceId });
      } else {
        // Finaliser l'achat
        processTechPurchase(tech, undefined, false, updatedGame, sequenceId);
      }
    }
  };

  // Gestionnaire pour la sélection de la colonne ordinateur
  const handleComputerColumnSelect = (col: number) => {
    if (!game) return;
    if (interactionState.type !== 'SELECTING_COMPUTER_SLOT') return;

    const check = ComputerSystem.canAssignTechnology(actingPlayer(game), col);
    if (!check.canAssign) {
      if (ComputerSystem.TECH_COLUMNS.includes(col)) setToast({ message: check.reason!, visible: true });
      return;
    }

    // Finaliser l'achat
    processTechPurchase(interactionState.tech, col, false);
  };

  // Gestionnaire pour les bonus ordinateur (déclenché depuis PlayerBoardUI)
  const handleComputerBonus = (type: string, amount: number, sequenceId?: string) => {
    if (!game) return;

    if (type === 'reservation') {
      const currentPlayer = game.players[game.currentPlayerIndex];
      const count = Math.min(amount, currentPlayer.cards.length);
      if (count > 0) {
        const seqId = sequenceId || interactionState.sequenceId;
        setInteractionState({ type: 'RESERVING_CARD', count: count, selectedCards: [], sequenceId: seqId });
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

    const playerId = game.players[game.currentPlayerIndex].id;

    // Appel métier
    const result = InteractionChoices.placeObjectiveMarker(game, playerId, interactionState, tileId);
    if (result.error) {
      setToast({ message: result.error, visible: true });
      return;
    }

    setGame(result.updatedGame);
    if (gameEngineRef.current) gameEngineRef.current.setState(result.updatedGame);
    result.historyEntries.forEach(e => addToHistory(e.message, e.playerId, game, interactionState, e.sequenceId));
    setInteractionState({ type: 'IDLE' });

    // Continuer la fin de tour
    continueEndOfTurn();
  };

  // Gestionnaire pour le clic sur le background
  const handleBackgroundClick = () => {
    setActionFocus(null);
    if (interactionState.type === 'MOVING_PROBE') {
      setInteractionState({ type: 'IDLE' });
    }
  }

  // Gestionnaire pour le clic sur une mission ou sur une playedCard (centaurien)
  const handleMissionClick = (missionId: string, requirementId: string) => {
    if (!game) return;
    setInteractionState({ type: 'CLAIMING_MISSION_REQUIREMENT', missionId, requirementId });
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
          showDebug={showDebug}
          setShowDebug={setShowDebug}
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
        <div className="seti-ai-overlay">
            <div className="seti-ai-spinner"></div>
            <p className="seti-ai-text">
                Tour de l'IA ({currentPlayer.name})
            </p>
        </div>
      )}
      {/* Outils de débogage (réglage du menu Paramètres, masqués par défaut) */}
      {showDebug && (
        <DebugPanel
          game={game}
          setGame={(newGame) => {
            setGame(newGame);
            if (gameEngineRef.current) gameEngineRef.current.setState(newGame);
          }}
          onHistory={addToHistory}
          interactionState={interactionState}
          onClose={() => setShowDebug(false)}
        />
      )}

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
          const cardsToKeep = passModalState.cardsToKeep || CardSystem.getHandCards(currentPlayer).map(c => c.id);
          performPass(cardsToKeep, selectedCardId);
          setPassModalState({ visible: false, cards: [], selectedCardId: null });
        }}
        currentRound={game.currentRound}
      />

      {/* Modale de réservation de carte (mise en place et bonus de réservation) */}
      {isReservationModalActive && interactionState.type === 'RESERVING_CARD' && (
        <PassModal
          visible
          cards={CardSystem.getHandCards(reservingPlayer!)}
          onConfirm={(selectedCardId) => handleConfirmReservation([selectedCardId])}
          currentRound={game.currentRound}
          title={`Réservez une carte${interactionState.count > 1 ? ` (${interactionState.count} réservations restantes)` : ''}`}
          subtitle="La carte réservée est glissée sous votre plateau : vous gagnez aussitôt son revenu, puis à chaque manche."
          confirmLabel="Réserver"
          highlightedAttribute="revenue"
        />
      )}

      {/* Défausse de fin de manche (garder 4 cartes) : action gratuite en surbrillance */}
      {interactionState.type === 'DISCARDING_CARD' && actingPlayer(game).type === 'human' && (() => {
        const hand = CardSystem.getHandCards(actingPlayer(game));
        const toDiscard = Math.max(0, hand.length - GAME_CONSTANTS.HAND_SIZE_AFTER_PASS);
        return (
          <CardPickModal
            title={`Défaussez ${toDiscard} carte${toDiscard > 1 ? 's' : ''}`}
            subtitle={`Vous ne gardez que ${GAME_CONSTANTS.HAND_SIZE_AFTER_PASS} cartes en main pour la manche suivante.`}
            cards={hand}
            selectedIds={interactionState.selectedCards}
            onToggle={handleCardClick}
            highlightedAttribute="freeAction"
            status={`Sélectionnées : ${interactionState.selectedCards.length} / ${toDiscard}`}
            confirmLabel="Défausser"
            canConfirm={interactionState.selectedCards.length === toDiscard}
            onConfirm={handleConfirmDiscard}
          />
        );
      })()}

      {/* Échange de 2 cartes de la main contre une ressource */}
      {interactionState.type === 'TRADING_CARD' && actingPlayer(game).type === 'human' && (
        <CardPickModal
          title={`Échangez ${interactionState.count} cartes contre ${ResourceSystem.formatResource(1, interactionState.targetGain)}`}
          subtitle="Les cartes échangées sont défaussées."
          cards={CardSystem.getHandCards(actingPlayer(game))}
          selectedIds={interactionState.selectedCards}
          onToggle={handleCardClick}
          highlightedAttribute="freeAction"
          status={`Sélectionnées : ${interactionState.selectedCards.length} / ${interactionState.count}`}
          confirmLabel="Échanger"
          canConfirm={interactionState.selectedCards.length === interactionState.count}
          onConfirm={handleConfirmTrade}
          onCancel={() => setInteractionState({ type: 'IDLE' })}
        />
      )}

      {/* Défausse pour marquer des signaux : signal en surbrillance */}
      {interactionState.type === 'DISCARDING_FOR_SIGNAL' && actingPlayer(game).type === 'human' && (
        <CardPickModal
          title={`Défaussez jusqu'à ${interactionState.count} carte${interactionState.count > 1 ? 's' : ''}`}
          subtitle="Chaque carte défaussée marque un signal dans un secteur de sa couleur."
          cards={CardSystem.getHandCards(actingPlayer(game))}
          selectedIds={interactionState.selectedCards}
          onToggle={handleCardClick}
          highlightedAttribute="scan"
          status={`Sélectionnées : ${interactionState.selectedCards.length} / ${interactionState.count}`}
          confirmLabel="Défausser"
          canConfirm
          onConfirm={handleConfirmDiscard}
        />
      )}

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

      {/* Modal pour récompense Centaurienne */}
      <CentaurienRewardModal
        game={game}
        interactionState={interactionState}
        onChoice={handleCentaurienRewardClick}
      />

      {/* Modal pour palier Exertien */}
      <ExertienCardModal
        game={game}
        interactionState={interactionState}
        onChoice={handleExertienCardChoice}
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
        showDebug={showDebug}
        setShowDebug={setShowDebug}
      />

      {/* Ecran de fin de partie */}
      {game.phase === GamePhase.FINAL_SCORING && <EndGameModal game={game} />}

      <div className="seti-root-inner">
        <div className="seti-left-panel">
          <div className={"seti-left-panel-wrapper"}>
            <PlayerBoardUI
              game={game}
              playerId={currentPlayerIdToDisplay}
              interactionState={interactionState}
              onViewPlayer={setViewedPlayerId}
              onAction={handleAction}
              highlightPlayableCards={actionFocus === 'card'}
              onCardClick={handleCardClick}
              onDiscardCardAction={handleDiscardCardAction}
              onTradeCardAction={handleTradeCardAction}
              onBuyCardAction={handleBuyCardAction}
              onDirectTradeAction={handleDirectTrade}
              onPlayCard={handlePlayCardRequest}
              onGameUpdate={(newGame) => { setGame(newGame); if (gameEngineRef.current) gameEngineRef.current.setState(newGame); }}
              onComputerSlotSelect={handleComputerColumnSelect}
              onNextPlayer={handleNextPlayer}
              onHistory={(message, sequenceId) => addToHistory(message, game.players[game.currentPlayerIndex].id, game, undefined, sequenceId)}
              onComputerBonus={handleComputerBonus}
              setActiveTooltip={setActiveTooltip}
              onSettingsClick={() => setSettingsVisible(true)}
              onMissionClick={handleMissionClick}
              onConfirmAction={(message, onConfirm) => setConfirmModalState({ visible: true, cardId: null, message, onConfirm })}
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
            onMascamiteClick={handleMascamiteClick}
            planetFocus={actionFocus === 'orbit' || actionFocus === 'land' ? actionFocus : null}
          />

          {/* Toast Notification */}
          {toast && toast.visible && (
            <div className="seti-toast" style={{ zIndex: 8000 }}>
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

            {/* Planètes */}
            <PlanetBoardUI
              game={game}
              interactionState={interactionState}
              onOrbit={handleOrbit}
              onLand={handleLand}
              setActiveTooltip={setActiveTooltip}
            />
          </div>

          {/* Historique en haut à droite */}
          <HistoryBoardUI
            historyLog={historyLog}
            game={game}
            onUndo={handleUndo}
            onUndoTurn={turnUndoPoint ? handleUndoTurn : undefined}
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