import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card, Game, Technology, TechnologyCategory, CardType, Bonus, HistoryEntry } from '../core/types';
import { CardTooltip } from '../ui/components/CardTooltip';
import './HistoryBoardUI.css';
import { ResourceSystem } from '../systems/ResourceSystem';
import { ResourceIcon, ResourceIconKind } from './components/GameIcons';
import { ReservationIcon } from './components/ObjectiveSymbol';

// Ressources dessinées avec les pastilles du livret (les autres gardent leur symbole texte)
const RESOURCE_ICON_KINDS: Record<string, ResourceIconKind> = { CREDIT: 'credit', ENERGY: 'energy', MEDIA: 'media', DATA: 'data' };

interface HistoryBoardUIProps {
    historyLog: HistoryEntry[];
    game: Game;
    onUndo: () => void;
    /** Retour au début du dernier tour du joueur (absent : rien à annuler) */
    onUndoTurn?: () => void;
    setActiveTooltip: (tooltip: { content: React.ReactNode, rect: DOMRect } | null) => void;
}

export const HistoryBoardUI: React.FC<HistoryBoardUIProps> = ({ historyLog, game, onUndo, onUndoTurn, setActiveTooltip }) => {
    const [isHistoryOpen, setIsHistoryOpen] = useState(true);
    const historyContentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (historyContentRef.current) {
            historyContentRef.current.scrollTo({ top: historyContentRef.current.scrollHeight, behavior: 'smooth' });
        }
    }, [historyLog]);

    const findCardByName = useCallback((name: string): Card | undefined => {
        if (!name) return undefined;
        const cleanName = name.trim();
        const searchIn = (list?: Card[]) => list?.find(c => c.name === cleanName);

        for (const p of game.players) {
            const c = searchIn(p.cards);
            if (c) return c;
            const cPlayed = searchIn(p.playedCards);
            if (cPlayed) return cPlayed;
            const cReserved = searchIn(p.reservedCards);
            if (cReserved) return cReserved;
            
            // Recherche dans les missions (reconstruction partielle de la carte)
            if (p.missions) {
                const mission = p.missions.find(m => m.name === cleanName);
                if (mission) {
                    if (mission.originalCard) return mission.originalCard;
                    return {
                        id: mission.cardId,
                        name: mission.name,
                        description: mission.description,
                        type: CardType.CONDITIONAL_MISSION,
                        cost: 0,
                    } as Card;
                }
            }
        }
        const cRow = searchIn(game.decks.cardRow);
        if (cRow) return cRow;

        const cDeck = searchIn(game.decks.cards);
        if (cDeck) return cDeck;

        const cDiscard = searchIn(game.decks.discardPile);
        if (cDiscard) return cDiscard;

        if (game.decks.roundDecks) {
            for (const key in game.decks.roundDecks) {
                const cRound = searchIn(game.decks.roundDecks[key]);
                if (cRound) return cRound;
            }
        }

        if (game.species) {
            for (const s of game.species) {
                const cSpecies = searchIn(s.cards);
                if (cSpecies) return cSpecies;
            }
        }

        return undefined;
    }, [game]);

    const findTechByName = useCallback((name: string): Technology | undefined => {
        if (!name) return undefined;
        const cleanName = name.trim();
        
        // 1. Check available
        let tech = game.board.technologyBoard.available?.find(t => t.name === cleanName);
        if (tech) return tech;

        // 2. Check slots
        if (game.board.technologyBoard.categorySlots) {
             for (const slot of game.board.technologyBoard.categorySlots) {
                 tech = slot.technologies.find(t => t.name === cleanName);
                 if (tech) return tech;
             }
        }

        // 3. Check players
        for (const p of game.players) {
            tech = p.technologies.find(t => t.name === cleanName);
            if (tech) return tech;
        }

        return undefined;
    }, [game]);

    const renderTechTooltip = (tech: Technology) => {
        let categoryColor = '#fff';
        if (tech.type === TechnologyCategory.EXPLORATION) categoryColor = '#ffeb3b';
        if (tech.type === TechnologyCategory.OBSERVATION) categoryColor = '#ff6b6b';
        if (tech.type === TechnologyCategory.COMPUTING) categoryColor = '#4a9eff';

        const getTechLevel = (id: string) => {
            const parts = id.split('-');
            // Format attendu: category-level-index (ex: exploration-1-0)
            if (parts.length >= 2) {
                const level = parseInt(parts[1], 10);
                if (!isNaN(level)) {
                    if (level === 1) return 'I';
                    if (level === 2) return 'II';
                    if (level === 3) return 'III';
                    if (level === 4) return 'IV';
                    return level.toString();
                }
            }
            return '';
        };

        const level = getTechLevel(tech.id);
        const displayName = level ? `${tech.type} ${level}` : tech.name;

        const renderBonus = (bonus: Bonus) => {
            const elements = [];
            if (bonus.pv) elements.push(<span key="pv" style={{ color: '#8affc0', fontWeight: 'bold' }}>{bonus.pv} PV</span>);
            if (bonus.media) elements.push(<span key="media" style={{ color: '#ff6b6b' }}>{bonus.media} Média</span>);
            if (bonus.energy) elements.push(<span key="energy" style={{ color: '#4caf50' }}>{bonus.energy} Énergie</span>);
            if (bonus.card) elements.push(<span key="card" style={{ color: '#fff' }}>{bonus.card} Carte</span>);
            if (bonus.probe) elements.push(<span key="probe" style={{ color: '#fff', border: '1px solid #fff', padding: '0 2px', borderRadius: '2px' }}>{bonus.probe} Sonde</span>);
            if (bonus.data) elements.push(<span key="data" style={{ color: '#fff', border: '1px solid #aaa', padding: '0 2px', borderRadius: '2px', backgroundColor: '#333' }}>{bonus.data} Data</span>);
            if (bonus.token) elements.push(<span key="token" style={{ color: '#fff', border: '1px solid #fff', padding: '0 2px', borderRadius: '50%', backgroundColor: '#555' }}>{bonus.token} Token</span>);
            return <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'center' }}>{elements}</div>;
        };

        return (
            <div style={{ textAlign: 'center', minWidth: '200px' }}>
                <div style={{ borderBottom: '1px solid #555', paddingBottom: '4px', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 'bold', color: categoryColor, fontSize: '1.1em' }}>{displayName}</span>
                </div>
                <div style={{ fontSize: '0.9em', marginBottom: '8px', color: '#ccc' }}>{tech.description || tech.shorttext}</div>
                <div style={{ fontSize: '0.8em' }}>
                    <div style={{ color: '#aaa', marginBottom: '2px' }}>Gains immédiats :</div>
                    {renderBonus(tech.bonus)}
                </div>
            </div>
        );
    };

    const formatHistoryMessage = (message: string) => {
        const resourcePattern = Object.values(ResourceSystem.RESOURCE_CONFIG).map(c => c.regex.source).join('|');
        const splitRegex = new RegExp(`(<strong>[\\s\\S]*?<\\/strong>|${resourcePattern}|"[^"]+")`, 'g');

        const parts = message.split(splitRegex);
        return parts.map((part, index) => {
            if (part.startsWith('"') && part.endsWith('"')) {
                const name = part.slice(1, -1);
                if (!name) return part;
                
                const card = findCardByName(name);
                if (card) {
                    return (
                        <span
                            key={index}
                            className="seti-history-card-ref"
                            onMouseEnter={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setActiveTooltip({ content: <CardTooltip card={card} />, rect });
                            }}
                            onMouseLeave={() => setActiveTooltip(null)}
                        >
                            "{card.name}"
                        </span>
                    );
                }

                const tech = findTechByName(name);
                if (tech) {
                    return (
                        <span
                            key={index}
                            className="seti-history-card-ref"
                            onMouseEnter={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setActiveTooltip({ content: renderTechTooltip(tech), rect });
                            }}
                            onMouseLeave={() => setActiveTooltip(null)}
                        >
                            "{tech.type} {tech.name}"
                        </span>
                    );
                }
            }

            if (part.includes('<strong>')) {
                const subParts = part.split(/(<strong>[\s\S]*?<\/strong>)/g);
                return (
                    <span key={index}>
                        {subParts.map((subPart, subIndex) => {
                            if (subPart.startsWith('<strong>') && subPart.endsWith('</strong>')) {
                                return <strong key={subIndex}>{subPart.replace(/<\/?strong>/g, '')}</strong>;
                            }
                            return subPart;
                        })}
                    </span>
                );
            }

            // Une ressource devient une icône seulement après une quantité (« 2 Crédits ») : « la carte » reste en toutes lettres
            const afterAmount = index > 0 && /\d\s*$/.test(parts[index - 1]);
            for (const [key, config] of Object.entries(ResourceSystem.RESOURCE_CONFIG)) {
                if (afterAmount && new RegExp(`^${config.regex.source}$`).test(part)) {
                    const kind = RESOURCE_ICON_KINDS[key];
                    const icon = kind ? <ResourceIcon kind={kind} size={14} /> : key === 'RESERVATION' ? <ReservationIcon size={14} /> : config.icon;
                    return <span key={index} className="seti-history-resource-icon" onMouseEnter={(e) => setActiveTooltip({ content: config.label, rect: e.currentTarget.getBoundingClientRect() })} onMouseLeave={() => setActiveTooltip(null)} style={{ color: config.color }}>{icon}</span>;
                }
            }

            return part;
        });
    };

    // Une entrée est une conséquence (indentée) si elle appartient à la même séquence que l'action qui l'ouvre
    // (gains, bonus, interactions résolues) ; childParents donne le joueur de cette action.
    const childFlags: boolean[] = [];
    const childParents: (string | undefined)[] = [];
    let headSequence: string | undefined;
    let headPlayer: string | undefined;
    historyLog.forEach(entry => {
        if (entry.message.startsWith('---')) {
            headSequence = undefined;
            childFlags.push(false);
            childParents.push(undefined);
            return;
        }
        const isChild = !!entry.sequenceId && entry.sequenceId === headSequence;
        if (!isChild) {
            headSequence = entry.sequenceId;
            headPlayer = entry.playerId;
        }
        childFlags.push(isChild);
        childParents.push(isChild ? headPlayer : undefined);
    });

    const lastEntry = historyLog.length > 0 ? historyLog[historyLog.length - 1] : null;
    const canUndo = lastEntry && !lastEntry.message.startsWith('---') && (
        !!lastEntry.previousState || 
        (!!lastEntry.sequenceId && !!historyLog.find(e => e.sequenceId === lastEntry.sequenceId)?.previousState)
    );

    return (
        <div className="seti-history-wrapper">
            <div className={`seti-foldable-container seti-history-container seti-icon-panel ${isHistoryOpen ? 'open' : 'collapsed'}`}>
                <div className="seti-foldable-header" onClick={() => setIsHistoryOpen(!isHistoryOpen)}>
                    <span className="panel-icon">📜</span>
                    <span className="panel-title seti-history-title">Historique</span>
                    {onUndoTurn && (
                        <button
                            className="panel-title seti-history-undo-btn"
                            onMouseEnter={(e) => setActiveTooltip({ content: 'Revenir au début de mon dernier tour', rect: e.currentTarget.getBoundingClientRect() })}
                            onMouseLeave={() => setActiveTooltip(null)}
                            onClick={(e) => { e.stopPropagation(); onUndoTurn(); }}
                        >
                            {/* Deux flèches superposées, décalées en diagonale */}
                            <span className="seti-undo-turn-icon" aria-label="Revenir au début du tour">
                                <span>↩</span>
                                <span>↩</span>
                            </span>
                        </button>
                    )}
                    {canUndo && (
                        <button
                            className="panel-title seti-history-undo-btn"
                            onMouseEnter={(e) => setActiveTooltip({ content: 'Annuler la dernière action', rect: e.currentTarget.getBoundingClientRect() })}
                            onMouseLeave={() => setActiveTooltip(null)}
                            onClick={(e) => { e.stopPropagation(); onUndo(); }}
                        >
                            ↩
                        </button>
                    )}
                </div>
                <div className="seti-foldable-content seti-history-content" ref={historyContentRef}>
                    <div className="seti-history-list">
                        {historyLog.length === 0 && <div className="seti-history-empty">Aucune action</div>}
                        {historyLog.map((entry, index) => {
                            if (entry.message.startsWith('---')) {
                                return (
                                    <div key={entry.id} className="seti-history-separator">
                                        <div className="seti-history-separator-line"></div>
                                        <div className="seti-history-separator-text">{entry.message.replace(/---/g, '').trim()}</div>
                                        <div className="seti-history-separator-line"></div>
                                    </div>
                                );
                            }

                            const isSequenceChild = childFlags[index];

                            let player = entry.playerId ? game.players.find(p => p.id === entry.playerId) : null;
                            if (!player) {
                                player = game.players.find(p => entry.message.startsWith(p.name));
                            }

                            const color = player ? (player.color || '#ccc') : '#ccc';
                            return (
                                <div key={entry.id} className={`seti-history-item ${isSequenceChild ? 'child' : ''}`} style={{
                                    borderLeft: `3px solid ${color}`,
                                }}>
                                    {isSequenceChild && (
                                        <div className="seti-history-sequence-indicator">↳</div>
                                    )}
                                    <div className="seti-history-message">
                                        <span className={`seti-history-text ${isSequenceChild ? 'child' : ''}`}>
                                            {/* Conséquence d'une action du même joueur : son nom n'est pas répété */}
                                            {isSequenceChild && player && entry.playerId === childParents[index] ? (
                                                formatHistoryMessage(entry.message.startsWith(player.name) ? entry.message.substring(player.name.length).trimStart() : entry.message)
                                            ) : player ? (
                                                entry.message.startsWith(player.name) ? (
                                                    <>
                                                        <strong style={{ color: color }}>{player.name}</strong>
                                                        {formatHistoryMessage(entry.message.substring(player.name.length))}
                                                    </>
                                                ) : (
                                                    <>
                                                        <strong style={{ color: color }}>{player.name} </strong>
                                                        {formatHistoryMessage(entry.message)}
                                                    </>
                                                )
                                            ) : (
                                                formatHistoryMessage(entry.message)
                                            )}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};