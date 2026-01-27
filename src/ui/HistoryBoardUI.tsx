import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card, Game, InteractionState } from '../core/types';
import { CardTooltip } from './CardTooltip';
import './HistoryBoardUI.css';

export interface HistoryEntry {
    id: string;
    message: string;
    playerId?: string;
    previousState?: Game;
    previousInteractionState: InteractionState;
    previousPendingInteractions: InteractionState[];
    timestamp: number;
    sequenceId?: string;
}

export const RESOURCE_CONFIG: Record<string, { label: string, plural: string, icon: string, color: string, regex: RegExp }> = {
    CREDIT: {
        label: 'Crédit', plural: 'Crédits', icon: '₢', color: '#ffd700',
        regex: /Crédit(?:s?)|crédit(?:s?)/
    },
    ENERGY: {
        label: 'Énergie', plural: 'Énergie', icon: '⚡', color: '#4caf50',
        regex: /Énergie|énergie|Energie|energie/
    },
    MEDIA: {
        label: 'Média', plural: 'Médias', icon: '🎤', color: '#ff6b6b',
        regex: /Média(?:s?)|Media(?:s?)|média(?:s?)|media(?:s?)/
    },
    DATA: {
        label: 'Donnée', plural: 'Données', icon: '💾', color: '#03a9f4',
        regex: /Donnée(?:s?)|donnée(?:s?)|Data|data/
    },
    CARD: {
        label: 'Carte', plural: 'Cartes', icon: '🃏', color: '#aaffaa',
        regex: /Carte(?:s?)|carte(?:s?)/
    },
    PV: {
        label: 'PV', plural: 'PV', icon: '🏆', color: '#fff',
        regex: /\bPV\b/
    }
};

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

    const formatHistoryMessage = (message: string) => {
        const resourcePattern = Object.values(RESOURCE_CONFIG).map(c => c.regex.source).join('|');
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

            for (const config of Object.values(RESOURCE_CONFIG)) {
                if (new RegExp(`^${config.regex.source}$`).test(part)) {
                    return <span key={index} title={config.label} className="seti-history-resource-icon" style={{ color: config.color }}>{config.icon}</span>;
                }
            }

            return part;
        });
    };

    return (
        <div className="seti-history-wrapper">
            <div className={`seti-foldable-container seti-history-container seti-icon-panel ${isHistoryOpen ? 'open' : 'collapsed'}`}>
                <div className="seti-foldable-header" onClick={() => setIsHistoryOpen(!isHistoryOpen)}>
                    <span className="panel-icon">📜</span>
                    <span className="panel-title seti-history-title">Historique</span>
                    {historyLog.length > 0 && historyLog[historyLog.length - 1].previousState && (
                        <button
                            className="panel-title seti-history-undo-btn"
                            onClick={(e) => { e.stopPropagation(); onUndo(); }}
                            title="Annuler la dernière action"
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
                                            {player && !entry.message.startsWith(player.name) && <strong style={{ color: color }}>{player.name} </strong>}
                                            {formatHistoryMessage(entry.message)}
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