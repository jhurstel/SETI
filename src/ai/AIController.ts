import { cloneGame } from '../core/cloneGame';
import { Game, InteractionState, TechnologyCategory, Player, FreeActionType, ProbeState, DiskName, SectorNumber, HistoryEntry, AlienBoardType, Probe } from '../core/types';
import { CardSystem } from '../systems/CardSystem';
import { ComputerSystem } from '../systems/ComputerSystem';
import { ProbeSystem } from '../systems/ProbeSystem';
import { ResourceSystem } from '../systems/ResourceSystem';
import { ScanSystem } from '../systems/ScanSystem';
import { ScoreManager } from '../core/ScoreManager';
import { InteractionResolver } from '../core/InteractionResolver';
import { SpeciesSystem } from '../systems/SpeciesSystem';
import { TechnologySystem } from '../systems/TechnologySystem';
import { createRotationState, getAbsoluteSectorForProbe, calculateReachableCellsWithEnergy } from '../core/SolarSystemPosition';
import { AIBehavior } from './AIBehavior';
import { AIEvaluator } from './AIEvaluator';

/** Interactions où le robot fait un choix au hasard : un robot stratégique tire plusieurs choix et garde le meilleur */
const RANDOM_CHOICE_INTERACTIONS: InteractionState['type'][] = [
    'SELECTING_SCAN_SECTOR', 'PLACING_OBJECTIVE_MARKER', 'RESERVING_CARD', 'ACQUIRING_CARD', 'MOVING_PROBE',
    'ACQUIRING_TECH', 'SELECTING_COMPUTER_SLOT', 'CHOOSING_OBS4_ACTION', 'ACQUIRING_ALIEN_CARD',
    'CHOOSING_CENTAURIEN_REWARD', 'CHOOSING_MEDIA_OR_MOVE',
];
/** Nombre de tirages comparés par un robot stratégique */
const STRATEGIC_SAMPLES = 4;

interface AIControllerResult {
    updatedGame: Game;
    historyEntries: HistoryEntry[];
    /** Interactions destinées à un joueur humain (ex: gagnant d'un secteur couvert par le robot), à confier à l'interface. */
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
        const queue = [...initialQueue];
        const historyEntries: HistoryEntry[] = [];
        const humanInteractions: InteractionState[] = [];

        while (queue.length > 0) {
            const interaction = queue.shift()!;

            // Interaction adressée à un autre joueur : un robot la résout lui-même, un humain la reçoit dans l'interface
            const ownerId = 'playerId' in interaction ? interaction.playerId : undefined;
            const owner = ownerId && ownerId !== player.id ? game.players.find(p => p.id === ownerId) : undefined;
            if (owner?.type === 'human') {
                humanInteractions.push(interaction);
                continue;
            }

            const result = this.resolveInteraction(game, owner ?? player, interaction, sequenceId);

            game = result.updatedGame;
            historyEntries.push(...result.historyEntries);

            // Add new interactions to the front of the queue to be processed immediately
            queue.unshift(...result.newPendingInteractions);
        }

        return { updatedGame: game, historyEntries, newPendingInteractions: humanInteractions };
    }

    /**
     * Résout une interaction. Un robot stratégique compare plusieurs tirages des choix aléatoires
     * et garde celui qui donne la meilleure position.
     */
    private static resolveInteraction(game: Game, player: Player, interaction: InteractionState, sequenceId: string): AIControllerResult {
        if (!AIBehavior.isStrategic(player) || !RANDOM_CHOICE_INTERACTIONS.includes(interaction.type)) {
            return this.processSingleInteraction(game, player, interaction, sequenceId);
        }
        let best: { result: AIControllerResult; value: number } | null = null;
        for (let i = 0; i < STRATEGIC_SAMPLES; i++) {
            const result = this.processSingleInteraction(game, player, interaction, sequenceId);
            const value = AIEvaluator.evaluate(result.updatedGame, player.id);
            if (!best || value > best.value) best = { result, value };
        }
        return best!.result;
    }

    private static processSingleInteraction(
        game: Game,
        player: Player,
        interaction: InteractionState,
        sequenceId: string
    ): AIControllerResult {
        let updatedGame = cloneGame(game);
        const historyEntries: HistoryEntry[] = [];
        const newPendingInteractions: InteractionState[] = [];

        const addHistory = (message: string, playerId: string, previousState?: Game) => {
            historyEntries.push({ message, playerId, previousState, sequenceId });
        };

        switch (interaction.type) {
            case 'SELECTING_SCAN_SECTOR': {
                // Mêmes règles que pour le joueur humain : on tire au hasard parmi les secteurs valides
                const validSectors = updatedGame.board.sectors.filter(s =>
                    !s.isCovered && ScanSystem.validateScanSectorSelection(updatedGame, player.id, interaction, s.id).valid
                );
                if (validSectors.length > 0) {
                    const chosen = validSectors[Math.floor(Math.random() * validSectors.length)];
                    const res = ScanSystem.resolveScanSectorSelection(updatedGame, player.id, interaction, chosen.id, interaction.sequenceId || sequenceId);
                    updatedGame = res.updatedGame;
                    historyEntries.push(...res.historyEntries);
                    newPendingInteractions.push(...res.newPendingInteractions);
                }
                break;
            }
            case 'TRIGGER_CARD_EFFECT':
            case 'DRAW_AND_SCAN':
            case 'RESOLVING_SECTOR':
            case 'CLAIMING_MISSION_REQUIREMENT': {
                // Même implémentation que pour le joueur humain
                const res = InteractionResolver.resolve(updatedGame, player.id, { ...interaction, sequenceId: interaction.sequenceId || sequenceId });
                updatedGame = res.updatedGame;
                historyEntries.push(...res.historyEntries.map(e => ({ ...e, sequenceId: e.sequenceId || sequenceId })));
                newPendingInteractions.push(...res.newInteractions.map(i => ({ ...i, sequenceId: i.sequenceId || sequenceId })));
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
            case 'PLACING_LIFE_TRACE': {
                // Simple AI: always place on first board
                const res = SpeciesSystem.placeLifeTraceAuto(updatedGame, 0, interaction.color, player.id, sequenceId);
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
                const hand = p ? CardSystem.getHandCards(p) : [];
                if (p && hand.length > 0) {
                    const count = Math.min(interaction.count, hand.length);
                    const shuffled = [...hand].sort(() => 0.5 - Math.random());
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
                const res = ScanSystem.applyObservation2(updatedGame, player.id, sequenceId);
                if (!res.error) {
                    updatedGame = res.updatedGame;
                    historyEntries.push(...res.historyEntries);
                    newPendingInteractions.push(...res.newPendingInteractions);
                }
                break;
            }
            case 'CHOOSING_EXERTIEN_CARD': {
                // Stratégie simple : jouer la carte la moins dangereuse
                const p = updatedGame.players.find(p => p.id === player.id);
                const exertienCards = (p?.cards || []).filter(c => CardSystem.isExertienCard(c));
                const card = [...exertienCards].sort((a, b) => (a.danger || 0) - (b.danger || 0))[0];
                const res = SpeciesSystem.playExertienCard(updatedGame, player.id, interaction.milestone, card?.id);
                updatedGame = res.updatedGame;
                historyEntries.push(...res.historyEntries.map(e => ({ ...e, sequenceId })));
                break;
            }
            case 'CHOOSING_OBS3_ACTION': {
                const p = updatedGame.players.find(p => p.id === player.id);
                const hand = p ? CardSystem.getHandCards(p) : [];
                if (p && hand.length > 0) {
                    const card = hand[0];
                    updatedGame = CardSystem.discardCard(updatedGame, p.id, card.id);
                    newPendingInteractions.push({ type: 'SELECTING_SCAN_SECTOR', color: card.scanSector, sequenceId: sequenceId, cardId: card.id });
                    addHistory(`utilise carte "${card.name}" pour Observation III`, p.id, game);
                }
                break;
            }
            case 'CHOOSING_OBS4_ACTION': {
                const p = updatedGame.players.find(p => p.id === player.id);
                const choice = p && p.energy >= 1 && Math.random() > 0.5 ? 'PROBE' : 'MOVE';
                const res = ScanSystem.applyObservation4(updatedGame, player.id, choice, sequenceId);
                updatedGame = res.updatedGame;
                historyEntries.push(...res.historyEntries);
                newPendingInteractions.push(...res.newPendingInteractions);
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
                }).filter((p): p is { probe: Probe, planetId: string | undefined } => p !== null);

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
            case 'COLLECTING_SPECIMEN':
            case 'CONSULTING_SPECIMEN': {
                // Simple AI : premier jeton disponible
                const mode = interaction.type === 'CONSULTING_SPECIMEN' ? 'consult' : 'collect';
                const res = interaction.planetId ? SpeciesSystem.takeMascamiteSpecimen(updatedGame, player.id, interaction.planetId, 0, mode, sequenceId) : null;
                if (res) {
                    updatedGame = res.updatedGame;
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
            default:
                addHistory(`AI ne peut pas gérer l'interaction: ${interaction.type}`, player.id);
                break;
        }

        return { updatedGame, historyEntries, newPendingInteractions };
    }
}
