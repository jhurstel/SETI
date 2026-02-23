import React, { useState, useEffect } from 'react';
import { Game, InteractionState } from '../core/types';
import { CardTooltip, getSectorTypeCode } from '../ui/components/CardTooltip';
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
                    >
                        <div className="seti-deck-label">Pioche</div>
                        <div className="seti-deck-count">{game.decks.cards.length || 0} cartes</div>
                    </div>

                    {game.decks.cardRow && game.decks.cardRow.map(card => (
                        <div key={card.id}
                            onClick={() => onCardClick(card.id)}
                            onMouseEnter={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setActiveTooltip({ content: <CardTooltip card={card} />, rect });
                            }}
                            onMouseLeave={() => setActiveTooltip(null)}
                            className={`seti-common-card seti-row-card ${isActive ? 'active' : ''}`}
                        >
                            <div className="seti-row-card-name">{card.name}</div>
                            <div className="seti-row-card-cost">Jouer la carte (coût: <span>{card.cost}</span>)</div>
                            {card.description && <div className="seti-row-card-desc">{card.description}</div>}
                            <div className="seti-row-card-details">
                                {card.freeAction && <div>Act: {card.freeAction}</div>}
                                {card.revenue && <div>Rev: {card.revenue}</div>}
                            </div>
                            <div className="seti-row-card-scan-box" style={{
                                border: `1px solid ${getSectorTypeCode(card.scanSector)}`
                            }}>
                                <div className="seti-row-card-scan-label">Scan</div>
                                <div className="seti-row-card-scan-value" style={{
                                    color: getSectorTypeCode(card.scanSector)
                                }}>
                                    {card.scanSector}
                                </div>
                            </div>
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
