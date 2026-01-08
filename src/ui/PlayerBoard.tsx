import React, { useState, useEffect, useRef } from 'react';
import { Game, ActionType, GAME_CONSTANTS, FreeAction, ProbeState, Card, RevenueBonus } from '../core/types';
import { ProbeSystem } from '../systems/ProbeSystem';
import { DataSystem } from '../systems/DataSystem';

interface PlayerBoardProps {
  game: Game;
  onAction?: (actionType: ActionType) => void;
  isDiscarding?: boolean;
  selectedCardIds?: string[];
  onCardClick?: (cardId: string) => void;
  onConfirmDiscard?: () => void;
  onFreeAction?: (cardId: string) => void;
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
}

const ACTION_NAMES: Record<ActionType, string> = {
  [ActionType.LAUNCH_PROBE]: 'Lancer une sonde',
  [ActionType.ORBIT]: 'Mettre en orbite',
  [ActionType.LAND]: 'Poser une sonde',
  [ActionType.SCAN_SECTOR]: 'Scanner un secteur',
  [ActionType.ANALYZE_DATA]: 'Analyser des données',
  [ActionType.PLAY_CARD]: 'Jouer une carte',
  [ActionType.RESEARCH_TECH]: 'Rechercher une technologie',
  [ActionType.PASS]: 'Passer',
};

const ComputerSlot = ({ 
  slot, 
  onClick, 
  canFill 
}: { 
  slot: any, 
  onClick: () => void, 
  canFill: boolean 
}) => {
  const isFilled = slot.filled;
  
  let tooltip = 'Emplacement vide';
  if (slot.bonus === 'media') tooltip = '1 Media';
  else if (slot.bonus === 'reservation') tooltip = '1 Reservation';
  else if (slot.bonus === '2pv') tooltip = '2 PV';
  else if (slot.bonus === 'credit') tooltip = '1 Crédit';
  else if (slot.bonus === 'energy') tooltip = '1 Énergie';
  else if (slot.bonus === 'card') tooltip = '1 Carte';

  if (isFilled) {
      tooltip = 'Donnée stockée';
  } else if (canFill) {
      tooltip += ' (Cliquer pour placer)';
  } else {
      tooltip += ' (Indisponible)';
  }
  
  return (
    <div
      onClick={canFill && !isFilled ? onClick : undefined}
      style={{
        width: '32px',
        height: '32px',
        boxSizing: 'border-box',
        border: '1px solid #777',
        backgroundColor: isFilled ? '#4a9eff' : 'transparent',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: canFill && !isFilled ? 'pointer' : 'default',
        position: 'relative',
        boxShadow: isFilled ? '0 0 8px rgba(74, 158, 255, 0.6)' : 'none',
        opacity: !isFilled && !canFill ? 0.4 : 1,
        transition: 'all 0.2s',
      }}
      title={tooltip}
    >
      {isFilled && <div style={{ width: '12px', height: '12px', background: '#fff', borderRadius: '50%', boxShadow: '0 0 4px #fff' }} />}
      {!isFilled && slot.bonus === 'media' && <span style={{ fontSize: '12px', color: '#ffeb3b', fontWeight: 'bold' }}>M</span>}
      {!isFilled && slot.bonus === 'reservation' && <span style={{ fontSize: '12px', color: '#ff6b6b', fontWeight: 'bold' }}>R</span>}
      {!isFilled && slot.bonus === '2pv' && <span style={{ fontSize: '10px', color: '#8affc0', fontWeight: 'bold' }}>2PV</span>}
      {!isFilled && slot.bonus === 'credit' && <span style={{ fontSize: '12px', color: '#4a9eff', fontWeight: 'bold' }}>C</span>}
      {!isFilled && slot.bonus === 'energy' && <span style={{ fontSize: '12px', color: '#ff6b6b', fontWeight: 'bold' }}>E</span>}
      {!isFilled && slot.bonus === 'card' && <span style={{ fontSize: '12px', color: '#fff', fontWeight: 'bold' }}>🃏</span>}
    </div>
  );
};

const PlayerComputer = ({ player, onUpdate, onBonus, isSelecting, onColumnSelect, isAnalyzing }: { player: any, onUpdate: () => void, onBonus: (type: string, amount: number) => void, isSelecting?: boolean, onColumnSelect?: (col: number) => void, isAnalyzing?: boolean }) => {
  // Initialize if needed
  if (!player.computer) {
    player.computer = {
      slots: {
        '1a': { id: '1a', filled: false, type: 'top', col: 1 },
        '1b': { id: '1b', filled: false, type: 'bottom', parentId: '1a', col: 1 },
        '2':  { id: '2', filled: false, type: 'top', bonus: 'media', col: 2 },
        '3a': { id: '3a', filled: false, type: 'top', col: 3 },
        '3b': { id: '3b', filled: false, type: 'bottom', parentId: '3a', col: 3 },
        '4':  { id: '4', filled: false, type: 'top', bonus: 'reservation', col: 4 },
        '5a': { id: '5a', filled: false, type: 'top', col: 5 },
        '5b': { id: '5b', filled: false, type: 'bottom', parentId: '5a', col: 5 },
        '6a': { id: '6a', filled: false, type: 'top', col: 6 },
        '6b': { id: '6b', filled: false, type: 'bottom', parentId: '6a', col: 6 },
      }
    };
  }

  const slots = player.computer.slots;

  const handleSlotClick = (slotId: string) => {
    const slot = slots[slotId];
    if (player.data < 1) return;
    
    player.data -= 1;
    slot.filled = true;
    
    if (slot.bonus === 'media') {
       player.mediaCoverage = Math.min((player.mediaCoverage || 0) + 1, GAME_CONSTANTS.MAX_MEDIA_COVERAGE || 10);
    }
    if (slot.bonus === 'reservation') {
       onBonus('reservation', 1);
    }
    if (slot.bonus === '2pv') {
       player.score += 2;
    }
    if (slot.bonus === 'credit') {
       player.credits += 1;
    }
    if (slot.bonus === 'energy') {
       player.energy += 1;
    }
    if (slot.bonus === 'card') {
       onBonus('card', 1);
    }

    // Si la case 6a est remplie, on active la capacité d'analyse
    if (slotId === '6a' && player.dataComputer) {
      player.dataComputer.canAnalyze = true;
    }
    // Reservation bonus logic would go here
    
    onUpdate();
  };

  const canFill = (slotId: string) => {
    const slot = slots[slotId];
    if (slot.filled) return false;
    if (player.data < 1) return false;
    if (slot.type === 'bottom' && slot.parentId) {
      return slots[slot.parentId].filled;
    }
    // Contrainte horizontale : remplissage de gauche à droite sur la ligne du haut
    if (slot.type === 'top' && slot.col > 1) {
      const prevCol = slot.col - 1;
      const prevTopSlot = Object.values(slots).find((s: any) => s.col === prevCol && s.type === 'top') as any;
      if (prevTopSlot && !prevTopSlot.filled) return false;
    }
    return true;
  };

  const columns = [1, 2, 3, 4, 5, 6];

  return (
    <div style={{ display: 'flex', padding: '12px 24px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', overflowX: 'auto', width: '100%', boxSizing: 'border-box', alignItems: 'flex-start', position: 'relative', overflow: 'hidden' }} className={isAnalyzing ? 'analyzing-container' : ''}>
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
              style={{ 
                display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center', position: 'relative', zIndex: 1,
                border: isSelectableColumn ? '1px solid #00ff00' : (hasBottom ? '1px solid #555' : '1px solid transparent'),
                borderRadius: '8px',
                padding: hasBottom ? '4px 12px' : '4px',
                cursor: isSelectableColumn ? 'pointer' : 'default',
                backgroundColor: isSelectableColumn ? 'rgba(0, 255, 0, 0.1)' : 'transparent'
              }}>
              {/* Ligne verticale reliant haut et bas */}
              {hasBottom && (
                <div style={{
                  position: 'absolute',
                  top: '36px',
                  height: '8px',
                  width: '2px',
                  backgroundColor: '#555',
                  zIndex: 0
                }} />
              )}
              {colSlots.map((slot: any) => (
                <ComputerSlot 
                  key={slot.id} 
                  slot={slot} 
                  onClick={() => handleSlotClick(slot.id)} 
                  canFill={canFill(slot.id)} 
                />
              ))}
            </div>
            {index < columns.length - 1 && (
              <div style={{
                flex: 1,
                height: '2px',
                backgroundColor: '#555',
                marginTop: '20px',
                minWidth: '10px',
                marginLeft: separatorLeftMargin,
                marginRight: separatorRightMargin,
                zIndex: 0,
                position: 'relative'
              }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

export const PlayerBoard: React.FC<PlayerBoardProps> = ({ game, onAction, isDiscarding = false, selectedCardIds = [], onCardClick, onConfirmDiscard, onFreeAction, onPlayCard, onBuyCardAction, onTradeResourcesAction, tradeState = { phase: 'inactive' }, onSpendSelection, onGainSelection, onCancelTrade, onGameUpdate, onDrawCard, isSelectingComputerSlot, onComputerSlotSelect, isAnalyzing }) => {
  const currentPlayer = game.players[game.currentPlayerIndex];
  const isRobot = (currentPlayer as any).type === 'robot';
  const [highlightedCardId, setHighlightedCardId] = useState<string | null>(null);
  const [cardsSelectedForTrade, setCardsSelectedForTrade] = useState<string[]>([]);
  const [tick, setTick] = useState(0);
  const [reservationState, setReservationState] = useState<{ active: boolean; count: number }>({ active: false, count: 0 });

  // Effect to reset selection when exiting trading mode
  useEffect(() => {
    if (tradeState.phase === 'inactive') {
      setCardsSelectedForTrade([]);
    }
  }, [tradeState.phase]);

  const handleComputerBonus = (type: string, amount: number) => {
    if (type === 'reservation') {
      setReservationState(prev => ({ active: true, count: prev.count + amount }));
    } else if (type === 'card' && onDrawCard) {
      onDrawCard(amount, 'Bonus Ordinateur');
    }
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

  // Styles d'animation injectés
  const FlashStyles = () => (
    <style>{`
      @keyframes flashGreen {
        0% { background-color: rgba(80, 255, 80, 0.6); box-shadow: 0 0 10px rgba(0, 255, 0, 0.5); }
        100% { background-color: transparent; box-shadow: none; }
      }
      @keyframes flashRed {
        0% { background-color: rgba(255, 80, 80, 0.6); box-shadow: 0 0 10px rgba(255, 0, 0, 0.5); }
        100% { background-color: transparent; box-shadow: none; }
      }
      .flash-gain { animation: flashGreen 0.6s ease-out; }
      .flash-loss { animation: flashRed 0.6s ease-out; }

      /* Animation de scan pour l'ordinateur */
      @keyframes scan-horizontal {
        0% { left: -20%; opacity: 0; }
        10% { opacity: 1; }
        90% { opacity: 1; }
        100% { left: 120%; opacity: 0; }
      }
      .scan-line {
        position: absolute;
        top: 0;
        bottom: 0;
        width: 60px;
        background: linear-gradient(90deg, transparent, rgba(0, 255, 255, 0.6), transparent);
        box-shadow: 0 0 20px rgba(0, 255, 255, 0.4);
        animation: scan-horizontal 1.5s ease-in-out infinite;
        pointer-events: none;
        z-index: 20;
      }
      .analyzing-container {
        box-shadow: 0 0 15px rgba(0, 255, 255, 0.3);
        border: 1px solid rgba(0, 255, 255, 0.5) !important;
        transition: all 0.3s ease;
      }
    `}</style>
  );

  const hasProbeOnPlanetInfo = ProbeSystem.probeOnPlanetInfo(game, currentPlayer.id);
  const hasProbesInSystem = (currentPlayer.probes || []).some(p => p.state === ProbeState.IN_SOLAR_SYSTEM);

  const actionAvailability: Record<ActionType, boolean> = {
    [ActionType.LAUNCH_PROBE]: !isRobot && ProbeSystem.canLaunchProbe(game, currentPlayer.id).canLaunch,
    [ActionType.ORBIT]: !isRobot && currentPlayer.probes.some(probe => ProbeSystem.canOrbit(game, currentPlayer.id, probe.id).canOrbit),
    [ActionType.LAND]: !isRobot && currentPlayer.probes.some(probe => ProbeSystem.canLand(game, currentPlayer.id, probe.id).canLand),
    [ActionType.SCAN_SECTOR]: !isRobot && false, // TODO
    [ActionType.ANALYZE_DATA]: !isRobot && DataSystem.canAnalyzeData(game, currentPlayer.id).canAnalyze,
    [ActionType.PLAY_CARD]: !isRobot && false, // TODO
    [ActionType.RESEARCH_TECH]: !isRobot && currentPlayer.mediaCoverage >= GAME_CONSTANTS.TECH_RESEARCH_COST_MEDIA,
    [ActionType.PASS]: !isRobot,
  };

  // Fonction helper pour générer le tooltip basé sur l'état du jeu (Interaction Engine -> UI)
  const getActionTooltip = (actionType: ActionType, available: boolean): string => {
    // Si l'action est disponible, on peut retourner une description simple ou rien
    if (available) {
       // On pourrait ajouter des descriptions génériques ici si voulu
       return ACTION_NAMES[actionType];
    }

    switch (actionType) {
      case ActionType.LAUNCH_PROBE:
        // si joueur a exploration1, il peut lancer 2 sondes
        const maxProbes = currentPlayer.technologies.some(tech => tech.id.startsWith('exploration-1'))
          ? GAME_CONSTANTS.MAX_PROBES_PER_SYSTEM_WITH_TECHNOLOGY
          : GAME_CONSTANTS.MAX_PROBES_PER_SYSTEM;
        if (currentPlayer.probes.length >= maxProbes) return `Limite de sondes atteinte (max ${maxProbes} dans le système solaire)`;
        if (currentPlayer.credits < 2) return `Nécessite 2 crédits (vous avez ${currentPlayer.credits})`;
        return 'Lancer une sonde depuis la Terre (coût: 2 crédits)';

      case ActionType.ORBIT:
        if (!hasProbeOnPlanetInfo.hasProbe) return 'Nécessite une sonde sur une planète autre que la Terre';
        if (currentPlayer.credits < 1) return `Nécessite 1 crédit (vous avez ${currentPlayer.credits})`;
        if (currentPlayer.energy < 1) return `Nécessite 1 énergie (vous avez ${currentPlayer.energy})`;
        return 'Mettre une sonde en orbite (coût: 1 crédit, 1 énergie)';
      
      case ActionType.LAND:
        if (!hasProbeOnPlanetInfo.hasProbe) return 'Nécessite une sonde sur une planète autre que la Terre';
        const cost = hasProbeOnPlanetInfo.landCost || 0;
        if (currentPlayer.credits < cost) {
          return `Nécessite ${cost} crédit(s) (vous avez ${currentPlayer.credits})${hasProbeOnPlanetInfo.hasExploration3 ? ' [Réduction exploration 3 appliquée]' : ''}`;
        }
        return `Poser une sonde sur une planète (coût: ${cost} crédit(s)${hasProbeOnPlanetInfo.hasOrbiter ? ', orbiteur présent' : ''}${hasProbeOnPlanetInfo.hasExploration3 ? ', réduction exploration 3' : ''})`;

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
        if (currentPlayer.mediaCoverage < 6) return `Nécessite 6 points de couverture médiatique (vous avez ${currentPlayer.mediaCoverage})`;
        return 'Rechercher une technologie (coût: 6 couverture médiatique)';

      case ActionType.PLAY_CARD:
        return currentPlayer.cards.length === 0 ? 'Aucune carte en main' : 'Jouer une carte de votre main';
      
      default:
        return '';
    }
  };

  const checkCanPlayCard = (card: Card) => {
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
    <div className="seti-player-panel" style={{ borderTop: `4px solid ${currentPlayer.color || '#444'}` }}>
      <div className="seti-player-panel-title" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
        <span>
          Plateau Joueur - {currentPlayer.name} {currentPlayer.type === 'robot' ? '🤖' : '👤'} - Score: {currentPlayer.score} PV
        </span>
      </div>
      
      <div className="seti-player-layout">
        <FlashStyles />
        {/* Ressources */}
        <div className="seti-player-section" style={{ position: 'relative' }}>
          <div className="seti-player-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Ressources</span>
            {tradeState.phase === 'inactive' ? (
              <button
                onClick={onTradeResourcesAction}
                disabled={!canStartTrade}
                title={canStartTrade ? "Echanger 2 ressources identiques contre 1 ressource" : "Nécessite 2 ressources identiques"}
                style={{
                  backgroundColor: canStartTrade ? '#4a9eff' : '#555',
                  color: canStartTrade ? 'white' : '#aaa',
                  border: canStartTrade ? '1px solid #6bb3ff' : '1px solid #444',
                  borderRadius: '6px', padding: '2px 8px', fontSize: '0.7rem', cursor: canStartTrade ? 'pointer' : 'not-allowed',
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

          {tradeState.phase === 'gaining' && (
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(30, 40, 60, 0.95)', zIndex: 10,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: '10px', padding: '10px', borderRadius: '6px'
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
              <span>Média:</span> <strong>{currentPlayer.mediaCoverage}</strong>
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

        {/* Actions */}
        <div className="seti-player-section">
          <div className="seti-player-section-title">Actions</div>
          <div className="seti-player-actions">
            {Object.entries(ACTION_NAMES)
              .filter(([action]) => action)
              .map(([action, name]) => {
                const available = actionAvailability[action as ActionType];
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
                    title={tooltip}
                  >
                    {name}
                  </div>
                );
              })}
          </div>
        </div>

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
              onUpdate={() => {
                setTick(t => t + 1);
                if (onGameUpdate) onGameUpdate({ ...game });
              }}
              onBonus={handleComputerBonus}
              isSelecting={isSelectingComputerSlot}
              onColumnSelect={onComputerSlotSelect}
              isAnalyzing={isAnalyzing}
            />
          </div>
        </div>

        {/* Cartes */}
        <div className="seti-player-section">
          <div className="seti-player-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Cartes</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (canBuyCardAction && onBuyCardAction) {
                  onBuyCardAction();
                }
              }}
              title={canBuyCardAction ? "Vous gagnez 1 carte de la pioche ou de la rangée principale (cout: 3 media)" : "Nécessite 3 couverture médiatique"}
              style={{
                backgroundColor: canBuyCardAction ? '#4a9eff' : '#555',
                color: canBuyCardAction ? 'white' : '#aaa',
                border: canBuyCardAction ? '2px solid #6bb3ff' : '2px solid #444',
                borderRadius: '6px',
                padding: '2px 8px',
                fontSize: '0.7rem',
                cursor: canBuyCardAction ? 'pointer' : 'not-allowed',
                fontWeight: 'normal',
                boxShadow: canBuyCardAction ? '0 2px 4px rgba(0,0,0,0.3)' : 'none',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                if (!canBuyCardAction) return;
                const target = e.currentTarget as HTMLButtonElement;
                target.style.backgroundColor = '#6bb3ff';
                target.style.transform = 'scale(1.05)';
              }}
              onMouseLeave={(e) => {
                if (!canBuyCardAction) return;
                const target = e.currentTarget as HTMLButtonElement;
                target.style.backgroundColor = '#4a9eff';
                target.style.transform = 'scale(1)';
              }}
            >
              Acheter
            </button>
          </div>
          {isDiscarding && (
            <div style={{ marginBottom: '10px', color: '#ff6b6b', fontSize: '0.9em' }}>
              Veuillez défausser des cartes pour n'en garder que 4.
              <br />
              Sélectionnées : {selectedCardIds.length} / {Math.max(0, currentPlayer.cards.length - 4)}
              {currentPlayer.cards.length - selectedCardIds.length === 4 && (
                <button 
                  onClick={onConfirmDiscard}
                  style={{ marginLeft: '10px', cursor: 'pointer', padding: '2px 8px' }}
                >
                  Confirmer la défausse
                </button>
              )}
            </div>
          )}
          <div className="seti-player-list">
            {currentPlayer.cards.length > 0 ? (
              currentPlayer.cards.map((card) => {
                const isSelectedForDiscard = selectedCardIds.includes(card.id);
                const isSelectedForTrade = cardsSelectedForTrade.includes(card.id);
                const isHighlighted = highlightedCardId === card.id;
                const isMovementAction = card.freeAction === FreeAction.MOVEMENT;
                const isDataAction = card.freeAction === FreeAction.DATA;
                const isMediaAction = card.freeAction === FreeAction.MEDIA;
                
                let canPerformFreeAction = true;
                let actionTooltip = "";

                if (isMovementAction) {
                  if (!hasProbesInSystem) {
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
                    className="seti-player-list-item"
                    onClick={(e) => {
                      if (reservationState.active) {
                        if (card.revenue) {
                          // Retirer la carte de la main
                          currentPlayer.cards = currentPlayer.cards.filter(c => c.id !== card.id);
                          
                          if (card.revenue === RevenueBonus.CREDIT) {
                            currentPlayer.revenueCredits += 1;
                            currentPlayer.credits += 1;
                          }
                          else if (card.revenue === RevenueBonus.ENERGY) {
                            currentPlayer.revenueEnergy += 1;
                            currentPlayer.energy += 1;
                          }
                          else if (card.revenue === RevenueBonus.CARD) {
                            currentPlayer.revenueCards += 1;
                          }
                          
                          const newCount = reservationState.count - 1;
                          setReservationState({ active: newCount > 0, count: newCount });
                          
                          // Mettre à jour l'affichage et le jeu
                          setTick(t => t + 1);
                          
                          if (card.revenue === RevenueBonus.CARD && onDrawCard) {
                            onDrawCard(1, 'Bonus immédiat réservation');
                          } else {
                            if (onGameUpdate) onGameUpdate({ ...game });
                          }
                        } else {
                          alert("Cette carte n'a pas de bonus de revenu.");
                        }
                        return;
                      }

                      if (tradeState.phase === 'spending' && canSpendCards) {
                        if (isSelectedForTrade) {
                          setCardsSelectedForTrade(prev => prev.filter(id => id !== card.id));
                        } else if (cardsSelectedForTrade.length < 2) {
                          setCardsSelectedForTrade(prev => [...prev, card.id]);
                        }
                        // Déclencher l'échange si 2 cartes sont sélectionnées
                        const newSelection = isSelectedForTrade 
                          ? cardsSelectedForTrade.filter(id => id !== card.id)
                          : [...cardsSelectedForTrade, card.id];
                        if (newSelection.length === 2 && onSpendSelection) {
                          onSpendSelection('card', newSelection);
                        }
                      } else if (isDiscarding && onCardClick) {
                        onCardClick(card.id);
                      } else {
                        setHighlightedCardId(isHighlighted ? null : card.id);
                      }
                    }}
                    style={{
                      cursor: 'pointer',
                      border: tradeState.phase === 'spending' && canSpendCards
                        ? (isSelectedForTrade ? '2px solid #ffeb3b' : '1px solid #ffeb3b')
                        : (reservationState.active ? '2px solid #ff9800' : isDiscarding 
                          ? (isSelectedForDiscard ? '1px solid #ff6b6b' : '1px solid #444')
                          : (isHighlighted ? '1px solid #4a9eff' : '1px solid #444')),
                      backgroundColor: isDiscarding
                        ? (isSelectedForDiscard ? 'rgba(255, 107, 107, 0.1)' : 'transparent')
                        : (isHighlighted ? 'rgba(74, 158, 255, 0.1)' : 'transparent'),
                      transition: 'all 0.2s ease',
                      position: 'relative',
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
                          if (canPerformFreeAction && onFreeAction) {
                            onFreeAction(card.id);
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
                    <div className="seti-card-name">{card.name} ({card.type})</div>
                    {card.description && (
                      <div className="seti-card-description">{card.description}</div>
                    )}
                    <div className="seti-card-details" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px', marginTop: '4px' }}>
                      <div className="seti-card-detail">
                        {card.freeAction && <><strong>Action:</strong> {card.freeAction}</>}
                      </div>
                      <div className="seti-card-detail">
                        {card.scanSector && <><strong>Scan:</strong> {card.scanSector}</>}
                      </div>
                      <div className="seti-card-detail">
                        {card.revenue && <><strong>Revenu:</strong> {card.revenue}</>}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="seti-player-list-empty">Aucune carte</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
