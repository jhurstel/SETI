import React, { useState, useEffect, useRef } from 'react';
import { Game, ActionType, GAME_CONSTANTS, ProbeState, Card, CardType, Mission, InteractionState, RevenueType, FreeActionType } from '../core/types';
import { ProbeSystem } from '../systems/ProbeSystem';
import { ComputerSystem } from '../systems/ComputerSystem'; 
import { CardSystem } from '../systems/CardSystem';
import { ScanSystem } from '../systems/ScanSystem';
import { PlayerComputerUI } from './PlayerComputerUI';
import { CardTooltip, getSectorTypeCode } from './CardTooltip';
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

const ACTION_NAMES: Record<ActionType, string> = {
  [ActionType.LAUNCH_PROBE]: 'Lancer une sonde',
  [ActionType.ORBIT]: 'Mettre en orbite',
  [ActionType.LAND]: 'Poser une sonde',
  [ActionType.SCAN_SECTOR]: 'Scanner un secteur',
  [ActionType.ANALYZE_DATA]: 'Analyser des données',
  [ActionType.PLAY_CARD]: 'Jouer une carte',
  [ActionType.RESEARCH_TECH]: 'Rechercher une tech',
  [ActionType.PASS]: 'Passer définitivement',
  [ActionType.MOVE_PROBE]: "MOVE_PROBE",
  [ActionType.TRANSFERE_DATA]: "TRANSFERE_DATA",
  [ActionType.DRAW_CARDS]: "DRAW_CARDS",
  [ActionType.DISCARD_CARDS]: "DISCARD_CARDS",
  [ActionType.RESERVE_CARD]: "RESERVE_CARD",
  [ActionType.BUY_CARD]: "BUY_CARD",
  [ActionType.TRADE_RESOURCES]: "TRADE_RESOURCES",
};
// Composant extrait pour les cartes en main
const HandCard: React.FC<{
  card: Card;
  game: Game;
  currentPlayerId: string;
  interactionState: InteractionState;
  highlightedCardId: string | null;
  setHighlightedCardId: (id: string | null) => void;
  onCardClick: (id: string) => void;
  onPlayCard: (id: string) => void;
  onDiscardCardAction: (id: string) => void;
  handleTooltipHover: (e: React.MouseEvent, content: React.ReactNode) => void;
  handleTooltipLeave: () => void;
  renderActionButton: (icon: string, tooltip: string, onClick: () => void, disabled: boolean, color: string, style: React.CSSProperties) => React.ReactNode;
}> = ({ card, game, currentPlayerId, interactionState, highlightedCardId, setHighlightedCardId, onCardClick, onPlayCard, onDiscardCardAction, handleTooltipHover, handleTooltipLeave, renderActionButton }) => {
    const currentPlayer = game.players.find(p => p.id === currentPlayerId)!;
    const hasPerformedMainAction = currentPlayer.hasPerformedMainAction;
    
    const isDiscarding = interactionState.type === 'DISCARDING_CARD';
    const isTrading = interactionState.type === 'TRADING_CARD';
    const isReserving = interactionState.type === 'RESERVING_CARD';
    const isDiscardingForSignal = interactionState.type === 'DISCARDING_FOR_SIGNAL';
    
    const selectedCardIds = (isDiscarding || isTrading || isReserving || isDiscardingForSignal) ? (interactionState as any).selectedCards : [];
    const reservationCount = isReserving ? (interactionState as any).count : 0;
    const discardForSignalCount = isDiscardingForSignal ? (interactionState as any).count : 0;

    const isSelected = selectedCardIds.includes(card.id);
    const isHighlighted = highlightedCardId === card.id;

    let phaseClass = 'seti-card-idle';
    let isClickable = true;

    if (isReserving) {
      phaseClass = 'seti-card-interact-mode';
      if (isSelected) phaseClass += ' selected';
      else if (selectedCardIds.length === reservationCount) { phaseClass += ' disabled'; isClickable = false; }
    } else if (isDiscarding) {
      phaseClass = 'seti-card-interact-mode';
      if (isSelected) phaseClass += ' selected';
      else if (currentPlayer.cards.length - selectedCardIds.length === 4) { phaseClass += ' disabled'; isClickable = false; }
    } else if (isTrading) {
      phaseClass = 'seti-card-interact-mode';
      if (isSelected) phaseClass += ' selected';
      else if (selectedCardIds.length >= 2) { phaseClass += ' disabled'; isClickable = false; }
    } else if (isDiscardingForSignal) {
      phaseClass = 'seti-card-interact-mode';
      if (isSelected) phaseClass += ' selected';
      else if (selectedCardIds.length >= (discardForSignalCount || 0) && !isSelected) { phaseClass += ' disabled'; isClickable = false; }
    } else {
      if (isHighlighted) phaseClass += ' selected';
    }

    const { canDiscard, reason: discardTooltip } = CardSystem.canDiscardFreeAction(game, currentPlayerId, card.freeAction);
    const { canPlay, reason: playTooltip } = CardSystem.canPlayCard(game, currentPlayerId, card);
    const canPlayAction = canPlay && !hasPerformedMainAction;
    const effectivePlayTooltip = hasPerformedMainAction ? "Action principale déjà effectuée" : playTooltip;

    return (
      <div 
        className={`seti-common-card seti-card-wrapper ${phaseClass}`}
        onMouseEnter={e => handleTooltipHover(e, <CardTooltip card={card} />)}
        onMouseLeave={handleTooltipLeave}
        onClick={e => {
          e;
          if (!isClickable) return;
          if (isReserving || isTrading || isDiscarding || isDiscardingForSignal) { onCardClick(card.id); return; }
          setHighlightedCardId(isHighlighted ? null : card.id);
        }}
      >
        {isHighlighted && !isDiscarding && !isReserving && !isTrading && !isDiscardingForSignal && (
          <>
          {renderActionButton('▶️', effectivePlayTooltip, () => { if (canPlayAction) { onPlayCard(card.id); setHighlightedCardId(null); } }, !canPlayAction, '#4a9eff', { position: 'absolute', top: '5px', right: '40px', zIndex: 10 } as React.CSSProperties)}
          {renderActionButton('🗑️', discardTooltip, () => { if (canDiscard) { onDiscardCardAction(card.id); setHighlightedCardId(null); } }, !canDiscard, '#ff6b6b', { position: 'absolute', top: '5px', right: '5px', zIndex: 10 } as React.CSSProperties)}
          </>
        )}
        {isReserving ? (
          <>
            <div className="seti-card-name" style={{ fontSize: '0.75rem', lineHeight: '1.1', marginBottom: '4px', height: '2.2em', overflow: 'hidden' }}><span>{card.name}</span></div>
            <div style={{ fontSize: '0.75em', marginTop: '2px', display: 'flex', justifyContent: 'space-between' }}><span style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '0 4px', borderRadius: '4px' }}>Coût: <span style={{ color: '#ffd700' }}>{card.cost}</span></span><span style={{ color: '#aaa', fontSize: '0.9em' }}>{card.type === CardType.ACTION ? 'ACT' : (card.type === CardType.END_GAME ? 'FIN' : 'MIS')}</span></div>
            {card.description && <div className="seti-card-description" style={{ flex: 1, margin: '4px 0', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', textOverflow: 'ellipsis' }}>{card.description}</div>}
            <div className="seti-card-details" style={{ display: 'flex', flexDirection: 'row', gap: '8px', marginTop: 'auto', fontSize: '0.7em', backgroundColor: 'rgba(0,0,0,0.2)', padding: '2px', borderRadius: '4px', justifyContent: 'space-between' }}>
                {card.freeAction && <div>Act: {card.freeAction}</div>}
                {card.scanSector && <div>Scan: {card.scanSector}</div>}
            </div>

            {(() => {
                let color = '#fff';
                let borderColor = '#fff';
                let bgColor = 'rgba(255, 255, 255, 0.1)';
                
                if (card.revenue === RevenueType.ENERGY) {
                    color = '#4caf50'; // Vert
                    borderColor = '#4caf50';
                    bgColor = 'rgba(76, 175, 80, 0.15)';
                } else if (card.revenue === RevenueType.CREDIT) {
                    color = '#ffd700'; // Or
                    borderColor = '#ffd700';
                    bgColor = 'rgba(255, 215, 0, 0.15)';
                } else if (card.revenue === RevenueType.CARD) {
                    color = '#000'; // Noir
                    borderColor = '#000';
                    bgColor = '#e0e0e0'; // Fond clair
                }

                return (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: `2px solid ${borderColor}`, borderRadius: '8px', backgroundColor: bgColor, margin: '4px 0', padding: '4px' }}>
                      <div style={{ fontSize: '0.7em', textTransform: 'uppercase', color: card.revenue === RevenueType.CARD ? '#333' : '#ddd', marginBottom: '2px' }}>Réservation</div>
                      <div style={{ fontSize: '1.1em', fontWeight: 'bold', color: color, textAlign: 'center' }}>{card.revenue || 'Aucun'}</div>
                    </div>
                );
            })()}
          </>
        ) : isDiscardingForSignal ? (
          <>
            <div className="seti-card-name" style={{ fontSize: '0.75rem', lineHeight: '1.1', marginBottom: '4px', height: '2.2em', overflow: 'hidden' }}><span>{card.name}</span></div>
            <div style={{ fontSize: '0.75em', marginTop: '2px', display: 'flex', justifyContent: 'space-between' }}><span style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '0 4px', borderRadius: '4px' }}>Coût: <span style={{ color: '#ffd700' }}>{card.cost}</span></span><span style={{ color: '#aaa', fontSize: '0.9em' }}>{card.type === CardType.ACTION ? 'ACT' : (card.type === CardType.END_GAME ? 'FIN' : 'MIS')}</span></div>
            {card.description && <div className="seti-card-description" style={{ flex: 1, margin: '4px 0', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', textOverflow: 'ellipsis' }}>{card.description}</div>}
            <div className="seti-card-details" style={{ display: 'flex', flexDirection: 'row', gap: '8px', marginTop: 'auto', fontSize: '0.7em', backgroundColor: 'rgba(0,0,0,0.2)', padding: '2px', borderRadius: '4px', justifyContent: 'space-between' }}>
                {card.freeAction && <div>Act: {card.freeAction}</div>}
                {card.revenue && <div>Rev: {card.revenue}</div>}
            </div>

            {(() => {
                const color = getSectorTypeCode(card.scanSector);
                const borderColor = color;
                const bgColor = `${color}26`;

                return (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: `2px solid ${borderColor}`, borderRadius: '8px', backgroundColor: bgColor, margin: '4px 0', padding: '4px' }}>
                      <div style={{ fontSize: '0.7em', textTransform: 'uppercase', color: '#ddd', marginBottom: '2px' }}>Signal</div>
                      <div style={{ fontSize: '1.1em', fontWeight: 'bold', color: color, textAlign: 'center' }}>{card.scanSector || 'Aucun'}</div>
                    </div>
                );
            })()}
          </>
        ) : (
          <>
            <div className="seti-card-name" style={{ fontSize: '0.75rem', lineHeight: '1.1', marginBottom: '4px', height: '2.2em', overflow: 'hidden' }}><span>{card.name}</span></div>
            <div style={{ fontSize: '0.75em', marginTop: '2px', display: 'flex', justifyContent: 'space-between' }}><span style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '0 4px', borderRadius: '4px' }}>Coût: <span style={{ color: '#ffd700' }}>{card.cost}</span></span><span style={{ color: '#aaa', fontSize: '0.9em' }}>{card.type === CardType.ACTION ? 'ACT' : (card.type === CardType.END_GAME ? 'FIN' : 'MIS')}</span></div>
            {card.description && <div className="seti-card-description" style={{ flex: 1, margin: '4px 0', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', textOverflow: 'ellipsis' }}>{card.description}</div>}
            <div className="seti-card-details" style={{ display: 'flex', flexDirection: 'row', gap: '8px', marginTop: 'auto', fontSize: '0.7em', backgroundColor: 'rgba(0,0,0,0.2)', padding: '2px', borderRadius: '4px', justifyContent: 'space-between' }}>
                {card.revenue && <div>Rev: {card.revenue}</div>}
                {card.scanSector && <div>Scan: {card.scanSector}</div>}
            </div>

            {(() => {
                let color = '#fff';
                let borderColor = '#fff';
                let bgColor = 'rgba(255, 255, 255, 0.1)';
                
                if (card.freeAction === FreeActionType.DATA) {
                    color = '#2196f3';
                    borderColor = '#2196f3';
                    bgColor = 'rgba(33, 150, 243, 0.15)';
                } else if (card.freeAction === FreeActionType.MEDIA) {
                    color = '#e53935';
                    borderColor = '#e53935';
                    bgColor = 'rgba(229, 57, 53, 0.15)';
                } else if (card.freeAction === FreeActionType.MOVEMENT) {
                    color = '#fff';
                    borderColor = '#ddd';
                    bgColor = 'rgba(40,40,40,0.95)';
                }

                return (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: `2px solid ${borderColor}`, borderRadius: '8px', backgroundColor: bgColor, margin: '4px 0', padding: '4px' }}>
                      <div style={{ fontSize: '0.7em', textTransform: 'uppercase', color: '#ddd', marginBottom: '2px' }}>Action gratuite</div>
                      <div style={{ fontSize: '1.1em', fontWeight: 'bold', color: color, textAlign: 'center' }}>{card.freeAction || 'Aucun'}</div>
                    </div>
                );
            })()}
            {/*<div className="seti-card-details" style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: 'auto', fontSize: '0.7em', backgroundColor: 'rgba(0,0,0,0.2)', padding: '2px', borderRadius: '4px' }}><div className="seti-card-detail" style={{ display: 'flex', justifyContent: 'space-between' }}>{card.freeAction && <span>Act: {card.freeAction}</span>}{card.scanSector && <span>Scan: {card.scanSector}</span>}</div><div className="seti-card-detail">{card.revenue && <span>Rev: {card.revenue}</span>}</div></div>*/}
          </>
        )}
      </div>
    );
};

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

  const selectedCardIds = (isDiscarding || isTrading || isReserving || isDiscardingForSignal)
    ? (interactionState as any).selectedCards
    : [];

  const reservationCount = isReserving ? (interactionState as any).count : 0;
  const discardForSignalCount = isDiscardingForSignal ? (interactionState as any).count : 0;

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
    [ActionType.DRAW_CARDS]: false,
    [ActionType.DISCARD_CARDS]: false,
    [ActionType.RESERVE_CARD]: false,
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
              <div className="seti-player-section-title seti-section-header">Ressources</div>
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
              <div className="seti-player-section-title">Revenues</div>
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
            <div className="seti-player-section-title">Actions principales</div>
            <div className="seti-player-actions seti-actions-grid">
              {Object.entries(ACTION_NAMES)
                .filter(([action]) => action)
                .map(([action, name]) => {
                  const available = actionAvailability[action as ActionType] && !isInteractiveMode;
                  const actionType = action as ActionType;
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
                      {name}
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
                  <div key={tech.id} className="seti-player-list-item seti-tech-list-item">
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
              <PlayerComputerUI 
                player={currentPlayer} 
                onSlotClick={handleComputerSlotClick}
                isSelecting={isSelectingComputerSlot && !isRobot}
                onColumnSelect={onComputerSlotSelect}
                isAnalyzing={isAnalyzing}
                disabled={isInteractiveMode || isRobot}
                onHover={handleTooltipHover}
                onLeave={handleTooltipLeave}
              />
            </div>
          </div>

          {/* Cartes */}
          <div className="seti-player-section" style={isReserving ? { 
            position: 'relative', 
            zIndex: 1501
          } : {}}>
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
            {isDiscarding && (
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
            {isTrading && (
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
            {isReserving && (
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
            {isDiscardingForSignal && (
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
                        renderActionButton={renderActionButton as any}
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
            <div className="seti-player-section-title">Missions</div>
            <div className="seti-player-list seti-cards-list">
              {((currentPlayer.missions && currentPlayer.missions.length > 0) || (currentPlayer.playedCards && currentPlayer.playedCards.length > 0)) ? (
                <>
                {(currentPlayer.missions || []).map((mission: Mission) => {
                  const missionRequirementStrings = mission.description.split('Mission:').slice(1).filter(s => s.trim() !== '');
                  const displayCount = Math.max(missionRequirementStrings.length, mission.requirements.length);
                  const displayItems = Array.from({ length: displayCount });

                  return (
                  <div key={mission.id} 
                    className={`seti-common-card seti-mission-card ${mission.completed ? 'completed' : ''}`} 
                    style={{ cursor: !mission.completed && isCurrentTurn && !isRobot && !isInteractiveMode ? 'pointer' : 'default' }}
                    onClick={(_e) => {
                        if (onMissionClick && !mission.completed && isCurrentTurn && !isRobot && !isInteractiveMode) {
                            onMissionClick(mission.id);
                        }
                    }}
                    onMouseEnter={e => {
                    const tooltipContent = (
                      <div className="seti-card-tooltip">
                        <div className="seti-card-tooltip-title">{mission.name}</div>
                        <div className="seti-card-tooltip-desc">
                          {displayItems.map((_, index) => {
                            const requirement = mission.requirements[index];
                            const isCompleted = requirement && requirement.id ? (mission.completedRequirementIds || []).includes(requirement.id) : false;
                            const text = missionRequirementStrings[index] || (requirement ? `Condition ${index + 1}` : `Mission ${index + 1}`);
                            
                            const isConditional = requirement && requirement.type.startsWith('GAIN_IF_');
                            const icon = isCompleted ? '✅' : (isConditional ? '⬜' : '⚪');

                            return (
                              <div key={index} style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '4px' }}>
                                <span style={{ marginRight: '8px', color: isCompleted ? '#4caf50' : '#aaa', fontSize: '1.2em', lineHeight: '1' }}>
                                  {icon}
                                </span>
                                <span>
                                  <span style={{ fontWeight: 'bold' }}>Mission:</span> {text.trim()}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                        {mission.completed && (
                          <div className="seti-card-tooltip-stats" style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#4caf50', fontWeight: 'bold', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #555' }}>
                            MISSION ACCOMPLIE
                          </div>
                        )}
                      </div>
                    );
                    handleTooltipHover(e, tooltipContent);
                  }} onMouseLeave={handleTooltipLeave}>
                    <div className="seti-mission-header">
                      <div className="seti-mission-title">{mission.name}</div>
                      <span className="seti-played-card-tag">MIS</span>
                      {mission.completed && <span className="seti-mission-check">✓</span>}
                    </div>
                    
                    {mission.description && (
                      <div className="seti-mission-desc">
                        {mission.description}
                      </div>
                    )}

                    <div className="seti-mission-requirements-row" style={{ display: 'flex', width: '100%', padding: '8px 0 4px 0', marginTop: 'auto', justifyContent: 'space-evenly' }}>
                        {displayItems.map((_, index) => {
                            const requirement = mission.requirements[index];
                            const isCompleted = requirement && requirement.id ? (mission.completedRequirementIds || []).includes(requirement.id) : false;
                            const text = missionRequirementStrings[index] || (requirement ? `Condition ${index + 1}` : `Mission ${index + 1}`);
                            
                            let isFulfillable = false;
                            let isConditional = false;
                            
                            // Vérifier si la condition est marquée comme "fulfillable" (GAIN_ON_...)
                            if (requirement?.id && mission.fulfillableRequirementIds?.includes(requirement.id)) {
                                isFulfillable = true;
                            }

                            if (requirement) {
                                if (requirement.type.startsWith('GAIN_IF_')) {
                                    isConditional = true;
                                    const bonus = CardSystem.evaluateMission(game, currentPlayer.id, requirement.value);
                                    if (bonus) isFulfillable = true;
                                }
                            }

                            const canClick = !isCompleted && isFulfillable && isCurrentTurn && !isRobot && !isInteractiveMode;
                            const isHighlighted = isCompleted || canClick;

                            return (
                                <div 
                                    key={index}
                                    className="seti-mission-requirement-indicator"
                                    style={{
                                        width: '12px',
                                        height: '12px',
                                        borderRadius: isConditional ? '2px' : '50%',
                                        border: `1px solid ${currentPlayer.color}`,
                                        backgroundColor: isCompleted ? currentPlayer.color : 'transparent',
                                        cursor: canClick ? 'pointer' : 'default',
                                        zIndex: canClick ? 20 : 10,
                                        opacity: isHighlighted ? 1 : 0.3,
                                        boxShadow: canClick ? `0 0 8px ${currentPlayer.color}, 0 0 12px #fff` : (isCompleted ? `0 0 5px ${currentPlayer.color}` : 'none'),
                                        transform: canClick ? 'scale(1.3)' : 'scale(1)',
                                        transition: 'all 0.3s ease'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.stopPropagation();
                                        handleTooltipHover(e, <div style={{padding: '4px', maxWidth: '200px'}}>{text.trim()}</div>);
                                    }}
                                    onMouseLeave={(e) => {
                                        e.stopPropagation();
                                        handleTooltipLeave();
                                    }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (canClick && onMissionClick && requirement?.id) {
                                            onMissionClick(mission.id, requirement.id);
                                        }
                                    }}
                                />
                            );
                        })}
                    </div>
                  </div>
                )})}
                {(currentPlayer.playedCards || []).map((card: Card) => {
                  const descriptionParts = card.description ? card.description.split('Fin de jeu:') : [];
                  const missionText = descriptionParts.length > 1 ? descriptionParts[1].trim() : card.description;
                  return (
                  <div key={card.id} className="seti-common-card seti-played-card"
                  onMouseEnter={(e) => handleTooltipHover(e, <CardTooltip card={card} />)}
                  onMouseLeave={handleTooltipLeave}
                  >
                    <div className="seti-mission-header">
                      <div className="seti-mission-title">{card.name}</div>
                      <span className="seti-played-card-tag">FIN</span>
                    </div>
                    {missionText && (
                      <div className="seti-mission-desc">
                        {missionText}
                      </div>
                    )}
                  </div>
                )})}
                </>
              ) : (
                <div className="seti-player-list-empty">Aucune mission jouée</div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
