import React, { useState, useEffect } from 'react';
import { Game, InteractionState, LifeTraceType, Species, Card, AlienBoardType, Bonus } from '../core/types';
import { ResourceSystem } from '../systems/ResourceSystem';
import { CardTooltip } from './CardTooltip';
import './AlienBoardUI.css';

interface AlienBoardUIProps {
    game: Game;
    boardIndex: number;
    interactionState: InteractionState;
    onPlaceLifeTrace: (boardIndex: number, color: LifeTraceType, slotType: 'triangle' | 'species', slotIndex?: number) => void;
    onSpeciesCardClick: (speciesId: string, cardId: string) => void;
    setActiveTooltip: (tooltip: { content: React.ReactNode, rect: DOMRect } | null) => void;
    forceOpen?: boolean;
}

const AlienTriangleSlot = ({ color, traces, game, onClick, isClickable, onMouseEnter, onMouseLeave }: { color: string, traces: any[], game: Game, onClick?: () => void, isClickable?: boolean, onMouseEnter?: (e: React.MouseEvent) => void, onMouseLeave?: () => void }) => (
  <div
    className={`alien-triangle-slot ${isClickable ? 'clickable' : 'help'}`}
    style={{ pointerEvents: 'auto' }}
    onMouseEnter={onMouseEnter}
    onMouseLeave={onMouseLeave}
    onClick={(e) => { e.stopPropagation(); if (isClickable && onClick) { onClick(); } }}
  >
    <svg width="60" height="50" viewBox="0 0 60 50" className="alien-triangle-svg">
      <path
        d="M10 5
           Q30 -5 50 5
           Q60 10 55 15
           L35 45
           Q30 50 25 45
           L5 15
           Q0 10 10 5 Z"
        fill={isClickable ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.5)"}
        stroke={color}
        strokeWidth={isClickable ? "3" : "2"}
        style={{ transition: 'all 0.3s ease', filter: isClickable ? `drop-shadow(0 0 5px ${color})` : 'none' }}
      />
      {isClickable && (
        <animate attributeName="opacity" values="1;0.7;1" dur="1.5s" repeatCount="indefinite" />
      )}
    </svg>
    <div className="alien-triangle-content">
      {traces.length > 0 && (
          <div className="alien-triangle-marker-main" style={{
            backgroundColor: traces[0].playerId === 'neutral' ? '#888' : (game.players.find(p => p.id === traces[0].playerId)?.color || '#fff'),
          }} />
      )}
      <div className="alien-triangle-markers-container">
        {traces.slice(1).map((trace, idx) => {
            const player = game.players.find(p => p.id === trace.playerId);
            const isNeutral = trace.playerId === 'neutral';
            return (
            <div key={idx} className="alien-triangle-marker-small" style={{
                backgroundColor: isNeutral ? '#888' : (player?.color || '#fff'),
            }} />
            );
        })}
      </div>
    </div>
  </div>
);

// Species Card Area component
const SpeciesCardArea: React.FC<{
    species: Species;
    interactionState: InteractionState;
    onCardClick: (speciesId: string, cardId: string) => void;
    setActiveTooltip: (tooltip: { content: React.ReactNode, rect: DOMRect } | null) => void;
}> = ({ species, interactionState, onCardClick, setActiveTooltip }) => {
    
    const deck = species.cards;
    const row = species.cardRow || [];
    
    const isAcquiring = interactionState.type === 'ACQUIRING_ALIEN_CARD' && interactionState.speciesId === species.id;

    const handleCardHover = (e: React.MouseEvent, card: Card) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setActiveTooltip({
            content: <CardTooltip card={card} />,
            rect
        });
    };

    return (
        <div className="seti-card-row-content alien-species-card-area">
            {/* Deck */}
            <div 
                className={`seti-common-card seti-deck-card alien-small-card ${isAcquiring ? 'acquiring' : 'default'}`}
                onClick={(e) => { e.stopPropagation(); onCardClick(species.id, 'deck'); }}
            >
                <div className="seti-deck-label alien-deck-label">Pioche</div>
                <div className="seti-deck-count alien-deck-count">{deck.length} cartes</div>
            </div>
            {/* Row */}
            {row.map(card => (
                <div key={card.id}
                    onClick={(e) => { e.stopPropagation(); onCardClick(species.id, card.id); }}
                    onMouseEnter={(e) => handleCardHover(e, card)}
                    onMouseLeave={() => setActiveTooltip(null)}
                    className={`seti-common-card seti-row-card alien-small-card ${isAcquiring ? 'acquiring' : 'default'}`}
                >
                    <div className="seti-row-card-name alien-card-name">{card.name}</div>
                    <div className="seti-row-card-cost alien-card-cost">Coût: <span>{card.cost}</span></div>
                    {card.description && <div className="seti-row-card-desc alien-card-desc">{card.description}</div>}
                    <div className="seti-row-card-details alien-card-details">
                        {card.freeAction && <div>Act: {card.freeAction}</div>}
                        {card.revenue && <div>Rev: {card.revenue}</div>}
                        {card.scanSector && <div>Scan: {card.scanSector}</div>}
                    </div>
                </div>
            ))}
        </div>
    );
};

export const AlienBoardUI: React.FC<AlienBoardUIProps> = ({ game, boardIndex, interactionState, onPlaceLifeTrace, onSpeciesCardClick, setActiveTooltip, forceOpen }) => {
    const board = game.board.alienBoards[boardIndex];
    const species = game.species.find(s => s.name === board.speciesId);
    const side = boardIndex === 0 ? 'left' : 'right';
    const isPlacingTrace = interactionState.type === 'PLACING_LIFE_TRACE';
    const [isOpen, setIsOpen] = useState(isPlacingTrace || forceOpen);

    useEffect(() => {
        if (isPlacingTrace || forceOpen) {
            setIsOpen(true);
        }
    }, [isPlacingTrace, forceOpen]);

    if (!board) return null;

    const renderAlienSlotTooltip = (colorType: LifeTraceType) => {
        const traces = board.lifeTraces.filter(t => t.type === colorType);
        let colorName = "";
        let colorHex = "";

        if (colorType === LifeTraceType.RED) {
            colorName = "Rouge";
            colorHex = "#ff6b6b";
        } else if (colorType === LifeTraceType.BLUE) {
            colorName = "Bleue";
            colorHex = "#4a9eff";
        } else if (colorType === LifeTraceType.YELLOW) {
            colorName = "Jaune";
            colorHex = "#ffd700";
        }

        return (
            <div className="alien-tooltip-container">
                <div className="alien-tooltip-header" style={{ color: colorHex }}>
                    Trace de vie {colorName}
                </div>

                {traces.length > 0 ? (
                    <div className="alien-tooltip-players">
                        <div style={{ fontSize: '0.8em', color: '#aaa', marginBottom: '2px' }}>Découvert par :</div>
                        {traces.map((trace, idx) => {
                            const player = game.players.find(p => p.id === trace.playerId);
                            return (
                                <div key={idx} className="alien-tooltip-player-row" style={{ color: player?.color || '#fff' }}>
                                    {player?.name || 'Inconnu'}
                                    {idx === 0 && <span className="alien-tooltip-bonus-label">(Bonus carte alien)</span>}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="alien-tooltip-empty">Aucune trace découverte</div>
                )}

                <div className="alien-tooltip-bonuses">
                    <div className="alien-tooltip-bonus-row mb">
                        <span>Bonus découverte :</span>
                        <span className="alien-tooltip-bonus-value">{ResourceSystem.formatBonus(board.firstBonus)?.join(', ')}</span>
                    </div>
                    <div className="alien-tooltip-bonus-row">
                        <span>Bonus suivants :</span>
                        <span className="alien-tooltip-bonus-value">{ResourceSystem.formatBonus(board.nextBonus)?.join(', ')}</span>
                    </div>
                </div>
            </div>
        );
    };

    const getPlayerColor = (playerId: string) => {
        if (playerId === 'neutral') return '#888';
        return game.players.find(p => p.id === playerId)?.color || '#fff';
    };

    const renderSpeciesTrack = (type: LifeTraceType) => {
        if (!species) return null;
        
        let fixedSlots: any[] = [];
        let infiniteSlot: any = {};
        
        if (type === LifeTraceType.RED) {
            fixedSlots = species.fixedSlots.redlifetrace;
            infiniteSlot = species.infiniteSlots.redlifetrace;
        } else if (type === LifeTraceType.YELLOW) {
            fixedSlots = species.fixedSlots.yellowlifetrace;
            infiniteSlot = species.infiniteSlots.yellowlifetrace;
        } else if (type === LifeTraceType.BLUE) {
            fixedSlots = species.fixedSlots.bluelifetrace;
            infiniteSlot = species.infiniteSlots.bluelifetrace;
        }

        const isPlacing = interactionState.type === 'PLACING_LIFE_TRACE' && interactionState.color === type;
        const color = type === LifeTraceType.RED ? '#ff6b6b' : type === LifeTraceType.YELLOW ? '#ffd700' : '#4a9eff';
        const currentPlayer = game.players[game.currentPlayerIndex];

        const renderSlot = (index: number, bonus: Bonus, isInfinite: boolean, opacity: number = 1, isInfiniteBottom: boolean = false) => {
            const trace = board.lifeTraces.find(t => t.location === 'species' && t.type === type && t.slotIndex === index);
            const isFilled = !!trace;
            const canAfford = !bonus.token || bonus.token >= 0 || (currentPlayer.tokens || 0) >= Math.abs(bonus.token);
            const isNext = index === 0 || (isInfinite && index === fixedSlots.length) || !!board.lifeTraces.find(t => t.location === 'species' && t.type === type && t.slotIndex === index - 1);
            const isClickable = isInfinite ? isPlacing && !isFilled && isNext && canAfford : isPlacing && !isFilled && canAfford;

            const handleMouseEnter = (e: React.MouseEvent) => {
                const parts = ResourceSystem.formatBonus(bonus) || [];
                
                let costText = null;
                if (bonus.token && bonus.token < 0) {
                    costText = `${Math.abs(bonus.token)} Token`;
                }
                
                let statusText = "";
                let statusColor = "";
                let actiontext = "";
                if (isFilled) {
                    const player = game.players.find(p => p.id === trace?.playerId);
                    statusText = `Occupé par ${player?.name || 'Inconnu'}`;
                    statusColor = player?.color || '#ccc';
                } else if (!canAfford) {
                    statusText = "Indisponible";
                    statusColor = "#ff6b6b";
                    actiontext = "Nécessite d'avoir suffisamment de tokens";
                } else {
                    statusText = "Disponible";
                    statusColor = "#4a9eff";
                }

                const rect = e.currentTarget.getBoundingClientRect();
                setActiveTooltip({ content: (
                    <div className="alien-slot-tooltip-container">
                        <div className="alien-slot-tooltip-status" style={{ color: statusColor }}>{statusText}</div>
                        <div className="alien-slot-tooltip-details">
                            {costText && (
                                <>Coût: <span className="alien-slot-tooltip-cost">{costText}</span>, </>
                            )}
                            Bonus: <span className="alien-slot-tooltip-bonus">{parts.length > 0 ? parts.join(', ') : 'Aucun'}</span>
                        </div>
                        {actiontext && (
                            <div className="alien-slot-tooltip-action">{actiontext}</div>
                        )}
                    </div>
                ), rect });
            };

            const style: React.CSSProperties = {
                borderColor: color,
                opacity: opacity,
                cursor: isClickable ? 'pointer' : 'help',
                transition: 'box-shadow 0.15s',
                pointerEvents: 'auto'
            };

            if (isInfinite) {
                style.zIndex = 1;
                if (isInfiniteBottom) {
                    style.width = '28px';
                    style.height = '28px';
                    style.borderRadius = '50%';
                    style.border = `2px solid ${color}`;
                    style.background = isFilled ? getPlayerColor(trace!.playerId) : (isClickable ? '#32373c' : '#14171a');
                    if (isClickable) style.boxShadow = `0 0 8px ${color}`;
                } else {
                    style.width = '8px';
                    style.height = '8px';
                    style.borderRadius = '50%';
                    style.background = isFilled ? getPlayerColor(trace!.playerId) : color;
                    style.border = 'none';
                }
            } else {
                style.boxShadow = isClickable ? `0 0 8px ${color}` : 'none';
                style.backgroundColor = isFilled ? getPlayerColor(trace!.playerId) : (isClickable ? '#32373c' : '#14171a');
            }

            return (
                <div
                    key={`${isInfinite ? 'inf' : 'fixed'}-${index}`}
                    className={`alien-slot ${isInfinite ? 'infinite' : 'fixed'} ${isFilled ? 'filled' : ''} ${isClickable ? 'clickable' : ''}`}
                    style={style}
                    onClick={(e) => {
                        e.stopPropagation();
                        if (isClickable) onPlaceLifeTrace(boardIndex, type, 'species', index);
                    }}
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={() => setActiveTooltip(null)}
                />
            );
        };

        return (
            <div className="alien-track-column">
                <div className="alien-infinite-slot">
                    <div
                        className="alien-infinite-corridor-container"
                    >
                        <div
                            className="alien-infinite-corridor-bg"
                        />
                        {[0, 1, 2].map((idx) => {
                            // De 0 (bas) à 2 (haut)
                            const infTraceIndex = fixedSlots.length + idx;
                            // Opacité diminue vers le haut (plus grand idx = plus haut)
                            const opacity = [1, 0.6, 0.35][idx];
                            return renderSlot(infTraceIndex, infiniteSlot, true, opacity, idx === 0);
                        })}
                    </div>
                </div>
                <div className="alien-fixed-slots-container">
                    {[...fixedSlots].reverse().map((bonus, reverseIndex) => {
                        const index = fixedSlots.length - 1 - reverseIndex;
                        return renderSlot(index, bonus, false);
                    })}
                </div>
            </div>
        );
    };

    return (
        <div className={`alien-board-container ${side}`}>
            <div className={`seti-foldable-container seti-icon-panel alien-foldable-container ${isOpen ? 'open' : 'collapsed'}`}>
                <div className="seti-foldable-content alien-foldable-content">
                    {board.isDiscovered && (
                        <div className="alien-species-header">
                            <div className="alien-species-title-row">
                                <div 
                                    className="alien-species-id"
                                    style={{ cursor: 'help' }}
                                    onMouseEnter={(e) => {
                                        if (species && species.description) {
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            setActiveTooltip({
                                                content: (
                                                    <div style={{ maxWidth: '300px', textAlign: 'left' }}>
                                                        <div style={{ fontWeight: 'bold', marginBottom: '5px', color: '#ffd700' }}>{species.name}</div>
                                                        <div style={{ fontSize: '0.9em', lineHeight: '1.4', color: '#ddd' }}>{species.description}</div>
                                                    </div>
                                                ),
                                                rect
                                            });
                                        }
                                    }}
                                    onMouseLeave={() => setActiveTooltip(null)}
                                >
                                    {board.speciesId}
                                </div>
                                {board.speciesId === AlienBoardType.OUMUAMUA && (
                                    <div 
                                        className="alien-oumuamua-token"
                                        onMouseEnter={(e) => {
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            const content = (
                                                <div style={{ textAlign: 'left', minWidth: '120px' }}>
                                                    <div style={{ fontWeight: 'bold', marginBottom: '4px', borderBottom: '1px solid #555', paddingBottom: '2px', color: '#ffd700' }}>Tokens</div>
                                                    {game.players.map(p => (
                                                        <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center' }}>
                                                            <span style={{ color: p.color, fontWeight: 'bold' }}>{p.name}</span>
                                                            <span style={{ backgroundColor: '#333', padding: '0 6px', borderRadius: '4px' }}>{p.tokens || 0}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            );
                                            setActiveTooltip({ content, rect });
                                        }}
                                        onMouseLeave={() => setActiveTooltip(null)}
                                    >
                                        🦠
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    {board.isDiscovered && species && (
                        <SpeciesCardArea 
                            species={species}
                            interactionState={interactionState}
                            onCardClick={onSpeciesCardClick}
                            setActiveTooltip={setActiveTooltip}
                        />
                    )}
                    {board.isDiscovered && (
                        <div className="alien-tracks-container">
                            <div className="alien-track-column-wrapper">
                                {board.isDiscovered && species && renderSpeciesTrack(LifeTraceType.RED)}
                            </div>
                            <div className="alien-track-column-wrapper">
                                {board.isDiscovered && species && renderSpeciesTrack(LifeTraceType.YELLOW)}
                            </div>
                            <div className="alien-track-column-wrapper">
                                {board.isDiscovered && species && renderSpeciesTrack(LifeTraceType.BLUE)}
                            </div>
                        </div>
                    )}
                    <div className="alien-triangles-container">
                        <div className="alien-track-column-wrapper">
                            <AlienTriangleSlot color="#ff6b6b"
                                traces={board.lifeTraces.filter(t => t.type === LifeTraceType.RED && (t.location === 'triangle' || t.location === undefined))}
                                game={game}
                                isClickable={interactionState.type === 'PLACING_LIFE_TRACE' && interactionState.color === LifeTraceType.RED}
                                onClick={() => onPlaceLifeTrace(boardIndex, LifeTraceType.RED, 'triangle')}
                                onMouseEnter={(e) => {
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    setActiveTooltip({ content: renderAlienSlotTooltip(LifeTraceType.RED), rect });
                                }}
                                onMouseLeave={() => setActiveTooltip(null)}
                            />
                        </div>
                        <div className="alien-track-column-wrapper">
                            <AlienTriangleSlot color="#ffd700"
                                traces={board.lifeTraces.filter(t => t.type === LifeTraceType.YELLOW && (t.location === 'triangle' || t.location === undefined))}
                                game={game}
                                isClickable={interactionState.type === 'PLACING_LIFE_TRACE' && interactionState.color === LifeTraceType.YELLOW}
                                onClick={() => onPlaceLifeTrace(boardIndex, LifeTraceType.YELLOW, 'triangle')}
                                onMouseEnter={(e) => {
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    setActiveTooltip({ content: renderAlienSlotTooltip(LifeTraceType.YELLOW), rect });
                                }}
                                onMouseLeave={() => setActiveTooltip(null)}
                            />
                        </div>
                        <div className="alien-track-column-wrapper">
                            <AlienTriangleSlot color="#4a9eff"
                                traces={board.lifeTraces.filter(t => t.type === LifeTraceType.BLUE && (t.location === 'triangle' || t.location === undefined))}
                                game={game}
                                isClickable={interactionState.type === 'PLACING_LIFE_TRACE' && interactionState.color === LifeTraceType.BLUE}
                                onClick={() => onPlaceLifeTrace(boardIndex, LifeTraceType.BLUE, 'triangle')}
                                onMouseEnter={(e) => {
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    setActiveTooltip({ content: renderAlienSlotTooltip(LifeTraceType.BLUE), rect });
                                }}
                                onMouseLeave={() => setActiveTooltip(null)}
                            />
                        </div>
                     </div>
                </div>
                <div className="seti-foldable-header" onClick={() => setIsOpen(!isOpen)}>
                    <span className="panel-icon">👽</span>
                    <span className="panel-title">Alien Board</span>
                </div>
            </div>
        </div>
    );
};