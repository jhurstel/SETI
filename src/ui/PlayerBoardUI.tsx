import React, { useState, useEffect, useRef } from 'react';
import { Game, ActionType, GAME_CONSTANTS, ProbeState, Card, CardType, SectorColor } from '../core/types';
import { ProbeSystem } from '../systems/ProbeSystem';
import { DataSystem } from '../systems/DataSystem';
import { CardSystem } from '../systems/CardSystem';
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
  onTradeCardAction?: (targetGain?: string) => void;
  isTrading?: boolean;
  onConfirmTrade?: () => void;
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
  isReserving?: boolean;
  reservationCount?: number;
  onConfirmReservation?: () => void;
  isPlacingLifeTrace?: boolean;
  onDirectTradeAction?: (spendType: string, gainType: string) => void;
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
  hasData,
  onHover,
  onLeave,
  isPreviousFilled
}: { 
  slot: any, 
  onClick: () => void, 
  canFill: boolean,
  hasData: boolean,
  onHover: (e: React.MouseEvent, content: React.ReactNode) => void,
  onLeave: () => void,
  isPreviousFilled?: boolean
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
  let bonusLine = null;
  let actionLine = null;

  if (isFilled) {
      title = 'Donnée stockée';
      titleColor = '#aaa';
      if (bonusText) {
          bonusLine = <div style={{ fontSize: '0.9em', color: '#ccc' }}>Bonus : <span style={{ color: bonusColor }}>{bonusText}</span></div>;
      }
  } else if (canFill) {
      if (hasData) {
          title = 'Disponible';
          titleColor = '#4a9eff';
          if (bonusText) {
              bonusLine = <div style={{ fontSize: '0.9em', color: '#ccc' }}>Bonus : <span style={{ color: bonusColor, fontWeight: 'bold' }}>{bonusText}</span></div>;
          } else {
              bonusLine = <div style={{ fontSize: '0.9em', color: '#ccc' }}>Aucun bonus</div>;
          }
          actionLine = <div style={{ fontSize: '0.8em', color: '#aaa', marginTop: '4px', fontStyle: 'italic' }}>Cliquer pour transférer une donnée</div>;
      } else {
          title = 'Indisponible';
          titleColor = '#ff6b6b';
          if (bonusText) {
              bonusLine = <div style={{ fontSize: '0.9em', color: '#ccc' }}>Bonus : <span style={{ color: bonusColor }}>{bonusText}</span></div>;
          } else {
              bonusLine = <div style={{ fontSize: '0.9em', color: '#ccc' }}>Aucun bonus</div>;
          }
          actionLine = <div style={{ fontSize: '0.8em', color: '#ff6b6b', marginTop: '4px', fontStyle: 'italic' }}>Nécessite 1 donnée</div>;
      }
  } else {
      title = 'Indisponible';
      titleColor = '#ff6b6b';
      if (bonusText) {
          bonusLine = <div style={{ fontSize: '0.9em', color: '#ccc' }}>Bonus : <span style={{ color: bonusColor }}>{bonusText}</span></div>;
      } else {
          bonusLine = <div style={{ fontSize: '0.9em', color: '#ccc' }}>Aucun bonus</div>;
      }
      if (isPreviousFilled && slot.type !== 'top') {
        actionLine = <div style={{ fontSize: '0.8em', color: '#aaa', marginTop: '4px', fontStyle: 'italic' }}>Nécessite une technologie informatique</div>;
      } else {
        actionLine = <div style={{ fontSize: '0.8em', color: '#aaa', marginTop: '4px', fontStyle: 'italic' }}>Nécessite le slot précédent</div>;
      }
  }
  
  const tooltipContent = (
      <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '4px', color: titleColor }}>{title}</div>
          {bonusLine}
          {actionLine}
      </div>
  );

  return (
    <div
      onClick={canFill && !isFilled ? onClick : undefined}
      className={`computer-slot ${isFilled ? 'filled' : ''} ${canFill && !isFilled ? 'can-fill' : ''}`}
      onMouseEnter={(e) => onHover(e, tooltipContent)}
      onMouseLeave={onLeave}
      style={{ cursor: canFill && !isFilled ? 'pointer' : 'help' }}
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
  const slots = player.dataComputer.slots;
  const columns = [1, 2, 3, 4, 5, 6];
  const hasData = (player.data || 0) > 0;

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
              {colSlots.map((slot: any, slotIndex: number) => (
                <ComputerSlot 
                  key={slot.id} 
                  slot={slot} 
                  onClick={() => onSlotClick(slot.id)} 
                  canFill={!disabled && DataSystem.canFillSlot(player, slot.id)} 
                  hasData={hasData}
                  onHover={onHover}
                  onLeave={onLeave}
                  isPreviousFilled={slotIndex > 0 ? colSlots[slotIndex - 1].filled : true}
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
  const tooltipId = useRef(Math.random().toString(36).substr(2, 9));

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

      // Gestion des superpositions
      const width = rect.width;
      const height = rect.height;
      let finalTop = top;
      let finalLeft = left;
      
      const others = ((window as any).__SETI_TOOLTIPS__ || []).filter((t: any) => t.id !== tooltipId.current);
      let collision = true;
      let iterations = 0;

      while (collision && iterations < 10) {
          collision = false;
          const myRect = { left: finalLeft, top: finalTop, right: finalLeft + width, bottom: finalTop + height };
          
          for (const other of others) {
              const otherRect = other.rect;
              if (myRect.left < otherRect.right &&
                  myRect.right > otherRect.left &&
                  myRect.top < otherRect.bottom &&
                  myRect.bottom > otherRect.top) {
                  
                  finalTop = otherRect.bottom + 5;
                  collision = true;
                  if (finalTop + height > viewportHeight - 10) {
                      finalTop = top;
                      finalLeft = otherRect.right + 5;
                  }
                  break;
              }
          }
          iterations++;
      }

      const registry = (window as any).__SETI_TOOLTIPS__ || [];
      (window as any).__SETI_TOOLTIPS__ = [...registry.filter((t: any) => t.id !== tooltipId.current), { id: tooltipId.current, rect: { left: finalLeft, top: finalTop, right: finalLeft + width, bottom: finalTop + height } }];

      setStyle({
        top,
        left,
        top: finalTop,
        left: finalLeft,
        opacity: 1
      });
      return () => {
          const reg = (window as any).__SETI_TOOLTIPS__ || [];
          (window as any).__SETI_TOOLTIPS__ = reg.filter((t: any) => t.id !== tooltipId.current);
      };
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

export const PlayerBoardUI: React.FC<PlayerBoardUIProps> = ({ game, playerId, onViewPlayer, onAction, isDiscarding = false, selectedCardIds = [], onCardClick, onConfirmDiscard, onDiscardCardAction, onPlayCard, onBuyCardAction, onTradeCardAction, isTrading = false, onConfirmTrade, onGameUpdate, onDrawCard, isSelectingComputerSlot, onComputerSlotSelect, isAnalyzing, hasPerformedMainAction = false, onNextPlayer, onHistory, onComputerBonus, isReserving = false, reservationCount = 0, onConfirmReservation, isPlacingLifeTrace = false, onDirectTradeAction }) => {
  const currentPlayer = playerId 
    ? (game.players.find(p => p.id === playerId) || game.players[game.currentPlayerIndex])
    : game.players[game.currentPlayerIndex];
  
  const isCurrentTurn = game.players[game.currentPlayerIndex].id === currentPlayer.id;
  const isRobot = currentPlayer.type === 'robot';
  const [highlightedCardId, setHighlightedCardId] = useState<string | null>(null);
  const [customTooltip, setCustomTooltip] = useState<{ content: React.ReactNode, targetRect: DOMRect } | null>(null);

  const getSectorColorCode = (color: SectorColor) => {
    switch(color) {
        case SectorColor.BLUE: return '#4a9eff';
        case SectorColor.RED: return '#ff6b6b';
        case SectorColor.YELLOW: return '#ffd700';
        case SectorColor.BLACK: return '#aaaaaa';
        default: return '#fff';
    }
  };

  const renderCardTooltip = (card: Card) => (
    <div style={{ width: '240px', textAlign: 'left' }}>
      <div style={{ fontWeight: 'bold', color: '#4a9eff', fontSize: '1.1rem', marginBottom: '6px', borderBottom: '1px solid #444', paddingBottom: '4px' }}>{card.name}</div>
      <div style={{ fontSize: '0.95em', color: '#fff', marginBottom: '10px', lineHeight: '1.4' }}>{card.description}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '0.85em', backgroundColor: 'rgba(255,255,255,0.05)', padding: '8px', borderRadius: '4px' }}>
         <div>Coût: <span style={{ color: '#ffd700', fontWeight: 'bold' }}>{card.cost}</span></div>
         <div>Type: {card.type === CardType.ACTION ? 'Action' : 'Mission'} ({card.id})</div>
         <div>Act: <span style={{ color: '#aaffaa' }}>{card.freeAction}</span></div>
         <div>Rev: <span style={{ color: '#aaffaa' }}>{card.revenue}</span></div>
         <div style={{ gridColumn: '1 / -1', marginTop: '4px', paddingTop: '4px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>Scan: <span style={{ color: getSectorColorCode(card.scanSector), fontWeight: 'bold' }}>{card.scanSector}</span></div>
      </div>
    </div>
  );

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
  
  const isInteractiveMode = isDiscarding || isTrading || isReserving || isSelectingComputerSlot || isAnalyzing || isPlacingLifeTrace;

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
        const gainText = gains.length > 0 ? ` et gagne ${gains.join(', ')}` : '';
        onHistory(`transfère une donnée vers l'ordinateur (${slotId})${gainText}`);
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
    [ActionType.SCAN_SECTOR]: isCurrentTurn && !isRobot && !hasPerformedMainAction && false, // TODO
    [ActionType.ANALYZE_DATA]: isCurrentTurn && !isRobot && !hasPerformedMainAction && DataSystem.canAnalyzeData(game, currentPlayer.id).canAnalyze,
    [ActionType.PLAY_CARD]: isCurrentTurn && !isRobot && !hasPerformedMainAction && CardSystem.canPlayCards(game, currentPlayer.id).canPlay,
    [ActionType.RESEARCH_TECH]: isCurrentTurn && !isRobot && !hasPerformedMainAction && currentPlayer.mediaCoverage >= GAME_CONSTANTS.TECH_RESEARCH_COST_MEDIA,
    [ActionType.PASS]: isCurrentTurn && !isRobot && !hasPerformedMainAction,
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
  const renderActionButton = (
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
        // disabled={disabled} // Désactivé pour permettre les événements de souris (tooltip)
        aria-disabled={disabled}
        style={{
          backgroundColor: !disabled ? '#333' : '#222',
          color: !disabled ? color : '#555',
          border: !disabled ? '1px solid #555' : '1px solid #333',
          borderRadius: '6px',
          padding: '0',
          width: '30px',
          height: '20px',
          fontSize: '0.8rem',
          cursor: !disabled ? 'pointer' : 'default',
          fontWeight: 'normal',
          boxShadow: !disabled ? '0 2px 4px rgba(0,0,0,0.3)' : 'none',
          transition: 'all 0.2s',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          lineHeight: 1,
          ...style
        }}
        onMouseEnter={(e) => {
          handleTooltipHover(e, tooltip);
          //if (disabled) return;
          const target = e.currentTarget as HTMLButtonElement;
          target.style.borderColor = '#4a9eff';
          target.style.backgroundColor = '#444';
          target.style.boxShadow = '0 0 5px rgba(74, 158, 255, 0.3)';
        }}
        onMouseLeave={(e) => {
          handleTooltipLeave();
          //if (disabled) return;
          const target = e.currentTarget as HTMLButtonElement;
          target.style.borderColor = '#555';
          target.style.backgroundColor = '#333';
          target.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
        }}
      >
        {icon}
      </button>
    );
  };

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

  // Helper pour le rendu d'une carte en main (Factorisation)
  const renderHandCard = (card: Card) => {
    const isSelectedForDiscard = isDiscarding && selectedCardIds.includes(card.id);
    const isSelectedForTrade = isTrading && selectedCardIds.includes(card.id);
    const isSelectedForReservation = isReserving && selectedCardIds.includes(card.id);
    const isHighlighted = highlightedCardId === card.id;
    
    // Détermination de la classe CSS selon la phase
    let phaseClass = 'seti-card-idle';
    let isClickable = true;

    if (isReserving) {
      phaseClass = 'seti-card-interact-mode';
      if (isSelectedForReservation) {
        phaseClass += ' selected';
      } else if (selectedCardIds.length === reservationCount) {
        phaseClass += ' disabled';
        isClickable = false;
      }
    } else if (isDiscarding) {
      phaseClass = 'seti-card-interact-mode';
      if (isSelectedForDiscard) {
        phaseClass += ' selected';
      } else if (currentPlayer.cards.length - selectedCardIds.length === 4) {
        phaseClass += ' disabled';
        isClickable = false;
      }
    } else if (isTrading) {
      phaseClass = 'seti-card-interact-mode';
      if (isSelectedForTrade) {
        phaseClass += ' selected';
      } else if (selectedCardIds.length >= 2) {
        phaseClass += ' disabled';
        isClickable = false;
      }
    } else {
      // Mode IDLE (Jeu normal)
      if (isHighlighted) {
        phaseClass += ' selected';
      }
    }

    const { canDiscard, reason: discardTooltip } = CardSystem.canDiscardFreeAction(game, currentPlayer.id, card.freeAction);

    const { canPlay, reason: playTooltip } = CardSystem.canPlayCard(game, currentPlayer.id, card);
    const canPlayAction = canPlay && !hasPerformedMainAction;
    const effectivePlayTooltip = hasPerformedMainAction ? "Action principale déjà effectuée" : playTooltip;

    return (
      <div 
        key={card.id} 
        className={`seti-common-card seti-card-wrapper ${phaseClass}`}
        onMouseEnter={(e) => handleTooltipHover(e, renderCardTooltip(card))}
        onMouseLeave={handleTooltipLeave}
        onClick={(e) => {
          if (!isClickable) return;
          
          if (isReserving || isTrading || isDiscarding) {
            if (onCardClick) onCardClick(card.id);
            return;
          }
          
          // Mode IDLE : Toggle highlight
          setHighlightedCardId(isHighlighted ? null : card.id);
        }}
      >
        {isHighlighted && !isDiscarding && !isReserving && !isTrading && (
          <>
          {renderActionButton('▶️', effectivePlayTooltip, () => { if (canPlayAction && onPlayCard) { onPlayCard(card.id); setHighlightedCardId(null); } }, !canPlayAction, '#4a9eff', { position: 'absolute', top: '5px', right: '40px', zIndex: 10 })}
          {renderActionButton('🗑️', discardTooltip, () => { if (canDiscard && onDiscardCardAction) { onDiscardCardAction(card.id); setHighlightedCardId(null); } }, !canDiscard, '#ff6b6b', { position: 'absolute', top: '5px', right: '5px', zIndex: 10 })}
          </>
        )}
        <div className="seti-card-name" style={{ fontSize: '0.75rem', lineHeight: '1.1', marginBottom: '4px', height: '2.2em', overflow: 'hidden' }}><span>{card.name}</span></div>
        <div style={{ fontSize: '0.75em', marginTop: '2px', display: 'flex', justifyContent: 'space-between' }}><span style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '0 4px', borderRadius: '4px' }}>Coût: <span style={{ color: '#ffd700' }}>{card.cost}</span></span><span style={{ color: '#aaa', fontSize: '0.9em' }}>{card.type === CardType.ACTION ? 'ACT' : (card.type === CardType.END_GAME ? 'FIN' : 'MIS')}</span></div>
        {card.description && <div className="seti-card-description" style={{ flex: 1, margin: '4px 0', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', textOverflow: 'ellipsis' }}>{card.description}</div>}
        <div className="seti-card-details" style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: 'auto', fontSize: '0.7em', backgroundColor: 'rgba(0,0,0,0.2)', padding: '2px', borderRadius: '4px' }}><div className="seti-card-detail" style={{ display: 'flex', justifyContent: 'space-between' }}>{card.freeAction && <span>Act: {card.freeAction}</span>}{card.scanSector && <span>Scan: {card.scanSector}</span>}</div><div className="seti-card-detail">{card.revenue && <span>Rev: {card.revenue}</span>}</div></div>
      </div>
    );
  };

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

      {/* Plateau du joueur */}
      <div className="seti-player-panel" style={{ borderTop: `4px solid ${currentPlayer.color || '#444'}`, borderTopLeftRadius: 0, flex: 1, minHeight: 0, maxHeight: 'none' }}>
        {/* Titre */}
        <div className="seti-player-panel-title" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
          <span>
            {currentPlayer.name} {currentPlayer.type === 'robot' ? '🤖' : '👤'} - Score: {currentPlayer.score} PV 🏆
          </span>
          {!isRobot && (
          <button
            onClick={onNextPlayer}
            disabled={!isCurrentTurn || isInteractiveMode}
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
          )}
        </div>
        
        <div className="seti-player-layout" style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', paddingRight: '5px', flex: 1, minHeight: 0 }}>
          {/* Ressources/Revenus */}
          <div style={{ display: 'flex', gap: '10px' }}>
            {/* Ressources */}
            <div className="seti-player-section" style={{ position: 'relative', flex: 1 }}>
              <div className="seti-player-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>Ressources</div>
              <div className="seti-player-resources">
                <div 
                  key={creditFlash ? `credit-${creditFlash.id}` : 'credit-static'}
                  className={`seti-res-badge ${creditFlash ? (creditFlash.type === 'gain' ? 'flash-gain' : 'flash-loss') : ''}`}
                >
                  <span>Crédit (<span style={{color: '#ffd700'}}>₢</span>):</span>
                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
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
                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
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
                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
                  {renderBuyCardButton('🛒', 'Acheter 1 carte de la pioche ou de la rangée principale (cout: 3 Médias)')}
                  <strong style={{ marginLeft: '6px' }}>{currentPlayer.mediaCoverage}</strong>
                  </div>
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
                  <span>Crédit (<span style={{color: '#ffd700'}}>₢</span>):</span> <strong>{currentPlayer.revenueCredits}</strong>
                </div>
                <div 
                  key={revenueEnergyFlash ? `rev-energy-${revenueEnergyFlash.id}` : 'rev-energy-static'}
                  className={`seti-res-badge ${revenueEnergyFlash ? (revenueEnergyFlash.type === 'gain' ? 'flash-gain' : 'flash-loss') : ''}`}
                >
                  <span>Énergie (<span style={{color: '#4caf50'}}>⚡</span>):</span> <strong>{currentPlayer.revenueEnergy}</strong>
                </div>
                <div 
                  key={revenueCardFlash ? `rev-card-${revenueCardFlash.id}` : 'rev-card-static'}
                  className={`seti-res-badge ${revenueCardFlash ? (revenueCardFlash.type === 'gain' ? 'flash-gain' : 'flash-loss') : ''}`}
                >
                  <span>Carte (<span style={{color: '#aaffaa'}}>🃏</span>):</span> <strong>{currentPlayer.revenueCards}</strong>
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
                        cursor: available && onAction ? 'pointer' : 'not-allowed',
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
                Donnée(s) (<span style={{color: '#03a9f4'}}>💾</span>): <strong style={{ color: '#fff' }}>{currentPlayer.data || 0}</strong>
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
          <div className="seti-player-section" style={isReserving ? { 
            position: 'relative', 
            zIndex: 1501
          } : {}}>
            <div className="seti-player-section-title" style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
              <span>Main</span>
              <span 
                key={cardsFlash ? `cards-${cardsFlash.id}` : 'cards-static'}
                className={cardsFlash ? (cardsFlash.type === 'gain' ? 'flash-gain' : 'flash-loss') : ''}
                style={{ fontSize: '0.8em', color: '#aaa', fontWeight: 'normal', padding: '2px 5px', borderRadius: '4px', display: 'flex', alignItems: 'center' }}
              >
                <span>Carte(s) (<span style={{color: '#aaffaa'}}>🃏</span>):</span>
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
              <div style={{ marginBottom: '10px', color: '#ff9800', fontSize: '0.9em' }}>
                Veuillez défausser des cartes pour n'en garder que 4.
                <br />
                Sélectionnées : {selectedCardIds.length} / {Math.max(0, currentPlayer.cards.length - 4)}
                {currentPlayer.cards.length - selectedCardIds.length === 4 && (
                  <button 
                    onClick={onConfirmDiscard}
                    style={{ marginLeft: '10px', cursor: 'pointer', padding: '2px 8px' }}
                  >
                    Confirmer
                  </button>
                )}
              </div>
            )}
            {isTrading && (
              <div style={{ marginBottom: '10px', color: '#ff9800', fontSize: '0.9em' }}>
                Veuillez sélectionner 2 cartes à échanger.
                <br />
                Sélectionnées : {selectedCardIds.length} / 2
                {selectedCardIds.length === 2 && (
                  <button 
                    onClick={onConfirmTrade}
                    style={{ marginLeft: '10px', cursor: 'pointer', padding: '2px 8px' }}
                  >
                    Confirmer
                  </button>
                )}
              </div>
            )}
            {isReserving && (
              <div style={{ marginBottom: '10px', color: '#ff9800', fontSize: '0.9em' }}>
                Veuillez réserver {reservationCount} carte{reservationCount > 1 ? 's' : ''} .
                <br />
                Sélectionnées: {selectedCardIds.length} / {reservationCount}
                {selectedCardIds.length === reservationCount && (
                  <button 
                      onClick={onConfirmReservation}
                      style={{ marginLeft: '10px', cursor: 'pointer', padding: '2px 8px' }}
                    >
                      Confirmer
                    </button>
                )}
              </div>
            )}
            <div className="seti-player-list" style={{ flexDirection: 'row', overflowX: 'auto', paddingBottom: '8px', gap: '8px' }}>
              {!isRobot ? (
                currentPlayer.cards.length > 0 ? (
                  currentPlayer.cards.map(renderHandCard)
                ) : (
                  <div className="seti-player-list-empty">Aucune carte</div>
                )
              ) : (
                <div className="seti-player-list-empty" style={{ fontStyle: 'italic', color: '#aaa' }}>
                  {currentPlayer.cards.length} carte(s) en main (Masqué)
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
