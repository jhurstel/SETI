import React, { useRef, useState, useEffect, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Game, ActionType, DiskName, SectorNumber, FreeActionType, GAME_CONSTANTS, SectorColor, Card, Bonus, Technology, RevenueType, ProbeState, TechnologyCategory, MILESTONES, CardType, LifeTraceType } from '../core/types';
import { SolarSystemBoardUI, SolarSystemBoardUIRef } from './SolarSystemBoardUI';
import { TechnologyBoardUI } from './TechnologyBoardUI';
import { PlayerBoardUI } from './PlayerBoardUI';
import { LaunchProbeAction } from '../actions/LaunchProbeAction';
import { MoveProbeAction } from '../actions/MoveProbeAction';
import { PassAction } from '../actions/PassAction';
import { GameEngine } from '../core/Game';
import { ProbeSystem } from '../systems/ProbeSystem';
import { createRotationState, getCell, getObjectPosition, FIXED_OBJECTS, INITIAL_ROTATING_LEVEL1_OBJECTS, INITIAL_ROTATING_LEVEL2_OBJECTS, INITIAL_ROTATING_LEVEL3_OBJECTS } from '../core/SolarSystemPosition';
import { DataSystem } from '../systems/DataSystem';
import { CardSystem } from '../systems/CardSystem';
import { ResourceSystem } from '../systems/ResourceSystem';
import { TechnologySystem } from '../systems/TechnologySystem';
import { SectorSystem } from '../systems/SectorSystem';
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
  | { type: 'IDLE', sequenceId?: string }
  /** Le joueur a un bonus de réservation et doit choisir une carte à glisser sous son plateau. */
  | { type: 'RESERVING_CARD', count: number, sequenceId?: string, selectedCards: string[] }
  /** Le joueur doit défausser des cartes (ex: fin de manche). */
  | { type: 'DISCARDING_CARD', selectedCards: string[], sequenceId?: string }
  /** Le joueur a initié un échange et doit choisir la ressource à dépenser. */
  | { type: 'TRADING_CARD', targetGain: string, selectedCards: string[], sequenceId?: string }
  /** Le joueur acquiert une carte (gratuitement ou en payant) et doit la sélectionner dans la pioche ou la rangée. */
  | { type: 'ACQUIRING_CARD', count: number, isFree?: boolean, sequenceId?: string, triggerFreeAction?: boolean }
  /** Le joueur a des déplacements gratuits à effectuer. */
  | { type: 'MOVING_PROBE', count: number, autoSelectProbeId?: string, sequenceId?: string }
  /** Le joueur a un atterrissage gratuit (ex: Carte 13). */
  | { type: 'LANDING_PROBE', count: number, source?: string, sequenceId?: string }
  /** Le joueur acquiert une technologie (en payant ou en bonus) et doit la sélectionner. */
  | { type: 'ACQUIRING_TECH', isBonus: boolean, sequenceId?: string, category?: TechnologyCategory, sharedOnly?: boolean, noTileBonus?: boolean }
  /** Le joueur a choisi une technologie "Informatique" et doit sélectionner une colonne sur son ordinateur. */
  | { type: 'SELECTING_COMPUTER_SLOT', tech: Technology, sequenceId?: string }
  /** Le joueur a lancé l'action "Analyser", principalement pour l'animation. */
  | { type: 'ANALYZING', sequenceId?: string }
  /** Le joueur doit placer une trace de vie sur le plateau Alien. */
  | { type: 'PLACING_LIFE_TRACE', color: LifeTraceType, sequenceId?: string }
  /** Le joueur a atteint un palier de score et doit placer un marqueur sur un objectif. */
  | { type: 'PLACING_OBJECTIVE_MARKER', milestone: number, sequenceId?: string }
  /** Le joueur scanne un secteur (2ème étape : choix de la carte). */
  | { type: 'SELECTING_SCAN_CARD', sequenceId?: string }
  /** Le joueur scanne un secteur (3ème étape : choix du secteur couleur). */
  | { type: 'SELECTING_SCAN_SECTOR', color: SectorColor, noData?: boolean, anyProbe?: boolean, adjacents?: boolean, keepCardIfOnly?: boolean, sequenceId?: string, cardId?: string, message?: string }
  /** Le joueur doit choisir entre un gain de média ou un déplacement (Carte 19). */
  | { type: 'CHOOSING_MEDIA_OR_MOVE', sequenceId?: string, remainingMoves?: number }
  /** Le joueur doit défausser des cartes de sa main pour leurs signaux. */
  | { type: 'DISCARDING_FOR_SIGNAL', count: number, selectedCards: string[], sequenceId?: string }
  /** Le joueur doit retirer un orbiteur (Carte 15). */
  | { type: 'REMOVING_ORBITER', sequenceId?: string }
  /** Le joueur a reçu plusieurs bonus interactifs et doit choisir l'ordre de résolution. */
  | { type: 'CHOOSING_BONUS_ACTION', bonusesSummary: string, choices: { id: string, label: string, state: InteractionState, done: boolean }[], sequenceId?: string }
  /** Un effet de carte non-interactif est déclenché. */
  | { type: 'TRIGGER_CARD_EFFECT', effectType: string, value: any, sequenceId?: string };

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
    case 'SELECTING_SCAN_SECTOR': return "Choisir un secteur à scanner";
    case 'DISCARDING_FOR_SIGNAL': return `Défausser pour signal (${state.count})`;
    case 'REMOVING_ORBITER': return "Retirer un orbiteur";
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

const AlienTriangleSlot = ({ color, traces, game, onClick, isClickable, onMouseEnter, onMouseLeave }: { color: string, traces: any[], game: Game, onClick?: () => void, isClickable?: boolean, onMouseEnter?: (e: React.MouseEvent) => void, onMouseLeave?: () => void }) => (
  <div
    style={{ position: 'relative', width: '60px', height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: isClickable ? 'pointer' : 'help' }}
    onMouseEnter={onMouseEnter}
    onMouseLeave={onMouseLeave}
    onClick={onClick}
  >
    <svg width="60" height="50" viewBox="0 0 60 50" style={{ position: 'absolute', top: 0, left: 0, overflow: 'visible' }}>
      <path
        d="M10 5
           Q30 -5 50 5
           Q60 10 55 15
           L35 45
           Q30 50 25 45
           L5 15
           Q0 10 10 5 Z"
        fill={isClickable ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.5)"}
        stroke={color}
        strokeWidth={isClickable ? "3" : "2"}
        style={{ transition: 'all 0.3s ease', filter: isClickable ? `drop-shadow(0 0 5px ${color})` : 'none' }}
      />
      {isClickable && (
        <animate attributeName="opacity" values="1;0.7;1" dur="1.5s" repeatCount="indefinite" />
      )}
    </svg>
    <div style={{ zIndex: 1, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: '2px', width: '40px', height: '30px', overflow: 'hidden' }}>
      {traces.map((trace, idx) => {
        const player = game.players.find(p => p.id === trace.playerId);
        return (
          <div key={idx} style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            backgroundColor: player?.color || '#fff',
            border: '1px solid rgba(255,255,255,0.8)',
            boxShadow: '0 0 2px rgba(0,0,0,0.8)',
            zIndex: 2
          }} />
        );
      })}
    </div>
  </div>
);

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
  const [isAlienBoardAOpen, setIsAlienBoardAOpen] = useState(false);
  const [isAlienBoardBOpen, setIsAlienBoardBOpen] = useState(false);

  // État pour le tooltip générique
  const [activeTooltip, setActiveTooltip] = useState<{ content: React.ReactNode, rect: DOMRect } | null>(null);

  // Auto-open tech & row panel when researching or selecting card
  useEffect(() => {
    if (interactionState.type === 'ACQUIRING_TECH') {
      setIsTechOpen(true);
    }
    if (interactionState.type === 'ACQUIRING_CARD' || interactionState.type === 'SELECTING_SCAN_CARD') {
      setIsRowOpen(true);
    }
    if (interactionState.type === 'PLACING_OBJECTIVE_MARKER') {
      setIsObjectivesOpen(true);
    }
    if (interactionState.type === 'IDLE') {
      setIsTechOpen(false);
      setIsRowOpen(false);
      setIsObjectivesOpen(false);
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

      // Gestion du gras (balises <strong>)
      if (part.includes('<strong>')) {
        const subParts = part.split(/(<strong>.*?<\/strong>)/g);
        return (
          <span key={index}>
            {subParts.map((subPart, subIndex) => {
              if (subPart.startsWith('<strong>') && subPart.endsWith('</strong>')) {
                return <strong key={subIndex}>{subPart.replace(/<\/?strong>/g, '')}</strong>;
              }
              return subPart;
            })}
          </span>
        );
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
        if (gameEngineRef.current) gameEngineRef.current.setState(firstEntry.previousState);

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
      if (gameEngineRef.current) gameEngineRef.current.setState(lastEntry.previousState);
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
    sequenceId?: string,
    initialLogs: string[] = [],
    noData: boolean = false
  ) => {
    let updatedGame = gameToUpdate;
    const scanLogs: string[] = [...initialLogs];

    // 1. Scan
    const scanResult = SectorSystem.scanSector(updatedGame, playerId, sectorId, false, noData);
    updatedGame = scanResult.updatedGame;
    scanLogs.push(...scanResult.logs);

    // 2. Process scan bonuses
    if (scanResult.bonuses) {
      const bonusRes = processBonuses(scanResult.bonuses, updatedGame, playerId, 'scan');
      updatedGame = bonusRes.updatedGame;
      scanLogs.push(...bonusRes.logs);
      if (bonusRes.newPendingInteractions.length > 0) {
        setPendingInteractions(prev => [...prev, ...bonusRes.newPendingInteractions]);
      }
    }

    // 3. Check if covered
    if (SectorSystem.isSectorCovered(updatedGame, sectorId)) {
      scanLogs.push(`et complète le secteur !`);
      addToHistory(scanLogs.join(', '), playerId, game, undefined, sequenceId);

      const coverageLogs: string[] = [];
      // 4. Cover sector
      const coverageResult = SectorSystem.coverSector(updatedGame, playerId, sectorId);
      updatedGame = coverageResult.updatedGame;
      coverageLogs.push(...coverageResult.logs);

      // 5. Process cover bonuses
      if (coverageResult.bonuses) {
        const bonusRes = processBonuses(coverageResult.bonuses, updatedGame, playerId, 'scan');
        updatedGame = bonusRes.updatedGame;
        coverageLogs.push(...bonusRes.logs);
        if (bonusRes.newPendingInteractions.length > 0) {
          setPendingInteractions(prev => [...prev, ...bonusRes.newPendingInteractions]);
        }
      }
      setToast({ message: 'Secteur couvert !', visible: true });
      if (coverageLogs.length > 0) {
        addToHistory(coverageLogs.join(', '), coverageResult.winnerId, game, undefined, sequenceId);
      }
    } else {
      // 6. Log scan only
      addToHistory(scanLogs.join(', '), playerId, game, undefined, sequenceId);
    }

    return updatedGame;
  };

  // Gestionnaire pour le clic sur un secteur (Scan)
  const handleSectorClick = (sectorNumber: number) => {
    // Cas 1: Mode Scan actif ou bonus
    if (interactionState.type === 'SELECTING_SCAN_SECTOR') {
      const currentPlayer = game.players[game.currentPlayerIndex];
      const sector = game.board.sectors[sectorNumber - 1];

      // Validate color
      if (interactionState.color !== SectorColor.ANY && sector.color !== interactionState.color) {
        setToast({ message: `Couleur incorrecte. Sélectionnez un secteur ${interactionState.color}`, visible: true });
        return;
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
          initialLogs.push(`défausse carte "${removedCard.name}" (${removedCard.scanSector}) de la main`);
        }
      }

      updatedGame = performScanAndCover(updatedGame, currentPlayer.id, sector.id, interactionState.sequenceId, initialLogs, interactionState.noData);

      setGame(updatedGame);
      if (gameEngineRef.current) gameEngineRef.current.setState(updatedGame);

      // TODO: implementer la tech 2 =  choix pour le scan 3 dans le secteur de mercure 
      // et/ou la tech 3 = scan 4 dans le secteur d'une carte défaussée
      // et/ou la tech 4 = choix entre sonde et deplacement
      // TODO passer a la next intereaction
      setInteractionState({ type: 'IDLE' });
      setHasPerformedMainAction(true);
      return;
    }

    // Cas 2: Clic direct depuis Idle (Raccourci Action Scan)
    if (interactionState.type === 'IDLE' && !hasPerformedMainAction) {
      const earthPos = getObjectPosition(
        'earth',
        game.board.solarSystem.rotationAngleLevel1 || 0,
        game.board.solarSystem.rotationAngleLevel2 || 0,
        game.board.solarSystem.rotationAngleLevel3 || 0
      );

      if (earthPos) {
        const currentPlayer = game.players[game.currentPlayerIndex];
        const hasObs1 = currentPlayer.technologies.some(t => t.id.startsWith('observation-1'));

        let isValid = earthPos.absoluteSector === sectorNumber;
        if (!isValid && hasObs1) {
          const prev = earthPos.absoluteSector === 1 ? 8 : earthPos.absoluteSector - 1;
          const next = earthPos.absoluteSector === 8 ? 1 : earthPos.absoluteSector + 1;
          if (sectorNumber === prev || sectorNumber === next) isValid = true;
        }

        if (isValid) {
          handleAction(ActionType.SCAN_SECTOR, { sectorId: `sector_${sectorNumber}` });
        }
      }
      return;
    }
  };

  // Gestionnaire pour les actions
  const handleAction = (actionType: ActionType, payload?: any) => {
    if (!gameEngineRef.current) return;

    // Atomicité : Si on est dans un mode interactif, on ne peut pas lancer d'autre action
    if (interactionState.type !== 'IDLE') return;

    // Si une action principale a déjà été faite, on ne peut pas en faire d'autre (sauf PASS qui est géré spécifiquement)
    if (hasPerformedMainAction && actionType !== ActionType.PASS) return;

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

      // Scanner secteur initial (Earth or Adjacent if selected)
      let targetSectorId = payload?.sectorId;
      if (!targetSectorId) {
        const earthPos = getObjectPosition(
          'earth',
          updatedGame.board.solarSystem.rotationAngleLevel1 || 0,
          updatedGame.board.solarSystem.rotationAngleLevel2 || 0,
          updatedGame.board.solarSystem.rotationAngleLevel3 || 0
        );
        if (earthPos) targetSectorId = `sector_${earthPos.absoluteSector}`;
      }

      if (targetSectorId) {
        updatedGame = performScanAndCover(updatedGame, updatedPlayer.id, targetSectorId, sequenceId);
      }

      setGame(updatedGame);
      if (gameEngineRef.current) gameEngineRef.current.setState(updatedGame);

      setInteractionState({ type: 'SELECTING_SCAN_CARD', sequenceId });
      setIsRowOpen(true);
      setToast({ message: "Sélectionnez une carte de la rangée pour déterminer la couleur du secteur à scanner", visible: true });
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

        // Payer le coût
        player.energy -= 1;

        // Mettre à jour GameEngine
        DataSystem.clearComputer(player);

        // Finaliser la transaction
        setGame(updatedGame);
        if (gameEngineRef.current) gameEngineRef.current.setState(updatedGame);
        setHasPerformedMainAction(true);
        // TODO: Passer en mode placement de trace de vie
        setInteractionState({ type: 'IDLE' });
        setToast({ message: "Données analysées.", visible: true });
        addToHistory(`paye 1 énergie pour <strong>Analyser les données</strong>`, player.id, previousState);
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
      // Désactivé temporairement pour éviter de bloquer le jeu
      // newPendingInteractions.push({ type: 'PLACING_LIFE_TRACE', color: LifeTraceColor.YELLOW });
      setToast({ message: "Bonus LifeTrace : Fonctionnalité à venir", visible: true });
    }
    if (bonuses.redlifetrace) {
      // Désactivé temporairement pour éviter de bloquer le jeu
      // newPendingInteractions.push({ type: 'PLACING_LIFE_TRACE', color: LifeTraceColor.RED });
      setToast({ message: "Bonus LifeTrace : Fonctionnalité à venir", visible: true });
    }
    if (bonuses.bluelifetrace) {
      // Désactivé temporairement pour éviter de bloquer le jeu
      // newPendingInteractions.push({ type: 'PLACING_LIFE_TRACE', color: LifeTraceColor.BLUE });
      setToast({ message: "Bonus LifeTrace : Fonctionnalité à venir", visible: true });
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
    if (bonuses.earthscan) {
      const rotationState = createRotationState(
        game.board.solarSystem.rotationAngleLevel1 || 0,
        game.board.solarSystem.rotationAngleLevel2 || 0,
        game.board.solarSystem.rotationAngleLevel3 || 0
      );
      const earthPos = getObjectPosition('earth', rotationState.level1Angle, rotationState.level2Angle, rotationState.level3Angle);
      if (earthPos) {
        const earthSector = game.board.sectors[earthPos.absoluteSector - 1];
        if (earthSector) {
          // TODO: Il n'y en a qu'un cette action pour être faite immédiatement...
          for (let i = 0; i < bonuses.earthscan; i++) {
            newPendingInteractions.push({ type: 'SELECTING_SCAN_SECTOR', color: earthSector.color, noData: bonuses.noData });
          }
        }
      }
    }
    if (bonuses.probescan) {
      // TODO: SELECTING_PROBE if multiple... sinon action immédiate
    }

//            noData: bonuses.noData,
//            anyProbe: bonuses.anyProbe,
//            adjacents: bonuses.gainSignalAdjacents,
//            keepCardIfOnly: bonuses.keepCardIfOnly,
//            cardId: sourceId

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
    
    return { updatedGame, newPendingInteractions, logs, passiveGains };
  };

  // Gestionnaire pour placer une trace de vie
  const handlePlaceLifeTrace = (boardIndex: number, color: LifeTraceType) => {
    if (interactionState.type !== 'PLACING_LIFE_TRACE') return;

    const currentPlayer = game.players[game.currentPlayerIndex];
    let updatedGame = structuredClone(game);
    const board = updatedGame.board.alienBoards[boardIndex];

    board.lifeTraces.push({
      id: `trace-${Date.now()}`,
      type: color,
      playerId: currentPlayer.id
    });

    const track = board.lifeTraces.filter(t => t.type === color);

    const isFirst = track.length === 1;
    const bonus = isFirst ? board.firstBonus : board.nextBonus;

    const { updatedGame: gameAfterBonus, newPendingInteractions, passiveGains, logs } = processBonuses(bonus, updatedGame, currentPlayer.id);

    setGame(gameAfterBonus);
    if (gameEngineRef.current) gameEngineRef.current.setState(gameAfterBonus);

    const sequenceId = interactionState.sequenceId;
    addToHistory(`place une trace de vie ${color} sur le plateau Alien ${boardIndex + 1}`, currentPlayer.id, game, undefined, sequenceId);
    logs.forEach(log => addToHistory(log, currentPlayer.id, gameAfterBonus, undefined, sequenceId));

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
      const result = actionFn(game, currentPlayer.id, probe.id, planetId);

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
        const ignoreLimit = card.passiveEffects?.some(e => e.type === 'IGNORE_PROBE_LIMIT' && e.value === true);
        // Vérifier la limite de sondes (sans vérifier le coût car c'est un gain)
        const canLaunch = ProbeSystem.canLaunchProbe(currentGame, currentPlayer.id, false, ignoreLimit);
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

    // Vérifier si la carte donne des données et si le joueur peut les stocker
    if (card && card.immediateEffects) {
      const dataEffect = card.immediateEffects.find(e => e.type === 'GAIN' && e.target === 'DATA');
      if (dataEffect) {
        if ((currentPlayer.data || 0) >= GAME_CONSTANTS.MAX_DATA) {
          setPlayCardConfirmation({
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
        if ((currentPlayer.data || 0) >= GAME_CONSTANTS.MAX_MEDIA_COVERAGE) {
          setPlayCardConfirmation({
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
          setPlayCardConfirmation({
            visible: true,
            cardId: cardId,
            message: "Vous n'avez aucune sonde sur une planète pour effectuer l'atterrissage. L'action sera perdue. Voulez-vous continuer ?"
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

    console.log(result);
    const { updatedGame: gameAfterBonuses, newPendingInteractions, passiveGains, logs: allBonusLogs } = processBonuses(result.bonuses, result.updatedGame, currentPlayer.id, cardId);
    console.log(newPendingInteractions);

    const card = currentGame.players[currentGame.currentPlayerIndex].cards.find(c => c.id === cardId)!;
    setGame(gameAfterBonuses);
    if (gameEngineRef.current) gameEngineRef.current.setState(gameAfterBonuses);
    setHasPerformedMainAction(true);

    const sequenceId = `seq-${Date.now()}`;

    const gainsText = passiveGains.length > 0 ? ` (Gains: ${passiveGains.join(', ')})` : '';
    //setToast({ message: `Carte jouée: ${card.name}${gainsText}`, visible: true });

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
      setIsRowOpen(false);
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
          setIsRowOpen(false);
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

    // Mettre à jour GameEngine
    const result = ResourceSystem.tradeResources(game, currentPlayer.id, 'card', interactionState.targetGain, interactionState.selectedCards);
    if (result.error) {
      setToast({ message: result.error, visible: true });
      return;
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
    setIsTechOpen(false);
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
      if (interactionState.type === 'IDLE' && !hasPerformedMainAction) {
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
    switch (color) {
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

  // Calcul des secteurs à mettre en surbrillance (flash vert)
  const getHighlightedSectors = () => {
    if (interactionState.type === 'SELECTING_SCAN_SECTOR') {
      if (interactionState.color === SectorColor.ANY) {
        return game.board.sectors.map(s => s.id);
      }
      return game.board.sectors.filter(s => s.color === interactionState.color).map(s => s.id);
    }
    if (interactionState.type === 'IDLE' && !hasPerformedMainAction) {
      // Earth sector
      const earthPos = getObjectPosition('earth', game.board.solarSystem.rotationAngleLevel1 || 0, game.board.solarSystem.rotationAngleLevel2 || 0, game.board.solarSystem.rotationAngleLevel3 || 0);
      if (earthPos) {
        const sectors = [`sector_${earthPos.absoluteSector}`];

        const currentPlayer = game.players[game.currentPlayerIndex];
        const hasObs1 = currentPlayer.technologies.some(t => t.id.startsWith('observation-1'));

        if (hasObs1) {
          const prev = earthPos.absoluteSector === 1 ? 8 : earthPos.absoluteSector - 1;
          const next = earthPos.absoluteSector === 8 ? 1 : earthPos.absoluteSector + 1;
          sectors.push(`sector_${prev}`);
          sectors.push(`sector_${next}`);
        }
        return sectors;
      }
    }
    return [];
  };

  // Helper pour le tooltip des slots Alien
  const renderAlienSlotTooltip = (boardIndex: number, colorType: LifeTraceType) => {
    const board = game.board.alienBoards[boardIndex];
    if (!board) return null;

    const traces = board.lifeTraces.filter(t => t.type === colorType);
    let colorName = "";
    let colorHex = "";

    if (colorType === LifeTraceType.RED) {
      colorName = "Rouge";
      colorHex = "#ff6b6b";
    } else if (colorType === LifeTraceType.BLUE) {
      colorName = "Bleue";
      colorHex = "#4a9eff";
    } else if (colorType === LifeTraceType.YELLOW) {
      colorName = "Jaune";
      colorHex = "#ffd700";
    }

    const formatBonusSimple = (bonus: any) => {
      const parts = [];
      if (bonus.pv) parts.push(`${bonus.pv} PV`);
      if (bonus.media) parts.push(`${bonus.media} Média`);
      return parts.join(', ') || 'Aucun';
    };

    return (
      <div style={{ textAlign: 'center', minWidth: '180px' }}>
        <div style={{ fontWeight: 'bold', color: colorHex, marginBottom: '6px', borderBottom: '1px solid #555', paddingBottom: '4px' }}>
          Trace de vie {colorName}
        </div>

        {traces.length > 0 ? (
          <div style={{ marginBottom: '8px' }}>
            <div style={{ fontSize: '0.8em', color: '#aaa', marginBottom: '2px' }}>Découvert par :</div>
            {traces.map((trace, idx) => {
              const player = game.players.find(p => p.id === trace.playerId);
              return (
                <div key={idx} style={{ color: player?.color || '#fff', fontWeight: 'bold', fontSize: '0.9em' }}>
                  {player?.name || 'Inconnu'}
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ fontStyle: 'italic', color: '#888', marginBottom: '8px', fontSize: '0.9em' }}>Aucune trace découverte</div>
        )}

        <div style={{ fontSize: '0.8em', marginTop: '4px', borderTop: '1px solid #555', paddingTop: '4px', textAlign: 'left' }}>
          <div style={{ color: '#ccc', marginBottom: '2px' }}>Bonus 1ère découverte : <span style={{ color: '#ffd700', float: 'right' }}>{formatBonusSimple(board.firstBonus)}</span></div>
          <div style={{ color: '#ccc' }}>Bonus suivants : <span style={{ color: '#ffd700', float: 'right' }}>{formatBonusSimple(board.nextBonus)}</span></div>
        </div>
      </div>
    );
  };

  const currentPlayer = game.players[game.currentPlayerIndex];
  const canResearch = !hasPerformedMainAction && interactionState.type === 'IDLE' && currentPlayer.mediaCoverage >= GAME_CONSTANTS.TECH_RESEARCH_COST_MEDIA;

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
          transition: box-shadow 0.3s ease, border-color 0.3s ease;
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
        @keyframes icon-text-flash {
          0% { text-shadow: 0 0 0 rgba(76, 175, 80, 0); transform: scale(1); }
          50% { text-shadow: 0 0 15px rgba(76, 175, 80, 1); transform: scale(1.2); color: #4caf50; }
          100% { text-shadow: 0 0 0 rgba(76, 175, 80, 0); transform: scale(1); }
        }
        @keyframes container-glow-flash {
          0% { box-shadow: 0 0 0 0 rgba(76, 175, 80, 0); border-color: #555; }
          50% { box-shadow: 0 0 10px 5px rgba(76, 175, 80, 0.6); border-color: #4caf50; }
          100% { box-shadow: 0 0 0 0 rgba(76, 175, 80, 0); border-color: #555; }
        }
        .icon-flash {
          animation: icon-text-flash 2s ease-in-out infinite;
          display: inline-block;
        }
        .container-flash {
          animation: container-glow-flash 2s ease-in-out infinite;
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
                )
              })}
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

      {/* Modale de choix Média ou Déplacement (Carte 19) */}
      {interactionState.type === 'CHOOSING_MEDIA_OR_MOVE' && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 2000,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            backgroundColor: '#2a2a2a', padding: '20px', borderRadius: '8px',
            maxWidth: '400px', width: '90%', border: '1px solid #4a9eff',
            boxShadow: '0 0 20px rgba(74, 158, 255, 0.2)', textAlign: 'center'
          }}>
            <h3 style={{ marginTop: 0, color: '#4a9eff' }}>Faites un choix</h3>
            <p style={{ marginBottom: '20px', color: '#ddd' }}>Choisissez votre bonus :</p>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                onClick={() => handleMediaOrMoveChoice('MEDIA')}
                style={{
                  padding: '15px 20px',
                  backgroundColor: '#ff6b6b',
                  color: '#fff',
                  border: 'none', borderRadius: '4px',
                  cursor: 'pointer', fontWeight: 'bold',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px',
                  minWidth: '100px'
                }}
              >
                <span style={{ fontSize: '1.5em' }}>🎤</span>
                <span>1 Média</span>
              </button>

              <button
                onClick={() => handleMediaOrMoveChoice('MOVE')}
                style={{
                  padding: '15px 20px',
                  backgroundColor: '#ffd700',
                  color: '#000',
                  border: 'none', borderRadius: '4px',
                  cursor: 'pointer', fontWeight: 'bold',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px',
                  minWidth: '100px'
                }}
              >
                <span style={{ fontSize: '1.5em' }}>🚀</span>
                <span>1 Déplacement</span>
              </button>
            </div>
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
      {(interactionState.type === 'ACQUIRING_TECH' || interactionState.type === 'ACQUIRING_CARD' || interactionState.type === 'RESERVING_CARD' || interactionState.type === 'SELECTING_SCAN_CARD') && (
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
          } else if (interactionState.type === 'SELECTING_SCAN_CARD') {
            setIsRowOpen(false);
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
              selectedCardIds={interactionState.type === 'DISCARDING_CARD' || interactionState.type === 'TRADING_CARD' || interactionState.type === 'RESERVING_CARD' || interactionState.type === 'DISCARDING_FOR_SIGNAL' ? interactionState.selectedCards : []}
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
              onGameUpdate={(newGame) => {
                setGame(newGame);
                if (gameEngineRef.current) gameEngineRef.current.setState(newGame);
              }}
              isSelectingComputerSlot={interactionState.type === 'SELECTING_COMPUTER_SLOT'}
              onComputerSlotSelect={handleComputerColumnSelect}
              isAnalyzing={interactionState.type === 'ANALYZING'}
              hasPerformedMainAction={hasPerformedMainAction}
              onNextPlayer={handleNextPlayer}
              onHistory={(message, sequenceId) => addToHistory(message, game.players[game.currentPlayerIndex].id, game, undefined, sequenceId)}
              onComputerBonus={handleComputerBonus}
              isPlacingLifeTrace={interactionState.type === 'PLACING_LIFE_TRACE'}
              isSelectingSector={interactionState.type === 'SELECTING_SCAN_SECTOR' || interactionState.type === 'SELECTING_SCAN_CARD'}
              isDiscardingForSignal={interactionState.type === 'DISCARDING_FOR_SIGNAL'}
              onConfirmDiscardForSignal={handleConfirmDiscardForSignal}
              discardForSignalCount={interactionState.type === 'DISCARDING_FOR_SIGNAL' ? interactionState.count : 0}
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
              onSectorClick={handleSectorClick}
              highlightPlayerProbes={interactionState.type === 'MOVING_PROBE'}
              highlightedSectorSlots={getHighlightedSectors()}
              animateSectorSlots={interactionState.type === 'IDLE'}
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
              isRemovingOrbiter={interactionState.type === 'REMOVING_ORBITER'}
            />

            {/* Plateaux annexes en haut à gauche */}
            <div style={{
              position: 'absolute',
              top: '-5px',
              left: '-5px',
              width: '600px',
              padding: '20px',
              zIndex: (interactionState.type === 'ACQUIRING_TECH' || interactionState.type === 'ACQUIRING_CARD' || interactionState.type === 'SELECTING_SCAN_CARD') ? 1501 : 1000,
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              maxHeight: 'calc(100% - 10px)',
              overflowY: 'auto',
              pointerEvents: 'none',
            }}>
              <div className={`seti-foldable-container seti-icon-panel ${isObjectivesOpen ? 'open' : 'collapsed'}`} style={{ pointerEvents: 'auto' }}>
                <div className="seti-foldable-header" onClick={() => setIsObjectivesOpen(!isObjectivesOpen)}>
                  <span className="panel-icon">🏆</span>
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

              <div className={`seti-foldable-container seti-icon-panel ${isTechOpen ? 'open' : 'collapsed'} ${canResearch && !isTechOpen ? 'container-flash' : ''}`}
                style={{
                  pointerEvents: 'auto',
                  ...(interactionState.type === 'ACQUIRING_TECH' ? { borderColor: '#4a9eff', boxShadow: '0 0 20px rgba(74, 158, 255, 0.3)' } : {})
                }}
              >
                <div className="seti-foldable-header" onClick={() => setIsTechOpen(!isTechOpen)}>
                  <span className={`panel-icon ${canResearch ? 'icon-flash' : ''}`}>🔬</span>
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
                  ...(interactionState.type === 'ACQUIRING_CARD' || interactionState.type === 'SELECTING_SCAN_CARD' ? { borderColor: '#4a9eff', boxShadow: '0 0 20px rgba(74, 158, 255, 0.3)' } : {})
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
                          border: (interactionState.type === 'ACQUIRING_CARD' || interactionState.type === 'SELECTING_SCAN_CARD') ? '1px solid #4a9eff' : '1px solid #555',
                          cursor: (interactionState.type === 'ACQUIRING_CARD' || interactionState.type === 'SELECTING_SCAN_CARD') ? 'pointer' : 'default',
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
                    {historyLog.length === 0 && <div style={{ fontStyle: 'italic', padding: '4px', textAlign: 'center' }}>Aucune action</div>}
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

            {/* Plateau Alien A en bas à gauche */}
            <div style={{
              position: 'absolute',
              bottom: '15px',
              left: '15px',
              width: '240px',
              zIndex: 1000,
              display: 'flex',
              flexDirection: 'column',
              pointerEvents: 'none',
              alignItems: 'flex-start'
            }}>
              <div className={`seti-foldable-container seti-icon-panel ${isAlienBoardAOpen ? 'open' : 'collapsed'}`} style={{
                pointerEvents: 'auto',
                flexDirection: 'column-reverse',
                borderTopLeftRadius: '50px',
                borderTopRightRadius: '50px',
              }}>
                <div className="seti-foldable-header" onClick={() => setIsAlienBoardAOpen(!isAlienBoardAOpen)}>
                  <span className="panel-icon">👽</span>
                  <span className="panel-title">Alien Board</span>
                </div>
                <div className="seti-foldable-content" style={{ display: 'flex', flexDirection: 'column' }}>
                  {/* Contenu vide pour l'instant */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-around',
                    width: '100%',
                    padding: '10px 15px',
                    marginTop: 'auto', // Push to bottom
                    borderTop: '1px solid #444'
                  }}>
                    {/* Red Life Trace Slot */}
                    <AlienTriangleSlot color="#ff6b6b"
                      traces={game.board.alienBoards[0].lifeTraces.filter(t => t.type === LifeTraceType.RED)}
                      game={game}
                      isClickable={interactionState.type === 'PLACING_LIFE_TRACE' && interactionState.color === LifeTraceType.RED}
                      onClick={() => handlePlaceLifeTrace(0, LifeTraceType.RED)}
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setActiveTooltip({ content: renderAlienSlotTooltip(0, LifeTraceType.RED), rect });
                      }}
                      onMouseLeave={() => setActiveTooltip(null)}
                    />
                    {/* Blue Life Trace Slot */}
                    <AlienTriangleSlot color="#4a9eff"
                      traces={game.board.alienBoards[0].lifeTraces.filter(t => t.type === LifeTraceType.BLUE)}
                      game={game}
                      isClickable={interactionState.type === 'PLACING_LIFE_TRACE' && interactionState.color === LifeTraceType.BLUE}
                      onClick={() => handlePlaceLifeTrace(0, LifeTraceType.BLUE)}
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setActiveTooltip({ content: renderAlienSlotTooltip(0, LifeTraceType.BLUE), rect });
                      }}
                      onMouseLeave={() => setActiveTooltip(null)}
                    />
                    {/* Yellow Life Trace Slot */}
                    <AlienTriangleSlot color="#ffd700"
                      traces={game.board.alienBoards[0].lifeTraces.filter(t => t.type === LifeTraceType.YELLOW)}
                      game={game}
                      isClickable={interactionState.type === 'PLACING_LIFE_TRACE' && interactionState.color === LifeTraceType.YELLOW}
                      onClick={() => handlePlaceLifeTrace(0, LifeTraceType.YELLOW)}
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setActiveTooltip({ content: renderAlienSlotTooltip(0, LifeTraceType.YELLOW), rect });
                      }}
                      onMouseLeave={() => setActiveTooltip(null)}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Plateau Alien B en bas à droite */}
            <div style={{
              position: 'absolute',
              bottom: '15px',
              right: '15px',
              width: '240px',
              zIndex: 1000,
              display: 'flex',
              flexDirection: 'column',
              pointerEvents: 'none',
              alignItems: 'flex-end'
            }}>
              <div className={`seti-foldable-container seti-icon-panel ${isAlienBoardBOpen ? 'open' : 'collapsed'}`} style={{
                pointerEvents: 'auto',
                flexDirection: 'column-reverse',
                borderTopLeftRadius: '50px',
                borderTopRightRadius: '50px',
              }}>
                <div className="seti-foldable-header" onClick={() => setIsAlienBoardBOpen(!isAlienBoardBOpen)}>
                  <span className="panel-icon">👽</span>
                  <span className="panel-title">Alien Board</span>
                </div>
                <div className="seti-foldable-content" style={{ display: 'flex', flexDirection: 'column' }}>
                  {/* Contenu vide pour l'instant */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-around',
                    width: '100%',
                    padding: '10px 15px',
                    marginTop: 'auto', // Push to bottom
                    borderTop: '1px solid #444'
                  }}>
                    {/* Red Life Trace Slot */}
                    <AlienTriangleSlot color="#ff6b6b"
                      traces={game.board.alienBoards[1].lifeTraces.filter(t => t.type === LifeTraceType.RED)}
                      game={game}
                      isClickable={interactionState.type === 'PLACING_LIFE_TRACE' && interactionState.color === LifeTraceType.RED}
                      onClick={() => handlePlaceLifeTrace(1, LifeTraceType.RED)}
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setActiveTooltip({ content: renderAlienSlotTooltip(1, LifeTraceType.RED), rect });
                      }}
                      onMouseLeave={() => setActiveTooltip(null)}
                    />
                    {/* Blue Life Trace Slot */}
                    <AlienTriangleSlot color="#4a9eff"
                      traces={game.board.alienBoards[1].lifeTraces.filter(t => t.type === LifeTraceType.BLUE)}
                      game={game}
                      isClickable={interactionState.type === 'PLACING_LIFE_TRACE' && interactionState.color === LifeTraceType.BLUE}
                      onClick={() => handlePlaceLifeTrace(1, LifeTraceType.BLUE)}
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setActiveTooltip({ content: renderAlienSlotTooltip(1, LifeTraceType.BLUE), rect });
                      }}
                      onMouseLeave={() => setActiveTooltip(null)}
                    />
                    {/* Yellow Life Trace Slot */}
                    <AlienTriangleSlot color="#ffd700"
                      traces={game.board.alienBoards[1].lifeTraces.filter(t => t.type === LifeTraceType.YELLOW)}
                      game={game}
                      isClickable={interactionState.type === 'PLACING_LIFE_TRACE' && interactionState.color === LifeTraceType.YELLOW}
                      onClick={() => handlePlaceLifeTrace(1, LifeTraceType.YELLOW)}
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setActiveTooltip({ content: renderAlienSlotTooltip(1, LifeTraceType.YELLOW), rect });
                      }}
                      onMouseLeave={() => setActiveTooltip(null)}
                    />
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
