import React from 'react';
import { Bonus, Card, Game, InteractionState, CostType } from '../../core/types';
import { CardSystem } from '../../systems/CardSystem';
import { CardTooltip } from './CardTooltip';
import { ActionTooltip, DiscardSymbol, ResourceSymbols } from './BoardTooltips';
import { ActionHexIcon, DiscardCardIcon } from './GameIcons';
import { freeActionBonus } from './cardBonus';
import { CardFace } from './CardFace';

/**
 * Contenu d'une carte (main, rangée, fenêtres de choix) : miniature de la carte, sans mise en avant (le coin utile se lit
 * sur la carte elle-même) ; `highlightedAttribute` reste accepté par les appelants
 */
export const CardContent: React.FC<{ card: Card, highlightedAttribute: 'revenue' | 'scan' | 'freeAction' }> = ({ card }) => (
  <CardFace card={card} compact />
);

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
  renderActionButton: (icon: React.ReactNode, tooltip: React.ReactNode, onClick: () => void, disabled: boolean, color: string, style: React.CSSProperties, extraClassName: string) => React.ReactNode;
  disableGrayOut?: boolean;
  defaultAttribute?: 'revenue' | 'scan' | 'freeAction';
  defaultClickable?: boolean;
  cardOrigin?: 'hand' | 'row';
  /** Action « Jouer une carte » choisie : la carte est jouable et mise en avant */
  isPlayableFocus?: boolean;
}> = ({ card, game, currentPlayerId, interactionState, highlightedCardId, setHighlightedCardId, onCardClick, onPlayCard, onDiscardCardAction, handleTooltipHover, handleTooltipLeave, renderActionButton, disableGrayOut, defaultAttribute = 'freeAction', defaultClickable = true, cardOrigin = 'hand', isPlayableFocus = false }) => {
    const currentPlayer = game.players.find(p => p.id === currentPlayerId)!;
    const hasPerformedMainAction = currentPlayer.hasPerformedMainAction;
    
    const isDiscarding = interactionState.type === 'DISCARDING_CARD';
    const isTrading = interactionState.type === 'TRADING_CARD';
    const isReserving = interactionState.type === 'RESERVING_CARD';
    const isDiscardingForSignal = interactionState.type === 'DISCARDING_FOR_SIGNAL';
    const isAcquiring = interactionState.type === 'ACQUIRING_CARD';
    const isSelectingScanCard = interactionState.type === 'SELECTING_SCAN_CARD';
    
    const isHighlighted = highlightedCardId === card.id;

    let phaseClass = 'seti-card-idle';
    let isClickable = defaultClickable;

    // Réservation, défausses et échange se choisissent dans une fenêtre centrale : la main reste en affichage normal
    if (isReserving || isDiscarding || isTrading || isDiscardingForSignal) {
      isClickable = false;
    } else if (isAcquiring || isSelectingScanCard) {
      if (cardOrigin === 'row') {
        phaseClass = 'seti-card-interact-mode';
        isClickable = true;
      } else {
        isClickable = false;
      }
    } else {
      if (isHighlighted) phaseClass += ' selected';
      if (isPlayableFocus) phaseClass += ' seti-card-playable-focus';
    }

    const { canDiscard, reason: discardReason } = CardSystem.canDiscardFreeAction(game, currentPlayerId, card.freeAction);
    const { canPlay, reason: playReason } = CardSystem.canPlayCard(game, currentPlayerId, card);
    const canPlayAction = canPlay && !hasPerformedMainAction;
    // Infobulles des boutons : « Jouer une carte » comme l'hexagone de l'action, « Défausser » comme une action gratuite
    const playCost: Bonus = card.costType === CostType.ENERGY ? { energy: card.cost } : { credits: card.cost };
    const playTooltip = (
      <ActionTooltip title="Jouer une carte" cost={card.cost ? <ResourceSymbols bonus={playCost} /> : null} available={canPlayAction}
        hint={canPlayAction ? 'Cliquez pour jouer cette carte' : hasPerformedMainAction ? 'Action principale déjà effectuée' : playReason} />
    );
    const discardGain = freeActionBonus(card.freeAction);
    const discardTooltip = (
      <ActionTooltip title="Défausser une carte" cost={<DiscardSymbol />} bonus={discardGain ? <ResourceSymbols bonus={discardGain} /> : undefined}
        available={canDiscard} hint={canDiscard ? 'Cliquez pour défausser' : discardReason} />
    );

    const isInteractiveMode = isReserving || isDiscarding || isTrading || isDiscardingForSignal || isAcquiring || isSelectingScanCard;
    let shouldGrayOut = !disableGrayOut && !isInteractiveMode && !canPlayAction;

    if (cardOrigin === 'hand' && (isAcquiring || isSelectingScanCard)) {
      shouldGrayOut = true;
    }

    return (
      <div 
        className={`seti-common-card seti-card-wrapper ${phaseClass}`}
        // Carte non sélectionnable : curseur d'aide (son infobulle reste consultable)
        style={shouldGrayOut ? { opacity: 0.7, filter: 'grayscale(0.8)', cursor: 'help'} : { cursor: isClickable ? 'pointer' : 'help'}}
        onMouseEnter={e => handleTooltipHover(e, <CardTooltip card={card} />)}
        onMouseLeave={handleTooltipLeave}
        onClick={_e => {
          if (!isClickable) return;
          if (isInteractiveMode) { onCardClick(card.id); return; }
          setHighlightedCardId(isHighlighted ? null : card.id);
        }}
      >
        {isHighlighted && !isInteractiveMode && (
          <>
          {/* Boutons Jouer et Défausser, en haut à droite de la carte (PlayerBoardUI.css) */}
          {renderActionButton(<ActionHexIcon kind="card" size={16} />, playTooltip, () => { if (canPlayAction) { onPlayCard(card.id); setHighlightedCardId(null); } }, !canPlayAction, '#4a9eff', {}, 'seti-hand-card-play-btn')}
          {renderActionButton(<DiscardCardIcon size={16} />, discardTooltip, () => { if (canDiscard) { onDiscardCardAction(card.id); setHighlightedCardId(null); } }, !canDiscard, '#ff6b6b', {}, 'seti-hand-card-discard-btn')}
          </>
        )}
        <CardContent card={card} highlightedAttribute={defaultAttribute} />
      </div>
    );
};
