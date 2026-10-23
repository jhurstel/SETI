import React, { useState, useEffect } from 'react';
import { Game, InteractionState } from '../core/types';
import { HandCard } from './components/HandCard';
import './CardRowUI.css';

interface CardRowUIProps {
    game: Game;
    interactionState: InteractionState;
    onCardClick: (cardId?: string) => void;
    setActiveTooltip: (tooltip: { content: React.ReactNode, rect: DOMRect } | null) => void;
}

export const CardRowUI: React.FC<CardRowUIProps> = ({ game, interactionState, onCardClick, setActiveTooltip }) => {
    const isActive = interactionState.type === 'ACQUIRING_CARD' || interactionState.type === 'SELECTING_SCAN_CARD';
    const isInitiallyOpen = interactionState.type === 'ACQUIRING_CARD' || interactionState.type === 'SELECTING_SCAN_CARD';
    const [isOpen, setIsOpen] = useState(isInitiallyOpen);

    useEffect(() => {
        setIsOpen(isInitiallyOpen);
    }, [isInitiallyOpen]);

    const currentPlayer = game.players[game.currentPlayerIndex];

    const handleTooltipHover = (e: React.MouseEvent, content: React.ReactNode) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setActiveTooltip({ content, rect });
    };

    const handleTooltipLeave = () => {
        setActiveTooltip(null);
    };

    return (
        <div className={`seti-foldable-container seti-icon-panel seti-card-row-container ${isOpen ? 'open' : 'collapsed'} ${isActive ? 'active' : ''}`}
        >
            <div className="seti-foldable-header" onClick={() => setIsOpen(!isOpen)}>
                <span className="panel-icon">🃏</span>
                <span className="panel-title">Rangée Principale</span>
            </div>
            <div className="seti-foldable-content">
                <div className="seti-card-row-content">
                    {/* Pile de pioche */}
                    <div
                        onClick={() => onCardClick(undefined)}
                        className={`seti-common-card seti-deck-card ${interactionState.type === 'ACQUIRING_CARD' ? 'active' : ''}`}
                        onMouseEnter={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setActiveTooltip({ content: <div>{game.decks.cards?.length || 0} cartes restantes</div>, rect });
                        }}
                        onMouseLeave={handleTooltipLeave}
                    >
                        <div className="seti-deck-label">Pioche</div>
                        <div className="seti-deck-count">{game.decks.cards.length || 0} cartes</div>
                    </div>

                    {/* Ligne de cartes */}
                    {game.decks.cardRow && game.decks.cardRow.map(card => (
                        <div key={card.id} className="seti-row-card-wrapper">
                            <HandCard
                                card={card}
                                game={game}
                                currentPlayerId={currentPlayer.id}
                                interactionState={interactionState}
                                highlightedCardId={null}
                                setHighlightedCardId={() => {}}
                                onCardClick={(id) => onCardClick(id)}
                                onPlayCard={() => {}}
                                onDiscardCardAction={() => {}}
                                handleTooltipHover={handleTooltipHover}
                                handleTooltipLeave={handleTooltipLeave}
                                renderActionButton={() => null}
                                disableGrayOut={true}
                                defaultAttribute="scan"
                                defaultClickable={false}
                                cardOrigin="row"
                            />
                        </div>
                    ))}
                    {(!game.decks.cardRow || game.decks.cardRow.length === 0) && (
                        <div className="seti-card-row-empty">Aucune carte disponible</div>
                    )}
                </div>
            </div>
        </div>
    );
};
