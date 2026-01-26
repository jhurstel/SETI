import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Game, ActionType, DiskName, SectorNumber, FreeActionType, GAME_CONSTANTS, SectorColor, Card, Bonus, Technology, RevenueType, ProbeState, TechnologyCategory, GOLDEN_MILESTONES, NEUTRAL_MILESTONES, CardType, LifeTraceType, Player, Mission, InteractionState } from '../core/types';
import { SolarSystemBoardUI, SolarSystemBoardUIRef } from './SolarSystemBoardUI';
import { TechnologyBoardUI } from './TechnologyBoardUI';
import { PlayerBoardUI } from './PlayerBoardUI';
import { LaunchProbeAction } from '../actions/LaunchProbeAction';
import { MoveProbeAction } from '../actions/MoveProbeAction';
import { PassAction } from '../actions/PassAction';
import { GameEngine } from '../core/Game';
import { ProbeSystem } from '../systems/ProbeSystem';
import { createRotationState, getCell, getObjectPosition, FIXED_OBJECTS, INITIAL_ROTATING_LEVEL1_OBJECTS, INITIAL_ROTATING_LEVEL2_OBJECTS, INITIAL_ROTATING_LEVEL3_OBJECTS, getAbsoluteSectorForProbe } from '../core/SolarSystemPosition';
import { DataSystem } from '../systems/DataSystem';
import { CardSystem } from '../systems/CardSystem';
import { ResourceSystem } from '../systems/ResourceSystem';
import { TechnologySystem } from '../systems/TechnologySystem';
import { SectorSystem } from '../systems/SectorSystem';
import { AIBehavior } from '../ai/AIBehavior';
import { DebugPanel } from './DebugPanel';
import { PassModal } from './modals/PassModal';
import { ConfirmModal, AlienDiscoveryModal, MediaOrMoveModal, Observation2Modal, Observation3Modal, Observation4Modal, BonusChoiceModal } from './modals/GameModals';
import { Tooltip } from './Tooltip';
import { ObjectiveBoardUI } from './ObjectiveBoardUI';
import { HistoryBoardUI, HistoryEntry, RESOURCE_CONFIG } from './HistoryBoardUI';
import { CardRowUI } from './CardRowUI';
import { AlienBoardUI } from './AlienBoardUI';
import './BoardUI.css';

interface BoardUIProps {
  game: Game;
}

// Helper pour les libellés des interactions
const getInteractionLabel = (state: InteractionState): string => {
  switch (state.type) {
    case 'ACQUIRING_CARD': return state.isFree ? "Choisir une carte" : "Acheter une carte";
    case 'RESERVING_CARD': return "Réserver une carte";
    case 'ACQUIRING_TECH': return "Choisir une technologie";
    case 'PLACING_LIFE_TRACE': return `Placer trace de vie (${state.color})`;
    case 'MOVING_PROBE': return `Déplacement gratuit (${state.count})`;
    case 'LANDING_PROBE': return `Atterrissage gratuit (${state.count})`;
    case 'CHOOSING_MEDIA_OR_MOVE': return "Choisir Média ou Déplacement";
    case 'SELECTING_SCAN_CARD': return "Choisir une carte pour le scan";
    case 'CHOOSING_OBS2_ACTION': return "Bonus Observation II";
    case 'CHOOSING_OBS3_ACTION': return "Bonus Observation III";
    case 'CHOOSING_OBS4_ACTION': return "Bonus Observation IV";
    case 'SELECTING_SCAN_SECTOR': return "Choisir un secteur à scanner";
    case 'DISCARDING_FOR_SIGNAL': return `Défausser pour signal (${state.count})`;
    case 'REMOVING_ORBITER': return "Retirer un orbiteur";
    default: return "Action bonus";
  }
};

// Helper pour formater une quantité de ressource (ex: "2 Crédits")
const formatResource = (amount: number, type: string) => {
  let key = type.toUpperCase();
  // Mapping simple pour les variantes
  if (key === 'CREDITS') key = 'CREDIT';
  if (key === 'MEDIAS') key = 'MEDIA';
  if (key === 'DATAS') key = 'DATA';
  if (key === 'CARDS' || key === 'CARTES') key = 'CARD';

  const config = RESOURCE_CONFIG[key];
  if (config) {
    const label = Math.abs(amount) > 1 ? config.plural : config.label;
    return `${amount} ${label}`;
  }
  return `${amount} ${type}`;
};

export const BoardUI: React.FC<BoardUIProps> = ({ game: initialGame }) => {
  // États pour le jeu
  const [game, setGame] = useState<Game>(initialGame);
  const gameEngineRef = useRef<GameEngine | null>(null);

  // Ref pour accéder à l'état du jeu le plus récent dans les callbacks
  const gameRef = useRef(game);
  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  // Initialiser le GameEngine
  if (!gameEngineRef.current) {
    gameEngineRef.current = new GameEngine(game);
  }

  // États pour l'UI
  const [toast, setToast] = useState<{ message: string; visible: boolean } | null>(null);
  const [historyLog, setHistoryLog] = useState<HistoryEntry[]>(() => {
    if (initialGame.gameLog && initialGame.gameLog.length > 0) {
      return [...initialGame.gameLog].map(log => ({
        id: log.id,
        message: log.message,
        playerId: log.playerId,
        timestamp: log.timestamp
      }));
    }
    return [];
  });
  const [interactionState, setInteractionState] = useState<InteractionState>({ type: 'IDLE' });
  const [pendingInteractions, setPendingInteractions] = useState<InteractionState[]>([]);
  const [viewedPlayerId, setViewedPlayerId] = useState<string | null>(null);
  const [isAlienBoardAOpen, setIsAlienBoardAOpen] = useState(false);
  const [isAlienBoardBOpen, setIsAlienBoardBOpen] = useState(false);

  // État pour la notification de découverte Alien
  const [alienDiscoveryNotification, setAlienDiscoveryNotification] = useState<{ visible: boolean; message: string } | null>(null);

  // État pour le tooltip générique
  const [activeTooltip, setActiveTooltip] = useState<{ content: React.ReactNode, rect: DOMRect, pointerEvents?: 'none' | 'auto', onMouseEnter?: () => void, onMouseLeave?: () => void } | null>(null);

  // Auto-open tech & row panel when researching or selecting card
  useEffect(() => {
    if (interactionState.type === 'PLACING_LIFE_TRACE') {
      setIsAlienBoardAOpen(true);
      setIsAlienBoardBOpen(true);
    }
  }, [interactionState.type]);

  // Effet pour afficher un message toast si l'interaction en contient un
  useEffect(() => {
    const state = interactionState as any;
    if (state.message) {
      setToast({ message: state.message, visible: true });
    }
  }, [interactionState]);

  // Effet pour la réservation initiale (Setup) pour le joueur humain
  useEffect(() => {
    if (game.currentRound === 1 && interactionState.type === 'IDLE') {
      const humanPlayer = game.players.find(p => p.type === 'human');
      if (humanPlayer) {
        const initialTotalRevenue = GAME_CONSTANTS.INITIAL_REVENUE_CREDITS + GAME_CONSTANTS.INITIAL_REVENUE_ENERGY + GAME_CONSTANTS.INITIAL_REVENUE_CARDS;
        const currentTotalRevenue = humanPlayer.revenueCredits + humanPlayer.revenueEnergy + humanPlayer.revenueCards;

        if (currentTotalRevenue === initialTotalRevenue) {
          setInteractionState({ type: 'RESERVING_CARD', count: 1, selectedCards: [] });
          setToast({ message: "Phase de préparation : Veuillez réserver une carte de votre main", visible: true });
          setViewedPlayerId(humanPlayer.id);
        }
      }
    }
  }, [game.currentRound, game.players, interactionState.type]);

  // État pour la modale de sélection de carte de fin de manche
  const [passModalState, setPassModalState] = useState<{ visible: boolean; cards: any[]; selectedCardId: string | null; cardsToKeep?: string[] }>({ visible: false, cards: [], selectedCardId: null });

  // État pour la confirmation de perte de sonde
  const [confirmModalState, setConfirmModalState] = useState<{ visible: boolean; cardId: string | null; message: string; onConfirm?: () => void }>({ visible: false, cardId: null, message: '', onConfirm: undefined });

  // Ref pour contrôler le plateau solaire
  const solarSystemRef = useRef<SolarSystemBoardUIRef>(null);

  // Ref pour accéder à l'état d'interaction actuel dans addToHistory sans dépendance
  const interactionStateRef = useRef(interactionState);
  useEffect(() => { interactionStateRef.current = interactionState; }, [interactionState]);
  const pendingInteractionsRef = useRef(pendingInteractions);
  useEffect(() => { pendingInteractionsRef.current = pendingInteractions; }, [pendingInteractions]);

  // Helper pour formater les logs de rotation
  const formatRotationLogs = (baseMessage: string, rotationLogs: string[]) => {
    if (rotationLogs.length === 0) return baseMessage;

    const details = rotationLogs.map(log => {
      return log.replace(/^Sonde de /, '').replace(/ poussée vers /, ' -> ');
    }).join(', ');

    return `${baseMessage}. Poussée(s) : ${details}`;
  };

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
        setToast({ message: "Séquence annulée", visible: true });
      } else {
        setToast({ message: "Impossible d'annuler cette séquence", visible: true });
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

      setToast({ message: "Retour en arrière effectué", visible: true });
    } else {
      setToast({ message: "Impossible d'annuler cette action", visible: true });
    }
  };

  // Effet pour masquer le toast après 3 secondes
  useEffect(() => {
    if (toast?.visible) {
      const timer = setTimeout(() => {
        setToast(prev => prev ? { ...prev, visible: false } : null);
      }, 3000);
      return () => clearTimeout(timer);
    }
    return;
  }, [toast]);

  // Effet pour traiter la file d'attente des interactions (récompenses en chaîne) et le remplissage de la rangée
  useEffect(() => {
    if (interactionState.type === 'IDLE') {
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
    if (interactionState.type === 'TRIGGER_CARD_EFFECT') {
      const { effectType, value, sequenceId } = interactionState;
      const currentPlayer = game.players[game.currentPlayerIndex];
      let updatedGame = structuredClone(game);
      let player = updatedGame.players[updatedGame.currentPlayerIndex];
      let logMessage = "";
      let toastMessage = "";

      if (effectType === 'SCORE_PER_MEDIA') {
        const pointsGained = player.mediaCoverage * value;
        if (pointsGained > 0) {
          player.score += pointsGained;
          logMessage = `gagne ${pointsGained} PV (Bonus PIXL)`;
          toastMessage = `Bonus : +${pointsGained} PV`;
        }
      }

      if (logMessage) {
        setGame(updatedGame);
        if (gameEngineRef.current) gameEngineRef.current.setState(updatedGame);
        addToHistory(logMessage, currentPlayer.id, game, undefined, sequenceId);
      }
      if (toastMessage) {
        setToast({ message: toastMessage, visible: true });
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
      const oldGame = currentGame;
      const newGame = result.updatedState;

      // PATCH: Ajouter les cartes défaussées à la pile de défausse
      const cardsToDiscard = enginePlayer.cards.filter(c => !cardsToKeep.includes(c.id));
      if (cardsToDiscard.length > 0) {
        if (!newGame.decks.discardPile) newGame.decks.discardPile = [];
        newGame.decks.discardPile.push(...cardsToDiscard);
      }

      if (newGame.isFirstToPass) {
        const currentLevel = oldGame.board.solarSystem.nextRingLevel || 1;
        setToast({ message: `Rotation du système solaire (Niveau ${currentLevel})`, visible: true });
        addToHistory(`passe son tour en premier, fait tourner le Système Solaire (Niveau ${currentLevel}) et choisit une carte à garder`, enginePlayer.id, oldGame);
      } else {
        addToHistory("passe son tour et choisit une carte à garder", enginePlayer.id, oldGame);
      }

      // Détecter la fin de manche (si le numéro de manche a augmenté)
      if (newGame.currentRound > oldGame.currentRound) {
        setToast({ message: "Fin de manche : Revenus perçus", visible: true });
        addToHistory(`--- FIN DE LA MANCHE ${oldGame.currentRound} ---`);

        // Log des revenus pour chaque joueur
        newGame.players.forEach(newPlayer => {
          const oldPlayer = oldGame.players.find(p => p.id === newPlayer.id);
          if (oldPlayer) {
            const creditsGain = newPlayer.revenueCredits;
            const energyGain = newPlayer.revenueEnergy;
            const cardsGain = newPlayer.revenueCards;
            const gains: string[] = [];
            if (creditsGain > 0) gains.push(formatResource(creditsGain, 'CREDIT'));
            if (energyGain > 0) gains.push(formatResource(energyGain, 'ENERGY'));
            if (cardsGain > 0) gains.push(formatResource(cardsGain, 'CARD'));
            if (gains.length > 0) addToHistory(`perçoit ses revenus : ${gains.join(', ')}`, newPlayer.id, newGame);
          }
        });

        // Log du changement de premier joueur
        const newFirstPlayer = newGame.players[newGame.firstPlayerIndex];
        const oldFirstPlayer = oldGame.players[oldGame.firstPlayerIndex];
        if (newFirstPlayer.id !== oldFirstPlayer.id) {
          addToHistory(`devient le Premier Joueur`, newFirstPlayer.id, newGame);
        }
      }

      setGame(newGame);
    } else {
      console.error("Erreur lors de l'action Passer:", result.error);
      setToast({ message: `Erreur lors de l'action Passer: ${result.error}`, visible: true });
    }
  }, [addToHistory]);

  // Effet pour gérer le tour du joueur Mock
  useEffect(() => {
    const currentPlayer = game.players[game.currentPlayerIndex];
    if (currentPlayer && currentPlayer.type === 'robot') {
      const timer = setTimeout(() => {
        const milestoneClaim = AIBehavior.checkAndClaimMilestone(game, currentPlayer);

        if (milestoneClaim) {
          // This logic is now handled in handleNextPlayer, so the AI doesn't need to check it before its action.
          // For now, we keep it simple.
          return; // On attend le prochain cycle pour jouer l'action suivante
        }

        const decision = AIBehavior.decideAction(game, currentPlayer);
        if (decision && decision.action === 'PASS') {
          // Logique pour rendre la décision de l'IA valide pour l'action Passer
          let cardsToKeep = decision.cardsToKeep;
          const handIds = currentPlayer.cards.map(c => c.id);

          // Validation stricte des cartes à garder (IDs valides et nombre correct)
          let areCardsValid = Array.isArray(cardsToKeep) && cardsToKeep.every(id => handIds.includes(id));

          const maxHandSize = GAME_CONSTANTS.HAND_SIZE_AFTER_PASS;
          const currentHandSize = currentPlayer.cards.length;
          const expectedKeepCount = Math.min(currentHandSize, maxHandSize);

          if (!areCardsValid || (cardsToKeep && cardsToKeep.length !== expectedKeepCount)) {
            console.warn(`AI ${currentPlayer.name} invalid cardsToKeep. Forcing default selection.`);
            cardsToKeep = currentPlayer.cards.slice(0, expectedKeepCount).map(c => c.id);
          }

          let selectedCardId = decision.selectedCardId;
          const roundDeck = game.decks.roundDecks[game.currentRound];
          const isDeckAvailable = roundDeck && roundDeck.length > 0;

          if (isDeckAvailable) {
            const isValidSelection = selectedCardId && roundDeck.some(c => c.id === selectedCardId);
            if (!isValidSelection) {
              console.warn(`AI ${currentPlayer.name} invalid selectedCardId. Picking first.`);
              selectedCardId = roundDeck[0].id;
            }
          } else {
            selectedCardId = undefined;
          }

          performPass(cardsToKeep, selectedCardId);
        }
      }, 1500);
      return () => clearTimeout(timer);
    }
    return;
  }, [game, performPass, addToHistory]);

  // Helper pour effectuer une rotation du système solaire
  const performRotation = (currentGame: Game): { updatedGame: Game, logs: string[] } => {
    let updatedGame = structuredClone(currentGame);
    const currentLevel = updatedGame.board.solarSystem.nextRingLevel || 3;
    const oldRotationState = createRotationState(
      updatedGame.board.solarSystem.rotationAngleLevel1 || 0,
      updatedGame.board.solarSystem.rotationAngleLevel2 || 0,
      updatedGame.board.solarSystem.rotationAngleLevel3 || 0
    );

    if (currentLevel === 3) {
      updatedGame.board.solarSystem.rotationAngleLevel3 = (updatedGame.board.solarSystem.rotationAngleLevel3 || 0) - 45;
      updatedGame.board.solarSystem.rotationAngleLevel2 = (updatedGame.board.solarSystem.rotationAngleLevel2 || 0) - 45;
      updatedGame.board.solarSystem.rotationAngleLevel1 = (updatedGame.board.solarSystem.rotationAngleLevel1 || 0) - 45;
    } else if (currentLevel === 2) {
      updatedGame.board.solarSystem.rotationAngleLevel2 = (updatedGame.board.solarSystem.rotationAngleLevel2 || 0) - 45;
      updatedGame.board.solarSystem.rotationAngleLevel1 = (updatedGame.board.solarSystem.rotationAngleLevel1 || 0) - 45;
    } else if (currentLevel === 1) {
      updatedGame.board.solarSystem.rotationAngleLevel1 = (updatedGame.board.solarSystem.rotationAngleLevel1 || 0) - 45;
    }

    updatedGame.board.solarSystem.nextRingLevel = currentLevel === 3 ? 1 : currentLevel + 1;

    const newRotationState = createRotationState(
      updatedGame.board.solarSystem.rotationAngleLevel1 || 0,
      updatedGame.board.solarSystem.rotationAngleLevel2 || 0,
      updatedGame.board.solarSystem.rotationAngleLevel3 || 0
    );

    const rotationResult = ProbeSystem.updateProbesAfterRotation(updatedGame, oldRotationState, newRotationState);
    updatedGame = rotationResult.game;

    const log = formatRotationLogs(`fait tourner le Système Solaire (Niveau ${currentLevel})`, rotationResult.logs);
    return { updatedGame, logs: [log] };
  }

  // Gestionnaire pour passer au joueur suivant (fin de tour simple)
  const handleNextPlayer = () => {
    if (!gameEngineRef.current) return;

    // Vérifier les paliers de score avant de passer au joueur suivant
    // Utiliser l'état du moteur pour avoir la version la plus à jour
    const currentState = gameEngineRef.current.getState();
    const currentPlayer = currentState.players[currentState.currentPlayerIndex];

    for (const m of GOLDEN_MILESTONES) {
      if (currentPlayer.score >= m && !currentPlayer.claimedGoldenMilestones.includes(m)) {
        setInteractionState({ type: 'PLACING_OBJECTIVE_MARKER', milestone: m });
        setToast({ message: `Palier de ${m} PV atteint ! Placez un marqueur sur un objectif avant de terminer le tour.`, visible: true });
        return; // Interrompre le passage au joueur suivant
      }
    }

    // Vérifier les paliers neutres (20, 30 PV)
    for (const m of NEUTRAL_MILESTONES) {
      if (currentPlayer.score >= m && !currentPlayer.claimedNeutralMilestones.includes(m)) {
        // Marquer comme réclamé pour ce joueur
        currentPlayer.claimedNeutralMilestones.push(m);

        // Vérifier s'il reste des marqueurs neutres pour ce palier
        if (currentState.neutralMilestonesAvailable && currentState.neutralMilestonesAvailable[m] > 0) {
          currentState.neutralMilestonesAvailable[m]--;

          // Placer un marqueur neutre sur le plateau Alien
          // Ordre: Rouge, Jaune, Bleu. Board 0 puis Board 1.
          const boards = currentState.board.alienBoards;
          const colors = [LifeTraceType.RED, LifeTraceType.YELLOW, LifeTraceType.BLUE];
          let placed = false;

          for (const board of boards) {
            for (const color of colors) {
              // Vérifier si l'emplacement est libre (aucune trace de cette couleur sur ce plateau)
              const isOccupied = board.lifeTraces.some(t => t.type === color);
              if (!isOccupied) {
                board.lifeTraces.push({
                  id: `trace-neutral-${Date.now()}`,
                  type: color,
                  playerId: 'neutral' // ID spécial pour neutre
                });
                placed = true;
                addToHistory(`déclenche un marqueur neutre (Palier ${m} PV) sur la trace ${color} du plateau Alien`, currentPlayer.id, currentState);
                setToast({ message: `Palier ${m} PV : Marqueur neutre placé (${color})`, visible: true });

                // Vérifier si une espèce Alien est découverte (1 marqueur de chaque couleur sur ce plateau)
                const traces = board.lifeTraces;
                const hasRed = traces.some(t => t.type === LifeTraceType.RED);
                const hasYellow = traces.some(t => t.type === LifeTraceType.YELLOW);
                const hasBlue = traces.some(t => t.type === LifeTraceType.BLUE);

                if (hasRed && hasYellow && hasBlue && !board.speciesId) {
                  const ALIEN_SPECIES = ['Centauriens', 'Exertiens', 'Oumuamua'];
                  const randomSpecies = ALIEN_SPECIES[Math.floor(Math.random() * ALIEN_SPECIES.length)];
                  board.speciesId = randomSpecies;

                  setAlienDiscoveryNotification({ visible: true, message: "Découverte d'une nouvelle espèce Alien !" });
                  setTimeout(() => setAlienDiscoveryNotification(null), 4000);
                  addToHistory(`déclenche la découverte d'une nouvelle espèce Alien !`, currentPlayer.id, currentState);
                }
                break;
              }
            }
            if (placed) break;
          }
          if (!placed) {
            addToHistory(`déclenche un marqueur neutre (Palier ${m} PV) mais aucun emplacement libre`, currentPlayer.id, currentState);
          }
        }
      }
    }

    gameEngineRef.current.nextPlayer();
    setGame(gameEngineRef.current.getState());
    setInteractionState({ type: 'IDLE' });
    setPendingInteractions([]);
    setToast({ message: "Au tour du joueur suivant", visible: true });
  };

  // Gestionnaire pour le clic sur une carte en mode défausse
  const handleCardClick = (cardId: string) => {
    if (interactionState.type === 'DISCARDING_CARD') {
      const currentCards = interactionState.selectedCards;
      if (currentCards.includes(cardId)) {
        setInteractionState({ ...interactionState, selectedCards: currentCards.filter(id => id !== cardId) });
      } else {
        // Vérifier qu'on ne sélectionne pas plus que nécessaire
        const currentPlayer = game.players[game.currentPlayerIndex];
        const cardsToKeep = currentPlayer.cards.length - (currentCards.length + 1);
        if (cardsToKeep >= 4) {
          setInteractionState({ ...interactionState, selectedCards: [...currentCards, cardId] });
        }
      }
    } else if (interactionState.type === 'TRADING_CARD') {
      const currentCards = interactionState.selectedCards;
      if (currentCards.includes(cardId)) {
        setInteractionState({ ...interactionState, selectedCards: currentCards.filter(id => id !== cardId) });
      } else if (currentCards.length < 2) {
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
    if (interactionState.type !== 'DISCARDING_CARD') return;
    const currentPlayer = game.players[game.currentPlayerIndex];
    const cardsToKeep = currentPlayer.cards.filter(c => !interactionState.selectedCards.includes(c.id)).map(c => c.id);

    // Réinitialiser l'état de défausse
    setInteractionState({ type: 'IDLE' });

    // Vérifier s'il y a un paquet de manche pour déclencher la modale
    const roundDeck = game.decks.roundDecks[game.currentRound];
    if (roundDeck && roundDeck.length > 0) {
      setPassModalState({ visible: true, cards: roundDeck, selectedCardId: null, cardsToKeep });
      // Note: performPass sera appelé après la confirmation dans la modale
    } else {
      performPass(cardsToKeep);
    }
  };

  // Gestionnaire pour confirmer la défausse pour signaux
  const handleConfirmDiscardForSignal = () => {
    if (interactionState.type !== 'DISCARDING_FOR_SIGNAL') return;
    const currentPlayer = game.players[game.currentPlayerIndex];
    const sequenceId = interactionState.sequenceId;

    const selectedCards = interactionState.selectedCards;
    if (selectedCards.length === 0) {
      // Si aucune carte n'est sélectionnée, on annule/termine l'interaction sans rien faire
      setInteractionState({ type: 'IDLE' });
      setToast({ message: "Aucune carte défaussée", visible: true });
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
    setToast({ message: "Marquez vos signaux", visible: true });
  };

  // Gestionnaire pour la réservation de carte
  const handleConfirmReservation = () => {
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
    const currentPlayer = updatedGame.players[playerIndex];

    currentPlayer.cards = [...currentPlayer.cards];

    // Traiter toutes les cartes sélectionnées
    for (const cardId of interactionState.selectedCards) {
      const cardIndex = currentPlayer.cards.findIndex(c => c.id === cardId);
      if (cardIndex === -1) continue;
      const card = currentPlayer.cards[cardIndex];

      if (!card.revenue) continue;

      // Retirer la carte
      currentPlayer.cards.splice(cardIndex, 1);

      // Appliquer le bonus
      let gainMsg = "";
      if (card.revenue === RevenueType.CREDIT) {
        currentPlayer.revenueCredits += 1;
        currentPlayer.credits += 1;
        gainMsg = formatResource(1, 'CREDIT');
      } else if (card.revenue === RevenueType.ENERGY) {
        currentPlayer.revenueEnergy += 1;
        currentPlayer.energy += 1;
        gainMsg = formatResource(1, 'ENERGY');
      } else if (card.revenue === RevenueType.CARD) {
        currentPlayer.revenueCards += 1;
        gainMsg = formatResource(1, 'CARD');
      }

      addToHistory(`réserve carte "${card.name}" et gagne ${gainMsg}`, currentPlayer.id, game, { type: 'IDLE' }, interactionState.sequenceId);

      // Si le bonus est une carte, on pioche immédiatement (attention aux effets de bord dans la boucle)
      // Pour simplifier, on applique la pioche à la fin ou on modifie updatedGame directement
      if (card.revenue === RevenueType.CARD) {
        // On utilise CardSystem sur updatedGame qui est une copie locale
        // Attention: CardSystem.drawCards retourne un nouveau Game
        // Il faut faire attention à ne pas perdre les modifs précédentes de la boucle
        // Ici c'est un peu tricky car drawCards est pur.
        // On va simplifier en ajoutant manuellement la carte si possible ou en appelant drawCards sur l'objet courant
        // Comme drawCards est complexe, on va le faire après la boucle si possible, ou accepter que updatedGame soit écrasé
        // MAIS drawCards modifie decks et players.
        // Solution simple: appeler drawCards et mettre à jour updatedGame
        const res = CardSystem.drawCards(updatedGame, currentPlayer.id, 1, 'Bonus immédiat réservation');
        // Mettre à jour les références locales
        updatedGame.decks = res.decks;
        updatedGame.players = res.players;
        // currentPlayer est une référence à l'ancien tableau de joueurs, il faut le rafraichir
        // Mais on est dans une boucle sur currentPlayer.cards...
        // Pour éviter les problèmes, on ne supporte qu'une réservation à la fois pour l'instant dans la boucle
        // Ou on accepte que la pioche se fasse sur l'état final.
      }
    }

    setGame(updatedGame);
    if (gameEngineRef.current) gameEngineRef.current.setState(updatedGame);

    // Mettre à jour l'état d'interaction
    const newCount = interactionState.count - interactionState.selectedCards.length;
    if (newCount > 0) {
      setInteractionState({ type: 'RESERVING_CARD', count: newCount, sequenceId: interactionState.sequenceId, selectedCards: [] });
      setToast({ message: `Encore ${newCount} carte(s) à réserver`, visible: true });
    } else {
      setInteractionState({ type: 'IDLE' });
      setToast({ message: "Réservation terminée", visible: true });
    }
  };

  // Helper pour effectuer un scan et potentiellement une couverture de secteur
  const performScanAndCover = (
    gameToUpdate: Game,
    playerId: string,
    sectorId: string,
    initialLogs: string[] = [],
    noData: boolean = false,
    sequenceId?: string
  ): { updatedGame: Game, historyEntries: { message: string, playerId: string }[] } => {
    let updatedGame = gameToUpdate;
    const historyEntries: { message: string, playerId: string }[] = [];
    const scanLogs: string[] = [...initialLogs];

    // 1. Scan
    const scanResult = SectorSystem.scanSector(updatedGame, playerId, sectorId, false, noData);
    updatedGame = scanResult.updatedGame;
    scanLogs.push(...scanResult.logs);

    // 2. Process scan bonuses
    if (scanResult.bonuses) {
      const bonusRes = processBonuses(scanResult.bonuses, updatedGame, playerId, 'scan', sequenceId);
      updatedGame = bonusRes.updatedGame;
      scanLogs.push(...bonusRes.logs);
      if (bonusRes.historyEntries) {
        historyEntries.push(...bonusRes.historyEntries);
      }
      if (bonusRes.newPendingInteractions.length > 0) {
        const interactionsWithSeq = bonusRes.newPendingInteractions.map(i => ({ ...i, sequenceId }));
        setPendingInteractions(prev => [...prev, ...interactionsWithSeq]);
      }
    }

    // 3. Check if covered
    if (SectorSystem.isSectorCovered(updatedGame, sectorId)) {
      scanLogs.push(`et complète le secteur !`);
      historyEntries.push({ message: scanLogs.join(', '), playerId });

      const coverageLogs: string[] = [];
      // 4. Cover sector
      const coverageResult = SectorSystem.coverSector(updatedGame, playerId, sectorId);
      updatedGame = coverageResult.updatedGame;
      coverageLogs.push(...coverageResult.logs);

      // 5. Process cover bonuses
      if (coverageResult.bonuses) {
        const bonusRes = processBonuses(coverageResult.bonuses, updatedGame, playerId, 'scan', sequenceId);
        updatedGame = bonusRes.updatedGame;
        coverageLogs.push(...bonusRes.logs);
        if (bonusRes.historyEntries) {
          historyEntries.push(...bonusRes.historyEntries);
        }
        if (bonusRes.newPendingInteractions.length > 0) {
          const interactionsWithSeq = bonusRes.newPendingInteractions.map(i => ({ ...i, sequenceId }));
          setPendingInteractions(prev => [...prev, ...interactionsWithSeq]);
        }
      }
      setToast({ message: 'Secteur couvert !', visible: true });
      if (coverageLogs.length > 0) {
        historyEntries.push({ message: coverageLogs.join(', '), playerId: coverageResult.winnerId });
      }
    } else {
      // 6. Log scan only
      historyEntries.push({ message: scanLogs.join(', '), playerId });
    }

    return { updatedGame, historyEntries };
  };

  // Helper pour effectuer une séquence de scan complète
  const performScanAction = (
    gameToUpdate: Game,
    sequenceId?: string,
    initialLogs: string[] = []
  ): { updatedGame: Game, historyEntries: { message: string, playerId: string }[] } => {
    let updatedGame = gameToUpdate;
    const historyEntries: { message: string, playerId: string }[] = [];
    const currentPlayer = updatedGame.players[updatedGame.currentPlayerIndex];
    const hasObs1 = currentPlayer.technologies.some(t => t.id.startsWith('observation-1'));
    const hasObs2 = currentPlayer.technologies.some(t => t.id.startsWith('observation-2'));
    const hasObs3 = currentPlayer.technologies.some(t => t.id.startsWith('observation-3'));
    const hasObs4 = currentPlayer.technologies.some(t => t.id.startsWith('observation-4'));

    const rotationState = createRotationState(
      game.board.solarSystem.rotationAngleLevel1 || 0,
      game.board.solarSystem.rotationAngleLevel2 || 0,
      game.board.solarSystem.rotationAngleLevel3 || 0
    );

    const newPendingInteractions: InteractionState[] = [];

    // 1. Signal depuis la Terre
    const earthPos = getObjectPosition('earth', rotationState.level1Angle, rotationState.level2Angle, rotationState.level3Angle);
    if (earthPos) {
      const earthSector = game.board.sectors[earthPos.absoluteSector - 1];
      if (hasObs1) {
        newPendingInteractions.push({ type: 'SELECTING_SCAN_SECTOR', color: earthSector.color, sequenceId, adjacents: true })
      } else {
        const res = performScanAndCover(updatedGame, currentPlayer.id, earthSector.id, [], false, sequenceId);
        updatedGame = res.updatedGame;
        historyEntries.push(...res.historyEntries);
        setToast({ message: "Scanne le secteur de la Terre", visible: true });
      }
    }

    // 2. Signal depuis la rangée de carte
    newPendingInteractions.push({ type: 'SELECTING_SCAN_CARD', sequenceId })

    // 3. Signal depuis Mercure
    if (hasObs2) {
      if (currentPlayer.mediaCoverage > 0) {
        newPendingInteractions.push({ type: 'CHOOSING_OBS2_ACTION', sequenceId });
      } else {
        historyEntries.push({ message: "ne peut pas utiliser Observation II (manque de Média)", playerId: currentPlayer.id });
      }
    }

    // 4. Signal depuis carte de la main (Obs3)
    if (hasObs3) {
      if (currentPlayer.cards.length > 0) {
        newPendingInteractions.push({ type: 'CHOOSING_OBS3_ACTION', sequenceId });
      } else {
        historyEntries.push({ message: "ne peut pas utiliser Observation III (manque de cartes en main)", playerId: currentPlayer.id });
      }
    }

    // 5. Lancer une Sonde pour 1 Energie ou 1 Déplacement
    if (hasObs4) {
      const canLaunch = currentPlayer.energy >= 1 && ProbeSystem.canLaunchProbe(updatedGame, currentPlayer.id, false).canLaunch;
      const canMove = currentPlayer.probes.some(p => p.state === ProbeState.IN_SOLAR_SYSTEM);

      if (canLaunch || canMove) {
        newPendingInteractions.push({ type: 'CHOOSING_OBS4_ACTION', sequenceId });
      } else {
        historyEntries.push({ message: "ne peut pas utiliser Observation IV (conditions non remplies)", playerId: currentPlayer.id });
      }
    }

    // Ajouter les nouvelles interactions et lancer la première
    const [first, ...rest] = newPendingInteractions;
    setInteractionState(first);
    setPendingInteractions(prev => [...rest, ...prev]);

    return { updatedGame, historyEntries };
  }

  // Gestionnaire pour le clic sur un secteur (Scan)
  const handleSectorClick = (sectorNumber: number) => {
    // Cas 1: Mode Scan actif ou bonus
    if (interactionState.type === 'SELECTING_SCAN_SECTOR') {
      const currentPlayer = game.players[game.currentPlayerIndex];
      const sector = game.board.sectors[sectorNumber - 1];

      // Validate color
      if (interactionState.color !== SectorColor.ANY && sector.color !== interactionState.color) {
        let isAdjacentAllowed = false;
        if (interactionState.adjacents) {
          const rotationState = createRotationState(
            game.board.solarSystem.rotationAngleLevel1 || 0,
            game.board.solarSystem.rotationAngleLevel2 || 0,
            game.board.solarSystem.rotationAngleLevel3 || 0
          );
          const earthPos = getObjectPosition('earth', rotationState.level1Angle, rotationState.level2Angle, rotationState.level3Angle);
          if (earthPos) {
            const diff = Math.abs(earthPos.absoluteSector - sectorNumber);
            if (diff === 1 || diff === 7 || diff === 0) isAdjacentAllowed = true;
          }
        }

        if (!isAdjacentAllowed) {
          setToast({ message: `Couleur incorrecte. Sélectionnez un secteur ${interactionState.color}`, visible: true });
          return;
        }
      }

      // Validate onlyProbes (Card 120, etc.)
      if ((interactionState as any).onlyProbes) {
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
          setToast({ message: "Vous devez sélectionner un secteur contenant une de vos sondes", visible: true });
          return;
        }
      }

      let updatedGame = structuredClone(game);
      const initialLogs: string[] = [];

      // Défausser la carte de la rangée si une carte a été utilisée pour la couleur
      let card: Card | undefined;
      card = game.decks.cardRow.find(c => c.id === interactionState.cardId);
      if (card) {
        const row = updatedGame.decks.cardRow;
        const cardIndex = row.findIndex(c => c.id === card.id);
        if (cardIndex !== -1) {
          const removedCard = row[cardIndex];
          row.splice(cardIndex, 1);
          if (!updatedGame.decks.discardPile) updatedGame.decks.discardPile = [];
          updatedGame.decks.discardPile.push(removedCard);
          initialLogs.push(`défausse carte "${removedCard.name}" (${removedCard.scanSector}) de la rangée`);
        }
      }

      // Défausser la carte de la pioche si une carte a été utilisée pour la couleur
      card = game.decks.cards.find(c => c.id === interactionState.cardId);
      if (card) {
        const deck = updatedGame.decks.cards;
        const cardIndex = deck.findIndex(c => c.id === card.id);
        if (cardIndex !== -1) {
          const removedCard = deck[cardIndex];
          deck.splice(cardIndex, 1);
          if (!updatedGame.decks.discardPile) updatedGame.decks.discardPile = [];
          updatedGame.decks.discardPile.push(removedCard);
          initialLogs.push(`défausse carte "${removedCard.name}" (${removedCard.scanSector}) de la pioche`);
        }
      }

      // Défausser la carte de la main si une carte a été utilisée pour la couleur
      card = currentPlayer.cards.find(c => c.id === interactionState.cardId);
      if (card) {
        const hand = updatedGame.players[updatedGame.currentPlayerIndex].cards;
        const cardIndex = hand.findIndex(c => c.id === card.id);
        if (cardIndex !== -1) {
          const removedCard = hand[cardIndex];
          hand.splice(cardIndex, 1);
          if (!updatedGame.decks.discardPile) updatedGame.decks.discardPile = [];
          updatedGame.decks.discardPile.push(removedCard);
          initialLogs.push(`défausse carte "${removedCard.name}" (${removedCard.scanSector}) de la main`);
        }
      }

      const res = performScanAndCover(updatedGame, currentPlayer.id, sector.id, initialLogs, interactionState.noData, interactionState.sequenceId);
      updatedGame = res.updatedGame;
      // Log immediately for interactive scan
      res.historyEntries.forEach(entry => addToHistory(entry.message, entry.playerId, game, undefined, interactionState.sequenceId));

      // Handle keepCardIfOnly (Card 120)
      if ((interactionState as any).keepCardIfOnly && (interactionState as any).cardId) {
        const updatedSector = updatedGame.board.sectors[sectorNumber - 1];
        const playerSignals = (updatedSector as any).signals?.filter((s: any) => s.playerId === currentPlayer.id) || [];

        if (playerSignals.length === 1) {
          const discardPile = updatedGame.decks.discardPile || [];
          const cardId = (interactionState as any).cardId;
          const cardIndex = discardPile.findIndex(c => c.id === cardId);

          if (cardIndex !== -1) {
            const card = discardPile[cardIndex];
            discardPile.splice(cardIndex, 1);

            const pIndex = updatedGame.players.findIndex(p => p.id === currentPlayer.id);
            if (pIndex !== -1) {
              updatedGame.players[pIndex].cards.push(card);
              addToHistory(`récupère la carte "${card.name}" en main (Condition remplie)`, currentPlayer.id, updatedGame, undefined, (interactionState as any).sequenceId);
              setToast({ message: "Carte récupérée en main !", visible: true });
            }
          }
        }
      }

      setGame(updatedGame);
      if (gameEngineRef.current) gameEngineRef.current.setState(updatedGame);

      setInteractionState({ type: 'IDLE' });
      setHasPerformedMainAction(true);
      return;
    }

    // Cas 2: Clic direct depuis Idle (Raccourci Action Scan)
    if (interactionState.type === 'IDLE' && !game.players[game.currentPlayerIndex].hasPerformedMainAction) {
      handleAction(ActionType.SCAN_SECTOR, { sectorId: `sector_${sectorNumber}` });
      return;
    }
  };

  // Gestionnaire pour les actions
  const handleAction = (actionType: ActionType, payload?: any) => {
    if (!gameEngineRef.current) return;

    // Atomicité : Si on est dans un mode interactif, on ne peut pas lancer d'autre action
    if (interactionState.type !== 'IDLE') return;

    // Si une action principale a déjà été faite, on ne peut pas en faire d'autre (sauf PASS qui est géré spécifiquement)
    if (game.players[game.currentPlayerIndex].hasPerformedMainAction && actionType !== ActionType.PASS) return;

    // Synchroniser l'état de GameEngine avec le jeu actuel (pour préserver les angles de rotation)
    gameEngineRef.current.setState(gameRef.current);
    console.log(game);

    const currentGame = gameRef.current;
    const currentPlayer = currentGame.players[currentGame.currentPlayerIndex];

    if (actionType === ActionType.LAUNCH_PROBE) {
      const action = new LaunchProbeAction(currentPlayer.id);
      const result = gameEngineRef.current.executeAction(action);
      if (result.success && result.updatedState) {
        console.log('Sonde lancée, nouvelles sondes:', result.updatedState.board.solarSystem.probes);
        setGame(result.updatedState);

        // Calculer la position de la Terre pour le log
        const earthPos = getObjectPosition(
          'earth',
          game.board.solarSystem.rotationAngleLevel1 || 0,
          game.board.solarSystem.rotationAngleLevel2 || 0,
          game.board.solarSystem.rotationAngleLevel3 || 0
        );
        const locString = earthPos ? `(${earthPos.disk}${earthPos.absoluteSector})` : '';

        const oldCredits = currentPlayer.credits;
        const newCredits = result.updatedState.players.find(p => p.id === currentPlayer.id)?.credits || 0;
        const cost = oldCredits - newCredits;
        const costText = cost === 0 ? "gagne" : `paye ${cost} crédit`;
        addToHistory(`${costText} pour <strong>Lancer une sonde</strong> depuis la Terre ${locString}`, currentPlayer.id, game);
      } else {
        console.error('Erreur lors du lancement de la sonde:', result.error);
        alert(result.error || 'Impossible de lancer la sonde');
      }
    }
    //else if (actionType === ActionType.MOVE_PROBE) {

    //}
    else if (actionType === ActionType.SCAN_SECTOR) {
      // Vérifier les resources
      if (currentPlayer.credits < GAME_CONSTANTS.SCAN_COST_CREDITS || currentPlayer.energy < GAME_CONSTANTS.SCAN_COST_ENERGY) {
        setToast({ message: "Ressources insuffisantes (1 Crédit, 2 Énergies requis)", visible: true });
        return;
      }

      // Initier la séquence
      let updatedGame = structuredClone(game);
      const updatedPlayer = updatedGame.players[updatedGame.currentPlayerIndex];
      const sequenceId = `scan-${Date.now()}`;

      // Payer le coût
      updatedPlayer.credits -= GAME_CONSTANTS.SCAN_COST_CREDITS;
      updatedPlayer.energy -= GAME_CONSTANTS.SCAN_COST_ENERGY;
      addToHistory(`paye ${GAME_CONSTANTS.SCAN_COST_CREDITS} crédit, ${GAME_CONSTANTS.SCAN_COST_ENERGY} énergie pour <strong>Scanner un secteur</strong>`, updatedPlayer.id, game, undefined, sequenceId);

      // Scanner en séquence
      const res = performScanAction(updatedGame, sequenceId);
      updatedGame = res.updatedGame;
      res.historyEntries.forEach(entry => addToHistory(entry.message, entry.playerId, game, undefined, sequenceId));
      setGame(updatedGame);
    }
    else if (actionType === ActionType.PASS) {
      // 1. Vérifier la taille de la main
      if (currentPlayer.cards.length > 4) {
        setInteractionState({ type: 'DISCARDING_CARD', selectedCards: [] });
        setToast({ message: "Veuillez défausser jusqu'à 4 cartes", visible: true });
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
    else if (actionType === ActionType.ORBIT) {
      setToast({ message: "Cliquez sur un emplacement d'orbite sur une planète", visible: true });
    }
    else if (actionType === ActionType.LAND) {
      setToast({ message: "Cliquez sur un emplacement d'atterrissage sur une planète", visible: true });
    }
    else if (actionType === ActionType.RESEARCH_TECH) {

      const currentPlayer = game.players[game.currentPlayerIndex];
      if (currentPlayer.mediaCoverage < GAME_CONSTANTS.TECH_RESEARCH_COST_MEDIA) {
        setToast({ message: "Pas assez de couverture médiatique", visible: true });
        return;
      }

      let updatedGame = structuredClone(game);
      const player = updatedGame.players[updatedGame.currentPlayerIndex];

      // Initier la séquence
      const sequenceId = `tech-${Date.now()}`;

      // Payer le coût
      player.mediaCoverage -= GAME_CONSTANTS.TECH_RESEARCH_COST_MEDIA;
      addToHistory(`paye ${GAME_CONSTANTS.TECH_RESEARCH_COST_MEDIA} médias pour <strong>Rechercher une technologie</strong>`, player.id, game, undefined, sequenceId);

      // Faire tourner le systeme solaire
      const rotationRes = performRotation(updatedGame);
      updatedGame = rotationRes.updatedGame;
      rotationRes.logs.forEach(log => addToHistory(log, player.id, game, undefined, sequenceId));

      setGame(updatedGame);
      if (gameEngineRef.current) gameEngineRef.current.setState(updatedGame);
      setInteractionState({ type: 'ACQUIRING_TECH', isBonus: false, sequenceId });
      setToast({ message: "Système pivoté. Sélectionnez une technologie.", visible: true });
    }
    else if (actionType === ActionType.ANALYZE_DATA) {
      if (!currentPlayer.dataComputer.canAnalyze) {
        setToast({ message: "Analyse impossible : Remplissez la ligne du haut", visible: true });
        return;
      }
      if (currentPlayer.energy < 1) {
        setToast({ message: "Énergie insuffisante", visible: true });
        return;
      }

      // Déclencher l'animation
      setInteractionState({ type: 'ANALYZING' });
      setToast({ message: "Analyse des données en cours...", visible: true });

      // Capture state BEFORE analysis for undo (Deep copy to ensure computer data is saved)
      const previousState = structuredClone(currentGame);

      // Délai pour l'animation avant d'appliquer les effets
      setTimeout(() => {
        const currentGame = gameRef.current;
        const updatedGame = structuredClone(currentGame);
        const player = updatedGame.players[updatedGame.currentPlayerIndex];
        const sequenceId = `analyze-${Date.now()}`;

        // Payer le coût
        player.energy -= 1;

        // Mettre à jour GameEngine
        DataSystem.clearComputer(player);

        // Finaliser la transaction
        setGame(updatedGame);
        if (gameEngineRef.current) gameEngineRef.current.setState(updatedGame);
        setInteractionState({ type: 'PLACING_LIFE_TRACE', color: LifeTraceType.BLUE, sequenceId });
        setToast({ message: "Données analysées. Placez une trace de vie bleue.", visible: true });
        addToHistory(`paye 1 énergie pour <strong>Analyser les données</strong>`, player.id, previousState, { type: 'IDLE' }, sequenceId);
      }, 1500);
    }
  };

  // Helper pour traiter les bonus (Orbite/Atterrissage)
  const processBonuses = (bonuses: any, currentGame: Game, playerId: string, sourceId?: string, sequenceId?: string, planetId?: string): { updatedGame: Game, newPendingInteractions: InteractionState[], passiveGains: string[], logs: string[], historyEntries: { message: string, playerId: string }[] } => {
    let updatedGame = currentGame;
    const newPendingInteractions: InteractionState[] = [];
    const logs: string[] = [];
    const historyEntries: { message: string, playerId: string }[] = [];
    const passiveGains: string[] = []; // For summary toast
    const launchedProbeIds: string[] = [];

    const handleSpecificScan = (count: number, namePart: string) => {
      for (let i = 0; i < count; i++) {
        const sector = updatedGame.board.sectors.find(s => s.name.includes(namePart));
        if (sector) {
          const scanResult = SectorSystem.scanSector(updatedGame, playerId, sector.id, false, bonuses.noData);
          updatedGame = scanResult.updatedGame;
          logs.push(...scanResult.logs);

          if (scanResult.bonuses) {
            const sub = processBonuses(scanResult.bonuses, updatedGame, playerId, 'scan', sequenceId);
            updatedGame = sub.updatedGame;
            logs.push(...sub.logs);
            passiveGains.push(...sub.passiveGains);
            newPendingInteractions.push(...sub.newPendingInteractions);
            historyEntries.push(...sub.historyEntries);
          }

          if (SectorSystem.isSectorCovered(updatedGame, sector.id)) {
            const coverResult = SectorSystem.coverSector(updatedGame, playerId, sector.id);
            updatedGame = coverResult.updatedGame;
            logs.push(...coverResult.logs);
            if (coverResult.bonuses) {
              const sub = processBonuses(coverResult.bonuses, updatedGame, playerId, 'cover', sequenceId);
              updatedGame = sub.updatedGame;
              logs.push(...sub.logs);
              passiveGains.push(...sub.passiveGains);
              newPendingInteractions.push(...sub.newPendingInteractions);
              historyEntries.push(...sub.historyEntries);
            }
          }
        }
      }
    };

    if (!bonuses) return { updatedGame, newPendingInteractions, logs, passiveGains, historyEntries };

    // Gains passifs pour le résumé
    if (bonuses.media) { const txt = formatResource(bonuses.media, 'MEDIA'); passiveGains.push(txt); }
    if (bonuses.credits) { const txt = formatResource(bonuses.credits, 'CREDIT'); passiveGains.push(txt); }
    if (bonuses.energy) { const txt = formatResource(bonuses.energy, 'ENERGY'); passiveGains.push(txt); }
    if (bonuses.data) { const txt = formatResource(bonuses.data, 'DATA'); passiveGains.push(txt); }
    if (bonuses.pv) { const txt = formatResource(bonuses.pv, 'PV'); passiveGains.push(txt); }
    const gainsText = passiveGains.length > 0 ? `${passiveGains.join(', ')}` : '';
    if (gainsText) logs.push(`gagne ${gainsText}`);

    // Effets immédiats
    if (bonuses.rotation) {
      for (let i = 0; i < bonuses.rotation; i++) {
        const rotationResult = performRotation(updatedGame);
        updatedGame = rotationResult.updatedGame;
        logs.push(...rotationResult.logs);
      }
    }
    if (bonuses.card) {
      updatedGame = CardSystem.drawCards(updatedGame, playerId, bonuses.card, 'Bonus de carte');
      const txt = formatResource(bonuses.card, 'CARD');
      passiveGains.push(txt);
      logs.push(`pioche ${txt}`);
    }
    if (bonuses.probe) {
      const ignoreLimit = bonuses.ignoreProbeLimit || false;
      for (let i = 0; i < bonuses.probe; i++) {
        const result = ProbeSystem.launchProbe(updatedGame, playerId, true, ignoreLimit); // free launch
        if (result.probeId) {
          updatedGame = result.updatedGame;
          launchedProbeIds.push(result.probeId);
          setToast({ message: "Lance une sonde gratuitement", visible: true });
          logs.push(`lance une sonde gratuitement`);
        } else {
          logs.push(`ne peut pas lancer de sonde (limite atteinte)`);
        }
      }
      const txt = `${bonuses.probe} Sonde${bonuses.probe > 1 ? 's' : ''}`;
      passiveGains.push(txt);
    }
    if (bonuses.earthscan) {
      for (let i = 0; i < bonuses.earthscan; i++) {
        // La technologie Observation I ne s'applique pas dans ce cas-là mais uniquement lors de l'action Scanner un secteur.
        // Ce bonus est donc immédiat.
        const rotationState = createRotationState(
          game.board.solarSystem.rotationAngleLevel1 || 0,
          game.board.solarSystem.rotationAngleLevel2 || 0,
          game.board.solarSystem.rotationAngleLevel3 || 0
        );
        const earthPos = getObjectPosition('earth', rotationState.level1Angle, rotationState.level2Angle, rotationState.level3Angle);
        if (earthPos) {
          const earthSector = game.board.sectors[earthPos.absoluteSector - 1];
          if (earthSector) {
            const result = SectorSystem.scanSector(updatedGame, playerId, earthSector.id, false, bonuses.noData);
            updatedGame = result.updatedGame;
            setToast({ message: "Scanne le secteur de la Terre", visible: true });
            logs.push(result.logs.join(', '));
          }
        }
      }
    }
    if (bonuses.vegascan) handleSpecificScan(bonuses.vegascan, 'Vega');
    if (bonuses.keplerscan) handleSpecificScan(bonuses.keplerscan, 'Kepler');
    if (bonuses.barnardscan) handleSpecificScan(bonuses.barnardscan, 'Barnard');
    if (bonuses.procyonscan) handleSpecificScan(bonuses.procyonscan, 'Procyon');
    if (bonuses.planetscan && planetId) {
      for (let i = 0; i < bonuses.planetscan; i++) {
        const rotationState = createRotationState(
          game.board.solarSystem.rotationAngleLevel1 || 0,
          game.board.solarSystem.rotationAngleLevel2 || 0,
          game.board.solarSystem.rotationAngleLevel3 || 0
        );
        const planetPos = getObjectPosition(planetId, rotationState.level1Angle, rotationState.level2Angle, rotationState.level3Angle);
        if (planetPos) {
          const planetSector = game.board.sectors[planetPos.absoluteSector - 1];
          if (planetSector) {
            const result = SectorSystem.scanSector(updatedGame, playerId, planetSector.id, false, bonuses.noData);
            updatedGame = result.updatedGame;
            setToast({ message: `Scanne le secteur de ${planetSector.name}`, visible: true });
            logs.push(result.logs.join(', '));
          }
        }
      }
    }

    // Effets interactifs (File d'attente)
    if (bonuses.anycard) {
      newPendingInteractions.push({ type: 'ACQUIRING_CARD', count: bonuses.anycard, isFree: true });
    }
    if (bonuses.revenue) {
      const player = updatedGame.players.find(p => p.id === playerId);
      if (player) {
        const count = Math.min(bonuses.revenue, player.cards.length);
        if (count > 0) newPendingInteractions.push({ type: 'RESERVING_CARD', count: count, selectedCards: [] });
      }
    }
    if (bonuses.technology) {
      for (let i = 0; i < bonuses.technology.amount; i++) {
        newPendingInteractions.push({ type: 'ACQUIRING_TECH', isBonus: true, category: bonuses.technology.color, sharedOnly: bonuses.technology.sharedOnly, noTileBonus: bonuses.technology.noTileBonus });
      }
    }
    if (bonuses.anytechnology) {
      for (let i = 0; i < bonuses.anytechnology; i++) {
        newPendingInteractions.push({ type: 'ACQUIRING_TECH', isBonus: true });
      }
    }
    if (bonuses.movements) {
      newPendingInteractions.push({ type: 'MOVING_PROBE', count: bonuses.movements, autoSelectProbeId: launchedProbeIds.length > 0 ? launchedProbeIds[launchedProbeIds.length - 1] : undefined });
      logs.push(`obtient ${bonuses.movements} déplacement${bonuses.movements > 1 ? 's' : ''} gratuit${bonuses.movements > 1 ? 's' : ''}`);
    }
    if (bonuses.landing) {
      newPendingInteractions.push({ type: 'LANDING_PROBE', count: bonuses.landing, source: sourceId });
    }
    if (bonuses.scorePerMedia) {
      newPendingInteractions.push({ type: 'TRIGGER_CARD_EFFECT', effectType: 'SCORE_PER_MEDIA', value: bonuses.scorePerMedia });
    }
    if (bonuses.yellowlifetrace) {
      for (let i = 0; i < bonuses.yellowlifetrace; i++) {
        newPendingInteractions.push({ type: 'PLACING_LIFE_TRACE', color: LifeTraceType.YELLOW });
      }
    }
    if (bonuses.redlifetrace) {
      for (let i = 0; i < bonuses.redlifetrace; i++) {
        newPendingInteractions.push({ type: 'PLACING_LIFE_TRACE', color: LifeTraceType.RED });
      }
    }
    if (bonuses.bluelifetrace) {
      for (let i = 0; i < bonuses.bluelifetrace; i++) {
        newPendingInteractions.push({ type: 'PLACING_LIFE_TRACE', color: LifeTraceType.BLUE });
      }
    }
    if (bonuses.deckscan) {
      // Révéler et défausser les cartes du dessus du paquet pour déterminer la couleur
      for (let i = 0; i < bonuses.deckscan; i++) {
        if (updatedGame.decks.cards.length > i) {
          const card = updatedGame.decks.cards[i];
          if (card) {
            newPendingInteractions.push({
              type: 'SELECTING_SCAN_SECTOR',
              color: card.scanSector,
              cardId: card.id,
              message: `Marquez un signal dans un secteur ${card.scanSector}`
            });
          }
        }
      }
    }
    if (bonuses.rowscan) {
      for (let i = 0; i < bonuses.rowscan; i++) {
        newPendingInteractions.push({ type: 'SELECTING_SCAN_CARD' })
      }
    }
    if (bonuses.redscan) {
      for (let i = 0; i < bonuses.redscan; i++) {
        newPendingInteractions.push({ type: 'SELECTING_SCAN_SECTOR', color: SectorColor.RED, noData: bonuses.noData })
      }
    }
    if (bonuses.yellowscan) {
      for (let i = 0; i < bonuses.yellowscan; i++) {
        newPendingInteractions.push({ type: 'SELECTING_SCAN_SECTOR', color: SectorColor.YELLOW, noData: bonuses.noData })
      }
    }
    if (bonuses.bluescan) {
      for (let i = 0; i < bonuses.bluescan; i++) {
        newPendingInteractions.push({ type: 'SELECTING_SCAN_SECTOR', color: SectorColor.BLUE, noData: bonuses.noData })
      }
    }
    if (bonuses.blackscan) {
      for (let i = 0; i < bonuses.blackscan; i++) {
        newPendingInteractions.push({ type: 'SELECTING_SCAN_SECTOR', color: SectorColor.BLACK, noData: bonuses.noData })
      }
    }
    if (bonuses.anyscan) {
      for (let i = 0; i < bonuses.anyscan; i++) {
        newPendingInteractions.push({ type: 'SELECTING_SCAN_SECTOR', color: SectorColor.ANY, noData: bonuses.noData })
      }
    }
    if (bonuses.probescan) {
      for (let i = 0; i < bonuses.probescan; i++) {
        const currentPlayer = updatedGame.players.find(p => p.id === playerId);
        const probesInSystem = currentPlayer ? currentPlayer.probes.filter(p => p.state === ProbeState.IN_SOLAR_SYSTEM && p.solarPosition) : [];

        if (probesInSystem.length === 1) {
          const probe = probesInSystem[0];
          const rotationState = createRotationState(
            updatedGame.board.solarSystem.rotationAngleLevel1 || 0,
            updatedGame.board.solarSystem.rotationAngleLevel2 || 0,
            updatedGame.board.solarSystem.rotationAngleLevel3 || 0
          );
          const absoluteSector = getAbsoluteSectorForProbe(probe.solarPosition!, rotationState);

          if (absoluteSector) {
            const sectorId = `sector_${absoluteSector}`;

            const scanResult = SectorSystem.scanSector(updatedGame, playerId, sectorId, false, bonuses.noData);
            updatedGame = scanResult.updatedGame;
            logs.push(...scanResult.logs);

            if (scanResult.bonuses) {
              const sub = processBonuses(scanResult.bonuses, updatedGame, playerId, 'scan', sequenceId);
              updatedGame = sub.updatedGame;
              logs.push(...sub.logs);
              passiveGains.push(...sub.passiveGains);
              newPendingInteractions.push(...sub.newPendingInteractions);
              historyEntries.push(...sub.historyEntries);
            }

            if (SectorSystem.isSectorCovered(updatedGame, sectorId)) {
              const coverResult = SectorSystem.coverSector(updatedGame, playerId, sectorId);
              updatedGame = coverResult.updatedGame;
              logs.push(...coverResult.logs);
              if (coverResult.bonuses) {
                const sub = processBonuses(coverResult.bonuses, updatedGame, playerId, 'cover', sequenceId);
                updatedGame = sub.updatedGame;
                logs.push(...sub.logs);
                passiveGains.push(...sub.passiveGains);
                newPendingInteractions.push(...sub.newPendingInteractions);
                historyEntries.push(...sub.historyEntries);
              }
            }

            if (bonuses.keepCardIfOnly && sourceId) {
              const updatedSector = updatedGame.board.sectors[absoluteSector - 1];
              const playerSignals = (updatedSector as any).signals?.filter((s: any) => s.playerId === playerId) || [];

              if (playerSignals.length === 1) {
                const discardPile = updatedGame.decks.discardPile || [];
                const cardIndex = discardPile.findIndex(c => c.id === sourceId);

                if (cardIndex !== -1) {
                  const card = discardPile[cardIndex];
                  discardPile.splice(cardIndex, 1);

                  const pIndex = updatedGame.players.findIndex(p => p.id === playerId);
                  if (pIndex !== -1) {
                    updatedGame.players[pIndex].cards.push(card);
                    logs.push(`récupère la carte "${card.name}" en main`);
                    passiveGains.push("Carte récupérée");
                  }
                }
              }
            }
          }
        } else {
          newPendingInteractions.push({ type: 'SELECTING_SCAN_SECTOR', color: SectorColor.ANY, noData: bonuses.noData, onlyProbes: true, keepCardIfOnly: bonuses.keepCardIfOnly, cardId: sourceId });
        }
      }
    }
    if (bonuses.scanAction) {
      for (let i = 0; i < bonuses.scanAction; i++) {
        const res = performScanAction(updatedGame, sequenceId);
        updatedGame = res.updatedGame;
        historyEntries.push(...res.historyEntries);
      }
    }

    // Effets interactifs (File d'attente)
    if (bonuses.revealAndTriggerFreeAction) {
      newPendingInteractions.push({ type: 'ACQUIRING_CARD', count: 1, isFree: true, triggerFreeAction: true });
    }
    if (bonuses.choiceMediaOrMove) {
      newPendingInteractions.push({ type: 'CHOOSING_MEDIA_OR_MOVE' });
    }
    if (bonuses.atmosphericEntry) {
      newPendingInteractions.push({ type: 'REMOVING_ORBITER' });
    }
    if (bonuses.gainSignalFromHand) {
      newPendingInteractions.push({ type: 'DISCARDING_FOR_SIGNAL', count: bonuses.gainSignalFromHand, selectedCards: [] });
    }

    return { updatedGame, newPendingInteractions, logs, passiveGains, historyEntries };
  };

  // Gestionnaire pour placer une trace de vie
  const handlePlaceLifeTrace = (boardIndex: number, color: LifeTraceType) => {
    if (interactionState.type !== 'PLACING_LIFE_TRACE') return;

    if (interactionState.color !== color) {
      setToast({ message: `Vous devez placer une trace de vie ${interactionState.color}`, visible: true });
      return;
    }

    const currentPlayer = game.players[game.currentPlayerIndex];
    let updatedGame = structuredClone(game);
    const board = updatedGame.board.alienBoards[boardIndex];

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

    const { updatedGame: gameAfterBonus, newPendingInteractions, passiveGains, logs, historyEntries } = processBonuses(bonus, updatedGame, currentPlayer.id);

    setGame(gameAfterBonus);
    if (gameEngineRef.current) gameEngineRef.current.setState(gameAfterBonus);

    const sequenceId = interactionState.sequenceId;
    let message = `place une trace de vie ${color} sur le plateau Alien ${boardIndex + 1}`;
    if (logs.length > 0) {
      message += ` et ${logs.join(', ')}`;
    }
    message += discoveryLog;
    addToHistory(message, currentPlayer.id, game, undefined, sequenceId);
    historyEntries.forEach(entry => addToHistory(entry.message, entry.playerId, gameAfterBonus, undefined, sequenceId));

    if (passiveGains.length > 0) {
      setToast({ message: `Bonus : ${passiveGains.join(', ')}`, visible: true });
    }

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
    if (interactionState.type !== 'CHOOSING_OBS2_ACTION') return;

    const currentPlayer = game.players[game.currentPlayerIndex];
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
        const res = performScanAndCover(updatedGame, player.id, mercurySector.id, [], false, sequenceId);
        updatedGame = res.updatedGame;
        res.historyEntries.forEach(entry => addToHistory(entry.message, entry.playerId, updatedGame, undefined, sequenceId));
        setToast({ message: "Scanne le secteur de Mercure", visible: true });
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
      setToast({ message: "Sélectionnez une carte à défausser", visible: true });
    } else {
      // Passer à l'interaction suivante (ou IDLE)
      setInteractionState({ type: 'IDLE' });
    }
  };

  // Gestionnaire pour le choix Observation 4
  const handleObs4Choice = (choice: 'PROBE' | 'MOVE') => {
    if (interactionState.type !== 'CHOOSING_OBS4_ACTION') return;

    const currentPlayer = game.players[game.currentPlayerIndex];
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
        addToHistory(`lance une sonde (Observation IV)`, player.id, updatedGame, undefined, sequenceId);
        setToast({ message: "Sonde lancée", visible: true });
      } else {
        // Should not happen if button is disabled correctly, but safety net
        player.energy += 1; // Refund
        setToast({ message: "Impossible de lancer une sonde", visible: true });
        return;
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
    if (interactionState.type !== 'CHOOSING_MEDIA_OR_MOVE') return;

    const currentPlayer = game.players[game.currentPlayerIndex];
    let updatedGame = { ...game };
    const sequenceId = interactionState.sequenceId;
    const remainingMoves = interactionState.remainingMoves || 0;

    if (choice === 'MEDIA') {
      const res = ResourceSystem.updateMedia(updatedGame, currentPlayer.id, 1);
      updatedGame = res.updatedGame;
      setToast({ message: "Gain : 1 Média", visible: true });
      addToHistory(`choisit de gagner ${formatResource(1, 'MEDIA')}`, currentPlayer.id, game, { type: 'IDLE' }, sequenceId);
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
      setToast({ message: "Sélectionnez une sonde à déplacer", visible: true });
      addToHistory(`choisit un déplacement gratuit`, currentPlayer.id, game, { type: 'IDLE' }, sequenceId);
    }
  };

  // Helper générique pour les interactions avec les planètes (Orbite/Atterrissage)
  const handlePlanetInteraction = (
    planetId: string,
    actionFn: (game: Game, playerId: string, probeId: string, targetId: string) => { updatedGame: Game, bonuses?: any },
    historyMessagePrefix: string,
    successMessage: string
  ): boolean => {
    if (interactionState.type !== 'IDLE' && interactionState.type !== 'LANDING_PROBE') return false;
    if (game.players[game.currentPlayerIndex].hasPerformedMainAction && interactionState.type !== 'LANDING_PROBE') {
      setToast({ message: "Action principale déjà effectuée", visible: true });
      return false;
    }

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

      const { updatedGame, newPendingInteractions, passiveGains, logs: allBonusLogs, historyEntries } = processBonuses(result.bonuses, result.updatedGame, currentPlayer.id, (interactionState as any).source, sequenceId, planetId);

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
        if (passiveGains.length > 0) {
          setToast({ message: `Gains : ${passiveGains.join(', ')}`, visible: true });
        }
        setInteractionState({ ...newPendingInteractions[0], sequenceId });
        interactionTriggered = true;
      } else if (passiveGains.length > 0) {
        setToast({ message: `Gains : ${passiveGains.join(', ')}`, visible: true });
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

  // Helper pour vérifier si le joueur peut acquérir une technologie
  const canAcquireTech = (game: Game, playerId: string, category?: TechnologyCategory): boolean => {
    const player = game.players.find(p => p.id === playerId);
    if (!player) return false;

    const techBoard = game.board.technologyBoard;
    if (!techBoard || !techBoard.categorySlots) return false;

    for (const slot of techBoard.categorySlots) {
      if (category && slot.category !== category) continue;

      // Group by baseId
      const stacks = new Map<string, Technology[]>();
      slot.technologies.forEach(tech => {
        const lastDashIndex = tech.id.lastIndexOf('-');
        const baseId = tech.id.substring(0, lastDashIndex);
        if (!stacks.has(baseId)) stacks.set(baseId, []);
        stacks.get(baseId)!.push(tech);
      });

      for (const [baseId, stack] of stacks) {
        if (stack.length > 0) {
          // Check if player has this tech
          const hasTech = player.technologies.some(t => {
            const tLastDash = t.id.lastIndexOf('-');
            return t.id.substring(0, tLastDash) === baseId;
          });

          if (!hasTech) return true;
        }
      }
    }
    return false;
  };

  // Gestionnaire pour la mise en orbite via la hover card
  const handleOrbit = (planetId: string, slotIndex?: number) => {
    // Gestion de la carte 15 : Retirer un orbiteur
    if (interactionState.type === 'REMOVING_ORBITER') {
      const currentPlayer = game.players[game.currentPlayerIndex];
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

      if (orbiterIndex === -1) {
        setToast({ message: "Vous n'avez pas d'orbiteur sur cette planète", visible: true });
        return;
      }

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
      setToast({ message: "Orbiteur retiré. Bonus gagnés !", visible: true });
      return;
    }

    const executeOrbit = () => {
      handlePlanetInteraction(
        planetId,
        (g, pid, prid, targetId) => ProbeSystem.orbitProbe(g, pid, prid, targetId), // Orbit is not free via LANDING_PROBE
        "paye 1 Energie et 1 Crédit pour <strong>Mettre en orbite</strong> une sonde autour de",
        "Sonde mise en orbite"
      );
    };

    const currentPlayer = game.players[game.currentPlayerIndex];
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

        if ((bonus.technology || bonus.anytechnology) && !canAcquireTech(game, currentPlayer.id, bonus.technology?.color)) {
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

    executeOrbit();
  };

  // Gestionnaire pour l'atterrissage via la hover card
  const handleLand = (planetId: string, slotIndex?: number) => {
    const executeLand = () => {
      // Vérifier si on est en mode atterrissage gratuit
      if (interactionState.type === 'LANDING_PROBE') {
        const interactionTriggered = handlePlanetInteraction(
          planetId,
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

      handlePlanetInteraction(
        planetId,
        // On passe planetId comme targetId pour supporter l'atterrissage sur les satellites
        (g, pid, prid, targetId) => ProbeSystem.landProbe(g, pid, prid, targetId, false, slotIndex),
        "fait atterrir une sonde sur",
        "Atterrissage réussi"
      );
    };

    const currentPlayer = game.players[game.currentPlayerIndex];
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

        if ((bonus.technology || bonus.anytechnology) && !canAcquireTech(game, currentPlayer.id, bonus.technology?.color)) {
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

    executeLand();
  };

  // Gestionnaire pour le déplacement des sondes
  const handleProbeMove = async (probeId: string, path: string[]) => {
    if (!gameEngineRef.current) return;

    // Synchroniser l'état de GameEngine avec le jeu actuel
    gameEngineRef.current.setState(gameRef.current);

    let currentGame = gameRef.current; // Utiliser la ref pour avoir l'état le plus frais

    setToast({ message: "Déplacement...", visible: true });

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

        // Vérifier le gain de média pour afficher un toast (pour cette étape)
        const updatedPlayer = updatedGame.players.find(p => p.id === currentPlayerId);
        const oldPlayer = currentGame.players.find(p => p.id === currentPlayerId);

        let energySpent = 0;
        if (updatedPlayer && oldPlayer) {
          // Log du coût (approximatif car calculé dans l'action)
          const object = getCell(disk, sector, createRotationState(updatedGame.board.solarSystem.rotationAngleLevel1 || 0, updatedGame.board.solarSystem.rotationAngleLevel2 || 0, updatedGame.board.solarSystem.rotationAngleLevel3 || 0));
          const objectName = object?.hasComet ? "Comète" : object?.hasAsteroid ? "Astéroïdes" : object?.hasPlanet ? object?.planetName : "une case vide";
          energySpent = oldPlayer.energy - updatedPlayer.energy;
          const mediaGain = updatedPlayer.mediaCoverage - oldPlayer.mediaCoverage;

          // Détecter les buffs consommés (ex: Survol de Mars)
          const consumedBuffs = oldPlayer.activeBuffs.filter(oldBuff =>
            !updatedPlayer.activeBuffs.some(newBuff =>
              newBuff.type === oldBuff.type &&
              newBuff.target === oldBuff.target &&
              newBuff.value === oldBuff.value
            )
          );

          let message = "";
          if (energySpent > 0) {
            message = `déplace une sonde vers ${disk}${sector} pour ${energySpent} énergie`;
          } else {
            message = `déplace une sonde vers ${disk}${sector} gratuitement`;
          }

          if (mediaGain > 0) {
            setToast({ message: `Gain de média : +${mediaGain}`, visible: true });
            message += ` et gagne ${mediaGain} média (${objectName})`;
          }

          // Log des gains de score via buffs
          consumedBuffs.forEach(buff => {
            if (buff.type === 'VISIT_BONUS') {
              const gainText = formatResource(buff.value, 'PV');
              message += ` et gagne ${gainText} (${buff.source || 'Bonus'})`;
              setToast({ message: `Bonus : +${buff.value} PV (${buff.source})`, visible: true });
            } else if (buff.type === 'VISIT_ASTEROID') {
              const gainText = formatResource(buff.value, 'DATA');
              message += ` et gagne ${gainText} (${buff.source || 'Bonus'})`;
              setToast({ message: `Bonus : +${buff.value} Donnée (${buff.source})`, visible: true });
            } else if (buff.type === 'VISIT_COMET') {
              const gainText = formatResource(buff.value, 'PV');
              message += ` et gagne ${gainText} (${buff.source || 'Bonus'})`;
              setToast({ message: `Bonus : +${buff.value} PV (${buff.source})`, visible: true });
            } else if (buff.type === 'SAME_DISK_MOVE') {
              const gains: string[] = [];
              if (buff.value.pv) gains.push(formatResource(buff.value.pv, 'PV'));
              if (buff.value.media) gains.push(formatResource(buff.value.media, 'MEDIA'));
              message += ` et gagne ${gains.join(', ')} (${buff.source || 'Bonus'})`;
              setToast({ message: `Bonus : +${gains.join(', ')} (${buff.source})`, visible: true });
            }
          });

          // Détecter les buffs persistants déclenchés (ex: Carte 25 - Voile Solaire / VISIT_UNIQUE)
          const newVisits = updatedPlayer.visitedPlanetsThisTurn.filter(p => !oldPlayer.visitedPlanetsThisTurn.includes(p));
          newVisits.forEach(planetId => {
            const uniqueBuffs = oldPlayer.activeBuffs.filter(b => b.type === 'VISIT_UNIQUE');
            planetId;
            uniqueBuffs.forEach(buff => {
              const gainText = formatResource(buff.value, 'PV');
              message += ` et gagne ${gainText} (${buff.source || 'Bonus'})`;
              setToast({ message: `Bonus : +${buff.value} PV (${buff.source})`, visible: true });
            });
          });

          // Détection Card 19 (Assistance Gravitationnelle)
          const targetCell = getCell(disk, sector, createRotationState(updatedGame.board.solarSystem.rotationAngleLevel1 || 0, updatedGame.board.solarSystem.rotationAngleLevel2 || 0, updatedGame.board.solarSystem.rotationAngleLevel3 || 0));
          const hasChoiceBuff = oldPlayer.activeBuffs.some(b => b.type === 'CHOICE_MEDIA_OR_MOVE');

          if (hasChoiceBuff && targetCell?.hasPlanet && targetCell.planetId !== 'earth') {
            // Calculer les mouvements restants après ce pas (si gratuit)
            const remaining = useFree ? freeMovements - 1 : freeMovements;
            setInteractionState({
              type: 'CHOOSING_MEDIA_OR_MOVE',
              sequenceId: `move-${Date.now()}`,
              remainingMoves: remaining
            });
            interruptedForChoice = true;
            if (i < path.length - 1) setToast({ message: "Déplacement interrompu pour choix bonus", visible: true });
          }

          addToHistory(message, currentPlayerId, stateBeforeMove);
        }

        currentGame = updatedGame;
        gameRef.current = currentGame; // Mettre à jour la ref locale pour garantir la fraîcheur
        setGame(currentGame);
        if (gameEngineRef.current) gameEngineRef.current.setState(currentGame); // Mettre à jour l'état du moteur pour la prochaine étape du mouvement

        // Mettre à jour le compteur de mouvements gratuits
        if (useFree) {
          // On ne décrémente que si le mouvement a réellement été gratuit (pas de dépense d'énergie)
          if (energySpent === 0) {
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
        setToast({ message: `Encore ${freeMovements} déplacement(s) gratuit(s)`, visible: true });
      } else {
        setInteractionState({ type: 'IDLE' });
      }
    }
  };

  // Gestionnaire pour jouer une carte (payer son coût en crédits)
  const handlePlayCardRequest = (cardId: string) => {
    if (interactionState.type !== 'IDLE') return;
    if (game.players[game.currentPlayerIndex].hasPerformedMainAction) {
      setToast({ message: "Action principale déjà effectuée", visible: true });
      return;
    };
    const currentGame = gameRef.current;
    const currentPlayer = currentGame.players[currentGame.currentPlayerIndex];
    const card = currentPlayer.cards.find(c => c.id === cardId);

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
        if (!canAcquireTech(currentGame, currentPlayer.id, catToCheck)) {
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
    const currentGame = gameRef.current;
    const currentPlayer = currentGame.players[currentGame.currentPlayerIndex];

    const result = CardSystem.playCard(currentGame, currentPlayer.id, cardId);
    if (result.error) {
      setToast({ message: result.error, visible: true });
      return;
    }

    const sequenceId = `seq-${Date.now()}`;

    console.log(result);
    const { updatedGame: gameAfterBonuses, newPendingInteractions, passiveGains, logs: allBonusLogs, historyEntries: bonusHistoryEntries } = processBonuses(result.bonuses, result.updatedGame, currentPlayer.id, cardId, sequenceId);
    console.log(newPendingInteractions);

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
            requirements: [], // TODO: Parser les prérequis depuis la carte
            progress: { current: 0, target: 1 },
            completed: false
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

    const gainsText = passiveGains.length > 0 ? ` (Gains: ${passiveGains.join(', ')})` : '';
    //setToast({ message: `Carte jouée: ${card.name}${gainsText}`, visible: true });

    // Construction du message d'historique unifié
    let message = `paye ${card.cost} crédit${card.cost > 1 ? 's' : ''} pour jouer carte "${card.name}"`;

    if (result.bonuses && result.bonuses.subventionDetails) {
      const { cardName, bonusText } = result.bonuses.subventionDetails;
      message += ` et pioche la carte "${cardName}" pour gagner ${bonusText}`;

      if (bonusText === "1 Donnée") {
        const idx = passiveGains.indexOf(formatResource(1, 'DATA'));
        if (idx > -1) passiveGains.splice(idx, 1);
      } else if (bonusText === "1 Média") {
        const idx = passiveGains.indexOf(formatResource(1, 'MEDIA'));
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
    let updatedGame = game;
    const currentPlayer = updatedGame.players[updatedGame.currentPlayerIndex];
    const card = currentPlayer.cards.find(c => c.id === cardId);
    if (!card) return;

    // PATCH: Ajouter à la pile de défausse
    if (card) {
      if (!updatedGame.decks.discardPile) updatedGame.decks.discardPile = [];
      updatedGame.decks.discardPile.push(card);
    }

    // Appliquer l'effet de l'action gratuite
    if (card.freeAction === FreeActionType.MEDIA) {
      const res = ResourceSystem.updateMedia(updatedGame, currentPlayer.id, 1);
      updatedGame = res.updatedGame;
      setToast({ message: "Action gratuite : +1 Média", visible: true });
      addToHistory(`défausse carte "${card.name}" et gagne ${formatResource(1, 'MEDIA')}`, currentPlayer.id, game);
    } else if (card.freeAction === FreeActionType.DATA) {
      const res = ResourceSystem.updateData(updatedGame, currentPlayer.id, 1);
      updatedGame = res.updatedGame;
      setToast({ message: "Action gratuite : +1 Data", visible: true });
      addToHistory(`défausse carte "${card.name}" et gagne ${formatResource(1, 'DATA')}`, currentPlayer.id, game);
    } else if (card.freeAction === FreeActionType.MOVEMENT) {
      const probes = currentPlayer.probes.filter(p => p.state === ProbeState.IN_SOLAR_SYSTEM);
      const autoSelectProbeId = probes.length === 1 ? probes[0].id : undefined;
      setInteractionState({ type: 'MOVING_PROBE', count: 1, autoSelectProbeId });
      setToast({ message: "Sélectionnez une sonde à déplacer", visible: true });
      addToHistory(`défausse carte "${card.name}" et gagne 1 déplacement gratuit`, currentPlayer.id, game);
    }

    // Défausser la carte
    const playerToUpdate = updatedGame.players.find(p => p.id === currentPlayer.id);
    if (playerToUpdate) {
      const newPlayer = CardSystem.discardCard(playerToUpdate, cardId);
      updatedGame = {
        ...updatedGame,
        players: updatedGame.players.map(p => p.id === currentPlayer.id ? newPlayer : p)
      };
    }

    setGame(updatedGame);
    if (gameEngineRef.current) gameEngineRef.current.setState(updatedGame);
  };

  // Gestionnaire pour l'action d'achat de carte avec du média
  const handleBuyCardAction = () => {
    if (interactionState.type !== 'IDLE') return;

    setInteractionState({ type: 'ACQUIRING_CARD', count: 1 });
    setToast({ message: "Sélectionnez une carte dans la rangée ou la pioche", visible: true });
  };

  // Gestionnaire pour les échanges directs (via les boutons rapides)
  const handleDirectTrade = (spendType: string, gainType: string) => {
    if (interactionState.type !== 'IDLE') return;
    const currentPlayer = game.players[game.currentPlayerIndex];

    // Mettre à jour GameEngine
    const result = ResourceSystem.tradeResources(game, currentPlayer.id, spendType, gainType);
    if (result.error) {
      setToast({ message: result.error, visible: true });
      return;
    }

    // Finaliser la transaction
    setGame(result.updatedGame);
    if (gameEngineRef.current) gameEngineRef.current.setState(result.updatedGame);
    setInteractionState({ type: 'IDLE' });
    setToast({ message: "Echange effectué", visible: true });
    addToHistory(`échange ${formatResource(2, spendType)} contre ${formatResource(1, gainType)}`, currentPlayer.id, game);
  };

  // Gestionnaire pour la sélection d'une carte de la pioche ou de la rangée principale
  const handleCardRowClick = (cardId?: string) => { // cardId undefined means deck
    // Cas 1: Sélection pour 2eme action scan
    if (interactionState.type === 'SELECTING_SCAN_CARD') {
      if (!cardId) return; // Cannot select deck for scan color
      const card = game.decks.cardRow.find(c => c.id === cardId);
      if (!card) return;

      setInteractionState({ type: 'SELECTING_SCAN_SECTOR', color: card.scanSector, sequenceId: interactionState.sequenceId, cardId: card.id });
      setToast({ message: `Sélectionnez un secteur ${card.scanSector}`, visible: true });
    } else
      // Cas 2: 
      if (interactionState.type === 'ACQUIRING_CARD') {
        const currentPlayer = game.players[game.currentPlayerIndex];
        let result: { updatedGame: Game, error?: string };

        // Passer interactionState.isFree
        result = ResourceSystem.buyCard(game, currentPlayer.id, cardId, interactionState.isFree);
        if (result.error) {
          setToast({ message: result.error, visible: true });
          // On reste dans l'état ACQUIRING_CARD pour permettre de réessayer ou d'annuler via l'overlay
          return;
        }

        let freeActionLog = "";
        if (interactionState.triggerFreeAction) {
          const player = result.updatedGame.players.find(p => p.id === currentPlayer.id);
          if (player && player.cards.length > 0) {
            const card = player.cards[player.cards.length - 1];
            card.isRevealed = true;

            if (card.freeAction === FreeActionType.MEDIA) {
              player.mediaCoverage = Math.min(player.mediaCoverage + 1, GAME_CONSTANTS.MAX_MEDIA_COVERAGE);
              setToast({ message: "Action gratuite : +1 Média", visible: true });
              freeActionLog = " et gagne 1 Média (Action gratuite)";
            } else if (card.freeAction === FreeActionType.DATA) {
              player.data = Math.min(player.data + 1, GAME_CONSTANTS.MAX_DATA);
              setToast({ message: "Action gratuite : +1 Donnée", visible: true });
              freeActionLog = " et gagne 1 Donnée (Action gratuite)";
            } else if (card.freeAction === FreeActionType.MOVEMENT) {
              setPendingInteractions(prev => [{ type: 'MOVING_PROBE', count: 1 }, ...prev]);
              setToast({ message: "Action gratuite : +1 Déplacement", visible: true });
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
          const updatedPlayer = result.updatedGame.players.find(p => p.id === currentPlayer.id);
          if (updatedPlayer && updatedPlayer.cards.length > 0) {
            cardName = updatedPlayer.cards[updatedPlayer.cards.length - 1].name;
          }
        }

        setGame(result.updatedGame);
        if (gameEngineRef.current) gameEngineRef.current.setState(result.updatedGame);

        const msg = interactionState.isFree ? "Carte obtenue (Bonus)" : "Carte achetée (-3 Média)";
        setToast({ message: msg, visible: true });

        const logMsg = interactionState.isFree
          ? (cardId ? `choisit la carte "${cardName}" (Bonus)` : `pioche la carte "${cardName}" (Bonus)`)
          : (cardId ? `achète la carte "${cardName}" pour 3 médias` : `achète la carte "${cardName}" (pioche) pour 3 médias`);

        const sequenceId = (interactionState as any).sequenceId;

        // Pour l'achat normal, on veut que l'undo revienne à IDLE (pas à la sélection)
        const undoState: InteractionState = !interactionState.isFree ? { type: 'IDLE' } : interactionState;

        addToHistory(logMsg + freeActionLog, currentPlayer.id, game, undoState, sequenceId);

        // Gérer le compteur pour les sélections multiples
        if (interactionState.count > 1) {
          setInteractionState({ ...interactionState, count: interactionState.count - 1 });
          setToast({ message: `Encore ${interactionState.count - 1} carte(s) à choisir`, visible: true });
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

    setInteractionState({ type: 'TRADING_CARD', targetGain, selectedCards: [] });
    setToast({ message: `Sélectionnez 2 cartes à échanger contre 1 ${formatResource(1, targetGain)}`, visible: true });
  }

  // Gestionnaire unifié pour les échanges
  const handleConfirmTrade = () => {
    if (interactionState.type !== 'TRADING_CARD') return;
    const currentPlayer = game.players[game.currentPlayerIndex];

    // Capturer les cartes avant qu'elles ne soient retirées
    const cardsToDiscard = currentPlayer.cards.filter(c => interactionState.selectedCards.includes(c.id));

    // Mettre à jour GameEngine
    const result = ResourceSystem.tradeResources(game, currentPlayer.id, 'card', interactionState.targetGain, interactionState.selectedCards);
    if (result.error) {
      setToast({ message: result.error, visible: true });
      return;
    }

    // PATCH: Ajouter à la pile de défausse
    if (cardsToDiscard.length > 0) {
      if (!result.updatedGame.decks.discardPile) result.updatedGame.decks.discardPile = [];
      result.updatedGame.decks.discardPile.push(...cardsToDiscard);
    }

    // Finaliser la transaction
    setGame(result.updatedGame);
    if (gameEngineRef.current) gameEngineRef.current.setState(result.updatedGame);
    setInteractionState({ type: 'IDLE' });
    setToast({ message: "Echange effectué", visible: true });
    addToHistory(`échange ${formatResource(2, 'card')} contre ${formatResource(1, interactionState.targetGain)}`, currentPlayer.id, game, { type: 'IDLE' });
  };

  // Fonction interne pour traiter l'achat (commune à l'achat direct et après sélection)
  const processTechPurchase = (tech: Technology, targetComputerCol?: number, noTileBonus?: boolean, baseGame?: Game) => {
    const currentGame = baseGame || gameRef.current;
    const currentPlayer = currentGame.players[currentGame.currentPlayerIndex];

    // Mettre à jour GameEngine
    const { updatedGame, gains } = TechnologySystem.acquireTechnology(currentGame, currentPlayer.id, tech, targetComputerCol, noTileBonus);

    // Finaliser la transaction
    setGame(updatedGame);
    if (gameEngineRef.current) gameEngineRef.current.setState(updatedGame);
    setInteractionState({ type: 'IDLE' });
    setHasPerformedMainAction(true);
    setToast({ message: `Technologie ${tech.name} acquise !`, visible: true });
    addToHistory(`acquiert la technologie "${tech.type} ${tech.name}"${gains.length > 0 ? ` et gagne ${gains.join(', ')}` : ''}`, currentPlayer.id, currentGame, undefined, interactionState.sequenceId);
  };

  // Gestionnaire pour l'achat de technologie (clic initial)
  const handleTechClick = (tech: Technology) => {
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
        if (currentPlayer.mediaCoverage < GAME_CONSTANTS.TECH_RESEARCH_COST_MEDIA) {
          setToast({ message: `Pas assez de couverture médiatique (Requis: ${GAME_CONSTANTS.TECH_RESEARCH_COST_MEDIA})`, visible: true });
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
        addToHistory(rotationResult.logs.join(', '), player.id, game, undefined, interactionState.sequenceId)

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
    if (interactionState.type !== 'SELECTING_COMPUTER_SLOT') return;

    // Vérifier que c'est une colonne valide (1, 3, 5, 6)
    if (![1, 3, 5, 6].includes(col)) return;

    // Vérifier si la colonne est déjà occupée par une technologie
    const currentGame = gameRef.current;
    const currentPlayer = currentGame.players[currentGame.currentPlayerIndex];
    if (currentPlayer.dataComputer.slots?.[`${col}a`]?.bonus === '2pv') {
      setToast({ message: "Emplacement déjà occupé par une technologie", visible: true });
      return;
    }

    // Finaliser l'achat
    processTechPurchase(interactionState.tech, col, false);
  };

  // Gestionnaire pour la pioche de carte depuis le PlayerBoardUI (ex: bonus ordinateur)
  const handleDrawCard = (count: number, source: string) => {
    const updatedGame = CardSystem.drawCards(game, game.players[game.currentPlayerIndex].id, count, source);

    setGame(updatedGame);
    if (gameEngineRef.current) gameEngineRef.current.setState(updatedGame);
    addToHistory(`pioche ${count} carte${count > 1 ? 's' : ''} (${source})`, game.players[game.currentPlayerIndex].id, game);
  };

  // Gestionnaire pour le clic sur une planète (ex: Terre pour lancer une sonde)
  const handlePlanetClick = (planetId: string) => {
    if (planetId === 'earth') {
      const currentPlayer = game.players[game.currentPlayerIndex];
      const validation = ProbeSystem.canLaunchProbe(game, currentPlayer.id);
      if (validation.canLaunch) {
        handleAction(ActionType.LAUNCH_PROBE);
      } else {
        setToast({ message: validation.reason || "Impossible de lancer une sonde", visible: true });
      }
    }
  };

  // Gestionnaire pour les bonus ordinateur (déclenché depuis PlayerBoardUI)
  const handleComputerBonus = (type: string, amount: number, sequenceId?: string) => {
    if (type === 'reservation') {
      const currentPlayer = gameRef.current.players[gameRef.current.currentPlayerIndex];
      const count = Math.min(amount, currentPlayer.cards.length);
      if (count > 0) {
        const seqId = sequenceId || (interactionState as any).sequenceId;
        setInteractionState({ type: 'RESERVING_CARD', count: count, sequenceId: seqId, selectedCards: [] });
        setToast({ message: `Réservez ${count} carte${count > 1 ? 's' : ''}`, visible: true });
      } else {
        setToast({ message: "Aucune carte à réserver", visible: true });
      }
    }
  };

  // Gestionnaire pour le clic sur un objectif (placement de marqueur de palier)
  const handleObjectiveClick = (tileId: string) => {
    if (interactionState.type !== 'PLACING_OBJECTIVE_MARKER') return;

    const tile = game.board.objectiveTiles.find(t => t.id === tileId);
    if (!tile) return;

    const currentPlayer = game.players[game.currentPlayerIndex];

    // Vérifier si le joueur a déjà un marqueur sur cet objectif
    if (tile.markers.includes(currentPlayer.id)) {
      setToast({ message: "Vous avez déjà un marqueur sur cet objectif.", visible: true });
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
    setToast({ message: `Marqueur placé !`, visible: true });

    // Continuer la fin de tour (vérifier d'autres paliers ou passer au joueur suivant)
    handleNextPlayer();
  };

  // Gestionnaire pour le clic sur le background
  const handleBackgroundClick = () => {
    if (interactionState.type === 'MOVING_PROBE') {
      setInteractionState({ type: 'IDLE' });
      setToast({ message: "Déplacements terminés", visible: true });
    }
  }

  const humanPlayer = game.players.find(p => (p as any).type === 'human');
  const currentPlayerIdToDisplay = viewedPlayerId || humanPlayer?.id;

  const currentPlayer = game.players[game.currentPlayerIndex];

  return (
    <div className="seti-root">
      {/* Panneau de débogage pour le développement */}
      <DebugPanel
        game={game}
        setGame={setGame}
        onHistory={addToHistory}
        setViewedPlayerId={setViewedPlayerId}
        interactionState={interactionState} />

      {/* Toast Notification */}
      {toast && toast.visible && (
        <div className="seti-toast">
          {toast.message}
        </div>
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

      {/* Overlay pour la recherche de technologie ou l'achat de carte */}
      {(interactionState.type === 'ACQUIRING_TECH' || interactionState.type === 'ACQUIRING_CARD' || interactionState.type === 'RESERVING_CARD' || interactionState.type === 'SELECTING_SCAN_CARD') && (
        <div className="seti-interaction-overlay" onClick={() => {
          if (interactionState.type === 'ACQUIRING_CARD') {
            setInteractionState({ type: 'IDLE' });
          } else if (interactionState.type === 'SELECTING_SCAN_CARD') {
            // Cannot cancel easily in middle of sequence, maybe toast warning?
          } else if (interactionState.type === 'RESERVING_CARD') {
            setToast({ message: "Veuillez sélectionner une carte à réserver", visible: true });
          } else {
            setToast({ message: "Veuillez sélectionner une technologie", visible: true });
          }
        }} />
      )}

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
              onConfirmDiscard={handleConfirmDiscard}
              onTradeCardAction={(targetGain) => handleTradeCardAction({ targetGain })}
              onConfirmTrade={handleConfirmTrade}
              onConfirmReservation={handleConfirmReservation}
              onBuyCardAction={handleBuyCardAction}
              onDirectTradeAction={handleDirectTrade}
              onDrawCard={handleDrawCard}
              onPlayCard={handlePlayCardRequest}
              onGameUpdate={(newGame) => { setGame(newGame); if (gameEngineRef.current) gameEngineRef.current.setState(newGame); }}
              onComputerSlotSelect={handleComputerColumnSelect}
              hasPerformedMainAction={currentPlayer?.hasPerformedMainAction || false}
              onNextPlayer={handleNextPlayer}
              onHistory={(message, sequenceId) => addToHistory(message, game.players[game.currentPlayerIndex].id, game, undefined, sequenceId)}
              onComputerBonus={handleComputerBonus}
              onConfirmDiscardForSignal={handleConfirmDiscardForSignal}
              setActiveTooltip={setActiveTooltip}
            />
          </div>
        </div>
        <div className="seti-right-panel">
          <SolarSystemBoardUI
            ref={solarSystemRef}
            game={game}
            interactionState={interactionState}
            onProbeMove={handleProbeMove}
            onPlanetClick={handlePlanetClick}
            onOrbit={handleOrbit}
            onLand={handleLand}
            onSectorClick={handleSectorClick}
            hasPerformedMainAction={currentPlayer?.hasPerformedMainAction || false}
            onBackgroundClick={handleBackgroundClick}
            setActiveTooltip={setActiveTooltip}
          />

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

          {/* Plateau Alien A en bas à gauche */}
          <AlienBoardUI
            game={game}
            boardIndex={0}
            interactionState={interactionState}
            isOpen={isAlienBoardAOpen}
            onToggle={() => setIsAlienBoardAOpen(!isAlienBoardAOpen)}
            onPlaceLifeTrace={handlePlaceLifeTrace}
            setActiveTooltip={setActiveTooltip}
            side="left"
          />

          {/* Plateau Alien B en bas à droite */}
          <AlienBoardUI
            game={game}
            boardIndex={1}
            interactionState={interactionState}
            isOpen={isAlienBoardBOpen}
            onToggle={() => setIsAlienBoardBOpen(!isAlienBoardBOpen)}
            onPlaceLifeTrace={handlePlaceLifeTrace}
            setActiveTooltip={setActiveTooltip}
            side="right"
          />
        </div>
      </div>
    </div>
  );
};