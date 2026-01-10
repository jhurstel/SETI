import React, { useState, useEffect, useRef } from 'react';
import { Game, ActionType, GAME_CONSTANTS, FreeAction, ProbeState, Card, RevenueBonus } from '../core/types';
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
}

const ACTION_NAMES: Record<ActionType, string> = {
  [ActionType.LAUNCH_PROBE]: 'Lancer une sonde',
  [ActionType.ORBIT]: 'Mettre en orbite',
  [ActionType.LAND]: 'Poser une sonde',
  [ActionType.SCAN_SECTOR]: 'Scanner un secteur',
  [ActionType.ANALYZE_DATA]: 'Analyser des données',
  [ActionType.PLAY_CARD]: 'Jouer une carte',
  [ActionType.RESEARCH_TECH]: 'Rechercher une technologie',
  [ActionType.PASS]: 'Passer définitivement',
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
      className={`computer-slot ${isFilled ? 'filled' : ''} ${canFill && !isFilled ? 'can-fill' : ''}`}
      title={tooltip}
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

const PlayerComputer = ({ player, onSlotClick, isSelecting, onColumnSelect, isAnalyzing }: { player: any, onSlotClick: (slotId: string) => void, isSelecting?: boolean, onColumnSelect?: (col: number) => void, isAnalyzing?: boolean }) => {
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
                  canFill={DataSystem.canFillSlot(player, slot.id)} 
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

export const PlayerBoardUI: React.FC<PlayerBoardUIProps> = ({ game, playerId, onViewPlayer, onAction, isDiscarding = false, selectedCardIds = [], onCardClick, onConfirmDiscard, onDiscardCardAction, onPlayCard, onBuyCardAction, onTradeResourcesAction, tradeState = { phase: 'inactive' }, onSpendSelection, onGainSelection, onCancelTrade, onGameUpdate, onDrawCard, isSelectingComputerSlot, onComputerSlotSelect, isAnalyzing, hasPerformedMainAction = false, onNextPlayer, onHistory }) => {
  const currentPlayer = playerId 
    ? (game.players.find(p => p.id === playerId) || game.players[game.currentPlayerIndex])
    : game.players[game.currentPlayerIndex];
  
  const isCurrentTurn = game.players[game.currentPlayerIndex].id === currentPlayer.id;
  const isRobot = (currentPlayer as any).type === 'robot';
  const [highlightedCardId, setHighlightedCardId] = useState<string | null>(null);
  const [cardsSelectedForTrade, setCardsSelectedForTrade] = useState<string[]>([]);
  const [tick, setTick] = useState(0);
  const [reservationState, setReservationState] = useState<{ active: boolean; count: number }>({ active: false, count: 0 });
  
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
      setReservationState(prev => ({ active: true, count: prev.count + amount }));
    } else if (type === 'card' && onDrawCard) {
      onDrawCard(amount, 'Bonus Ordinateur');
    }
  };

  const handleComputerSlotClick = (slotId: string) => {
    const { updatedGame, gains, bonusEffects } = DataSystem.fillSlot(game, currentPlayer.id, slotId);
    
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

  const isInteractiveMode = isDiscarding || tradeState.phase !== 'inactive' || isSelectingComputerSlot || isAnalyzing;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
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
               title={isActive ? "Joueur actif" : undefined}
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

    <div className="seti-player-panel" style={{ borderTop: `4px solid ${currentPlayer.color || '#444'}`, borderTopLeftRadius: 0 }}>
      <div className="seti-player-panel-title" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
        <span>
          {currentPlayer.name} {currentPlayer.type === 'robot' ? '🤖' : '👤'} - Score: {currentPlayer.score} PV
        </span>
        <button
            onClick={onNextPlayer}
            disabled={!isCurrentTurn || !hasPerformedMainAction || isInteractiveMode}
            title={hasPerformedMainAction ? "Terminer le tour" : "Effectuez une action principale d'abord"}
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
      
      <div className="seti-player-layout">
        {/* Ressources */}
        <div className="seti-player-section" style={{ position: 'relative' }}>
          <div className="seti-player-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Ressources</span>
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
          <div className="seti-player-section-title">Actions principales</div>
          <div className="seti-player-actions">
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
              onSlotClick={handleComputerSlotClick}
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
                if (isCurrentTurn && canBuyCardAction && onBuyCardAction) {
                  onBuyCardAction();
                }
              }}
              title={canBuyCardAction ? "Vous gagnez 1 carte de la pioche ou de la rangée principale (cout: 3 media)" : "Nécessite 3 couverture médiatique"}
              style={{
                backgroundColor: (isCurrentTurn && canBuyCardAction) ? '#4a9eff' : '#555',
                color: (isCurrentTurn && canBuyCardAction) ? 'white' : '#aaa',
                border: (isCurrentTurn && canBuyCardAction) ? '2px solid #6bb3ff' : '2px solid #444',
                borderRadius: '6px',
                padding: '2px 8px',
                fontSize: '0.7rem',
                cursor: (isCurrentTurn && canBuyCardAction) ? 'pointer' : 'not-allowed',
                fontWeight: 'normal',
                boxShadow: (isCurrentTurn && canBuyCardAction) ? '0 2px 4px rgba(0,0,0,0.3)' : 'none',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                if (!isCurrentTurn || !canBuyCardAction) return;
                const target = e.currentTarget as HTMLButtonElement;
                target.style.backgroundColor = '#6bb3ff';
                target.style.transform = 'scale(1.05)';
              }}
              onMouseLeave={(e) => {
                if (!isCurrentTurn || !canBuyCardAction) return;
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
            {!isRobot ? (
              currentPlayer.cards.length > 0 ? (
                currentPlayer.cards.map((card) => {
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
                    className="seti-player-list-item"
                    onClick={(e) => {
                      if (reservationState.active) {
                        if (card.revenue) {
                          // Retirer la carte de la main
                          currentPlayer.cards = currentPlayer.cards.filter(c => c.id !== card.id);
                          
                          let gainMsg = "";

                          if (card.revenue === RevenueBonus.CREDIT) {
                            currentPlayer.revenueCredits += 1;
                            currentPlayer.credits += 1;
                            gainMsg = "1 Crédit";
                          }
                          else if (card.revenue === RevenueBonus.ENERGY) {
                            currentPlayer.revenueEnergy += 1;
                            currentPlayer.energy += 1;
                            gainMsg = "1 Énergie";
                          }
                          else if (card.revenue === RevenueBonus.CARD) {
                            currentPlayer.revenueCards += 1;
                            gainMsg = "1 Carte";
                          }
                          
                          if (onHistory) {
                            onHistory(`réserve la carte "${card.name}" et gagne immédiatement : ${gainMsg}`);
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
              )
            ) : (
              <div className="seti-player-list-empty" style={{ fontStyle: 'italic', color: '#aaa' }}>
                {currentPlayer.cards.length} carte(s) en main (Masqué)
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    </div>
  );
};
