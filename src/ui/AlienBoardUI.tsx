import React, { useState, useEffect, useRef } from 'react';
import { Game, GamePhase, InteractionState, LifeTraceType, Species, Card, AlienBoardType, Bonus, LifeTraceLocation, CardType, LifeTrace } from '../core/types';
import { ResourceSystem } from '../systems/ResourceSystem';
import { BonusIcons } from './components/BonusIcons';
import { SpeciesSystem, MASCAMITE_BOARD_SPECIMEN_SLOT } from '../systems/SpeciesSystem';
import { CardTooltip } from './components/CardTooltip';
import { CardContent } from './components/HandCard';
import { CardBack, DeckPile } from './components/CardBack';
import { ScoreManager } from '../core/ScoreManager';
import { Tooltip } from './Tooltip';
import { LifeTraceShape, LIFE_TRACE_VIEWBOX, VictoryPointsIcon, ResourceIcon, CentaurienMessageIcon } from './components/GameIcons';
import { LIFE_TRACE_COLORS, LifeTraceColor } from './styles/lifeTraceColors';
import { useCloseOnOutsideClick } from './hooks/useCloseOnOutsideClick';
import './AlienBoardUI.css';
import { useCloseTooltipOnClick } from './hooks/useCloseTooltipOnClick';
import { HoverTooltip } from './components/HoverTooltip';
import { SlotTooltip } from './components/SlotTooltip';
import { SLOT_COLORS } from './styles/slotColors';
import { atAngle, hasExtraGains } from './components/bonusLayout';
import { CentaurienMessageTile } from './components/CentaurienMessageTile';
import { useInteractiveTooltip, ActiveTooltip } from './hooks/useInteractiveTooltip';

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
    setActiveTooltip: (tooltip: ActiveTooltip | null) => void;
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
    setActiveTooltip: (tooltip: ActiveTooltip | null) => void;
}> = ({ species, interactionState, onCardClick, setActiveTooltip }) => {
    
    const deck = species.cards;
    const row = species.cardRow || [];
    
    const isAcquiring = interactionState.type === 'ACQUIRING_ALIEN_CARD' && interactionState.speciesId === species.id;

    // Infobulle d'une carte : on peut y entrer pour survoler ses symboles
    const { show, scheduleClose } = useInteractiveTooltip(setActiveTooltip);
    const handleCardHover = (e: React.MouseEvent, card: Card) => show(e, <CardTooltip card={card} />);

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
                    onMouseLeave={scheduleClose}
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
// s'affiche dans sa propre infobulle, qui peut recouvrir celle-ci. Les cartes Exertiens des adversaires restent cachées
// (jouées face cachée jusqu'au décompte final) : dos des cartes jouées, et seul le danger de la piste (+ ? s'ils en ont joué)
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
                // Joueur de cet écran : le seul humain de la partie affichée (en ligne, les autres humains y sont des robots)
                const viewerId = game.players.find(player => player.type === 'human')?.id;
                const visible = ScoreManager.visibleExertienDanger(game, p, viewerId);
                const hidden = p.id !== viewerId && game.phase !== GamePhase.FINAL_SCORING;
                const exertienCards = hidden
                    ? []
                    : [...(p.cards || []), ...(p.playedCards || [])].filter(c => c.type === CardType.EXERTIEN);
                const hiddenPlayed = hidden ? p.playedCards.filter(c => c.type === CardType.EXERTIEN) : [];
                return (
                    <div key={p.id} style={{ marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid #333' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center', marginBottom: '4px' }}>
                            <span style={{ color: p.color, fontWeight: 'bold' }}>{p.name}</span>
                            <span style={{ backgroundColor: '#333', padding: '0 6px', borderRadius: '4px' }}>{visible.danger}{visible.hidden ? ' + ?' : ''}</span>
                        </div>
                        {hiddenPlayed.length > 0 ? (
                            <div style={{ display: 'flex', flexWrap: 'nowrap', gap: '5px', marginTop: '8px' }}>
                                {hiddenPlayed.map(card => <CardBack key={card.id} className="alien-danger-card" />)}
                            </div>
                        ) : hidden ? (
                            <div style={{ fontSize: '0.8em', color: '#888', fontStyle: 'italic' }}>Aucune carte Exertien jouée</div>
                        ) : exertienCards.length > 0 ? (
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

// Contenu de l'infobulle des Centauriens, en symboles : paliers de chaque joueur (PV à atteindre, message ou réception d'une carte,
// coche une fois pris), puis les 4 tuiles Message sur une ligne (une tuile prise est grisée, au bord de la couleur du joueur).
// La souris peut y entrer (onEnter / onLeave) : chaque tuile a sa propre infobulle (état, récompense)
const CentaurienMilestonesTooltip: React.FC<{ game: Game; species?: Species; onEnter: () => void; onLeave: () => void }> = ({ game, species, onEnter, onLeave }) => (
    <div className="alien-centaurien-tooltip" onMouseEnter={onEnter} onMouseLeave={onLeave}>
        <div className="alien-centaurien-tooltip-title">Paliers Centauriens</div>
        {game.players.map(p => {
            const milestones = [...p.centaurienMilestones].sort((a, b) => a.score - b.score);
            return (
                <div key={p.id} className="alien-centaurien-tooltip-player">
                    <span className="alien-centaurien-tooltip-name" style={{ color: p.color }}>{p.name}</span>
                    {milestones.length === 0 ? <span className="alien-centaurien-tooltip-empty">—</span> : milestones.map(m => (
                        <span key={m.id} className={`alien-centaurien-milestone ${m.resolved ? 'taken' : ''}`}>
                            <VictoryPointsIcon amount={m.score} size={20} />
                            {m.cardId ? <ResourceIcon kind="card" size={16} /> : <CentaurienMessageIcon size={16} />}
                            {m.resolved && <span className="alien-centaurien-milestone-check">✓</span>}
                        </span>
                    ))}
                </div>
            );
        })}
        {species?.message && species.message.length > 0 && (
            <div className="alien-centaurien-tiles">
                {species.message.map((tile, index) => {
                    const owner = tile.claimedBy ? game.players.find(p => p.id === tile.claimedBy) : undefined;
                    const status = tile.isAvailable ? 'Disponible' : owner ? `Prise par ${owner.name}` : 'Prise';
                    return (
                        <HoverTooltip key={index} nested content={
                            <SlotTooltip status={`Tuile Message ${index + 1} : ${status}`} statusColor={tile.isAvailable ? SLOT_COLORS.available : owner?.color ?? SLOT_COLORS.neutral}
                                label="Récompense" value={<BonusIcons bonus={tile.bonus} size={16} />} />
                        }>
                            <CentaurienMessageTile bonus={tile.bonus} taken={!tile.isAvailable} takenColor={owner?.color} />
                        </HoverTooltip>
                    );
                })}
            </div>
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
    // Infobulles où la souris peut entrer (danger Exertien, paliers Centauriens) : le plateau reste ouvert tant qu'elles sont affichées
    const [isPinnedTooltipOpen, setIsPinnedTooltipOpen] = useState(false);
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
            setIsPinnedTooltipOpen(false);
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
        // Spécimens Mascamites posés sur la piste bleue (le 7e à la découverte, puis ceux ramenés à destination),
        // face visible tant que la case est libre : leur récompense est celle de la case
        const specimenSlot = !isFilled && !isInfinite && type === LifeTraceType.BLUE && species?.name === AlienBoardType.MASCAMITES
          && index >= MASCAMITE_BOARD_SPECIMEN_SLOT && Object.keys(bonus).length > 0;
        // Coûts de l'emplacement (valeurs négatives : tokens, données), payés en y posant la trace (SpeciesSystem.placeLifeTrace)
        const tokenCost = bonus.token && bonus.token < 0 ? -bonus.token : 0;
        const dataCost = bonus.data && bonus.data < 0 ? -bonus.data : 0;
        const canAfford = (currentPlayer.tokens || 0) >= tokenCost && currentPlayer.data >= dataCost;
        const isNext = index === 0 || (isInfinite && index === fixedSlotsLength) || !!board.lifeTraces.find(t => t.location === LifeTraceLocation.SPECIES && t.type === type && t.slotIndex === index - 1);
        const isClickable = isInfinite ? isPlacing && !isFilled && isNext && canAfford : isPlacing && !isFilled && canAfford; // Note: Fixed slots logic simplified for Mascamites specific placement if needed, but standard logic applies

        // Dessin de la case : PV au centre ; autres gains et coûts (barrés d'une croix rouge) contre la case à 135°
        const hasCost = tokenCost > 0 || dataCost > 0;
        const extraGains: Bonus = { ...bonus, pv: undefined, danger: undefined, token: tokenCost ? undefined : bonus.token, data: dataCost ? undefined : bonus.data };
        const slotSize = 28;

        const handleMouseEnter = (e: React.MouseEvent) => {
            const bonusText = <BonusIcons bonus={{ ...bonus, token: tokenCost ? undefined : bonus.token, data: dataCost ? undefined : bonus.data }} />;
            const costSymbols = tokenCost || dataCost
                ? <BonusIcons bonus={{ token: tokenCost || undefined, data: dataCost || undefined }} />
                : null;
            
            // Même infobulle que les autres emplacements : état, coût et bonus sur une ligne, puis l'action ou la raison
            // (dans la couleur de l'état : rouge si indisponible)
            let status: string;
            let statusColor: string;
            let note: string;
            if (isFilled) {
                const player = game.players.find(p => p.id === trace?.playerId);
                status = `Occupé par ${player?.name || 'Inconnu'}`;
                statusColor = player?.color || '#ccc';
                note = '';
            } else if (!canAfford) {
                status = 'Indisponible';
                statusColor = SLOT_COLORS.unavailable;
                note = tokenCost && (currentPlayer.tokens || 0) < tokenCost ? "Nécessite d'avoir suffisamment de tokens" : "Nécessite d'avoir suffisamment de données";
            } else if ((ResourceSystem.formatBonus(bonus) || []).length <= 0) {
                status = 'Indisponible';
                statusColor = SLOT_COLORS.unavailable;
                note = 'Nécessite un jeton';
            } else {
                status = 'Disponible';
                statusColor = SLOT_COLORS.available;
                note = 'Placer une trace de vie pour récupérer le bonus';
            }

            setActiveTooltip({
                content: <SlotTooltip status={status} statusColor={statusColor} cost={costSymbols} value={bonusText} note={note} />,
                rect: e.currentTarget.getBoundingClientRect(),
            });
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

        const costBonus: Bonus = { token: tokenCost || undefined, data: dataCost || undefined };
        const showGains = !isFilled && !specimenSlot && (hasCost || hasExtraGains(extraGains));

        // Le badge des gains est à côté de la case (et non dedans) : son infobulle ne se mêle pas à celle de la case
        return (
            <div key={`${isInfinite ? 'inf' : 'fixed'}-${index}`} className="alien-slot-wrap">
            <div
                className={`alien-slot ${isInfinite ? 'infinite' : 'fixed'} ${isFilled ? 'filled' : ''} ${isClickable ? 'clickable' : ''}`}
                style={style}
                onClick={(e) => {
                    e.stopPropagation();
                    if (isClickable) onPlaceLifeTrace(boardIndex, type, LifeTraceLocation.SPECIES, index);
                }}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={() => setActiveTooltip(null)}
            >
                {specimenSlot && <div className="alien-board-specimen"><BonusIcons bonus={bonus} size={(ResourceSystem.formatBonus(bonus) || []).length > 1 ? 9 : 14} /></div>}
                {!isFilled && !specimenSlot && !!bonus.pv && <VictoryPointsIcon amount={bonus.pv} size={22} />}
            </div>
            {showGains && (
                // Gains autres que les PV et coûts barrés, à 135° (en bas à droite) comme les cases du système solaire
                <div className="alien-slot-gains" style={{ left: `${slotSize / 2 + atAngle(slotSize / 2, 135).x - 4}px`, top: `${slotSize / 2 + atAngle(slotSize / 2, 135).y - 4}px` }}>
                    {hasCost && (
                        <HoverTooltip content={`Coût : ${(ResourceSystem.formatBonus(costBonus) || []).join(', ')} (payé en posant la trace)`} className="alien-slot-cost">
                            <BonusIcons bonus={costBonus} size={12} empty={null} />
                            <svg className="alien-slot-cost-cross" viewBox="0 0 10 10" preserveAspectRatio="none" aria-hidden="true">
                                <path d="M1 1 L9 9 M9 1 L1 9" />
                            </svg>
                        </HoverTooltip>
                    )}
                    {hasExtraGains(extraGains) && <BonusIcons bonus={extraGains} size={12} empty={null} tooltips />}
                </div>
            )}
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
                setActiveTooltip({ content: <SlotTooltip status={`Occupé par ${player?.name || 'Inconnu'}`} statusColor={player?.color || '#ccc'} />, rect: e.currentTarget.getBoundingClientRect() });
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
            <div ref={panelRef} className={`seti-foldable-container seti-icon-panel alien-foldable-container ${isOpen || isPinnedTooltipOpen ? 'open' : 'collapsed'}`}>
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
                                        onMouseEnter={(e) => {
                                            // Infobulle où la souris peut entrer (tuiles Message) ; le plateau reste ouvert tant qu'elle est affichée
                                            handleMouseEnterClearDelay();
                                            setIsPinnedTooltipOpen(true);
                                            const content = <CentaurienMilestonesTooltip game={game} species={species} onEnter={handleMouseEnterClearDelay} onLeave={handleMouseLeaveWithDelay} />;
                                            setActiveTooltip({ content, rect: e.currentTarget.getBoundingClientRect(), pointerEvents: 'auto' });
                                        }}
                                        onMouseLeave={handleMouseLeaveWithDelay}
                                    >
                                        <CentaurienMessageIcon size={22} />
                                    </div>
                                )}
                                {board.speciesId === AlienBoardType.EXERTIENS && (
                                    <div className="alien-exertien-danger"
                                        onMouseEnter={(e) => {
                                            handleMouseEnterClearDelay();
                                            setIsPinnedTooltipOpen(true);
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