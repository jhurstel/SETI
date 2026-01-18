import React, { useRef, useState, useEffect, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Game, ActionType, DiskName, SectorNumber, FreeActionType, GAME_CONSTANTS, SectorColor, Technology, RevenueType, ProbeState, TechnologyCategory, MILESTONES, CardType } from '../core/types';
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

/**
 * Représente les différents états d'interaction possibles pour le joueur.
 * L'état 'IDLE' est l'état par défaut où le joueur peut initier une action principale.
 * Tous les autres états représentent une interaction en cours qui bloque les actions principales.
 */
type InteractionState = 
  /** Le joueur est en attente, aucune interaction en cours. */
  | { type: 'IDLE' }
  /** Le joueur a un bonus de réservation et doit choisir une carte à glisser sous son plateau. */
  | { type: 'RESERVING_CARD', count: number, sequenceId?: string, selectedCards: string[] }
  /** Le joueur doit défausser des cartes (ex: fin de manche). */
  | { type: 'DISCARDING_CARD', selectedCards: string[] }
  /** Le joueur a initié un échange et doit choisir la ressource à dépenser. */
  | { type: 'TRADING_CARD', targetGain: string, selectedCards: string[] }
  /** Le joueur acquiert une carte (gratuitement ou en payant) et doit la sélectionner dans la pioche ou la rangée. */
  | { type: 'ACQUIRING_CARD', count: number, isFree?: boolean, sequenceId?: string, triggerFreeAction?: boolean }
  /** Le joueur a des déplacements gratuits à effectuer. */
  | { type: 'MOVING_PROBE', count: number, autoSelectProbeId?: string }
  /** Le joueur a un atterrissage gratuit (ex: Carte 13). */
  | { type: 'LANDING_PROBE', count: number, source?: string, sequenceId?: string }
  /** Le joueur acquiert une technologie (en payant ou en bonus) et doit la sélectionner. */
  | { type: 'ACQUIRING_TECH', isBonus: boolean, sequenceId?: string, category?: TechnologyCategory, sharedOnly?: boolean, noTileBonus?: boolean }
  /** Le joueur a choisi une technologie "Informatique" et doit sélectionner une colonne sur son ordinateur. */
  | { type: 'SELECTING_COMPUTER_SLOT', tech: Technology, sequenceId?: string }
  /** Le joueur a lancé l'action "Analyser", principalement pour l'animation. */
  | { type: 'ANALYZING' }
  /** Le joueur a analysé des données et doit placer une trace de vie sur le plateau Alien. */
  | { type: 'PLACING_LIFE_TRACE', color: 'blue' | 'red' | 'yellow', sequenceId?: string }
  /** Le joueur a atteint un palier de score et doit placer un marqueur sur un objectif. */
  | { type: 'PLACING_OBJECTIVE_MARKER', milestone: number }
  /** Le joueur a reçu plusieurs bonus interactifs et doit choisir l'ordre de résolution. */
  | { 
      type: 'CHOOSING_BONUS_ACTION', 
      bonusesSummary: string, 
      choices: { id: string, label: string, state: InteractionState, done: boolean }[],
      sequenceId?: string
    };

// Helper pour les libellés des interactions
const getInteractionLabel = (state: InteractionState): string => {
  switch (state.type) {
    case 'ACQUIRING_CARD': return state.isFree ? "Choisir une carte" : "Acheter une carte";
    case 'RESERVING_CARD': return "Réserver une carte";
    case 'ACQUIRING_TECH': return "Choisir une technologie";
    case 'PLACING_LIFE_TRACE': return `Placer trace de vie (${state.color})`;
    case 'MOVING_PROBE': return `Déplacement gratuit (${state.count})`;
    case 'LANDING_PROBE': return `Atterrissage gratuit (${state.count})`;
    default: return "Action bonus";
  }
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

// Configuration des ressources pour l'affichage et les logs
const RESOURCE_CONFIG: Record<string, { label: string, plural: string, icon: string, color: string, regex: RegExp }> = {
  CREDIT: { 
    label: 'Crédit', plural: 'Crédits', icon: '₢', color: '#ffd700',
    regex: /Crédit(?:s?)|crédit(?:s?)/ 
  },
  ENERGY: { 
    label: 'Énergie', plural: 'Énergie', icon: '⚡', color: '#4caf50',
    regex: /Énergie|énergie|Energie|energie/
  },
  MEDIA: { 
    label: 'Média', plural: 'Médias', icon: '🎤', color: '#ff6b6b',
    regex: /Média(?:s?)|Media(?:s?)|média(?:s?)|media(?:s?)/
  },
  DATA: { 
    label: 'Donnée', plural: 'Données', icon: '💾', color: '#03a9f4',
    regex: /Donnée(?:s?)|donnée(?:s?)|Data|data/
  },
  CARD: {
    label: 'Carte', plural: 'Cartes', icon: '🃏', color: '#aaffaa',
    regex: /Carte(?:s?)|carte(?:s?)/
  },
  PV: {
    label: 'PV', plural: 'PV', icon: '🏆', color: '#fff',
    regex: /\bPV\b/
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
    if (interactionState.type === 'ACQUIRING_TECH') {
      setIsTechOpen(true);
    }
    if (interactionState.type === 'ACQUIRING_CARD') {
      setIsRowOpen(true);
    }
  }, [interactionState.type]);

  // Effet pour la réservation initiale (Setup) pour le joueur humain
  useEffect(() => {
    if (game.currentRound === 1 && interactionState.type === 'IDLE') {
        const currentPlayer = game.players[game.currentPlayerIndex];
        if (currentPlayer.type === 'human') {
            const initialTotalRevenue = GAME_CONSTANTS.INITIAL_REVENUE_CREDITS + GAME_CONSTANTS.INITIAL_REVENUE_ENERGY + GAME_CONSTANTS.INITIAL_REVENUE_CARDS;
            const currentTotalRevenue = currentPlayer.revenueCredits + currentPlayer.revenueEnergy + currentPlayer.revenueCards;
            
            if (currentTotalRevenue === initialTotalRevenue) {
                setInteractionState({ type: 'RESERVING_CARD', count: 1, selectedCards: [] });
                setToast({ message: "Phase de préparation : Veuillez réserver une carte de votre main", visible: true });
                setViewedPlayerId(currentPlayer.id);
            }
        }
    }
  }, [game.currentRound, game.currentPlayerIndex, game.players, interactionState.type]);

  // État pour la modale de sélection de carte de fin de manche
  const [passModalState, setPassModalState] = useState<{ visible: boolean; cards: any[]; selectedCardId: string | null; cardsToKeep?: string[] }>({ visible: false, cards: [], selectedCardId: null });

  // État pour la confirmation de perte de sonde
  const [playCardConfirmation, setPlayCardConfirmation] = useState<{ visible: boolean; cardId: string | null; message: string }>({ visible: false, cardId: null, message: '' });

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
    const pattern = Object.values(RESOURCE_CONFIG).map(c => c.regex.source).join('|');
    const splitRegex = new RegExp(`(${pattern})`, 'g');
    
    return message.split(splitRegex).map((part, index) => {
      for (const config of Object.values(RESOURCE_CONFIG)) {
        if (new RegExp(`^${config.regex.source}$`).test(part)) {
           return <span key={index} title={config.label} style={{ color: config.color, cursor: 'help', fontWeight: 'bold' }}>{config.icon}</span>;
        }
      }
      return part;
    });
  };

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
    
    const log = formatRotationLogs(`fait tourner le système solaire (Niveau ${currentLevel}) via ${source}`, rotationResult.logs);
    return { updatedGame, logs: [log] };
  }

  // Gestionnaire pour passer au joueur suivant (fin de tour simple)
  const handleNextPlayer = () => {
    if (!gameEngineRef.current) return;

    // Vérifier les paliers de score avant de passer au joueur suivant
    // Utiliser l'état du moteur pour avoir la version la plus à jour
    const currentState = gameEngineRef.current.getState();
    const currentPlayer = currentState.players[currentState.currentPlayerIndex];
    
    for (const m of MILESTONES) {
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

        addToHistory(`réserve la carte "${card.name}" et gagne ${gainMsg}`, currentPlayer.id, game, { type: 'IDLE' }, interactionState.sequenceId);

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

  // Gestionnaire pour les actions
  const handleAction = (actionType: ActionType) => {
    if (!gameEngineRef.current) return;
    
    // Atomicité : Si on est dans un mode interactif, on ne peut pas lancer d'autre action
    if (interactionState.type !== 'IDLE') return;
    
    // Si une action principale a déjà été faite, on ne peut pas en faire d'autre (sauf PASS qui est géré spécifiquement)
    if (hasPerformedMainAction && actionType !== ActionType.PASS) return;

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
      
      const logMessage = formatRotationLogs(
        `paye ${GAME_CONSTANTS.TECH_RESEARCH_COST_MEDIA} médias et fait tourner le système solaire (Niveau ${currentLevel}) `,
        rotationResult.logs
      );
      addToHistory(logMessage, player.id, game);

      setGame(updatedGame);
      if (gameEngineRef.current) {
        gameEngineRef.current.setState(updatedGame);
      }
      setInteractionState({ type: 'ACQUIRING_TECH', isBonus: false });
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
  const processBonuses = (bonuses: any, currentGame: Game, playerId: string, sourceId?: string): { updatedGame: Game, newPendingInteractions: InteractionState[], passiveGains: string[], logs: string[] } => {
    let updatedGame = currentGame;
    const newPendingInteractions: InteractionState[] = [];
    const logs: string[] = [];
    const passiveGains: string[] = []; // For summary toast
    const launchedProbeIds: string[] = [];

    if (!bonuses) return { updatedGame, newPendingInteractions, logs, passiveGains };

    // Gains passifs pour le résumé
    if (bonuses.pv) { const txt = formatResource(bonuses.pv, 'PV'); passiveGains.push(txt); logs.push(`gagne ${txt}`); }
    if (bonuses.media) { const txt = formatResource(bonuses.media, 'MEDIA'); passiveGains.push(txt); logs.push(`gagne ${txt}`); }
    if (bonuses.credits) { const txt = formatResource(bonuses.credits, 'CREDIT'); passiveGains.push(txt); logs.push(`gagne ${txt}`); }
    if (bonuses.energy) { const txt = formatResource(bonuses.energy, 'ENERGY'); passiveGains.push(txt); logs.push(`gagne ${txt}`); }
    if (bonuses.data) { const txt = formatResource(bonuses.data, 'DATA'); passiveGains.push(txt); logs.push(`gagne ${txt}`); }

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
      const txt = formatResource(bonuses.card, 'CARD');
      passiveGains.push(txt);
      logs.push(`pioche ${txt}`);
    }

    // Effets immédiats (Sonde)
    if (bonuses.probe) {
        const ignoreLimit = bonuses.ignoreProbeLimit || false;
        for (let i = 0; i < bonuses.probe; i++) {
            const result = ProbeSystem.launchProbe(updatedGame, playerId, true, ignoreLimit); // free launch
            if (result.probeId) {
                updatedGame = result.updatedGame;
                launchedProbeIds.push(result.probeId);
                logs.push(`lance une sonde gratuitement`);
            } else {
                logs.push(`ne peut pas lancer de sonde (limite atteinte)`);
            }
        }
        const txt = `${bonuses.probe} Sonde${bonuses.probe > 1 ? 's' : ''}`;
        passiveGains.push(txt);
    }

    // Effets interactifs (File d'attente)
    if (bonuses.anycard) {
      newPendingInteractions.push({ type: 'ACQUIRING_CARD', count: bonuses.anycard, isFree: true });
    }

    if (bonuses.revenue) {
      const player = updatedGame.players.find(p => p.id === playerId);
      if (player) {
        const count = Math.min(bonuses.revenue, player.cards.length);
        if (count > 0) {
          newPendingInteractions.push({ type: 'RESERVING_CARD', count: count, selectedCards: [] });
        }
      }
    }
    
    if (bonuses.technology) {
      for (let i = 0; i < bonuses.technology.amount; i++) {
          newPendingInteractions.push({ 
            type: 'ACQUIRING_TECH', 
            isBonus: true,
            category: bonuses.technology.color,
            sharedOnly: bonuses.technology.sharedOnly,
            noTileBonus: bonuses.technology.noTileBonus
          });
      }
    }
    
    if (bonuses.movements) {
        newPendingInteractions.push({ 
            type: 'MOVING_PROBE', 
            count: bonuses.movements,
            autoSelectProbeId: launchedProbeIds.length > 0 ? launchedProbeIds[launchedProbeIds.length - 1] : undefined
        });
        logs.push(`obtient ${bonuses.movements} déplacement${bonuses.movements > 1 ? 's' : ''} gratuit${bonuses.movements > 1 ? 's' : ''}`);
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

    if (bonuses.landing) {
        newPendingInteractions.push({ type: 'LANDING_PROBE', count: bonuses.landing, source: sourceId });
        const txt = `${bonuses.landing} Atterrissage${bonuses.landing > 1 ? 's' : ''}`;
        passiveGains.push(txt);
    }

    if (bonuses.revealAndTriggerFreeAction) {
        newPendingInteractions.push({ type: 'ACQUIRING_CARD', count: 1, isFree: true, triggerFreeAction: true });
    }

    return { updatedGame, newPendingInteractions, logs, passiveGains };
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

  // Helper générique pour les interactions avec les planètes (Orbite/Atterrissage)
  const handlePlanetInteraction = (
    planetId: string,
    actionFn: (game: Game, playerId: string, probeId: string, targetId: string) => { updatedGame: Game, bonuses?: any },
    historyMessagePrefix: string,
    successMessage: string
  ): boolean => {
    if (interactionState.type !== 'IDLE' && interactionState.type !== 'LANDING_PROBE') return false;
    if (hasPerformedMainAction && interactionState.type !== 'LANDING_PROBE') {
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
    const sequenceId = `seq-${Date.now()}`;

    // Sauvegarder l'état avant l'action pour l'historique (Undo annulera tout, y compris les bonus)
    const stateBeforeAction = structuredClone(game);

    try {
        const result = actionFn(game, currentPlayer.id, probe.id, planetId, interactionState.type === 'LANDING_PROBE');
        
        const { updatedGame, newPendingInteractions, passiveGains, logs: allBonusLogs } = processBonuses(result.bonuses, result.updatedGame, currentPlayer.id, (interactionState as any).source);

        setGame(updatedGame);
        if (gameEngineRef.current) gameEngineRef.current.setState(updatedGame);
        setHasPerformedMainAction(true);
        
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

        addToHistory(`${historyMessagePrefix} ${planetId}`, currentPlayer.id, stateBeforeAction, undefined, sequenceId);
        if (allBonusLogs.length > 0) {
            allBonusLogs.forEach(log => addToHistory(log, currentPlayer.id, updatedGame, undefined, sequenceId));
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
  const handleOrbit = (planetId: string) => {
    handlePlanetInteraction(
        planetId,
        (g, pid, prid, targetId) => ProbeSystem.orbitProbe(g, pid, prid, targetId), // Orbit is not free via LANDING_PROBE
        "met une sonde en orbite autour de",
        "Sonde mise en orbite"
    );
  };

  // Gestionnaire pour l'atterrissage via la hover card
  const handleLand = (planetId: string, slotIndex?: number) => {
    // Vérifier si on est en mode atterrissage gratuit
    if (interactionState.type === 'LANDING_PROBE') {
      const interactionTriggered = handlePlanetInteraction(
        planetId,
        (g, pid, prid, targetId) => {
          const result = ProbeSystem.landProbe(g, pid, prid, targetId, true, slotIndex); // Toujours gratuit en mode LANDING_PROBE
          
          // Logique spécifique Carte 13 (Rover Perseverance)
          // "Si vous posez une sonde sur Mars, Mercure ou n'importe quelle lune avec cette action, gagnez 4 PVs."
          if (interactionState.source === '13') {
            const isMars = targetId === 'mars';
            const isMercury = targetId === 'mercury';
            // Vérifier si c'est une lune (satellite)
            const isMoon = g.board.planets.some(p => p.satellites?.some(s => s.id === targetId));
            
            if (isMars || isMercury || isMoon) {
              if (!result.bonuses) result.bonuses = {};
              result.bonuses.pv = (result.bonuses.pv || 0) + 4;
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

  // Gestionnaire pour le déplacement des sondes
  const handleProbeMove = async (probeId: string, path: string[]) => {
    if (!gameEngineRef.current) return;

    // Synchroniser l'état de GameEngine avec le jeu actuel
    gameEngineRef.current.setState(gameRef.current);

    let currentGame = gameRef.current; // Utiliser la ref pour avoir l'état le plus frais
    
    setToast({ message: "Déplacement...", visible: true });

    const currentPlayerId = currentGame.players[currentGame.currentPlayerIndex].id;

    let freeMovements = interactionState.type === 'MOVING_PROBE' ? interactionState.count : 0;

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
            const objectName = object?.hasComet ? "Comète" : object?.hasAsteroid ? "Astéroïdes" : object?.hasPlanet ? object?.planetName : "une case vide";  
            const energySpent = oldPlayer.energy - updatedPlayer.energy;
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
                 uniqueBuffs.forEach(buff => {
                     const gainText = formatResource(buff.value, 'PV');
                     message += ` et gagne ${gainText} (${buff.source || 'Bonus'})`;
                     setToast({ message: `Bonus : +${buff.value} PV (${buff.source})`, visible: true });
                 });
            });
            
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
    if (interactionState.type === 'MOVING_PROBE') {
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
    if (hasPerformedMainAction) {
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
            // Vérifier la limite de sondes (sans vérifier le coût car c'est un gain)
            const canLaunch = ProbeSystem.canLaunchProbe(currentGame, currentPlayer.id, false);
            if (!canLaunch.canLaunch && canLaunch.reason && canLaunch.reason.includes('Limite')) {
                setPlayCardConfirmation({
                    visible: true,
                    cardId: cardId,
                    message: "Vous avez atteint la limite de sondes dans le système solaire. L'action de lancer une sonde sera perdue. Voulez-vous continuer ?"
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

    const { updatedGame: gameAfterBonuses, newPendingInteractions, passiveGains, logs: allBonusLogs } = processBonuses(result.bonuses, result.updatedGame, currentPlayer.id, cardId);

    const card = currentGame.players[currentGame.currentPlayerIndex].cards.find(c => c.id === cardId)!;
    setGame(gameAfterBonuses);
    if (gameEngineRef.current) {
      gameEngineRef.current.setState(gameAfterBonuses);
    }
    setHasPerformedMainAction(true);
    
    const gainsText = passiveGains.length > 0 ? ` (Gains: ${passiveGains.join(', ')})` : '';
    setToast({ message: `Carte jouée: ${card.name}${gainsText}`, visible: true });
    
    const sequenceId = `seq-${Date.now()}`;
    
    // Construction du message d'historique unifié
    let message = `joue la carte "${card.name}" pour ${card.cost} crédits`;
    
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

    // Gérer les interactions en attente (ex: Mouvements, Tech, etc.)
    if (newPendingInteractions.length > 0) {
        const interactionsWithSeqId = newPendingInteractions.map(i => ({ ...i, sequenceId }));
        setPendingInteractions(prev => [...interactionsWithSeqId, ...prev]);
    }
  };

  // Gestionnaire pour l'action gratuite (défausse de carte)
  const handleDiscardCardAction = (cardId: string) => {
    let updatedGame = game;
    const currentPlayerId = updatedGame.players[updatedGame.currentPlayerIndex].id;
    const currentPlayer = updatedGame.players[updatedGame.currentPlayerIndex];
    
    const card = currentPlayer.cards.find(c => c.id === cardId);
    if (!card) return;
    
    // Appliquer l'effet de l'action gratuite
    if (card.freeAction === FreeActionType.MEDIA) {
      const res = ResourceSystem.updateMedia(updatedGame, currentPlayerId, 1);
      updatedGame = res.updatedGame;
      setToast({ message: "Action gratuite : +1 Média", visible: true });
      addToHistory(`défausse une carte pour gagner ${formatResource(1, 'MEDIA')}`, currentPlayerId, game);
    } else if (card.freeAction === FreeActionType.DATA) {
      const res = ResourceSystem.updateData(updatedGame, currentPlayerId, 1);
      updatedGame = res.updatedGame;
      setToast({ message: "Action gratuite : +1 Data", visible: true });
      addToHistory(`défausse une carte pour gagner ${formatResource(1, 'DATA')}`, currentPlayerId, game);
    } else if (card.freeAction === FreeActionType.MOVEMENT) {
      const probes = currentPlayer.probes.filter(p => p.state === ProbeState.IN_SOLAR_SYSTEM);
      const autoSelectProbeId = probes.length === 1 ? probes[0].id : undefined;
      setInteractionState({ type: 'MOVING_PROBE', count: 1, autoSelectProbeId });
      setToast({ message: "Sélectionnez une sonde à déplacer", visible: true });
      addToHistory("défausse une carte pour un déplacement gratuit", currentPlayerId, game);
    }
    
    // Défausser la carte
    const playerToUpdate = updatedGame.players.find(p => p.id === currentPlayerId);
    if (playerToUpdate) {
        const newPlayer = CardSystem.discardCard(playerToUpdate, cardId);
        updatedGame = {
            ...updatedGame,
            players: updatedGame.players.map(p => p.id === currentPlayerId ? newPlayer : p)
        };
    }
    
    setGame(updatedGame);
  };

  // Gestionnaire pour l'action d'achat de carte avec du média
  const handleBuyCardAction = () => {
    if (interactionState.type !== 'IDLE') return;
    setInteractionState({ type: 'ACQUIRING_CARD', count: 1});
    setToast({ message: "Sélectionnez une carte dans la rangée ou la pioche", visible: true });
  };

  // Gestionnaire pour les échanges directs (via les boutons rapides)
  const handleDirectTrade = (spendType: string, gainType: string) => {
    if (interactionState.type !== 'IDLE') return;
    const currentPlayer = game.players[game.currentPlayerIndex];

    const result = ResourceSystem.tradeResources(game, currentPlayer.id, spendType, gainType);
    if (result.error) {
        setToast({ message: result.error, visible: true });
        return;
    }

    setGame(result.updatedGame);
    setToast({ message: "Echange effectué", visible: true });
    addToHistory(`échange ${formatResource(2, spendType)} contre ${formatResource(1, gainType)}`, currentPlayer.id, game);
  };
  
  // Gestionnaire pour la sélection d'une carte de la pioche ou de la rangée principale
  const handleCardRowClick = (cardId?: string) => { // cardId undefined means deck
    if (interactionState.type !== 'ACQUIRING_CARD') return;
    
    const currentPlayer = game.players[game.currentPlayerIndex];
    let result: { updatedGame: Game, error?: string };

    if (interactionState.isFree) {
        // Logique pour carte gratuite (Bonus)
        const updatedGame = structuredClone(game);
        const player = updatedGame.players[updatedGame.currentPlayerIndex];
        
        if (cardId) {
            // Prendre de la rangée
            const rowIndex = updatedGame.decks.cardRow.findIndex(c => c.id === cardId);
            if (rowIndex !== -1) {
                const card = updatedGame.decks.cardRow[rowIndex];
                player.cards.push(card);
                updatedGame.decks.cardRow.splice(rowIndex, 1);
                
                // Remplir la rangée
                if (updatedGame.decks.cards.length > 0) {
                    updatedGame.decks.cardRow.push(updatedGame.decks.cards.shift()!);
                }
            } else {
                // Carte non trouvée (ne devrait pas arriver)
                return;
            }
        } else {
            // Piocher du paquet
            if (updatedGame.decks.cards.length > 0) {
                player.cards.push(updatedGame.decks.cards.shift()!);
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
        setIsRowOpen(false);
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
    const { targetGain, selectedCards } = interactionState;
    const currentPlayer = game.players[game.currentPlayerIndex];
    
    // spendType est implicitement 'card' ici car on est dans TRADING_CARD
    const result = ResourceSystem.tradeResources(game, currentPlayer.id, 'card', targetGain, selectedCards);
    if (result.error) {
        setToast({ message: result.error, visible: true });
        return;
    }

    setGame(result.updatedGame);
    setToast({ message: "Echange effectué", visible: true });
    addToHistory(`échange ${formatResource(2, 'card')} contre ${formatResource(1, targetGain)}`, currentPlayer.id, game, { type: 'IDLE' });
    setInteractionState({ type: 'IDLE' });
  };

  // Fonction interne pour traiter l'achat (commune à l'achat direct et après sélection)
  const processTechPurchase = (tech: Technology, targetComputerCol?: number, stateOverride?: Game, interactionStateOverride?: InteractionState, noTileBonus?: boolean) => {
    const currentGame = stateOverride || gameRef.current;
    const { updatedGame, gains } = TechnologySystem.acquireTechnology(currentGame, currentGame.players[currentGame.currentPlayerIndex].id, tech, targetComputerCol, noTileBonus);
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

    const gainsText = gains.length > 0 ? ` et gagne ${gains.join(', ')}` : '';
    
    // Si on est en train de rechercher (Action principale), on fusionne avec l'entrée de rotation
    if (previousInteractionState.type === 'ACQUIRING_TECH' && !previousInteractionState.isBonus) {
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
            message: `${rotationEntry.message} pour rechercher la technologie "${category} ${tech.name}"${gainsText}`,
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
    if (interactionState.type === 'ACQUIRING_TECH') {
        if (tech.id.startsWith('computing')) {
          const { sequenceId } = interactionState;
          setInteractionState({ type: 'SELECTING_COMPUTER_SLOT', tech, sequenceId });
          setToast({ message: "Sélectionnez une colonne (1, 3, 5, 6) sur l'ordinateur", visible: true });
          return;
        }
        const { noTileBonus } = interactionState;
        processTechPurchase(tech, undefined, undefined, interactionState, noTileBonus);
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
        const logMessage = formatRotationLogs(
            `paye ${GAME_CONSTANTS.TECH_RESEARCH_COST_MEDIA} médias et fait tourner le système solaire (Niveau ${currentLevel}) `,
            rotationResult.logs
        );
        addToHistory(logMessage, player.id, game);

        // Traiter l'achat ou la sélection de slot
        if (tech.id.startsWith('computing')) {
            setGame(updatedGame);
            if (gameEngineRef.current) gameEngineRef.current.setState(updatedGame);
            setInteractionState({ type: 'SELECTING_COMPUTER_SLOT', tech });
            setToast({ message: "Système pivoté. Sélectionnez une colonne (1, 3, 5, 6) sur l'ordinateur", visible: true });
        } else {
            // Achat direct avec fusion des logs (simule RESEARCHING)
            processTechPurchase(tech, undefined, updatedGame, { type: 'ACQUIRING_TECH', isBonus: false }, false);
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
    const topSlotId = `${col}a`;
    if (currentPlayer.dataComputer.slots?.[topSlotId]?.bonus === '2pv') {
      setToast({ message: "Emplacement déjà occupé par une technologie", visible: true });
      return;
    }

    // Finaliser l'achat
    processTechPurchase(interactionState.tech, col, undefined, interactionState, undefined);
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
      const currentPlayer = gameRef.current.players[gameRef.current.currentPlayerIndex];
      const count = Math.min(amount, currentPlayer.cards.length);
      if (count > 0) {
        const sequenceId = (interactionState as any).sequenceId;
        setInteractionState({ type: 'RESERVING_CARD', count: count, sequenceId, selectedCards: [] });
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
        .seti-icon-panel {
          transition: width 0.3s ease, max-height 0.5s ease, border-radius 0.3s ease;
          width: 100%;
        }
        .seti-icon-panel.collapsed {
          width: 40px;
          border-radius: 50%;
        }
        .seti-icon-panel.collapsed:hover {
          width: 100%;
          border-radius: 6px;
          box-shadow: 0 0 10px rgba(74, 158, 255, 0.5);
          border-color: #4a9eff;
        }
        .seti-icon-panel.collapsed .seti-foldable-header {
          justify-content: center;
          padding: 0;
        }
        .seti-icon-panel.collapsed:hover .seti-foldable-header {
          justify-content: space-between;
          padding: 0 10px;
        }
        .seti-icon-panel .panel-icon { display: none; font-size: 1.2rem; }
        .seti-icon-panel .panel-title { display: block; }
        .seti-icon-panel.collapsed .panel-icon { display: block; }
        .seti-icon-panel.collapsed .panel-title { display: none; }
        .seti-icon-panel.collapsed:hover .panel-icon { display: none; }
        .seti-icon-panel.collapsed:hover .panel-title { display: block; }
        .seti-icon-panel.collapsed .seti-foldable-header::after {
          display: none;
        }
        .seti-icon-panel.collapsed:hover .seti-foldable-header::after {
          display: block;
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
          <div style={{
            backgroundColor: '#1e1e2e',
            border: '2px solid #4a9eff',
            borderRadius: '12px',
            padding: '30px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            maxWidth: '900px',
            maxHeight: '85vh',
            boxShadow: '0 0 40px rgba(74, 158, 255, 0.2)',
            width: '100%'
          }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '20px', color: '#fff' }}>
              Fin de manche : Choisissez une carte
            </div>
            <div style={{ 
              display: 'flex', 
              gap: '15px', 
              flexWrap: 'wrap', 
              justifyContent: 'center', 
              width: '100%',
              overflowY: 'auto',
              padding: '10px'
            }}>
            {passModalState.cards.map(card => {
              const isSelected = passModalState.selectedCardId === card.id;
              return (
              <div 
                key={card.id}
                onClick={() => setPassModalState(prev => ({ ...prev, selectedCardId: card.id }))}
                onMouseEnter={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setActiveTooltip({ content: renderCardTooltip(card), rect });
                }}
                onMouseLeave={() => setActiveTooltip(null)}
                className={`seti-common-card seti-card-wrapper ${isSelected ? 'selected' : ''}`}
                style={{
                  width: '140px',
                  height: '200px',
                  padding: '6px',
                  backgroundColor: isSelected ? 'rgba(74, 158, 255, 0.2)' : 'rgba(30, 30, 40, 0.9)',
                  border: isSelected ? '2px solid #4a9eff' : '1px solid #555',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  transform: isSelected ? 'scale(1.05)' : 'scale(1)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                  position: 'relative'
                }}
              >
                <div className="seti-card-name" style={{ fontSize: '0.75rem', lineHeight: '1.1', marginBottom: '4px', height: '2.2em', overflow: 'hidden', fontWeight: 'bold', color: '#fff' }}><span>{card.name}</span></div>
                <div style={{ fontSize: '0.75em', marginTop: '2px', display: 'flex', justifyContent: 'space-between' }}><span style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '0 4px', borderRadius: '4px' }}>Coût: <span style={{ color: '#ffd700' }}>{card.cost}</span></span><span style={{ color: '#aaa', fontSize: '0.9em' }}>{card.type === CardType.ACTION ? 'ACT' : (card.type === CardType.END_GAME ? 'FIN' : 'MIS')}</span></div>
                {card.description && <div className="seti-card-description" style={{ flex: 1, margin: '4px 0', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', textOverflow: 'ellipsis', fontSize: '0.7em', color: '#ccc' }}>{card.description}</div>}
                <div className="seti-card-details" style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: 'auto', fontSize: '0.7em', backgroundColor: 'rgba(0,0,0,0.2)', padding: '2px', borderRadius: '4px' }}><div className="seti-card-detail" style={{ display: 'flex', justifyContent: 'space-between' }}>{card.freeAction && <span>Act: {card.freeAction}</span>}{card.scanSector && <span>Scan: {card.scanSector}</span>}</div><div className="seti-card-detail">{card.revenue && <span>Rev: {card.revenue}</span>}</div></div>
              </div>
            )})}
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

      {/* Modale de confirmation pour carte jouée avec perte de sonde */}
      {playCardConfirmation.visible && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 2000,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            backgroundColor: '#2a2a2a', padding: '20px', borderRadius: '8px',
            maxWidth: '400px', border: '1px solid #ff6b6b', textAlign: 'center'
          }}>
            <h3 style={{ color: '#ff6b6b', marginTop: 0 }}>Attention</h3>
            <p style={{ color: '#ddd', marginBottom: '20px' }}>{playCardConfirmation.message}</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
              <button
                onClick={() => setPlayCardConfirmation({ visible: false, cardId: null, message: '' })}
                style={{ padding: '8px 16px', backgroundColor: '#555', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                Annuler
              </button>
              <button
                onClick={() => {
                    if (playCardConfirmation.cardId) executePlayCard(playCardConfirmation.cardId);
                    setPlayCardConfirmation({ visible: false, cardId: null, message: '' });
                }}
                style={{ padding: '8px 16px', backgroundColor: '#ff6b6b', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                Continuer quand même
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Overlay pour la recherche de technologie ou l'achat de carte */}
      {(interactionState.type === 'ACQUIRING_TECH' || interactionState.type === 'ACQUIRING_CARD' || interactionState.type === 'RESERVING_CARD') && (
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
          if (interactionState.type === 'ACQUIRING_CARD') {
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
                isDiscarding={interactionState.type === 'DISCARDING_CARD'}
                isTrading={interactionState.type === 'TRADING_CARD'}
                isReserving={interactionState.type === 'RESERVING_CARD'}
                selectedCardIds={interactionState.type === 'DISCARDING_CARD' || interactionState.type === 'TRADING_CARD' || interactionState.type === 'RESERVING_CARD' ? interactionState.selectedCards : []}
                onCardClick={handleCardClick}
                onDiscardCardAction={handleDiscardCardAction}
                onConfirmDiscard={handleConfirmDiscard}
                onTradeCardAction={(targetGain) => handleTradeCardAction({ targetGain })}
                onConfirmTrade={handleConfirmTrade}
                reservationCount={interactionState.type === 'RESERVING_CARD' ? interactionState.count : 0}
                onConfirmReservation={handleConfirmReservation}
                onBuyCardAction={handleBuyCardAction}
                onDirectTradeAction={handleDirectTrade}
                onDrawCard={handleDrawCard}
                onPlayCard={handlePlayCardRequest}
                onGameUpdate={(newGame) => setGame(newGame)}
                isSelectingComputerSlot={interactionState.type === 'SELECTING_COMPUTER_SLOT'}
                onComputerSlotSelect={handleComputerColumnSelect}
                isAnalyzing={interactionState.type === 'ANALYZING'}
                hasPerformedMainAction={hasPerformedMainAction}
                onNextPlayer={handleNextPlayer}
                onHistory={(message) => addToHistory(message, game.players[game.currentPlayerIndex].id, game)}
                onComputerBonus={handleComputerBonus}
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
              highlightPlayerProbes={interactionState.type === 'MOVING_PROBE'}
              freeMovementCount={interactionState.type === 'MOVING_PROBE' ? interactionState.count : 0}
              hasPerformedMainAction={hasPerformedMainAction}
              autoSelectProbeId={interactionState.type === 'MOVING_PROBE' ? interactionState.autoSelectProbeId : undefined}
              isLandingInteraction={interactionState.type === 'LANDING_PROBE'}
              allowOccupiedLanding={interactionState.type === 'LANDING_PROBE' && interactionState.source === '16'}
              onBackgroundClick={() => {
                if (interactionState.type === 'MOVING_PROBE') {
                    setInteractionState({ type: 'IDLE' });
                    setToast({ message: "Déplacements terminés", visible: true });
                }
              }}
            />

            {/* Plateaux annexes en haut à gauche */}
            <div style={{
              position: 'absolute',
              top: '15px',
              left: '15px',
              width: '560px',
              zIndex: (interactionState.type === 'ACQUIRING_TECH' || interactionState.type === 'ACQUIRING_CARD') ? 1501 : 1000,
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              maxHeight: 'calc(100% - 30px)',
              overflowY: 'auto',
              pointerEvents: 'none',
            }}>
              <div className={`seti-foldable-container seti-icon-panel ${isObjectivesOpen ? 'open' : 'collapsed'}`} style={{ pointerEvents: 'auto' }}>
                <div className="seti-foldable-header" onClick={() => setIsObjectivesOpen(!isObjectivesOpen)}>
                  <span className="panel-icon">🎯</span>
                  <span className="panel-title">Objectifs</span>
                </div>
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

                            let statusText = "";
                            let statusColor = "";
                            let actionText = null;
                            let milestoneText = null;

                            if (player) {
                                statusText = `Atteint par ${player.name}`;
                                statusColor = player.color || "#ccc";
                            } else if (isNextAvailable) {
                                statusText = "Disponible";
                                statusColor = "#4a9eff";
                                actionText = "Cliquer pour placer un marqueur";
                            } else if (hasMarkerOnTile) {
                                statusText = "Déjà validé";
                                statusColor = "#aaa";
                            } else {
                                statusText = "Indisponible";
                                statusColor = "#ff6b6b";
                                if (idx === tile.markers.length) {
                                    const nextMilestone = MILESTONES.find(m => !currentPlayer.claimedMilestones.includes(m));
                                    if (nextMilestone) {
                                        milestoneText = `Atteindre ${nextMilestone} PVs pour sélectionner l'objectif`;
                                    } else {
                                        actionText = "Tous les paliers atteints";
                                    }
                                } else {
                                    actionText = "Nécessite le palier précédent";
                                }
                            }

                            const tooltipContent = (
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontWeight: 'bold', marginBottom: '4px', color: statusColor }}>{statusText}</div>
                                    <div style={{ fontSize: '0.9em', color: '#ccc' }}>Gain : <span style={{ color: '#ffd700' }}>{pv} PV</span></div>
                                    {milestoneText && <div style={{ fontSize: '0.8em', color: '#4a9eff', marginTop: '4px', fontStyle: 'italic' }}>{milestoneText}</div>}
                                    {actionText && <div style={{ fontSize: '0.8em', color: '#aaa', marginTop: '4px', fontStyle: 'italic' }}>{actionText}</div>}
                                </div>
                            );

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
                                cursor: isNextAvailable ? 'pointer' : 'help',
                              }}
                              onMouseEnter={(e) => {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  setActiveTooltip({ content: tooltipContent, rect });
                              }}
                              onMouseLeave={() => setActiveTooltip(null)}
                              >
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

              <div className={`seti-foldable-container seti-icon-panel ${isTechOpen ? 'open' : 'collapsed'}`}
                  style={{ 
                    pointerEvents: 'auto',
                    ...(interactionState.type === 'ACQUIRING_TECH' ? { borderColor: '#4a9eff', boxShadow: '0 0 20px rgba(74, 158, 255, 0.3)' } : {})
                  }}
              >
                <div className="seti-foldable-header" onClick={() => setIsTechOpen(!isTechOpen)}>
                  <span className="panel-icon">🔬</span>
                  <span className="panel-title">Technologies</span>
                </div>
                <div className="seti-foldable-content">
                  <TechnologyBoardUI 
                    game={game} 
                    isResearching={interactionState.type === 'ACQUIRING_TECH'}
                    researchCategory={interactionState.type === 'ACQUIRING_TECH' ? interactionState.category : undefined}
                    sharedTechOnly={interactionState.type === 'ACQUIRING_TECH' ? interactionState.sharedOnly : false}
                    onTechClick={handleTechClick}
                    hasPerformedMainAction={hasPerformedMainAction}
                  />
                </div>
              </div>
              
              <div className={`seti-foldable-container seti-icon-panel ${isRowOpen ? 'open' : 'collapsed'}`}
                  style={{ 
                    pointerEvents: 'auto',
                    ...(interactionState.type === 'ACQUIRING_CARD' ? { borderColor: '#4a9eff', boxShadow: '0 0 20px rgba(74, 158, 255, 0.3)' } : {})
                  }}
              >
                <div className="seti-foldable-header" onClick={() => setIsRowOpen(!isRowOpen)}>
                  <span className="panel-icon">🃏</span>
                  <span className="panel-title">Rangée Principale</span>
                </div>
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
                      cursor: interactionState.type === 'ACQUIRING_CARD' ? 'pointer' : 'default',
                      borderColor: interactionState.type === 'ACQUIRING_CARD' ? '#4a9eff' : '#555'
                    }}>
                      <div style={{ fontWeight: 'bold', color: '#aaa', textAlign: 'center' }}>Pioche</div>
                      <div style={{ fontSize: '0.8em', color: '#888' }}>{game.decks.cards.length || 0} cartes</div>
                  </div>

                  {game.decks.cardRow && game.decks.cardRow.map(card => (
                    <div key={card.id} 
                      onClick={() => handleCardRowClick(card.id)}
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setActiveTooltip({ content: renderCardTooltip(card), rect });
                      }}
                      onMouseLeave={() => setActiveTooltip(null)}
                      className="seti-common-card"
                      style={{
                      border: interactionState.type === 'ACQUIRING_CARD' ? '1px solid #4a9eff' : '1px solid #555',
                      cursor: interactionState.type === 'ACQUIRING_CARD' ? 'pointer' : 'default',
                      animation: 'cardAppear 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)'
                    }}>
                      <div style={{ fontWeight: 'bold', color: '#fff', lineHeight: '1.1', marginBottom: '4px', fontSize: '0.75rem', height: '2.2em', overflow: 'hidden' }}>{card.name}</div>
                      <div style={{ fontSize: '0.75em', color: '#aaa' }}>Jouer la carte (coût: <span style={{ color: '#ffd700' }}>{card.cost}</span>)</div>
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
                  {(!game.decks.cardRow || game.decks.cardRow.length === 0) && (
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
              pointerEvents: 'none',
              alignItems: 'flex-end'
            }}>
              <div className={`seti-foldable-container seti-history-container seti-icon-panel ${isHistoryOpen ? 'open' : 'collapsed'}`} style={{ display: 'flex', flexDirection: 'column', pointerEvents: 'auto' }}>
               <div className="seti-foldable-header" onClick={() => setIsHistoryOpen(!isHistoryOpen)}>
                  <span className="panel-icon">📜</span>
                  <span className="panel-title" style={{ flex: 1 }}>Historique</span>
                  {historyLog.length > 0 && historyLog[historyLog.length - 1].previousState && (
                    <button 
                      className="panel-title"
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
                    //const nextEntry = index < historyLog.length - 1 ? historyLog[index + 1] : null;
                    
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
