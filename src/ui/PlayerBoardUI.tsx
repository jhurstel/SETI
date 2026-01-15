import React, { useState, useEffect, useRef } from 'react';
import { Game, ActionType, GAME_CONSTANTS, FreeAction, ProbeState, Card } from '../core/types';
import { ProbeSystem } from '../systems/ProbeSystem';
import { DataSystem } from '../systems/DataSystem';
import './PlayerBoardUI.css';

interface PlayerBoardUIProps {
  game: Game;
  playerId?: string;
  onViewPlayer?: (playerId: string) => void;
  onAction?: (actionType: ActionType) => void;
  isDiscarding?: boolean;
  selectedCardIds?: string[];
  onCardClick?: (cardId: string) => void;
  onConfirmDiscard?: () => void;
  onDiscardCardAction?: (cardId: string) => void;
  onPlayCard?: (cardId: string) => void;
  onBuyCardAction?: () => void;
  onTradeResourcesAction?: () => void;
  tradeState?: { phase: 'inactive' | 'spending' | 'gaining', spend?: { type: string, cardIds?: string[] } };
  onSpendSelection?: (resource: string, cardIds?: string[]) => void;
  onGainSelection?: (resource: string) => void;
  onCancelTrade?: () => void;
  onGameUpdate?: (game: Game) => void;
  onDrawCard?: (count: number, source: string) => void;
  isSelectingComputerSlot?: boolean;
  onComputerSlotSelect?: (col: number) => void;
  isAnalyzing?: boolean;
  hasPerformedMainAction?: boolean;
  onNextPlayer?: () => void;
  onHistory?: (message: string) => void;
  onComputerBonus?: (type: string, amount: number) => void;
  reservationState?: { active: boolean; count: number };
  onReserveCard?: (cardId: string) => void;
  isPlacingLifeTrace?: boolean;
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
};

const ComputerSlot = ({ 
  slot, 
  onClick, 
  canFill,
  onHover,
  onLeave
}: { 
  slot: any, 
  onClick: () => void, 
  canFill: boolean,
  onHover: (e: React.MouseEvent, content: React.ReactNode) => void,
  onLeave: () => void
}) => {
  const isFilled = slot.filled;
  
  let bonusText = '';
  let bonusColor = '#fff';
  
  if (slot.bonus === 'media') { bonusText = '1 Média'; bonusColor = '#ff6b6b'; }
  else if (slot.bonus === 'reservation') { bonusText = '1 Réservation'; bonusColor = '#fff'; }
  else if (slot.bonus === '2pv') { bonusText = '2 PV'; bonusColor = '#8affc0'; }
  else if (slot.bonus === 'credit') { bonusText = '1 Crédit'; bonusColor = '#ffd700'; }
  else if (slot.bonus === 'energy') { bonusText = '1 Énergie'; bonusColor = '#4caf50'; }
  else if (slot.bonus === 'card') { bonusText = '1 Carte'; bonusColor = '#aaffaa'; }

  let title = '';
  let titleColor = '#fff';
  let subContent: React.ReactNode = null;

  if (isFilled) {
      title = 'Donnée stockée';
      titleColor = '#aaa';
      if (bonusText) {
          subContent = <div style={{ fontSize: '0.9em', color: '#ccc' }}>Bonus obtenu : <span style={{ color: bonusColor }}>{bonusText}</span></div>;
      }
  } else if (canFill) {
      title = 'Emplacement disponible';
      titleColor = '#4a9eff';
      if (bonusText) {
          subContent = <div style={{ fontSize: '0.9em', color: '#ccc' }}>Gagnez : <span style={{ color: bonusColor, fontWeight: 'bold' }}>{bonusText}</span></div>;
      } else {
          subContent = <div style={{ fontSize: '0.9em', color: '#ccc' }}>Aucun bonus immédiat</div>;
      }
  } else {
      title = 'Emplacement indisponible';
      titleColor = '#ff6b6b';
      if (bonusText) {
          subContent = <div style={{ fontSize: '0.9em', color: '#ccc' }}>Bonus potentiel : <span style={{ color: bonusColor }}>{bonusText}</span></div>;
      }
  }
  
  const tooltipContent = (
      <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '4px', color: titleColor }}>{title}</div>
          {subContent}
          {canFill && !isFilled && <div style={{ fontSize: '0.8em', color: '#aaa', marginTop: '4px', fontStyle: 'italic' }}>Cliquer pour transférer une donnée</div>}
      </div>
  );

  return (
    <div
      onClick={canFill && !isFilled ? onClick : undefined}
      className={`computer-slot ${isFilled ? 'filled' : ''} ${canFill && !isFilled ? 'can-fill' : ''}`}
      onMouseEnter={(e) => onHover(e, tooltipContent)}
      onMouseLeave={onLeave}
    >
      {isFilled && <div className="computer-slot-dot" />}
      {!isFilled && slot.bonus === 'media' && <span className="computer-slot-bonus media">M</span>}
      {!isFilled && slot.bonus === 'reservation' && <span className="computer-slot-bonus reservation">R</span>}
      {!isFilled && slot.bonus === '2pv' && <span className="computer-slot-bonus pv">2PV</span>}
      {!isFilled && slot.bonus === 'credit' && <span className="computer-slot-bonus credit">C</span>}
      {!isFilled && slot.bonus === 'energy' && <span className="computer-slot-bonus energy">E</span>}
      {!isFilled && slot.bonus === 'card' && <span className="computer-slot-bonus card">🃏</span>}
    </div>
  );
};

const PlayerComputer = ({ 
  player, onSlotClick, isSelecting, onColumnSelect, isAnalyzing, disabled, onHover, onLeave 
}: { 
  player: any, onSlotClick: (slotId: string) => void, isSelecting?: boolean, onColumnSelect?: (col: number) => void, isAnalyzing?: boolean, disabled?: boolean,
  onHover: (e: React.MouseEvent, content: React.ReactNode) => void,
  onLeave: () => void
}) => {
  // Initialize if needed
  DataSystem.initializeComputer(player);
  const slots = player.computer.slots;

  const columns = [1, 2, 3, 4, 5, 6];

  return (
    <div className={`player-computer-container ${isAnalyzing ? 'analyzing-container' : ''}`}>
      {/* Animation de scan */}
      {isAnalyzing && <div className="scan-line" />}

      {columns.map((col, index) => {
        const colSlots = Object.values(slots).filter((s: any) => s.col === col).sort((a: any, b: any) => a.type === 'top' ? -1 : 1);
        const hasBottom = colSlots.length > 1;
        const isSelectableColumn = isSelecting && hasBottom; // Only columns with 2 slots (1, 3, 5, 6) are selectable for computing tech

        // Calculate margins for separator to touch circles
        let separatorLeftMargin = 0;
        let separatorRightMargin = 0;
        
        if (index < columns.length - 1) {
            const currentPadding = hasBottom ? 12 : 4;
            const nextCol = columns[index + 1];
            const nextColSlots = Object.values(slots).filter((s: any) => s.col === nextCol);
            const nextHasBottom = nextColSlots.length > 1;
            const nextPadding = nextHasBottom ? 12 : 4;
            
            separatorLeftMargin = -currentPadding;
            separatorRightMargin = -nextPadding;
        }

        return (
          <React.Fragment key={col}>
            <div 
              onClick={() => isSelectableColumn && onColumnSelect && onColumnSelect(col)}
              className={`computer-column ${hasBottom ? 'has-bottom' : ''} ${isSelectableColumn ? 'selectable' : ''}`}
            >
              {/* Ligne verticale reliant haut et bas */}
              {hasBottom && (
                <div className="computer-column-connector" />
              )}
              {colSlots.map((slot: any) => (
                <ComputerSlot 
                  key={slot.id} 
                  slot={slot} 
                  onClick={() => onSlotClick(slot.id)} 
                  canFill={!disabled && DataSystem.canFillSlot(player, slot.id)} 
                  onHover={onHover}
                  onLeave={onLeave}
                />
              ))}
            </div>
            {index < columns.length - 1 && (
              <div 
                className="computer-separator"
                style={{
                  marginLeft: separatorLeftMargin,
                  marginRight: separatorRightMargin,
                }} 
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

const Tooltip = ({ content, targetRect }: { content: React.ReactNode, targetRect: DOMRect }) => {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({ opacity: 0 });

  React.useLayoutEffect(() => {
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

      setStyle({
        top,
        left,
        opacity: 1
      });
    }
  }, [targetRect, content]);

  return (
    <div
      ref={tooltipRef}
      style={{
        position: 'fixed',
        zIndex: 9999,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        padding: '6px 10px',
        borderRadius: '4px',
        border: '1px solid #78a0ff',
        color: '#fff',
        textAlign: 'center',
        minWidth: '120px',
        pointerEvents: 'none',
        whiteSpace: 'pre-line',
        boxShadow: '0 2px 10px rgba(0,0,0,0.5)',
        transition: 'opacity 0.1s ease-in-out',
        ...style
      }}
    >
      {content}
    </div>
  );
};

export const PlayerBoardUI: React.FC<PlayerBoardUIProps> = ({ game, playerId, onViewPlayer, onAction, isDiscarding = false, selectedCardIds = [], onCardClick, onConfirmDiscard, onDiscardCardAction, onPlayCard, onBuyCardAction, onTradeResourcesAction, tradeState = { phase: 'inactive' }, onSpendSelection, onGainSelection, onCancelTrade, onGameUpdate, onDrawCard, isSelectingComputerSlot, onComputerSlotSelect, isAnalyzing, hasPerformedMainAction = false, onNextPlayer, onHistory, onComputerBonus, reservationState = { active: false, count: 0 }, onReserveCard, isPlacingLifeTrace = false }) => {
  const currentPlayer = playerId 
    ? (game.players.find(p => p.id === playerId) || game.players[game.currentPlayerIndex])
    : game.players[game.currentPlayerIndex];
  
  const isCurrentTurn = game.players[game.currentPlayerIndex].id === currentPlayer.id;
  const isRobot = (currentPlayer as any).type === 'robot';
  const [highlightedCardId, setHighlightedCardId] = useState<string | null>(null);
  const [cardsSelectedForTrade, setCardsSelectedForTrade] = useState<string[]>([]);
  const [tick, setTick] = useState(0);
  const [customTooltip, setCustomTooltip] = useState<{ content: React.ReactNode, targetRect: DOMRect } | null>(null);

  const handleTooltipHover = (e: React.MouseEvent, content: React.ReactNode) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setCustomTooltip({
      content,
      targetRect: rect
    });
  };

  const handleTooltipLeave = () => {
    setCustomTooltip(null);
  };
  
  const isInteractiveMode = isDiscarding || tradeState.phase !== 'inactive' || isSelectingComputerSlot || isAnalyzing || reservationState.active || isPlacingLifeTrace;

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
  }, [game, currentPlayer.id]);

  // Effect to reset selection when exiting trading mode
  useEffect(() => {
    if (tradeState.phase === 'inactive') {
      setCardsSelectedForTrade([]);
    } else {
      setHighlightedCardId(null);
    }
  }, [tradeState.phase]);

  const handleComputerBonus = (type: string, amount: number) => {
    if (type === 'reservation') {
      if (onComputerBonus) onComputerBonus(type, amount);
    } else if (type === 'card' && onDrawCard) {
      onDrawCard(amount, 'Bonus Ordinateur');
    }
  };

  const handleComputerSlotClick = (slotId: string) => {
    if (isInteractiveMode && !isSelectingComputerSlot) return;

    // Créer une copie profonde pour éviter la mutation de l'état actuel
    // Cela garantit que 'game' reste valide comme 'previousState' pour l'historique
    const gameCopy = structuredClone(game);

    const { updatedGame, gains, bonusEffects } = DataSystem.fillSlot(gameCopy, currentPlayer.id, slotId);
    
    bonusEffects.forEach(effect => {
      handleComputerBonus(effect.type, effect.amount);
    });
    
    if (onHistory) {
        const gainText = gains.length > 0 ? ` et gagne : ${gains.join(', ')}` : '';
        onHistory(`transfère une donnée vers l'ordinateur (${slotId})${gainText}`);
    }
    
    setTick(t => t + 1);
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
    const prevValueRef = useRef<number>();
    const prevPlayerIdRef = useRef<string>();

    useEffect(() => {
      const prevPlayerId = prevPlayerIdRef.current;
      const prevValue = prevValueRef.current;

      if (prevPlayerId === playerId && prevValue !== undefined && value !== prevValue) {
        setFlash({
          type: value > prevValue ? 'gain' : 'loss',
          id: Date.now() + Math.random(),
        });
        const timer = setTimeout(() => setFlash(null), 600);
        return () => clearTimeout(timer);
      }
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
  const dataFlash = useResourceFlash(currentPlayer.data, currentPlayer.id);
  const revenueCreditFlash = useResourceFlash(currentPlayer.revenueCredits, currentPlayer.id);
  const revenueEnergyFlash = useResourceFlash(currentPlayer.revenueEnergy, currentPlayer.id);
  const revenueCardFlash = useResourceFlash(currentPlayer.revenueCards, currentPlayer.id);
  const cardsFlash = useResourceFlash((currentPlayer.cards || []).length, currentPlayer.id);

  const actionAvailability: Record<ActionType, boolean> = {
    [ActionType.LAUNCH_PROBE]: isCurrentTurn && !isRobot && !hasPerformedMainAction && ProbeSystem.canLaunchProbe(game, currentPlayer.id).canLaunch,
    [ActionType.ORBIT]: isCurrentTurn && !isRobot && !hasPerformedMainAction && currentPlayer.probes.some(probe => ProbeSystem.canOrbit(game, currentPlayer.id, probe.id).canOrbit),
    [ActionType.LAND]: isCurrentTurn && !isRobot && !hasPerformedMainAction && currentPlayer.probes.some(probe => ProbeSystem.canLand(game, currentPlayer.id, probe.id).canLand),
    [ActionType.SCAN_SECTOR]: isCurrentTurn && !isRobot && !hasPerformedMainAction && false, // TODO
    [ActionType.ANALYZE_DATA]: isCurrentTurn && !isRobot && !hasPerformedMainAction && DataSystem.canAnalyzeData(game, currentPlayer.id).canAnalyze,
    [ActionType.PLAY_CARD]: isCurrentTurn && !isRobot && !hasPerformedMainAction && false, // TODO
    [ActionType.RESEARCH_TECH]: isCurrentTurn && !isRobot && !hasPerformedMainAction && currentPlayer.mediaCoverage >= GAME_CONSTANTS.TECH_RESEARCH_COST_MEDIA,
    [ActionType.PASS]: isCurrentTurn && !isRobot && !hasPerformedMainAction,
  };

  // Fonction helper pour générer le tooltip basé sur l'état du jeu (Interaction Engine -> UI)
  const getActionTooltip = (actionType: ActionType, available: boolean): string => {
    // Si l'action est disponible, on peut retourner une description simple ou rien
    //if (available) {
       // On pourrait ajouter des descriptions génériques ici si voulu
    //   return ACTION_NAMES[actionType];
    //}
    const hasProbeOnPlanetInfo = ProbeSystem.probeOnPlanetInfo(game, currentPlayer.id)

    switch (actionType) {
      case ActionType.LAUNCH_PROBE:
        if (isRobot) return "Tour du robot";
        if (hasPerformedMainAction) return "Action principale déjà effectuée";

        const launchCheck = ProbeSystem.canLaunchProbe(game, currentPlayer.id);
        if (!launchCheck.canLaunch) return launchCheck.reason || "Impossible de lancer une sonde";
        return `Lancer une sonde depuis la Terre (coût: ${GAME_CONSTANTS.PROBE_LAUNCH_COST} crédits)`;

      case ActionType.ORBIT:
        if (isRobot) return "Tour du robot";
        if (hasPerformedMainAction) return "Action principale déjà effectuée";
        
        const orbitProbe = currentPlayer.probes.find(p => p.state === ProbeState.IN_SOLAR_SYSTEM);
        if (!orbitProbe) return 'Nécessite une sonde dans le système solaire';

        const orbitCheck = ProbeSystem.canOrbit(game, currentPlayer.id, orbitProbe.id);
        if (!orbitCheck.canOrbit) return orbitCheck.reason || "Impossible";
        
        return `Mettre une sonde en orbite (coût: ${GAME_CONSTANTS.ORBIT_COST_CREDITS} crédit, ${GAME_CONSTANTS.ORBIT_COST_ENERGY} énergie)`;
      
      case ActionType.LAND:
        if (isRobot) return "Tour du robot";
        if (hasPerformedMainAction) return "Action principale déjà effectuée";
        
        const landProbe = currentPlayer.probes.find(p => p.state === ProbeState.IN_SOLAR_SYSTEM);
        if (!landProbe) return 'Nécessite une sonde dans le système solaire';

        const landCheck = ProbeSystem.canLand(game, currentPlayer.id, landProbe.id);
        if (!landCheck.canLand) return landCheck.reason || "Impossible";

        return `Poser une sonde sur une planète (coût: ${landCheck.energyCost} énergie${hasProbeOnPlanetInfo.hasOrbiter ? ', orbiteur présent' : ''}${hasProbeOnPlanetInfo.hasExploration3 ? ', réduction exploration 3' : ''})`;

      case ActionType.SCAN_SECTOR:
        if (currentPlayer.credits < 1 || currentPlayer.energy < 2) {
          return `Nécessite 1 crédit et 2 énergies (vous avez ${currentPlayer.credits} crédit(s) et ${currentPlayer.energy} énergie(s))`;
        }
        return 'Scanner un secteur (coût: 1 crédit, 2 énergies)';

      case ActionType.ANALYZE_DATA:
        if (!currentPlayer.dataComputer.canAnalyze) return 'Nécessite des données à analyser dans l\'ordinateur de données';
        if (currentPlayer.energy < 1) return `Nécessite 1 énergie (vous avez ${currentPlayer.energy})`;
        return 'Analyser des données (coût: 1 énergie)';

      case ActionType.RESEARCH_TECH:
        if (isRobot) return "Tour du robot";
        if (hasPerformedMainAction) return "Action principale déjà effectuée";
        if (currentPlayer.mediaCoverage < GAME_CONSTANTS.TECH_RESEARCH_COST_MEDIA) return `Nécessite ${GAME_CONSTANTS.TECH_RESEARCH_COST_MEDIA} points de couverture médiatique (vous avez ${currentPlayer.mediaCoverage})`;
        return `Rechercher une technologie (coût: ${GAME_CONSTANTS.TECH_RESEARCH_COST_MEDIA} couverture médiatique)`;

      case ActionType.PLAY_CARD:
        return currentPlayer.cards.length === 0 ? 'Aucune carte en main' : 'Jouer une carte de votre main';
      
      default:
        return '';
    }
  };

  const checkCanPlayCard = (card: Card) => {
    if (!isCurrentTurn) {
      return { canPlay: false, reason: "Ce n'est pas votre tour" };
    }
    if (hasPerformedMainAction) {
      return { canPlay: false, reason: "Vous avez déjà effectué une action principale ce tour-ci" };
    }
    if (currentPlayer.credits < card.cost) {
      return { canPlay: false, reason: `Crédits insuffisants (coût: ${card.cost})` };
    }
    // TODO: Ajouter d'autres conditions de carte ici
    return { canPlay: true, reason: `Coût: ${card.cost} crédits` };
  };

  const canBuyCardAction = currentPlayer.mediaCoverage >= 3;
  const canStartTrade = tradeState.phase === 'inactive' && (currentPlayer.credits >= 2 || currentPlayer.energy >= 2 || (currentPlayer.cards || []).length >= 2);
  const canSpendCredits = tradeState.phase === 'spending' && currentPlayer.credits >= 2;
  const canSpendEnergy = tradeState.phase === 'spending' && currentPlayer.energy >= 2;
  const canSpendCards = tradeState.phase === 'spending' && (currentPlayer.cards || []).length >= 2;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', flex: 1, minHeight: 0 }}>
      {/* Onglets des joueurs */}
      <div className="seti-player-tabs" style={{ display: 'flex', gap: '4px', paddingLeft: '10px', marginBottom: '-1px', zIndex: 1 }}>
        {game.players.map((p, index) => {
           const isViewed = p.id === currentPlayer.id;
           const isActive = p.id === game.players[game.currentPlayerIndex].id;
           const isFirstPlayer = index === game.firstPlayerIndex;
           const shouldFlash = tabFlashes[p.id];

           return (
             <div 
               key={p.id}
               onClick={() => onViewPlayer && onViewPlayer(p.id)}
               style={{
                 padding: '6px 12px',
                 backgroundColor: shouldFlash ? '#4caf50' : (isViewed ? (p.color || '#444') : '#2a2a2a'),
                 borderTop: isActive ? '2px solid #fff' : '1px solid #555',
                 borderLeft: '1px solid #555',
                 borderRight: '1px solid #555',
                 borderBottom: isViewed ? `1px solid ${p.color || '#444'}` : '1px solid #555',
                 borderRadius: '6px 6px 0 0',
                 cursor: 'pointer',
                 opacity: isViewed ? 1 : 0.7,
                 color: '#fff',
                 fontSize: '0.8rem',
                 fontWeight: isActive ? 'bold' : 'normal',
                 display: 'flex',
                 alignItems: 'center',
                 gap: '5px',
                 transition: 'all 0.2s'
               }}
             >
               {p.type === 'robot' ? '🤖' : '👤'} {p.name}
               {isFirstPlayer && <span title="Premier joueur">👑</span>}
               {isActive && <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#0f0', boxShadow: '0 0 4px #0f0' }}></span>}
             </div>
           );
        })}
      </div>

    <div className="seti-player-panel" style={{ borderTop: `4px solid ${currentPlayer.color || '#444'}`, borderTopLeftRadius: 0, flex: 1, minHeight: 0, maxHeight: 'none' }}>
      <div className="seti-player-panel-title" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
        <span>
          {currentPlayer.name} {currentPlayer.type === 'robot' ? '🤖' : '👤'} - Score: {currentPlayer.score} PV
        </span>
        <button
            onClick={onNextPlayer}
            disabled={!isCurrentTurn || !hasPerformedMainAction || isInteractiveMode}
            onMouseEnter={(e) => handleTooltipHover(e, hasPerformedMainAction ? "Terminer le tour" : "Effectuez une action principale d'abord")}
            onMouseLeave={handleTooltipLeave}
            style={{
                position: 'absolute',
                right: '10px',
                backgroundColor: (isCurrentTurn && hasPerformedMainAction && !isInteractiveMode) ? '#4caf50' : '#555',
                color: (isCurrentTurn && hasPerformedMainAction && !isInteractiveMode) ? 'white' : '#aaa',
                border: 'none',
                borderRadius: '4px',
                padding: '4px 8px',
                cursor: (isCurrentTurn && hasPerformedMainAction && !isInteractiveMode) ? 'pointer' : 'not-allowed',
                fontSize: '0.8rem',
                fontWeight: 'bold'
            }}
        >
            Prochain joueur
        </button>
      </div>
      
      <div className="seti-player-layout" style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', paddingRight: '5px', flex: 1, minHeight: 0 }}>

        <div style={{ display: 'flex', gap: '10px' }}>
        {/* Ressources */}
        <div className="seti-player-section" style={{ position: 'relative', flex: 1 }}>
          <div className="seti-player-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Ressources</span>
            <div style={{ display: 'flex', gap: '5px' }}>
            {tradeState.phase === 'inactive' ? (
              <button
                onClick={onTradeResourcesAction}
                disabled={!isCurrentTurn || !canStartTrade || isInteractiveMode}
                title={canStartTrade ? "Echanger 2 ressources identiques contre 1 ressource" : "Nécessite 2 ressources identiques"}
                style={{
                  backgroundColor: (isCurrentTurn && canStartTrade && !isInteractiveMode) ? '#4a9eff' : '#555',
                  color: canStartTrade ? 'white' : '#aaa',
                  border: canStartTrade ? '1px solid #6bb3ff' : '1px solid #444',
                  borderRadius: '6px', padding: '2px 8px', fontSize: '0.7rem', cursor: (isCurrentTurn && canStartTrade && !isInteractiveMode) ? 'pointer' : 'not-allowed',
                }}
              >
                Echanger
              </button>
            ) : (
              <button
                onClick={onCancelTrade}
                title="Annuler l'échange"
                style={{
                  backgroundColor: '#f44336', color: 'white', border: '1px solid #e57373',
                  borderRadius: '6px', padding: '2px 8px', fontSize: '0.7rem', cursor: 'pointer',
                }}
              >
                Annuler
              </button>
            )}
            </div>
          </div>

          {tradeState.phase === 'gaining' && (
            <div style={{
              position: 'absolute', top: '38px', left: 0, right: 0, bottom: 0,
              background: 'rgba(30, 40, 60, 0.95)', zIndex: 10,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: '10px', padding: '10px', borderRadius: '0 0 6px 6px',
              animation: 'slideDown 0.3s ease-out'
            }}>
              <div style={{ color: '#ffeb3b', fontWeight: 'bold', marginBottom: '5px' }}>CHOISIR LE GAIN</div>
              <button onClick={() => onGainSelection && onGainSelection('credit')} style={{ width: '80%', padding: '5px', cursor: 'pointer' }}>+1 Crédit</button>
              <button onClick={() => onGainSelection && onGainSelection('energy')} style={{ width: '80%', padding: '5px', cursor: 'pointer' }}>+1 Énergie</button>
              <button onClick={() => onGainSelection && onGainSelection('carte')} style={{ width: '80%', padding: '5px', cursor: 'pointer' }}>+1 Carte</button>
            </div>
          )}

          <div className="seti-player-resources" style={{ opacity: tradeState.phase === 'gaining' ? 0.2 : 1, pointerEvents: tradeState.phase === 'gaining' ? 'none' : 'auto' }}>
            <div 
              key={mediaFlash ? `media-${mediaFlash.id}` : 'media-static'}
              className={`seti-res-badge ${mediaFlash ? (mediaFlash.type === 'gain' ? 'flash-gain' : 'flash-loss') : ''}`}
            >
              <span>Média:</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (isCurrentTurn && canBuyCardAction && !isInteractiveMode && onBuyCardAction) {
                    onBuyCardAction();
                  }
                }}
                title={canBuyCardAction && !isInteractiveMode ? "Vous gagnez 1 carte de la pioche ou de la rangée principale (cout: 3 media)" : "Nécessite 3 couverture médiatique ou action impossible"}
                disabled={!isCurrentTurn || !canBuyCardAction || isInteractiveMode}
                style={{
                  backgroundColor: (isCurrentTurn && canBuyCardAction && !isInteractiveMode) ? '#4a9eff' : '#555',
                  color: (isCurrentTurn && canBuyCardAction && !isInteractiveMode) ? 'white' : '#aaa',
                  border: (isCurrentTurn && canBuyCardAction && !isInteractiveMode) ? '1px solid #6bb3ff' : '1px solid #444',
                  borderRadius: '4px',
                  padding: '0px 6px',
                  fontSize: '0.65rem',
                  cursor: (isCurrentTurn && canBuyCardAction && !isInteractiveMode) ? 'pointer' : 'default',
                  fontWeight: 'normal',
                  boxShadow: (isCurrentTurn && canBuyCardAction && !isInteractiveMode) ? '0 1px 2px rgba(0,0,0,0.3)' : 'none',
                  transition: 'all 0.2s',
                  marginRight: '5px',
                  marginLeft: 'auto'
                }}
                onMouseEnter={(e) => {
                  if (!isCurrentTurn || !canBuyCardAction || isInteractiveMode) return;
                  const target = e.currentTarget as HTMLButtonElement;
                  target.style.backgroundColor = '#6bb3ff';
                }}
                onMouseLeave={(e) => {
                  if (!isCurrentTurn || !canBuyCardAction || isInteractiveMode) return;
                  const target = e.currentTarget as HTMLButtonElement;
                  target.style.backgroundColor = '#4a9eff';
                }}
              >
                Acheter
              </button>
              <strong>{currentPlayer.mediaCoverage}</strong>
            </div>
            <div 
              key={creditFlash ? `credit-${creditFlash.id}` : 'credit-static'}
              className={`seti-res-badge ${creditFlash ? (creditFlash.type === 'gain' ? 'flash-gain' : 'flash-loss') : ''}`}
              style={canSpendCredits ? { cursor: 'pointer', border: '1px solid #ffeb3b' } : {}}
              onClick={canSpendCredits && onSpendSelection ? () => onSpendSelection('credit') : undefined}
            >
              <span>Crédit:</span> <strong>{currentPlayer.credits}</strong>
            </div>
            <div 
              key={energyFlash ? `energy-${energyFlash.id}` : 'energy-static'}
              className={`seti-res-badge ${energyFlash ? (energyFlash.type === 'gain' ? 'flash-gain' : 'flash-loss') : ''}`}
              style={canSpendEnergy ? { cursor: 'pointer', border: '1px solid #ffeb3b' } : {}}
              onClick={canSpendEnergy && onSpendSelection ? () => onSpendSelection('energy') : undefined}
            >
              <span>Énergie:</span> <strong>{currentPlayer.energy}</strong>
            </div>
          </div>
        </div>

        {/* Revenues */}
        <div className="seti-player-section" style={{ position: 'relative', flex: 1 }}>
          <div className="seti-player-section-title">Revenues</div>
          <div className="seti-player-revenues" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div 
              key={revenueCreditFlash ? `rev-credit-${revenueCreditFlash.id}` : 'rev-credit-static'}
              className={`seti-res-badge ${revenueCreditFlash ? (revenueCreditFlash.type === 'gain' ? 'flash-gain' : 'flash-loss') : ''}`}
            >
              <span>Crédit:</span> <strong>{currentPlayer.revenueCredits}</strong>
            </div>
            <div 
              key={revenueEnergyFlash ? `rev-energy-${revenueEnergyFlash.id}` : 'rev-energy-static'}
              className={`seti-res-badge ${revenueEnergyFlash ? (revenueEnergyFlash.type === 'gain' ? 'flash-gain' : 'flash-loss') : ''}`}
            >
              <span>Énergie:</span> <strong>{currentPlayer.revenueEnergy}</strong>
            </div>
            <div 
              key={revenueCardFlash ? `rev-card-${revenueCardFlash.id}` : 'rev-card-static'}
              className={`seti-res-badge ${revenueCardFlash ? (revenueCardFlash.type === 'gain' ? 'flash-gain' : 'flash-loss') : ''}`}
            >
              <span>Carte:</span> <strong>{currentPlayer.revenueCards}</strong>
            </div>
          </div>
        </div>
        </div>

        {/* Actions */}
        {!isRobot && (
        <div className="seti-player-section">
          <div className="seti-player-section-title">Actions principales</div>
          <div className="seti-player-actions" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '5px' }}>
            {Object.entries(ACTION_NAMES)
              .filter(([action]) => action)
              .map(([action, name]) => {
                const available = actionAvailability[action as ActionType] && !isInteractiveMode;
                const actionType = action as ActionType;
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
                    style={{
                      cursor: available && onAction ? 'pointer' : 'not-allowed',
                    }}
                    onMouseEnter={(e) => handleTooltipHover(e, tooltip)}
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
                <div key={tech.id} className="seti-player-list-item" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ fontSize: '1.1em' }} title={tech.id.split('-')[0]}>{getTechIcon(tech.id)}</div>
                  <div style={{ fontWeight: 'bold', color: '#fff', whiteSpace: 'nowrap' }}>{tech.name}</div>
                  {tech.description && (
                    <div style={{ fontSize: '0.75em', color: '#ccc', fontStyle: 'italic', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }} title={tech.description}>
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
          <div className="seti-player-section-title" style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
            <span>Ordinateur</span>
            <span 
              key={dataFlash ? `data-${dataFlash.id}` : 'data-static'}
              className={dataFlash ? (dataFlash.type === 'gain' ? 'flash-gain' : 'flash-loss') : ''}
              style={{ fontSize: '0.8em', color: '#aaa', fontWeight: 'normal', padding: '2px 5px', borderRadius: '4px' }}
            >
              Donnée(s): <strong style={{ color: '#fff' }}>{currentPlayer.data || 0}</strong>
            </span>
          </div>
          <div className="seti-player-list" style={{ padding: '0' }}>
            <PlayerComputer 
              player={currentPlayer} 
              onSlotClick={handleComputerSlotClick}
              isSelecting={isSelectingComputerSlot}
              onColumnSelect={onComputerSlotSelect}
              isAnalyzing={isAnalyzing}
              disabled={isInteractiveMode}
              onHover={handleTooltipHover}
              onLeave={handleTooltipLeave}
            />
          </div>
        </div>

        {/* Cartes */}
        <div className="seti-player-section" style={reservationState.active ? { 
          position: 'relative', 
          zIndex: 1501,
          backgroundColor: '#2a2a2a',
          boxShadow: '0 0 20px rgba(0,0,0,0.8)'
        } : {}}>
          <div className="seti-player-section-title" style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
            <span>Main</span>
            <span 
              key={cardsFlash ? `cards-${cardsFlash.id}` : 'cards-static'}
              className={cardsFlash ? (cardsFlash.type === 'gain' ? 'flash-gain' : 'flash-loss') : ''}
              style={{ fontSize: '0.8em', color: '#aaa', fontWeight: 'normal', padding: '2px 5px', borderRadius: '4px' }}
            >
              Carte(s): <strong style={{ color: '#fff' }}>{(currentPlayer.cards || []).length}</strong>
            </span>
          </div>
          {isDiscarding && (
            <div style={{ marginBottom: '10px', color: '#ff6b6b', fontSize: '0.9em' }}>
              Veuillez défausser des cartes pour n'en garder que 4.
              <br />
              Sélectionnées : {selectedCardIds.length} / {Math.max(0, (currentPlayer.cards || []).length - 4)}
              {(currentPlayer.cards || []).length - selectedCardIds.length === 4 && (
                <button 
                  onClick={onConfirmDiscard}
                  style={{ marginLeft: '10px', cursor: 'pointer', padding: '2px 8px' }}
                >
                  Confirmer la défausse
                </button>
              )}
            </div>
          )}
          <div className="seti-player-list" style={{ flexDirection: 'row', overflowX: 'auto', paddingBottom: '8px', gap: '8px' }}>
            {!isRobot ? (
              (currentPlayer.cards || []).length > 0 ? (
                (currentPlayer.cards || []).map((card) => {
                const isSelectedForDiscard = selectedCardIds.includes(card.id);
                const isSelectedForTrade = cardsSelectedForTrade.includes(card.id);
                const isHighlighted = highlightedCardId === card.id;
                const isMovementAction = card.freeAction === FreeAction.MOVEMENT;
                const isDataAction = card.freeAction === FreeAction.DATA;
                const isMediaAction = card.freeAction === FreeAction.MEDIA;
                
                let canPerformFreeAction = isCurrentTurn;
                let actionTooltip = "";

                if (!isCurrentTurn) {
                  actionTooltip = "Ce n'est pas votre tour";
                } else if (isMovementAction) {
                  if (!(currentPlayer.probes || []).some(p => p.state === ProbeState.IN_SOLAR_SYSTEM)) {
                    canPerformFreeAction = false;
                    actionTooltip = "Nécessite une sonde dans le système solaire";
                  }
                } else if (isDataAction) {
                  if ((currentPlayer.data || 0) >= GAME_CONSTANTS.MAX_DATA) {
                    canPerformFreeAction = false;
                    actionTooltip = "Nécessite de transférer des données";
                  } else {
                    actionTooltip = "Vous gagnez 1 data";
                  }
                } else if (isMediaAction) {
                  if (currentPlayer.mediaCoverage >= GAME_CONSTANTS.MAX_MEDIA_COVERAGE) {
                    canPerformFreeAction = false;
                    actionTooltip = "Média au maximum";
                  } else {
                    actionTooltip = "Vous gagnez 1 media";
                  }
                }

                const { canPlay, reason: playTooltip } = checkCanPlayCard(card);
                
                return (
                  <div 
                    key={card.id} 
                    className="seti-common-card"
                    onClick={(e) => {
                      if (reservationState.active) {
                        if (card.revenue) {
                          if (onReserveCard) onReserveCard(card.id);
                        } else {
                          alert("Cette carte n'a pas de bonus de revenu.");
                        }
                        return;
                      }

                      const isSpendingPhase = tradeState.phase === 'spending' && canSpendCards;
                      const isGainingPhaseWithCards = tradeState.phase === 'gaining' && tradeState.spend?.type === 'card';

                      if (isSpendingPhase || isGainingPhaseWithCards) {
                        if (isSelectedForTrade) {
                          setCardsSelectedForTrade(prev => prev.filter(id => id !== card.id));
                        } else if (cardsSelectedForTrade.length < 2) {
                          setCardsSelectedForTrade(prev => [...prev, card.id]);
                        }
                        // Déclencher l'échange si 2 cartes sont sélectionnées
                        const newSelection = isSelectedForTrade 
                          ? cardsSelectedForTrade.filter(id => id !== card.id)
                          : [...cardsSelectedForTrade, card.id];
                        
                        if (onSpendSelection) {
                          if ((isSpendingPhase && newSelection.length === 2) || isGainingPhaseWithCards) {
                            onSpendSelection('card', newSelection);
                          }
                        }
                      } else if (isDiscarding && onCardClick) {
                        onCardClick(card.id);
                      } else {
                        setHighlightedCardId(isHighlighted ? null : card.id);
                      }
                    }}
                    style={{
                      cursor: 'pointer',
                      border: (tradeState.phase === 'spending' || tradeState.phase === 'gaining') && isSelectedForTrade
                        ? '2px solid #888'
                        : (tradeState.phase === 'spending' && canSpendCards
                          ? '1px solid #ffeb3b'
                          : (reservationState.active ? '2px solid #ff9800' : isDiscarding 
                          ? (isSelectedForDiscard ? '1px solid #ff6b6b' : '1px solid #444')
                          : (isHighlighted ? '1px solid #4a9eff' : '1px solid #444'))),
                      backgroundColor: (tradeState.phase === 'spending' || tradeState.phase === 'gaining') && isSelectedForTrade
                        ? 'rgba(100, 100, 100, 0.2)'
                        : (isDiscarding
                          ? (isSelectedForDiscard ? 'rgba(255, 107, 107, 0.1)' : 'transparent')
                          : (isHighlighted ? 'rgba(74, 158, 255, 0.1)' : 'transparent')),
                      transition: 'all 0.2s ease',
                      position: 'relative',
                      opacity: (tradeState.phase === 'spending' || tradeState.phase === 'gaining') && isSelectedForTrade ? 0.6 : 1,
                    }}
                  >
                    {isHighlighted && tradeState.phase === 'inactive' && !isDiscarding && !reservationState.active && (
                      <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (canPlay && onPlayCard) {
                            onPlayCard(card.id);
                            setHighlightedCardId(null);
                          }
                        }}
                        onMouseEnter={(e) => {
                          if (!canPlay) return;
                          const target = e.currentTarget as HTMLButtonElement;
                          target.style.backgroundColor = '#6bb3ff';
                          target.style.transform = 'scale(1.05)';
                        }}
                        onMouseLeave={(e) => {
                          if (!canPlay) return;
                          const target = e.currentTarget as HTMLButtonElement;
                          target.style.backgroundColor = '#4a9eff';
                          target.style.transform = 'scale(1)';
                        }}
                        title={playTooltip}
                        style={{
                          position: 'absolute',
                          top: '5px',
                          right: '85px',
                          zIndex: 10,
                          backgroundColor: canPlay ? '#4a9eff' : '#555',
                          color: canPlay ? 'white' : '#aaa',
                          border: canPlay ? '2px solid #6bb3ff' : '2px solid #444',
                          borderRadius: '6px',
                          padding: '3px 12px',
                          fontSize: '0.65rem',
                          cursor: canPlay ? 'pointer' : 'not-allowed',
                          fontWeight: 'normal',
                          boxShadow: canPlay ? '0 2px 4px rgba(0,0,0,0.3)' : 'none',
                          transition: 'all 0.2s',
                        }}
                      >
                        Jouer
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (canPerformFreeAction && onDiscardCardAction) {
                            onDiscardCardAction(card.id);
                            setHighlightedCardId(null);
                          }
                        }}
                        onMouseEnter={(e) => {
                          if (!canPerformFreeAction) return;
                          const target = e.currentTarget as HTMLButtonElement;
                          target.style.backgroundColor = '#6bb3ff';
                          target.style.transform = 'scale(1.05)';
                        }}
                        onMouseLeave={(e) => {
                          if (!canPerformFreeAction) return;
                          const target = e.currentTarget as HTMLButtonElement;
                          target.style.backgroundColor = '#4a9eff';
                          target.style.transform = 'scale(1)';
                        }}
                        title={actionTooltip}
                        style={{
                          position: 'absolute',
                          top: '5px',
                          right: '5px',
                          zIndex: 10,
                          backgroundColor: canPerformFreeAction ? '#4a9eff' : '#555',
                          color: canPerformFreeAction ? 'white' : '#aaa',
                          border: canPerformFreeAction ? '2px solid #6bb3ff' : '2px solid #444',
                          borderRadius: '6px',
                          padding: '3px 12px',
                          fontSize: '0.65rem',
                          cursor: canPerformFreeAction ? 'pointer' : 'not-allowed',
                          fontWeight: 'normal',
                          boxShadow: canPerformFreeAction ? '0 2px 4px rgba(0,0,0,0.3)' : 'none',
                          transition: 'all 0.2s',
                        }}
                      >
                        Défausser
                      </button>
                      </>
                    )}
                    <div className="seti-card-name" style={{ fontSize: '0.75rem', lineHeight: '1.1', marginBottom: '4px', height: '2.2em', overflow: 'hidden' }}>
                      <span>{card.name}</span>
                    </div>
                    <div style={{ fontSize: '0.75em', marginTop: '2px', display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '0 4px', borderRadius: '4px' }}>Coût: <span style={{ color: '#ffd700' }}>{card.cost}</span></span>
                      <span style={{ color: '#aaa', fontSize: '0.9em' }}>{card.type === 'ACTION' ? 'ACT' : (card.type === 'END_GAME' ? 'FIN' : 'MIS')}</span>
                    </div>
                    {card.description && (
                      <div className="seti-card-description" style={{ flex: 1, overflowY: 'auto', margin: '4px 0' }}>{card.description}</div>
                    )}
                    <div className="seti-card-details" style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: 'auto', fontSize: '0.7em', backgroundColor: 'rgba(0,0,0,0.2)', padding: '2px', borderRadius: '4px' }}>
                      <div className="seti-card-detail" style={{ display: 'flex', justifyContent: 'space-between' }}>
                        {card.freeAction && <span>Act: {card.freeAction}</span>}
                        {card.scanSector && <span>Scan: {card.scanSector}</span>}
                      </div>
                      <div className="seti-card-detail">
                        {card.revenue && <span>Rev: {card.revenue}</span>}
                      </div>
                    </div>
                  </div>
                );
                })
              ) : (
                <div className="seti-player-list-empty">Aucune carte</div>
              )
            ) : (
              <div className="seti-player-list-empty" style={{ fontStyle: 'italic', color: '#aaa' }}>
                {(currentPlayer.cards || []).length} carte(s) en main (Masqué)
              </div>
            )}
          </div>
        </div>

        {/* Missions */}
        <div className="seti-player-section">
          <div className="seti-player-section-title">Missions</div>
          <div className="seti-player-list" style={{ flexDirection: 'row', overflowX: 'auto', paddingBottom: '8px', gap: '8px' }}>
            {(currentPlayer.missions && currentPlayer.missions.length > 0) ? (
              currentPlayer.missions.map((mission: any) => (
                <div key={mission.id} className="seti-common-card" style={{ 
                  borderLeft: mission.completed ? '3px solid #4caf50' : '3px solid #aaa',
                  backgroundColor: mission.completed ? 'rgba(76, 175, 80, 0.1)' : 'rgba(30, 30, 40, 0.9)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                    <div style={{ fontWeight: 'bold', color: '#fff', fontSize: '0.75rem', lineHeight: '1.1' }}>{mission.name}</div>
                    {mission.completed && <span style={{ fontSize: '1em', color: '#4caf50', fontWeight: 'bold' }}>✓</span>}
                  </div>
                  {mission.description && (
                    <div style={{ fontSize: '0.7em', color: '#ccc', fontStyle: 'italic', overflowY: 'auto', flex: 1 }}>
                      {mission.description}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="seti-player-list-empty">Aucune mission jouée</div>
            )}
          </div>
        </div>

      </div>
    </div>
    {customTooltip && (
        <Tooltip content={customTooltip.content} targetRect={customTooltip.targetRect} />
      )}
    </div>
  );
};
