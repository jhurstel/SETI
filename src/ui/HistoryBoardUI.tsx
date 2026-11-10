import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card, Game, Technology, TechnologyCategory, CardType, Bonus, HistoryEntry, SectorType } from '../core/types';
import { CardTooltip } from '../ui/components/CardTooltip';
import './HistoryBoardUI.css';
import { ResourceSystem } from '../systems/ResourceSystem';
import { ResourceIcon, ResourceIconKind, LifeTraceIcon, AnyLifeTraceIcon, VictoryPointsIcon, ActionHexIcon, RotationChevronIcon, ROTATION_CHEVRON_COLORS } from './components/GameIcons';
import { LifeTraceColor } from './styles/lifeTraceColors';
import { ReservationIcon, AnyTechIcon } from './components/ObjectiveSymbol';
import { BonusIcons, Repeated, SectorSignalIcon } from './components/BonusIcons';
import { textFor } from '../core/historyText';

// Ressources dessinées avec les pastilles du livret (les autres gardent leur symbole texte)
const RESOURCE_ICON_KINDS: Record<string, ResourceIconKind> = { CREDIT: 'credit', ENERGY: 'energy', MEDIA: 'media', CARD: 'card', DATA: 'data' };
// Traces de vie (« 2 Traces Jaunes », « 1 trace de vie rouge », « 1 trace de vie (Rouge) », « 1 trace de vie (quelconque) »)
const LIFE_TRACE_PATTERN = /[Tt]races? (?:de vie )?(?:\((?:[Rr]ouges?|[Jj]aunes?|[Bb]leu(?:es?|s)?|[Qq]uelconques?)\)|[Rr]ouges?|[Jj]aunes?|[Bb]leu(?:es?|s)?)/;
// Signal d'une couleur de secteur (« marque un signal Jaune dans le secteur … ») et anneau qui tourne (« Système Solaire (Rouge) »)
const SIGNAL_PATTERN = /[Ss]ignal (?:Rouge|Jaune|Bleu|Noir|Oumuamua)/;
const ROTATION_PATTERN = /\((?:Bleu|Rouge|Jaune)\)/;
const lifeTraceColor = (text: string): LifeTraceColor | undefined => /rouge/i.test(text) ? 'red' : /jaune/i.test(text) ? 'yellow' : /bleu/i.test(text) ? 'blue' : undefined;
// Autres gains dessinés avec leur symbole du livret, après une quantité (« obtient 2 déplacements gratuits », « 1 Token »,
// « 2 cartes Alien », « 1 Atterrissage ») ; testés avant les ressources (« carte Alien » avant « carte »)
const SYMBOL_ICONS: { label: string; plural: string; pattern: RegExp; icon: (amount: number | undefined) => React.ReactNode }[] = [
    { label: 'Déplacement', plural: 'Déplacements', pattern: /[Dd]éplacements?(?: gratuits?)?|[Mm]ouvements? gratuits?/, icon: amount => <ResourceIcon kind="movement" amount={amount} size={15} /> },
    { label: 'Token', plural: 'Tokens', pattern: /[Tt]okens?/, icon: amount => <ResourceIcon kind="token" amount={amount} size={15} /> },
    { label: 'Carte Alien', plural: 'Cartes Alien', pattern: /[Cc]artes? Alien/, icon: amount => <ResourceIcon kind="alienCard" amount={amount} size={15} /> },
    { label: 'Atterrissage', plural: 'Atterrissages', pattern: /[Aa]tterrissages?|[Aa]tterrisseurs?/, icon: amount => <Repeated amount={amount ?? 1}><ActionHexIcon kind="land" size={15} /></Repeated> },
];
const matchesWhole = (pattern: RegExp, text: string) => new RegExp(`^(?:${pattern.source})$`).test(text);

/** Infobulle d'un symbole de l'historique : sa quantité en toutes lettres (« 3 Crédits ») */
const symbolLabel = (label: string, plural = label, amount?: number): string =>
    amount !== undefined ? `${amount} ${amount > 1 ? plural : label}` : label;

interface HistoryBoardUIProps {
    historyLog: HistoryEntry[];
    game: Game;
    /** Annuler la dernière action (absent : rien d'annulable) */
    onUndo?: () => void;
    /** Retour au début du dernier tour du joueur (absent : rien à annuler) */
    onUndoTurn?: () => void;
    setActiveTooltip: (tooltip: { content: React.ReactNode, rect: DOMRect } | null) => void;
}

/** Entrées de l'historique, indentées sous leur action (panneau de la partie, fenêtre de fin de partie) */
export const HistoryList: React.FC<Pick<HistoryBoardUIProps, 'historyLog' | 'game' | 'setActiveTooltip'>> = ({ historyLog, game, setActiveTooltip }) => {
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
            return <div className="history-tech-bonus"><BonusIcons bonus={bonus} size={15} /></div>;
        };

        return (
            <div className="history-tech-tooltip">
                <div className="history-tech-tooltip-header">
                    <span style={{ fontWeight: 'bold', color: categoryColor, fontSize: '1.1em' }}>{displayName}</span>
                </div>
                <div className="history-tech-tooltip-desc">{tech.description || tech.shorttext}</div>
                <div className="history-tech-tooltip-gains">
                    <div className="history-tech-tooltip-gains-label">Gains immédiats :</div>
                    {renderBonus(tech.bonus)}
                </div>
            </div>
        );
    };

    // Joueur de cet écran : le seul humain de la partie affichée (en ligne, les autres humains y sont des robots)
    const viewerId = game.players.find(p => p.type === 'human')?.id;

    const formatHistoryMessage = (raw: string) => {
        // Passages privés (noms des cartes piochées face cachée, cartes Exertiens reçues) : lisibles seulement par leur
        // propriétaire ; les autres joueurs n'en voient que la version publique (comme en ligne, viewEntries)
        const message = viewerId ? textFor(raw, viewerId) : raw;
        const resourcePattern = Object.values(ResourceSystem.RESOURCE_CONFIG).map(c => c.regex.source).join('|');
        const symbolPattern = SYMBOL_ICONS.map(s => s.pattern.source).join('|');
        const splitRegex = new RegExp(`(<strong>[\\s\\S]*?<\\/strong>|${LIFE_TRACE_PATTERN.source}|${SIGNAL_PATTERN.source}|${ROTATION_PATTERN.source}|${symbolPattern}|${resourcePattern}|"[^"]+")`, 'g');

        const parts = message.split(splitRegex);
        // « 2 PV », « 3 Crédits » : le nombre est retiré du texte et dessiné dans l'icône (laurier, pastille, jeton) ;
        // « 2 Traces rouges », « 2 Réservations » : l'icône est répétée
        const iconKeys = ['PV', 'RESERVATION', 'SONDE', 'TECH', ...Object.keys(RESOURCE_ICON_KINDS)];
        const amounts: (number | undefined)[] = parts.map((part, index) => {
            const takesAmount = index > 0 && (matchesWhole(LIFE_TRACE_PATTERN, part)
                || SYMBOL_ICONS.some(s => matchesWhole(s.pattern, part))
                || iconKeys.some(key => new RegExp(`^${ResourceSystem.RESOURCE_CONFIG[key].regex.source}$`).test(part)));
            const amount = takesAmount ? parts[index - 1].match(/(\d+)\s*$/) : null;
            return amount ? Number(amount[1]) : undefined;
        });
        // Symbole sans quantité (trace de vie, signal) : « place une trace de vie Rouge » se lit « place <symbole> »
        const isSingleSymbol = (part: string | undefined) => !!part && (matchesWhole(LIFE_TRACE_PATTERN, part) || matchesWhole(SIGNAL_PATTERN, part));
        return parts.map((part, index) => {
            if (amounts[index + 1] !== undefined) part = part.replace(/\d+\s*$/, '');
            else if (isSingleSymbol(parts[index + 1])) part = part.replace(/(?:^|(?<= ))(?:une?|1) $/, '');
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
            const afterAmount = index > 0 && (/\d\s*$/.test(parts[index - 1]) || amounts[index] !== undefined);
            // Une trace de vie nomme toujours sa couleur : symbole avec ou sans quantité (« place une trace de vie Rouge »)
            if (matchesWhole(LIFE_TRACE_PATTERN, part)) {
                const color = lifeTraceColor(part);
                return <span key={index} className="seti-history-resource-icon" onMouseEnter={(e) => setActiveTooltip({ content: amounts[index] !== undefined ? `${amounts[index]} ${part}` : part, rect: e.currentTarget.getBoundingClientRect() })} onMouseLeave={() => setActiveTooltip(null)}><Repeated amount={amounts[index] ?? 1}>{color ? <LifeTraceIcon color={color} size={15} /> : <AnyLifeTraceIcon size={15} />}</Repeated></span>;
            }
            if (matchesWhole(SIGNAL_PATTERN, part)) {
                const sector = part.replace(/^[Ss]ignal /, '') as SectorType;
                return <span key={index} className="seti-history-resource-icon" onMouseEnter={(e) => setActiveTooltip({ content: `Signal ${sector}`, rect: e.currentTarget.getBoundingClientRect() })} onMouseLeave={() => setActiveTooltip(null)}><SectorSignalIcon sector={sector} size={15} /></span>;
            }
            if (matchesWhole(ROTATION_PATTERN, part) && /Système Solaire $/.test(parts[index - 1] ?? '')) {
                const ring = part.slice(1, -1);
                return <span key={index} className="seti-history-resource-icon" onMouseEnter={(e) => setActiveTooltip({ content: `Anneau ${ring}`, rect: e.currentTarget.getBoundingClientRect() })} onMouseLeave={() => setActiveTooltip(null)}><RotationChevronIcon color={ROTATION_CHEVRON_COLORS[ring]} size={15} /></span>;
            }
            const symbol = afterAmount ? SYMBOL_ICONS.find(s => matchesWhole(s.pattern, part)) : undefined;
            if (symbol) {
                return <span key={index} className="seti-history-resource-icon" onMouseEnter={(e) => setActiveTooltip({ content: symbolLabel(symbol.label, symbol.plural, amounts[index]), rect: e.currentTarget.getBoundingClientRect() })} onMouseLeave={() => setActiveTooltip(null)}>{symbol.icon(amounts[index])}</span>;
            }
            for (const [key, config] of Object.entries(ResourceSystem.RESOURCE_CONFIG)) {
                if (afterAmount && new RegExp(`^${config.regex.source}$`).test(part)) {
                    const kind = RESOURCE_ICON_KINDS[key];
                    const amount = amounts[index];
                    const icon = kind ? <ResourceIcon kind={kind} amount={amount} size={15} />
                        : key === 'RESERVATION' ? <Repeated amount={amount ?? 1}><ReservationIcon size={14} /></Repeated>
                        : key === 'PV' ? <VictoryPointsIcon amount={amount} size={17} />
                        : key === 'SONDE' ? <Repeated amount={amount ?? 1}><ActionHexIcon kind="launch" size={15} /></Repeated>
                        : key === 'TECH' ? <Repeated amount={amount ?? 1}><AnyTechIcon size={15} /></Repeated>
                        : config.label;
                    // Infobulle : la quantité en toutes lettres (« 3 Crédits »)
                    const tooltip = symbolLabel(config.label, key === 'PV' ? 'PV' : config.plural, amount);
                    return <span key={index} className="seti-history-resource-icon" onMouseEnter={(e) => setActiveTooltip({ content: tooltip, rect: e.currentTarget.getBoundingClientRect() })} onMouseLeave={() => setActiveTooltip(null)} style={{ color: config.color }}>{icon}</span>;
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
    // Bilan de fin de manche (revenus de chaque joueur, premier joueur, décompte final) : écrit par la commande de la
    // dernière passe, donc dans sa séquence, mais chaque ligne est indépendante (aucune n'est indentée)
    let inRoundEnd = false;
    historyLog.forEach(entry => {
        if (entry.message.startsWith('---')) {
            headSequence = undefined;
            inRoundEnd = entry.message.includes('FIN DE LA MANCHE');
            childFlags.push(false);
            childParents.push(undefined);
            return;
        }
        const isChild = !inRoundEnd && !!entry.sequenceId && entry.sequenceId === headSequence;
        if (!isChild) {
            headSequence = entry.sequenceId;
            headPlayer = entry.playerId;
        }
        childFlags.push(isChild);
        childParents.push(isChild ? headPlayer : undefined);
    });

    return (
        <div className="seti-history-list">
            {historyLog.length === 0 && <div className="seti-history-empty">Aucune action</div>}
            {historyLog.map((entry, index) => {
                if (entry.message.startsWith('---')) {
                    return (
                        <div key={entry.id} className="seti-history-separator" data-history-index={index}>
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
    );
};

const HistoryBoardUIView: React.FC<HistoryBoardUIProps> = ({ historyLog, game, onUndo, onUndoTurn, setActiveTooltip }) => {
    const [isHistoryOpen, setIsHistoryOpen] = useState(true);
    const historyContentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (historyContentRef.current) {
            historyContentRef.current.scrollTo({ top: historyContentRef.current.scrollHeight, behavior: 'smooth' });
        }
    }, [historyLog]);

    return (
        <div className="seti-history-wrapper">
            <div className={`seti-foldable-container seti-history-container seti-icon-panel ${isHistoryOpen ? 'open' : 'collapsed'}`}>
                <div className="seti-foldable-header" onClick={() => setIsHistoryOpen(!isHistoryOpen)}>
                    <span className="panel-icon">📜</span>
                    <span className="panel-title seti-history-title">Historique</span>
                    {onUndoTurn && (
                        <button
                            className="panel-title seti-history-undo-btn"
                            onMouseEnter={(e) => setActiveTooltip({ content: 'Revenir au début de mon tour', rect: e.currentTarget.getBoundingClientRect() })}
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
                    {onUndo && (
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
                <div className="seti-foldable-content seti-history-content seti-thin-scroll" ref={historyContentRef}>
                    <HistoryList historyLog={historyLog} game={game} setActiveTooltip={setActiveTooltip} />
                </div>
            </div>
        </div>
    );
};

/** Mémoïsé : redessiné seulement quand ses props changent (partie, interaction…), pas à chaque rendu de BoardUI */
export const HistoryBoardUI = React.memo(HistoryBoardUIView);
