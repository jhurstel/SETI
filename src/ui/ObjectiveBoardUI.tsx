import React, { useState, useEffect } from 'react';
import { Game, InteractionState, GOLDEN_MILESTONES } from '../core/types';
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

    return (
        <div className={`seti-foldable-container seti-icon-panel seti-objective-container ${isObjectivesOpen ? 'open' : 'collapsed'}`}>
            <div className="seti-foldable-header" onClick={() => setIsObjectivesOpen(!isObjectivesOpen)}>
                <span className="panel-icon">🏆</span>
                <span className="panel-title">Objectifs</span>
            </div>
            <div className="seti-foldable-content">
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