import { effectNumber, effectString, effectAmount } from '../core/cardEffects';
import { cloneGame } from '../core/cloneGame';
import { Game, Card, ProbeState, FreeActionType, Bonus, GAME_CONSTANTS, RevenueType, CardType, Mission, HistoryEntry, InteractionState, LifeTraceType, Player, CardEffect, SectorType, TechnologyCategory, CostType, AlienBoardType, LifeTraceLocation } from '../core/types';
import { createRotationState, getCell, getAdjacentCells, getObjectPosition, getAbsoluteSectorForProbe, calculateReachableCells } from '../core/SolarSystemPosition';
import { ResourceSystem } from './ResourceSystem';
import { ProbeSystem } from './ProbeSystem';
import { ScanSystem } from './ScanSystem';
import { SpeciesSystem } from './SpeciesSystem';
import { uniqueId } from '../core/ids';
import { addImmediateEffects, applyPassiveEffect, lifeTraceColor, PlayCardContext } from './PlayCardEffects';

/**
 * Système de gestion des cartes et des missions.
 * 
 * DISTINCTION DES MISSIONS :
 * 
 * 1. Missions Déclenchables (TRIGGERED / GAIN_ON_...):
 *    - Réagissent à des événements (actions).
 *    - Sont ajoutées à `player.permanentBuffs` lors de la mise en jeu.
 *    - Sont traitées automatiquement par les systèmes (ProbeSystem, ScanSystem, etc.) via `updateMissionProgress`.
 * 
 * 2. Missions Conditionnelles (CONDITIONAL / GAIN_IF_...):
 *    - Vérifient un état du jeu.
 *    - Ne sont PAS ajoutées à `player.permanentBuffs`.
 *    - Sont évaluées à la demande (UI, Clic) via `evaluateMission` et validées manuellement.
 */
export class CardSystem {
    /**
     * Cartes Exertiens : stockées dans player.cards mais elles ne sont pas « en main ».
     * Elles ne comptent pas dans la limite de 4 cartes et ne peuvent être ni défaussées,
     * ni réservées, ni jouées normalement (uniquement via un palier Exertien).
     */
    static isExertienCard(card: Card): boolean {
        return card.type === CardType.EXERTIEN;
    }

    /** Cartes réellement en main (hors cartes Exertiens). */
    static getHandCards(player: Player): Card[] {
        return player.cards.filter(c => !this.isExertienCard(c));
    }

    /**
     * Pioche des cartes pour un joueur
     */
    static drawCards(game: Game, playerId: string, count: number): Game {
        const updatedGame = cloneGame(game);
        const player = updatedGame.players.find(p => p.id === playerId);
        if (!player) return game;

        for (let i = 0; i < count; i++) {
            if (updatedGame.decks.cards.length > 0) {
                const card = updatedGame.decks.cards.shift();
                if (card) {
                    player.cards.push(card);
                }
            }
        }

        return updatedGame;
    }

    /**
     * Réserve une carte
     */
    static reserveCard(game: Game, playerId: string, cardId: string): Game {
        let updatedGame = cloneGame(game);
        const playerIndex = updatedGame.players.findIndex(p => p.id === playerId);
        if (playerIndex === -1) return game;
        const player = updatedGame.players[playerIndex];

        const cardIndex = player.cards.findIndex(c => c.id === cardId);
        if (cardIndex === -1) return game;
        const card = player.cards[cardIndex];
        if (this.isExertienCard(card)) return game;

        // Retirer la carte
        player.cards.splice(cardIndex, 1);

        // Ajouter aux cartes réservées
        if (!player.reservedCards) player.reservedCards = [];
        player.reservedCards.push(card);

        updatedGame.players[playerIndex] = player;

        // Appliquer le revenu et le bonus immédiat
        if (card.revenue === RevenueType.CREDIT) {
            player.revenueCredits += 1;
            player.credits += 1;
        } else if (card.revenue === RevenueType.ENERGY) {
            player.revenueEnergy += 1;
            player.energy += 1;
        } else if (card.revenue === RevenueType.CARD) {
            player.revenueCards += 1;
            updatedGame = this.drawCards(updatedGame, playerId, 1);
        } else if (card.revenue === RevenueType.MEDIA) {
            player.revenueMedia = (player.revenueMedia || 0) + 1;
            player.mediaCoverage = Math.min(player.mediaCoverage + 1, GAME_CONSTANTS.MAX_MEDIA_COVERAGE);
        } else if (card.revenue === RevenueType.DATA) {
            player.revenueData = (player.revenueData || 0) + 1;
            player.data = Math.min(player.data + 1, GAME_CONSTANTS.MAX_DATA);
        }

        return updatedGame
    }

    /**
     * Réserve des cartes de la main (revenu + gain immédiat, pioche comprise) et décrit l'opération.
     * Les cartes sans revenu ou absentes de la main sont ignorées.
     */
    static reserveCards(game: Game, playerId: string, cardIds: string[], sequenceId?: string): { updatedGame: Game; historyEntries: HistoryEntry[]; reservedCount: number } {
        let updatedGame = game;
        const historyEntries: HistoryEntry[] = [];
        let reservedCount = 0;
        for (const cardId of cardIds) {
            const before = updatedGame.players.find(p => p.id === playerId);
            const card = before?.cards.find(c => c.id === cardId);
            if (!before || !card || !card.revenue) continue;
            const handBefore = before.cards.map(c => c.id);
            const next = this.reserveCard(updatedGame, playerId, cardId);
            if (next === updatedGame) continue;
            updatedGame = next;
            reservedCount++;

            let gain = ResourceSystem.formatResource(1, this.revenueResource(card.revenue));
            if (card.revenue === RevenueType.CARD) {
                const drawn = updatedGame.players.find(p => p.id === playerId)!.cards.find(c => !handBefore.includes(c.id));
                if (drawn) gain += ` "${drawn.name}"`;
            }
            historyEntries.push({ message: `réserve carte "${card.name}" et gagne ${gain}`, playerId, sequenceId });
        }
        return { updatedGame, historyEntries, reservedCount };
    }

    /**
     * Gain ou achat (3 Médias) d'une carte de la rangée ou de la pioche (cardId absent).
     * Avec triggerFreeAction (Subventions, carte 11), la carte est révélée et son action gratuite appliquée.
     */
    static acquireCard(game: Game, playerId: string, cardId: string | undefined, options: { isFree?: boolean; triggerFreeAction?: boolean } = {}, sequenceId?: string): {
        updatedGame: Game; historyEntries: HistoryEntry[]; newPendingInteractions: InteractionState[]; error?: string;
    } {
        const handBefore = game.players.find(p => p.id === playerId)?.cards.map(c => c.id) || [];
        const bought = this.buyCard(game, playerId, cardId, !!options.isFree);
        if (bought.error) return { updatedGame: game, historyEntries: [], newPendingInteractions: [], error: bought.error };

        const updatedGame = cloneGame(bought.updatedGame);
        const player = updatedGame.players.find(p => p.id === playerId)!;
        const card = player.cards.find(c => !handBefore.includes(c.id));
        const cardName = card?.name || 'Inconnue';
        const newPendingInteractions: InteractionState[] = [];

        let message = options.isFree
            ? (cardId ? `choisit carte "${cardName}"` : `pioche carte "${cardName}"`)
            : `paye 3 médias pour acheter carte "${cardName}" depuis ${cardId ? 'la rangée' : 'la pioche'}`;

        if (options.triggerFreeAction && card) {
            card.isRevealed = true;
            switch (card.freeAction) {
                case FreeActionType.MEDIA:
                    player.mediaCoverage = Math.min(player.mediaCoverage + 1, GAME_CONSTANTS.MAX_MEDIA_COVERAGE);
                    message += ' et gagne 1 Média';
                    break;
                case FreeActionType.DATA:
                    player.data = Math.min(player.data + 1, GAME_CONSTANTS.MAX_DATA);
                    message += ' et gagne 1 Donnée';
                    break;
                case FreeActionType.MOVEMENT:
                    newPendingInteractions.push({ type: 'MOVING_PROBE', count: 1, sequenceId });
                    message += ' et gagne 1 Déplacement';
                    break;
                case FreeActionType.PV_MOVEMENT:
                    player.score += 1;
                    newPendingInteractions.push({ type: 'MOVING_PROBE', count: 1, sequenceId });
                    message += ' et gagne 1 PV et 1 Déplacement';
                    break;
                case FreeActionType.PV_DATA:
                    player.score += 1;
                    player.data = Math.min(player.data + 1, GAME_CONSTANTS.MAX_DATA);
                    message += ' et gagne 1 PV et 1 Donnée';
                    break;
                case FreeActionType.TWO_MEDIA:
                    player.mediaCoverage = Math.min(player.mediaCoverage + 2, GAME_CONSTANTS.MAX_MEDIA_COVERAGE);
                    message += ' et gagne 2 Médias';
                    break;
            }
        }
        return { updatedGame, historyEntries: [{ message, playerId, sequenceId }], newPendingInteractions };
    }

    /**
     * Défausse de cartes de la main pour leurs signaux (cartes 67, 114, Observation III) :
     * une sélection de secteur par carte (la carte est défaussée lors du signal).
     */
    static discardForSignals(game: Game, playerId: string, cardIds: string[], sequenceId?: string): { historyEntries: HistoryEntry[]; newPendingInteractions: InteractionState[] } {
        const player = game.players.find(p => p.id === playerId);
        const cards = player ? this.getHandCards(player).filter(c => cardIds.includes(c.id)) : [];
        if (cards.length === 0) {
            return { historyEntries: [{ message: 'ne défausse aucune carte pour marquer des signaux', playerId, sequenceId }], newPendingInteractions: [] };
        }
        return {
            historyEntries: [],
            newPendingInteractions: cards.map(card => ({ type: 'SELECTING_SCAN_SECTOR' as const, color: card.scanSector, cardId: card.id, sequenceId })),
        };
    }

    /**
     * Gains immédiats annoncés par une carte (sans la jouer), pour avertir le joueur d'un gain perdu
     * (données au maximum, pas de sonde à lancer…) avant confirmation.
     */
    static previewImmediateBonuses(card: Card): Bonus {
        const bonus: Bonus = {};
        (card.immediateEffects || []).forEach(effect => {
            if (effect.type === 'GAIN') {
                if (effect.target === 'PROBE') bonus.probe = (bonus.probe || 0) + effectNumber(effect);
                if (effect.target === 'DATA') bonus.data = (bonus.data || 0) + effectNumber(effect);
                if (effect.target === 'MEDIA') bonus.media = (bonus.media || 0) + effectNumber(effect);
            } else if (effect.type === 'ACTION') {
                if (effect.target === 'MOVEMENT') bonus.movements = (bonus.movements || 0) + effectNumber(effect);
                if (effect.target === 'LAND') bonus.landing = (bonus.landing || 0) + effectNumber(effect);
                if (effect.target === 'TECH') {
                    if (!bonus.technologies) bonus.technologies = [];
                    bonus.technologies.push(effectAmount<TechnologyCategory>(effect));
                }
            }
        });
        const passives = card.passiveEffects || [];
        if (passives.some(e => e.type === 'ATMOSPHERIC_ENTRY')) bonus.atmosphericEntry = true;
        if (passives.some(e => e.type === 'SAMPLE_RETURN')) bonus.sampleReturn = true;
        if (passives.some(e => e.type === 'IGNORE_PROBE_LIMIT')) bonus.ignoreProbeLimit = true;
        return bonus;
    }

    /**
     * Vérifie si un joueur peut défausser une carte
     */
    static canDiscardFreeAction(game: Game, playerId: string, freeAction: FreeActionType): { canDiscard: boolean, reason: string } {
        const player = game.players.find(p => p.id === playerId);
        if (!player) {
            return { canDiscard: false, reason: "Joueur non trouvé" };
        }

        if (game.players[game.currentPlayerIndex].id !== playerId) {
            return { canDiscard: false, reason: "Ce n'est pas votre tour" };
        }

        if (freeAction === FreeActionType.MOVEMENT) {
            if (!(player.probes || []).some(p => p.state === ProbeState.IN_SOLAR_SYSTEM)) {
                return { canDiscard: false, reason: "Nécessite une sonde dans le système solaire" };
            } else {
                return { canDiscard: true, reason: "Défausser pour gagner 1 Déplacement" };
            }
        } else if (freeAction === FreeActionType.DATA) {
            if ((player.data || 0) >= GAME_CONSTANTS.MAX_DATA) {
                return { canDiscard: false, reason: "Nécessite de transférer des données" };
            } else {
                return { canDiscard: true, reason: "Défausser pour gagner 1 Donnée" };
            }
        } else if (freeAction === FreeActionType.MEDIA) {
            if (player.mediaCoverage >= GAME_CONSTANTS.MAX_MEDIA_COVERAGE) {
                return { canDiscard: false, reason: "Média au maximum" };
            } else {
                return { canDiscard: true, reason: "Défausser pour gagner 1 Média" };
            }
        } else if (freeAction === FreeActionType.PV_MOVEMENT) {
            if (!(player.probes || []).some(p => p.state === ProbeState.IN_SOLAR_SYSTEM)) {
                return { canDiscard: false, reason: "Nécessite une sonde dans le système solaire" };
            } else {
                return { canDiscard: true, reason: "Défausser pour gagner 1 PV et 1 Déplacement" };
            }
        } else if (freeAction === FreeActionType.PV_DATA) {
            if ((player.data || 0) >= GAME_CONSTANTS.MAX_DATA) {
                return { canDiscard: false, reason: "Nécessite de transférer des données" };
            } else {
                return { canDiscard: true, reason: "Défausser pour gagner 1 PV et 1 Donnée" };
            }
        } else if (freeAction === FreeActionType.TWO_MEDIA) {
            if (player.mediaCoverage >= GAME_CONSTANTS.MAX_MEDIA_COVERAGE) {
                return { canDiscard: false, reason: "Média au maximum" };
            } else {
                return { canDiscard: true, reason: "Défausser pour gagner 2 Médias" };
            }
        }

        return { canDiscard: true, reason: "Action inconnue" };
    }

    /**
     * Cartes de la main que le joueur peut jouer maintenant (coût et conditions compris)
     */
    static getPlayableCardIds(game: Game, playerId: string): string[] {
        const player = game.players.find(p => p.id === playerId);
        if (!player) return [];
        return this.getHandCards(player).filter(card => this.canPlayCard(game, playerId, card).canPlay).map(card => card.id);
    }

    /**
     * Vérifie si un joueur peut jouer au moins une carte de sa main
     */
    static canPlayCards(
        game: Game,
        playerId: string,
    ): { canPlay: boolean, reason: string } {
        const player = game.players.find(p => p.id === playerId);
        if (!player) {
            return { canPlay: false, reason: "Joueur non trouvé" };
        }

        const hand = this.getHandCards(player);
        if (hand.length === 0) {
            return { canPlay: false, reason: "Aucune carte en main" };
        }

        return hand.some(card => this.canPlayCard(game, playerId, card).canPlay)
            ? { canPlay: true, reason: "Au moins une carte peut être jouée" }
            : { canPlay: false, reason: "Aucune carte ne peut être jouée" };
    }

    /**
     * Vérifie si un joueur peut jouer une carte
     */
    static canPlayCard(
        game: Game,
        playerId: string,
        card: Card
    ): { canPlay: boolean, reason: string } {
        const player = game.players.find(p => p.id === playerId);
        if (!player) {
            return { canPlay: false, reason: "Joueur non trouvé" };
        }

        if (game.players[game.currentPlayerIndex].id !== playerId) {
            return { canPlay: false, reason: "Ce n'est pas votre tour" };
        }

        if (this.isExertienCard(card)) {
            return { canPlay: false, reason: "Une carte Exertien se joue uniquement en atteignant un palier Exertien" };
        }

        if (card.costType === CostType.ENERGY) {
            if (player.energy < card.cost) {
                return { canPlay: false, reason: `Énergie insuffisante (coût: ${card.cost} énergie${card.cost > 1 ? 's' : ''})` };
            }
        } else {
            if (player.credits < card.cost) {
                return { canPlay: false, reason: `Crédits insuffisants (coût: ${card.cost} crédit${card.cost > 1 ? 's' : ''})` };
            }
        }

        const costUnit = card.costType === CostType.ENERGY ? 'énergie' : 'crédit';
        return { canPlay: true, reason: `Jouer la carte (coût: ${card.cost} ${costUnit}${card.cost > 1 ? 's' : ''})` };
    }

    /**
     * Joue une carte de la main du joueur
     */
    static playCard(game: Game, playerId: string, cardId: string): { updatedGame: Game, historyEntries: HistoryEntry[], newPendingInteractions: InteractionState[] } {
        const updatedGame = cloneGame(game);
        const player = updatedGame.players.find(p => p.id === playerId);

        if (!player) return { updatedGame: game, historyEntries: [], newPendingInteractions: [] };

        const cardIndex = player.cards.findIndex(c => c.id === cardId);
        if (cardIndex === -1) return { updatedGame: game, historyEntries: [], newPendingInteractions: [] };

        const card = player.cards[cardIndex];

        // Vérification du coût
        if (card.costType === CostType.ENERGY) {
            if (player.energy < card.cost) {
                return { updatedGame: game, historyEntries: [], newPendingInteractions: [] };
            }
            // Payer le coût en énergie
            player.energy -= card.cost;
        } else {
            if (player.credits < card.cost) {
                return { updatedGame: game, historyEntries: [], newPendingInteractions: [] };
            }
            // Payer le coût en crédits
            player.credits -= card.cost;
        }

        // Check for GAIN_ON_PLAY buffs
        const hasFulfillable = CardSystem.processMissionBuffs(player, buff => {
            if (card.cost === 1 && buff.type === 'GAIN_ON_PLAY_1_CREDIT') return true;
            if (card.cost === 2 && buff.type === 'GAIN_ON_PLAY_2_CREDITS') return true;
            if (card.cost === 3 && buff.type === 'GAIN_ON_PLAY_3_CREDITS') return true;
            return false;
        });

        // Retirer la carte de la main
        player.cards.splice(cardIndex, 1);

        // Initialiser les bonus
        const bonuses: Bonus = {};
        const completedMissions: string[] = [];
        // Conditions de mission remplies dès la pose (récompenses non ressources : spécimen, trace limitée à une espèce)
        const missionRewards: string[] = [];

        // Ajouter la carte jouée à la pile de défausse ou aux cartes jouées (Missions Fin de partie)
        if (card) {
            if (card.type === CardType.END_GAME || card.type === CardType.CENTAURIEN) {
                if (player) {
                    if (!player.playedCards) player.playedCards = [];
                    player.playedCards.push(card);

                    if (card.type === CardType.CENTAURIEN) {
                        // Réception différée : palier de message à +15 PV
                        SpeciesSystem.addCentaurienMarker(player, card);
                    }
                }
            } else if (card.type === CardType.CONDITIONAL_MISSION || card.type === CardType.TRIGGERED_MISSION) {
                if (player) {
                    if (!player.missions) player.missions = [];
                    const newMission: Mission = {
                        id: `mission-${card.id}-${uniqueId()}`,
                        cardId: card.id,
                        name: card.name,
                        description: card.description,
                        ownerId: player.id,
                        requirements: (card.permanentEffects || []).map((effect, idx) => ({
                            id: `mission-${card.id}-req-${idx}`,
                            ...effect
                        })),
                        completedRequirementIds: [],
                        fulfillableRequirementIds: [],
                        completed: false,
                        originalCard: card
                    };
                    player.missions.push(newMission);

                    if (card.type === CardType.CONDITIONAL_MISSION) {
                        newMission.requirements.forEach(req => {
                            // Le spécimen doit d'abord être prélevé grâce à cette carte : jamais rempli au moment de la jouer
                            if (req.type.startsWith('GAIN_IF_') && req.type !== 'GAIN_IF_SPECIMEN') {
                                const bonus = CardSystem.evaluateMission(updatedGame, player.id, effectString(req));
                                if (bonus) {
                                    // Coût en Tokens (ET.23) : payé ici, processBonuses ne gère que les gains
                                    if ((bonus.token ?? 0) < 0) {
                                        player.tokens = Math.max(0, (player.tokens || 0) + bonus.token!);
                                        delete bonus.token;
                                    }
                                    ResourceSystem.accumulateBonus(bonus, bonuses);
                                    missionRewards.push(effectString(req));
                                    newMission.completedRequirementIds.push(req.id!);
                                }
                            }
                        });
                        if (newMission.completedRequirementIds.length > 0 && newMission.completedRequirementIds.length >= newMission.requirements.length) {
                            newMission.completed = true;
                            completedMissions.push(newMission.name);
                        }
                    }
                }
            } else {
                if (!updatedGame.decks.discardPile) updatedGame.decks.discardPile = [];
                updatedGame.decks.discardPile.push(card);
            }
        }

        // Interactions créées directement par un effet (ex: trace de vie limitée à certains plateaux)
        const extraInteractions: InteractionState[] = [];
        const takenRowCards: string[] = [];

        // Effets immédiats (gains) et passifs (buffs, gains conditionnels) : systems/PlayCardEffects
        addImmediateEffects(card.immediateEffects, bonuses);
        const effectContext: PlayCardContext = { game: updatedGame, player, card, bonuses, extraInteractions, takenRowCards };
        (card.passiveEffects || []).forEach(effect => applyPassiveEffect(effectContext, effect));

        // Traitement des effets permanents (Missions déclenchables)
        if (card.permanentEffects) {
            card.permanentEffects.forEach((effect, idx) => {
                if (effect.type.startsWith('GAIN_ON_')) {
                    const buffId = `mission-${card.id}-req-${idx}`;
                    player.permanentBuffs.push({ ...effect, id: buffId, source: card.name });
                }
            });
        }

        const sequenceId = `seq-${uniqueId()}`;
        const { updatedGame: gameAfterBonuses, newPendingInteractions, passiveGains, logs, historyEntries } = ResourceSystem.processBonuses(bonuses || {}, updatedGame, player.id, cardId, sequenceId);

        // Construction du message d'historique unifié
        let message = `paye ${card.cost} ${card.costType}${card.cost > 1 ? 's' : ''} pour jouer carte "${card.name}"`;

        // Filtrer les logs pour séparer ce qu'on fusionne de ce qu'on garde séparé
        const isPassiveLog = (log: string) => log.startsWith('gagne ') || log.startsWith('pioche ');
        const isMovementLog = (log: string) => log.includes('déplacement') && log.includes('gratuit');

        const movementLogs = logs.filter(isMovementLog);
        const otherLogs = logs.filter(log => !isPassiveLog(log) && !isMovementLog(log));

        const extras = [];
        if (passiveGains.length > 0) {
            extras.push(`gagne ${passiveGains.join(', ')}`);
        }
        if (movementLogs.length > 0) {
            extras.push(movementLogs.join(', '));
        }
        if (extras.length > 0) {
            message += ` et ${extras.join(' et ')}`;
        }
        if (completedMissions.length > 0) {
            message += ` pour avoir accompli la mission "${completedMissions.join('", "')}"`;
        }

        historyEntries.unshift({ message, playerId, sequenceId });
        if (otherLogs.length > 0) {
            otherLogs.forEach(log => historyEntries.push({ message: log, playerId, sequenceId }));
        }
        if (takenRowCards.length > 0) {
            historyEntries.push({ message: `prend en main les cartes de la rangée : ${takenRowCards.map(n => `"${n}"`).join(', ')}`, playerId, sequenceId });
        }
        if (hasFulfillable) {
            historyEntries.push({ message: 'déclenche une mission à recouvrir', playerId, sequenceId});
        }
        if (extraInteractions.length === 0 && card.passiveEffects?.some(e => e.type === 'GAIN_LIFETRACE_IF_ALREADY')) {
            historyEntries.push({ message: "n'a encore marqué aucune trace de cette couleur : pas de trace de vie", playerId, sequenceId });
        }

        const rewardedInteractions = missionRewards.reduce(
            (interactions, value) => this.missionRewardInteractions(gameAfterBonuses, playerId, value, interactions, sequenceId),
            newPendingInteractions);
        return { updatedGame: gameAfterBonuses, historyEntries, newPendingInteractions: [...rewardedInteractions, ...extraInteractions.map(i => ({ ...i, sequenceId }))] };
    }

    /** Ressource gagnée par un revenu (pour formatResource) */
    static revenueResource(revenue: RevenueType): string {
        switch (revenue) {
            case RevenueType.CREDIT: return 'CREDIT';
            case RevenueType.ENERGY: return 'ENERGY';
            case RevenueType.MEDIA: return 'MEDIA';
            case RevenueType.DATA: return 'DATA';
            default: return 'CARD';
        }
    }

    /** Plateaux Alien où le joueur a marqué une trace de chaque couleur */
    static boardsWithAllTraceColors(game: Game, playerId: string): number[] {
        return game.board.alienBoards
            .map((board, index) => {
                const colors = new Set(board.lifeTraces.filter(t => t.playerId === playerId).map(t => t.type));
                return [LifeTraceType.RED, LifeTraceType.YELLOW, LifeTraceType.BLUE].every(c => colors.has(c)) ? index : -1;
            })
            .filter(index => index !== -1);
    }

    /**
     * Récompenses d'une mission qui ne sont pas des ressources (interactions à résoudre) :
     * « specimen:n » (ET.8 à ET.10 : récompense d'un jeton Mascamite de Jupiter ou Saturne) et trace de vie limitée à
     * l'espèce qui remplit la condition (carte 102). Les traces de vie de la récompense sont ajustées dans `interactions`.
     */
    static missionRewardInteractions(game: Game, playerId: string, requirementValue: string, interactions: InteractionState[], sequenceId?: string): InteractionState[] {
        const parts = requirementValue.split(':');
        const result = [...interactions];
        const specimenIndex = parts.indexOf('specimen');
        if (parts[0] !== 'GAIN_IF_SPECIMEN' && specimenIndex > 0) {
            const times = parseInt(parts[specimenIndex + 1], 10) || 1;
            for (let i = 0; i < times; i++) result.push({ type: 'CONSULTING_SPECIMEN', anyPlanet: true, sequenceId });
        }
        if (parts[0] === 'GAIN_IF_3_LIFETRACES' && parts[1] === 'different') {
            const boardIndices = this.boardsWithAllTraceColors(game, playerId);
            return result.map(i => i.type === 'PLACING_LIFE_TRACE' ? { ...i, boardIndices } : i);
        }
        return result;
    }

    static discardToHandSize(game: Game, playerId: string, cardIdsToKeep: string[]): Game {
        const updatedGame = cloneGame(game);
        const player = updatedGame.players.find(p => p.id === playerId);
        if (!player) return updatedGame;

        // Les cartes Exertiens ne sont pas en main : elles sont toujours conservées
        const keep = (c: Card) => this.isExertienCard(c) || cardIdsToKeep.includes(c.id);
        const cardsToDiscard = player.cards.filter(c => !keep(c));
        player.cards = player.cards.filter(keep);

        if (cardsToDiscard.length > 0) {
            if (!updatedGame.decks.discardPile) updatedGame.decks.discardPile = [];
            updatedGame.decks.discardPile.push(...cardsToDiscard);
        }

        return updatedGame;
    }

    static discardCard(game: Game, playerId: string, cardId: string): Game {
        const updatedGame = cloneGame(game);
        const player = updatedGame.players.find(p => p.id === playerId);
        if (!player) return updatedGame;

        const cardIndex = player.cards.findIndex(c => c.id === cardId);
        // Une carte Exertien ne peut être défaussée par aucun moyen (FAQ Q40)
        if (cardIndex !== -1 && !this.isExertienCard(player.cards[cardIndex])) {
            const [card] = player.cards.splice(cardIndex, 1);
            if (!updatedGame.decks.discardPile) updatedGame.decks.discardPile = [];
            updatedGame.decks.discardPile.push(card);
        }

        return updatedGame;
    }

    static discardCardForFreeAction(game: Game, playerId: string, cardId: string): { updatedGame: Game, historyEntries: HistoryEntry[], newPendingInteractions: InteractionState[] } {
        let updatedGame = cloneGame(game);
        const player = updatedGame.players.find(p => p.id === playerId);
        if (!player) return { updatedGame: game, historyEntries: [], newPendingInteractions: [] };

        const card = player.cards.find(c => c.id === cardId);
        if (!card || !card.freeAction || this.isExertienCard(card)) return { updatedGame: game, historyEntries: [], newPendingInteractions: [] };

        const sequenceId = `free-action-discard-${uniqueId()}`;
        const bonuses: Bonus = {};

        // 1. Get bonus from the card's free action
        if (card.freeAction === FreeActionType.MEDIA) {
            bonuses.media = (bonuses.media || 0) + 1;
        } else if (card.freeAction === FreeActionType.DATA) {
            bonuses.data = (bonuses.data || 0) + 1;
        } else if (card.freeAction === FreeActionType.MOVEMENT) {
            bonuses.movements = (bonuses.movements || 0) + 1;
        } else if (card.freeAction === FreeActionType.PV_MOVEMENT) {
            bonuses.pv = (bonuses.pv || 0) + 1;
            bonuses.movements = (bonuses.movements || 0) + 1;
        } else if (card.freeAction === FreeActionType.PV_DATA) {
            bonuses.pv = (bonuses.pv || 0) + 1;
            bonuses.data = (bonuses.data || 0) + 1;
        } else if (card.freeAction === FreeActionType.TWO_MEDIA) {
            bonuses.media = (bonuses.media || 0) + 2;
        }

        // 2. Check for GAIN_ON_DISCARD buffs and mark mission as fulfillable
        const hasFulfillable = CardSystem.processMissionBuffs(player, buff => {
            if (card.freeAction === FreeActionType.MEDIA && buff.type === 'GAIN_ON_DISCARD_MEDIA') return true;
            if (card.freeAction === FreeActionType.DATA && buff.type === 'GAIN_ON_DISCARD_DATA') return true;
            if (card.freeAction === FreeActionType.MOVEMENT && buff.type === 'GAIN_ON_DISCARD_MOVE') return true;
            return false;
        });
    
        // 3. Discard the card
        updatedGame = this.discardCard(updatedGame, playerId, cardId);

        // 4. Process bonuses
        const { updatedGame: gameAfterBonuses, newPendingInteractions, logs, historyEntries } = ResourceSystem.processBonuses(bonuses, updatedGame, playerId, cardId, sequenceId);

        // 5. Create history entry
        let message = `défausse carte "${card.name}"`;
        if (logs.length > 0) {
            message += ` et ${logs.join(', ')}`;
        }
        historyEntries.unshift({ message, playerId, sequenceId });
        if (hasFulfillable) {
            historyEntries.push({ message: 'déclenche une mission à recouvrir', playerId, sequenceId});
        }

        return { updatedGame: gameAfterBonuses, historyEntries, newPendingInteractions };
    }

    static discardFromRow(game: Game, cardId: string): { updatedGame: Game, discardedCard: Card | null } {
        const updatedGame = cloneGame(game);
        const row = updatedGame.decks.cardRow;
        const index = row.findIndex(c => c.id === cardId);

        if (index !== -1) {
            const [card] = row.splice(index, 1);
            if (!updatedGame.decks.discardPile) updatedGame.decks.discardPile = [];
            updatedGame.decks.discardPile.push(card);
            return { updatedGame, discardedCard: card };
        }

        return { updatedGame, discardedCard: null };
    }

    static refillCardRow(game: Game): Game {
        const updatedGame = { ...game };

        // Copie profonde des decks
        updatedGame.decks = {
            ...updatedGame.decks,
            cards: [...updatedGame.decks.cards],
            cardRow: [...updatedGame.decks.cardRow]
        };

        // Remplir jusqu'à 3 cartes
        while (updatedGame.decks.cardRow.length < 3 && updatedGame.decks.cards.length > 0) {
            const newCard = updatedGame.decks.cards.shift();
            if (newCard) {
                updatedGame.decks.cardRow.push(newCard);
            }
        }
        return updatedGame;
    }

    /**
     * Achète une carte (depuis la rangée ou la pioche)
     */
    static buyCard(game: Game, playerId: string, cardIdFromRow?: string, isFree: boolean = false): { updatedGame: Game, error?: string } {
        let updatedGame = cloneGame(game);
        const player = updatedGame.players.find(p => p.id === playerId);
        if (!player) return { updatedGame: game, error: "Joueur non trouvé" };

        if (!isFree) {
            if (player.mediaCoverage < 3) {
                return { updatedGame: game, error: "Couverture médiatique insuffisante" };
            }

            player.mediaCoverage -= 3;
        }

        if (cardIdFromRow) {
            const cardIndex = updatedGame.decks.cardRow.findIndex(c => c.id === cardIdFromRow);
            if (cardIndex !== -1) {
                const [card] = updatedGame.decks.cardRow.splice(cardIndex, 1);
                player.cards.push(card);
                updatedGame = this.refillCardRow(updatedGame);
            } else {
                return { updatedGame: game, error: "Carte non trouvée dans la rangée" };
            }
        } else {
            updatedGame = this.drawCards(updatedGame, playerId, 1);
        }

        return { updatedGame };
    }

    /**
     * Traite les buffs de mission permanents d'un joueur.
     * Si la condition `shouldTrigger` est remplie, marque le prérequis comme réalisable.
     */
    static processMissionBuffs(
        player: Player,
        shouldTrigger: (buff: CardEffect) => boolean
    ): boolean {
        let atLeastOneFulfillable = false;
        player.permanentBuffs.forEach(buff => {
            if (shouldTrigger(buff)) {
                if (buff.id && buff.source) {
                    const mission = player.missions.find(m => m.name === buff.source);
                    if (mission) {
                        // Si déjà complété ou déjà marqué comme fulfillable, on ignore
                        if (mission.completedRequirementIds.includes(buff.id)) return null;
                        if (!mission.fulfillableRequirementIds) mission.fulfillableRequirementIds = [];
                        if (mission.fulfillableRequirementIds.includes(buff.id)) return null;

                        mission.fulfillableRequirementIds.push(buff.id);
                        atLeastOneFulfillable = true;
                        return mission.name;
                    }
                }
            }
            return null;
        });
        return atLeastOneFulfillable;
    }

    /**
     * Met à jour la progression d'une mission conditionnelle (liée à un buff permanent)
     */
    static updateMissionProgress(player: Player, buff: CardEffect): string | null {
        if (buff.source) {
            const mission = player.missions.find(m => m.name === buff.source);
            if (mission && buff.id) {
                if (!mission.completedRequirementIds.includes(buff.id)) {
                    mission.completedRequirementIds.push(buff.id);
                }

                // Vérifier la complétion (même si le prérequis était déjà là, au cas où il aurait été bloqué précédemment)
                if (!mission.completed && mission.completedRequirementIds.length >= mission.requirements.length) {
                    mission.completed = true;
                    return mission.name;
                }
            }
        }
        return null;
    }

    /**
     * Évalue une condition de mission déclenchable et retourne le bonus si la condition est remplie
     * Format attendu: CONDITION:TARGET:BONUS1:VALUE1:BONUS2:VALUE2...
     */
    static evaluateMission(
        game: Game,
        playerId: string,
        missionString: string,
        skipConditionCheck: boolean = false
    ): Bonus | null {
        if (!missionString) return null;

        const parts = missionString.split(':').map(p => p.trim());
        if (parts.length < 2) return null;

        const conditionType = parts[0];

        // Liste des conditions qui attendent un paramètre cible (target) en 2ème position
        const conditionsWithTarget = [
            'GAIN_IF_ORBITER_OR_LANDER',
            'GAIN_IF_COVERED',
            'GAIN_IF_LIFETRACE_BOTH_SPECIES',
            'GAIN_IF_3_LIFETRACES',
            'GAIN_IF_2_LIFETRACES',
            'GAIN_IF_SPECIMEN',
            'GAIN_IF_LANDER',
            'GAIN_IF_SIGNAL',
            'GAIN_IF_LIFETRACES_ALL_COLORS',
            'GAIN_ON_VISIT',
            'GAIN_ON_TECH',
            'GAIN_ON_SIGNAL',
            'GAIN_ON_LIFETRACE',
            'GAIN_ON_DISCARD',
            'GAIN_ON_PLAY'
        ];

        let target: string | undefined;
        let bonusStartIndex = 1;

        // GAIN_ON_… à 4 éléments : <condition>:<cible>:<ressource>:<valeur> (ex: GAIN_ON_LAND:oumuamua:pv:3)
        if (conditionsWithTarget.includes(conditionType) || (conditionType.startsWith('GAIN_ON_') && parts.length === 4)) {
            target = parts[1];
            bonusStartIndex = 2;
        }

        const rewards = this.parseRewards(parts.slice(bonusStartIndex));
        return this.checkMissionCondition(game, playerId, conditionType, target, rewards, parts, skipConditionCheck);
    }

    /** Récompenses écrites en paires <ressource>:<valeur> (ex: pv:3:data:1, redlifetrace:1) */
    static parseRewards(parts: string[]): Bonus {
        const rewards: Bonus = {};
        for (let i = 0; i < parts.length; i += 2) {
            if (i + 1 < parts.length) {
                const bonusType = parts[i];
                const bonusValue = parseInt(parts[i + 1], 10);

                if (!isNaN(bonusValue)) {
                    if (bonusType === 'pv') rewards.pv = (rewards.pv || 0) + bonusValue;
                    else if (bonusType === 'media') rewards.media = (rewards.media || 0) + bonusValue;
                    else if (bonusType === 'credit' || bonusType === 'credits') rewards.credits = (rewards.credits || 0) + bonusValue;
                    else if (bonusType === 'energy') rewards.energy = (rewards.energy || 0) + bonusValue;
                    else if (bonusType === 'data') rewards.data = (rewards.data || 0) + bonusValue;
                    else if (bonusType === 'card') rewards.card = (rewards.card || 0) + bonusValue;
                    else if (bonusType === 'anycard') rewards.anycard = (rewards.anycard || 0) + bonusValue;
                    else if (bonusType === 'probe') rewards.probe = (rewards.probe || 0) + bonusValue;
                    else if (bonusType === 'move' || bonusType === 'moves' || bonusType === 'movements') rewards.movements = (rewards.movements || 0) + bonusValue;
                    else if (bonusType === 'reservation') rewards.revenue = (rewards.revenue || 0) + bonusValue;
                    else if (bonusType === 'token' || bonusType === 'tokens') rewards.token = (rewards.token || 0) + bonusValue;
                    else if (bonusType === 'yellowlifetrace') {
                        if (!rewards.lifetraces) rewards.lifetraces = [];
                        rewards.lifetraces.push({ amount: bonusValue, scope: LifeTraceType.YELLOW });
                    }
                    else if (bonusType === 'redlifetrace') {
                        if (!rewards.lifetraces) rewards.lifetraces = [];
                        rewards.lifetraces.push({ amount: bonusValue, scope: LifeTraceType.RED });
                    }
                    else if (bonusType === 'bluelifetrace') {
                        if (!rewards.lifetraces) rewards.lifetraces = [];
                        rewards.lifetraces.push({ amount: bonusValue, scope: LifeTraceType.BLUE });
                    }
                    else if (bonusType === 'lifetrace') {
                        if (!rewards.lifetraces) rewards.lifetraces = [];
                        rewards.lifetraces.push({ amount: bonusValue, scope: LifeTraceType.ANY });
                    }
                    else if (bonusType === 'yellowsignal') {
                        if (!rewards.signals) rewards.signals = [];
                        rewards.signals.push({ amount: bonusValue, scope: SectorType.YELLOW });
                    }
                    else if (bonusType === 'redsignal') {
                        if (!rewards.signals) rewards.signals = [];
                        rewards.signals.push({ amount: bonusValue, scope: SectorType.RED });
                    }
                    else if (bonusType === 'bluesignal') {
                        if (!rewards.signals) rewards.signals = [];
                        rewards.signals.push({ amount: bonusValue, scope: SectorType.BLUE });
                    }
                }
            }
        }
        return rewards;
    }

    private static checkMissionCondition(game: Game, playerId: string, conditionType: string, target: string | undefined, rewards: Bonus, parts: string[], skipConditionCheck: boolean): Bonus | null {

        // Vérification des conditions
        if (conditionType === 'GAIN_IF_ORBITER_OR_LANDER') {
            const targets = (target || '').split('&');

            // Si on saute la vérification (car l'événement a déjà été validé par le système)
            if (skipConditionCheck) return rewards;

            const hasPresence = targets.every(t => ProbeSystem.hasPresenceOnPlanet(game, playerId, t));
            if (hasPresence) return rewards;
        }

        const player = game.players.find(p => p.id === playerId);
        if (!player) return null;

        // Si on saute la vérification, on retourne les récompenses directement
        // Cela s'applique aux missions GAIN_ON_... qui ont été marquées comme fulfillable
        if (skipConditionCheck) return rewards;

        if (conditionType === 'GAIN_IF_3_LANDERS') {
            const mainPlanets = ['mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];
            const landerCount = player.probes.filter(p => p.state === ProbeState.LANDED && p.planetId && mainPlanets.includes(p.planetId)).length;
            if (landerCount >= 3) return rewards;
        }

        if (conditionType === 'GAIN_IF_2_ORBITERS') {
            const orbiterCount = player.probes.filter(p => p.state === ProbeState.IN_ORBIT).length;
            if (orbiterCount >= 2) return rewards;
        }

        if (conditionType === 'GAIN_IF_COVERED') {
            if (target === 'same') {
                const doubleCovered = game.board.sectors.some(s => s.coveredBy.filter(id => id === playerId).length >= 2);
                if (doubleCovered) return rewards;
            } else {
                let required = 1;
                let color: SectorType | undefined;
                if (target === 'red') { color = SectorType.RED; required = 2; }
                else if (target === 'blue') { color = SectorType.BLUE; required = 2; }
                else if (target === 'yellow') { color = SectorType.YELLOW; required = 2; }
                else if (target === 'black') { color = SectorType.BLACK; required = 1; }

                if (color) {
                    let count = 0;
                    game.board.sectors.forEach(s => {
                        if (s.color === color) {
                            count += s.coveredBy.filter(id => id === playerId).length;
                        }
                    });
                    if (count >= required) return rewards;
                }
            }
        }

        if (conditionType === 'GAIN_IF_4_SIGNALS') {
            const sectorsWithSignal = game.board.sectors.filter(s => s.signals.some(sig => sig.markedBy === playerId)).length;
            if (sectorsWithSignal >= 4) return rewards;
        }

        if (conditionType === 'GAIN_IF_8_MEDIA') {
            if (player.mediaCoverage >= 8) return rewards;
        }

        if (conditionType === 'GAIN_IF_50_PV') {
            if (player.score >= 50) return rewards;
        }

        if (conditionType === 'GAIN_IF_LIFETRACE_BOTH_SPECIES') {
            let type: LifeTraceType | undefined;
            if (target === 'red') type = LifeTraceType.RED;
            else if (target === 'blue') type = LifeTraceType.BLUE;
            else if (target === 'yellow') type = LifeTraceType.YELLOW;

            if (type) {
                const hasOnBoard0 = game.board.alienBoards[0].lifeTraces.some(t => t.type === type && t.playerId === playerId);
                const hasOnBoard1 = game.board.alienBoards[1].lifeTraces.some(t => t.type === type && t.playerId === playerId);
                if (hasOnBoard0 && hasOnBoard1) return rewards;
            }
        }

        if (conditionType === 'GAIN_IF_3_LIFETRACES') {
            if (target === 'different') {
                // Carte 102 : 3 traces de couleurs différentes pour une même espèce
                if (this.boardsWithAllTraceColors(game, playerId).length > 0) return rewards;
            } else {
                let type: LifeTraceType | undefined;
                if (target === 'red') type = LifeTraceType.RED;
                else if (target === 'blue') type = LifeTraceType.BLUE;
                else if (target === 'yellow') type = LifeTraceType.YELLOW;

                if (type) {
                    const count = player.lifeTraces.filter(t => t.type === type).length;
                    if (count >= 3) return rewards;
                }
            }
        }

        if (conditionType === 'GAIN_IF_2_LIFETRACES') {
            // ET.8 à ET.10 (cartes Mascamites) : 2 traces de la couleur « pour cette espèce »
            const type = lifeTraceColor(target);
            const count = SpeciesSystem.playerTracesForSpecies(game, playerId, AlienBoardType.MASCAMITES).filter(t => t.type === type).length;
            if (count >= 2) return rewards;
        }

        if (conditionType === 'GAIN_IF_PROBE_IN_DEEP_SPACE') {
            const rotationState = createRotationState(
                game.board.solarSystem.rotationAngleLevel1 || 0,
                game.board.solarSystem.rotationAngleLevel2 || 0,
                game.board.solarSystem.rotationAngleLevel3 || 0
            );
            const earthPos = getObjectPosition('earth', rotationState.level1Angle, rotationState.level2Angle, rotationState.level3Angle, game.board.solarSystem.extraCelestialObjects);
            if (earthPos) {
                const reachable = calculateReachableCells(earthPos.disk, earthPos.absoluteSector, 100, rotationState, true);
                const hasDeepProbe = player.probes.some(p => {
                    if (p.state !== ProbeState.IN_SOLAR_SYSTEM || !p.solarPosition) return false;
                    const absSector = getAbsoluteSectorForProbe(p.solarPosition, rotationState);
                    const key = `${p.solarPosition.disk}${absSector}`;
                    const dist = reachable.get(key)?.movements;
                    return dist !== undefined && dist >= 5;
                });
                if (hasDeepProbe) return rewards;
            }
        }

        if (conditionType === 'GAIN_IF_PROBE_ON_COMET') {
            const rotationState = createRotationState(
                game.board.solarSystem.rotationAngleLevel1 || 0,
                game.board.solarSystem.rotationAngleLevel2 || 0,
                game.board.solarSystem.rotationAngleLevel3 || 0
            );
            const hasProbeOnComet = player.probes.some(p => {
                if (p.state !== ProbeState.IN_SOLAR_SYSTEM || !p.solarPosition) return false;
                const absSector = getAbsoluteSectorForProbe(p.solarPosition, rotationState);
                const cell = getCell(p.solarPosition.disk, absSector, rotationState, game.board.solarSystem.extraCelestialObjects);
                return cell?.hasComet;
            });
            if (hasProbeOnComet) return rewards;
        }

        if (conditionType === 'GAIN_IF_PROBE_ON_ASTEROID') {
            const rotationState = createRotationState(
                game.board.solarSystem.rotationAngleLevel1 || 0,
                game.board.solarSystem.rotationAngleLevel2 || 0,
                game.board.solarSystem.rotationAngleLevel3 || 0
            );
            const earthPos = getObjectPosition('earth', rotationState.level1Angle, rotationState.level2Angle, rotationState.level3Angle, game.board.solarSystem.extraCelestialObjects);
            if (earthPos) {
                const adjacentCells = getAdjacentCells(earthPos.disk, earthPos.absoluteSector);
                const hasProbe = player.probes.some(p => {
                    if (p.state !== ProbeState.IN_SOLAR_SYSTEM || !p.solarPosition) return false;
                    const absSector = getAbsoluteSectorForProbe(p.solarPosition, rotationState);
                    const cell = getCell(p.solarPosition.disk, absSector, rotationState, game.board.solarSystem.extraCelestialObjects);
                    if (!cell?.hasAsteroid) return false;

                    // Check adjacency to Earth
                    return adjacentCells.some(adj => adj.disk === p.solarPosition!.disk && adj.sector === absSector);
                });
                if (hasProbe) return rewards;
            }
        }

        if (conditionType === 'GAIN_IF_EMPTY_HAND') {
            if (player.cards.length === 0) return rewards;
        }

        if (conditionType === 'GAIN_IF_ORBITER_AND_LANDER') {
            // Vérifier si une planète a à la fois un orbiteur et un atterrisseur du joueur
            const hasBoth = game.board.planets.some(p => {
                const hasOrbiter = p.orbiters.some(o => o.ownerId === playerId);
                const hasLander = p.landers.some(l => l.ownerId === playerId);
                return hasOrbiter && hasLander;
            });
            if (hasBoth) return rewards;
        }

        if (conditionType === 'GAIN_IF_3_TECH_OBS') {
            const obsTechCount = player.technologies.filter(t => t.type === TechnologyCategory.OBSERVATION).length;
            if (obsTechCount >= 3) return rewards;
        }

        if (conditionType === 'GAIN_IF_LANDER') {
            // ET.22 : un atterrisseur du joueur sur la planète (Oumuamua compris)
            const planet = target === 'oumuamua'
                ? game.species.find(s => s.name === AlienBoardType.OUMUAMUA)?.planet
                : game.board.planets.find(p => p.id === target);
            if (planet?.landers.some(l => l.ownerId === playerId)) return rewards;
        }

        if (conditionType === 'GAIN_IF_SIGNAL') {
            // ET.27 : au moins un signal du joueur marqué dans ce secteur (ex: Oumuamua)
            const sector = target ? ScanSystem.getSectorById(game, target) : undefined;
            if (sector?.signals.some(s => s.marked && s.markedBy === playerId)) return rewards;
        }

        if (conditionType === 'GAIN_IF_3_TOKEN') {
            // ET.23 : au moins 3 Tokens (la récompense en dépense 2)
            if ((player.tokens || 0) >= 3) return rewards;
        }

        if (conditionType === 'GAIN_IF_PAY_FOR_LIFETRACE') {
            // ET.21 : une trace de vie Oumuamua posée sur un emplacement payé en Tokens
            const board = game.board.alienBoards.find(b => b.speciesId === AlienBoardType.OUMUAMUA);
            const species = game.species.find(s => s.name === AlienBoardType.OUMUAMUA);
            const paid = board && species && board.lifeTraces.some(t => {
                if (t.playerId !== playerId || t.location !== LifeTraceLocation.SPECIES || t.slotIndex === undefined) return false;
                const slots = t.type === LifeTraceType.RED ? species.fixedSlots.redlifetrace : t.type === LifeTraceType.YELLOW ? species.fixedSlots.yellowlifetrace : species.fixedSlots.bluelifetrace;
                return (slots[t.slotIndex]?.token ?? 0) < 0;
            });
            if (paid) return rewards;
        }

        if (conditionType === 'GAIN_IF_LIFETRACES_ALL_COLORS') {
            // ET.30 : une trace de chaque couleur pour cette espèce
            const board = game.board.alienBoards.find(b => b.speciesId.toLowerCase() === target);
            const colors = new Set(board?.lifeTraces.filter(t => t.playerId === playerId).map(t => t.type));
            if ([LifeTraceType.RED, LifeTraceType.YELLOW, LifeTraceType.BLUE].every(c => colors.has(c))) return rewards;
        }

        if (conditionType === 'GAIN_IF_SPECIMEN') {
            // Une capsule du joueur est sur la destination (Terre ou Mars) : récompense de la mission
            // plus celle du spécimen (« specimen:2 » : deux fois, carte Prélèvement de Reproducteurs)
            const capsule = target ? ProbeSystem.findCapsuleOnPlanet(game, playerId, target) : undefined;
            if (capsule?.specimen) {
                const specimenIndex = parts.indexOf('specimen');
                const times = specimenIndex !== -1 ? parseInt(parts[specimenIndex + 1], 10) || 1 : 1;
                for (let i = 0; i < times; i++) ResourceSystem.accumulateBonus(capsule.specimen.bonus, rewards);
                return rewards;
            }
        }

        return null;
    }
}