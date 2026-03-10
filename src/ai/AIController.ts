import { Game, InteractionState, SectorType, LifeTraceLocation, TechnologyCategory, Player, FreeActionType, ProbeState, DiskName, SectorNumber, HistoryEntry, AlienBoardType } from '../core/types';
import { CardSystem } from '../systems/CardSystem';
import { ComputerSystem } from '../systems/ComputerSystem';
import { ProbeSystem } from '../systems/ProbeSystem';
import { ResourceSystem } from '../systems/ResourceSystem';
import { ScanSystem } from '../systems/ScanSystem';
import { ScoreManager } from '../core/ScoreManager';
import { SpeciesSystem } from '../systems/SpeciesSystem';
import { TechnologySystem } from '../systems/TechnologySystem';
import { getObjectPosition, createRotationState, getAbsoluteSectorForProbe, calculateReachableCellsWithEnergy } from '../core/SolarSystemPosition';

interface AIControllerResult {
    updatedGame: Game;
    historyEntries: HistoryEntry[];
    newPendingInteractions: InteractionState[];
}

export class AIController {
    public static processInteractionQueue(
        initialGame: Game,
        initialQueue: InteractionState[],
        sequenceId: string,
        player: Player
    ): AIControllerResult {
        let game = initialGame;
        let queue = [...initialQueue];
        const historyEntries: HistoryEntry[] = [];

        while (queue.length > 0) {
            const interaction = queue.shift()!;
            const result = this.processSingleInteraction(game, player, interaction, sequenceId);
            
            game = result.updatedGame;
            historyEntries.push(...result.historyEntries);
            
            // Add new interactions to the front of the queue to be processed immediately
            queue.unshift(...result.newPendingInteractions);
        }

        return { updatedGame: game, historyEntries, newPendingInteractions: [] };
    }

    private static processSingleInteraction(
        game: Game,
        player: Player,
        interaction: InteractionState,
        sequenceId: string
    ): AIControllerResult {
        let updatedGame = structuredClone(game);
        const historyEntries: HistoryEntry[] = [];
        let newPendingInteractions: InteractionState[] = [];

        const addHistory = (message: string, playerId: string, previousState?: Game) => {
            historyEntries.push({ message, playerId, previousState, sequenceId });
        };

        switch (interaction.type) {
            case 'SELECTING_SCAN_SECTOR': {
                let validSectors = updatedGame.board.sectors.filter(s => !s.isCovered);
                if (interaction.color && interaction.color !== SectorType.ANY) {
                    validSectors = validSectors.filter(s => s.color === interaction.color);
                }
                if (interaction.adjacents) {
                    const solarSystem = updatedGame.board.solarSystem;
                    const earthPos = getObjectPosition('earth', solarSystem.rotationAngleLevel1, solarSystem.rotationAngleLevel2, solarSystem.rotationAngleLevel3, solarSystem.extraCelestialObjects);
                    if (earthPos) {
                        validSectors = validSectors.filter(s => {
                            const sNum = parseInt(s.id.replace('sector_', ''));
                            const diff = Math.abs(earthPos.absoluteSector - sNum);
                            return diff <= 1 || diff === 7;
                        });
                    }
                }
                if (validSectors.length > 0) {
                    const chosen = validSectors[Math.floor(Math.random() * validSectors.length)];
                    const initialLogs: string[] = [];
                    if (interaction.cardId) {
                        const { updatedGame: ug, discardedCard } = CardSystem.discardFromRow(updatedGame, interaction.cardId);
                        if (discardedCard) {
                            updatedGame = ug;
                            initialLogs.push(`utilise carte "${discardedCard.name}" (${discardedCard.scanSector}) de la rangée`);
                        }
                    }
                    const res = ScanSystem.performSignalAndCover(updatedGame, player.id, chosen.id, initialLogs, interaction.noData, sequenceId);
                    updatedGame = res.updatedGame;
                    historyEntries.push(...res.historyEntries);
                    newPendingInteractions.push(...(res.newPendingInteractions || []));
                }
                break;
            }
            case 'DRAW_AND_SCAN': {
                if (updatedGame.decks.cards.length > 0) {
                    const drawnCard = updatedGame.decks.cards.shift();
                    if (drawnCard) {
                        if (!updatedGame.decks.discardPile) updatedGame.decks.discardPile = [];
                        updatedGame.decks.discardPile.push(drawnCard);
                        addHistory(`révèle carte "${drawnCard.name}" (${drawnCard.scanSector}) de la pioche`, player.id, game);
                        newPendingInteractions.push({ type: 'SELECTING_SCAN_SECTOR', color: drawnCard.scanSector, cardId: drawnCard.id, sequenceId });
                    }
                }
                break;
            }
            case 'SELECTING_SCAN_CARD': {
                const row = updatedGame.decks.cardRow;
                if (row.length > 0) {
                    const randomCard = row[Math.floor(Math.random() * row.length)];
                    newPendingInteractions.push({ type: 'SELECTING_SCAN_SECTOR', color: randomCard.scanSector, cardId: randomCard.id, sequenceId });
                }
                break;
            }
            case 'RESOLVING_SECTOR': {
                const { sectorId } = interaction;
                const coverageResult = ScanSystem.coverSector(updatedGame, player.id, sectorId);
                updatedGame = coverageResult.updatedGame;
                const coverageLogs = [...coverageResult.logs];
                if (coverageResult.bonuses) {
                    const bonusRes = ResourceSystem.processBonuses(coverageResult.bonuses, updatedGame, player.id, 'scan', sequenceId || '');
                    updatedGame = bonusRes.updatedGame;
                    coverageLogs.push(...bonusRes.logs);
                    historyEntries.push(...bonusRes.historyEntries);
                    newPendingInteractions.push(...(bonusRes.newPendingInteractions || []).map(i => ({ ...i, sequenceId })));
                }
                if (coverageLogs.length > 0) {
                    addHistory(coverageLogs.join(', '), coverageResult.winnerId || player.id, game);
                }
                break;
            }
            case 'PLACING_LIFE_TRACE': {
                const slotType = Math.random() < 0.5 ? LifeTraceLocation.TRIANGLE : LifeTraceLocation.SPECIES;
                const board = updatedGame.board.alienBoards[0]; // Simple AI: always place on first board
                const species = updatedGame.species.find(s => s.name === board.speciesId);
                let slotIndex: number | undefined = undefined;
                if (slotType === LifeTraceLocation.SPECIES && species) {
                    const traces = board.lifeTraces.filter(t => t.type === interaction.color && t.location === LifeTraceLocation.SPECIES);
                    const indices = new Set(traces.map(t => t.slotIndex));
                    let i = 0;
                    while (indices.has(i)) i++;
                    slotIndex = i;
                }
                const res = SpeciesSystem.placeLifeTrace(updatedGame, 0, interaction.color, player.id, sequenceId, slotType, slotIndex);
                historyEntries.push(...res.historyEntries);
                if (res.updatedGame.isSpeciesDiscovered) {
                    addHistory("découvre une nouvelle espèce Alien !", player.id);
                    res.updatedGame.isSpeciesDiscovered = false;
                }
                updatedGame = res.updatedGame;
                newPendingInteractions.push(...(res.newPendingInteractions || []).map(i => ({ ...i, sequenceId })));
                break;
            }
            case 'PLACING_OBJECTIVE_MARKER': {
                const availableObjectives = updatedGame.board.objectiveTiles.filter(tile => !tile.markers.includes(player.id));
                if (availableObjectives.length > 0) {
                    const randomObjective = availableObjectives[Math.floor(Math.random() * availableObjectives.length)];
                    const result = ScoreManager.placeObjectiveMarker(updatedGame, player.id, randomObjective.id, interaction.milestone);
                    updatedGame = result.updatedGame;
                    if (result.logMessage) addHistory(result.logMessage, player.id, game);
                }
                break;
            }
            case 'RESERVING_CARD': {
                const p = updatedGame.players.find(p => p.id === player.id);
                if (p && p.cards.length > 0) {
                    const count = Math.min(interaction.count, p.cards.length);
                    const shuffled = [...p.cards].sort(() => 0.5 - Math.random());
                    const cardsToReserve = shuffled.slice(0, count);
                    cardsToReserve.forEach(card => {
                        updatedGame = CardSystem.reserveCard(updatedGame, p.id, card.id);
                        addHistory(`réserve carte "${card.name}"`, p.id, game);
                    });
                }
                break;
            }
            case 'ACQUIRING_CARD': {
                for (let i = 0; i < interaction.count; i++) {
                    const row = updatedGame.decks.cardRow;
                    let cardId: string | undefined = undefined;
                    if (row.length > 0 && Math.random() > 0.5) {
                        cardId = row[Math.floor(Math.random() * row.length)].id;
                    }
                    const res = CardSystem.buyCard(updatedGame, player.id, cardId, interaction.isFree);
                    if (!res.error) {
                        const cardName = cardId ? row.find(c => c.id === cardId)?.name : "Pioche";
                        addHistory(`acquiert carte ${cardId ? `"${cardName}"` : "de la pioche"}`, player.id, updatedGame);
                        updatedGame = res.updatedGame;
                        if (interaction.triggerFreeAction) {
                            const p = updatedGame.players.find(p => p.id === player.id);
                            if (p && p.cards.length > 0) {
                                const card = p.cards[p.cards.length - 1];
                                if (card.freeAction === FreeActionType.MOVEMENT) {
                                    newPendingInteractions.push({ type: 'MOVING_PROBE', count: 1, sequenceId });
                                }
                                // Other free actions are applied directly in ResourceSystem
                            }
                        }
                    }
                }
                break;
            }
            case 'MOVING_PROBE': {
                const p = updatedGame.players.find(p => p.id === player.id);
                if (p) {
                    const probes = p.probes.filter(pr => pr.state === ProbeState.IN_SOLAR_SYSTEM && pr.solarPosition);
                    if (probes.length > 0) {
                        const probe = probes[Math.floor(Math.random() * probes.length)];
                        const rotationState = createRotationState(updatedGame.board.solarSystem.rotationAngleLevel1 || 0, updatedGame.board.solarSystem.rotationAngleLevel2 || 0, updatedGame.board.solarSystem.rotationAngleLevel3 || 0);
                        const absPos = getAbsoluteSectorForProbe(probe.solarPosition!, rotationState);
                        const reachable = calculateReachableCellsWithEnergy(probe.solarPosition!.disk, absPos, 1, p.energy, rotationState, false, undefined, updatedGame.board.solarSystem.extraCelestialObjects);
                        const destinations = Array.from(reachable.keys()).filter(k => k !== `${probe.solarPosition!.disk}${absPos}`);
                        if (destinations.length > 0) {
                            const destKey = destinations[Math.floor(Math.random() * destinations.length)];
                            const disk = destKey[0] as DiskName;
                            const sector = parseInt(destKey.substring(1)) as SectorNumber;
                            const moveRes = ProbeSystem.moveProbe(updatedGame, p.id, probe.id, disk, sector, 1, sequenceId);
                            updatedGame = moveRes.updatedGame;
                            historyEntries.push(...moveRes.historyEntries);
                            newPendingInteractions.push(...moveRes.newPendingInteractions);
                        }
                    }
                }
                if (interaction.count > 1) {
                    newPendingInteractions.push({ ...interaction, count: interaction.count - 1 });
                }
                break;
            }
            case 'ACQUIRING_TECH': {
                const availableTechs = TechnologySystem.getAvailableTechs(updatedGame);
                const p = updatedGame.players.find(p => p.id === player.id);
                let validTechs = availableTechs;
                if (p) {
                    validTechs = validTechs.filter(tech => !p.technologies.some(t => t.id.startsWith(tech.id.substring(0, tech.id.lastIndexOf('-')))));
                }
                if (interaction.categories) {
                    validTechs = validTechs.filter(t => interaction.categories!.includes(t.type));
                }
                if (validTechs.length > 0) {
                    const tech = validTechs[Math.floor(Math.random() * validTechs.length)];
                    let targetCol: number | undefined = undefined;
                    if (tech.type === TechnologyCategory.COMPUTING) {
                        targetCol = [1, 3, 5, 6][Math.floor(Math.random() * 4)];
                    }
                    const res = TechnologySystem.acquireTechnology(updatedGame, player.id, tech, targetCol, interaction.noTileBonus);
                    updatedGame = res.updatedGame;
                    historyEntries.push(...(res.historyEntries || []));
                    newPendingInteractions.push(...(res.newPendingInteractions || []).map(i => ({ ...i, sequenceId })));
                }
                break;
            }
            case 'SELECTING_COMPUTER_SLOT': {
                const tech = interaction.tech;
                const targetCol = [1, 3, 5, 6][Math.floor(Math.random() * 4)];
                const p = updatedGame.players.find(p => p.id === player.id);
                if (p) {
                    ComputerSystem.assignTechnology(p, tech, targetCol);
                    addHistory(`assigne technologie "${tech.name}" au slot ${targetCol}`, player.id, game);
                }
                break;
            }
            case 'CHOOSING_OBS2_ACTION': {
                const p = updatedGame.players.find(p => p.id === player.id);
                if (p && p.mediaCoverage > 0) {
                    p.mediaCoverage -= 1;
                    const rotationState = createRotationState(updatedGame.board.solarSystem.rotationAngleLevel1 || 0, updatedGame.board.solarSystem.rotationAngleLevel2 || 0, updatedGame.board.solarSystem.rotationAngleLevel3 || 0);
                    const mercuryPos = getObjectPosition('mercury', rotationState.level1Angle, rotationState.level2Angle, rotationState.level3Angle, updatedGame.board.solarSystem.extraCelestialObjects);
                    if (mercuryPos) {
                        const mercurySector = updatedGame.board.sectors[mercuryPos.absoluteSector - 1];
                        const res = ScanSystem.performSignalAndCover(updatedGame, p.id, mercurySector.id, [`paye 1 Média pour utiliser Observation II`], false, sequenceId);
                        updatedGame = res.updatedGame;
                        historyEntries.push(...res.historyEntries);
                        newPendingInteractions.push(...(res.newPendingInteractions || []));
                    }
                }
                break;
            }
            case 'CHOOSING_OBS3_ACTION': {
                const p = updatedGame.players.find(p => p.id === player.id);
                if (p && p.cards.length > 0) {
                    const card = p.cards[0];
                    updatedGame = CardSystem.discardCard(updatedGame, p.id, card.id);
                    newPendingInteractions.push({ type: 'SELECTING_SCAN_SECTOR', color: card.scanSector, sequenceId: sequenceId, cardId: card.id });
                    addHistory(`utilise carte "${card.name}" pour Observation III`, p.id, game);
                }
                break;
            }
            case 'CHOOSING_OBS4_ACTION': {
                const choice = Math.random() > 0.5 ? 'PROBE' : 'MOVE';
                const p = updatedGame.players.find(p => p.id === player.id);
                if (p) {
                    if (choice === 'PROBE' && p.energy >= 1) {
                        p.energy -= 1;
                        const launchRes = ProbeSystem.launchProbe(updatedGame, p.id, true, false);
                        if (launchRes.probeId) {
                            updatedGame = launchRes.updatedGame;
                            addHistory(`lance 1 sonde (Observation IV)`, p.id, game);
                        }
                    } else {
                        newPendingInteractions.push({ type: 'MOVING_PROBE', count: 1, sequenceId });
                        addHistory(`choisit 1 déplacement (Observation IV)`, p.id, game);
                    }
                }
                break;
            }
            case 'CHOOSING_BONUS_ACTION': {
                const firstChoice = interaction.choices.find(c => !c.done);
                if (firstChoice) {
                    const updatedChoices = interaction.choices.map(c => c.id === firstChoice.id ? { ...c, done: true } : c);
                    const remainingChoices = updatedChoices.filter(c => !c.done);
                    newPendingInteractions.push(firstChoice.state);
                    if (remainingChoices.length > 0) {
                        newPendingInteractions.push({ ...interaction, choices: updatedChoices });
                    }
                }
                break;
            }
            case 'ACQUIRING_ALIEN_CARD': {
                const species = updatedGame.species.find(s => s.id === interaction.speciesId);
                if (species) {
                    const canPickFromRow = species.cardRow && species.cardRow.length > 0;
                    const canPickFromDeck = species.cards && species.cards.length > 0;
                    let cardId = 'deck';
                    if (canPickFromRow && (!canPickFromDeck || Math.random() > 0.5)) {
                        cardId = species.cardRow[Math.floor(Math.random() * species.cardRow.length)].id;
                    }
                    const res = SpeciesSystem.acquireAlienCard(updatedGame, player.id, interaction.speciesId, cardId);
                    if (res.drawnCard) {
                        updatedGame = res.updatedGame;
                        addHistory(`acquiert la carte Alien "${res.drawnCard.name}"`, player.id, game);
                    }
                }
                break;
            }
            case 'ORBITING_PROBE':
            case 'LANDING_PROBE': {
                const probesOnPlanets = player.probes.map(probe => {
                    const info = ProbeSystem.probeOnPlanetInfo(updatedGame, player.id);
                    return info.hasProbe ? { probe, planetId: info.planetId } : null;
                }).filter((p): p is { probe: any, planetId: string | undefined } => p !== null);

                if (probesOnPlanets.length > 0) {
                    const target = probesOnPlanets[0]!;
                    if (interaction.type === 'ORBITING_PROBE') {
                        const res = ProbeSystem.orbitProbe(updatedGame, player.id, target.probe.id, target.planetId!, sequenceId, true);
                        updatedGame = res.updatedGame;
                        historyEntries.push(...res.historyEntries);
                        newPendingInteractions.push(...res.newPendingInteractions);
                    } else { // LANDING_PROBE
                        const res = ProbeSystem.landProbe(updatedGame, player.id, target.probe.id, target.planetId!, true, undefined, interaction.source, sequenceId);
                        updatedGame = res.updatedGame;
                        historyEntries.push(...res.historyEntries);
                        newPendingInteractions.push(...res.newPendingInteractions);
                    }
                }
                break;
            }
            case 'COLLECTING_SPECIMEN': {
                const planet = updatedGame.board.planets.find(p => p.id === interaction.planetId);
                if (planet && planet.mascamiteTokens && planet.mascamiteTokens.length > 0) {
                    const token = planet.mascamiteTokens.splice(0, 1)[0];
                    const res = ResourceSystem.processBonuses(token.bonus, updatedGame, player.id, 'mascamite_specimen', sequenceId);
                    updatedGame = res.updatedGame;
                    addHistory(`prélève un spécimen Mascamite sur ${planet.name}`, player.id, game);
                    historyEntries.push(...res.historyEntries);
                    newPendingInteractions.push(...res.newPendingInteractions);
                }
                break;
            }
            case 'CHOOSING_CENTAURIEN_REWARD': {
                const species = updatedGame.species.find(s => s.name === AlienBoardType.CENTAURIENS);
                if (species && species.message) {
                    const availableTokens = species.message.map((token, index) => ({ token, index })).filter(item => item.token.isAvailable);
                    if (availableTokens.length > 0) {
                        const choice = availableTokens[Math.floor(Math.random() * availableTokens.length)];
                        const res = SpeciesSystem.claimCentaurienReward(updatedGame, player.id, choice.index);
                        updatedGame = res.updatedGame;
                        historyEntries.push(...res.historyEntries);
                        newPendingInteractions.push(...res.newPendingInteractions);
                    }
                }
                break;
            }
            case 'CLAIMING_MISSION_REQUIREMENT': {
                const p = updatedGame.players.find(p => p.id === player.id)!;
                const mission = p.missions.find(m => m.id === interaction.missionId);
                if (mission && !mission.completedRequirementIds.includes(interaction.requirementId)) {
                    const requirement = mission.requirements.find(r => r.id === interaction.requirementId);
                    if (requirement) {
                        const bonus = CardSystem.evaluateMission(updatedGame, player.id, requirement.value, true); // skipCheck = true
                        if (bonus) {
                            const res = ResourceSystem.processBonuses(bonus, updatedGame, player.id, 'mission-claim', sequenceId);
                            updatedGame = res.updatedGame;
                            const updatedPlayer = updatedGame.players.find(p => p.id === player.id)!;
                            const m = updatedPlayer.missions.find(m => m.id === mission.id)!;
                            m.completedRequirementIds.push(interaction.requirementId);
                            if (m.completedRequirementIds.length >= m.requirements.length) {
                                m.completed = true;
                            }
                            updatedPlayer.missions.forEach(mis => mis.fulfillableRequirementIds = []);
                            
                            const actionText = m.completed ? "accomplit" : "valide un objectif de";
                            addHistory(`${actionText} la mission "${m.name}"${res.logs.length > 0 ? ' et ' + res.logs.join(', ') : ''}`, player.id, game);
                            historyEntries.push(...res.historyEntries);
                            newPendingInteractions.push(...res.newPendingInteractions);
                        }
                    }
                }
                break;
            }
            case 'CHOOSING_MEDIA_OR_MOVE': {
                const choice = Math.random() > 0.5 ? 'MEDIA' : 'MOVE';
                if (choice === 'MEDIA') {
                    const res = ResourceSystem.updateMedia(updatedGame, player.id, 1);
                    updatedGame = res.updatedGame;
                    addHistory(`choisit de gagner ${ResourceSystem.formatResource(1, 'MEDIA')}`, player.id, game);
                } else {
                    newPendingInteractions.push({ type: 'MOVING_PROBE', count: 1, sequenceId });
                    addHistory(`choisit un déplacement gratuit`, player.id, game);
                }
                if (interaction.remainingMoves && interaction.remainingMoves > 0) {
                    newPendingInteractions.push({ type: 'MOVING_PROBE', count: interaction.remainingMoves, sequenceId });
                }
                break;
            }
            case 'REMOVING_ORBITER': {
                const p = updatedGame.players.find(p => p.id === player.id)!;
                const orbiter = p.probes.find(pr => pr.state === 'IN_ORBIT');
                if (orbiter && orbiter.planetId) {
                    const planet = updatedGame.board.planets.find(pl => pl.id === orbiter.planetId);
                    if (planet) {
                        const orbiterIndex = planet.orbiters.findIndex(o => o.id === orbiter.id);
                        if (orbiterIndex !== -1) {
                            const res = ProbeSystem.removeOrbiter(updatedGame, p.id, planet.id, orbiterIndex, sequenceId);
                            updatedGame = res.updatedGame;
                            historyEntries.push(...res.historyEntries);
                            newPendingInteractions.push(...res.newPendingInteractions);
                        }
                    }
                }
                break;
            }
            case 'REMOVING_LANDER': {
                 const p = updatedGame.players.find(p => p.id === player.id)!;
                 const lander = p.probes.find(pr => pr.state === 'LANDED');
                 if (lander && lander.planetId) {
                     const planet = updatedGame.board.planets.find(pl => pl.id === lander.planetId);
                     if (planet) {
                         const landerIndex = planet.landers.findIndex(l => l.id === lander.id);
                         if (landerIndex !== -1) {
                             const res = ProbeSystem.removeLander(updatedGame, p.id, planet.id, landerIndex, sequenceId);
                             updatedGame = res.updatedGame;
                             historyEntries.push(...res.historyEntries);
                             newPendingInteractions.push(...res.newPendingInteractions);
                         }
                     }
                 }
                 break;
            }
            case 'CONSULTING_SPECIMEN': {
                const planet = updatedGame.board.planets.find(p => p.id === interaction.planetId);
                if (planet && planet.mascamiteTokens && planet.mascamiteTokens.length > 0) {
                    const token = planet.mascamiteTokens[0]; // Just consult the first one
                    const res = ResourceSystem.processBonuses(token.bonus, updatedGame, player.id, 'mascamite_specimen', sequenceId);
                    updatedGame = res.updatedGame;
                    addHistory(`étudie un spécimen Mascamite sur ${planet.name}`, player.id, game);
                    historyEntries.push(...res.historyEntries);
                    newPendingInteractions.push(...res.newPendingInteractions);
                }
                break;
            }
            default:
                addHistory(`AI ne peut pas gérer l'interaction: ${interaction.type}`, player.id);
                break;
        }

        return { updatedGame, historyEntries, newPendingInteractions };
    }
}
