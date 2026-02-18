import React, { useState, useEffect } from 'react';
import { Game, InteractionState, LifeTraceType } from '../core/types';
import { ResourceSystem } from '../systems/ResourceSystem';
import './AlienBoardUI.css';

interface AlienBoardUIProps {
    game: Game;
    boardIndex: number;
    interactionState: InteractionState;
    onPlaceLifeTrace: (boardIndex: number, color: LifeTraceType, slotType: 'triangle' | 'species', slotIndex?: number) => void;
    setActiveTooltip: (tooltip: { content: React.ReactNode, rect: DOMRect } | null) => void;
}

const AlienTriangleSlot = ({ color, traces, game, onClick, isClickable, onMouseEnter, onMouseLeave }: { color: string, traces: any[], game: Game, onClick?: () => void, isClickable?: boolean, onMouseEnter?: (e: React.MouseEvent) => void, onMouseLeave?: () => void }) => (
  <div
    style={{ position: 'relative', width: '60px', height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: isClickable ? 'pointer' : 'help' }}
    onMouseEnter={onMouseEnter}
    onMouseLeave={onMouseLeave}
    onClick={() => { if (isClickable && onClick) { onClick(); } }}
  >
    <svg width="60" height="50" viewBox="0 0 60 50" style={{ position: 'absolute', top: 0, left: 0, overflow: 'visible' }}>
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
    <div style={{ zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '2px', gap: '2px', width: '40px', height: '40px', overflow: 'hidden' }}>
      {traces.length > 0 && (
          <div style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            backgroundColor: traces[0].playerId === 'neutral' ? '#888' : (game.players.find(p => p.id === traces[0].playerId)?.color || '#fff'),
            border: '1px solid rgba(255,255,255,0.9)',
            boxShadow: '0 0 4px rgba(0,0,0,0.8)',
            zIndex: 3,
            marginBottom: '1px'
          }} />
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '2px' }}>
        {traces.slice(1).map((trace, idx) => {
            const player = game.players.find(p => p.id === trace.playerId);
            const isNeutral = trace.playerId === 'neutral';
            return (
            <div key={idx} style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: isNeutral ? '#888' : (player?.color || '#fff'),
                border: '1px solid rgba(255,255,255,0.6)',
                boxShadow: '0 0 2px rgba(0,0,0,0.8)',
                zIndex: 2
            }} />
            );
        })}
      </div>
    </div>
  </div>
);

export const AlienBoardUI: React.FC<AlienBoardUIProps> = ({ game, boardIndex, interactionState, onPlaceLifeTrace, setActiveTooltip }) => {
    const board = game.board.alienBoards[boardIndex];
    const species = game.species.find(s => s.name === board.speciesId);
    const side = boardIndex === 0 ? 'left' : 'right';
    const isPlacingTrace = interactionState.type === 'PLACING_LIFE_TRACE';
    const [isOpen, setIsOpen] = useState(isPlacingTrace);

    useEffect(() => {
        if (isPlacingTrace) {
            setIsOpen(true);
        }
    }, [isPlacingTrace]);

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
            <div style={{ textAlign: 'center', minWidth: '180px' }}>
                <div style={{ fontWeight: 'bold', color: colorHex, marginBottom: '6px', borderBottom: '1px solid #555', paddingBottom: '4px' }}>
                    Trace de vie {colorName}
                </div>

                {traces.length > 0 ? (
                    <div style={{ marginBottom: '8px' }}>
                        <div style={{ fontSize: '0.8em', color: '#aaa', marginBottom: '2px' }}>Découvert par :</div>
                        {traces.map((trace, idx) => {
                            const player = game.players.find(p => p.id === trace.playerId);
                            return (
                                <div key={idx} style={{ color: player?.color || '#fff', fontWeight: 'bold', fontSize: '0.9em' }}>
                                    {player?.name || 'Inconnu'}
                                    {idx === 0 && <span style={{ fontWeight: 'normal', fontSize: '0.8em', color: '#aaa', marginLeft: '4px' }}>(Bonus carte alien)</span>}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div style={{ fontStyle: 'italic', color: '#888', marginBottom: '8px', fontSize: '0.9em' }}>Aucune trace découverte</div>
                )}

                <div style={{ fontSize: '0.8em', marginTop: '4px', borderTop: '1px solid #555', paddingTop: '4px', textAlign: 'left' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ccc', marginBottom: '2px' }}>
                        <span>Bonus découverte :</span>
                        <span style={{ color: '#ffd700' }}>{ResourceSystem.formatBonus(board.firstBonus)?.join(', ')}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ccc' }}>
                        <span>Bonus suivants :</span>
                        <span style={{ color: '#ffd700' }}>{ResourceSystem.formatBonus(board.nextBonus)?.join(', ')}</span>
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

        const traces = board.lifeTraces.filter(t => t.type === type);
        const isPlacing = interactionState.type === 'PLACING_LIFE_TRACE' && interactionState.color === type;
        const color = type === LifeTraceType.RED ? '#ff6b6b' : type === LifeTraceType.YELLOW ? '#ffd700' : '#4a9eff';
        const currentPlayer = game.players[game.currentPlayerIndex];

        return (
            <div className="alien-track-column">
                <div className="alien-infinite-slot">
                    <div
                        className="alien-infinite-corridor"
                        style={{
                            position: 'relative',
                            display: 'flex',
                            flexDirection: 'column-reverse',
                            alignItems: 'center',
                            marginBottom: '18px',
                            gap: '12px',
                        }}
                    >
                        <div
                            style={{
                                position: 'absolute',
                                top: 0,
                                bottom: 0,
                                left: '50%',
                                transform: 'translateX(-50%)',
                                width: '28px',
                                borderLeft: '2px solid rgba(255,255,255,0.4)',
                                borderRight: '2px solid rgba(255,255,255,0.4)',
                                borderBottom: '2px solid rgba(255,255,255,0.4)',
                                borderBottomLeftRadius: '16px',
                                borderBottomRightRadius: '16px',
                                maskImage: 'linear-gradient(to top, black 20%, rgba(0,0,0,0.25) 80%, transparent 100%)',
                                WebkitMaskImage: 'linear-gradient(to top, black 20%, rgba(0,0,0,0.25) 80%, transparent 100%)',
                                zIndex: 0,
                                pointerEvents: 'none',
                            }}
                        />
                        {[2, 1, 0].map((reverseIdx) => {
                            // De 0 (haut) à 2 (bas)
                            const idx = reverseIdx;
                            const infTraceIndex = fixedSlots.length + idx;
                            const trace = traces[infTraceIndex];
                            const isBottom = reverseIdx === 2;
                            const canAfford = !infiniteSlot?.token || infiniteSlot.token >= 0 || (currentPlayer.tokens || 0) >= Math.abs(infiniteSlot.token);
                            const isNext = idx === traces.length - fixedSlots.length;

                            // Opacité diminue vers le haut (plus petit idx = plus haut)
                            const opacity = [0.35, 0.6, 1][reverseIdx];

                            return (
                                <div
                                    key={`inf-corridor-${idx}`}
                                    className={`alien-slot infinite ${isPlacing && isNext && canAfford ? 'clickable' : ''}`}
                                    style={{
                                        borderColor: color,
                                        opacity: opacity,
                                        zIndex: 1,
                                        background: isBottom 
                                            ? (trace ? getPlayerColor(trace.playerId) : (isPlacing && isNext && canAfford ? '#32373c' : '#14171a')) 
                                            : (trace ? getPlayerColor(trace.playerId) : color),
                                        width: isBottom ? '28px' : '8px',
                                        height: isBottom ? '28px' : '8px',
                                        borderRadius: '50%',
                                        border: isBottom ? `2px solid ${color}` : 'none',
                                        cursor: isPlacing && isNext && canAfford ? 'pointer' : 'help',
                                        boxShadow: isPlacing && isBottom && isNext && canAfford ? `0 0 8px ${color}` : undefined,
                                        transition: 'box-shadow 0.15s'
                                    }}
                                    onClick={() =>
                                        isPlacing &&
                                        isNext && canAfford &&
                                        onPlaceLifeTrace(boardIndex, type, 'species', infTraceIndex)
                                    }
                                    onMouseEnter={(e) => {
                                        // Bonus pour cet emplacement
                                        if (infiniteSlot) {
                                            const parts = ResourceSystem.formatBonus(infiniteSlot) || [];
                                            let costText = null;
                                            if (infiniteSlot.token && infiniteSlot.token < 0) {
                                                costText = `${Math.abs(infiniteSlot.token)} Token`;
                                            }
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            let statusText = '';
                                            let statusColor = '';
                                            let actiontext = '';
                                            if (trace) {
                                                const player = game.players.find((p) => p.id === trace.playerId);
                                                statusText = `Occupé par ${player?.name || 'Inconnu'}`;
                                                statusColor = player?.color || '#ccc';
                                            } else if (!canAfford) {
                                                statusText = 'Indisponible';
                                                statusColor = '#ff6b6b';
                                                actiontext = "Nécessite d'avoir suffisamment de tokens";
                                            } else {
                                                statusText = 'Disponible';
                                                statusColor = '#4a9eff';
                                            }
                                            setActiveTooltip({
                                                content: (
                                                    <div style={{ textAlign: 'center', padding: '4px' }}>
                                                        <div
                                                            style={{
                                                                fontWeight: 'bold',
                                                                color: statusColor,
                                                                marginBottom: '4px',
                                                            }}
                                                        >
                                                            {statusText}
                                                        </div>
                                                        {costText && (
                                                            <div style={{ fontSize: '0.9em', color: '#ff6b6b' }}>
                                                                Coût: <span style={{ color: '#fff' }}>{costText}</span>
                                                            </div>
                                                        )}
                                                        <div style={{ fontSize: '0.9em', color: '#ccc' }}>
                                                            Bonus:{' '}
                                                            <span style={{ color: '#ffd700' }}>
                                                                {parts.length > 0 ? parts.join(', ') : 'Aucun'}
                                                            </span>
                                                        </div>
                                                        {actiontext && (
                                                            <div style={{ fontSize: '0.9em', color: '#ff6b6b' }}>
                                                                {actiontext}
                                                            </div>
                                                        )}
                                                    </div>
                                                ),
                                                rect,
                                            });
                                        }
                                    }}
                                    onMouseLeave={() => setActiveTooltip(null)}
                                >
                                    {/* 
                                        A quoi ca sert ?

                                        - Afficher un marqueur de joueur ("alien-marker") si la case de la trace de vie est occupée par un joueur (trace existe)
                                        - Sinon, si l'utilisateur est en train de placer un marqueur (isPlacing) ET qu'on est sur la première case "infinie" libre,
                                          alors on affiche un cercle en pointillé comme zone de drop possible du prochain marqueur
                                    */}
                                    {isBottom && !trace && isPlacing && idx === traces.length - fixedSlots.length && (
                                        <div
                                            style={{
                                                width: '60%',
                                                height: '60%',
                                                borderRadius: '50%',
                                                border: `1.5px dashed ${color}`,
                                                margin: 'auto',
                                            }}
                                        />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
                <div className="alien-fixed-slots" style={{ display: 'flex', flexDirection: 'column', marginBottom: '15px', gap: '15px', alignItems: 'center' }}>
                    {[...fixedSlots].reverse().map((bonus, reverseIndex) => {
                        const index = fixedSlots.length - 1 - reverseIndex;
                        const trace = board.lifeTraces.find(t => t.location === 'species' && t.type === type && t.slotIndex === index);
                        const isFilled = !!trace;
                        const canAfford = !bonus?.token || bonus.token >= 0 || (currentPlayer.tokens || 0) >= Math.abs(bonus.token);
                        const isClickable = isPlacing && !isFilled && canAfford;

                        return (
                            <div
                                key={`fixed-${index}`}
                                className={`alien-slot fixed ${isFilled ? 'filled' : ''} ${isClickable ? 'clickable' : ''}`}
                                onClick={() => isClickable && onPlaceLifeTrace(boardIndex, type, 'species', index)}
                                style={{ 
                                    borderColor: color, 
                                    boxShadow: isClickable ? `0 0 8px ${color}` : 'none',
                                    backgroundColor: isFilled ? getPlayerColor(trace!.playerId) : (isClickable ? '#32373c' : '#14171a'),
                                    cursor: isClickable ? 'pointer' : 'help'
                                }}
                                onMouseEnter={(e) => {
                                    if (bonus) {
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        const parts = ResourceSystem.formatBonus(bonus) || [];
                                        let costText = null;
                                        if (bonus.token && bonus.token < 0) {
                                            costText = `${Math.abs(bonus.token)} Token`;
                                        }
                                        
                                        let statusText = "";
                                        let statusColor = "";
                                        let actiontext = "";
                                        if (isFilled) {
                                            const player = game.players.find(p => p.id === trace.playerId);
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

                                        setActiveTooltip({ content: <div style={{textAlign: 'center', padding: '4px'}}>
                                            <div style={{fontWeight: 'bold', color: statusColor, marginBottom: '4px'}}>{statusText}</div>
                                            {costText && (
                                                <div style={{ fontSize: '0.9em', color: '#ff6b6b' }}>
                                                    Coût: <span style={{ color: '#fff' }}>{costText}</span>
                                                </div>
                                            )}
                                            <div style={{ fontSize: '0.9em', color: '#ccc' }}>Bonus: <span style={{ color: '#ffd700' }}>{parts.length > 0 ? parts.join(', ') : 'Aucun'}</span></div>
                                            {actiontext && (
                                                <div style={{ fontSize: '0.9em', color: '#ff6b6b' }}>{actiontext}</div>
                                            )}
                                        </div>, rect });
                                    }
                                }}
                                onMouseLeave={() => setActiveTooltip(null)}
                            >
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <div style={{
            position: 'absolute',
            bottom: '15px',
            [side]: '15px',
            width: '240px',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            pointerEvents: 'none',
            alignItems: side === 'left' ? 'flex-start' : 'flex-end'
        }}>
            <div className={`seti-foldable-container seti-icon-panel ${isOpen ? 'open' : 'collapsed'}`} style={{
                pointerEvents: 'auto',
                flexDirection: 'column-reverse',
                borderTopLeftRadius: '50px',
                borderTopRightRadius: '50px',
            }}>
                <div className="seti-foldable-header" onClick={() => setIsOpen(!isOpen)}>
                    <span className="panel-icon">👽</span>
                    <span className="panel-title">Alien Board</span>
                </div>
                <div className="seti-foldable-content" style={{ display: 'flex', flexDirection: 'column' }}>
                    {board.isDiscovered && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ padding: '5px', textAlign: 'center', borderBottom: '1px solid #444' }}>
                                <div style={{ fontSize: '1.1em', color: '#aaa', fontWeight: 'bold' }}>{board.speciesId}</div>
                            </div>
                            <div style={{ height: '12px', marginBottom: '5px' }}></div>
                        </div>
                    )}
                    {board.isDiscovered && (
                        <div style={{
                        display: 'flex',
                        justifyContent: 'space-around',
                        width: '100%',
                        borderBottom: '1px solid #444',
                        marginBottom: '5px',
                        flex: 1,
                        alignItems: 'flex-end'
                        }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                                {board.isDiscovered && species && renderSpeciesTrack(LifeTraceType.RED)}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                                {board.isDiscovered && species && renderSpeciesTrack(LifeTraceType.YELLOW)}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                                {board.isDiscovered && species && renderSpeciesTrack(LifeTraceType.BLUE)}
                            </div>
                        </div>
                    )}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-around',
                        width: '100%',
                        padding: '10px 5px',
                        flex: 1,
                        alignItems: 'flex-end'
                    }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
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
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
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
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
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
            </div>
        </div>
    );
};