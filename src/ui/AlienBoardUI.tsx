import React, { useState, useEffect, useRef } from 'react';
import { Game, InteractionState, LifeTraceType, Species, Card, AlienBoardType, Bonus, LifeTraceLocation, CardType, LifeTrace } from '../core/types';
import { ResourceSystem } from '../systems/ResourceSystem';
import { CardTooltip } from './components/CardTooltip';
import { CardContent } from './components/HandCard';
import './AlienBoardUI.css';

interface AlienBoardUIProps {
    game: Game;
    boardIndex: number;
    interactionState: InteractionState;
    onPlaceLifeTrace: (boardIndex: number, color: LifeTraceType, slotType: LifeTraceLocation, slotIndex?: number) => void;
    onSpeciesCardClick: (speciesId: string, cardId: string) => void;
    setActiveTooltip: (tooltip: { content: React.ReactNode, rect: DOMRect, pointerEvents?: 'none' | 'auto' } | null) => void;
    forceOpen?: boolean;
}

const AlienTriangleSlot = ({ color, traces, game, onClick, isClickable, onMouseEnter, onMouseLeave }: { color: string, traces: LifeTrace[], game: Game, onClick?: () => void, isClickable?: boolean, onMouseEnter?: (e: React.MouseEvent) => void, onMouseLeave?: () => void }) => (
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

/** Emplacements fixes d'une piste, du haut vers le bas, regroupés par niveau de danger consécutif (Exertiens) */
const dangerZones = (fixedSlots: Bonus[]): { danger?: number, indices: number[] }[] => {
    const zones: { danger?: number, indices: number[] }[] = [];
    for (let index = fixedSlots.length - 1; index >= 0; index--) {
        const danger = fixedSlots[index].danger;
        const last = zones[zones.length - 1];
        if (last && last.danger === danger) last.indices.push(index);
        else zones.push({ danger, indices: [index] });
    }
    return zones;
};

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
                onMouseEnter={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setActiveTooltip({ content: <div>{deck.length} cartes restantes</div>, rect });
                }}
                onMouseLeave={() => setActiveTooltip(null)}
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
                    {/* Même contenu que les cartes des joueurs, réduit à la taille des petites cartes */}
                    <div className="alien-card-content"><CardContent card={card} highlightedAttribute="freeAction" /></div>
                </div>
            ))}
        </div>
    );
};

// Contenu de l'infobulle du danger Exertien : cartes de chaque joueur sur une ligne, détail de la carte survolée dans le même cadre
const ExertienDangerTooltip: React.FC<{
    game: Game;
    onEnter: () => void;
    onLeave: () => void;
}> = ({ game, onEnter, onLeave }) => {
    const [hoveredCard, setHoveredCard] = useState<Card | null>(null);

    return (
        <div
            className="seti-tooltip-wide"
            style={{ textAlign: 'left', minWidth: '250px' }}
            onMouseEnter={onEnter}
            onMouseLeave={onLeave}
        >
            <div style={{ fontWeight: 'bold', marginBottom: '8px', borderBottom: '1px solid #555', paddingBottom: '4px', color: '#ffd700' }}>Niveau de danger</div>
            {game.players.map(p => {
                const exertienCards = [...(p.cards || []), ...(p.playedCards || [])].filter(c => c.type === CardType.EXERTIEN);
                return (
                    <div key={p.id} style={{ marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid #333' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center', marginBottom: '4px' }}>
                            <span style={{ color: p.color, fontWeight: 'bold' }}>{p.name}</span>
                            <span style={{ backgroundColor: '#333', padding: '0 6px', borderRadius: '4px' }}>{p.danger || 0}</span>
                        </div>
                        {exertienCards.length > 0 ? (
                            <div style={{ display: 'flex', flexWrap: 'nowrap', gap: '5px', marginTop: '8px' }}>
                                {exertienCards.map(card => (
                                    <div key={card.id} className="seti-common-card alien-danger-card"
                                        onMouseEnter={() => setHoveredCard(card)}
                                        onMouseLeave={() => setHoveredCard(null)}
                                    >
                                        <CardContent card={card} highlightedAttribute="freeAction" />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{ fontSize: '0.8em', color: '#888', fontStyle: 'italic' }}>Aucune carte Exertien</div>
                        )}
                    </div>
                );
            })}
            {hoveredCard && <div className="alien-danger-card-detail"><CardTooltip card={hoveredCard} /></div>}
        </div>
    );
};

/** Mascamites : nombre d'emplacements bleus du bas affichés en colonne (les suivants forment le triangle) */
const MASCAMITE_BLUE_COLUMN = 3;

/**
 * Colonnes du triangle des emplacements bleus Mascamites, de gauche (pointe) à droite (base),
 * chaque colonne de haut en bas. Le remplissage commence en bas de la base : 3 jetons → 2 → 1.
 */
const mascamiteTriangleColumns = (slotCount: number): number[][] => {
    const columns: number[][] = [];
    let index = MASCAMITE_BLUE_COLUMN;
    for (let height = 3; height >= 1 && index < slotCount; height--) {
        const column: number[] = [];
        for (let i = 0; i < height && index < slotCount; i++) column.unshift(index++);
        columns.unshift(column);
    }
    return columns;
};

export const AlienBoardUI: React.FC<AlienBoardUIProps> = ({ game, boardIndex, interactionState, onPlaceLifeTrace, onSpeciesCardClick, setActiveTooltip, forceOpen }) => {
    const board = game.board.alienBoards[boardIndex];
    const species = game.species.find(s => s.name === board.speciesId);
    const side = boardIndex === 0 ? 'left' : 'right';
    const isMascamites = species?.name === AlienBoardType.MASCAMITES;
    const isPlacingTrace = interactionState.type === 'PLACING_LIFE_TRACE';
    // Trace limitée à certains plateaux (ex: espèce où le joueur a déjà une trace de cette couleur)
    const isBoardAllowed = interactionState.type !== 'PLACING_LIFE_TRACE' || !interactionState.boardIndices || interactionState.boardIndices.includes(boardIndex);
    const [isOpen, setIsOpen] = useState(isPlacingTrace || forceOpen);
    const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // L'infobulle du danger Exertien est hors du plateau : le plateau reste ouvert tant qu'elle est affichée
    const [isDangerTooltipOpen, setIsDangerTooltipOpen] = useState(false);

    useEffect(() => {
        if (isPlacingTrace || forceOpen) {
            setIsOpen(true);
        }
    }, [isPlacingTrace, forceOpen]);

    const handleMouseLeaveWithDelay = () => {
        hoverTimeoutRef.current = setTimeout(() => {
            setActiveTooltip(null);
            setIsDangerTooltipOpen(false);
        }, 200);
    };

    const handleMouseEnterClearDelay = () => {
        if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
        }
    };

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

    const renderBoardSlot = (type: LifeTraceType, index: number, bonus: Bonus, isInfinite: boolean, fixedSlotsLength: number, opacity: number = 1, isInfiniteBottom: boolean = false) => {
        const color = type === LifeTraceType.RED ? '#ff6b6b' : type === LifeTraceType.YELLOW ? '#ffd700' : '#4a9eff';
        // Joueur qui pose la trace (il peut ne pas être le joueur actif : secteur couvert par un robot)
        const currentPlayer = game.players.find(p => p.id === interactionState.playerId) ?? game.players[game.currentPlayerIndex];
        const isPlacing = interactionState.type === 'PLACING_LIFE_TRACE' && (interactionState.color === type || interactionState.color === LifeTraceType.ANY) && isBoardAllowed;

        const trace = board.lifeTraces.find(t => t.location === LifeTraceLocation.SPECIES && t.type === type && t.slotIndex === index);
        const isFilled = !!trace;
        const canAfford = !bonus.token || bonus.token >= 0 || (currentPlayer.tokens || 0) >= Math.abs(bonus.token);
        const isNext = index === 0 || (isInfinite && index === fixedSlotsLength) || !!board.lifeTraces.find(t => t.location === LifeTraceLocation.SPECIES && t.type === type && t.slotIndex === index - 1);
        const isClickable = isInfinite ? isPlacing && !isFilled && isNext && canAfford : isPlacing && !isFilled && canAfford; // Note: Fixed slots logic simplified for Mascamites specific placement if needed, but standard logic applies

        const handleMouseEnter = (e: React.MouseEvent) => {
            const parts = ResourceSystem.formatBonus(bonus) || [];
            const bonusText = parts.length > 0 ? parts.join(', ') : 'Aucun';

            let costText = null;
            if (bonus.token && bonus.token < 0) {
                costText = `${Math.abs(bonus.token)} Token`;
            }
            
            let statusText = "";
            let statusColor = "";
            let actiontext = "";
            let actionColor = "";
            if (isFilled) {
                const player = game.players.find(p => p.id === trace?.playerId);
                statusText = `Occupé par ${player?.name || 'Inconnu'}`;
                statusColor = player?.color || '#ccc';
            } else if (!canAfford) {
                statusText = "Indisponible";
                statusColor = "#ff6b6b";
                actiontext = "Nécessite d'avoir suffisamment de tokens";
            } else if (parts.length <= 0) {
                statusText = "Indisponible";
                statusColor = "#ff6b6b";
                actiontext = "Nécessite un jeton";
                actionColor = "#ff6b6b";
            } else {
                statusText = "Disponible";
                statusColor = "#4a9eff";
                actiontext = "Placer une trace de vie pour récupérer le bonus";
                actionColor = "#4a9eff";
            }

            const rect = e.currentTarget.getBoundingClientRect();
            setActiveTooltip({ content: (
                <div className="alien-slot-tooltip-container">
                    <div className="alien-slot-tooltip-status" style={{ color: statusColor }}>{statusText}</div>
                    <div className="alien-slot-tooltip-details">
                        {costText && (
                            <>Coût: <span className="alien-slot-tooltip-cost">{costText}</span>, </>
                        )}
                        Bonus: <span className="alien-slot-tooltip-bonus">{bonusText}</span>
                    </div>
                    {actiontext && (
                        <div className="alien-slot-tooltip-action" style={{ color: actionColor }}>{actiontext}</div>
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
                    if (isClickable) onPlaceLifeTrace(boardIndex, type, LifeTraceLocation.SPECIES, index);
                }}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={() => setActiveTooltip(null)}
            />
        );
    };

    const renderSpeciesTrack = (type: LifeTraceType) => {
        if (!species) return null;
        
        let fixedSlots: Bonus[] = [];
        let infiniteSlot: Bonus = {};
        
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

        return (
            <div className="alien-track-column">
                {!isMascamites && (
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
                            return renderBoardSlot(type, infTraceIndex, infiniteSlot, true, fixedSlots.length, opacity, idx === 0);
                        })}
                    </div>
                </div>
                )}
                {isMascamites && type === LifeTraceType.BLUE && fixedSlots.length > MASCAMITE_BLUE_COLUMN ? (
                    <>
                        {/* Les jetons du haut en triangle (base à droite, pointe vers la gauche) pour garder la hauteur des autres plateaux */}
                        <div className="alien-mascamite-triangle">
                            {mascamiteTriangleColumns(fixedSlots.length).map((column, columnIndex) => (
                                <div key={columnIndex} className="alien-mascamite-triangle-column">
                                    {column.map(index => renderBoardSlot(type, index, fixedSlots[index], false, fixedSlots.length))}
                                </div>
                            ))}
                        </div>
                        <div className="alien-fixed-slots-container">
                            {fixedSlots.slice(0, MASCAMITE_BLUE_COLUMN).map((_, i) => MASCAMITE_BLUE_COLUMN - 1 - i)
                                .map(index => renderBoardSlot(type, index, fixedSlots[index], false, fixedSlots.length))}
                        </div>
                    </>
                ) : (
                <div className="alien-fixed-slots-container">
                    {dangerZones(fixedSlots).map((zone, zoneIndex) => zone.danger === undefined
                        ? zone.indices.map(index => renderBoardSlot(type, index, fixedSlots[index], false, fixedSlots.length))
                        : (
                            // Exertiens : emplacements regroupés par zone de danger ; la première colonne dessine le trait
                            // pointillé (du slot de gauche au slot de droite) et le label vertical de la zone
                            <div key={`zone-${zoneIndex}`} className={`alien-danger-zone ${zoneIndex > 0 && type === LifeTraceType.RED ? 'with-line' : ''}`}>
                                {type === LifeTraceType.RED && <span className="alien-danger-zone-label">☣ {zone.danger}</span>}
                                {zone.indices.map(index => renderBoardSlot(type, index, fixedSlots[index], false, fixedSlots.length))}
                            </div>
                        ))}
                </div>
                )}
            </div>
        );
    };

    return (
        <div className={`alien-board-container ${side}`}>
            <div className={`seti-foldable-container seti-icon-panel alien-foldable-container ${isOpen || isDangerTooltipOpen ? 'open' : 'collapsed'}`}>
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
                                {board.speciesId === AlienBoardType.EXERTIENS && (
                                    <div className="alien-exertien-danger"
                                        onMouseEnter={(e) => {
                                            handleMouseEnterClearDelay();
                                            setIsDangerTooltipOpen(true);
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            const content = (
                                                <ExertienDangerTooltip
                                                    game={game}
                                                    onEnter={handleMouseEnterClearDelay}
                                                    onLeave={handleMouseLeaveWithDelay}
                                                />
                                            );
                                            setActiveTooltip({ content, rect, pointerEvents: 'auto' });
                                        }}
                                        onMouseLeave={handleMouseLeaveWithDelay}
                                    >
                                        ☣️
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
                                traces={board.lifeTraces.filter(t => t.type === LifeTraceType.RED && (t.location === LifeTraceLocation.TRIANGLE || t.location === undefined))}
                                game={game}
                                isClickable={interactionState.type === 'PLACING_LIFE_TRACE' && (interactionState.color === LifeTraceType.RED || interactionState.color === LifeTraceType.ANY) && isBoardAllowed}
                                onClick={() => onPlaceLifeTrace(boardIndex, LifeTraceType.RED, LifeTraceLocation.TRIANGLE)}
                                onMouseEnter={(e) => {
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    setActiveTooltip({ content: renderAlienSlotTooltip(LifeTraceType.RED), rect });
                                }}
                                onMouseLeave={() => setActiveTooltip(null)}
                            />
                        </div>
                        <div className="alien-track-column-wrapper">
                            <AlienTriangleSlot color="#ffd700"
                                traces={board.lifeTraces.filter(t => t.type === LifeTraceType.YELLOW && (t.location === LifeTraceLocation.TRIANGLE || t.location === undefined))}
                                game={game}
                                isClickable={interactionState.type === 'PLACING_LIFE_TRACE' && (interactionState.color === LifeTraceType.YELLOW || interactionState.color === LifeTraceType.ANY) && isBoardAllowed}
                                onClick={() => onPlaceLifeTrace(boardIndex, LifeTraceType.YELLOW, LifeTraceLocation.TRIANGLE)}
                                onMouseEnter={(e) => {
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    setActiveTooltip({ content: renderAlienSlotTooltip(LifeTraceType.YELLOW), rect });
                                }}
                                onMouseLeave={() => setActiveTooltip(null)}
                            />
                        </div>
                        <div className="alien-track-column-wrapper">
                            <AlienTriangleSlot color="#4a9eff"
                                traces={board.lifeTraces.filter(t => t.type === LifeTraceType.BLUE && (t.location === LifeTraceLocation.TRIANGLE || t.location === undefined))}
                                game={game}
                                isClickable={interactionState.type === 'PLACING_LIFE_TRACE' && (interactionState.color === LifeTraceType.BLUE || interactionState.color === LifeTraceType.ANY) && isBoardAllowed}
                                onClick={() => onPlaceLifeTrace(boardIndex, LifeTraceType.BLUE, LifeTraceLocation.TRIANGLE)}
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