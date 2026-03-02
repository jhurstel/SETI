import React, { useState, useEffect } from 'react';
import { Game, InteractionState, GOLDEN_MILESTONES, NEUTRAL_MILESTONES } from '../core/types';
import './ObjectiveBoardUI.css';

interface ObjectiveBoardUIProps {
    game: Game;
    interactionState: InteractionState;
    onObjectiveClick: (tileId: string) => void;
    setActiveTooltip: (tooltip: { content: React.ReactNode, rect: DOMRect } | null) => void;
}

export const ObjectiveBoardUI: React.FC<ObjectiveBoardUIProps> = ({ game, interactionState, onObjectiveClick, setActiveTooltip }) => {
    const isInitiallyOpen = interactionState.type === 'PLACING_OBJECTIVE_MARKER';
    const [isObjectivesOpen, setIsObjectivesOpen] = useState(isInitiallyOpen);
    useEffect(() => {
        setIsObjectivesOpen(isInitiallyOpen);
    }, [isInitiallyOpen]);

    const maxScore = Math.max(...game.players.map(p => p.score));
    const trackMax = maxScore > 100 ? Math.ceil(maxScore / 100) * 100 : 100;
    const getPosition = (val: number) => (val / trackMax) * 100;

    return (
        <div className={`seti-foldable-container seti-icon-panel seti-objective-container ${isObjectivesOpen ? 'open' : 'collapsed'}`}>
            <div className="seti-foldable-header" onClick={() => setIsObjectivesOpen(!isObjectivesOpen)}>
                <span className="panel-icon">🏆</span>
                <span className="panel-title">Objectifs</span>
            </div>
            <div className="seti-foldable-content">
                <div className="seti-score-track" style={{ padding: '30px 15px 40px 15px', position: 'relative', borderBottom: '1px solid #444', marginBottom: '10px' }}>
                    <div style={{ height: '4px', background: 'linear-gradient(90deg, #444, #666)', borderRadius: '2px', position: 'relative' }}>
                        {/* Ticks */}
                        {Array.from({ length: trackMax / 5 + 1 }).map((_, i) => {
                            const score = i * 5;
                            const isMajor = score % 25 === 0 || score === trackMax;
                            if (score > trackMax) return null;
                            return (
                                <div key={`tick-${score}`} style={{ position: 'absolute', left: `${getPosition(score)}%`, top: '4px', width: '1px', height: isMajor ? '8px' : '4px', background: isMajor ? '#999' : '#666' }}>
                                    {isMajor && <div style={{ position: 'absolute', top: '10px', left: '50%', transform: 'translateX(-50%)', fontSize: '0.8em', color: '#999' }}>{score}</div>}
                                </div>
                            );
                        })}

                        {/* Paliers Neutres */}
                        {game.players.length < 4 && NEUTRAL_MILESTONES.map(m => (
                            <div key={`neutral-${m}`} style={{ position: 'absolute', left: `${getPosition(m)}%`, top: '50%', transform: 'translate(-50%, -50%)', zIndex: 1, cursor: 'help' }}
                                onMouseEnter={(e) => setActiveTooltip({ content: <div>Palier Neutre: {m} PV</div>, rect: e.currentTarget.getBoundingClientRect() })}
                                onMouseLeave={() => setActiveTooltip(null)}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" style={{ fill: '#aaa', filter: 'drop-shadow(0 0 2px #555)' }}><path d="M12 2L2 12l10 10 10-10L12 2z"/></svg>
                                <div style={{ position: 'absolute', top: '-16px', left: '50%', transform: 'translateX(-50%)', fontSize: '0.7em', color: '#aaa', background: 'rgba(30,30,30,0.8)', padding: '0 3px', borderRadius: '2px' }}>{m}</div>
                            </div>
                        ))}
                        {/* Paliers Objectifs */}
                        {GOLDEN_MILESTONES.map(m => (
                            <div key={`golden-${m}`} style={{ position: 'absolute', left: `${getPosition(m)}%`, top: '50%', transform: 'translate(-50%, -50%)', zIndex: 1, cursor: 'help' }}
                                onMouseEnter={(e) => setActiveTooltip({ content: <div>Palier Objectif: {m} PV</div>, rect: e.currentTarget.getBoundingClientRect() })}
                                onMouseLeave={() => setActiveTooltip(null)}
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" style={{ fill: '#ffd700', filter: 'drop-shadow(0 0 3px #ffd700)' }}><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
                                <div style={{ position: 'absolute', top: '-18px', left: '50%', transform: 'translateX(-50%)', fontSize: '0.7em', color: '#ffd700', background: 'rgba(30,30,30,0.8)', padding: '0 3px', borderRadius: '2px' }}>{m}</div>
                            </div>
                        ))}
                        {/* Paliers Centauriens */}
                        {game.players.map(p => {
                            return p.centaurienMilestone.map((m, idx) => (
                                <div key={`centaurien-${p.id}-${idx}`} style={{ position: 'absolute', left: `${getPosition(m)}%`, top: '50%', transform: 'translate(-50%, -50%)', zIndex: 1, cursor: 'help' }}
                                    onMouseEnter={(e) => setActiveTooltip({ content: <div>Message Centaurien ({p.name}): {m} PV</div>, rect: e.currentTarget.getBoundingClientRect() })}
                                    onMouseLeave={() => setActiveTooltip(null)}
                                >
                                    <span style={{ fontSize: '12px', filter: 'drop-shadow(0 0 2px #fff)' }}>📩</span>
                                    <div style={{ position: 'absolute', top: '-20px', left: '50%', transform: 'translateX(-50%)', fontSize: '0.7em', color: '#aaa', background: 'rgba(30,30,30,0.8)', padding: '0 3px', borderRadius: '2px' }}>{m}</div>
                                </div>
                            ));
                        })}
                        {/* Joueurs */}
                        {game.players.map(p => {
                            const playersAtScore = game.players.filter(other => other.score === p.score).sort((a,b) => a.id.localeCompare(b.id));
                            const indexAtScore = playersAtScore.findIndex(other => other.id === p.id);
                            const offset = indexAtScore * 16 + 12;
                            
                            return (
                                <div key={p.id} style={{
                                    position: 'absolute',
                                    left: `${getPosition(p.score)}%`,
                                    top: `${offset}px`,
                                    width: '14px',
                                    height: '14px',
                                    borderRadius: '50%',
                                    backgroundColor: p.color,
                                    border: '2px solid rgba(255, 255, 255, 0.8)',
                                    boxShadow: `0 0 4px ${p.color}, 0 0 6px #fff`,
                                    transform: 'translateX(-50%)',
                                    zIndex: 2,
                                    cursor: 'help',
                                    transition: 'left 0.4s ease-in-out'
                                }}
                                onMouseEnter={(e) => setActiveTooltip({ content: <div>{p.name}: {p.score} PV</div>, rect: e.currentTarget.getBoundingClientRect() })}
                                onMouseLeave={() => setActiveTooltip(null)}
                                />
                            );
                        })}
                    </div>
                </div>
                <div className="seti-objective-grid">
                    {game.board.objectiveTiles && game.board.objectiveTiles.map(tile => (
                        <div key={tile.id}
                            onClick={() => onObjectiveClick(tile.id)}
                            className={`seti-objective-tile ${interactionState.type === 'PLACING_OBJECTIVE_MARKER' ? 'active' : ''}`}
                        >
                            <div className="seti-objective-desc">{tile.description}</div>

                            {/* Piste de score avec 4 cercles */}
                            <div className="seti-objective-track">
                                {/* Ligne de connexion */}
                                <div className="seti-objective-line"></div>

                                {/* Cercles (1er, 2eme, Autre, Autre) */}
                                {[tile.rewards.first, tile.rewards.second, tile.rewards.others, tile.rewards.others].map((pv, idx) => {
                                    const markerPlayerId = tile.markers[idx];
                                    const player = markerPlayerId ? game.players.find(p => p.id === markerPlayerId) : null;

                                    const currentPlayer = game.players[game.currentPlayerIndex];
                                    const isPlacingMarker = interactionState.type === 'PLACING_OBJECTIVE_MARKER';
                                    const hasMarkerOnTile = tile.markers.includes(currentPlayer.id);
                                    const isNextAvailable = isPlacingMarker && !hasMarkerOnTile && idx === tile.markers.length;

                                    let statusText = "";
                                    let statusColor = "";
                                    let actionText: string | null = null;
                                    let milestoneText: string | null = null;

                                    if (player) {
                                        statusText = `Atteint par ${player.name}`;
                                        statusColor = player.color || "#ccc";
                                    } else if (isNextAvailable) {
                                        statusText = "Disponible";
                                        statusColor = "#4a9eff";
                                        actionText = "Cliquez pour placer un marqueur";
                                    } else if (hasMarkerOnTile) {
                                        statusText = "Déjà validé";
                                        statusColor = "#aaa";
                                    } else {
                                        statusText = "Indisponible";
                                        statusColor = "#ff6b6b";
                                        if (idx === tile.markers.length) {
                                            const nextMilestone = GOLDEN_MILESTONES.find(m => !currentPlayer.claimedGoldenMilestones.includes(m));
                                            if (nextMilestone) {
                                                milestoneText = `Atteindre ${nextMilestone} PVs pour sélectionner l'objectif`;
                                            } else {
                                                actionText = "Tous les paliers atteints";
                                            }
                                        } else {
                                            actionText = "Nécessite le palier précédent";
                                        }
                                    }

                                    const tooltipContent = (
                                        <div style={{ textAlign: 'center' }}>
                                            <div style={{ fontWeight: 'bold', marginBottom: '4px', color: statusColor }}>{statusText}</div>
                                            <div style={{ fontSize: '0.9em', color: '#ccc' }}>Gain : <span style={{ color: '#ffd700' }}>{pv} PV</span></div>
                                            {milestoneText && <div style={{ fontSize: '0.8em', color: '#4a9eff', marginTop: '4px', fontStyle: 'italic' }}>{milestoneText}</div>}
                                            {actionText && <div style={{ fontSize: '0.8em', color: '#aaa', marginTop: '4px', fontStyle: 'italic' }}>{actionText}</div>}
                                        </div>
                                    );

                                    let markerClass = 'seti-objective-marker';
                                    if (player) markerClass += ' occupied';
                                    else if (isNextAvailable) markerClass += ' available';
                                    else markerClass += ' default';

                                    return (
                                        <div key={idx} 
                                            className={markerClass}
                                            style={player ? { backgroundColor: player.color || '#fff' } : {}}
                                            onMouseEnter={(e) => {
                                                const rect = e.currentTarget.getBoundingClientRect();
                                                setActiveTooltip({ content: tooltipContent, rect });
                                            }}
                                            onMouseLeave={() => setActiveTooltip(null)}
                                        >
                                            {player ? '' : pv}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};