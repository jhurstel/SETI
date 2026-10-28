import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Game, ActionType, GAME_CONSTANTS, ProbeState, Card, Mission, InteractionState, TechnologyCategory, MAIN_ACTION_TYPES, CardType, CostType } from '../core/types';
import { ProbeSystem } from '../systems/ProbeSystem';
import { ComputerSystem } from '../systems/ComputerSystem'; 
import { CardSystem } from '../systems/CardSystem';
import { ScanSystem } from '../systems/ScanSystem';
import { PlayerComputer } from './components/PlayerComputer';
import { HandCard } from './components/HandCard';
import { MissionCard } from './components/MissionCard';
import { PlayedMissionCard } from './components/PlayedMissionCard';
import { SlotTooltip } from './components/SlotTooltip';
import { SLOT_COLORS } from './styles/slotColors';
import './PlayerBoardUI.css';

interface PlayerBoardUIProps {
  game: Game;
  playerId: string;
  interactionState: InteractionState;
  onViewPlayer: (playerId: string) => void;
  onAction: (actionType: ActionType) => void;
  onCardClick: (cardId: string) => void;
  onDiscardCardAction: (cardId: string) => void;
  onPlayCard: (cardId: string) => void;
  onBuyCardAction: () => void;
  onTradeCardAction: (targetGain?: string) => void;
  onGameUpdate: (game: Game) => void;
  onComputerSlotSelect: (col: number) => void;
  onNextPlayer: () => void;
  onHistory: (message: string, sequenceId?: string) => void;
  onComputerBonus: (type: string, amount: number, sequenceId?: string) => void;
  onDirectTradeAction: (spendType: string, gainType: string) => void;
  setActiveTooltip: (tooltip: { content: React.ReactNode, rect: DOMRect } | null) => void;
  onSettingsClick: () => void;
  onMissionClick: (missionId: string, requirementId: string) => void;
  onConfirmAction: (message: string, onConfirm: () => void) => void;
  /** Action « Jouer une carte » choisie : met en avant les cartes jouables de la main */
  highlightPlayableCards?: boolean;
}

interface ObservationTrackProps {
  game: Game;
  playerId: string;
  onAction: (actionType: ActionType) => void;
  isCurrentTurn: boolean;
  hasPerformedMainAction: boolean;
  isInteractiveMode: boolean;
  handleTooltipHover: (e: React.MouseEvent, content: React.ReactNode) => void;
  handleTooltipLeave: () => void;
}

const ObservationTrack: React.FC<ObservationTrackProps> = ({ game, playerId, onAction, isCurrentTurn, hasPerformedMainAction, isInteractiveMode, handleTooltipHover, handleTooltipLeave }) => {
  const player = game.players.find(p => p.id === playerId);
  if (!player) return null;

  const hasObs1 = player.technologies.some(t => t.id.startsWith('observation-1'));
  const hasObs2 = player.technologies.some(t => t.id.startsWith('observation-2'));
  const hasObs3 = player.technologies.some(t => t.id.startsWith('observation-3'));
  const hasObs4 = player.technologies.some(t => t.id.startsWith('observation-4'));

  const scanCheck = ScanSystem.canScanSector(game, playerId);
  let scanReason: string | null = null;
  if (!isCurrentTurn) scanReason = "Ce n'est pas votre tour";
  else if (hasPerformedMainAction) scanReason = 'Action principale déjà effectuée';
  else if (!scanCheck.canScan) scanReason = scanCheck.reason || 'Impossible de scanner';
  else if (isInteractiveMode) scanReason = "Terminez d'abord l'action en cours";
  const scanDisabled = scanReason !== null;

  const renderSlot = (
    icon: string,
    tooltip: React.ReactNode,
    isClickable: boolean,
    onClick?: () => void,
    isTech: boolean = false,
    techAcquired: boolean = false,
    isAvailableForAction: boolean = false
  ) => {
    let className = 'obs-track-slot';
    if (isTech) {
      className += techAcquired ? ' tech-acquired' : ' tech-locked';
    }
    if (isClickable) {
      className += ' clickable';
    }
    if (isAvailableForAction) {
      className += ' seti-flash-green';
    }

    return (
      <div
        className={className}
        onClick={() => isClickable && onClick ? onClick() : null}
        onMouseEnter={(e) => handleTooltipHover(e, tooltip)}
        onMouseLeave={handleTooltipLeave}
      >
        {icon}
      </div>
    );
  };

  // Étape du scan : disponible si la technologie requise est acquise (ou sans technologie) ; coût éventuel en fin de 3e ligne
  const stepTooltip = (bonus: string, requiredTech: string | null, acquired: boolean, cost?: string) => {
    const costSuffix = cost ? ` (coût : ${cost})` : '';
    return acquired
      ? <SlotTooltip status="Disponible" statusColor={SLOT_COLORS.available} value={bonus} note={`${requiredTech ? 'Proposé à chaque scan' : 'Effectué à chaque scan'}${costSuffix}`} />
      : <SlotTooltip status="Indisponible" statusColor={SLOT_COLORS.unavailable} value={bonus} note={`Nécessite la technologie ${requiredTech}${costSuffix}`} />;
  };

  const scanTooltip = scanDisabled
    ? <SlotTooltip status="Indisponible" statusColor={SLOT_COLORS.unavailable} label="Coût" value="1 Crédit, 2 Énergies" note={scanReason} />
    : <SlotTooltip status="Disponible" statusColor={SLOT_COLORS.available} label="Coût" value="1 Crédit, 2 Énergies" note="Cliquez pour scanner" />;

  return (
    <div className="obs-track-container">
      {renderSlot('🔭', scanTooltip, !scanDisabled, () => onAction(ActionType.SCAN_SECTOR), false, false, !scanDisabled)}
      <div className="obs-track-connector" />
      {renderSlot('🌍', stepTooltip(hasObs1 ? 'Signal dans le secteur de la Terre ou un secteur adjacent' : 'Signal dans le secteur de la Terre', null, true), false)}
      <div className="obs-track-connector" />
      {renderSlot('🃏', stepTooltip("Signal dans le secteur d'une carte de la rangée", null, true), false)}
      <div className="obs-track-connector" />
      {renderSlot('☿️', stepTooltip('Signal dans le secteur de Mercure', 'Observation II', hasObs2, '1 Média'), false, undefined, true, hasObs2)}
      <div className="obs-track-connector" />
      {renderSlot('🗑️', stepTooltip("Signal dans le secteur d'une carte de la main", 'Observation III', hasObs3, '1 carte'), false, undefined, true, hasObs3)}
      <div className="obs-track-connector" />
      {renderSlot('?', stepTooltip('Lancer une sonde (coût : 1 Énergie) ou Gagner 1 déplacement', 'Observation IV', hasObs4), false, undefined, true, hasObs4)}
    </div>
  );
};

export const PlayerBoardUI: React.FC<PlayerBoardUIProps> = ({ game, playerId, interactionState, onViewPlayer, onAction, onCardClick, onDiscardCardAction, onPlayCard, onBuyCardAction, onTradeCardAction, onGameUpdate, onComputerSlotSelect, onNextPlayer, onHistory, onComputerBonus, onDirectTradeAction, setActiveTooltip, onSettingsClick, onMissionClick, onConfirmAction, highlightPlayableCards = false }) => {
  const currentPlayer = playerId 
    ? (game.players.find(p => p.id === playerId) || game.players[game.currentPlayerIndex])
    : game.players[game.currentPlayerIndex];
  
  const isCurrentTurn = game.players[game.currentPlayerIndex].id === currentPlayer.id;
  const isRobot = currentPlayer.type === 'robot';
  const [highlightedCardId, setHighlightedCardId] = useState<string | null>(null);

  const hasPerformedMainAction = currentPlayer.hasPerformedMainAction;
  const isDiscarding = interactionState.type === 'DISCARDING_CARD';
  const isTrading = interactionState.type === 'TRADING_CARD';
  const isReserving = interactionState.type === 'RESERVING_CARD';
  const isDiscardingForSignal = interactionState.type === 'DISCARDING_FOR_SIGNAL';
  const isSelectingComputerSlot = interactionState.type === 'SELECTING_COMPUTER_SLOT';
  const isAnalyzing = interactionState.type === 'ANALYZING';
  const isPlacingLifeTrace = interactionState.type === 'PLACING_LIFE_TRACE';
  const isSelectingSector = interactionState.type === 'SELECTING_SCAN_SECTOR' || interactionState.type === 'SELECTING_SCAN_CARD';



  const handCards = currentPlayer.cards.filter(c => c.type !== CardType.EXERTIEN);
  const playableCardIds = highlightPlayableCards ? CardSystem.getPlayableCardIds(game, currentPlayer.id) : [];
  // Action « Jouer une carte » choisie : la main est ramenée à l'écran
  const cardsListRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (highlightPlayableCards) cardsListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [highlightPlayableCards]);

  const handleTooltipHover = useCallback((e: React.MouseEvent, content: React.ReactNode) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setActiveTooltip({ content, rect });
  }, [setActiveTooltip]);

  const handleTooltipLeave = useCallback(() => {
    setActiveTooltip(null);
  }, [setActiveTooltip]);
  
  const isInteractiveMode = isDiscarding || isTrading || isReserving || isSelectingComputerSlot || isAnalyzing || isPlacingLifeTrace || isSelectingSector || isDiscardingForSignal || interactionState.type === 'CHOOSING_BONUS_ACTION' || interactionState.type === 'CLAIMING_MISSION_REQUIREMENT';

  // Suivi des changements de ressources pour la notification sur les onglets
  const [tabFlashes, setTabFlashes] = useState<Record<string, boolean>>({});
  const prevResourcesRef = useRef<Record<string, { credits: number, energy: number, media: number, data: number, cards: number }>>({});

  useEffect(() => {
    const newFlashes: Record<string, boolean> = {};
    let hasChanges = false;

    game.players.forEach(p => {
      const prev = prevResourcesRef.current[p.id];
      const current = { credits: p.credits, energy: p.energy, media: p.mediaCoverage, data: p.data || 0, cards: p.cards.filter(c => c.type !== CardType.EXERTIEN).length };
      
      if (prev) {
        if (current.credits > prev.credits || current.energy > prev.energy || current.media > prev.media || current.data > prev.data || current.cards > prev.cards) {
           // Si ce joueur n'est pas celui actuellement affiché, faire clignoter l'onglet
           if (p.id !== currentPlayer.id) {
             newFlashes[p.id] = true;
             hasChanges = true;
           }
        }
      }
      prevResourcesRef.current[p.id] = current;
    });

    if (hasChanges) {
      setTabFlashes(prev => ({ ...prev, ...newFlashes }));
      const timer = setTimeout(() => {
        setTabFlashes({});
      }, 1000);
      return () => clearTimeout(timer);
    }
    return;
  }, [game, currentPlayer.id]);

  // Effect to reset selection when exiting trading mode
  useEffect(() => {
    if (!isTrading) {
      setHighlightedCardId(null);
    }
  }, [isTrading]);

  const handleComputerBonus = (type: string, amount: number, sequenceId?: string) => {
    if (type === 'reservation') {
      onComputerBonus(type, amount, sequenceId);
    } else if (type === 'anycard') {
      onComputerBonus(type, amount, sequenceId);
    }
  };

  const handleComputerSlotClick = (slotId: string) => {
    if (isRobot) return;
    if (isInteractiveMode && !isSelectingComputerSlot) return;

    const executeFillSlot = () => {
      // Créer une copie profonde pour éviter la mutation de l'état actuel
      // Cela garantit que 'game' reste valide comme 'previousState' pour l'historique
      const gameCopy = structuredClone(game);

      const { updatedGame, gains, bonusEffects } = ComputerSystem.fillSlot(gameCopy, currentPlayer.id, slotId);
      
      const sequenceId = `computer-${Date.now()}`;

      bonusEffects.forEach(effect => {
        handleComputerBonus(effect.type, effect.amount, sequenceId);
      });
      
      if (onHistory) {
          let gainText = '';
          if (gains.length > 0) {
            gainText = ` et gagne ${gains.join(', ')}`;
          }
          if (currentPlayer.dataComputer.canAnalyze) {
            gainText += " et complète l'ordinateur";
          }
          onHistory(`transfère 1 donnée vers l'ordinateur ${gainText}`, sequenceId);
      }
      
      if (onGameUpdate) onGameUpdate(updatedGame);
    };

    const slot = currentPlayer.dataComputer.slots[slotId];
    if (slot && slot.bonus === 'media') {
      let mediaAmount = 1;
      if (slot.technologyId && slot.technologyId.startsWith('computing-4')) mediaAmount = 2;
      if (currentPlayer.mediaCoverage + mediaAmount > GAME_CONSTANTS.MAX_MEDIA_COVERAGE && onConfirmAction) {
        onConfirmAction("Vous avez atteint la limite de couverture médiatique. Le gain de médias sera perdu. Voulez-vous continuer ?", executeFillSlot);
        return;
      }
    }

    executeFillSlot();
  };

  const getTechIcon = (techId: string) => {
    if (techId.startsWith('exploration')) return '🚀';
    if (techId.startsWith('observation')) return '🔭';
    if (techId.startsWith('computing')) return '💻';
    return '⚙️';
  };

  // Hook personnalisé pour gérer les flashs de ressources
  const useResourceFlash = (value: number, playerId: string) => {
    const [flash, setFlash] = useState<{ type: 'gain' | 'loss'; id: number } | null>(null);
    const prevValueRef = useRef<number>(null);
    const prevPlayerIdRef = useRef<string>(null);

    useEffect(() => {
      const prevPlayerId = prevPlayerIdRef.current;
      const prevValue = prevValueRef.current;

      if (prevPlayerId === playerId && prevValue !== undefined && value !== prevValue) {
        setFlash({
          type: prevValue && value > prevValue ? 'gain' : 'loss',
          id: Date.now() + Math.random(),
        });
        const timer = setTimeout(() => setFlash(null), 600);
        return () => clearTimeout(timer);
      }
      return;
    }, [value, playerId]);

    // Mettre à jour les refs après l'effet principal pour la prochaine comparaison
    useEffect(() => {
      prevValueRef.current = value;
      prevPlayerIdRef.current = playerId;
    });

    return flash;
  };

  const mediaFlash = useResourceFlash(currentPlayer.mediaCoverage, currentPlayer.id);
  const creditFlash = useResourceFlash(currentPlayer.credits, currentPlayer.id);
  const energyFlash = useResourceFlash(currentPlayer.energy, currentPlayer.id);
  const revenueCreditFlash = useResourceFlash(currentPlayer.revenueCredits, currentPlayer.id);
  const revenueEnergyFlash = useResourceFlash(currentPlayer.revenueEnergy, currentPlayer.id);
  const revenueCardFlash = useResourceFlash(currentPlayer.revenueCards, currentPlayer.id);
  const dataFlash = useResourceFlash(currentPlayer.data, currentPlayer.id);
  const cardsFlash = useResourceFlash(handCards.length, currentPlayer.id);

  const actionAvailability: Record<ActionType, boolean> = {
    [ActionType.LAUNCH_PROBE]: isCurrentTurn && !isRobot && !hasPerformedMainAction && ProbeSystem.canLaunchProbe(game, currentPlayer.id).canLaunch,
    [ActionType.ORBIT]: isCurrentTurn && !isRobot && !hasPerformedMainAction && currentPlayer.probes.some(probe => ProbeSystem.canOrbit(game, currentPlayer.id, probe.id).canOrbit),
    [ActionType.LAND]: isCurrentTurn && !isRobot && !hasPerformedMainAction && currentPlayer.probes.some(probe => ProbeSystem.canLand(game, currentPlayer.id, probe.id).canLand),
    [ActionType.SCAN_SECTOR]: isCurrentTurn && !isRobot && !hasPerformedMainAction && ScanSystem.canScanSector(game, currentPlayer.id).canScan,
    [ActionType.ANALYZE_DATA]: isCurrentTurn && !isRobot && !hasPerformedMainAction && ComputerSystem.canAnalyzeData(game, currentPlayer.id).canAnalyze,
    [ActionType.PLAY_CARD]: isCurrentTurn && !isRobot && !hasPerformedMainAction && CardSystem.canPlayCards(game, currentPlayer.id).canPlay,
    [ActionType.RESEARCH_TECH]: isCurrentTurn && !isRobot && !hasPerformedMainAction && currentPlayer.mediaCoverage >= GAME_CONSTANTS.TECH_RESEARCH_COST_MEDIA,
    [ActionType.PASS]: isCurrentTurn && !isRobot && !hasPerformedMainAction,
    [ActionType.MOVE_PROBE]: false,
    [ActionType.TRANSFERE_DATA]: false,
    [ActionType.DISCARD_CARD]: false,
    [ActionType.ACCOMPLISH_MISSION]: false,
    [ActionType.BUY_CARD]: false,
    [ActionType.TRADE_RESOURCES]: false,
  };

  // Infobulle d'une action principale : coût, puis action possible ou raison de l'indisponibilité
  const getActionTooltip = (actionType: ActionType, available: boolean): React.ReactNode => {
    const hasProbeOnPlanetInfo = ProbeSystem.probeOnPlanetInfo(game, currentPlayer.id);
    let cost: string | undefined;
    let action = '';
    let reason: string | undefined;

    switch (actionType) {
      case ActionType.LAUNCH_PROBE: {
        cost = `${GAME_CONSTANTS.PROBE_LAUNCH_COST} Crédits`;
        action = 'Cliquez pour lancer une sonde depuis la Terre';
        const launchCheck = ProbeSystem.canLaunchProbe(game, currentPlayer.id);
        if (!launchCheck.canLaunch) reason = launchCheck.reason || 'Impossible de lancer une sonde';
        break;
      }

      case ActionType.ORBIT: {
        cost = `${GAME_CONSTANTS.ORBIT_COST_CREDITS} Crédit, ${GAME_CONSTANTS.ORBIT_COST_ENERGY} Énergie`;
        action = 'Cliquez pour mettre une sonde en orbite';
        const orbitProbe = currentPlayer.probes.find(p => p.state === ProbeState.IN_SOLAR_SYSTEM);
        if (!orbitProbe) reason = 'Nécessite une sonde dans le système solaire';
        else {
          const orbitCheck = ProbeSystem.canOrbit(game, currentPlayer.id, orbitProbe.id);
          if (!orbitCheck.canOrbit) reason = orbitCheck.reason || 'Impossible';
        }
        break;
      }

      case ActionType.LAND: {
        action = 'Cliquez pour poser une sonde sur une planète';
        // Coût courant : celui de la planète où se trouve la sonde, sinon le coût de base (réduit par Exploration III)
        const hasExploration3 = currentPlayer.technologies.some(t => t.id.startsWith('exploration-3'));
        const landCost = hasProbeOnPlanetInfo.landCost ?? (hasExploration3 ? GAME_CONSTANTS.LAND_COST_ENERGY_WITH_TECHNOLOGY : GAME_CONSTANTS.LAND_COST_ENERGY);
        const reductions = [hasProbeOnPlanetInfo.hasOrbiter && 'orbiteur présent', hasExploration3 && 'Exploration III'].filter(Boolean);
        cost = `${landCost} Énergie${landCost > 1 ? 's' : ''}${reductions.length > 0 ? ` (${reductions.join(', ')})` : ''}`;
        const landProbe = currentPlayer.probes.find(p => p.state === ProbeState.IN_SOLAR_SYSTEM);
        if (!landProbe) reason = 'Nécessite une sonde dans le système solaire';
        else {
          const landCheck = ProbeSystem.canLand(game, currentPlayer.id, landProbe.id);
          if (!landCheck.canLand) reason = landCheck.reason || 'Impossible';
        }
        break;
      }

      case ActionType.SCAN_SECTOR:
        cost = `${GAME_CONSTANTS.SCAN_COST_CREDITS} Crédit, ${GAME_CONSTANTS.SCAN_COST_ENERGY} Énergies`;
        action = 'Cliquez pour scanner';
        if (currentPlayer.credits < GAME_CONSTANTS.SCAN_COST_CREDITS || currentPlayer.energy < GAME_CONSTANTS.SCAN_COST_ENERGY) reason = `Vous avez ${currentPlayer.credits} crédit(s) et ${currentPlayer.energy} énergie(s)`;
        break;

      case ActionType.ANALYZE_DATA:
        cost = '1 Énergie';
        action = 'Cliquez pour analyser les données';
        if (!currentPlayer.dataComputer.canAnalyze) reason = "Nécessite des données à analyser dans l'ordinateur de données";
        else if (currentPlayer.energy < 1) reason = `Vous avez ${currentPlayer.energy} énergie`;
        break;

      case ActionType.RESEARCH_TECH:
        cost = `${GAME_CONSTANTS.TECH_RESEARCH_COST_MEDIA} Médias`;
        action = 'Cliquez pour rechercher une technologie';
        if (currentPlayer.mediaCoverage < GAME_CONSTANTS.TECH_RESEARCH_COST_MEDIA) reason = `Vous avez ${currentPlayer.mediaCoverage} média(s)`;
        break;

      case ActionType.PLAY_CARD: {
        action = 'Cliquez pour jouer une carte de votre main';
        // Coût variable : fourchette des coûts des cartes en main, par ressource
        const costRange = (costType: CostType, unit: string) => {
          const costs = handCards.filter(c => (c.costType === CostType.ENERGY) === (costType === CostType.ENERGY)).map(c => c.cost);
          if (costs.length === 0) return null;
          const min = Math.min(...costs), max = Math.max(...costs);
          return `${min === max ? min : `${min} à ${max}`} ${unit}${max > 1 ? 's' : ''}`;
        };
        const ranges = [costRange(CostType.CREDIT, 'Crédit'), costRange(CostType.ENERGY, 'Énergie')].filter(Boolean);
        if (ranges.length > 0) cost = `${ranges.join(', ')} selon la carte`;
        const cardCheck = CardSystem.canPlayCards(game, currentPlayer.id);
        if (!cardCheck.canPlay) reason = cardCheck.reason || 'Impossible';
        break;
      }
    }

    // Les raisons générales passent avant celles propres à l'action
    if (!isCurrentTurn) reason = "Ce n'est pas votre tour";
    else if (hasPerformedMainAction) reason = 'Action principale déjà effectuée';
    else if (!reason && !available) reason = "Terminez d'abord l'action en cours";

    return available
      ? <SlotTooltip status="Disponible" statusColor={SLOT_COLORS.available} label="Coût" value={cost} note={action} />
      : <SlotTooltip status="Indisponible" statusColor={SLOT_COLORS.unavailable} label="Coût" value={cost} note={reason} />;
  };

  // Helper pour les boutons d'action (factorisé)
  const renderActionButton = React.useCallback((
    icon: string,
    tooltip: string,
    onClick: (e: React.MouseEvent) => void,
    disabled: boolean,
    color: string = '#fff',
    style: React.CSSProperties = {}
  ) => {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) onClick(e);
        }}
        className="seti-action-btn"
        aria-disabled={disabled}
        style={{
          color: !disabled ? color : '#555',
          ...style
        }}
        onMouseEnter={(e) => {
          handleTooltipHover(e, tooltip);
        }}
        onMouseLeave={() => {
          handleTooltipLeave();
        }}
      >
        {icon}
      </button>
    );
  }, [handleTooltipHover, handleTooltipLeave]);

  // Helper pour le bouton d'achat de carte
  const renderBuyCardButton = (icon: string, tooltip: string) => {
    if (isRobot) return null;
    const canBuy = isCurrentTurn && !isInteractiveMode && currentPlayer.mediaCoverage >= 3;
    
    return renderActionButton(
        icon,
        tooltip,
        () => onBuyCardAction && onBuyCardAction(),
        !canBuy,
        canBuy ? '#ffd700' : '#555',
        { marginLeft: '4px' }
    );
  };

  // Helper pour les boutons d'échange rapide
  const renderDirectTradeButton = (spendType: string, gainType: string, icon: string, tooltip: string, canSpend: boolean) => {
    if (isRobot) return null;
    const canTrade = isCurrentTurn && !isInteractiveMode && canSpend;
    
    return renderActionButton(
        icon, 
        tooltip, 
        () => onDirectTradeAction && onDirectTradeAction(spendType, gainType), 
        !canTrade, 
        canTrade ? '#ffd700' : '#555',
        { marginLeft: '4px' }
    );
  };

  // Helper pour les boutons d'échange de cartes (initie la sélection)
  const renderCardTradeButton = (gainType: string, icon: string, tooltip: string, style?: React.CSSProperties) => {
    if (isRobot) return null;
    const canTrade = isCurrentTurn && !isInteractiveMode && handCards.length >= 2;
    
    return renderActionButton(
        icon,
        tooltip,
        () => onTradeCardAction && onTradeCardAction(gainType),
        !canTrade,
        canTrade ? '#ffd700' : '#555',
        { marginLeft: '4px', ...style }
    );
  };

  return (
    <div className="seti-player-board-container">
      {/* Onglets des joueurs */}
      <div className="seti-player-tabs">
        {game.players.map((p, index) => {
           const isViewed = p.id === currentPlayer.id;
           const isActive = p.id === game.players[game.currentPlayerIndex].id;
           const isFirstPlayer = index === game.firstPlayerIndex;
           const shouldFlash = tabFlashes[p.id];

           return (
             <div 
               key={p.id}
               className={`seti-player-tab ${isActive ? 'active' : 'inactive'}`}
               onClick={() => onViewPlayer && onViewPlayer(p.id)}
               style={{
                 backgroundColor: shouldFlash ? '#4caf50' : (isViewed ? (p.color || '#444') : '#2a2a2a'),
                 borderBottom: isViewed ? `1px solid ${p.color || '#444'}` : '1px solid #555',
                 opacity: isViewed ? 1 : 0.7,
               }}
             >
               {p.type === 'robot' ? '🤖' : '👤'} {p.name}
               {isFirstPlayer && <span>👑</span>}
               {isActive && <span className="seti-player-tab-indicator"></span>}
             </div>
           );
        })}
        <button
            onClick={onSettingsClick}
            className="seti-action-btn"
            style={{ marginLeft: 'auto', marginRight: '8px', fontSize: '1.2rem', padding: '4px', background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', alignSelf: 'center' }}
            onMouseEnter={(e) => handleTooltipHover(e, 'Paramètres')}
            onMouseLeave={handleTooltipLeave}
        >
            ⚙️
        </button>
      </div>

      {/* Plateau du joueur */}
      <div className="seti-player-panel" style={{ borderTop: `4px solid ${currentPlayer.color || '#444'}`, borderTopLeftRadius: 0 }}>
        {/* Titre */}
        <div className="seti-player-panel-title seti-player-panel-title-container">
          <span>
            {currentPlayer.name} {currentPlayer.type === 'robot' ? '🤖' : '👤'} - Score: {currentPlayer.score} PV 🏆
          </span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {!isRobot && (
            <button
              onClick={onNextPlayer}
              disabled={!isCurrentTurn || !hasPerformedMainAction || isInteractiveMode}
              className={`seti-next-player-btn ${(isCurrentTurn && hasPerformedMainAction && !isInteractiveMode) ? 'enabled' : 'disabled'}`}
              onMouseEnter={(e) => handleTooltipHover(e, hasPerformedMainAction ? "Terminer le tour" : "Effectuez une action principale d'abord")}
              onMouseLeave={handleTooltipLeave}
            >
              Prochain joueur
            </button>
            )}
          </div>
        </div>
        
        <div className="seti-player-layout-container">
          {/* Ressources/Revenus */}
          <div className="seti-resources-row">
            {/* Ressources */}
            <div className="seti-player-section seti-section-relative">
              <div className="seti-player-section-title seti-section-header">Ressource</div>
              <div className="seti-player-resources">
                <div 
                  key={creditFlash ? `credit-${creditFlash.id}` : 'credit-static'}
                  className={`seti-res-badge ${creditFlash ? (creditFlash.type === 'gain' ? 'flash-gain' : 'flash-loss') : ''}`}
                >
                  <span>Crédit (<span style={{color: '#ffd700'}}>₢</span>):</span>
                  <div className="seti-resource-badge-content">
                    {renderDirectTradeButton('credit', 'energy', '⚡', 'Echanger 2 Crédits contre 1 Énergie', currentPlayer.credits >= 2)}
                    {renderDirectTradeButton('credit', 'card', '🃏', 'Echanger 2 Crédits contre 1 Carte', currentPlayer.credits >= 2)}
                    <strong style={{ marginLeft: '6px' }}>{currentPlayer.credits}</strong>
                  </div>
                </div>
                <div 
                  key={energyFlash ? `energy-${energyFlash.id}` : 'energy-static'}
                  className={`seti-res-badge ${energyFlash ? (energyFlash.type === 'gain' ? 'flash-gain' : 'flash-loss') : ''}`}
                >
                  <span>Énergie (<span style={{color: '#4caf50'}}>⚡</span>):</span>
                  <div className="seti-resource-badge-content">
                    {renderDirectTradeButton('energy', 'credit', '₢', 'Echanger 2 Énergies contre 1 Crédit', currentPlayer.energy >= 2)}
                    {renderDirectTradeButton('energy', 'card', '🃏', 'Echanger 2 Énergies contre 1 Carte', currentPlayer.energy >= 2)}
                    <strong style={{ marginLeft: '6px' }}>{currentPlayer.energy}</strong>
                  </div>
                </div>
                <div 
                  key={mediaFlash ? `media-${mediaFlash.id}` : 'media-static'}
                  className={`seti-res-badge ${mediaFlash ? (mediaFlash.type === 'gain' ? 'flash-gain' : 'flash-loss') : ''}`}
                >
                  <span>Média (<span style={{color: '#ff6b6b'}}>🎤</span>):</span>
                  <div className="seti-resource-badge-content">
                  {renderBuyCardButton('🛒', 'Acheter 1 carte de la pioche ou de la rangée principale (cout: 3 Médias)')}
                  <strong style={{ marginLeft: '6px' }}>{currentPlayer.mediaCoverage}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Revenues */}
            <div className="seti-player-section seti-section-relative">
              <div className="seti-player-section-title">Revenu</div>
              <div className="seti-player-revenues seti-revenues-list">
                <div 
                  key={revenueCreditFlash ? `rev-credit-${revenueCreditFlash.id}` : 'rev-credit-static'}
                  className={`seti-res-badge ${revenueCreditFlash ? (revenueCreditFlash.type === 'gain' ? 'flash-gain' : 'flash-loss') : ''}`}
                >
                  <span>Crédit (<span style={{color: '#ffd700'}}>₢</span>):</span>
                  <strong>{currentPlayer.revenueCredits} <span style={{fontSize: '0.8em', fontWeight: 'normal', color: '#aaa'}}>({currentPlayer.revenueCredits - GAME_CONSTANTS.INITIAL_REVENUE_CREDITS})</span></strong>
                </div>
                <div 
                  key={revenueEnergyFlash ? `rev-energy-${revenueEnergyFlash.id}` : 'rev-energy-static'}
                  className={`seti-res-badge ${revenueEnergyFlash ? (revenueEnergyFlash.type === 'gain' ? 'flash-gain' : 'flash-loss') : ''}`}
                >
                  <span>Énergie (<span style={{color: '#4caf50'}}>⚡</span>):</span>
                  <strong>{currentPlayer.revenueEnergy} <span style={{fontSize: '0.8em', fontWeight: 'normal', color: '#aaa'}}>({currentPlayer.revenueEnergy - GAME_CONSTANTS.INITIAL_REVENUE_ENERGY})</span></strong>
                </div>
                <div 
                  key={revenueCardFlash ? `rev-card-${revenueCardFlash.id}` : 'rev-card-static'}
                  className={`seti-res-badge ${revenueCardFlash ? (revenueCardFlash.type === 'gain' ? 'flash-gain' : 'flash-loss') : ''}`}
                >
                  <span>Carte (<span style={{color: '#aaffaa'}}>🃏</span>):</span>
                  <strong>{currentPlayer.revenueCards} <span style={{fontSize: '0.8em', fontWeight: 'normal', color: '#aaa'}}>({currentPlayer.revenueCards - GAME_CONSTANTS.INITIAL_REVENUE_CARDS})</span></strong>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          {!isRobot && (
          <div className="seti-player-section">
            <div className="seti-player-section-title">Action principale</div>
            <div className="seti-player-actions seti-actions-grid">
              {MAIN_ACTION_TYPES.map(action => {
                const actionType = action as ActionType;
                const available = actionAvailability[actionType] && !isInteractiveMode;
                const tooltip = getActionTooltip(actionType, available);
                return (
                    <div
                      key={action}
                      className={available ? 'seti-player-action-available' : 'seti-player-action-unavailable'}
                      onClick={() => {
                        if (available && onAction) {
                          onAction(actionType);
                        }
                      }}
                      onMouseEnter={(e) => handleTooltipHover(e, tooltip)}
                      onMouseLeave={handleTooltipLeave}
                    >
                      {actionType}
                    </div>
                  );
                })}
            </div>
          </div>
          )}

          {/* Technologies */}
          <div className="seti-player-section">
            <div className="seti-player-section-title">Technologie</div>
            <div className="seti-player-list">
              {currentPlayer.technologies.length > 0 ? (
                currentPlayer.technologies.map((tech) => (
                  <div 
                    key={tech.id} 
                    className="seti-player-list-item seti-tech-list-item"
                    onMouseEnter={(e) => {
                      let categoryColor = '#fff';
                      if (tech.type === TechnologyCategory.EXPLORATION) categoryColor = '#ffeb3b';
                      if (tech.type === TechnologyCategory.OBSERVATION) categoryColor = '#ff6b6b';
                      if (tech.type === TechnologyCategory.COMPUTING) categoryColor = '#4a9eff';

                      const tooltipContent = (
                        <div className="seti-tech-tooltip-content">
                          <div className="seti-tech-tooltip-header">
                            <span className="seti-tech-tooltip-name">{tech.name}</span>
                            <span className="seti-tech-tooltip-category" style={{ color: categoryColor, borderColor: categoryColor }}>{tech.type}</span>
                          </div>
                          <div className="seti-tech-tooltip-desc">{tech.description}</div>
                        </div>
                      );
                      handleTooltipHover(e, tooltipContent);
                    }}
                    onMouseLeave={handleTooltipLeave}
                  >
                    <div className="seti-tech-icon">{getTechIcon(tech.id)}</div>
                    <div className="seti-tech-name">{tech.name}</div>
                    {tech.description && (
                      <div className="seti-tech-desc">
                        {tech.description}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="seti-player-list-empty">Aucune technologie</div>
              )}
            </div>
          </div>

          {/* Observation Track */}
          <div className="seti-player-section">
            <div className="seti-player-section-title">Observation</div>
            <ObservationTrack
              game={game}
              playerId={currentPlayer.id}
              onAction={onAction}
              isCurrentTurn={isCurrentTurn}
              hasPerformedMainAction={hasPerformedMainAction}
              isInteractiveMode={isInteractiveMode}
              handleTooltipHover={handleTooltipHover}
              handleTooltipLeave={handleTooltipLeave}
            />
          </div>

          {/* Ordinateur */}
          <div className="seti-player-section">
            <div className="seti-player-section-title seti-computer-header">
              <span>Ordinateur</span>
              <span 
                key={dataFlash ? `data-${dataFlash.id}` : 'data-static'}
                className={`seti-computer-data-badge ${dataFlash ? (dataFlash.type === 'gain' ? 'flash-gain' : 'flash-loss') : ''}`}
              >
                Donnée (<span style={{color: '#03a9f4'}}>💾</span>): <strong style={{ color: '#fff' }}>{currentPlayer.data || 0}</strong>
              </span>
            </div>
            <div className="seti-player-list seti-computer-list">
              <PlayerComputer 
                player={currentPlayer} 
                onSlotClick={handleComputerSlotClick}
                isSelecting={isSelectingComputerSlot && !isRobot}
                onColumnSelect={onComputerSlotSelect}
                isAnalyzing={isAnalyzing}
                disabled={isInteractiveMode || isRobot}
                onHover={handleTooltipHover}
                onLeave={handleTooltipLeave}
                onAnalyzeClick={() => onAction(ActionType.ANALYZE_DATA)}
              />
            </div>
          </div>

          {/* Cartes */}
          <div className="seti-player-section">
            <div className="seti-player-section-title seti-cards-header">
              <span>Main</span>
              <span 
                key={cardsFlash ? `cards-${cardsFlash.id}` : 'cards-static'}
                className={`seti-cards-badge ${cardsFlash ? (cardsFlash.type === 'gain' ? 'flash-gain' : 'flash-loss') : ''}`}
              >
                <span>Carte (<span style={{color: '#aaffaa'}}>🃏</span>):</span>
                <strong style={{ color: '#fff', marginLeft: '6px' }}>{handCards.length}</strong>
                {!isRobot && (
                    <>
                      {renderCardTradeButton('credit', '₢', 'Echanger 2 Cartes contre 1 Crédit', { marginLeft: '10px' })}
                      {renderCardTradeButton('energy', '⚡', 'Echanger 2 Cartes contre 1 Énergie')}
                    </>
                )}
              </span>
            </div>
            <div className="seti-player-list seti-cards-list" ref={cardsListRef}>
              {!isRobot ? (
                handCards.length > 0 ? (
                  handCards.map(card => (
                    <HandCard
                        key={card.id}
                        card={card}
                        game={game}
                        currentPlayerId={currentPlayer.id}
                        interactionState={interactionState}
                        highlightedCardId={highlightedCardId}
                        setHighlightedCardId={setHighlightedCardId}
                        onCardClick={onCardClick}
                        onPlayCard={onPlayCard}
                        onDiscardCardAction={onDiscardCardAction}
                        handleTooltipHover={handleTooltipHover}
                        handleTooltipLeave={handleTooltipLeave}
                        renderActionButton={renderActionButton}
                        cardOrigin="hand"
                        isPlayableFocus={playableCardIds.includes(card.id)}
                    />
                  ))
                ) : (
                  <div className="seti-player-list-empty">Aucune carte en main</div>
                )
              ) : (
                handCards.some(c => c.isRevealed) ? (
                  <>
                    {handCards.filter(c => c.isRevealed).map(card => (
                      <HandCard
                        key={card.id}
                        card={card}
                        game={game}
                        currentPlayerId={currentPlayer.id}
                        interactionState={interactionState}
                        highlightedCardId={null}
                        setHighlightedCardId={() => {}}
                        onCardClick={() => {}}
                        onPlayCard={() => {}}
                        onDiscardCardAction={() => {}}
                        handleTooltipHover={handleTooltipHover}
                        handleTooltipLeave={handleTooltipLeave}
                        renderActionButton={() => null}
                        cardOrigin="hand"
                      />
                    ))}
                    {handCards.filter(c => !c.isRevealed).length > 0 && (
                      <div className="seti-player-list-empty" style={{ width: '100%', marginTop: '8px' }}>
                        + {handCards.filter(c => !c.isRevealed).length} carte{handCards.filter(c => !c.isRevealed).length > 1 ? 's' : ''} masquée{handCards.filter(c => !c.isRevealed).length > 1 ? 's' : ''}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="seti-player-list-empty">{handCards.length} carte{handCards.length > 1 ? 's' : ''} en main (Masqué)</div>
                )
              )}
            </div>
          </div>

          {/* Missions */}
          <div className="seti-player-section">
            <div className="seti-player-section-title">Mission</div>
            {/*isSelectingMission && !isRobot && (
              <div className="seti-cards-warning">
                Veuillez sélectionner une mission à accomplir.
                <br />
                Sélectionnées : {selectedMissionId ? 1 : 0} / 1
                <button className="seti-confirm-btn" onClick={onConfirmMissionClaim}>Confirmer</button>
                <button className="seti-cancel-btn" onClick={onCancelMissionClaim}>Annuler</button>
              </div>
            )*/}
            <div className="seti-player-list seti-cards-list">
              {((currentPlayer.missions && currentPlayer.missions.length > 0) || (currentPlayer.playedCards && currentPlayer.playedCards.length > 0)) ? (
                <>
                {/* Mission conditionnelle et Mission déclenchable */}
                {(currentPlayer.missions || []).map((mission: Mission) => (
                  <MissionCard
                    key={mission.id}
                    mission={mission}
                    game={game}
                    playerId={currentPlayer.id}
                    currentPlayerColor={currentPlayer.color || '#fff'}
                    isCurrentTurn={isCurrentTurn}
                    isRobot={isRobot}
                    isInteractiveMode={isInteractiveMode}
                    onMissionClick={onMissionClick}
                    handleTooltipHover={handleTooltipHover}
                    handleTooltipLeave={handleTooltipLeave}
                  />
                ))}
                {/* Fin de jeu et Centaurien */}
                {(currentPlayer.playedCards || []).map((card: Card) => (
                  <PlayedMissionCard
                    key={card.id}
                    card={card}
                    isCurrentTurn={isCurrentTurn}
                    isRobot={isRobot}
                    onMissionClick={onMissionClick}
                    handleTooltipHover={handleTooltipHover}
                    handleTooltipLeave={handleTooltipLeave}
                  />
                ))}
                </>
              ) : (
                <div className="seti-player-list-empty">Aucune mission</div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
