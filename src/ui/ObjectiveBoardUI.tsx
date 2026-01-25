import React, { useState, useEffect } from 'react';
import { Game, InteractionState, GOLDEN_MILESTONES } from '../core/types';

interface ObjectiveBoardUIProps {
    game: Game;
    interactionState: InteractionState;
    onObjectiveClick: (tileId: string) => void;
    setActiveTooltip: (tooltip: { content: React.ReactNode, rect: DOMRect } | null) => void;
    isInitiallyOpen: boolean;
}

export const ObjectiveBoardUI: React.FC<ObjectiveBoardUIProps> = ({ game, interactionState, onObjectiveClick, setActiveTooltip, isInitiallyOpen }) => {
    const [isObjectivesOpen, setIsObjectivesOpen] = useState(isInitiallyOpen);

    useEffect(() => {
        setIsObjectivesOpen(isInitiallyOpen);
    }, [isInitiallyOpen]);

    return (
        <div className={`seti-foldable-container seti-icon-panel ${isObjectivesOpen ? 'open' : 'collapsed'}`} style={{ pointerEvents: 'auto' }}>
            <div className="seti-foldable-header" onClick={() => setIsObjectivesOpen(!isObjectivesOpen)}>
                <span className="panel-icon">🏆</span>
                <span className="panel-title">Objectifs</span>
            </div>
            <div className="seti-foldable-content">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {game.board.objectiveTiles && game.board.objectiveTiles.map(tile => (
                        <div key={tile.id}
                            onClick={() => onObjectiveClick(tile.id)}
                            style={{
                                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                border: interactionState.type === 'PLACING_OBJECTIVE_MARKER' ? '1px solid #4a9eff' : '1px solid #555',
                                borderRadius: '6px',
                                padding: '8px',
                                display: 'flex',
                                cursor: interactionState.type === 'PLACING_OBJECTIVE_MARKER' ? 'pointer' : 'default',
                                boxShadow: interactionState.type === 'PLACING_OBJECTIVE_MARKER' ? '0 0 10px rgba(74, 158, 255, 0.3)' : 'none',
                                flexDirection: 'column',
                                gap: '4px',
                                minHeight: '100px'
                            }}>
                            <div style={{ fontSize: '0.7em', color: '#ccc', fontStyle: 'italic', marginBottom: 'auto' }}>{tile.description}</div>

                            {/* Piste de score avec 4 cercles */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px', position: 'relative', padding: '0 5px' }}>
                                {/* Ligne de connexion */}
                                <div style={{ position: 'absolute', top: '50%', left: '10px', right: '10px', height: '2px', backgroundColor: '#555', zIndex: 0 }}></div>

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

                                    return (
                                        <div key={idx} style={{
                                            width: '22px', height: '22px', borderRadius: '50%',
                                            backgroundColor: player ? (player.color || '#fff') : (isNextAvailable ? 'rgba(74, 158, 255, 0.3)' : '#222'),
                                            border: player ? '2px solid #fff' : (isNextAvailable ? '2px solid #4a9eff' : '1px solid #777'),
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            zIndex: 1, fontSize: '0.75em', fontWeight: 'bold',
                                            color: player ? '#000' : '#fff',
                                            boxShadow: isNextAvailable ? '0 0 8px #4a9eff' : (player ? '0 0 4px rgba(0,0,0,0.5)' : 'none'),
                                            transform: isNextAvailable ? 'scale(1.2)' : 'scale(1)',
                                            transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                                            cursor: isNextAvailable ? 'pointer' : 'help',
                                        }}
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