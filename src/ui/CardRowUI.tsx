import React, { useState, useEffect } from 'react';
import { Game, InteractionState } from '../core/types';
import { CardTooltip, getSectorColorCode } from './CardTooltip';

interface CardRowUIProps {
    game: Game;
    interactionState: InteractionState;
    onCardClick: (cardId: string) => void;
    setActiveTooltip: (tooltip: { content: React.ReactNode, rect: DOMRect } | null) => void;
}

export const CardRowUI: React.FC<CardRowUIProps> = ({ game, interactionState, onCardClick, setActiveTooltip }) => {
    const isInitiallyOpen = interactionState.type === 'ACQUIRING_CARD' || interactionState.type === 'SELECTING_SCAN_CARD';
    const [isOpen, setIsOpen] = useState(isInitiallyOpen);

    useEffect(() => {
        setIsOpen(isInitiallyOpen);
    }, [isInitiallyOpen]);

    return (
        <div className={`seti-foldable-container seti-icon-panel ${isOpen ? 'open' : 'collapsed'}`}
            style={{
                pointerEvents: 'auto',
                ...(interactionState.type === 'ACQUIRING_CARD' || interactionState.type === 'SELECTING_SCAN_CARD' ? { borderColor: '#4a9eff', boxShadow: '0 0 20px rgba(74, 158, 255, 0.3)' } : {})
            }}
        >
            <div className="seti-foldable-header" onClick={() => setIsOpen(!isOpen)}>
                <span className="panel-icon">🃏</span>
                <span className="panel-title">Rangée Principale</span>
            </div>
            <div className="seti-foldable-content">
                <div style={{ display: 'flex', overflowX: 'auto', gap: '8px', padding: '8px' }}>
                    {/* Pile de pioche */}
                    <div
                        className="seti-common-card"
                        style={{
                            justifyContent: 'center',
                            alignItems: 'center',
                            gap: '4px',
                            backgroundImage: 'repeating-linear-gradient(45deg, #222 0, #222 10px, #2a2a2a 10px, #2a2a2a 20px)',
                            cursor: interactionState.type === 'ACQUIRING_CARD' ? 'pointer' : 'default',
                            borderColor: interactionState.type === 'ACQUIRING_CARD' ? '#4a9eff' : '#555'
                        }}>
                        <div style={{ fontWeight: 'bold', color: '#aaa', textAlign: 'center' }}>Pioche</div>
                        <div style={{ fontSize: '0.8em', color: '#888' }}>{game.decks.cards.length || 0} cartes</div>
                    </div>

                    {game.decks.cardRow && game.decks.cardRow.map(card => (
                        <div key={card.id}
                            onClick={() => onCardClick(card.id)}
                            onMouseEnter={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setActiveTooltip({ content: <CardTooltip card={card} />, rect });
                            }}
                            onMouseLeave={() => setActiveTooltip(null)}
                            className="seti-common-card"
                            style={{
                                border: (interactionState.type === 'ACQUIRING_CARD' || interactionState.type === 'SELECTING_SCAN_CARD') ? '1px solid #4a9eff' : '1px solid #555',
                                cursor: (interactionState.type === 'ACQUIRING_CARD' || interactionState.type === 'SELECTING_SCAN_CARD') ? 'pointer' : 'default',
                                animation: 'cardAppear 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)'
                            }}>
                            <div style={{ fontWeight: 'bold', color: '#fff', lineHeight: '1.1', marginBottom: '4px', fontSize: '0.75rem', height: '2.2em', overflow: 'hidden' }}>{card.name}</div>
                            <div style={{ fontSize: '0.75em', color: '#aaa' }}>Jouer la carte (coût: <span style={{ color: '#ffd700' }}>{card.cost}</span>)</div>
                            {card.description && <div style={{ fontSize: '0.7em', color: '#ccc', fontStyle: 'italic', margin: '4px 0', lineHeight: '1.2', flex: 1, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', textOverflow: 'ellipsis' }}>{card.description}</div>}
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75em', color: '#ddd', marginBottom: '2px' }}>
                                {card.freeAction && <div>Act: {card.freeAction}</div>}
                                {card.revenue && <div>Rev: {card.revenue}</div>}
                            </div>
                            <div style={{
                                marginTop: 'auto',
                                padding: '4px',
                                backgroundColor: 'rgba(255,255,255,0.05)',
                                borderRadius: '4px',
                                textAlign: 'center',
                                border: `1px solid ${getSectorColorCode(card.scanSector)}`,
                            }}>
                                <div style={{ fontSize: '0.7em', textTransform: 'uppercase', color: '#ddd', marginBottom: '2px' }}>Scan</div>
                                <div style={{
                                    color: getSectorColorCode(card.scanSector),
                                    fontWeight: 'bold',
                                    fontSize: '1.1em'
                                }}>
                                    {card.scanSector}
                                </div>
                            </div>
                        </div>
                    ))}
                    {(!game.decks.cardRow || game.decks.cardRow.length === 0) && (
                        <div style={{ gridColumn: '2 / -1', color: '#888', fontStyle: 'italic', padding: '10px', textAlign: 'center' }}>Aucune carte disponible</div>
                    )}
                </div>
            </div>
        </div>
    );
};
