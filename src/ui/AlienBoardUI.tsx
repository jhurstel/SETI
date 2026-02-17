import React, { useState, useEffect } from 'react';
import { Game, InteractionState, LifeTraceType } from '../core/types';
import { ResourceSystem } from '../systems/ResourceSystem';

interface AlienBoardUIProps {
    game: Game;
    boardIndex: number;
    interactionState: InteractionState;
    onPlaceLifeTrace: (boardIndex: number, color: LifeTraceType) => void;
    setActiveTooltip: (tooltip: { content: React.ReactNode, rect: DOMRect } | null) => void;
}

const AlienTriangleSlot = ({ color, traces, game, onClick, isClickable, onMouseEnter, onMouseLeave }: { color: string, traces: any[], game: Game, onClick?: () => void, isClickable?: boolean, onMouseEnter?: (e: React.MouseEvent) => void, onMouseLeave?: () => void }) => (
  <div
    style={{ position: 'relative', width: '60px', height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: isClickable ? 'pointer' : 'help' }}
    onMouseEnter={onMouseEnter}
    onMouseLeave={onMouseLeave}
    onClick={() => { if (isClickable && onClick) onClick(); }}
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
                    {board.speciesId && (
                        <div style={{ position: 'relative', height: '200px', width: '100%', borderBottom: '1px dashed #444', marginBottom: '10px' }}>
                            <div style={{ position: 'absolute', top: '5px', left: '5px', fontSize: '0.7em', color: '#aaa' }}>Espèce: {board.speciesId}</div>
                        </div>
                    )}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-around',
                        width: '100%',
                        padding: '10px 15px',
                        marginTop: 'auto',
                        borderTop: '1px solid #444'
                    }}>
                        <AlienTriangleSlot color="#ff6b6b"
                            traces={board.lifeTraces.filter(t => t.type === LifeTraceType.RED)}
                            game={game}
                            isClickable={interactionState.type === 'PLACING_LIFE_TRACE' && interactionState.color === LifeTraceType.RED}
                            onClick={() => onPlaceLifeTrace(boardIndex, LifeTraceType.RED)}
                            onMouseEnter={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setActiveTooltip({ content: renderAlienSlotTooltip(LifeTraceType.RED), rect });
                            }}
                            onMouseLeave={() => setActiveTooltip(null)}
                        />
                        <AlienTriangleSlot color="#ffd700"
                            traces={board.lifeTraces.filter(t => t.type === LifeTraceType.YELLOW)}
                            game={game}
                            isClickable={interactionState.type === 'PLACING_LIFE_TRACE' && interactionState.color === LifeTraceType.YELLOW}
                            onClick={() => onPlaceLifeTrace(boardIndex, LifeTraceType.YELLOW)}
                            onMouseEnter={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setActiveTooltip({ content: renderAlienSlotTooltip(LifeTraceType.YELLOW), rect });
                            }}
                            onMouseLeave={() => setActiveTooltip(null)}
                        />
                        <AlienTriangleSlot color="#4a9eff"
                            traces={board.lifeTraces.filter(t => t.type === LifeTraceType.BLUE)}
                            game={game}
                            isClickable={interactionState.type === 'PLACING_LIFE_TRACE' && interactionState.color === LifeTraceType.BLUE}
                            onClick={() => onPlaceLifeTrace(boardIndex, LifeTraceType.BLUE)}
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
    );
};