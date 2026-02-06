import { Game, Card, ProbeState, FreeActionType, Bonus, GAME_CONSTANTS, RevenueType, CardType, Mission, HistoryEntry, InteractionState } from '../core/types';
import {
    createRotationState,
    calculateAbsolutePosition,
    getCell,
    getAdjacentCells,
    CelestialObject,
    getObjectPosition,
    getAllCelestialObjects
} from '../core/SolarSystemPosition';
import { ResourceSystem } from './ResourceSystem';
import { ProbeSystem } from './ProbeSystem';

export class CardSystem {
    /**
     * Pioche des cartes pour un joueur
     */
    static drawCards(game: Game, playerId: string, count: number): Game {
        const updatedGame = structuredClone(game);
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
        let updatedGame = structuredClone(game);
        const playerIndex = updatedGame.players.findIndex(p => p.id === playerId);
        if (playerIndex === -1) return game;
        let player = updatedGame.players[playerIndex];

        const cardIndex = player.cards.findIndex(c => c.id === cardId);
        if (cardIndex === -1) return game;
        const card = player.cards[cardIndex];

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
        }

        return updatedGame
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
        }

        return { canDiscard: true, reason: "Action inconnue" };
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

        if (player.cards.length === 0) {
            return { canPlay: false, reason: "Aucune carte en main" };
        }

        return player.cards.some(card => this.canPlayCard(game, playerId, card).canPlay)
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

        if (player.credits < card.cost) {
            return { canPlay: false, reason: `Crédits insuffisants (coût: ${card.cost} crédit${card.cost > 1 ? 's' : ''})` };
        }

        // Vérification si la carte donne des déplacements
        const hasMovementEffect = card.immediateEffects?.some(e => e.type === 'ACTION' && e.target === 'MOVEMENT');
        if (hasMovementEffect) {
            const hasProbeInSystem = player.probes.some(p => p.state === ProbeState.IN_SOLAR_SYSTEM);
            if (!hasProbeInSystem) {
                return { canPlay: false, reason: "Nécessite une sonde dans le système solaire" };
            }
        }

        // TODO: Ajouter d'autres conditions de carte ici
        return { canPlay: true, reason: `Jouer la carte (coût: ${card.cost} crédit${card.cost > 1 ? 's' : ''})` };
    }

    /**
     * Joue une carte de la main du joueur
     */
    static playCard(game: Game, playerId: string, cardId: string): { updatedGame: Game, historyEntries: HistoryEntry[], newPendingInteractions: InteractionState[]} {
        let updatedGame = structuredClone(game);
        const player = updatedGame.players.find(p => p.id === playerId);

        if (!player) return { updatedGame: game, historyEntries: [], newPendingInteractions: [] };

        const cardIndex = player.cards.findIndex(c => c.id === cardId);
        if (cardIndex === -1) return { updatedGame: game, historyEntries: [], newPendingInteractions: [] };

        const card = player.cards[cardIndex];

        // Vérification du coût
        if (player.credits < card.cost) {
            return { updatedGame: game, historyEntries: [], newPendingInteractions: [] };
        }

        // Payer le coût
        player.credits -= card.cost;

        // Retirer la carte de la main
        player.cards.splice(cardIndex, 1);
        
        // Initialiser les bonus
        const bonuses: Bonus = {};

        // Ajouter la carte jouée à la pile de défausse ou aux cartes jouées (Missions Fin de partie)
        if (card) {    
          if (card.type === CardType.END_GAME) {
            if (player) {
              if (!player.playedCards) player.playedCards = [];
              player.playedCards.push(card);
            }
          } else if (card.type === CardType.CONDITIONAL_MISSION || card.type === CardType.TRIGGERED_MISSION) {
            if (player) {
              if (!player.missions) player.missions = [];
              const newMission: Mission = {
                id: `mission-${card.id}-${Date.now()}`,
                cardId: card.id,
                name: card.name,
                description: card.description,
                ownerId: player.id,
                requirements: card.permanentEffects || [], // IDs will be added by the factory
                completedRequirementIds: [],
                completed: false,
                originalCard: card
              };
              player.missions.push(newMission);
              // Vérifier immédiatement si la mission est accomplie (rétroactif ou état actuel)
              ProbeSystem.checkAndProcessTriggeredMissions(updatedGame, playerId, bonuses, undefined, newMission.id);
            }
          } else {
            if (!updatedGame.decks.discardPile) updatedGame.decks.discardPile = [];
            updatedGame.decks.discardPile.push(card);
          }
        }    

        // Traitement des effets immédiats
        if (card.immediateEffects) {
            card.immediateEffects.forEach(effect => {
                if (effect.type === 'GAIN') {
                    switch (effect.target) {
                        case 'CREDIT':
                            bonuses.credits = (bonuses.credits || 0) + effect.value;
                            break;
                        case 'ENERGY':
                            bonuses.energy = (bonuses.energy || 0) + effect.value;
                            break;
                        case 'DATA':
                            bonuses.data = Math.min((bonuses.data || 0) + effect.value, GAME_CONSTANTS.MAX_DATA);
                            break;
                        case 'MEDIA':
                            bonuses.media = Math.min((bonuses.media || 0) + effect.value, GAME_CONSTANTS.MAX_MEDIA_COVERAGE);
                            break;
                        case 'CARD':
                            bonuses.card = (bonuses.card || 0) + effect.value;
                            break;
                        case 'PROBE':
                            bonuses.probe = (bonuses.probe || 0) + effect.value;
                            break;
                    }
                } else if (effect.type === 'ACTION') {
                    switch (effect.target) {
                        case 'ANYCARD':
                            bonuses.anycard = (bonuses.anycard || 0) + effect.value;
                            break;
                        case 'ROTATION':
                            bonuses.rotation = (bonuses.rotation || 0) + effect.value;
                            break;
                        case 'LAND':
                            bonuses.landing = (bonuses.landing || 0) + effect.value;
                            break;
                        case 'MOVEMENT':
                            bonuses.movements = (bonuses.movements || 0) + effect.value;
                            break;
                        case 'TECH':
                            bonuses.technologies = (bonuses.technologies || []);
                            bonuses.technologies.push(effect.value);
                            break;
                        case 'SCAN':
                            bonuses.scan = (bonuses.scan || 0) + effect.value;
                            break;
                        case 'SIGNAL':
                            bonuses.signals = (bonuses.signals || []);
                            bonuses.signals.push(effect.value);
                            break;
                    }
                }
            });
        }

        // Traitement des effets passifs temporaires (Buffs de tour)
        if (card.passiveEffects) {
            card.passiveEffects.forEach(effect => {
                if (effect.type === 'VISIT_BONUS' && effect.target) {
                    // Si la planète a DÉJÀ été visitée ce tour-ci, on applique le bonus immédiatement
                    if (player.visitedPlanetsThisTurn.includes(effect.target)) {
                        player.score += effect.value;
                        if (!bonuses.pv) bonuses.pv = 0;
                        bonuses.pv += effect.value;
                    } else {
                        // Sinon on ajoute le buff pour le reste du tour
                        player.activeBuffs.push({ ...effect, source: card.name });
                    }
                } else if (effect.type === 'VISIT_UNIQUE') {
                    player.activeBuffs.push({ ...effect, source: card.name });
                } else if (effect.type === 'ASTEROID_EXIT_COST') {
                    player.activeBuffs.push({ ...effect, source: card.name });
                } else if (effect.type === 'VISIT_ASTEROID') {
                    player.activeBuffs.push({ ...effect, source: card.name });
                } else if (effect.type === 'VISIT_COMET') {
                    player.activeBuffs.push({ ...effect, source: card.name });
                } else if (effect.type === 'SAME_DISK_MOVE') {
                    player.activeBuffs.push({ ...effect, source: card.name });
                } else if (effect.type === 'REVEAL_AND_TRIGGER_FREE_ACTION') {
                    bonuses.revealAndTriggerFreeAction = true;
                } else if (effect.type === 'SCORE_PER_MEDIA') {
                    bonuses.scorePerMedia = effect.value;
                } else if (effect.type === 'SCORE_PER_TECH_TYPE') {
                    player.activeBuffs.push({ ...effect, source: card.name });
                } else if (effect.type === 'MEDIA_IF_SHARED_TECH') {
                    player.activeBuffs.push({ ...effect, source: card.name });
                } else if (effect.type === 'SHARED_TECH_ONLY_NO_BONUS') {
                    bonuses.sharedOnly = true;
                    bonuses.noTileBonus = true;
                } else if (effect.type === 'GAIN_ENERGY_PER_ENERGY_REVENUE') {
                    let energyCardsCount = 0;
                    player.cards.forEach(c => {
                        if (c.revenue === RevenueType.ENERGY) {
                            c.isRevealed = true;
                            energyCardsCount++;
                        }
                    });
                    if (energyCardsCount > 0) {
                        bonuses.energy = (bonuses.energy || 0) + energyCardsCount;
                    }
                } else if (effect.type === 'REVEAL_MOVEMENT_CARDS_FOR_BONUS') {
                    let movementCardsCount = 0;
                    player.cards.forEach(c => {
                        if (c.freeAction === FreeActionType.MOVEMENT) {
                            c.isRevealed = true;
                            movementCardsCount++;
                        }
                    });
                    if (movementCardsCount > 0) {
                        bonuses.probe = (bonuses.probe || 0) + movementCardsCount;
                        bonuses.movements = (bonuses.movements || 0) + movementCardsCount;
                    }
                } else if (effect.type === 'GAIN_ENERGY_PER_REVENUE_ENERGY_AND_RESERVE') {
                    const energyRevCards = player.revenueEnergy - GAME_CONSTANTS.INITIAL_REVENUE_ENERGY;
                    if (energyRevCards > 0) {
                        bonuses.energy = (bonuses.energy || 0) + energyRevCards;
                    }
                    // Reserve self (Energy)
                    player.revenueEnergy += 1;
                    bonuses.energy = (bonuses.energy || 0) + 1;
                } else if (effect.type === 'GAIN_MEDIA_PER_REVENUE_CARD_AND_RESERVE') {
                    const cardRevCards = player.revenueCards - GAME_CONSTANTS.INITIAL_REVENUE_CARDS;
                    if (cardRevCards > 0) {
                        bonuses.media = (bonuses.media || 0) + cardRevCards;
                    }
                    // Reserve self (Card)
                    player.revenueCards += 1;
                    // Immediate gain from reservation (Draw 1 card)
                    updatedGame = CardSystem.drawCards(updatedGame, playerId, 1);
                    bonuses.card = (bonuses.card || 0) + 1;
                } else if (effect.type === 'GAIN_PV_PER_REVENUE_CREDIT_AND_RESERVE') {
                    const creditRevCards = player.revenueCredits - GAME_CONSTANTS.INITIAL_REVENUE_CREDITS;
                    if (creditRevCards > 0) {
                        const pvGain = creditRevCards * 3;
                        bonuses.pv = (bonuses.pv || 0) + pvGain;
                    }
                    // Reserve self (Credit)
                    player.revenueCredits += 1;
                    bonuses.credits = (bonuses.credits || 0) + 1;
                } else if (effect.type === 'OPTIMAL_LAUNCH_WINDOW') {
                    const rotationState = createRotationState(
                        updatedGame.board.solarSystem.rotationAngleLevel1 || 0,
                        updatedGame.board.solarSystem.rotationAngleLevel2 || 0,
                        updatedGame.board.solarSystem.rotationAngleLevel3 || 0
                    );

                    const earthPos = getObjectPosition('earth', rotationState.level1Angle, rotationState.level2Angle, rotationState.level3Angle);
                    if (earthPos) {
                        let movementBonus = 0;
                        const allObjects = getAllCelestialObjects();

                        allObjects.forEach(obj => {
                            if (obj.id === 'earth') return;
                            if (obj.type !== 'planet' && obj.type !== 'comet') return;

                            const objPos = calculateAbsolutePosition(obj, rotationState);
                            if (objPos.isVisible && objPos.disk === earthPos.disk && objPos.absoluteSector === earthPos.absoluteSector) {
                                movementBonus++;
                            }
                        });

                        if (movementBonus > 0) {
                            bonuses.movements = (bonuses.movements || 0) + movementBonus;
                        }
                    }
                } else if (effect.type === 'IGNORE_PROBE_LIMIT') {
                    bonuses.ignoreProbeLimit = true;
                } else if (effect.type === 'CHOICE_MEDIA_OR_MOVE') {
                    player.activeBuffs.push({ ...effect, source: card.name });
                } else if (effect.type === 'OSIRIS_REX_BONUS') {
                    let maxDataBonus = 0;
                    const rotationState = createRotationState(
                        updatedGame.board.solarSystem.rotationAngleLevel1 || 0,
                        updatedGame.board.solarSystem.rotationAngleLevel2 || 0,
                        updatedGame.board.solarSystem.rotationAngleLevel3 || 0
                    );

                    player.probes.filter(p => p.state === ProbeState.IN_SOLAR_SYSTEM && p.solarPosition).forEach(probe => {
                        let currentProbeBonus = 0;

                        // Get absolute position of the probe
                        const tempObj: CelestialObject = {
                            id: probe.id,
                            type: 'empty', // type doesn't matter for position calculation
                            name: 'probe',
                            position: {
                                disk: probe.solarPosition!.disk,
                                sector: probe.solarPosition!.sector,
                                x: 0, y: 0
                            },
                            level: (probe.solarPosition!.level || 0) as 0 | 1 | 2 | 3
                        };
                        const absPos = calculateAbsolutePosition(tempObj, rotationState);

                        // Check current cell: +2 data if on an asteroid field
                        const currentCell = getCell(absPos.disk, absPos.absoluteSector, rotationState);
                        if (currentCell && currentCell.hasAsteroid) {
                            currentProbeBonus += 2;
                        }

                        // Check adjacent cells: +1 data for each adjacent asteroid field
                        const adjacentCellsInfo = getAdjacentCells(absPos.disk, absPos.absoluteSector);
                        adjacentCellsInfo.forEach(adj => {
                            const adjCell = getCell(adj.disk, adj.sector, rotationState);
                            if (adjCell && adjCell.hasAsteroid) {
                                currentProbeBonus += 1;
                            }
                        });

                        if (currentProbeBonus > maxDataBonus) {
                            maxDataBonus = currentProbeBonus;
                        }
                    });

                    if (maxDataBonus > 0) {
                        bonuses.data = (bonuses.data || 0) + maxDataBonus;
                    }
                } else if (effect.type === 'DISCARD_ROW_FOR_FREE_ACTIONS') {
                    // Appliquer les actions gratuites de toutes les cartes de la rangée
                    updatedGame.decks.cardRow.forEach(rowCard => {
                        if (rowCard.freeAction === FreeActionType.MOVEMENT) {
                            bonuses.movements = (bonuses.movements || 0) + 1;
                        } else if (rowCard.freeAction === FreeActionType.DATA) {
                            bonuses.data = (bonuses.data || 0) + 1;
                        } else if (rowCard.freeAction === FreeActionType.MEDIA) {
                            bonuses.media = (bonuses.media || 0) + 1;
                        }
                    });
                    updatedGame.decks.cardRow = [];
                } else if (effect.type === 'ATMOSPHERIC_ENTRY') {
                    bonuses.atmosphericEntry = true;
                } else if (effect.type === 'GAIN_SIGNAL_FROM_HAND') {
                    bonuses.gainSignalFromHand = effect.value;
                } else if (effect.type === 'BONUS_IF_COVERED') {
                    player.activeBuffs.push({ ...effect, source: card.name });
                } else if (effect.type === 'SCORE_IF_UNIQUE') {
                    player.activeBuffs.push({ ...effect, source: card.name });
                } else if (effect.type === 'SCORE_PER_SECTOR') {
                    player.activeBuffs.push({ ...effect, source: card.name });
                } else if (effect.type === 'KEEP_CARD_IF_ONLY') {
                    bonuses.keepCardIfOnly = true;
                } else if (effect.type === 'NO_DATA') {
                    bonuses.noData = true;
                } else if (effect.type === 'ANY_PROBE') {
                    bonuses.anyProbe = true;
                } else if (effect.type === 'GAIN_SIGNAL_ADJACENTS') {
                    bonuses.gainSignalAdjacents = true;
                } else if (effect.type === 'CHOICE_EXPLO_OR_OBS') {
                    bonuses.chooseTechType = true;
                } else if (effect.type === 'IGNORE_SATELLITE_LIMIT') {
                    bonuses.ignoreSatelliteLimit = true;
                }
            });
        }

        // Traitement des effets passifs temporaires (Buffs de tour)
        if (card.permanentEffects) {
            card.permanentEffects.forEach(effect => {

                if (effect.type === 'GAIN_ON_ORBIT' && effect.target && effect.value) {
                    player.permanentBuffs.push({ ...effect, source: card.name });
                } else if (effect.type === 'GAIN_ON_LAND' && effect.target && effect.value) {
                    player.permanentBuffs.push({ ...effect, source: card.name });
                } else if (effect.type === 'GAIN_ON_VISIT_JUPITER' && effect.target && effect.value) {
                    player.permanentBuffs.push({ ...effect, source: card.name });
                } else if (effect.type === 'GAIN_ON_VISIT_SATURN' && effect.target && effect.value) {
                    player.permanentBuffs.push({ ...effect, source: card.name });
                } else if (effect.type === 'GAIN_ON_VISIT_MERCURY' && effect.target && effect.value) {
                    player.permanentBuffs.push({ ...effect, source: card.name });
                } else if (effect.type === 'GAIN_ON_VISIT_VENUS' && effect.target && effect.value) {
                    player.permanentBuffs.push({ ...effect, source: card.name });
                } else if (effect.type === 'GAIN_ON_VISIT_URANUS' && effect.target && effect.value) {
                    player.permanentBuffs.push({ ...effect, source: card.name });
                } else if (effect.type === 'GAIN_ON_VISIT_NEPTUNE' && effect.target && effect.value) {
                    player.permanentBuffs.push({ ...effect, source: card.name });
                } else if (effect.type === 'GAIN_ON_VISIT_PLANET' && effect.target && effect.value) {
                    player.permanentBuffs.push({ ...effect, source: card.name });
                } else if (effect.type === 'GAIN_ON_VISIT_ASTEROID' && effect.target && effect.value) {
                    player.permanentBuffs.push({ ...effect, source: card.name });
                }
            });
        }

        const sequenceId = `seq-${Date.now()}`;
        const { updatedGame: gameAfterBonuses, newPendingInteractions, passiveGains, logs, historyEntries } = ResourceSystem.processBonuses(bonuses || {}, updatedGame, player.id, cardId, sequenceId);

        // Construction du message d'historique unifié
        let message = `paye ${card.cost} crédit${card.cost > 1 ? 's' : ''} pour jouer carte "${card.name}"`;

        if (bonuses && bonuses.subventionDetails) {
        const { cardName, bonusText } = bonuses.subventionDetails;
        message += ` et pioche la carte "${cardName}" pour gagner ${bonusText}`;

        if (bonusText === "1 Donnée") {
            const idx = passiveGains.indexOf(ResourceSystem.formatResource(1, 'DATA'));
            if (idx > -1) passiveGains.splice(idx, 1);
        } else if (bonusText === "1 Média") {
            const idx = passiveGains.indexOf(ResourceSystem.formatResource(1, 'MEDIA'));
            if (idx > -1) passiveGains.splice(idx, 1);
        }
        }

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

        historyEntries.unshift({message, playerId, sequenceId });
        if (otherLogs.length > 0) {
            otherLogs.forEach(log => historyEntries.push({ message: log, playerId, sequenceId }));
        }

        return { updatedGame: gameAfterBonuses, historyEntries, newPendingInteractions };
    }

    static discardToHandSize(game: Game, playerId: string, cardIdsToKeep: string[]): Game {
        const updatedGame = structuredClone(game);
        const player = updatedGame.players.find(p => p.id === playerId);
        if (!player) return updatedGame;

        const cardsToDiscard = player.cards.filter(c => !cardIdsToKeep.includes(c.id));
        player.cards = player.cards.filter(c => cardIdsToKeep.includes(c.id));

        if (cardsToDiscard.length > 0) {
            if (!updatedGame.decks.discardPile) updatedGame.decks.discardPile = [];
            updatedGame.decks.discardPile.push(...cardsToDiscard);
        }

        return updatedGame;
    }

    static discardCard(game: Game, playerId: string, cardId: string): Game {
        const updatedGame = structuredClone(game);
        const player = updatedGame.players.find(p => p.id === playerId);
        if (!player) return updatedGame;

        const cardIndex = player.cards.findIndex(c => c.id === cardId);
        if (cardIndex !== -1) {
            const [card] = player.cards.splice(cardIndex, 1);
            if (!updatedGame.decks.discardPile) updatedGame.decks.discardPile = [];
            updatedGame.decks.discardPile.push(card);
        }

        return updatedGame;
    }

    static discardFromRow(game: Game, cardId: string): { updatedGame: Game, discardedCard: Card | null } {
        const updatedGame = structuredClone(game);
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
}