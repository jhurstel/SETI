import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Game, ActionType, Card, DiskName, SectorNumber, GAME_CONSTANTS, Bonus, Technology, ProbeState, LifeTraceType, InteractionState, GamePhase, SignalType, getInteractionLabel, LifeTraceLocation } from '../core/types';
import { ConfirmModal, AlienDiscoveryModal, MediaOrMoveModal, Observation2Modal, Observation3Modal, Observation4Modal, BonusChoiceModal, EndGameModal, CentaurienRewardModal, ExertienCardModal } from './modals/GameModals';
import { SolarSystemBoardUI } from './SolarSystemBoardUI';
import { TechnologyBoardUI } from './TechnologyBoardUI';
import { PlayerBoardUI } from './PlayerBoardUI';
import { ActionValidator } from '../core/ActionValidator';
import { AnalyzeDataAction } from '../actions/AnalyzeDataAction';
import { ProbeSystem } from '../systems/ProbeSystem';
import { CardSystem } from '../systems/CardSystem';
import { ResourceSystem } from '../systems/ResourceSystem';
import { ComputerSystem } from '../systems/ComputerSystem';
import { ScanSystem } from '../systems/ScanSystem';
import { GameSession } from '../session/GameSession';
import { Choice, Command } from '../session/commands';
import { useAITurn } from './hooks/useAITurn';
import { useAutosave } from './hooks/useAutosave';
import { useGameSession, RobotStep } from './hooks/useGameSession';
import { DebugPanel } from './DebugPanel';
import { useDebugSetting } from './hooks/useDebugSetting';
import { PassModal } from './modals/PassModal';
import { CardPickModal } from './modals/CardPickModal';
import { Tooltip } from './Tooltip';
import { ObjectiveBoardUI } from './ObjectiveBoardUI';
import { HistoryBoardUI } from './HistoryBoardUI';
import { CardRowUI } from './CardRowUI';
import { AlienBoardUI } from './AlienBoardUI';
import { SettingsModal } from './modals/SettingsModal';
import { PlanetBoardUI } from './PlanetBoardUI';
import './BoardUI.css';

/** Modes propres à l'interface (sélection avant la commande, animation) : la partie n'en sait rien */
type LocalMode = Extract<InteractionState, { type: 'DISCARDING_CARD' | 'TRADING_CARD' | 'ANALYZING' }>;

const DISCOVERY_NOTICE = "Découverte d'une nouvelle espèce Alien !";

export const BoardUI: React.FC = () => {
  // La partie et son journal : tout passe par la session (GameSession)
  const session = useGameSession();
  const { game, gameRef, historyLog } = session;

  // États de l'interface
  const [toast, setToast] = useState<{ message: string; visible: boolean } | null>(null);
  const [showDebug, setShowDebug] = useDebugSetting();
  const [localMode, setLocalMode] = useState<LocalMode | null>(null);
  // Cartes sélectionnées pour l'interaction en cours (réservation, défausse pour signaux)
  const [selection, setSelection] = useState<string[]>([]);
  // Action Orbite / Atterrissage / Jouer une carte choisie : planètes ou cartes jouables mises en avant
  const [actionFocus, setActionFocus] = useState<'orbit' | 'land' | 'card' | null>(null);
  const [viewedPlayerId, setViewedPlayerId] = useState<string | null>(null);
  const [alienDiscoveryNotification, setAlienDiscoveryNotification] = useState<{ visible: boolean; message: string } | null>(null);
  const [activeTooltip, setActiveTooltip] = useState<{ content: React.ReactNode, rect: DOMRect, pointerEvents?: 'none' | 'auto', onMouseEnter?: () => void, onMouseLeave?: () => void } | null>(null);
  const [passModalState, setPassModalState] = useState<{ visible: boolean; cards: Card[]; selectedCardId: string | null; cardsToKeep?: string[] }>({ visible: false, cards: [], selectedCardId: null });
  const [confirmModalState, setConfirmModalState] = useState<{ visible: boolean; cardId: string | null; message: string; onConfirm?: () => void }>({ visible: false, cardId: null, message: '', onConfirm: undefined });
  const [settingsVisible, setSettingsVisible] = useState(true); // Ouvert au lancement

  // Interaction affichée : le mode local s'il y en a un, sinon celle de la partie (avec la sélection de cartes en cours)
  const sessionInteraction = game?.interaction;
  const interactionState: InteractionState = useMemo(() => localMode
    ?? (sessionInteraction
      ? ('selectedCards' in sessionInteraction ? { ...sessionInteraction, selectedCards: selection } as InteractionState : sessionInteraction)
      : { type: 'IDLE' }), [localMode, sessionInteraction, selection]);

  // Nouvelle interaction de la partie : sélection remise à zéro
  useEffect(() => { setSelection([]); }, [sessionInteraction]);

  const focusPlayer = game?.players[game.currentPlayerIndex];
  useEffect(() => {
    // L'action effectuée, une interaction ou un changement de joueur referme la mise en avant
    setActionFocus(null);
  }, [focusPlayer?.id, focusPlayer?.hasPerformedMainAction, interactionState.type]);

  // Message d'aide selon l'interaction en cours
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

  // Mise en place : le plateau du joueur humain qui réserve sa carte est affiché
  useEffect(() => {
    if (game?.phase === GamePhase.SETUP && sessionInteraction?.type === 'RESERVING_CARD') {
      setViewedPlayerId(game.players[game.currentPlayerIndex].id);
    }
  }, [game, sessionInteraction]);

  // Joueur qui résout l'interaction en cours : celui qu'elle désigne (gain reçu pendant le tour
  // d'un autre joueur, ex. secteur couvert par un robot), sinon le joueur actif
  const actingPlayer = (g: Game) => g.players.find(p => p.id === interactionState.playerId) ?? g.players[g.currentPlayerIndex];

  // Réservation d'une carte par le joueur humain : fenêtre centrale, comme le choix de fin de manche
  const reservingPlayer = game && interactionState.type === 'RESERVING_CARD' ? actingPlayer(game) : undefined;
  const isReservationModalActive = !!reservingPlayer && reservingPlayer.type === 'human';

  // Sauvegarde automatique à chaque modification du jeu
  useAutosave(game, historyLog);

  /** Annonces de la partie (découverte d'une espèce…) */
  const showNotifications = (notifications: string[]) => {
    notifications.forEach(message => {
      if (message === DISCOVERY_NOTICE) {
        setAlienDiscoveryNotification({ visible: true, message });
        setTimeout(() => setAlienDiscoveryNotification(null), 4000);
      } else {
        setToast({ message, visible: true });
      }
    });
  };

  /** Envoie une commande à la session au nom du joueur qui agit ; affiche l'erreur s'il y en a une */
  const run = (command: Command, playerId?: string): boolean => {
    const current = gameRef.current;
    if (!current) return false;
    const result = session.dispatch(playerId ?? actingPlayer(current).id, command);
    if (result.error) {
      setToast({ message: result.error, visible: true });
      return false;
    }
    showNotifications(result.notifications);
    return true;
  };
  const choose = (choice: Choice) => run({ type: 'CHOOSE', choice });

  const checkDataLimitAndProceed = (potentialDataGain: number, onConfirm: () => void) => {
    if (!game) return;
    const warning = ResourceSystem.lostBonusWarning(game, game.players[game.currentPlayerIndex].id, { data: potentialDataGain });
    if (warning) {
      setConfirmModalState({ visible: true, cardId: null, message: warning, onConfirm });
    } else {
      onConfirm();
    }
  };

  const checkBonusAndConfirm = useCallback((bonus: Bonus, onConfirm: () => void, cardId: string | null = null): boolean => {
    if (!game) return false;
    const warning = ResourceSystem.lostBonusWarning(game, game.players[game.currentPlayerIndex].id, bonus);
    if (!warning) return false;
    setConfirmModalState({ visible: true, cardId, message: warning, onConfirm });
    return true;
  }, [game]);

  // --- Annulation ---

  const humanPlayerId = game?.players.find(p => p.type === 'human')?.id;
  const resetInterface = () => {
    setLocalMode(null);
    setPassModalState({ visible: false, cards: [], selectedCardId: null });
  };
  const handleUndoTurn = () => {
    if (!humanPlayerId) return;
    setConfirmModalState({
      visible: true,
      cardId: null,
      message: "Revenir au début de votre dernier tour ? Toutes les actions jouées depuis, y compris celles des robots, seront annulées.",
      onConfirm: () => {
        session.undoTurn(humanPlayerId);
        resetInterface();
      }
    });
  };
  const handleUndo = () => {
    session.undo();
    resetInterface();
  };

  // --- Robots ---

  useAITurn(game, !!localMode || passModalState.visible, (step: RobotStep) => {
    const result = session.applyRobotStep(step);
    if (!result) return;
    if (result.error) {
      console.error('[AI] Étape refusée :', result.error);
      return;
    }
    showNotifications(result.notifications);
    if (step.kind === 'END_TURN_DONE') setToast({ message: "Au tour du joueur suivant. Patientez...", visible: true });
  });

  // --- Tour ---

  const handleNextPlayer = () => {
    if (!game || !GameSession.canEndTurn(game)) {
      setToast({ message: "Terminez d'abord l'action en cours avant de finir votre tour.", visible: true });
      return;
    }
    const before = game.currentPlayerIndex;
    if (run({ type: 'END_TURN' }) && gameRef.current?.currentPlayerIndex !== before) {
      setToast({ message: "Au tour du joueur suivant. Patientez...", visible: true });
    }
  };

  /** Passer : la main est ramenée à 4 cartes, puis la carte de manche est choisie s'il y en a */
  const startPass = (cardsToKeep: string[]) => {
    if (!game) return;
    const roundDeck = game.decks.roundDecks[game.currentRound];
    if (roundDeck && roundDeck.length > 0) {
      setPassModalState({ visible: true, cards: roundDeck, selectedCardId: null, cardsToKeep });
    } else {
      run({ type: 'PASS', cardsToKeep });
    }
  };

  // --- Sélection de cartes de la main ---

  const toggle = (selected: string[], cardId: string, max: number) =>
    selected.includes(cardId) ? selected.filter(id => id !== cardId) : max === 1 ? [cardId] : selected.length < max ? [...selected, cardId] : selected;

  const handleCardClick = (cardId: string) => {
    if (!game) return;
    if (localMode?.type === 'DISCARDING_CARD') {
      const max = CardSystem.cardsToDiscardAtPass(actingPlayer(game));
      setLocalMode({ ...localMode, selectedCards: toggle(localMode.selectedCards, cardId, Math.max(max, 2)).slice(0, max) });
    } else if (localMode?.type === 'TRADING_CARD') {
      setLocalMode({ ...localMode, selectedCards: toggle(localMode.selectedCards, cardId, Math.max(localMode.count, 2)).slice(0, localMode.count) });
    } else if (interactionState.type === 'RESERVING_CARD' || interactionState.type === 'DISCARDING_FOR_SIGNAL') {
      setSelection(toggle(selection, cardId, interactionState.count));
    }
  };

  // Confirmer la défausse : fin de manche (mode local), ou défausse pour signaux (interaction de la partie)
  const handleConfirmDiscard = () => {
    if (!game) return;
    if (localMode?.type === 'DISCARDING_CARD') {
      const hand = CardSystem.getHandCards(game.players[game.currentPlayerIndex]);
      const cardsToKeep = hand.filter(c => !localMode.selectedCards.includes(c.id)).map(c => c.id);
      setLocalMode(null);
      startPass(cardsToKeep);
    } else if (interactionState.type === 'DISCARDING_FOR_SIGNAL') {
      choose({ kind: 'CARDS', cardIds: selection });
    }
  };

  const handleConfirmReservation = (cardIds?: string[]) => {
    if (interactionState.type !== 'RESERVING_CARD') return;
    const cards = cardIds ?? selection;
    if (cards.length > 0) choose({ kind: 'CARDS', cardIds: cards });
  };

  const handleTradeCardAction = (targetGain?: string) => {
    if (interactionState.type !== 'IDLE' || !targetGain) return;
    setLocalMode({ type: 'TRADING_CARD', count: 2, targetGain, selectedCards: [] });
  };

  const handleConfirmTrade = () => {
    if (localMode?.type !== 'TRADING_CARD') return;
    if (run({ type: 'TRADE', spend: 'card', gain: localMode.targetGain, cardIds: localMode.selectedCards })) setLocalMode(null);
  };

  // --- Actions principales ---

  const handleSectorClick = (sectorId: string) => {
    if (!game) return;
    const sector = ScanSystem.getSectorById(game, sectorId);
    if (!sector) return;
    const nextSignal = sector.signals.find(s => !s.marked);

    if (interactionState.type === 'SELECTING_SCAN_SECTOR') {
      const dataGain = nextSignal && nextSignal.type !== SignalType.OTHER && !interactionState.noData ? 1 : 0;
      checkDataLimitAndProceed(dataGain, () => choose({ kind: 'SECTOR', sectorId }));
    } else if (interactionState.type === 'IDLE' && !game.players[game.currentPlayerIndex].hasPerformedMainAction) {
      // Clic direct sur un secteur : raccourci de l'action Scanner
      const dataGain = nextSignal && nextSignal.type !== SignalType.OTHER ? 1 : 0;
      checkDataLimitAndProceed(dataGain, () => run({ type: 'SCAN', sectorId }));
    }
  };

  const handleAction = (actionType: ActionType) => {
    if (!game || interactionState.type !== 'IDLE') return;
    const currentPlayer = game.players[game.currentPlayerIndex];

    switch (actionType) {
      case ActionType.LAUNCH_PROBE:
        run({ type: 'LAUNCH_PROBE' });
        break;
      case ActionType.SCAN_SECTOR:
        run({ type: 'SCAN' });
        break;
      case ActionType.ORBIT:
        setActionFocus('orbit');
        setToast({ message: "Veuillez sélectionner un emplacement d'orbite sur une planète.", visible: true });
        break;
      case ActionType.LAND:
        setActionFocus('land');
        setToast({ message: "Veuillez sélectionner un emplacement d'atterrissage sur une planète.", visible: true });
        break;
      case ActionType.PLAY_CARD:
        setActionFocus('card');
        setToast({ message: "Veuillez sélectionner une carte.", visible: true });
        break;
      case ActionType.RESEARCH_TECH:
        run({ type: 'RESEARCH_TECH' });
        break;
      case ActionType.ANALYZE_DATA: {
        const validation = ActionValidator.validateAction(game, new AnalyzeDataAction(currentPlayer.id));
        if (!validation.valid) {
          setToast({ message: validation.errors[0]?.message || "Analyse impossible", visible: true });
          return;
        }
        // Animation de l'analyse, puis la commande
        setLocalMode({ type: 'ANALYZING' });
        setTimeout(() => {
          setLocalMode(null);
          run({ type: 'ANALYZE' });
        }, 1500);
        break;
      }
      case ActionType.PASS: {
        const handSize = CardSystem.getHandCards(currentPlayer).length;
        const toDiscard = CardSystem.cardsToDiscardAtPass(currentPlayer);
        if (toDiscard > 0) {
          // Avertir avant de passer : le joueur ne jouera plus de la manche et perdra des cartes
          setConfirmModalState({
            visible: true,
            cardId: null,
            message: `Passer définitivement ? Vous ne pourrez plus agir avant la prochaine manche. Vous avez ${handSize} cartes en main : vous devrez en défausser ${toDiscard} pour n'en garder que ${GAME_CONSTANTS.HAND_SIZE_AFTER_PASS}.`,
            onConfirm: () => {
              setLocalMode({ type: 'DISCARDING_CARD', count: toDiscard, selectedCards: [] });
              setToast({ message: `Veuillez défausser pour ne garder que ${GAME_CONSTANTS.HAND_SIZE_AFTER_PASS} cartes en main.`, visible: true });
            }
          });
          return;
        }
        startPass(CardSystem.getHandCards(currentPlayer).map(c => c.id));
        break;
      }
    }
  };

  const handlePlayCardRequest = (cardId: string, force: boolean = false) => {
    if (!game) return;
    const card = game.players[game.currentPlayerIndex].cards.find(c => c.id === cardId);
    if (!card) return;
    if (!force && checkBonusAndConfirm(CardSystem.previewImmediateBonuses(card), () => handlePlayCardRequest(cardId, true), cardId)) return;
    run({ type: 'PLAY_CARD', cardId });
  };

  // --- Planètes et sondes ---

  /** Orbite ou atterrissage : retrait (cartes 15, 84), placement bonus, ou action principale */
  const handlePlanetPlacement = (kind: 'orbit' | 'land', planetId: string, slotIndex?: number) => {
    if (!game) return;
    if (interactionState.type === (kind === 'orbit' ? 'REMOVING_ORBITER' : 'REMOVING_LANDER')) {
      choose({ kind: 'PLANET', planetId, slotIndex });
      return;
    }
    if (!ProbeSystem.findProbeAtPlanet(game, actingPlayer(game).id, planetId)) return;

    const execute = () => {
      const bonusPlacement = interactionState.type === (kind === 'orbit' ? 'ORBITING_PROBE' : 'LANDING_PROBE');
      const done = bonusPlacement
        ? choose({ kind: 'PLANET', planetId, slotIndex })
        : run(kind === 'orbit' ? { type: 'ORBIT', planetId } : { type: 'LAND', planetId, slotIndex });
      if (done && !gameRef.current?.interaction) {
        setToast({ message: kind === 'orbit' ? 'Sonde mise en orbite' : 'Atterrissage réussi', visible: true });
      }
    };

    // Avertissement si le bonus de l'emplacement serait perdu
    const bonus = slotIndex !== undefined ? ProbeSystem.getSlotBonus(game, planetId, kind, slotIndex) : undefined;
    if (bonus && checkBonusAndConfirm(bonus, execute)) return;
    execute();
  };
  const handleOrbit = (planetId: string, slotIndex?: number) => handlePlanetPlacement('orbit', planetId, slotIndex);
  const handleLand = (planetId: string, slotIndex?: number) => handlePlanetPlacement('land', planetId, slotIndex);

  const handlePlanetClick = (planetId: string) => {
    if (interactionState.type === 'REMOVING_ORBITER') handleOrbit(planetId);
    else if (interactionState.type === 'REMOVING_LANDER') handleLand(planetId);
    else if (planetId === 'earth') run({ type: 'LAUNCH_PROBE' });
  };

  const handleMascamiteClick = (planetId: string, tokenIndex: number) => {
    if (interactionState.type !== 'COLLECTING_SPECIMEN' && interactionState.type !== 'CONSULTING_SPECIMEN') return;
    choose({ kind: 'SPECIMEN', planetId, tokenIndex });
  };

  /** Déplacement d'une sonde case par case (déplacements gratuits d'abord, puis énergie), animé */
  const handleProbeMove = async (probeId: string, path: string[]) => {
    for (let i = 1; i < path.length; i++) {
      const cellKey = path[i];
      if (!run({ type: 'MOVE_PROBE', probeId, disk: cellKey[0] as DiskName, sector: parseInt(cellKey.substring(1)) as SectorNumber })) break;
      // Carte 19 : le choix Média / déplacement interrompt le chemin
      if (gameRef.current?.interaction?.type === 'CHOOSING_MEDIA_OR_MOVE') {
        if (i < path.length - 1) setToast({ message: "Déplacement interrompu. Choisissez un bonus.", visible: true });
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    const moving = gameRef.current?.interaction;
    if (moving?.type === 'MOVING_PROBE') {
      setToast({ message: `Encore ${moving.count} déplacement${moving.count > 1 ? 's' : ''} gratuit${moving.count > 1 ? 's' : ''}. Sélectionnez une sonde à déplacer.`, visible: true });
    }
  };

  const handleBackgroundClick = () => {
    setActionFocus(null);
    if (interactionState.type === 'MOVING_PROBE') run({ type: 'SKIP' });
  };

  // --- Cartes, technologies, objectifs ---

  const handleCardRowClick = (cardId?: string) => { // cardId absent : la pioche
    if (interactionState.type === 'SELECTING_SCAN_CARD') {
      if (cardId) choose({ kind: 'CARD', cardId });
    } else if (interactionState.type === 'ACQUIRING_CARD') {
      choose({ kind: 'CARD', cardId });
    }
  };

  const handleTechClick = (tech: Technology) => {
    if (interactionState.type === 'ACQUIRING_TECH') choose({ kind: 'TECH', techId: tech.id });
    else if (interactionState.type === 'IDLE') run({ type: 'RESEARCH_TECH', techId: tech.id });
  };

  const handleComputerColumnSelect = (column: number) => {
    if (interactionState.type !== 'SELECTING_COMPUTER_SLOT' || !ComputerSystem.TECH_COLUMNS.includes(column)) return;
    choose({ kind: 'COMPUTER_COLUMN', column });
  };

  const handleObjectiveClick = (tileId: string) => {
    if (interactionState.type === 'PLACING_OBJECTIVE_MARKER') choose({ kind: 'OBJECTIVE', tileId });
  };

  const handlePlaceLifeTrace = (boardIndex: number, color: LifeTraceType, slotType: LifeTraceLocation, slotIndex?: number) => {
    if (interactionState.type === 'PLACING_LIFE_TRACE') choose({ kind: 'LIFE_TRACE', boardIndex, color, slotType, slotIndex });
  };

  const handleSpeciesCardClick = (speciesId: string, cardId: string) => {
    if (interactionState.type === 'ACQUIRING_ALIEN_CARD' && interactionState.speciesId === speciesId) choose({ kind: 'ALIEN_CARD', cardId });
  };

  const handleCentaurienRewardClick = (tokenIndex: number) => {
    if (interactionState.type === 'CHOOSING_CENTAURIEN_REWARD') choose({ kind: 'CENTAURIEN', tokenIndex });
  };

  const handleExertienCardChoice = (cardId?: string) => {
    if (interactionState.type === 'CHOOSING_EXERTIEN_CARD') choose({ kind: 'EXERTIEN', cardId });
  };

  const handleMenuChoice = (index: number) => {
    if (interactionState.type === 'CHOOSING_BONUS_ACTION') choose({ kind: 'MENU', index });
  };

  // --- Actions gratuites ---

  const handleDiscardCardAction = (cardId: string) => {
    if (interactionState.type === 'IDLE') run({ type: 'DISCARD_FOR_FREE_ACTION', cardId });
  };

  const handleBuyCardAction = () => {
    if (interactionState.type === 'IDLE') run({ type: 'BUY_CARD' });
  };

  const handleDirectTrade = (spend: string, gain: string) => {
    if (interactionState.type === 'IDLE') run({ type: 'TRADE', spend, gain });
  };

  const handleTransferData = (slotId: string) => {
    if (interactionState.type === 'IDLE') run({ type: 'TRANSFER_DATA', slotId });
  };

  const handleMissionClick = (missionId: string, requirementId: string) => {
    run({ type: 'CLAIM_MISSION', missionId, requirementId });
  };

  // Partie chargée ou nouvelle partie
  const handleLoadGame = (loaded: Game, log = historyLog.slice(0, 0)) => {
    resetInterface();
    showNotifications(session.load(loaded, log).notifications);
  };

  // Si le jeu n'est pas initialisé, afficher uniquement les modales de démarrage
  if (!game) {
    return (
      <div className="seti-root">
        <SettingsModal
          visible={settingsVisible}
          setVisible={setSettingsVisible}
          game={game}
          historyLog={historyLog}
          onLoadGame={handleLoadGame}
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
          setGame={(newGame) => session.replace(newGame, 'DEBUG : partie modifiée', currentPlayer.id)}
          onHistory={(message) => setToast({ message, visible: true })}
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
          const cardsToKeep = passModalState.cardsToKeep || CardSystem.getHandCards(currentPlayer).map(c => c.id);
          setPassModalState({ visible: false, cards: [], selectedCardId: null });
          run({ type: 'PASS', cardsToKeep, roundCardId: selectedCardId });
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
        const toDiscard = CardSystem.cardsToDiscardAtPass(actingPlayer(game));
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
          onCancel={() => setLocalMode(null)}
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
        <MediaOrMoveModal onChoice={(choice: 'MEDIA' | 'MOVE') => choose({ kind: 'MEDIA_OR_MOVE', choice })} />
      )}

      {/* Modale pour Observation 2 (Scanner un secteur) */}
      {interactionState.type === 'CHOOSING_OBS2_ACTION' && (
        <Observation2Modal onChoice={(accepted: boolean) => choose({ kind: 'ACCEPT', accepted })} />
      )}

      {/* Modale pour Observation 3 (Scanner un secteur) */}
      {interactionState.type === 'CHOOSING_OBS3_ACTION' && (
        <Observation3Modal onChoice={(accepted: boolean) => choose({ kind: 'ACCEPT', accepted })} />
      )}

      {/* Modale pour Observation 4 (Scanner un secteur) */}
      {interactionState.type === 'CHOOSING_OBS4_ACTION' && (() => {
        const canLaunch = currentPlayer.energy >= 1 && ProbeSystem.canLaunchProbe(game, currentPlayer.id, false).canLaunch;
        const canMove = currentPlayer.probes.some(p => p.state === ProbeState.IN_SOLAR_SYSTEM);
        return (
          <Observation4Modal onChoice={(choice: 'PROBE' | 'MOVE') => choose({ kind: 'OBS4', choice })} canLaunch={canLaunch} canMove={canMove} />
        );
      })()}

      {/* Menu de choix des bonus interactifs */}
      <BonusChoiceModal
        interactionState={interactionState}
        onChoice={handleMenuChoice}
        onFinish={() => run({ type: 'SKIP' })}
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
        historyLog={historyLog}
        onLoadGame={handleLoadGame}
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
              onTransferData={handleTransferData}
              onComputerSlotSelect={handleComputerColumnSelect}
              onNextPlayer={handleNextPlayer}
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
            onUndoTurn={session.canUndoTurn(humanPlayerId) ? handleUndoTurn : undefined}
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
