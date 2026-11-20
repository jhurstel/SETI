import React, { useRef } from 'react';
import { SpeciesSystem } from '../systems/SpeciesSystem';
import { TurnManager } from '../engine/TurnManager';
import { VictoryPointsIcon, CentaurienMessageIcon } from './components/GameIcons';
import { useFoldablePanel } from './hooks/useFoldablePanel';
import { Game, GamePhase, InteractionState, GOLDEN_MILESTONES, NEUTRAL_MILESTONES } from '../core/types';
import { SlotTooltip } from './components/SlotTooltip';
import { SLOT_COLORS } from './styles/slotColors';
import { ObjectiveSymbol } from './components/ObjectiveSymbol';
import './ObjectiveBoardUI.css';

interface ObjectiveBoardUIProps {
    game: Game;
    interactionState: InteractionState;
    onObjectiveClick: (tileId: string) => void;
    setActiveTooltip: (tooltip: { content: React.ReactNode, rect: DOMRect } | null) => void;
}

/** Palier de la piste de score : symbole, étiquette au-dessus, infobulle (titre, effet) */
interface ScoreMilestone {
    key: string;
    score: number;
    icon: React.ReactNode;
    label: React.ReactNode;
    title: string;
    effect: string;
    titleColor?: string;
    effectColor?: string;
    /** Palier déjà atteint (Centaurien) : estompé */
    dim?: boolean;
}

/** Paliers regroupés par case (même score), dans l'ordre de la piste */
const groupByScore = (milestones: ScoreMilestone[]): ScoreMilestone[][] => {
    const groups = new Map<number, ScoreMilestone[]>();
    milestones.forEach(m => groups.set(m.score, [...(groups.get(m.score) ?? []), m]));
    return [...groups.values()].sort((a, b) => a[0].score - b[0].score);
};

const ObjectiveBoardUIView: React.FC<ObjectiveBoardUIProps> = ({ game, interactionState, onObjectiveClick, setActiveTooltip }) => {
    const isInitiallyOpen = interactionState.type === 'PLACING_OBJECTIVE_MARKER';
    const panelRef = useRef<HTMLDivElement>(null);
    const panel = useFoldablePanel(panelRef, { tutorialTarget: 'objectives', forcedOpen: isInitiallyOpen });

    const maxScore = Math.max(...game.players.map(p => p.score));
    const trackMax = maxScore > 100 ? Math.ceil(maxScore / 100) * 100 : 100;
    const getPosition = (val: number) => (val / trackMax) * 100;

    // Infobulle d'un palier ou d'une tuile : nom en gras, effet en italique (même format que les astéroïdes et comètes)
    const showInfoTooltip = (e: React.MouseEvent, title: string, effect: string, titleColor?: string, effectColor = '#aaa') => setActiveTooltip({
        content: <div className="objective-tooltip"><div style={{ fontWeight: 'bold', color: titleColor }}>{title}</div><div style={{ fontSize: '0.8em', marginTop: '4px', color: effectColor, fontStyle: 'italic' }}>{effect}</div></div>,
        rect: e.currentTarget.getBoundingClientRect()
    });
    const neutralEffect = (m: number) => {
        const left = game.neutralMilestonesAvailable?.[m] ?? 0;
        return left > 0
            ? `Chaque joueur qui l'atteint place une trace de vie neutre sur un emplacement libre des plateaux Alien (${left} restante${left > 1 ? 's' : ''})`
            : 'Plus aucune trace de vie neutre à placer';
    };

    // Paliers de la piste de score, avec leur infobulle (titre, effet)
    const milestones: ScoreMilestone[] = [
        ...(game.players.length < 4 ? NEUTRAL_MILESTONES.map(m => ({
            key: `neutral-${m}`, score: m, title: `Palier neutre : ${m} PV`, effect: neutralEffect(m),
            icon: <svg width="14" height="14" viewBox="0 0 24 24" className="score-milestone-neutral-icon"><path d="M12 2L2 12l10 10 10-10L12 2z"/></svg>,
            label: <div className="score-milestone-neutral-label">{m}</div>,
        })) : []),
        ...GOLDEN_MILESTONES.map(m => ({
            key: `golden-${m}`, score: m, title: `Palier objectif : ${m} PV`,
            effect: "Chaque joueur qui l'atteint place, à la fin de son tour, un marqueur sur une tuile objectif où il n'en a pas encore : ses PV sont comptés en fin de partie",
            icon: <svg width="16" height="16" viewBox="0 0 24 24" className="score-milestone-golden-icon"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>,
            label: <div className="score-milestone-golden-label">{m}</div>,
        })),
        // Les paliers Centauriens restent sur la piste une fois atteints, avec ce qu'ils ont rapporté (en vert)
        ...game.players.flatMap(p => p.centaurienMilestones.map(m => ({
            key: m.id, score: m.score, title: `Palier Centaurien (${p.name}) : ${m.score} PV`, titleColor: p.color,
            effect: m.resolved ?? (m.cardName ? `Effet de réception de « ${m.cardName} » à l'arrivée sur ce palier` : "Choix d'une tuile Message à l'arrivée sur ce palier"),
            effectColor: m.resolved ? '#7fff7f' : '#aaa', dim: !!m.resolved,
            icon: <span className="score-milestone-centaurien-icon" style={{ filter: `drop-shadow(0 0 2px ${p.color})` }}><CentaurienMessageIcon size={16} /></span>,
            label: <div className={`score-milestone-centaurien-label ${m.resolved ? 'resolved' : ''}`}>{m.resolved ? '✓' : m.score}</div>,
        }))),
        ...(game.exertienMilestones ?? []).map(m => {
            // Coût de la carte jouée à ce palier (moteur) : 1 crédit au 2e palier
            const cost = SpeciesSystem.exertienCardCost(game, m);
            return {
                key: `exertien-${m}`, score: m, title: `Palier Exertien : ${m} PV`,
                effect: `Chaque joueur qui l'atteint peut jouer une de ses cartes Exertien${cost > 0 ? ` : jouer une carte coûte ${cost} crédit${cost > 1 ? 's' : ''}` : ''}`,
                icon: <span className="score-milestone-exertien-icon">☣️</span>,
                label: <div className="score-milestone-exertien-label">{m}</div>,
            };
        }),
    ];

    return (
        <div ref={panelRef} data-tutorial="objectives" onMouseLeave={panel.onMouseLeave}
            className={`seti-foldable-container seti-icon-panel seti-objective-container ${panel.stateClass}`}>
            <div className="seti-foldable-header" onClick={panel.toggle}>
                <span className="panel-icon"><VictoryPointsIcon size={24} /></span>
                <span className="panel-title">Objectifs</span>
            </div>
            <div className="seti-foldable-content">
                {/* Statut des manches et des joueurs qui ont passé */}
                <div className="seti-round-status">
                    <span className="seti-round-label">Manche</span>
                    {Array.from({ length: game.maxRounds }, (_, i) => i + 1).map(round => {
                        const status = round < game.currentRound || game.phase === GamePhase.FINAL_SCORING ? 'done' : round === game.currentRound ? 'current' : 'upcoming';
                        if (status === 'upcoming') return <span key={round} className={`seti-round-pill ${status}`}>{round}</span>;
                        // Manche passée ou en cours : le joueur qui l'a commencée, à sa couleur
                        const first = TurnManager.roundFirstPlayer(game, round);
                        return (
                            <span key={round} className={`seti-round-pill ${status} help-cursor`}
                                onMouseEnter={(e) => setActiveTooltip({
                                    content: <div className="objective-tooltip"><div style={{ fontWeight: 'bold' }}>Manche {round}{status === 'current' ? ' (en cours)' : ''}</div>
                                        <div className="tooltip-caption">Commencée par <span style={{ color: first.color, fontWeight: 'bold' }}>{first.name}</span></div></div>,
                                    rect: e.currentTarget.getBoundingClientRect(),
                                })}
                                onMouseLeave={() => setActiveTooltip(null)}>{round}</span>
                        );
                    })}
                    <span className="seti-round-passed">
                        {game.players.filter(p => p.hasPassed).length > 0
                            ? `Ont passé : ${game.players.filter(p => p.hasPassed).map(p => p.name).join(', ')}`
                            : "Personne n'a encore passé"}
                    </span>
                </div>
                <div className="seti-score-track score-track-frame">
                    <div className="score-track-bar">
                        {/* Ticks */}
                        {Array.from({ length: trackMax / 5 + 1 }).map((_, i) => {
                            const score = i * 5;
                            const isMajor = score % 25 === 0 || score === trackMax;
                            if (score > trackMax) return null;
                            return (
                                <div key={`tick-${score}`} style={{ position: 'absolute', left: `${getPosition(score)}%`, top: '4px', width: '1px', height: isMajor ? '8px' : '4px', background: isMajor ? '#999' : '#666' }}>
                                    {isMajor && <div className="score-track-label">{score}</div>}
                                </div>
                            );
                        })}

                        {/* Paliers (neutres, objectifs, Centauriens, Exertiens) : ceux d'une même case sont regroupés, leur infobulle les liste tous */}
                        {groupByScore(milestones).map(group => (
                            <div key={`milestones-${group[0].score}`} className="score-milestone-group" style={{ left: `${getPosition(group[0].score)}%` }}
                                onMouseEnter={(e) => setActiveTooltip({
                                    content: (
                                        <div className="objective-tooltip score-milestone-tooltip">
                                            {group.map(m => (
                                                <div key={m.key} className="score-milestone-tooltip-item">
                                                    <div style={{ fontWeight: 'bold', color: m.titleColor }}>{m.title}</div>
                                                    <div className="score-milestone-tooltip-effect" style={{ color: m.effectColor ?? '#aaa' }}>{m.effect}</div>
                                                </div>
                                            ))}
                                        </div>
                                    ),
                                    rect: e.currentTarget.getBoundingClientRect(),
                                })}
                                onMouseLeave={() => setActiveTooltip(null)}
                            >
                                {group.map(m => <span key={m.key} className="score-milestone-item" style={{ opacity: m.dim ? 0.6 : 1 }}>{m.icon}</span>)}
                                {group[0].label}
                            </div>
                        ))}
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
                            {/* Symbole de la tuile, description en infobulle */}
                            <div className="seti-objective-symbol"
                                onMouseEnter={(e) => showInfoTooltip(e, `${tile.name} ${tile.side}`, tile.description)}
                                onMouseLeave={() => setActiveTooltip(null)}
                            >
                                <ObjectiveSymbol tile={tile} />
                            </div>

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

                                    let statusText: string;
                                    let statusColor: string;
                                    let note: string | null = null;

                                    if (player) {
                                        statusText = `Atteint par ${player.name}`;
                                        statusColor = player.color || "#ccc";
                                    } else if (isNextAvailable) {
                                        statusText = "Disponible";
                                        statusColor = SLOT_COLORS.available;
                                        note = "Cliquez pour placer un marqueur";
                                    } else if (hasMarkerOnTile) {
                                        statusText = "Déjà validé";
                                        statusColor = SLOT_COLORS.neutral;
                                    } else if (idx === tile.markers.length) {
                                        // Premier emplacement libre : il ne se prend qu'en franchissant le prochain palier de score
                                        const nextMilestone = GOLDEN_MILESTONES.find(m => !currentPlayer.claimedGoldenMilestones.includes(m));
                                        if (nextMilestone) {
                                            statusText = "Indisponible";
                                            statusColor = SLOT_COLORS.unavailable;
                                            note = `Nécessite d'atteindre le prochain palier (${nextMilestone} PV)`;
                                        } else {
                                            statusText = "Indisponible";
                                            statusColor = SLOT_COLORS.unavailable;
                                            note = "Tous les paliers sont atteints";
                                        }
                                    } else {
                                        statusText = "Indisponible";
                                        statusColor = SLOT_COLORS.unavailable;
                                        note = "Nécessite l'emplacement précédent";
                                    }

                                    const tooltipContent = <SlotTooltip status={statusText} statusColor={statusColor} value={<VictoryPointsIcon amount={pv} size={18} />} note={note} />;

                                    let markerClass = 'seti-objective-marker';
                                    if (player) markerClass += ' occupied';
                                    else if (isNextAvailable) markerClass += ' available';
                                    // Emplacement qui attend le précédent : grisé (le premier libre reste clair)
                                    else if (idx > tile.markers.length) markerClass += ' default requires-previous';
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
                                            {/* Emplacement libre : jeton PV de la récompense, comme sur les autres plateaux */}
                                            {player ? '' : <VictoryPointsIcon amount={pv} size={22} />}
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

/** Mémoïsé : redessiné seulement quand ses props changent (partie, interaction…), pas à chaque rendu de BoardUI */
export const ObjectiveBoardUI = React.memo(ObjectiveBoardUIView);
