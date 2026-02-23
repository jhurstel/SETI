import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card, Game, Technology, TechnologyCategory, CardType, Bonus, HistoryEntry } from '../core/types';
import { CardTooltip } from './components/CardTooltip';
import './HistoryBoardUI.css';
import { ResourceSystem } from '../systems/ResourceSystem';

interface HistoryBoardUIProps {
    historyLog: HistoryEntry[];
    game: Game;
    onUndo: () => void;
    setActiveTooltip: (tooltip: { content: React.ReactNode, rect: DOMRect } | null) => void;
}

export const HistoryBoardUI: React.FC<HistoryBoardUIProps> = ({ historyLog, game, onUndo, setActiveTooltip }) => {
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
                const cRound = searchIn(game.decks.roundDecks[key as any]);
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

        return message.split(splitRegex).map((part, index) => {
            if (part.startsWith('"') && part.endsWith('"')) {
                const cardName = part.slice(1, -1);
                if (!cardName) return part;
                
                const card = findCardByName(cardName);
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
                            "{cardName}"
                        </span>
                    );
                }

                const tech = findTechByName(cardName);
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
                            "{cardName}"
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

            for (const config of Object.values(ResourceSystem.RESOURCE_CONFIG)) {
                if (new RegExp(`^${config.regex.source}$`).test(part)) {
                    return <span key={index} title={config.label} className="seti-history-resource-icon" style={{ color: config.color }}>{config.icon}</span>;
                }
            }

            return part;
        });
    };

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
                    {canUndo && (
                        <button
                            className="panel-title seti-history-undo-btn"
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

                            const isSequence = !!entry.sequenceId;
                            const prevEntry = index > 0 ? historyLog[index - 1] : null;
                            const isSequenceChild = isSequence && prevEntry && prevEntry.sequenceId === entry.sequenceId;

                            let player = entry.playerId ? game.players.find(p => p.id === entry.playerId) : null;
                            if (!player) {
                                player = game.players.find(p => entry.message.startsWith(p.name));
                            }

                            const color = player ? (player.color || '#ccc') : '#ccc';
                            return (
                                <div key={entry.id} className="seti-history-item" style={{
                                    borderLeft: `3px solid ${color}`,
                                    backgroundColor: isSequenceChild ? 'rgba(255,255,255,0.02)' : 'transparent'
                                }}>
                                    {isSequenceChild && (
                                        <div className="seti-history-sequence-indicator">
                                            └─
                                        </div>
                                    )}
                                    <div className="seti-history-message">
                                        <span className={`seti-history-text ${isSequenceChild ? 'child' : ''}`}>
                                            {player ? (
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