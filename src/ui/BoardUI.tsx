import React, { useRef, useState, useEffect, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Game, ActionType, DiskName, SectorNumber, FreeAction, GAME_CONSTANTS, SectorColor, Technology, RevenueBonus, ProbeState, TechnologyCategory } from '../core/types';
import { SolarSystemBoardUI, SolarSystemBoardUIRef } from './SolarSystemBoardUI';
import { TechnologyBoardUI } from './TechnologyBoardUI';
import { PlayerBoardUI } from './PlayerBoardUI';
import { LaunchProbeAction } from '../actions/LaunchProbeAction';
import { MoveProbeAction } from '../actions/MoveProbeAction';
import { PassAction } from '../actions/PassAction';
import { GameEngine } from '../core/Game';
import { ProbeSystem } from '../systems/ProbeSystem';
import { 
  createRotationState, 
  getCell, 
  getObjectPosition,
  FIXED_OBJECTS,
  INITIAL_ROTATING_LEVEL1_OBJECTS,
  INITIAL_ROTATING_LEVEL2_OBJECTS,
  INITIAL_ROTATING_LEVEL3_OBJECTS
} from '../core/SolarSystemPosition';
import { DataSystem } from '../systems/DataSystem';
import { CardSystem } from '../systems/CardSystem';
import { ResourceSystem } from '../systems/ResourceSystem';
import { TechnologySystem } from '../systems/TechnologySystem';
import { AIBehavior } from '../ai/AIBehavior';

interface BoardUIProps {
  game: Game;
}

type InteractionState = 
  | { type: 'IDLE' }
  | { type: 'DISCARDING', cardsToDiscard: string[] }
  | { type: 'TRADING_SPEND' }
  | { type: 'TRADING_GAIN', spendType: string, spendCardIds?: string[] }
  | { type: 'FREE_MOVEMENT' }
  | { type: 'RESEARCHING' }
  | { type: 'SELECTING_TECH_BONUS', sequenceId?: string, category?: TechnologyCategory }
  | { type: 'SELECTING_COMPUTER_SLOT', tech: Technology, isBonus?: boolean, sequenceId?: string }
  | { type: 'ANALYZING' }
  | { type: 'RESERVING_CARD', count: number, sequenceId?: string }
  | { type: 'PLACING_LIFE_TRACE', color: 'blue' | 'red' | 'yellow', sequenceId?: string }
  | { type: 'BUYING_CARD', count: number, isFree?: boolean, sequenceId?: string }
  | { type: 'PLACING_OBJECTIVE_MARKER', milestone: number }
  | { 
      type: 'CHOOSING_BONUS_ACTION', 
      bonusesSummary: string, 
      choices: { id: string, label: string, state: InteractionState, done: boolean }[],
      sequenceId?: string
    };

interface HistoryEntry {
  id: string;
  message: string;
  playerId?: string;
  previousState?: Game;
  previousInteractionState?: InteractionState;
  previousHasPerformedMainAction?: boolean;
  previousPendingInteractions?: InteractionState[];
  timestamp: number;
  sequenceId?: string;
}

// Helper pour les libellés des interactions
const getInteractionLabel = (state: InteractionState): string => {
  switch (state.type) {
    case 'BUYING_CARD': return state.isFree ? "Choisir une carte" : "Acheter une carte";
    case 'RESERVING_CARD': return "Réserver une carte";
    case 'SELECTING_TECH_BONUS': return "Choisir une technologie";
    case 'PLACING_LIFE_TRACE': return `Placer trace de vie (${state.color})`;
    default: return "Action bonus";
  }
};

const Tooltip = ({ content, targetRect }: { content: React.ReactNode, targetRect: DOMRect }) => {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({ opacity: 0 });

  useLayoutEffect(() => {
    if (tooltipRef.current && targetRect) {
      const rect = tooltipRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const margin = 8;
      const padding = 10;

      let left = targetRect.left + (targetRect.width / 2) - (rect.width / 2);

      if (left < padding) left = padding;
      if (left + rect.width > viewportWidth - padding) {
        left = viewportWidth - rect.width - padding;
      }

      let top = targetRect.top - rect.height - margin;

      if (top < padding) {
        const bottomPosition = targetRect.bottom + margin;
        if (bottomPosition + rect.height <= viewportHeight - padding) {
            top = bottomPosition;
        } else {
            if (targetRect.top > (viewportHeight - targetRect.bottom)) {
                top = padding;
            } else {
                top = viewportHeight - rect.height - padding;
            }
        }
      }

      setStyle({ top, left, opacity: 1 });
    }
  }, [targetRect, content]);

  return createPortal(
    <div ref={tooltipRef} style={{ position: 'fixed', zIndex: 9999, backgroundColor: 'rgba(0, 0, 0, 0.95)', padding: '8px', borderRadius: '6px', border: '1px solid #78a0ff', color: '#fff', textAlign: 'center', minWidth: '150px', boxShadow: '0 4px 15px rgba(0,0,0,0.6)', transition: 'opacity 0.1s ease-in-out', pointerEvents: 'none', ...style }}>
      {content}
    </div>
  , document.body);
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
  const historyContentRef = useRef<HTMLDivElement>(null);
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
  const [hasPerformedMainAction, setHasPerformedMainAction] = useState(false);
  const [viewedPlayerId, setViewedPlayerId] = useState<string | null>(null);
  const [isTechOpen, setIsTechOpen] = useState(false);
  const [isObjectivesOpen, setIsObjectivesOpen] = useState(false);
  const [isRowOpen, setIsRowOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(true);

  // État pour le tooltip générique
  const [activeTooltip, setActiveTooltip] = useState<{ content: React.ReactNode, rect: DOMRect } | null>(null);
  
  // Auto-open tech panel when researching
  useEffect(() => {
    if (interactionState.type === 'RESEARCHING' || interactionState.type === 'SELECTING_TECH_BONUS') {
      setIsTechOpen(true);
    }
    if (interactionState.type === 'BUYING_CARD') {
      setIsRowOpen(true);
    }
  }, [interactionState.type]);

  // État pour la modale de sélection de carte de fin de manche
  const [passModalState, setPassModalState] = useState<{ visible: boolean; cards: any[]; selectedCardId: string | null; cardsToKeep?: string[] }>({ visible: false, cards: [], selectedCardId: null });

  // Ref pour contrôler le plateau solaire
  const solarSystemRef = useRef<SolarSystemBoardUIRef>(null);

  // Ref pour accéder à l'état d'interaction actuel dans addToHistory sans dépendance
  const interactionStateRef = useRef(interactionState);
  useEffect(() => { interactionStateRef.current = interactionState; }, [interactionState]);
  const pendingInteractionsRef = useRef(pendingInteractions);
  useEffect(() => { pendingInteractionsRef.current = pendingInteractions; }, [pendingInteractions]);

  // Scroll automatique vers le bas de l'historique
  useEffect(() => {
    if (historyContentRef.current) {
      historyContentRef.current.scrollTo({ top: historyContentRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [historyLog]);

  // Helper pour formater les messages avec des icônes
  const formatHistoryMessage = (message: string) => {
    const parts = message.split(/(Énergie|énergie|Crédit(?:s?)|crédit(?:s?)|Média(?:s?)|Media)/g);
    return parts.map((part, index) => {
      if (part.match(/^Énergie|énergie$/)) {
        return <span key={index} title="Énergie" style={{ color: '#4caf50', cursor: 'help' }}>⚡</span>;
      } else if (part.match(/^Crédit(?:s?)|crédit(?:s?)$/)) {
        return <span key={index} title="Crédit" style={{ color: '#ffd700', cursor: 'help' }}>₢</span>;
      } else if (part.match(/^Média(?:s?)|Media$/)) {
        return <span key={index} title="Média" style={{ color: '#ff6b6b', cursor: 'help' }}>🎤</span>;
      }
      return part;
    });
  };

  // Helper pour ajouter une entrée à l'historique
  const addToHistory = useCallback((message: string, playerId?: string, previousState?: Game, customInteractionState?: InteractionState, sequenceId?: string) => {
    const entry: HistoryEntry = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      message,
      playerId,
      previousState,
      previousInteractionState: customInteractionState || interactionStateRef.current,
      previousHasPerformedMainAction: hasPerformedMainAction,
      previousPendingInteractions: pendingInteractionsRef.current,
      timestamp: Date.now(),
      sequenceId
    };
    setHistoryLog(prev => [...prev, entry]);
  }, [hasPerformedMainAction]);

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
            if (gameEngineRef.current) {
                gameEngineRef.current.setState(firstEntry.previousState);
            }
            
            // Supprimer toutes les entrées de la séquence
            setHistoryLog(prev => prev.filter(e => e.sequenceId !== lastEntry.sequenceId));
            
            // Restaurer les états depuis la première entrée
            setInteractionState(firstEntry.previousInteractionState || { type: 'IDLE' });
            if (firstEntry.previousHasPerformedMainAction !== undefined) {
                setHasPerformedMainAction(firstEntry.previousHasPerformedMainAction);
            }
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
      if (gameEngineRef.current) {
        gameEngineRef.current.setState(lastEntry.previousState);
      }
      setHistoryLog(prev => prev.slice(0, -1));
      setInteractionState(lastEntry.previousInteractionState || { type: 'IDLE' });
      
      if (lastEntry.previousHasPerformedMainAction !== undefined) {
        setHasPerformedMainAction(lastEntry.previousHasPerformedMainAction);
      }
      
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

  // Effet pour traiter la file d'attente des interactions (récompenses en chaîne)
  useEffect(() => {
    if (interactionState.type === 'IDLE' && pendingInteractions.length > 0) {
      const [next, ...rest] = pendingInteractions;
      setPendingInteractions(rest);
      setInteractionState(next);
      // Note: Les toasts spécifiques peuvent être gérés ici ou lors de l'ajout à la file
    }
  }, [interactionState, pendingInteractions]);

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
        
        if (newGame.isFirstToPass) {
          const currentLevel = oldGame.board.solarSystem.nextRingLevel || 1;
          setToast({ message: `Rotation du système solaire (Niveau ${currentLevel})`, visible: true });
          addToHistory(`passe son tour en premier, fait tourner le système solaire (Niveau ${currentLevel}) et choisit une carte à garder`, enginePlayer.id, oldGame);
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
              if (creditsGain > 0) gains.push(`${creditsGain} Crédit${creditsGain > 1 ? 's' : ''}`);
              if (energyGain > 0) gains.push(`${energyGain} Énergie${energyGain > 1 ? 's' : ''}`);
              if (cardsGain > 0) gains.push(`${cardsGain} Carte${cardsGain > 1 ? 's' : ''}`);
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
        setHasPerformedMainAction(false); // Réinitialiser pour le prochain joueur
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
            const roundDeck = game.roundDecks[game.currentRound];
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
  const performRotation = (currentGame: Game, source: string): { updatedGame: Game, logs: string[] } => {
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
    
    const logs = [`fait tourner le système solaire (Niveau ${currentLevel}) via ${source}`, ...rotationResult.logs];
    
    return { updatedGame, logs };
  }

  // Gestionnaire pour passer au joueur suivant (fin de tour simple)
  const handleNextPlayer = () => {
    if (!gameEngineRef.current) return;

    // Vérifier les paliers de score avant de passer au joueur suivant
    // Utiliser l'état du moteur pour avoir la version la plus à jour
    const currentState = gameEngineRef.current.getState();
    const currentPlayer = currentState.players[currentState.currentPlayerIndex];
    const milestones = [25, 50, 70];
    
    for (const m of milestones) {
      if (currentPlayer.score >= m && !currentPlayer.claimedMilestones.includes(m)) {
        setInteractionState({ type: 'PLACING_OBJECTIVE_MARKER', milestone: m });
        setToast({ message: `Palier de ${m} PV atteint ! Placez un marqueur sur un objectif avant de terminer le tour.`, visible: true });
        setIsObjectivesOpen(true);
        return; // Interrompre le passage au joueur suivant
      }
    }

    gameEngineRef.current.nextPlayer();
    setGame(gameEngineRef.current.getState());
    setHasPerformedMainAction(false);
    setToast({ message: "Au tour du joueur suivant", visible: true });
  };

  // Gestionnaire pour le clic sur une carte en mode défausse
  const handleCardClick = (cardId: string) => {
    if (interactionState.type !== 'DISCARDING') return;
    
    const currentCards = interactionState.cardsToDiscard;
    if (currentCards.includes(cardId)) {
      setInteractionState({ ...interactionState, cardsToDiscard: currentCards.filter(id => id !== cardId) });
    } else {
      // Vérifier qu'on ne sélectionne pas plus que nécessaire
      const currentPlayer = game.players[game.currentPlayerIndex];
      const cardsToKeep = currentPlayer.cards.length - (currentCards.length + 1);
      if (cardsToKeep >= 4) {
        setInteractionState({ ...interactionState, cardsToDiscard: [...currentCards, cardId] });
      }
    }
  };

  // Gestionnaire pour confirmer la défausse
  const handleConfirmDiscard = () => {
    if (interactionState.type !== 'DISCARDING') return;
    const currentPlayer = game.players[game.currentPlayerIndex];
    const cardsToKeep = currentPlayer.cards.filter(c => !interactionState.cardsToDiscard.includes(c.id)).map(c => c.id);
    
    // Réinitialiser l'état de défausse
    setInteractionState({ type: 'IDLE' });
    
    // Vérifier s'il y a un paquet de manche pour déclencher la modale
    const roundDeck = game.roundDecks[game.currentRound];
    if (roundDeck && roundDeck.length > 0) {
        setPassModalState({ visible: true, cards: roundDeck, selectedCardId: null, cardsToKeep });
        // Note: performPass sera appelé après la confirmation dans la modale
    } else {
        performPass(cardsToKeep);
    }
  };

  // Gestionnaire pour les actions
  const handleAction = (actionType: ActionType) => {
    if (!gameEngineRef.current) return;
    
    // Atomicité : Si on est dans un mode interactif, on ne peut pas lancer d'autre action
    if (interactionState.type !== 'IDLE') {
        return;
    }
    
    // Si une action principale a déjà été faite, on ne peut pas en faire d'autre (sauf PASS qui est géré spécifiquement)
    if (hasPerformedMainAction && actionType !== ActionType.PASS) {
        return;
    }

    // Synchroniser l'état de GameEngine avec le jeu actuel (pour préserver les angles de rotation)
    gameEngineRef.current.setState(gameRef.current);

    const currentGame = gameRef.current;
    const currentPlayer = currentGame.players[currentGame.currentPlayerIndex];
    
    if (actionType === ActionType.LAUNCH_PROBE) {
      const action = new LaunchProbeAction(currentPlayer.id);
      const result = gameEngineRef.current.executeAction(action);
      if (result.success && result.updatedState) {
        console.log('Sonde lancée, nouvelles sondes:', result.updatedState.board.solarSystem.probes);
        setGame(result.updatedState);
        setHasPerformedMainAction(true);
        
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
        const costText = cost === 0 ? "gratuitement (Exploration I)" : `pour ${cost} crédits`;
        addToHistory(`lance une sonde depuis la Terre ${locString} ${costText}`, currentPlayer.id, game);
      } else {
        console.error('Erreur lors du lancement de la sonde:', result.error);
        alert(result.error || 'Impossible de lancer la sonde');
      }
    }
    //else if (actionType === ActionType.MOVE_PROBE) {
      
    //}
    else if (actionType === ActionType.PASS) {
      // 1. Vérifier la taille de la main
      if (currentPlayer.cards.length > 4) {
        setInteractionState({ type: 'DISCARDING', cardsToDiscard: [] });
        setToast({ message: "Veuillez défausser jusqu'à 4 cartes", visible: true });
        return;
      }
      
      const cardsToKeep = currentPlayer.cards.map(c => c.id);
      
      // Vérifier s'il y a un paquet de manche pour déclencher la modale
      const roundDeck = game.roundDecks[game.currentRound];
      if (roundDeck && roundDeck.length > 0) {
          setPassModalState({ visible: true, cards: roundDeck, selectedCardId: null, cardsToKeep });
      } else {
          performPass(cardsToKeep);
      }
    }
    else if (actionType === ActionType.RESEARCH_TECH) {
      
      const currentPlayer = game.players[game.currentPlayerIndex];
      if (currentPlayer.mediaCoverage < GAME_CONSTANTS.TECH_RESEARCH_COST_MEDIA) {
        setToast({ message: "Pas assez de couverture médiatique", visible: true });
        return;
      }

      let updatedGame = structuredClone(game);
      const playerIndex = updatedGame.currentPlayerIndex;
      const player = updatedGame.players[playerIndex];

      // Payer le coût
      player.mediaCoverage -= GAME_CONSTANTS.TECH_RESEARCH_COST_MEDIA;

      // Rotation du système solaire
      updatedGame.board = {
        ...updatedGame.board,
        solarSystem: { ...updatedGame.board.solarSystem },
        technologyBoard: { ...updatedGame.board.technologyBoard }
      };

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
      
      addToHistory(`paye ${GAME_CONSTANTS.TECH_RESEARCH_COST_MEDIA} médias et fait tourner le système solaire (Niveau ${currentLevel}) pour rechercher une technologie`, player.id, game);

      rotationResult.logs.forEach(log => addToHistory(log));

      setGame(updatedGame);
      if (gameEngineRef.current) {
        gameEngineRef.current.setState(updatedGame);
      }
      setInteractionState({ type: 'RESEARCHING' });
      setIsTechOpen(true);
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

        // 1. Dépenser 1 énergie
        player.energy -= 1;

        // 2. Vider l'ordinateur (haut et bas)
        DataSystem.clearComputer(player);

        setGame(updatedGame);
        if (gameEngineRef.current) {
          gameEngineRef.current.setState(updatedGame);
        }
        setHasPerformedMainAction(true);
        
        // 3. Passer en mode placement de trace de vie
        setInteractionState({ type: 'IDLE' });
        setToast({ message: "Données analysées.", visible: true });
        addToHistory(`analyse des données`, player.id, previousState);
      }, 1500);
    }
  };

  // Helper pour traiter les bonus (Orbite/Atterrissage)
  const processBonuses = (bonuses: any, currentGame: Game, playerId: string): { updatedGame: Game, newPendingInteractions: InteractionState[], passiveGains: string[], logs: string[] } => {
    let updatedGame = currentGame;
    const newPendingInteractions: InteractionState[] = [];
    const logs: string[] = [];
    const passiveGains: string[] = []; // For summary toast

    if (!bonuses) return { updatedGame, newPendingInteractions, logs, passiveGains };

    // Gains passifs pour le résumé
    if (bonuses.pv) { passiveGains.push(`${bonuses.pv} PV`); logs.push(`gagne ${bonuses.pv} PV`); }
    if (bonuses.media) { passiveGains.push(`${bonuses.media} Média`); logs.push(`gagne ${bonuses.media} Média`); }
    if (bonuses.credits) { const s = bonuses.credits > 1 ? 's' : ''; passiveGains.push(`${bonuses.credits} Crédit${s}`); logs.push(`gagne ${bonuses.credits} Crédit${s}`); }
    if (bonuses.energy) { passiveGains.push(`${bonuses.energy} Énergie`); logs.push(`gagne ${bonuses.energy} Énergie`); }
    if (bonuses.data) { const s = bonuses.data > 1 ? 's' : ''; passiveGains.push(`${bonuses.data} Donnée${s}`); logs.push(`gagne ${bonuses.data} Donnée${s}`); }

    // Effets immédiats qui modifient l'état (Rotation)
    if (bonuses.rotation) {
        for (let i = 0; i < bonuses.rotation; i++) {
            const rotationResult = performRotation(updatedGame, 'bonus de carte');
            updatedGame = rotationResult.updatedGame;
            logs.push(...rotationResult.logs);
        }
    }

    // Effets immédiats (Pioche)
    if (bonuses.card) {
      updatedGame = CardSystem.drawCards(updatedGame, playerId, bonuses.card, 'Bonus de carte');
      const s = bonuses.card > 1 ? 's' : '';
      passiveGains.push(`${bonuses.card} Carte${s}`);
      logs.push(`pioche ${bonuses.card} Carte${s}`);
    }

    // Effets interactifs (File d'attente)
    if (bonuses.anycard) {
      newPendingInteractions.push({ type: 'BUYING_CARD', count: bonuses.anycard, isFree: true });
    }

    if (bonuses.revenue) {
      newPendingInteractions.push({ type: 'RESERVING_CARD', count: bonuses.revenue });
    }
    
    if (bonuses.technology) {
      for (let i = 0; i < bonuses.technology.amount; i++) {
          newPendingInteractions.push({ type: 'SELECTING_TECH_BONUS', category: bonuses.technology.color });
      }
    }
    
    if (bonuses.movements) {
        // On ajoute autant d'actions de mouvement gratuit que de bonus
        newPendingInteractions.push({ type: 'FREE_MOVEMENT' }); // Simplification: 1 état pour X mouvements, ou X états ?
        // Pour l'instant, FREE_MOVEMENT dans BoardUI gère 1 mouvement. Si on veut X, il faudrait adapter l'état.
        // Hack: on push X fois l'état si le système le supporte, sinon on adapte l'état FREE_MOVEMENT pour avoir un compteur.
        // Ici on suppose que FREE_MOVEMENT est unitaire ou que l'utilisateur gère ses points.
        // Amélioration : Modifier InteractionState pour FREE_MOVEMENT { count: number }
        // Pour ce diff, on va juste activer le mode mouvement.
    }

    if (bonuses.yellowlifetrace) {
        // Désactivé temporairement pour éviter de bloquer le jeu
        // newPendingInteractions.push({ type: 'PLACING_LIFE_TRACE', color: 'yellow' });
    }
    
    if (bonuses.planetscan || bonuses.redscan || bonuses.bluescan || bonuses.yellowscan || bonuses.blackscan) {
         // TODO: Implémenter le scan
         // newPendingInteractions.push({ type: 'SCANNING' });
         setToast({ message: "Bonus Scan : Fonctionnalité à venir", visible: true });
    }

    return { updatedGame, newPendingInteractions, logs, passiveGains };
  };

  // Helper générique pour les interactions avec les planètes (Orbite/Atterrissage)
  const handlePlanetInteraction = (
    planetId: string,
    actionFn: (game: Game, playerId: string, probeId: string, targetId: string) => { updatedGame: Game, bonuses?: any },
    historyMessagePrefix: string,
    successMessage: string
  ) => {
    if (interactionState.type !== 'IDLE') return;
    if (hasPerformedMainAction) {
        setToast({ message: "Action principale déjà effectuée", visible: true });
        return;
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
      return;
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

    if (!probe) return;

    // Générer un ID de séquence pour grouper l'action et ses bonus
    const sequenceId = `seq-${Date.now()}`;

    // Sauvegarder l'état avant l'action pour l'historique (Undo annulera tout, y compris les bonus)
    const stateBeforeAction = structuredClone(game);

    try {
        const result = actionFn(game, currentPlayer.id, probe.id, planetId);
        
        const { updatedGame, newPendingInteractions, passiveGains, logs: allBonusLogs } = processBonuses(result.bonuses, result.updatedGame, currentPlayer.id);

        setGame(updatedGame);
        if (gameEngineRef.current) gameEngineRef.current.setState(updatedGame);
        setHasPerformedMainAction(true);
        
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
        } else if (newPendingInteractions.length === 1) {
            if (passiveGains.length > 0) {
                setToast({ message: `Gains : ${passiveGains.join(', ')}`, visible: true });
            }
            setInteractionState({ ...newPendingInteractions[0], sequenceId });
        } else if (passiveGains.length > 0) {
            setToast({ message: `Gains : ${passiveGains.join(', ')}`, visible: true });
        }

        addToHistory(`${historyMessagePrefix} ${planetId}`, currentPlayer.id, stateBeforeAction, undefined, sequenceId);
        if (allBonusLogs.length > 0) {
            allBonusLogs.forEach(log => addToHistory(log, currentPlayer.id, updatedGame, undefined, sequenceId));
        }
        if (newPendingInteractions.length === 0) {
            setToast({ message: successMessage, visible: true });
        }
    } catch (e: any) {
        setToast({ message: e.message, visible: true });
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

  // Gestionnaire pour la mise en orbite via la hover card
  const handleOrbit = (planetId: string) => {
    handlePlanetInteraction(
        planetId,
        (g, pid, prid, targetId) => ProbeSystem.orbitProbe(g, pid, prid, targetId),
        "met une sonde en orbite autour de",
        "Sonde mise en orbite"
    );
  };

  // Gestionnaire pour l'atterrissage via la hover card
  const handleLand = (planetId: string) => {
    handlePlanetInteraction(
        planetId,
        // On passe planetId comme targetId pour supporter l'atterrissage sur les satellites
        (g, pid, prid, targetId) => ProbeSystem.landProbe(g, pid, prid, targetId),
        "fait atterrir une sonde sur",
        "Atterrissage réussi"
    );
  };

  // Gestionnaire pour le déplacement des sondes
  const handleProbeMove = async (probeId: string, path: string[]) => {
    if (!gameEngineRef.current) return;

    // Synchroniser l'état de GameEngine avec le jeu actuel
    gameEngineRef.current.setState(gameRef.current);

    let currentGame = gameRef.current; // Utiliser la ref pour avoir l'état le plus frais
    
    setToast({ message: "Déplacement...", visible: true });

    const currentPlayerId = currentGame.players[currentGame.currentPlayerIndex].id;

    let freeMovements = interactionState.type === 'FREE_MOVEMENT' ? 1 : 0;

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
        
        if (updatedPlayer && oldPlayer) {
            // Log du coût (approximatif car calculé dans l'action)
            const object = getCell(disk, sector, createRotationState(updatedGame.board.solarSystem.rotationAngleLevel1 || 0, updatedGame.board.solarSystem.rotationAngleLevel2 || 0, updatedGame.board.solarSystem.rotationAngleLevel3 || 0));
            const objectName = object?.hasComet ? "une comète" : object?.hasAsteroid ? "un champ d'astéroïdes" : object?.hasPlanet ? object?.planetName : "une case vide";  
            const energySpent = oldPlayer.energy - updatedPlayer.energy;
            const mediaGain = updatedPlayer.mediaCoverage - oldPlayer.mediaCoverage;
            
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
            
            addToHistory(message, currentPlayerId, stateBeforeMove);
        }

        currentGame = updatedGame;
        gameRef.current = currentGame; // Mettre à jour la ref locale pour garantir la fraîcheur
        setGame(currentGame);

        // Mettre à jour l'état du moteur pour la prochaine étape du mouvement
        if (gameEngineRef.current) {
            gameEngineRef.current.setState(currentGame);
        }
        
        // Mettre à jour le compteur de mouvements gratuits
        if (useFree) {
          freeMovements--;
        }
        
        // Petit délai pour l'animation
        await new Promise(resolve => setTimeout(resolve, 300));

      } else {
        console.error('Erreur lors du déplacement de la sonde (étape):', result.error);
        setToast({ message: result.error || 'Impossible de déplacer la sonde', visible: true });
        break; // Arrêter le mouvement en cas d'erreur
      }
    }
    if (interactionState.type === 'FREE_MOVEMENT') {
      setInteractionState({ type: 'IDLE' });
    }
  };

  // Gestionnaire pour l'action gratuite (défausse de carte)
  const handleDiscardCardAction = (cardId: string) => {
    const updatedGame = { ...game };
    // Copie des joueurs pour éviter la mutation directe
    updatedGame.players = updatedGame.players.map(p => ({ ...p }));
    const currentPlayerIndex = updatedGame.currentPlayerIndex;
    const currentPlayer = updatedGame.players[currentPlayerIndex];
    
    const cardIndex = currentPlayer.cards.findIndex(c => c.id === cardId);
    if (cardIndex === -1) return;
    
    const card = currentPlayer.cards[cardIndex];
    
    // Appliquer l'effet de l'action gratuite
    if (card.freeAction === FreeAction.MEDIA) {
      currentPlayer.mediaCoverage = Math.min(currentPlayer.mediaCoverage + 1, GAME_CONSTANTS.MAX_MEDIA_COVERAGE);
      setToast({ message: "Action gratuite : +1 Média", visible: true });
      addToHistory("défausse une carte pour gagner 1 Média", currentPlayer.id, game);
    } else if (card.freeAction === FreeAction.DATA) {
      currentPlayer.data = (currentPlayer.data || 0) + 1;
      setToast({ message: "Action gratuite : +1 Data", visible: true });
      addToHistory("défausse une carte pour gagner 1 Donnée", currentPlayer.id, game);
    } else if (card.freeAction === FreeAction.MOVEMENT) {
      setInteractionState({ type: 'FREE_MOVEMENT' });
      setToast({ message: "Sélectionnez une sonde à déplacer", visible: true });
      addToHistory("défausse une carte pour un déplacement gratuit", currentPlayer.id, game);
    }
    
    // Défausser la carte
    currentPlayer.cards = currentPlayer.cards.filter(c => c.id !== cardId);
    
    setGame(updatedGame);
  };

  // Gestionnaire pour jouer une carte (payer son coût en crédits)
  const handlePlayCard = (cardId: string) => {
    if (interactionState.type !== 'IDLE') return;
    if (hasPerformedMainAction) return;

    const currentGame = gameRef.current;
    const currentPlayer = currentGame.players[currentGame.currentPlayerIndex];
    
    const result = CardSystem.playCard(currentGame, currentPlayer.id, cardId);
    if (result.error) {
        setToast({ message: result.error, visible: true });
        return;
    }

    const { updatedGame: gameAfterBonuses, newPendingInteractions, passiveGains, logs: allBonusLogs } = processBonuses(result.bonuses, result.updatedGame, currentPlayer.id);

    const card = currentGame.players[currentGame.currentPlayerIndex].cards.find(c => c.id === cardId)!;
    setGame(gameAfterBonuses);
    if (gameEngineRef.current) {
      gameEngineRef.current.setState(gameAfterBonuses);
    }
    setHasPerformedMainAction(true);
    
    const gainsText = passiveGains.length > 0 ? ` (Gains: ${passiveGains.join(', ')})` : '';
    setToast({ message: `Carte jouée: ${card.name}${gainsText}`, visible: true });
    
    const sequenceId = `seq-${Date.now()}`;
    
    const areAllGainsPassive = allBonusLogs.every(log => log.startsWith('gagne') || log.startsWith('pioche'));

    if (newPendingInteractions.length === 0 && areAllGainsPassive && passiveGains.length > 0) {
        // Si seulement des gains passifs, on les ajoute sur la même ligne
        const gainsSummary = passiveGains.join(', ');
        addToHistory(`joue la carte "${card.name}" pour ${card.cost} crédits et gagne : ${gainsSummary}`, currentPlayer.id, currentGame, undefined, sequenceId);
    } else {
        // Sinon, on log l'action puis les effets en séquence
        addToHistory(`joue la carte "${card.name}" pour ${card.cost} crédits`, currentPlayer.id, currentGame, undefined, sequenceId);
        if (allBonusLogs.length > 0) {
            allBonusLogs.forEach(log => addToHistory(log, currentPlayer.id, gameAfterBonuses, undefined, sequenceId));
        }
    }

    // Gérer les interactions en attente (ex: Mouvements, Tech, etc.)
    if (newPendingInteractions.length > 0) {
        const interactionsWithSeqId = newPendingInteractions.map(i => ({ ...i, sequenceId }));
        setPendingInteractions(prev => [...interactionsWithSeqId, ...prev]);
    }
  };

  // Gestionnaire pour l'action d'achat de carte avec du média
  const handleBuyCardAction = () => {
    if (interactionState.type !== 'IDLE') return;
    setInteractionState({ type: 'BUYING_CARD', count: 1});
    setToast({ message: "Sélectionnez une carte dans la rangée ou la pioche", visible: true });
  };

  const handleCardRowClick = (cardId?: string) => { // cardId undefined means deck
    if (interactionState.type !== 'BUYING_CARD') return;
    
    const currentPlayer = game.players[game.currentPlayerIndex];
    let result: { updatedGame: Game, error?: string };

    if (interactionState.isFree) {
        // Logique pour carte gratuite (Bonus)
        const updatedGame = structuredClone(game);
        const player = updatedGame.players[updatedGame.currentPlayerIndex];
        
        if (cardId) {
            // Prendre de la rangée
            const rowIndex = updatedGame.cardRow.findIndex(c => c.id === cardId);
            if (rowIndex !== -1) {
                const card = updatedGame.cardRow[rowIndex];
                player.cards.push(card);
                updatedGame.cardRow.splice(rowIndex, 1);
                
                // Remplir la rangée
                if (updatedGame.decks.actionCards.length > 0) {
                    updatedGame.cardRow.push(updatedGame.decks.actionCards.shift()!);
                }
            } else {
                // Carte non trouvée (ne devrait pas arriver)
                return;
            }
        } else {
            // Piocher du paquet
            if (updatedGame.decks.actionCards.length > 0) {
                player.cards.push(updatedGame.decks.actionCards.shift()!);
            } else {
                setToast({ message: "Pioche vide", visible: true });
                return;
            }
        }
        result = { updatedGame };
    } else {
        // Achat normal via ResourceSystem (coût en média)
        result = ResourceSystem.buyCard(game, currentPlayer.id, cardId);
    }
    
    if (result.error) {
      setToast({ message: result.error, visible: true });
      // On reste dans l'état BUYING_CARD pour permettre de réessayer ou d'annuler via l'overlay
      return;
    }

    setGame(result.updatedGame);
    
    const msg = interactionState.isFree ? "Carte obtenue (Bonus)" : "Carte achetée (-3 Média)";
    setToast({ message: msg, visible: true });
    
    const logMsg = interactionState.isFree 
        ? (cardId ? "choisit une carte de la rangée (Bonus)" : "pioche une carte (Bonus)")
        : (cardId ? "achète une carte de la rangée pour 3 médias" : "achète une carte de la pioche pour 3 médias");

    const sequenceId = (interactionState as any).sequenceId;
    addToHistory(logMsg, currentPlayer.id, game, interactionState, sequenceId);
    
    // Gérer le compteur pour les sélections multiples
    if (interactionState.count > 1) {
         setInteractionState({ ...interactionState, count: interactionState.count - 1 });
         setToast({ message: `Encore ${interactionState.count - 1} carte(s) à choisir`, visible: true });
    } else {
        setInteractionState({ type: 'IDLE' });
        setIsRowOpen(false);
    }
  };

  // Gestionnaire unifié pour les échanges
  const handleTrade = (step: 'START' | 'CANCEL' | 'SPEND' | 'GAIN', payload?: any) => {
    if (step === 'START') {
      if (interactionState.type !== 'IDLE') return;
      setInteractionState({ type: 'TRADING_SPEND' });
      setToast({ message: "Choisissez une ressource à dépenser (x2)", visible: true });
    } 
    else if (step === 'CANCEL') {
      setInteractionState({ type: 'IDLE' });
      setToast({ message: "Echange annulé", visible: true });
    }
    else if (step === 'SPEND') {
      if (interactionState.type !== 'TRADING_SPEND' && interactionState.type !== 'TRADING_GAIN') return;
      const { spendType, cardIds } = payload;
      
      if (spendType === 'card' && (!cardIds || cardIds.length < 2)) {
        setInteractionState({ type: 'TRADING_SPEND' });
        setToast({ message: "Choisissez une ressource à dépenser (x2)", visible: true });
      } else {
        setInteractionState({ type: 'TRADING_GAIN', spendType, spendCardIds: cardIds });
        setToast({ message: "Choisissez une ressource à recevoir (x1)", visible: true });
      }
    }
    else if (step === 'GAIN') {
      if (interactionState.type !== 'TRADING_GAIN') return;
      const { gainType } = payload;
      const { spendType, spendCardIds } = interactionState;
      
      const currentPlayerIndex = game.currentPlayerIndex;
      const currentPlayer = game.players[currentPlayerIndex];

      const result = ResourceSystem.tradeResources(game, currentPlayer.id, spendType, gainType, spendCardIds);
      
      if (result.error) {
          alert(result.error);
          setInteractionState({ type: 'IDLE' });
          return;
      }

      setGame(result.updatedGame);
      setToast({ message: "Echange effectué", visible: true });

      const translateResource = (type: string, count: number) => {
        const t = type.toLowerCase();
        let label = t;
        if (t === 'card') label = 'carte';
        else if (t === 'energy') label = 'énergie';
        else if (t === 'credit') label = 'crédit';
        return count > 1 ? `${label}s` : label;
      };
      addToHistory(`échange 2 ${translateResource(spendType, 2)} contre 1 ${translateResource(gainType, 1)}`, currentPlayer.id, game);
      setInteractionState({ type: 'IDLE' });
    }
  };

  // Fonction interne pour traiter l'achat (commune à l'achat direct et après sélection)
  const processTechPurchase = (tech: Technology, targetComputerCol?: number, stateOverride?: Game, interactionStateOverride?: InteractionState) => {
    const currentGame = stateOverride || gameRef.current;
    const { updatedGame, gains } = TechnologySystem.acquireTechnology(currentGame, currentGame.players[currentGame.currentPlayerIndex].id, tech, targetComputerCol);
    const currentPlayerIndex = updatedGame.currentPlayerIndex;
    const currentPlayer = updatedGame.players[currentPlayerIndex];

    setGame(updatedGame);
    if (gameEngineRef.current) {
      gameEngineRef.current.setState(updatedGame);
    }
    
    // Sauvegarder l'état d'interaction actuel avant de le changer pour l'historique
    const previousInteractionState = interactionStateOverride || interactionState;

    setInteractionState({ type: 'IDLE' });
    setIsTechOpen(false);
    setHasPerformedMainAction(true);
    setToast({ message: `Technologie ${tech.name} acquise !`, visible: true });
    
    let category = "";
    if (tech.id.startsWith('exploration')) category = "Exploration";
    else if (tech.id.startsWith('observation')) category = "Observation";
    else if (tech.id.startsWith('computing')) category = "Informatique";

    const gainsText = gains.length > 0 ? ` et gagne : ${gains.join(', ')}` : '';
    
    // Si on est en train de rechercher (Action principale), on fusionne avec l'entrée de rotation
    if (previousInteractionState.type === 'RESEARCHING') {
      setHistoryLog(prev => {
        // Trouver l'entrée de la rotation (dernière entrée avec un état précédent sauvegardé)
        let rotationEntryIndex = -1;
        for (let i = prev.length - 1; i >= 0; i--) {
          if (prev[i].previousState) {
            rotationEntryIndex = i;
            break;
          }
        }
        
        if (rotationEntryIndex !== -1) {
          const rotationEntry = prev[rotationEntryIndex];
          
          const newEntry: HistoryEntry = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            message: `acquiert la technologie "${category} ${tech.name}"${gainsText}`,
            playerId: currentPlayer.id,
            previousState: rotationEntry.previousState, // État AVANT la rotation
            previousInteractionState: rotationEntry.previousInteractionState, // État IDLE
            previousHasPerformedMainAction: rotationEntry.previousHasPerformedMainAction,
            previousPendingInteractions: rotationEntry.previousPendingInteractions,
            timestamp: Date.now()
          };
          
          // Remplacer l'entrée de rotation (et les logs intermédiaires) par la nouvelle entrée
          return [...prev.slice(0, rotationEntryIndex), newEntry];
        }
        
        // Fallback si pas d'entrée précédente trouvée (ne devrait pas arriver)
        const fallbackEntry: HistoryEntry = {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          message: `acquiert la technologie "${category} ${tech.name}"${gainsText}`,
          playerId: currentPlayer.id,
          previousState: currentGame,
          previousInteractionState: { type: 'IDLE' },
          previousHasPerformedMainAction: hasPerformedMainAction,
          previousPendingInteractions: pendingInteractions,
          timestamp: Date.now()
        };
        return [...prev, fallbackEntry];
      });
    } else {
      // Sinon (Bonus), on ajoute une nouvelle entrée atomique
      const sequenceId = (previousInteractionState as any).sequenceId;
      addToHistory(`acquiert la technologie "${category} ${tech.name}"${gainsText}`, currentPlayer.id, currentGame, previousInteractionState, sequenceId);
    }
  };

  // Gestionnaire pour l'achat de technologie (clic initial)
  const handleTechClick = (tech: Technology) => {
    // Cas 1: Mode recherche actif ou bonus
    if (interactionState.type === 'RESEARCHING' || interactionState.type === 'SELECTING_TECH_BONUS') {
        if (tech.id.startsWith('computing')) {
          const sequenceId = (interactionState as any).sequenceId;
          setInteractionState({ type: 'SELECTING_COMPUTER_SLOT', tech, sequenceId });
          setToast({ message: "Sélectionnez une colonne (1, 3, 5, 6) sur l'ordinateur", visible: true });
          return;
        }
        processTechPurchase(tech);
        return;
    }

    // Cas 2: Clic direct depuis IDLE (Raccourci Action Recherche)
    if (interactionState.type === 'IDLE' && !hasPerformedMainAction) {
        const currentPlayer = game.players[game.currentPlayerIndex];
        if (currentPlayer.mediaCoverage < GAME_CONSTANTS.TECH_RESEARCH_COST_MEDIA) {
            setToast({ message: `Pas assez de couverture médiatique (Requis: ${GAME_CONSTANTS.TECH_RESEARCH_COST_MEDIA})`, visible: true });
            return;
        }

        // Exécuter la rotation (Logique copiée de handleAction RESEARCH_TECH)
        let updatedGame = structuredClone(game);
        const player = updatedGame.players[updatedGame.currentPlayerIndex];

        // Payer le coût
        player.mediaCoverage -= GAME_CONSTANTS.TECH_RESEARCH_COST_MEDIA;

        // Rotation
        updatedGame.board = {
            ...updatedGame.board,
            solarSystem: { ...updatedGame.board.solarSystem },
            technologyBoard: { ...updatedGame.board.technologyBoard }
        };

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
        
        // Ajouter les logs de rotation
        addToHistory(`paye ${GAME_CONSTANTS.TECH_RESEARCH_COST_MEDIA} médias et fait tourner le système solaire (Niveau ${currentLevel}) pour rechercher une technologie`, player.id, game);
        rotationResult.logs.forEach(log => addToHistory(log));

        // Traiter l'achat ou la sélection de slot
        if (tech.id.startsWith('computing')) {
            setGame(updatedGame);
            if (gameEngineRef.current) gameEngineRef.current.setState(updatedGame);
            setInteractionState({ type: 'SELECTING_COMPUTER_SLOT', tech });
            setToast({ message: "Système pivoté. Sélectionnez une colonne (1, 3, 5, 6) sur l'ordinateur", visible: true });
        } else {
            // Achat direct avec fusion des logs (simule RESEARCHING)
            processTechPurchase(tech, undefined, updatedGame, { type: 'RESEARCHING' });
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
    const playerAny = currentPlayer as any;
    const topSlotId = `${col}a`;
    if (playerAny.computer?.slots?.[topSlotId]?.bonus === '2pv') {
      setToast({ message: "Emplacement déjà occupé par une technologie", visible: true });
      return;
    }

    // Finaliser l'achat
    if (interactionState.isBonus) {
        processTechBonus(interactionState.tech, col);
    } else {
        processTechPurchase(interactionState.tech, col);
    }
  };

  // Gestionnaire pour la pioche de carte depuis le PlayerBoardUI (ex: bonus ordinateur)
  const handleDrawCard = (count: number, source: string) => {
    const updatedGame = CardSystem.drawCards(game, game.players[game.currentPlayerIndex].id, count, source);
    setGame(updatedGame);
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
  const handleComputerBonus = (type: string, amount: number) => {
    if (type === 'reservation') {
      const sequenceId = (interactionState as any).sequenceId;
      setInteractionState({ type: 'RESERVING_CARD', count: amount, sequenceId });
      setToast({ message: `Réservation active : Sélectionnez ${amount} carte(s) avec revenu`, visible: true });
    }
  };

  // Gestionnaire pour la réservation de carte
  const handleReserveCard = (cardId: string) => {
    if (interactionState.type !== 'RESERVING_CARD') return;

    const updatedGame = { ...game };
    updatedGame.players = updatedGame.players.map(p => ({ ...p }));
    const currentPlayer = updatedGame.players[updatedGame.currentPlayerIndex];
    
    // Copier le tableau de cartes pour éviter de muter l'état précédent (qui est utilisé pour l'historique)
    currentPlayer.cards = [...currentPlayer.cards];

    const cardIndex = currentPlayer.cards.findIndex(c => c.id === cardId);
    if (cardIndex === -1) return;
    const card = currentPlayer.cards[cardIndex];

    if (!card.revenue) {
      setToast({ message: "Cette carte n'a pas de bonus de revenu", visible: true });
      return;
    }

    // Retirer la carte
    currentPlayer.cards.splice(cardIndex, 1);

    // Appliquer le bonus
    let gainMsg = "";
    if (card.revenue === RevenueBonus.CREDIT) {
      currentPlayer.revenueCredits += 1;
      currentPlayer.credits += 1;
      gainMsg = "1 Crédit";
    } else if (card.revenue === RevenueBonus.ENERGY) {
      currentPlayer.revenueEnergy += 1;
      currentPlayer.energy += 1;
      gainMsg = "1 Énergie";
    } else if (card.revenue === RevenueBonus.CARD) {
      currentPlayer.revenueCards += 1;
      gainMsg = "1 Carte";
    }

    const sequenceId = (interactionState as any).sequenceId;
    addToHistory(`réserve la carte "${card.name}" et gagne immédiatement : ${gainMsg}`, currentPlayer.id, game, interactionState, sequenceId);

    // Si le bonus est une carte, on pioche immédiatement
    if (card.revenue === RevenueBonus.CARD) {
       const drawResult = CardSystem.drawCards(updatedGame, currentPlayer.id, 1, 'Bonus immédiat réservation');
       setGame(drawResult);
       if (gameEngineRef.current) gameEngineRef.current.setState(drawResult);
    } else {
       setGame(updatedGame);
       if (gameEngineRef.current) gameEngineRef.current.setState(updatedGame);
    }

    // Mettre à jour l'état d'interaction
    const newCount = interactionState.count - 1;
    if (newCount > 0) {
      setInteractionState({ type: 'RESERVING_CARD', count: newCount });
      setToast({ message: `Encore ${newCount} carte(s) à réserver`, visible: true });
    } else {
      setInteractionState({ type: 'IDLE' });
      setToast({ message: "Réservation terminée", visible: true });
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
    upPlayer.claimedMilestones.push(interactionState.milestone);
    
    setGame(updatedGame);
    if (gameEngineRef.current) gameEngineRef.current.setState(updatedGame);

    addToHistory(`a atteint le palier ${interactionState.milestone} PV et place un marqueur sur "${tile.name}" (Points fin de partie)`, upPlayer.id, game, interactionState);
    
    setInteractionState({ type: 'IDLE' });
    setToast({ message: `Marqueur placé !`, visible: true });

    // Continuer la fin de tour (vérifier d'autres paliers ou passer au joueur suivant)
    handleNextPlayer();
  };

  // Utiliser les positions initiales depuis le jeu
  const initialSector1 = game.board.solarSystem.initialSectorLevel1 || 1;
  const initialSector2 = game.board.solarSystem.initialSectorLevel2 || 1;
  const initialSector3 = game.board.solarSystem.initialSectorLevel3 || 1;

  // Helper pour la couleur des secteurs
  const getSectorColorCode = (color: SectorColor) => {
    switch(color) {
        case SectorColor.BLUE: return '#4a9eff';
        case SectorColor.RED: return '#ff6b6b';
        case SectorColor.YELLOW: return '#ffd700';
        case SectorColor.BLACK: return '#aaaaaa';
        default: return '#fff';
    }
  };

  const renderCardTooltip = (card: any) => (
    <div style={{ width: '240px', textAlign: 'left' }}>
      <div style={{ fontWeight: 'bold', color: '#4a9eff', fontSize: '1.1rem', marginBottom: '6px', borderBottom: '1px solid #444', paddingBottom: '4px' }}>{card.name}</div>
      <div style={{ fontSize: '0.95em', color: '#fff', marginBottom: '10px', lineHeight: '1.4' }}>{card.description}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '0.85em', backgroundColor: 'rgba(255,255,255,0.05)', padding: '8px', borderRadius: '4px' }}>
         <div>Coût: <span style={{ color: '#ffd700', fontWeight: 'bold' }}>{card.cost}</span></div>
         <div>Type: {card.type === 'ACTION' ? 'Action' : 'Mission'}</div>
         <div>Act: <span style={{ color: '#aaffaa' }}>{card.freeAction}</span></div>
         <div>Rev: <span style={{ color: '#aaffaa' }}>{card.revenue}</span></div>
         <div style={{ gridColumn: '1 / -1', marginTop: '4px', paddingTop: '4px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>Scan: <span style={{ color: getSectorColorCode(card.scanSector), fontWeight: 'bold' }}>{card.scanSector}</span></div>
      </div>
    </div>
  );
  
  const humanPlayer = game.players.find(p => (p as any).type === 'human');
  const currentPlayerIdToDisplay = viewedPlayerId || humanPlayer?.id;

  return (
    <div className="seti-root">
      <style>{`
        .seti-root {
          height: 100vh;
          width: 100vw;
          overflow: hidden;
          background-color: #1a1a2e;
          color: #fff;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        .seti-root-inner {
          display: flex;
          flex-direction: row;
          height: 100%;
          padding: 10px;
          box-sizing: border-box;
          gap: 10px;
        }
        .seti-left-panel {
          display: flex;
          flex-direction: column;
          gap: 10px;
          flex: 1;
          min-width: 300px;
          height: 100%;
          overflow-y: auto;
        }
        .seti-right-column {
          display: flex;
          flex-direction: column;
          flex: 2;
          min-width: 0;
          gap: 10px;
          height: 100%;
        }
        .seti-center-panel {
          position: relative;
          flex: 1;
          height: 100%;
          width: 100%;
          overflow: hidden;
          border-radius: 8px;
          background-color: rgba(0, 0, 0, 0.2);
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
        .seti-bottom-layout {
          display: flex;
          gap: 10px;
          height: 35vh;
          flex-shrink: 0;
          min-height: 250px;
        }
        .seti-player-area {
          flex: 3;
          min-width: 0;
          display: flex;
          flex-direction: column;
        }
        .seti-history-area {
          flex: 1;
          min-width: 250px;
          display: flex;
          flex-direction: column;
        }
        @media (max-width: 768px) {
          .seti-root { height: auto; min-height: 100vh; overflow-y: auto; }
          .seti-root-inner { flex-direction: column; height: auto; overflow: visible; }
          .seti-left-panel { width: 100%; min-width: 0; max-width: none; height: auto; }
          .seti-right-column { height: auto; flex: none; }
          .seti-center-panel { display: block; height: auto; padding-bottom: 0; overflow: visible; flex: none; }
          .seti-bottom-layout { flex-direction: column; height: auto; flex: none; }
          .seti-player-area { width: 100%; flex: none; }
          .seti-history-area { width: 100%; height: 300px; flex: none; }
        }
        
        /* Styles pour les panneaux repliables */
        .seti-foldable-container {
          background-color: rgba(30, 30, 40, 0.9);
          border: 1px solid #555;
          border-radius: 6px;
          overflow: hidden;
          transition: max-height 0.5s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s ease, border-color 0.3s ease;
          max-height: 40px; /* Hauteur du header */
          display: flex;
          flex-direction: column;
          flex-shrink: 0;
          position: relative;
          z-index: 10;
        }
        .seti-foldable-container:hover, .seti-foldable-container.open {
          max-height: 80vh; /* Assez grand pour le contenu */
          box-shadow: 0 4px 12px rgba(0,0,0,0.5);
          border-color: #4a9eff;
          z-index: 20;
        }
        .seti-foldable-header {
          padding: 0 10px;
          color: #fff;
          font-weight: bold;
          cursor: pointer;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background-color: #333;
          height: 40px;
          min-height: 40px;
          box-sizing: border-box;
        }
        .seti-foldable-header::after {
          content: '▼';
          font-size: 0.8em;
          transition: transform 0.3s;
        }
        .seti-foldable-container:hover .seti-foldable-header::after, .seti-foldable-container.open .seti-foldable-header::after {
          transform: rotate(180deg);
        }
        .seti-foldable-content {
          padding: 10px;
          overflow-y: auto;
          opacity: 0;
          transition: opacity 0.2s ease;
        }
        .seti-foldable-container:hover .seti-foldable-content, .seti-foldable-container.open .seti-foldable-content {
          opacity: 1;
          transition: opacity 0.5s ease 0.1s;
        }
        /* Overrides pour les composants internes */
        .seti-foldable-content .seti-panel {
          border: none !important;
          background: transparent !important;
          padding: 0 !important;
          box-shadow: none !important;
          margin: 0 !important;
        }
        .seti-foldable-content .seti-panel-title {
          display: none !important;
        }
        @keyframes cardAppear {
          from { opacity: 0; transform: translateY(-20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .seti-history-container:hover, .seti-history-container.open {
          max-height: 33vh !important;
        }
      `}</style>
      {/* Toast Notification */}
      {toast && toast.visible && (
        <div style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          color: '#4a9eff',
          padding: '12px 24px',
          borderRadius: '8px',
          zIndex: 9999,
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
          border: '1px solid #4a9eff',
          fontWeight: 'bold',
          pointerEvents: 'none',
          transition: 'opacity 0.3s ease-in-out',
        }}>
          {toast.message}
        </div>
      )}

      {activeTooltip && (
        <Tooltip content={activeTooltip.content} targetRect={activeTooltip.rect} />
      )}
      
      {/* Modale de sélection de carte de fin de manche */}
      {passModalState.visible && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.85)',
          zIndex: 2000,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '20px', color: '#fff' }}>
            Fin de manche : Choisissez une carte
          </div>
          <div style={{ 
            display: 'flex', 
            gap: '15px', 
            flexWrap: 'wrap', 
            justifyContent: 'center', 
            maxWidth: '800px',
            maxHeight: '60vh',
            overflowY: 'auto',
            padding: '10px'
          }}>
            {passModalState.cards.map(card => (
              <div 
                key={card.id}
                onClick={() => setPassModalState(prev => ({ ...prev, selectedCardId: card.id }))}
                style={{
                  width: '140px',
                  padding: '10px',
                  backgroundColor: passModalState.selectedCardId === card.id ? 'rgba(74, 158, 255, 0.2)' : 'rgba(255,255,255,0.05)',
                  border: passModalState.selectedCardId === card.id ? '2px solid #4a9eff' : '1px solid #555',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  transform: passModalState.selectedCardId === card.id ? 'scale(1.05)' : 'scale(1)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '5px'
                }}
              >
                <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{card.name}</div>
                <div style={{ fontSize: '0.8rem', color: '#aaa' }}>{card.description}</div>
              </div>
            ))}
          </div>
          <button
            disabled={!passModalState.selectedCardId}
            onClick={() => {
              if (passModalState.selectedCardId) {
                const currentPlayer = game.players[game.currentPlayerIndex];
                // Recalculer les cartes à garder (au cas où on vient de la défausse)
                const cardsToKeep = passModalState.cardsToKeep || currentPlayer.cards.map(c => c.id);
                performPass(cardsToKeep, passModalState.selectedCardId);
                setPassModalState({ visible: false, cards: [], selectedCardId: null });
              }
            }}
            style={{
              marginTop: '30px',
              padding: '10px 30px',
              fontSize: '1.1rem',
              backgroundColor: passModalState.selectedCardId ? '#4a9eff' : '#555',
              color: passModalState.selectedCardId ? '#fff' : '#aaa',
              border: 'none',
              borderRadius: '6px',
              cursor: passModalState.selectedCardId ? 'pointer' : 'not-allowed',
            }}
          >
            Confirmer et Passer
          </button>
        </div>
      )}

      {/* Menu de choix des bonus interactifs */}
      {interactionState.type === 'CHOOSING_BONUS_ACTION' && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 2000,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            backgroundColor: '#2a2a2a', padding: '20px', borderRadius: '8px',
            maxWidth: '500px', width: '90%', border: '1px solid #4a9eff',
            boxShadow: '0 0 20px rgba(74, 158, 255, 0.2)'
          }}>
            <h3 style={{ marginTop: 0, color: '#4a9eff' }}>Récompenses</h3>
            <p style={{ fontSize: '1.1em', marginBottom: '20px', color: '#ddd' }}>{interactionState.bonusesSummary}</p>
            <p style={{ fontSize: '0.9em', marginBottom: '10px', color: '#aaa' }}>Quelles actions voulez-vous effectuer ?</p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {interactionState.choices.map((choice, idx) => (
                <button
                  key={choice.id}
                  onClick={() => handleMenuChoice(idx)}
                  disabled={choice.done}
                  style={{
                    padding: '12px',
                    backgroundColor: choice.done ? '#444' : '#4a9eff',
                    color: choice.done ? '#888' : '#fff',
                    border: 'none', borderRadius: '4px',
                    cursor: choice.done ? 'default' : 'pointer',
                    textAlign: 'left', fontWeight: 'bold',
                    display: 'flex', justifyContent: 'space-between',
                    opacity: choice.done ? 0.6 : 1
                  }}
                >
                  <span>{choice.label}</span>
                  {choice.done && <span>✓</span>}
                </button>
              ))}
            </div>
            
            {interactionState.choices.every(c => c.done) && (
              <button
                onClick={() => setInteractionState({ type: 'IDLE' })}
                style={{
                  marginTop: '20px', width: '100%', padding: '10px',
                  backgroundColor: '#4caf50', color: '#fff', border: 'none', borderRadius: '4px',
                  cursor: 'pointer', fontWeight: 'bold'
                }}
              >
                Terminer
              </button>
            )}
          </div>
        </div>
      )}

      {/* Overlay pour la recherche de technologie ou l'achat de carte */}
      {(interactionState.type === 'RESEARCHING' || interactionState.type === 'SELECTING_TECH_BONUS' || interactionState.type === 'BUYING_CARD' || interactionState.type === 'RESERVING_CARD') && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          zIndex: 1500,
          backdropFilter: 'blur(2px)'
        }} onClick={() => {
          if (interactionState.type === 'BUYING_CARD') {
             setInteractionState({ type: 'IDLE' });
             setIsRowOpen(false);
          } else if (interactionState.type === 'RESERVING_CARD') {
             setToast({ message: "Veuillez sélectionner une carte à réserver", visible: true });
          } else {
             setToast({ message: "Veuillez sélectionner une technologie", visible: true });
          }
        }} />
      )}

      <div className="seti-root-inner">
        <div className="seti-left-panel">
            <div style={{ 
              flex: 1, 
              display: 'flex', 
              flexDirection: 'column', 
              minHeight: 0,
              position: interactionState.type === 'RESERVING_CARD' ? 'relative' : 'static',
              zIndex: interactionState.type === 'RESERVING_CARD' ? 1501 : 'auto'
            }}>
              <PlayerBoardUI 
                game={game} 
                playerId={currentPlayerIdToDisplay}
                onViewPlayer={setViewedPlayerId}
                onAction={handleAction} 
                isDiscarding={interactionState.type === 'DISCARDING'}
                selectedCardIds={interactionState.type === 'DISCARDING' ? interactionState.cardsToDiscard : []}
                onCardClick={handleCardClick}
                onConfirmDiscard={handleConfirmDiscard}
                onDiscardCardAction={handleDiscardCardAction}
                onPlayCard={handlePlayCard}
                onBuyCardAction={handleBuyCardAction}
                onTradeResourcesAction={() => handleTrade('START')}
                tradeState={{ phase: interactionState.type === 'TRADING_SPEND' ? 'spending' : (interactionState.type === 'TRADING_GAIN' ? 'gaining' : 'inactive'), spend: interactionState.type === 'TRADING_GAIN' ? { type: interactionState.spendType, cardIds: interactionState.spendCardIds } : undefined }}
                onSpendSelection={(spendType, cardIds) => handleTrade('SPEND', { spendType, cardIds })}
                onGainSelection={(gainType) => handleTrade('GAIN', { gainType })}
                onCancelTrade={() => handleTrade('CANCEL')}
                onGameUpdate={(newGame) => setGame(newGame)}
                isSelectingComputerSlot={interactionState.type === 'SELECTING_COMPUTER_SLOT'}
                onComputerSlotSelect={handleComputerColumnSelect}
                onDrawCard={handleDrawCard}
                isAnalyzing={interactionState.type === 'ANALYZING'}
                hasPerformedMainAction={hasPerformedMainAction}
                onNextPlayer={handleNextPlayer}
                onHistory={(message) => addToHistory(message, game.players[game.currentPlayerIndex].id, game)}
                onComputerBonus={handleComputerBonus}
                reservationState={interactionState.type === 'RESERVING_CARD' ? { active: true, count: interactionState.count } : { active: false, count: 0 }}
                onReserveCard={handleReserveCard}
                isPlacingLifeTrace={interactionState.type === 'PLACING_LIFE_TRACE'}
              />
            </div>
        </div>
        <div className="seti-right-column">
          <div className="seti-center-panel">
            <SolarSystemBoardUI 
              ref={solarSystemRef} 
              game={game} 
              onProbeMove={handleProbeMove} 
              onPlanetClick={handlePlanetClick}
              onOrbit={handleOrbit}
              onLand={handleLand}
              initialSector1={initialSector1} 
              initialSector2={initialSector2} 
              initialSector3={initialSector3}
              highlightPlayerProbes={interactionState.type === 'FREE_MOVEMENT'}
              hasPerformedMainAction={hasPerformedMainAction}
            />

            {/* Plateaux annexes en haut à gauche */}
            <div style={{
              position: 'absolute',
              top: '15px',
              left: '15px',
              width: '560px',
              zIndex: (interactionState.type === 'RESEARCHING' || interactionState.type === 'SELECTING_TECH_BONUS' || interactionState.type === 'BUYING_CARD') ? 1501 : 1000,
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              maxHeight: 'calc(100% - 30px)',
              overflowY: 'auto',
              pointerEvents: 'none',
            }}>
              <div className={`seti-foldable-container ${isObjectivesOpen ? 'open' : ''}`} style={{ pointerEvents: 'auto' }}>
                <div className="seti-foldable-header" onClick={() => setIsObjectivesOpen(!isObjectivesOpen)}>Objectifs</div>
                <div className="seti-foldable-content">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {game.board.objectiveTiles && game.board.objectiveTiles.map(tile => (
                      <div key={tile.id} 
                        onClick={() => handleObjectiveClick(tile.id)}
                        style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        border: interactionState.type === 'PLACING_OBJECTIVE_MARKER' ? '1px solid #4a9eff' : '1px solid #555',
                        borderRadius: '6px',
                        padding: '8px',
                        display: 'flex',
                        cursor: interactionState.type === 'PLACING_OBJECTIVE_MARKER' ? 'pointer' : 'default',
                        boxShadow: interactionState.type === 'PLACING_OBJECTIVE_MARKER' ? '0 0 10px rgba(74, 158, 255, 0.3)' : 'none',
                        flexDirection: 'column',
                        gap: '4px',
                        minHeight: '100px'
                      }}>
                        <div style={{ fontSize: '0.7em', color: '#ccc', fontStyle: 'italic', marginBottom: 'auto' }}>{tile.description}</div>
                        
                        {/* Piste de score avec 4 cercles */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px', position: 'relative', padding: '0 5px' }}>
                          {/* Ligne de connexion */}
                          <div style={{ position: 'absolute', top: '50%', left: '10px', right: '10px', height: '2px', backgroundColor: '#555', zIndex: 0 }}></div>
                          
                          {/* Cercles (1er, 2eme, Autre, Autre) */}
                          {[tile.rewards.first, tile.rewards.second, tile.rewards.others, tile.rewards.others].map((pv, idx) => {
                            const markerPlayerId = tile.markers[idx];
                            const player = markerPlayerId ? game.players.find(p => p.id === markerPlayerId) : null;
                            
                            const currentPlayer = game.players[game.currentPlayerIndex];
                            const isPlacingMarker = interactionState.type === 'PLACING_OBJECTIVE_MARKER';
                            const hasMarkerOnTile = tile.markers.includes(currentPlayer.id);
                            const isNextAvailable = isPlacingMarker && !hasMarkerOnTile && idx === tile.markers.length;

                            return (
                              <div key={idx} style={{
                                width: '22px', height: '22px', borderRadius: '50%',
                                backgroundColor: player ? (player.color || '#fff') : (isNextAvailable ? 'rgba(74, 158, 255, 0.3)' : '#222'),
                                border: player ? '2px solid #fff' : (isNextAvailable ? '2px solid #4a9eff' : '1px solid #777'),
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                zIndex: 1, fontSize: '0.75em', fontWeight: 'bold',
                                color: player ? '#000' : '#fff', 
                                boxShadow: isNextAvailable ? '0 0 8px #4a9eff' : (player ? '0 0 4px rgba(0,0,0,0.5)' : 'none'),
                                transform: isNextAvailable ? 'scale(1.2)' : 'scale(1)',
                                transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                                cursor: isNextAvailable ? 'pointer' : 'default',
                              }}>
                                {player ? '' : pv}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className={`seti-foldable-container ${isTechOpen ? 'open' : ''}`}
                  style={{ 
                    pointerEvents: 'auto',
                    ...(interactionState.type === 'RESEARCHING' || interactionState.type === 'SELECTING_TECH_BONUS' ? { borderColor: '#4a9eff', boxShadow: '0 0 20px rgba(74, 158, 255, 0.3)' } : {})
                  }}
              >
                <div className="seti-foldable-header" onClick={() => setIsTechOpen(!isTechOpen)}>Technologies</div>
                <div className="seti-foldable-content">
                  <TechnologyBoardUI 
                    game={game} 
                    isResearching={interactionState.type === 'RESEARCHING' || interactionState.type === 'SELECTING_TECH_BONUS'}
                    researchCategory={interactionState.type === 'SELECTING_TECH_BONUS' ? interactionState.category : undefined}
                    onTechClick={handleTechClick}
                    hasPerformedMainAction={hasPerformedMainAction}
                  />
                </div>
              </div>
              
              <div className={`seti-foldable-container ${isRowOpen ? 'open' : ''}`}
                  style={{ 
                    pointerEvents: 'auto',
                    ...(interactionState.type === 'BUYING_CARD' ? { borderColor: '#4a9eff', boxShadow: '0 0 20px rgba(74, 158, 255, 0.3)' } : {})
                  }}
              >
                <div className="seti-foldable-header" onClick={() => setIsRowOpen(!isRowOpen)}>Rangée Principale</div>
                <div className="seti-foldable-content">
                <div style={{ display: 'flex', overflowX: 'auto', gap: '8px', padding: '8px' }}>
                  {/* Pile de pioche */}
                  <div 
                      onClick={() => handleCardRowClick()}
                      className="seti-common-card"
                      style={{
                      justifyContent: 'center',
                      alignItems: 'center',
                      gap: '4px',
                      backgroundImage: 'repeating-linear-gradient(45deg, #222 0, #222 10px, #2a2a2a 10px, #2a2a2a 20px)',
                      cursor: interactionState.type === 'BUYING_CARD' ? 'pointer' : 'default',
                      borderColor: interactionState.type === 'BUYING_CARD' ? '#4a9eff' : '#555'
                    }}>
                      <div style={{ fontWeight: 'bold', color: '#aaa', textAlign: 'center' }}>Pioche</div>
                      <div style={{ fontSize: '0.8em', color: '#888' }}>{game.decks?.actionCards?.length || 0} cartes</div>
                  </div>

                  {game.cardRow && game.cardRow.map(card => (
                    <div key={card.id} 
                      onClick={() => handleCardRowClick(card.id)}
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setActiveTooltip({ content: renderCardTooltip(card), rect });
                      }}
                      onMouseLeave={() => setActiveTooltip(null)}
                      className="seti-common-card"
                      style={{
                      border: interactionState.type === 'BUYING_CARD' ? '1px solid #4a9eff' : '1px solid #555',
                      cursor: interactionState.type === 'BUYING_CARD' ? 'pointer' : 'default',
                      animation: 'cardAppear 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)'
                    }}>
                      <div style={{ fontWeight: 'bold', color: '#fff', lineHeight: '1.1', marginBottom: '4px', fontSize: '0.75rem', height: '2.2em', overflow: 'hidden' }}>{card.name}</div>
                      <div style={{ fontSize: '0.75em', color: '#aaa' }}>Coût: <span style={{ color: '#ffd700' }}>{card.cost}</span></div>
                      {card.description && <div style={{ fontSize: '0.7em', color: '#ccc', fontStyle: 'italic', margin: '4px 0', lineHeight: '1.2', flex: 1, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', textOverflow: 'ellipsis' }}>{card.description}</div>}
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75em', color: '#ddd', marginBottom: '2px' }}>
                          {card.freeAction && <div>Act: {card.freeAction}</div>}
                          {card.revenue && <div>Rev: {card.revenue}</div>}
                      </div>
                      <div style={{ 
                        marginTop: 'auto', 
                        padding: '4px', 
                        backgroundColor: 'rgba(255,255,255,0.05)', 
                        borderRadius: '4px', 
                        textAlign: 'center',
                        border: `1px solid ${getSectorColorCode(card.scanSector)}`,
                      }}>
                        <div style={{ fontSize: '0.7em', textTransform: 'uppercase', color: '#ddd', marginBottom: '2px' }}>Scan</div>
                        <div style={{ 
                          color: getSectorColorCode(card.scanSector), 
                          fontWeight: 'bold',
                          fontSize: '1.1em'
                        }}>
                          {card.scanSector}
                        </div>
                      </div>
                    </div>
                  ))}
                  {(!game.cardRow || game.cardRow.length === 0) && (
                      <div style={{ gridColumn: '2 / -1', color: '#888', fontStyle: 'italic', padding: '10px', textAlign: 'center' }}>Aucune carte disponible</div>
                  )}
                </div>
                </div>
              </div>
            </div>

            {/* Historique en haut à droite */}
            <div style={{
              position: 'absolute',
              top: '15px',
              right: '15px',
              width: '300px',
              zIndex: 1000,
              display: 'flex',
              flexDirection: 'column',
              pointerEvents: 'none'
            }}>
              <div className={`seti-foldable-container seti-history-container ${isHistoryOpen ? 'open' : ''}`} style={{ display: 'flex', flexDirection: 'column', pointerEvents: 'auto' }}>
               <div className="seti-foldable-header" onClick={() => setIsHistoryOpen(!isHistoryOpen)}>
                  <span style={{ flex: 1 }}>Historique</span>
                  {historyLog.length > 0 && historyLog[historyLog.length - 1].previousState && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleUndo(); }} 
                      style={{ fontSize: '0.7rem', padding: '2px 6px', cursor: 'pointer', backgroundColor: '#555', border: '1px solid #777', color: '#fff', borderRadius: '4px', marginRight: '5px' }} 
                      title="Annuler la dernière action"
                    >
                      ↩
                    </button>
                  )}
               </div>
               <div className="seti-foldable-content" ref={historyContentRef} style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
                 <div className="seti-history-list">
                  {historyLog.length === 0 && <div style={{fontStyle: 'italic', padding: '4px', textAlign: 'center'}}>Aucune action</div>}
                  {historyLog.map((entry, index) => {
                    if (entry.message.startsWith('---')) {
                      return (
                        <div key={entry.id} style={{ display: 'flex', alignItems: 'center', margin: '10px 0', color: '#aaa', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          <div style={{ flex: 1, height: '1px', backgroundColor: '#555' }}></div>
                          <div style={{ padding: '0 10px' }}>{entry.message.replace(/---/g, '').trim()}</div>
                          <div style={{ flex: 1, height: '1px', backgroundColor: '#555' }}></div>
                        </div>
                      );
                    }

                    const isSequence = !!entry.sequenceId;
                    const prevEntry = index > 0 ? historyLog[index - 1] : null;
                    const nextEntry = index < historyLog.length - 1 ? historyLog[index + 1] : null;
                    
                    // Est un enfant si fait partie d'une séquence et que le précédent aussi (même séquence)
                    const isSequenceChild = isSequence && prevEntry && prevEntry.sequenceId === entry.sequenceId;
                    // Est le dernier enfant si le suivant n'est pas dans la même séquence
                    //const isLastChild = isSequenceChild && (!nextEntry || nextEntry.sequenceId !== entry.sequenceId);
                    
                    let player = entry.playerId ? game.players.find(p => p.id === entry.playerId) : null;
                    // Fallback : essayer de trouver le joueur par son nom au début du message (pour les logs d'init)
                    if (!player) {
                        player = game.players.find(p => entry.message.startsWith(p.name));
                    }

                    const color = player ? (player.color || '#ccc') : '#ccc';
                    return (
                      <div key={entry.id} className="seti-history-item" style={{ 
                          borderLeft: `3px solid ${color}`, 
                          paddingLeft: '8px', 
                          marginBottom: '2px',
                          display: 'flex',
                          alignItems: 'flex-start',
                          backgroundColor: isSequenceChild ? 'rgba(255,255,255,0.02)' : 'transparent'
                      }}>
                        {isSequenceChild && (
                            <div style={{ 
                                marginRight: '6px', 
                                color: '#666', 
                                fontFamily: 'monospace',
                                fontSize: '1.1em',
                                lineHeight: '1.4',
                                userSelect: 'none'
                            }}>
                                └─ {/* {isLastChild ? '└─' : '├─'} */}
                            </div>
                        )}
                        <div style={{ flex: 1, padding: '2px 0' }}>
                            <span style={{ color: '#ddd', fontSize: isSequenceChild ? '0.9em' : '1em' }}>
                                {player && !entry.message.startsWith(player.name) && <strong style={{ color: color }}>{player.name} </strong>}
                                {formatHistoryMessage(entry.message)}
                            </span>
                        </div>
                      </div>
                    );
                  })}
                 </div>
               </div>
            </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
