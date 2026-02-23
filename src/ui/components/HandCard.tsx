import React from 'react';
import { Card, Game, InteractionState, CostType, CardType, RevenueType } from '../../core/types';
import { CardSystem } from '../../systems/CardSystem';
import { CardTooltip } from './CardTooltip';
import { FREE_ACTION_STYLES, SECTOR_STYLES, REVENUE_STYLES } from '../styles/celestialStyles';

export const HandCard: React.FC<{
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

    const isInteractiveMode = isReserving || isDiscarding || isTrading || isDiscardingForSignal;
    const shouldGrayOut = !isInteractiveMode && !canPlayAction;

    return (
      <div 
        className={`seti-common-card seti-card-wrapper ${phaseClass}`}
        style={shouldGrayOut ? { opacity: 0.7, filter: 'grayscale(0.8)' } : {}}
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
            <div style={{ fontSize: '0.75em', marginTop: '2px', display: 'flex', justifyContent: 'space-between' }}><span style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '0 4px', borderRadius: '4px' }}>Coût: <span style={{ color: card.costType === CostType.ENERGY ? '#4caf50' : '#ffd700' }}>{card.cost}{card.costType === CostType.ENERGY ? '⚡' : ''}</span></span><span style={{ color: '#aaa', fontSize: '0.9em' }}>{card.type === CardType.ACTION ? 'ACT' : (card.type === CardType.END_GAME ? 'FIN' : 'MIS')}</span></div>
            {card.description && <div className="seti-card-description" style={{ flex: 1, margin: '4px 0', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', textOverflow: 'ellipsis' }}>{card.description}</div>}
            <div className="seti-card-details" style={{ display: 'flex', flexDirection: 'row', gap: '8px', marginTop: 'auto', fontSize: '0.7em', backgroundColor: 'rgba(0,0,0,0.2)', padding: '2px', borderRadius: '4px', justifyContent: 'space-between' }}>
                {card.freeAction && <div>Act: {card.freeAction}</div>}
                {card.scanSector && <div>Scan: {card.scanSector}</div>}
            </div>

            {(() => {
                const style = (card.revenue && REVENUE_STYLES[card.revenue]) || {
                    color: '#fff',
                    borderColor: '#fff',
                    bgColor: 'rgba(255, 255, 255, 0.1)'
                };
                const { color, borderColor, bgColor } = style;

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
            <div style={{ fontSize: '0.75em', marginTop: '2px', display: 'flex', justifyContent: 'space-between' }}><span style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '0 4px', borderRadius: '4px' }}>Coût: <span style={{ color: card.costType === CostType.ENERGY ? '#4caf50' : '#ffd700' }}>{card.cost}{card.costType === CostType.ENERGY ? '⚡' : ''}</span></span><span style={{ color: '#aaa', fontSize: '0.9em' }}>{card.type === CardType.ACTION ? 'ACT' : (card.type === CardType.END_GAME ? 'FIN' : 'MIS')}</span></div>
            {card.description && <div className="seti-card-description" style={{ flex: 1, margin: '4px 0', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', textOverflow: 'ellipsis' }}>{card.description}</div>}
            <div className="seti-card-details" style={{ display: 'flex', flexDirection: 'row', gap: '8px', marginTop: 'auto', fontSize: '0.7em', backgroundColor: 'rgba(0,0,0,0.2)', padding: '2px', borderRadius: '4px', justifyContent: 'space-between' }}>
                {card.freeAction && <div>Act: {card.freeAction}</div>}
                {card.revenue && <div>Rev: {card.revenue}</div>}
            </div>

            {(() => {
                const style = (card.scanSector && SECTOR_STYLES[card.scanSector]) || {
                    color: '#fff',
                    borderColor: '#fff',
                    bgColor: 'rgba(255, 255, 255, 0.1)'
                };
                const { color, borderColor, bgColor } = style;

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
            <div style={{ fontSize: '0.75em', marginTop: '2px', display: 'flex', justifyContent: 'space-between' }}><span style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '0 4px', borderRadius: '4px' }}>Coût: <span style={{ color: card.costType === CostType.ENERGY ? '#4caf50' : '#ffd700' }}>{card.cost}{card.costType === CostType.ENERGY ? '⚡' : ''}</span></span><span style={{ color: '#aaa', fontSize: '0.9em' }}>{card.type === CardType.ACTION ? 'ACT' : (card.type === CardType.END_GAME ? 'FIN' : 'MIS')}</span></div>
            {card.description && <div className="seti-card-description" style={{ flex: 1, margin: '4px 0', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', textOverflow: 'ellipsis' }}>{card.description}</div>}
            <div className="seti-card-details" style={{ display: 'flex', flexDirection: 'row', gap: '8px', marginTop: 'auto', fontSize: '0.7em', backgroundColor: 'rgba(0,0,0,0.2)', padding: '2px', borderRadius: '4px', justifyContent: 'space-between' }}>
                {card.revenue && <div>Rev: {card.revenue}</div>}
                {card.scanSector && <div>Scan: {card.scanSector}</div>}
            </div>

            {(() => {
                const style = (card.freeAction && FREE_ACTION_STYLES[card.freeAction]) || {
                    color: '#fff',
                    borderColor: '#fff',
                    bgColor: 'rgba(255, 255, 255, 0.1)'
                };
                const { color, borderColor, bgColor } = style;

                return (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: `2px solid ${borderColor}`, borderRadius: '8px', backgroundColor: bgColor, margin: '4px 0', padding: '4px' }}>
                      <div style={{ fontSize: '0.7em', textTransform: 'uppercase', color: '#ddd', marginBottom: '2px' }}>Action gratuite</div>
                      <div style={{ fontSize: '1.1em', fontWeight: 'bold', color: color, textAlign: 'center' }}>{card.freeAction || 'Aucun'}</div>
                    </div>
                );
            })()}
          </>
        )}
      </div>
    );
};
