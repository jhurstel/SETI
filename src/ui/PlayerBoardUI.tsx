import React, { useState, useEffect, useRef } from 'react';
import { Game, ActionType, GAME_CONSTANTS, ProbeState, Card, Mission, InteractionState, TechnologyCategory, MAIN_ACTION_TYPES } from '../core/types';
import { ProbeSystem } from '../systems/ProbeSystem';
import { ComputerSystem } from '../systems/ComputerSystem'; 
import { CardSystem } from '../systems/CardSystem';
import { ScanSystem } from '../systems/ScanSystem';
import { PlayerComputer } from './components/PlayerComputer';
import { HandCard } from './components/HandCard';
import { MissionCard } from './components/MissionCard';
import { PlayedMissionCard } from './components/PlayedMissionCard';
import './PlayerBoardUI.css';

interface PlayerBoardUIProps {
  game: Game;
  playerId: string;
  interactionState: InteractionState;
  onViewPlayer: (playerId: string) => void;
  onAction: (actionType: ActionType) => void;
  onCardClick: (cardId: string) => void;
  onConfirmDiscardForEndTurn: () => void;
  onDiscardCardAction: (cardId: string) => void;
  onPlayCard: (cardId: string) => void;
  onBuyCardAction: () => void;
  onTradeCardAction: (targetGain?: string) => void;
  onConfirmTrade: () => void;
  onGameUpdate: (game: Game) => void;
  onComputerSlotSelect: (col: number) => void;
  onNextPlayer: () => void;
  onHistory: (message: string, sequenceId?: string) => void;
  onComputerBonus: (type: string, amount: number, sequenceId?: string) => void;
  onConfirmReserve: () => void;
  onDirectTradeAction: (spendType: string, gainType: string) => void;
  onConfirmDiscardForSignal: () => void;
  setActiveTooltip: (tooltip: { content: React.ReactNode, rect: DOMRect } | null) => void;
  onSettingsClick?: () => void;
  onMissionClick?: (missionId: string, requirementId?: string) => void;
}

export const PlayerBoardUI: React.FC<PlayerBoardUIProps> = ({ game, playerId, interactionState, onViewPlayer, onAction, onCardClick, onConfirmDiscardForEndTurn, onDiscardCardAction, onPlayCard, onBuyCardAction, onTradeCardAction, onConfirmTrade, onGameUpdate, onComputerSlotSelect, onNextPlayer, onHistory, onComputerBonus, onConfirmReserve, onDirectTradeAction, onConfirmDiscardForSignal, setActiveTooltip, onSettingsClick, onMissionClick }) => {
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

  const selectedCardIds = (isDiscarding || isTrading || isReserving || isDiscardingForSignal) ? interactionState.selectedCards : [];

  const reservationCount = isReserving ? interactionState.count : 0;
  const discardForSignalCount = isDiscardingForSignal ? interactionState.count : 0;

  const handleTooltipHover = (e: React.MouseEvent, content: React.ReactNode) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setActiveTooltip({ content, rect });
  };

  const handleTooltipLeave = () => {
    setActiveTooltip(null);
  };
  
  const isInteractiveMode = isDiscarding || isTrading || isReserving || isSelectingComputerSlot || isAnalyzing || isPlacingLifeTrace || isSelectingSector || isDiscardingForSignal || interactionState.type === 'CHOOSING_BONUS_ACTION' || interactionState.type === 'CLAIMING_MISSION_REQUIREMENT';

  // Suivi des changements de ressources pour la notification sur les onglets
  const [tabFlashes, setTabFlashes] = useState<Record<string, boolean>>({});
  const prevResourcesRef = useRef<Record<string, { credits: number, energy: number, media: number, data: number, cards: number }>>({});

  useEffect(() => {
    const newFlashes: Record<string, boolean> = {};
    let hasChanges = false;

    game.players.forEach(p => {
      const prev = prevResourcesRef.current[p.id];
      const current = { credits: p.credits, energy: p.energy, media: p.mediaCoverage, data: p.data || 0, cards: p.cards.length };
      
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
  const cardsFlash = useResourceFlash(currentPlayer.cards.length, currentPlayer.id);

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

  // Fonction helper pour générer le tooltip basé sur l'état du jeu (Interaction Engine -> UI)
  const getActionTooltip = (actionType: ActionType): string => {
    const hasProbeOnPlanetInfo = ProbeSystem.probeOnPlanetInfo(game, currentPlayer.id)

    if (isRobot) return "Tour du robot";
    if (hasPerformedMainAction) return "Action principale déjà effectuée";

    switch (actionType) {
      case ActionType.LAUNCH_PROBE:
        const launchCheck = ProbeSystem.canLaunchProbe(game, currentPlayer.id);
        if (!launchCheck.canLaunch) return launchCheck.reason || "Impossible de lancer une sonde";
        return `Lancer une sonde depuis la Terre (coût: ${GAME_CONSTANTS.PROBE_LAUNCH_COST} crédits)`;

      case ActionType.ORBIT:
        const orbitProbe = currentPlayer.probes.find(p => p.state === ProbeState.IN_SOLAR_SYSTEM);
        if (!orbitProbe) return 'Nécessite une sonde dans le système solaire';
        const orbitCheck = ProbeSystem.canOrbit(game, currentPlayer.id, orbitProbe.id);
        if (!orbitCheck.canOrbit) return orbitCheck.reason || "Impossible";
        return `Mettre une sonde en orbite (coût: ${GAME_CONSTANTS.ORBIT_COST_CREDITS} crédit, ${GAME_CONSTANTS.ORBIT_COST_ENERGY} énergie)`;
      
      case ActionType.LAND:
        const landProbe = currentPlayer.probes.find(p => p.state === ProbeState.IN_SOLAR_SYSTEM);
        if (!landProbe) return 'Nécessite une sonde dans le système solaire';
        const landCheck = ProbeSystem.canLand(game, currentPlayer.id, landProbe.id);
        if (!landCheck.canLand) return landCheck.reason || "Impossible";
        return `Poser une sonde sur une planète (coût: ${landCheck.energyCost} énergie${hasProbeOnPlanetInfo.hasOrbiter ? ', orbiteur présent' : ''}${hasProbeOnPlanetInfo.hasExploration3 ? ', réduction exploration 3' : ''})`;

      case ActionType.SCAN_SECTOR:
        if (currentPlayer.credits < 1 || currentPlayer.energy < 2) return `Nécessite 1 crédit et 2 énergies (vous avez ${currentPlayer.credits} crédit(s) et ${currentPlayer.energy} énergie(s))`;
        return 'Scanner un secteur (coût: 1 crédit, 2 énergies)';

      case ActionType.ANALYZE_DATA:
        if (!currentPlayer.dataComputer.canAnalyze) return 'Nécessite des données à analyser dans l\'ordinateur de données';
        if (currentPlayer.energy < 1) return `Nécessite 1 énergie (vous avez ${currentPlayer.energy})`;
        return 'Analyser des données (coût: 1 énergie)';

      case ActionType.RESEARCH_TECH:
        if (currentPlayer.mediaCoverage < GAME_CONSTANTS.TECH_RESEARCH_COST_MEDIA) return `Nécessite ${GAME_CONSTANTS.TECH_RESEARCH_COST_MEDIA} points de couverture médiatique (vous avez ${currentPlayer.mediaCoverage})`;
        return `Rechercher une technologie (coût: ${GAME_CONSTANTS.TECH_RESEARCH_COST_MEDIA} couverture médiatique)`;

      case ActionType.PLAY_CARD:
        const cardCheck = CardSystem.canPlayCards(game, currentPlayer.id);
        if (!cardCheck.canPlay) return cardCheck.reason || "Impossible";
        return `Joueur une carte de votre main`;
        
      default:
        return '';
    }
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
    const canTrade = isCurrentTurn && !isInteractiveMode && currentPlayer.cards.length >= 2;
    
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
            title="Paramètres"
        >
            ⚙️
        </button>
      </div>

      {/* Plateau du joueur */}
      <div className="seti-player-panel" style={{ borderTop: `4px solid ${currentPlayer.color || '#444'}`, borderTopLeftRadius: 0, flex: 1, minHeight: 0, maxHeight: 'none' }}>
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
                const tooltip = getActionTooltip(actionType);
                return (
                    <div
                      key={action}
                      className={available ? 'seti-player-action-available' : 'seti-player-action-unavailable'}
                      onClick={() => {
                        if (available && onAction) {
                          onAction(actionType);
                        }
                      }}
                      style={{
                        cursor: available ? 'pointer' : 'not-allowed',
                      }}
                      onMouseEnter={(e) => { if (tooltip) handleTooltipHover(e, tooltip); }}
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
                <strong style={{ color: '#fff', marginLeft: '6px' }}>{currentPlayer.cards.length}</strong>
                {!isRobot && (
                    <>
                      {renderCardTradeButton('credit', '₢', 'Echanger 2 Cartes contre 1 Crédit', { marginLeft: '10px' })}
                      {renderCardTradeButton('energy', '⚡', 'Echanger 2 Cartes contre 1 Énergie')}
                    </>
                )}
              </span>
            </div>
            {isDiscarding && !isRobot && (
              <div className="seti-cards-warning">
                Veuillez défausser des cartes pour n'en garder que {GAME_CONSTANTS.HAND_SIZE_AFTER_PASS}.
                <br />
                Sélectionnées : {selectedCardIds.length} / {Math.max(0, currentPlayer.cards.length - GAME_CONSTANTS.HAND_SIZE_AFTER_PASS)}
                {currentPlayer.cards.length - selectedCardIds.length === GAME_CONSTANTS.HAND_SIZE_AFTER_PASS && (
                  <button 
                    onClick={onConfirmDiscardForEndTurn}
                    className="seti-confirm-btn"
                  >
                    Confirmer
                  </button>
                )}
              </div>
            )}
            {isTrading && !isRobot && (
              <div className="seti-cards-warning">
                Veuillez sélectionner 2 cartes à échanger.
                <br />
                Sélectionnées : {selectedCardIds.length} / 2
                {selectedCardIds.length === 2 && (
                  <button 
                    onClick={onConfirmTrade}
                    className="seti-confirm-btn"
                  >
                    Confirmer
                  </button>
                )}
              </div>
            )}
            {isReserving && !isRobot && (
              <div className="seti-cards-warning">
                Veuillez réserver {reservationCount} carte{reservationCount > 1 ? 's' : ''} .
                <br />
                Sélectionnées: {selectedCardIds.length} / {reservationCount}
                {selectedCardIds.length === reservationCount && (
                  <button 
                      onClick={onConfirmReserve}
                      className="seti-confirm-btn"
                    >
                      Confirmer
                    </button>
                )}
              </div>
            )}
            {isDiscardingForSignal && !isRobot && (
              <div className="seti-cards-warning">
                Sélectionnez jusqu'à {discardForSignalCount} carte(s) à défausser pour gagner des signaux.
                <br />
                Sélectionnées : {selectedCardIds.length}
                <button 
                  onClick={onConfirmDiscardForSignal}
                  className="seti-confirm-btn"
                >
                  Confirmer
                </button>
              </div>
            )}
            <div className="seti-player-list seti-cards-list">
              {!isRobot ? (
                currentPlayer.cards.length > 0 ? (
                  currentPlayer.cards.map(card => (
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
                    />
                  ))
                ) : (
                  <div className="seti-player-list-empty">Aucune carte en main</div>
                )
              ) : (
                <div className="seti-player-list-empty">{currentPlayer.cards.length} carte{currentPlayer.cards.length > 1 ? 's' : ''} en main (Masqué)</div>
              )}
            </div>
          </div>

          {/* Missions */}
          <div className="seti-player-section">
            <div className="seti-player-section-title">Mission</div>
            <div className="seti-player-list seti-cards-list">
              {((currentPlayer.missions && currentPlayer.missions.length > 0) || (currentPlayer.playedCards && currentPlayer.playedCards.length > 0)) ? (
                <>
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
                {(currentPlayer.playedCards || []).map((card: Card) => (
                  <PlayedMissionCard
                    key={card.id}
                    card={card}
                    game={game}
                    playerId={currentPlayer.id}
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
