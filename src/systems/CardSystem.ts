import { Game, Card, ProbeState, FreeActionType, Bonus, GAME_CONSTANTS, RevenueType, CardType, Mission, HistoryEntry, InteractionState, LifeTraceType, Player, CardEffect, SectorType, TechnologyCategory } from '../core/types';
import {
    createRotationState,
    calculateAbsolutePosition,
    getCell,
    getAdjacentCells,
    CelestialObject,
    getObjectPosition,
    getAllCelestialObjects,
    getAbsoluteSectorForProbe,
    calculateReachableCells
} from '../core/SolarSystemPosition';
import { ResourceSystem } from './ResourceSystem';
import { ProbeSystem } from './ProbeSystem';

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

        // Check for GAIN_ON_PLAY buffs
        const processedSources = new Set<string>();
        const missionsToTrigger: { missionId: string, requirementId: string }[] = [];
        player.permanentBuffs.forEach(buff => {
            let buffTypeMatches = false;
            if (card.cost === 1 && buff.type === 'GAIN_ON_PLAY_1_CREDIT') buffTypeMatches = true;
            else if (card.cost === 2 && buff.type === 'GAIN_ON_PLAY_2_CREDITS') buffTypeMatches = true;
            else if (card.cost === 3 && buff.type === 'GAIN_ON_PLAY_3_CREDITS') buffTypeMatches = true;

            if (buffTypeMatches) {
                if (buff.id && buff.source) {
                    const mission = player.missions.find(m => m.name === buff.source);
                    if (mission && (mission.completedRequirementIds.includes(buff.id) || mission.fulfillableRequirementIds?.includes(buff.id))) return;
                    if (mission && buff.id) {
                        missionsToTrigger.push({ missionId: mission.id, requirementId: buff.id });
                    }
                }
                if (buff.source && processedSources.has(buff.source)) return;
                if (buff.source) processedSources.add(buff.source);

                CardSystem.markMissionRequirementFulfillable(player, buff);
            }
        });

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
                fulfillableRequirementIds: [],
                completed: false,
                originalCard: card
              };
              player.missions.push(newMission);
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
                } else if (effect.type === 'GAIN_LIFETRACE_IF_ASTEROID') {
                    const rotationState = createRotationState(
                        updatedGame.board.solarSystem.rotationAngleLevel1 || 0,
                        updatedGame.board.solarSystem.rotationAngleLevel2 || 0,
                        updatedGame.board.solarSystem.rotationAngleLevel3 || 0
                    );

                    const hasProbeOnAsteroid = player.probes.some(p => {
                        if (p.state !== ProbeState.IN_SOLAR_SYSTEM || !p.solarPosition) return false;
                        const absSector = getAbsoluteSectorForProbe(p.solarPosition, rotationState);
                        const cell = getCell(p.solarPosition.disk, absSector, rotationState, updatedGame.board.solarSystem.extraCelestialObjects);
                        return cell?.hasAsteroid;
                    });

                    if (hasProbeOnAsteroid) {
                        console.log(game);
                        let scope: LifeTraceType = LifeTraceType.ANY;
                        if (effect.target === 'yellow') scope = LifeTraceType.YELLOW;
                        else if (effect.target === 'red') scope = LifeTraceType.RED;
                        else if (effect.target === 'blue') scope = LifeTraceType.BLUE;

                        if (!bonuses.lifetraces) bonuses.lifetraces = [];
                        bonuses.lifetraces.push({ amount: effect.value, scope });
                    }
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

                    const earthPos = getObjectPosition('earth', rotationState.level1Angle, rotationState.level2Angle, rotationState.level3Angle, updatedGame.board.solarSystem.extraCelestialObjects);
                    if (earthPos) {
                        let movementBonus = 0;
                        const allObjects = getAllCelestialObjects();

                        allObjects.forEach(obj => {
                            if (obj.id === 'earth') return;
                            if (obj.type !== 'planet' && obj.type !== 'comet') return;

                            const objPos = calculateAbsolutePosition(obj, rotationState, updatedGame.board.solarSystem.extraCelestialObjects);
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
                        const absPos = calculateAbsolutePosition(tempObj, rotationState, updatedGame.board.solarSystem.extraCelestialObjects);

                        // Check current cell: +2 data if on an asteroid field
                        const currentCell = getCell(absPos.disk, absPos.absoluteSector, rotationState, updatedGame.board.solarSystem.extraCelestialObjects);
                        if (currentCell && currentCell.hasAsteroid) {
                            currentProbeBonus += 2;
                        }

                        // Check adjacent cells: +1 data for each adjacent asteroid field
                        const adjacentCellsInfo = getAdjacentCells(absPos.disk, absPos.absoluteSector);
                        adjacentCellsInfo.forEach(adj => {
                            const adjCell = getCell(adj.disk, adj.sector, rotationState, updatedGame.board.solarSystem.extraCelestialObjects);
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

        // Traitement des effets permanents (Missions déclenchables)
        if (card.permanentEffects) {
            card.permanentEffects.forEach(effect => {
                if (effect.type.startsWith('GAIN_ON_')) {
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
        message += ` et pioche carte "${cardName}" pour gagner ${bonusText}`;

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

    static discardCardForFreeAction(game: Game, playerId: string, cardId: string): { updatedGame: Game, historyEntries: HistoryEntry[], newPendingInteractions: InteractionState[] } {
        let updatedGame = structuredClone(game);
        const player = updatedGame.players.find(p => p.id === playerId);
        if (!player) return { updatedGame: game, historyEntries: [], newPendingInteractions: [] };

        const card = player.cards.find(c => c.id === cardId);
        if (!card || !card.freeAction) return { updatedGame: game, historyEntries: [], newPendingInteractions: [] };

        const sequenceId = `free-action-discard-${Date.now()}`;
        const bonuses: Bonus = {};
        
        // 1. Get bonus from the card's free action
        if (card.freeAction === FreeActionType.MEDIA) {
            bonuses.media = (bonuses.media || 0) + 1;
        } else if (card.freeAction === FreeActionType.DATA) {
            bonuses.data = (bonuses.data || 0) + 1;
        } else if (card.freeAction === FreeActionType.MOVEMENT) {
            bonuses.movements = (bonuses.movements || 0) + 1;
        }

        // 2. Check for GAIN_ON_DISCARD buffs and mark mission as fulfillable
        const processedSources = new Set<string>();
        const missionsToTrigger: { missionId: string, requirementId: string }[] = [];
        player.permanentBuffs.forEach(buff => {
            let buffTypeMatches = false;
            if (card.freeAction === FreeActionType.MEDIA && buff.type === 'GAIN_ON_DISCARD_MEDIA') buffTypeMatches = true;
            if (card.freeAction === FreeActionType.DATA && buff.type === 'GAIN_ON_DISCARD_DATA') buffTypeMatches = true;
            if (card.freeAction === FreeActionType.MOVEMENT && buff.type === 'GAIN_ON_DISCARD_MOVE') buffTypeMatches = true;

            if (buffTypeMatches) {
                if (buff.id && buff.source) {
                    const mission = player.missions.find(m => m.name === buff.source);
                    if (mission && (mission.completedRequirementIds.includes(buff.id) || mission.fulfillableRequirementIds?.includes(buff.id))) return;
                    if (mission && buff.id) {
                        missionsToTrigger.push({ missionId: mission.id, requirementId: buff.id });
                    }
                }
                if (buff.source && processedSources.has(buff.source)) return;
                if (buff.source) processedSources.add(buff.source);

                CardSystem.markMissionRequirementFulfillable(player, buff);
            }
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

        return { updatedGame: gameAfterBonuses, historyEntries, newPendingInteractions };
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

    /**
     * Achète une carte (depuis la rangée ou la pioche)
     */
    static buyCard(game: Game, playerId: string, cardIdFromRow?: string, isFree: boolean = false): { updatedGame: Game, error?: string } {
        let updatedGame = { ...game };
        
        // Copie profonde du joueur et de ses cartes
        updatedGame.players = updatedGame.players.map(p => p.id === playerId ? { ...p, cards: [...p.cards] } : p);
        const player = updatedGame.players.find(p => p.id === playerId);
        if (!player) return { updatedGame: game, error: "Joueur non trouvé" };

        if (!isFree) {
            if (player.mediaCoverage < 3) {
                return { updatedGame: game, error: "Couverture médiatique insuffisante" };
            }

            player.mediaCoverage -= 3;
        }

        if (cardIdFromRow) {
            // Copie profonde de la rangée de cartes avant modification
            updatedGame.decks = {
                ...updatedGame.decks,
                cardRow: [...(updatedGame.decks.cardRow || [])]
            };

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
     * Marque une condition de mission comme "remplie" (en attente de validation par le joueur)
     * Utilisé pour les missions déclenchables (GAIN_ON_...)
     */
    static markMissionRequirementFulfillable(player: Player, buff: CardEffect): string | null {
        if (buff.source && buff.id) {
            const mission = player.missions.find(m => m.name === buff.source);
            if (mission) {
                // Si déjà complété ou déjà marqué comme fulfillable, on ignore
                if (mission.completedRequirementIds.includes(buff.id)) return null;
                if (!mission.fulfillableRequirementIds) mission.fulfillableRequirementIds = [];
                if (mission.fulfillableRequirementIds.includes(buff.id)) return null;

                mission.fulfillableRequirementIds.push(buff.id);
                return mission.name;
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
            'GAIN_ON_VISIT',
            'GAIN_ON_TECH',
            'GAIN_ON_SIGNAL',
            'GAIN_ON_LIFETRACE',
            'GAIN_ON_DISCARD',
            'GAIN_ON_PLAY'
        ];

        let target: string | undefined;
        let bonusStartIndex = 1;

        if (conditionsWithTarget.includes(conditionType)) {
            target = parts[1];
            bonusStartIndex = 2;
        }
        
        // Extraction des bonus (paires clé:valeur à partir de l'index 2)
        const rewards: Bonus = {};
        for (let i = bonusStartIndex; i < parts.length; i += 2) {
            if (i + 1 < parts.length) {
                const bonusType = parts[i];
                const bonusValue = parseInt(parts[i+1], 10);
                
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
                const types = new Set(player.lifeTraces.map(t => t.type));
                if (types.size >= 3) return rewards;
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
        
        return null;
    }
}