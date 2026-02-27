import React from 'react';
import { Card, Game, InteractionState, CostType, CardType, RevenueType } from '../../core/types';
import { CardSystem } from '../../systems/CardSystem';
import { CardTooltip } from './CardTooltip';
import { FREE_ACTION_STYLES, SECTOR_STYLES, REVENUE_STYLES } from '../styles/celestialStyles';

const CardContent: React.FC<{ card: Card, highlightedAttribute: 'revenue' | 'scan' | 'freeAction' }> = ({ card, highlightedAttribute }) => {
  let bottomLabel = '';
  let bottomValue = '';
  let bottomStyle = { color: '#fff', borderColor: '#fff', bgColor: 'rgba(255, 255, 255, 0.1)' };
  let details: React.ReactNode = null;

  if (highlightedAttribute === 'revenue') {
    bottomLabel = 'Réservation';
    bottomValue = card.revenue;
    if (card.revenue && REVENUE_STYLES[card.revenue]) bottomStyle = REVENUE_STYLES[card.revenue];
    details = (
      <>
        {card.freeAction && <div>Act: {card.freeAction}</div>}
        {card.scanSector && <div>Scan: {card.scanSector}</div>}
      </>
    );
  } else if (highlightedAttribute === 'scan') {
    bottomLabel = 'Signal';
    bottomValue = card.scanSector;
    if (card.scanSector && SECTOR_STYLES[card.scanSector]) bottomStyle = SECTOR_STYLES[card.scanSector];
    details = (
      <>
        {card.freeAction && <div>Act: {card.freeAction}</div>}
        {card.revenue && <div>Rev: {card.revenue}</div>}
      </>
    );
  } else {
    bottomLabel = 'Action gratuite';
    bottomValue = card.freeAction;
    if (card.freeAction && FREE_ACTION_STYLES[card.freeAction]) bottomStyle = FREE_ACTION_STYLES[card.freeAction];
    details = (
      <>
        {card.revenue && <div>Rev: {card.revenue}</div>}
        {card.scanSector && <div>Scan: {card.scanSector}</div>}
      </>
    );
  }

  const { color, borderColor, bgColor } = bottomStyle;

  return (
    <>
      <div className="seti-card-name" style={{ fontSize: '0.75rem', lineHeight: '1.1', marginBottom: '4px', height: '2.2em', overflow: 'hidden' }}><span>{card.name}</span></div>
      <div style={{ fontSize: '0.75em', marginTop: '2px', display: 'flex', justifyContent: 'space-between' }}><span style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '0 4px', borderRadius: '4px' }}>Coût: <span style={{ color: card.costType === CostType.ENERGY ? '#4caf50' : '#ffd700' }}>{card.cost}{card.costType === CostType.ENERGY ? '⚡' : ''}</span></span><span style={{ color: '#aaa', fontSize: '0.9em' }}>{card.type === CardType.ACTION ? 'ACT' : (card.type === CardType.END_GAME ? 'FIN' : 'MIS')}</span></div>
      {card.description && <div className="seti-card-description" style={{ fontSize: '0.7em', color: '#ccc', fontStyle: 'italic', lineHeight: '1.2', flex: 1, margin: '4px 0', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', textOverflow: 'ellipsis' }}>{card.description}</div>}
      <div className="seti-card-details" style={{ display: 'flex', flexDirection: 'row', gap: '8px', marginTop: 'auto', fontSize: '0.7em', backgroundColor: 'rgba(0,0,0,0.2)', padding: '2px', borderRadius: '4px', justifyContent: 'space-between' }}>
        {details}
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: `2px solid ${borderColor}`, borderRadius: '8px', backgroundColor: bgColor, margin: '4px 0', padding: '4px' }}>
        <div style={{ fontSize: '0.7em', textTransform: 'uppercase', color: (highlightedAttribute === 'revenue' && card.revenue === RevenueType.CARD) ? '#333' : '#ddd', marginBottom: '2px' }}>{bottomLabel}</div>
        <div style={{ fontSize: '1.1em', fontWeight: 'bold', color: color, textAlign: 'center' }}>{bottomValue || 'Aucun'}</div>
      </div>
    </>
  );
};

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
  disableGrayOut?: boolean;
  defaultAttribute?: 'revenue' | 'scan' | 'freeAction';
  defaultClickable?: boolean;
  cardOrigin?: 'hand' | 'row';
}> = ({ card, game, currentPlayerId, interactionState, highlightedCardId, setHighlightedCardId, onCardClick, onPlayCard, onDiscardCardAction, handleTooltipHover, handleTooltipLeave, renderActionButton, disableGrayOut, defaultAttribute = 'freeAction', defaultClickable = true, cardOrigin = 'hand' }) => {
    const currentPlayer = game.players.find(p => p.id === currentPlayerId)!;
    const hasPerformedMainAction = currentPlayer.hasPerformedMainAction;
    
    const isDiscarding = interactionState.type === 'DISCARDING_CARD';
    const isTrading = interactionState.type === 'TRADING_CARD';
    const isReserving = interactionState.type === 'RESERVING_CARD';
    const isDiscardingForSignal = interactionState.type === 'DISCARDING_FOR_SIGNAL';
    const isAcquiring = interactionState.type === 'ACQUIRING_CARD';
    const isSelectingScanCard = interactionState.type === 'SELECTING_SCAN_CARD';
    
    const selectedCardIds = (isDiscarding || isTrading || isReserving || isDiscardingForSignal) ? interactionState.selectedCards : [];
    const reservationCount = isReserving ? interactionState.count : 0;
    const discardForSignalCount = isDiscardingForSignal ? interactionState.count : 0;

    const isSelected = selectedCardIds.includes(card.id);
    const isHighlighted = highlightedCardId === card.id;

    let phaseClass = 'seti-card-idle';
    let isClickable = defaultClickable;

    if (isReserving) {
      phaseClass = 'seti-card-interact-mode';
      isClickable = true;
      if (isSelected) {
        phaseClass += ' selected';
      } else if (selectedCardIds.length === reservationCount) {
        phaseClass += ' disabled';
        isClickable = false;
      }
    } else if (isDiscarding) {
      phaseClass = 'seti-card-interact-mode';
      isClickable = true;
      if (isSelected) {
        phaseClass += ' selected';
      } else if (currentPlayer.cards.length - selectedCardIds.length === 4) {
        phaseClass += ' disabled';
        isClickable = false;
      }
    } else if (isTrading) {
      phaseClass = 'seti-card-interact-mode';
      isClickable = true;
      if (isSelected) {
        phaseClass += ' selected';
      } else if (selectedCardIds.length >= 2) {
        phaseClass += ' disabled';
        isClickable = false;
      }
    } else if (isDiscardingForSignal) {
      phaseClass = 'seti-card-interact-mode';
      isClickable = true;
      if (isSelected) {
        phaseClass += ' selected';
      } else if (selectedCardIds.length >= (discardForSignalCount || 0) && !isSelected) {
        phaseClass += ' disabled';
        isClickable = false;
      }
    } else if (isAcquiring || isSelectingScanCard) {
      if (cardOrigin === 'row') {
        phaseClass = 'seti-card-interact-mode';
        isClickable = true;
      } else {
        isClickable = false;
      }
    } else {
      if (isHighlighted) phaseClass += ' selected';
    }

    const { canDiscard, reason: discardTooltip } = CardSystem.canDiscardFreeAction(game, currentPlayerId, card.freeAction);
    const { canPlay, reason: playTooltip } = CardSystem.canPlayCard(game, currentPlayerId, card);
    const canPlayAction = canPlay && !hasPerformedMainAction;
    const effectivePlayTooltip = hasPerformedMainAction ? "Action principale déjà effectuée" : playTooltip;

    const isInteractiveMode = isReserving || isDiscarding || isTrading || isDiscardingForSignal || isAcquiring || isSelectingScanCard;
    let shouldGrayOut = !disableGrayOut && !isInteractiveMode && !canPlayAction;

    if (cardOrigin === 'hand' && (isAcquiring || isSelectingScanCard)) {
      shouldGrayOut = true;
    }

    return (
      <div 
        className={`seti-common-card seti-card-wrapper ${phaseClass}`}
        style={shouldGrayOut ? { opacity: 0.7, filter: 'grayscale(0.8)', cursor: 'default'} : { cursor: isClickable ? 'pointer' : 'default'}}
        onMouseEnter={e => handleTooltipHover(e, <CardTooltip card={card} />)}
        onMouseLeave={handleTooltipLeave}
        onClick={_e => {
          if (!isClickable) return;
          if (isReserving || isTrading || isDiscarding || isDiscardingForSignal) { onCardClick(card.id); return; }
          if (isInteractiveMode) { onCardClick(card.id); return; }
          setHighlightedCardId(isHighlighted ? null : card.id);
        }}
      >
        {isHighlighted && !isInteractiveMode && (
          <>
          {renderActionButton('▶️', effectivePlayTooltip, () => { if (canPlayAction) { onPlayCard(card.id); setHighlightedCardId(null); } }, !canPlayAction, '#4a9eff', { position: 'absolute', top: '5px', right: '40px', zIndex: 10 } as React.CSSProperties)}
          {renderActionButton('🗑️', discardTooltip, () => { if (canDiscard) { onDiscardCardAction(card.id); setHighlightedCardId(null); } }, !canDiscard, '#ff6b6b', { position: 'absolute', top: '5px', right: '5px', zIndex: 10 } as React.CSSProperties)}
          </>
        )}
        {isReserving ? (
          <CardContent card={card} highlightedAttribute="revenue" />
        ) : (isDiscardingForSignal || isSelectingScanCard) ? (
          <CardContent card={card} highlightedAttribute="scan" />
        ) : (
          <CardContent card={card} highlightedAttribute={defaultAttribute} />
        )}
      </div>
    );
};
