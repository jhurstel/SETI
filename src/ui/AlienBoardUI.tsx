import React, { useState, useEffect, useRef } from 'react';
import { Game, InteractionState, LifeTraceType, Species, Card, AlienBoardType, Bonus, LifeTraceLocation, CardType, LifeTrace } from '../core/types';
import { ResourceSystem } from '../systems/ResourceSystem';
import { BonusIcons } from './components/BonusIcons';
import { SpeciesSystem } from '../systems/SpeciesSystem';
import { CardTooltip } from './components/CardTooltip';
import { CardContent } from './components/HandCard';
import { DeckPile } from './components/CardBack';
import { Tooltip } from './Tooltip';
import { LifeTraceShape, LIFE_TRACE_VIEWBOX, VictoryPointsIcon, ResourceIcon, CentaurienMessageIcon } from './components/GameIcons';
import { LIFE_TRACE_COLORS, LifeTraceColor } from './styles/lifeTraceColors';
import { useCloseOnOutsideClick } from './hooks/useCloseOnOutsideClick';
import './AlienBoardUI.css';
import { useCloseTooltipOnClick } from './hooks/useCloseTooltipOnClick';

/** Couleur de chaque piste de traces de vie */
const TRACK_COLORS: Record<LifeTraceType, string> = {
    [LifeTraceType.RED]: '#ff6b6b',
    [LifeTraceType.YELLOW]: '#ffd700',
    [LifeTraceType.BLUE]: '#4a9eff',
    [LifeTraceType.ANY]: '#cccccc',
};

interface AlienBoardUIProps {
    game: Game;
    boardIndex: number;
    interactionState: InteractionState;
    onPlaceLifeTrace: (boardIndex: number, color: LifeTraceType, slotType: LifeTraceLocation, slotIndex?: number) => void;
    onSpeciesCardClick: (speciesId: string, cardId: string) => void;
    setActiveTooltip: (tooltip: { content: React.ReactNode, rect: DOMRect, pointerEvents?: 'none' | 'auto' } | null) => void;
    forceOpen?: boolean;
}

const AlienTriangleSlot = ({ color, traces, game, onClick, isClickable, onMouseEnter, onMouseLeave }: { color: LifeTraceColor, traces: LifeTrace[], game: Game, onClick?: () => void, isClickable?: boolean, onMouseEnter?: (e: React.MouseEvent) => void, onMouseLeave?: () => void }) => (
  <div
    className={`alien-triangle-slot ${isClickable ? 'clickable' : 'help'}`}
    style={{ pointerEvents: 'auto' }}
    onMouseEnter={onMouseEnter}
    onMouseLeave={onMouseLeave}
    onClick={(e) => { e.stopPropagation(); if (isClickable && onClick) { onClick(); } }}
  >
    <svg width="60" height="50" viewBox={LIFE_TRACE_VIEWBOX} preserveAspectRatio="xMidYMid meet" className="alien-triangle-svg"
      style={{ opacity: isClickable ? 0.75 : 0.4, transition: 'all 0.3s ease', filter: isClickable ? `drop-shadow(0 0 4px ${LIFE_TRACE_COLORS[color]})` : 'none' }}>
      <LifeTraceShape color={color} />
      {isClickable && (
        <animate attributeName="opacity" values="1;0.6;1" dur="1.5s" repeatCount="indefinite" />
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
            <DeckPile count={deck.length}
                className={`seti-deck-card alien-small-card ${isAcquiring ? 'acquiring active' : 'default'}`}
                onClick={(e) => { e.stopPropagation(); onCardClick(species.id, 'deck'); }}
                onMouseEnter={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setActiveTooltip({ content: <div>{deck.length} cartes restantes</div>, rect });
                }}
                onMouseLeave={() => setActiveTooltip(null)}
            />
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

// Contenu de l'infobulle du danger Exertien : cartes de chaque joueur sur une ligne ; le détail de la carte survolée
// s'affiche dans sa propre infobulle, qui peut recouvrir celle-ci
const ExertienDangerTooltip: React.FC<{
    game: Game;
    onEnter: () => void;
    onLeave: () => void;
}> = ({ game, onEnter, onLeave }) => {
    const [hoveredCard, setHoveredCard] = useState<{ card: Card, rect: DOMRect } | null>(null);
    useCloseTooltipOnClick(() => setHoveredCard(null));

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
                                        onMouseEnter={(e) => setHoveredCard({ card, rect: e.currentTarget.getBoundingClientRect() })}
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
            {hoveredCard && <Tooltip content={<CardTooltip card={hoveredCard.card} />} targetRect={hoveredCard.rect} disableCollision />}
        </div>
    );
};

// Contenu de l'infobulle des Centauriens : paliers de chaque joueur (à atteindre ou déjà pris) et tuiles Message
const CentaurienMilestonesTooltip: React.FC<{ game: Game; species?: Species }> = ({ game, species }) => (
    <div className="alien-centaurien-tooltip">
        <div className="alien-centaurien-tooltip-title">Paliers Centauriens</div>
        {game.players.map(p => {
            const milestones = [...p.centaurienMilestones].sort((a, b) => a.score - b.score);
            return (
                <div key={p.id} className="alien-centaurien-tooltip-player">
                    <div style={{ color: p.color, fontWeight: 'bold' }}>{p.name}</div>
                    {milestones.length === 0 ? (
                        <div className="alien-centaurien-tooltip-empty">Aucun palier</div>
                    ) : milestones.map(m => (
                        <div key={m.id} className={`alien-centaurien-tooltip-row ${m.resolved ? 'taken' : 'available'}`}>
                            <strong>{m.score} PV</strong>
                            <span>{m.cardName ? `Réception « ${m.cardName} »` : 'Tuile Message'}</span>
                            <em>{m.resolved ? `Pris : ${m.resolved}` : 'À atteindre'}</em>
                        </div>
                    ))}
                </div>
            );
        })}
        {species?.message && species.message.length > 0 && (
            <>
                <div className="alien-centaurien-tooltip-subtitle">Tuiles Message</div>
                {species.message.map((tile, index) => {
                    const owner = tile.claimedBy ? game.players.find(p => p.id === tile.claimedBy) : undefined;
                    return (
                        <div key={index} className={`alien-centaurien-tooltip-row ${tile.isAvailable ? 'available' : 'taken'}`}>
                            <span className="alien-centaurien-tooltip-bonus"><BonusIcons bonus={tile.bonus} size={14} /></span>
                            <em>{tile.isAvailable ? 'Disponible' : owner ? <>Prise par <span style={{ color: owner.color }}>{owner.name}</span></> : 'Prise'}</em>
                        </div>
                    );
                })}
            </>
        )}
    </div>
);

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
    const panelRef = useRef<HTMLDivElement>(null);
    useCloseOnOutsideClick(panelRef, !!isOpen, () => setIsOpen(false), !isPlacingTrace && !forceOpen);

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
                        <span className="alien-tooltip-bonus-value"><BonusIcons bonus={board.firstBonus} /></span>
                    </div>
                    <div className="alien-tooltip-bonus-row">
                        <span>Bonus suivants :</span>
                        <span className="alien-tooltip-bonus-value"><BonusIcons bonus={board.nextBonus} /></span>
                    </div>
                </div>
            </div>
        );
    };

    const getPlayerColor = (playerId: string) => {
        if (playerId === 'neutral') return '#888';
        return game.players.find(p => p.id === playerId)?.color || '#fff';
    };

    const renderBoardSlot = (type: LifeTraceType, index: number, bonus: Bonus, isInfinite: boolean, fixedSlotsLength: number) => {
        const color = TRACK_COLORS[type];
        // Joueur qui pose la trace (il peut ne pas être le joueur actif : secteur couvert par un robot)
        const currentPlayer = game.players.find(p => p.id === interactionState.playerId) ?? game.players[game.currentPlayerIndex];
        const isPlacing = interactionState.type === 'PLACING_LIFE_TRACE' && (interactionState.color === type || interactionState.color === LifeTraceType.ANY) && isBoardAllowed;

        const trace = board.lifeTraces.find(t => t.location === LifeTraceLocation.SPECIES && t.type === type && t.slotIndex === index);
        const isFilled = !!trace;
        // 7e spécimen Mascamite : face cachée tant que la case est libre (sa récompense se découvre en y posant une trace)
        const hiddenSpecimen = !isFilled && !isInfinite && type === LifeTraceType.BLUE && species?.hiddenSpecimenSlot === index;
        const canAfford = !bonus.token || bonus.token >= 0 || (currentPlayer.tokens || 0) >= Math.abs(bonus.token);
        const isNext = index === 0 || (isInfinite && index === fixedSlotsLength) || !!board.lifeTraces.find(t => t.location === LifeTraceLocation.SPECIES && t.type === type && t.slotIndex === index - 1);
        const isClickable = isInfinite ? isPlacing && !isFilled && isNext && canAfford : isPlacing && !isFilled && canAfford; // Note: Fixed slots logic simplified for Mascamites specific placement if needed, but standard logic applies

        const handleMouseEnter = (e: React.MouseEvent) => {
            const bonusText = hiddenSpecimen
                ? <span>spécimen face cachée, révélé en y posant une trace de vie</span>
                : <BonusIcons bonus={{ ...bonus, token: bonus.token && bonus.token > 0 ? bonus.token : undefined }} />;

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
            } else if (hiddenSpecimen) {
                statusText = "Disponible";
                statusColor = "#4a9eff";
                actiontext = "Placer une trace de vie pour découvrir le spécimen";
                actionColor = "#4a9eff";
            } else if ((ResourceSystem.formatBonus(bonus) || []).length <= 0) {
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
            cursor: isClickable ? 'pointer' : 'help',
            transition: 'box-shadow 0.15s',
            pointerEvents: 'auto'
        };

        if (isInfinite) {
            style.zIndex = 1;
            style.width = '28px';
            style.height = '28px';
            style.borderRadius = '50%';
            style.border = `2px solid ${color}`;
            style.background = isClickable ? '#32373c' : '#14171a';
            if (isClickable) style.boxShadow = `0 0 8px ${color}`;
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
            >
                {hiddenSpecimen && <div className="alien-hidden-specimen">?</div>}
                {!isFilled && !hiddenSpecimen && !!bonus.pv && <VictoryPointsIcon amount={bonus.pv} size={22} />}
            </div>
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

        // Emplacement infini au-dessus de la piste (pas pour les Mascamites ni les Exertiens) : le cercle est toujours
        // l'emplacement libre suivant, les traces déjà posées s'empilent au-dessus en pastilles (les 3 dernières, « +n » au-delà)
        const renderInfiniteSlots = () => {
            const placed = board.lifeTraces
                .filter(t => t.location === LifeTraceLocation.SPECIES && t.type === type && t.slotIndex !== undefined && t.slotIndex >= fixedSlots.length)
                .sort((a, b) => a.slotIndex! - b.slotIndex!);
            const taken = new Set(placed.map(t => t.slotIndex));
            let nextIndex = fixedSlots.length;
            while (taken.has(nextIndex)) nextIndex++;
            const shown = placed.slice(-3);
            const hidden = placed.length - shown.length;
            const showTraceTooltip = (e: React.MouseEvent, trace: LifeTrace) => {
                const player = game.players.find(p => p.id === trace.playerId);
                setActiveTooltip({ content: (
                    <div className="alien-slot-tooltip-container">
                        <div className="alien-slot-tooltip-status" style={{ color: player?.color || '#ccc' }}>Occupé par {player?.name || 'Inconnu'}</div>
                    </div>
                ), rect: e.currentTarget.getBoundingClientRect() });
            };
            return (
                <div className="alien-infinite-slot">
                    <div className="alien-infinite-corridor-container">
                        <div className="alien-infinite-corridor-bg" />
                        {renderBoardSlot(type, nextIndex, infiniteSlot, true, fixedSlots.length)}
                        {shown.length === 0
                            ? [0.6, 0.35].map((opacity, idx) => <div key={`dot-${idx}`} className="alien-infinite-dot" style={{ background: TRACK_COLORS[type], opacity }} />)
                            : [...shown].reverse().map(trace => (
                                <div
                                    key={trace.id}
                                    className="alien-infinite-trace"
                                    style={{ background: getPlayerColor(trace.playerId) }}
                                    onMouseEnter={e => showTraceTooltip(e, trace)}
                                    onMouseLeave={() => setActiveTooltip(null)}
                                />
                            ))}
                        {hidden > 0 && <div className="alien-infinite-more">+{hidden}</div>}
                    </div>
                </div>
            );
        };
        const infiniteSlots = SpeciesSystem.hasInfiniteSlot(species, type) && renderInfiniteSlots();

        return (
            <div className="alien-track-column">
                {infiniteSlots}
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
                            // pointillé au-dessus de la zone (de part et d'autre des slots) et le label de la zone
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
            <div ref={panelRef} className={`seti-foldable-container seti-icon-panel alien-foldable-container ${isOpen || isDangerTooltipOpen ? 'open' : 'collapsed'}`}>
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
                                        <ResourceIcon kind="token" size={22} />
                                    </div>
                                )}
                                {board.speciesId === AlienBoardType.CENTAURIENS && (
                                    <div className="alien-centaurien-milestones"
                                        onMouseEnter={(e) => setActiveTooltip({ content: <CentaurienMilestonesTooltip game={game} species={species} />, rect: e.currentTarget.getBoundingClientRect() })}
                                        onMouseLeave={() => setActiveTooltip(null)}
                                    >
                                        <CentaurienMessageIcon size={22} />
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
                            <AlienTriangleSlot color="red"
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
                            <AlienTriangleSlot color="yellow"
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
                            <AlienTriangleSlot color="blue"
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
                    <span className="panel-title">Alien</span>
                </div>
            </div>
        </div>
    );
};