import { cloneGame } from '../core/cloneGame';
import { Game, InteractionState, Player, ProbeState, DiskName, SectorNumber, HistoryEntry, AlienBoardType } from '../core/types';
import { CardSystem } from '../systems/CardSystem';
import { ComputerSystem } from '../systems/ComputerSystem';
import { ProbeSystem } from '../systems/ProbeSystem';
import { ScanSystem } from '../systems/ScanSystem';
import { InteractionResolver } from '../core/InteractionResolver';
import { SpeciesSystem } from '../systems/SpeciesSystem';
import { TechnologySystem } from '../systems/TechnologySystem';
import { createRotationState, getAbsoluteSectorForProbe, calculateReachableCellsWithEnergy } from '../core/SolarSystemPosition';
import { AIBehavior } from './AIBehavior';
import { AIEvaluator } from './AIEvaluator';
import { random } from '../core/random';
import { InteractionChoices } from '../core/InteractionChoices';

/** Interactions où le robot fait un choix au hasard : il tire plusieurs choix (selon son niveau) et garde le meilleur */
const RANDOM_CHOICE_INTERACTIONS: InteractionState['type'][] = [
    'SELECTING_SCAN_SECTOR', 'PLACING_OBJECTIVE_MARKER', 'RESERVING_CARD', 'ACQUIRING_CARD', 'MOVING_PROBE',
    'ACQUIRING_TECH', 'SELECTING_COMPUTER_SLOT', 'CHOOSING_OBS4_ACTION', 'ACQUIRING_ALIEN_CARD',
    'CHOOSING_CENTAURIEN_REWARD', 'CHOOSING_MEDIA_OR_MOVE', 'DISCARDING_FOR_SIGNAL', 'CONSULTING_SPECIMEN',
];

interface AIControllerResult {
    updatedGame: Game;
    historyEntries: HistoryEntry[];
    /** Interactions destinées à un joueur humain (ex: gagnant d'un secteur couvert par le robot), à confier à l'interface. */
    newPendingInteractions: InteractionState[];
    /** Sonde utilisée par un scan « secteur d'une sonde » : elle ne sert plus pour la suite de la séquence */
    usedProbeId?: string;
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

            // Comme pour le joueur humain : la sonde utilisée ne sert plus pour les scans suivants de la séquence
            if (interaction.type === 'SELECTING_SCAN_SECTOR' && result.usedProbeId) {
                queue.splice(0, queue.length, ...InteractionChoices.markProbeUsed(queue, interaction, result.usedProbeId));
            }

            // Add new interactions to the front of the queue to be processed immediately
            queue.unshift(...result.newPendingInteractions);
        }

        return { updatedGame: game, historyEntries, newPendingInteractions: humanInteractions };
    }

    /**
     * Résout une interaction. Pour les choix aléatoires, le robot compare plusieurs tirages
     * (AIBehavior.choiceSamples) et garde celui qui donne la meilleure position.
     */
    private static resolveInteraction(game: Game, player: Player, interaction: InteractionState, sequenceId: string): AIControllerResult {
        const samples = AIBehavior.choiceSamples(player);
        if (samples <= 1 || !RANDOM_CHOICE_INTERACTIONS.includes(interaction.type)) {
            return this.processSingleInteraction(game, player, interaction, sequenceId);
        }
        let best: { result: AIControllerResult; value: number } | null = null;
        for (let i = 0; i < samples; i++) {
            const result = this.processSingleInteraction(game, player, interaction, sequenceId);
            const value = AIEvaluator.evaluate(result.updatedGame, player.id);
            if (!best || value > best.value) best = { result, value };
        }
        return best!.result;
    }

    /**
     * Robot (tous niveaux) : meilleur emplacement pour une trace de vie, en simulant chaque emplacement accepté
     * par le moteur (triangle, piste d'espèce, emplacement excédentaire) avec ses suites, puis en évaluant la position.
     */
    private static bestLifeTracePlacement(game: Game, player: Player, interaction: Extract<InteractionState, { type: 'PLACING_LIFE_TRACE' }>, sequenceId: string): AIControllerResult | null {
        let best: { result: AIControllerResult; value: number } | null = null;
        for (const option of SpeciesSystem.lifeTraceOptions(game, interaction.color)) {
            if (interaction.boardIndices && !interaction.boardIndices.includes(option.boardIndex)) continue;
            const placed = InteractionChoices.placeLifeTrace(game, player.id, { ...interaction, sequenceId }, option.boardIndex, option.color, option.location, option.slotIndex);
            if (placed.updatedGame === game) continue;
            const historyEntries = placed.historyEntries;
            const followUp = this.processInteractionQueue(placed.updatedGame, placed.newPendingInteractions.map(i => ({ ...i, sequenceId })), sequenceId, player);
            const value = AIEvaluator.evaluate(followUp.updatedGame, player.id);
            if (!best || value > best.value) {
                best = { value, result: { updatedGame: followUp.updatedGame, historyEntries: [...historyEntries, ...followUp.historyEntries], newPendingInteractions: followUp.newPendingInteractions } };
            }
        }
        return best ? best.result : null;
    }

    /** Palier Exertien : joue la carte (ou aucune) qui donne la meilleure position évaluée */
    static bestExertienCard(game: Game, playerId: string, milestone: number): { updatedGame: Game; historyEntries: HistoryEntry[] } {
        const player = game.players.find(p => p.id === playerId);
        const options: (string | undefined)[] = [undefined, ...(player?.cards || []).filter(c => CardSystem.isExertienCard(c)).map(c => c.id)];
        let best: { result: { updatedGame: Game; historyEntries: HistoryEntry[] }; value: number } | null = null;
        for (const cardId of options) {
            const result = SpeciesSystem.playExertienCard(game, playerId, milestone, cardId);
            const value = AIEvaluator.evaluate(result.updatedGame, playerId);
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
        let usedProbeId: string | undefined;

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
                    const chosen = validSectors[Math.floor(random() * validSectors.length)];
                    const res = ScanSystem.resolveScanSectorSelection(updatedGame, player.id, interaction, chosen.id, interaction.sequenceId || sequenceId);
                    updatedGame = res.updatedGame;
                    historyEntries.push(...res.historyEntries);
                    newPendingInteractions.push(...res.newPendingInteractions);
                    usedProbeId = res.usedProbeId;
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
                    const randomCard = row[Math.floor(random() * row.length)];
                    newPendingInteractions.push({ type: 'SELECTING_SCAN_SECTOR', color: randomCard.scanSector, cardId: randomCard.id, sequenceId });
                }
                break;
            }
            case 'PLACING_LIFE_TRACE': {
                if (AIBehavior.getDifficulty(player) !== 'PASS') {
                    // Chaque emplacement possible est simulé (récompenses et choix qui en découlent compris) et évalué
                    const best = this.bestLifeTracePlacement(updatedGame, player, interaction, sequenceId);
                    if (best) return best;
                }
                const auto = SpeciesSystem.placeLifeTraceAuto(updatedGame, interaction.color, player.id, sequenceId, interaction.boardIndices);
                const res = InteractionChoices.noteDiscovery(updatedGame, { updatedGame: auto.updatedGame, historyEntries: auto.historyEntries, newPendingInteractions: auto.newPendingInteractions || [] }, player.id, sequenceId);
                historyEntries.push(...res.historyEntries);
                updatedGame = res.updatedGame;
                newPendingInteractions.push(...res.newPendingInteractions.map(i => ({ ...i, sequenceId })));
                break;
            }
            case 'PLACING_OBJECTIVE_MARKER': {
                const availableObjectives = updatedGame.board.objectiveTiles.filter(tile => !tile.markers.includes(player.id));
                if (availableObjectives.length > 0) {
                    const randomObjective = availableObjectives[Math.floor(random() * availableObjectives.length)];
                    const result = InteractionChoices.placeObjectiveMarker(updatedGame, player.id, { ...interaction, sequenceId }, randomObjective.id);
                    updatedGame = result.updatedGame;
                    historyEntries.push(...result.historyEntries.map(e => ({ ...e, previousState: game })));
                }
                break;
            }
            case 'RESERVING_CARD': {
                const p = updatedGame.players.find(p => p.id === player.id);
                const hand = p ? [...CardSystem.getHandCards(p)].sort(() => 0.5 - random()) : [];
                const res = CardSystem.reserveCards(updatedGame, player.id, hand.slice(0, interaction.count).map(c => c.id), sequenceId);
                updatedGame = res.updatedGame;
                historyEntries.push(...res.historyEntries);
                break;
            }
            case 'ACQUIRING_CARD': {
                for (let i = 0; i < interaction.count; i++) {
                    const row = updatedGame.decks.cardRow;
                    const cardId = row.length > 0 && random() > 0.5 ? row[Math.floor(random() * row.length)].id : undefined;
                    const res = CardSystem.acquireCard(updatedGame, player.id, cardId, { isFree: interaction.isFree, triggerFreeAction: interaction.triggerFreeAction }, sequenceId);
                    if (res.error) continue;
                    updatedGame = res.updatedGame;
                    historyEntries.push(...res.historyEntries);
                    newPendingInteractions.push(...res.newPendingInteractions);
                }
                break;
            }
            case 'MOVING_PROBE': {
                const p = updatedGame.players.find(p => p.id === player.id);
                if (p) {
                    const probes = p.probes.filter(pr => pr.state === ProbeState.IN_SOLAR_SYSTEM && pr.solarPosition);
                    if (probes.length > 0) {
                        const probe = probes[Math.floor(random() * probes.length)];
                        const rotationState = createRotationState(updatedGame.board.solarSystem.rotationAngleLevel1 || 0, updatedGame.board.solarSystem.rotationAngleLevel2 || 0, updatedGame.board.solarSystem.rotationAngleLevel3 || 0);
                        const absPos = getAbsoluteSectorForProbe(probe.solarPosition!, rotationState);
                        // Une case voisine, payée avec les déplacements gratuits restants puis l'énergie (comme le joueur humain)
                        const reachable = calculateReachableCellsWithEnergy(probe.solarPosition!.disk, absPos, interaction.count, p.energy, rotationState, false, undefined, updatedGame.board.solarSystem.extraCelestialObjects);
                        const destinations = Array.from(reachable.entries()).filter(([, cell]) => cell.path.length === 2).map(([key]) => key);
                        if (destinations.length > 0) {
                            const destKey = destinations[Math.floor(random() * destinations.length)];
                            const disk = destKey[0] as DiskName;
                            const sector = parseInt(destKey.substring(1)) as SectorNumber;
                            const usedFree = ProbeSystem.freeMovementsUsed(updatedGame, p.id, probe.id, interaction.count);
                            try {
                                const moveRes = ProbeSystem.moveProbe(updatedGame, p.id, probe.id, disk, sector, interaction.count, sequenceId);
                                updatedGame = moveRes.updatedGame;
                                historyEntries.push(...moveRes.historyEntries);
                                newPendingInteractions.push(...moveRes.newPendingInteractions);
                                if (interaction.count - usedFree > 0) newPendingInteractions.push({ ...interaction, count: interaction.count - usedFree });
                            } catch {
                                // Déplacement refusé par le moteur : le robot renonce aux déplacements restants
                            }
                        }
                    }
                }
                break;
            }
            case 'ACQUIRING_TECH': {
                // Mêmes technologies que pour le joueur humain (catégories, piles déjà prises, technologie partagée)
                const validTechs = TechnologySystem.acquirableTechs(updatedGame, player.id, { categories: interaction.categories, sharedOnly: interaction.sharedOnly });
                if (validTechs.length > 0) {
                    const tech = validTechs[Math.floor(random() * validTechs.length)];
                    // Une technologie Informatique renvoie le choix de la colonne (SELECTING_COMPUTER_SLOT)
                    const res = InteractionChoices.acquireTech(updatedGame, player.id, { ...interaction, sequenceId }, tech);
                    if (!res.error) {
                        updatedGame = res.updatedGame;
                        historyEntries.push(...res.historyEntries);
                        newPendingInteractions.push(...res.newPendingInteractions);
                    }
                }
                break;
            }
            case 'SELECTING_COMPUTER_SLOT': {
                const p = updatedGame.players.find(p => p.id === player.id);
                const columns = p ? ComputerSystem.TECH_COLUMNS.filter(col => ComputerSystem.canAssignTechnology(p, col).canAssign) : [];
                const targetCol = columns.length > 0 ? columns[Math.floor(random() * columns.length)] : undefined;
                const res = InteractionChoices.acquireTech(updatedGame, player.id, { ...interaction, sequenceId }, interaction.tech, targetCol);
                if (!res.error) {
                    updatedGame = res.updatedGame;
                    historyEntries.push(...res.historyEntries);
                    newPendingInteractions.push(...res.newPendingInteractions);
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
                // Simule chaque carte (et le renoncement) : la position évaluée compte les PV promis
                // selon l'avancement de la condition et la pénalité de danger attendue
                const res = this.bestExertienCard(updatedGame, player.id, interaction.milestone);
                updatedGame = res.updatedGame;
                historyEntries.push(...res.historyEntries.map(e => ({ ...e, sequenceId })));
                break;
            }
            case 'CHOOSING_OBS3_ACTION': {
                const p = updatedGame.players.find(p => p.id === player.id);
                const hand = p ? CardSystem.getHandCards(p) : [];
                if (p && hand.length > 0) {
                    // Comme le joueur humain : la carte défaussée marque un signal dans le secteur de sa couleur
                    const res = CardSystem.discardForSignals(updatedGame, p.id, [hand[0].id], sequenceId);
                    historyEntries.push(...res.historyEntries);
                    newPendingInteractions.push(...res.newPendingInteractions);
                }
                break;
            }
            case 'CHOOSING_OBS4_ACTION': {
                const p = updatedGame.players.find(p => p.id === player.id);
                const choice = p && p.energy >= 1 && random() > 0.5 ? 'PROBE' : 'MOVE';
                const res = ScanSystem.applyObservation4(updatedGame, player.id, choice, sequenceId);
                updatedGame = res.updatedGame;
                historyEntries.push(...res.historyEntries);
                newPendingInteractions.push(...res.newPendingInteractions);
                break;
            }
            case 'CHOOSING_BONUS_ACTION': {
                // Première action restante, puis le menu revient (sauf après une mission), comme pour le joueur humain
                const chosen = InteractionChoices.chooseBonusAction(interaction, interaction.choices.findIndex(c => !c.done));
                if (chosen) {
                    newPendingInteractions.push(chosen.next);
                    if (chosen.menu) newPendingInteractions.push(chosen.menu);
                }
                break;
            }
            case 'ACQUIRING_ALIEN_CARD': {
                const species = updatedGame.species.find(s => s.id === interaction.speciesId);
                if (species) {
                    const canPickFromRow = species.cardRow && species.cardRow.length > 0;
                    const canPickFromDeck = species.cards && species.cards.length > 0;
                    let cardId = 'deck';
                    if (canPickFromRow && (!canPickFromDeck || random() > 0.5)) {
                        cardId = species.cardRow[Math.floor(random() * species.cardRow.length)].id;
                    }
                    // Plusieurs cartes : l'interaction reste en attente avec une carte de moins
                    const res = InteractionChoices.acquireAlienCard(updatedGame, player.id, { ...interaction, sequenceId }, cardId);
                    if (!res.error) {
                        updatedGame = res.updatedGame;
                        historyEntries.push(...res.historyEntries.map(e => ({ ...e, previousState: game })));
                        newPendingInteractions.push(...res.newPendingInteractions);
                    }
                }
                break;
            }
            case 'ORBITING_PROBE':
            case 'LANDING_PROBE': {
                // La sonde du robot posée sur une planète (hors Terre)
                const info = ProbeSystem.probeOnPlanetInfo(updatedGame, player.id);
                if (info.hasProbe && info.planetId) {
                    // Placements restants (count > 1) : la même interaction suit les bonus déclenchés
                    const res = InteractionChoices.placeBonusProbe(updatedGame, player.id, { ...interaction, sequenceId }, info.planetId);
                    if (!res.error) {
                        updatedGame = res.updatedGame;
                        historyEntries.push(...res.historyEntries);
                        newPendingInteractions.push(...res.newPendingInteractions);
                        if (res.nextInteraction) newPendingInteractions.push(res.nextInteraction);
                    }
                }
                break;
            }
            case 'COLLECTING_SPECIMEN':
            case 'CONSULTING_SPECIMEN': {
                const mode = interaction.type === 'CONSULTING_SPECIMEN' ? 'consult' : 'collect';
                // Planète prélevée, ou consultable (Étude de l'Écosystème : sonde présente ; ET.8 à ET.10 : au choix)
                const options = interaction.type === 'CONSULTING_SPECIMEN' ? SpeciesSystem.consultablePlanets(updatedGame, player.id, interaction) : [interaction.planetId];
                const planetId = options[Math.floor(random() * options.length)];
                const tokenCount = planetId ? updatedGame.board.planets.find(p => p.id === planetId)?.mascamiteTokens?.length || 0 : 0;
                const res = planetId && tokenCount > 0 ? SpeciesSystem.takeMascamiteSpecimen(updatedGame, player.id, planetId, Math.floor(random() * tokenCount), mode, sequenceId) : null;
                if (res) {
                    updatedGame = res.updatedGame;
                    historyEntries.push(...res.historyEntries);
                    newPendingInteractions.push(...res.newPendingInteractions);
                }
                break;
            }
            case 'DISCARDING_FOR_SIGNAL': {
                // Nombre de cartes tiré au hasard ; un robot stratégique compare les tirages
                const p = updatedGame.players.find(p => p.id === player.id);
                const hand = p ? [...CardSystem.getHandCards(p)].sort(() => 0.5 - random()) : [];
                const count = Math.floor(random() * (Math.min(interaction.count, hand.length) + 1));
                const res = CardSystem.discardForSignals(updatedGame, player.id, hand.slice(0, count).map(c => c.id), sequenceId);
                historyEntries.push(...res.historyEntries);
                newPendingInteractions.push(...res.newPendingInteractions);
                break;
            }
            case 'CHOOSING_CENTAURIEN_REWARD': {
                const species = updatedGame.species.find(s => s.name === AlienBoardType.CENTAURIENS);
                if (species && species.message) {
                    const availableTokens = species.message.map((token, index) => ({ token, index })).filter(item => item.token.isAvailable);
                    if (availableTokens.length > 0) {
                        const choice = availableTokens[Math.floor(random() * availableTokens.length)];
                        const res = InteractionChoices.claimCentaurienReward(updatedGame, player.id, interaction, choice.index);
                        updatedGame = res.updatedGame;
                        historyEntries.push(...res.historyEntries);
                        newPendingInteractions.push(...res.newPendingInteractions);
                    }
                }
                break;
            }
            case 'CHOOSING_MEDIA_OR_MOVE': {
                const res = ProbeSystem.chooseMediaOrMove(updatedGame, player.id, random() > 0.5 ? 'MEDIA' : 'MOVE', interaction.remainingMoves || 0, sequenceId);
                updatedGame = res.updatedGame;
                historyEntries.push(...res.historyEntries);
                if (res.nextInteraction) newPendingInteractions.push(res.nextInteraction);
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

        return { updatedGame, historyEntries, newPendingInteractions, usedProbeId };
    }
}
