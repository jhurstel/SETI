import { cloneGame } from '../core/cloneGame';
import { Game, InteractionState, Player, ProbeState, DiskName, SectorNumber, HistoryEntry, AlienBoardType } from '../core/types';
import { CardSystem } from '../systems/CardSystem';
import { ComputerSystem } from '../systems/ComputerSystem';
import { ProbeSystem } from '../systems/ProbeSystem';
import { ScanFollowUp, ScanSystem } from '../systems/ScanSystem';
import { InteractionResolver } from '../core/InteractionResolver';
import { SpeciesSystem } from '../systems/SpeciesSystem';
import { TechnologySystem } from '../systems/TechnologySystem';
import { createRotationState, getAbsoluteSectorForProbe, calculateReachableCellsWithEnergy } from '../core/SolarSystemPosition';
import { AIBehavior } from './AIBehavior';
import { AIEvaluator } from './AIEvaluator';
import { random } from '../core/random';
import { InteractionChoices } from '../core/InteractionChoices';
import { requirePlayer } from '../core/players';

/** Interactions où le robot fait un choix au hasard : il tire plusieurs choix (selon son niveau) et garde le meilleur */
const RANDOM_CHOICE_INTERACTIONS: InteractionState['type'][] = [
    'SELECTING_SCAN_SECTOR', 'PLACING_OBJECTIVE_MARKER', 'RESERVING_CARD', 'ACQUIRING_CARD', 'MOVING_PROBE',
    'ACQUIRING_TECH', 'SELECTING_COMPUTER_SLOT', 'CHOOSING_OBS4_ACTION', 'ACQUIRING_ALIEN_CARD',
    'CHOOSING_CENTAURIEN_REWARD', 'CHOOSING_MEDIA_OR_MOVE', 'DISCARDING_FOR_SIGNAL',
];

interface AIControllerResult {
    updatedGame: Game;
    historyEntries: HistoryEntry[];
    /** Interactions destinées à un joueur humain (ex: gagnant d'un secteur couvert par le robot), à confier à l'interface. */
    newPendingInteractions: InteractionState[];
    /** Contrainte des scans suivants de la séquence après un scan « secteur d'une sonde » (ScanSystem.scanFollowUp) */
    scanFollowUp?: ScanFollowUp;
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

            // Comme pour le joueur humain : contrainte des scans suivants de la séquence
            if (interaction.type === 'SELECTING_SCAN_SECTOR' && result.scanFollowUp) {
                queue.splice(0, queue.length, ...InteractionChoices.applyScanFollowUp(queue, interaction, result.scanFollowUp));
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
            const result = InteractionChoices.playExertienCard(game, playerId, { type: 'CHOOSING_EXERTIEN_CARD', milestone }, cardId);
            if (result.error) continue;
            const value = AIEvaluator.evaluate(result.updatedGame, playerId);
            if (!best || value > best.value) best = { result, value };
        }
        return best!.result;
    }

    /**
     * Carte de fin de manche, une fois passé : le robot stratégique simule chaque carte de la pile et garde la
     * meilleure position, le Débutant la tire au hasard, le niveau PASS des tests prend la première.
     */
    static bestRoundCard(game: Game, player: Player, interaction: Extract<InteractionState, { type: 'CHOOSING_ROUND_CARD' }>) {
        const deck = game.decks.roundDecks[interaction.round] || [];
        const difficulty = AIBehavior.getDifficulty(player);
        if (difficulty === 'PASS' || !AIBehavior.isStrategic(player)) {
            const card = difficulty === 'PASS' ? deck[0] : deck[Math.floor(random() * deck.length)];
            return InteractionChoices.chooseRoundCard(game, player.id, interaction, card.id);
        }
        let best: { result: ReturnType<typeof InteractionChoices.chooseRoundCard>; value: number } | null = null;
        for (const card of deck) {
            const result = InteractionChoices.chooseRoundCard(game, player.id, interaction, card.id);
            const value = AIEvaluator.evaluate(result.updatedGame, player.id);
            if (!best || value > best.value) best = { result, value };
        }
        return best!.result;
    }

    /**
     * Défausse d'un Token pour le gain d'une carte (ET.24, ET.25, ET.28) : le robot simule la défausse (et ses suites, dont
     * les défausses suivantes d'ET.25) et le renoncement, et garde la meilleure position évaluée
     */
    static bestTokenDiscard(game: Game, player: Player, interaction: Extract<InteractionState, { type: 'DISCARDING_TOKEN' }>, sequenceId: string): AIControllerResult {
        const options = requirePlayer(game, player.id).tokens ? [true, false] : [false];
        let best: { result: AIControllerResult; value: number } | null = null;
        for (const accepted of options) {
            const chosen = InteractionChoices.discardToken(game, player.id, { ...interaction, sequenceId }, accepted);
            const queue = chosen.nextInteraction ? [...chosen.newPendingInteractions, chosen.nextInteraction] : chosen.newPendingInteractions;
            const followUp = this.processInteractionQueue(chosen.updatedGame, queue, sequenceId, player);
            const value = AIEvaluator.evaluate(followUp.updatedGame, player.id);
            if (!best || value > best.value) {
                best = { value, result: { ...followUp, historyEntries: [...chosen.historyEntries, ...followUp.historyEntries] } };
            }
        }
        return best!.result;
    }

    /**
     * Spécimen Mascamite (face visible) : sur la planète prélevée, ou consultable (Étude de l'Écosystème : sonde
     * présente ; ET.8 à ET.10 : au choix). Chaque spécimen est simulé avec sa récompense (gagnée tout de suite en
     * consultant, à l'arrivée de la capsule en prélevant) et le mieux évalué est gardé. Null s'il n'y en a aucun.
     */
    static bestSpecimen(game: Game, player: Player, interaction: Extract<InteractionState, { type: 'COLLECTING_SPECIMEN' | 'CONSULTING_SPECIMEN' }>) {
        const sequenceId = interaction.sequenceId || 'ai-specimen';
        let best: { result: ReturnType<typeof InteractionChoices.takeSpecimen>; value: number } | null = null;
        for (const planetId of InteractionChoices.specimenPlanets(game, player.id, interaction)) {
            const tokens = game.board.planets.find(p => p.id === planetId)?.mascamiteTokens || [];
            tokens.forEach((_token, tokenIndex) => {
                const result = InteractionChoices.takeSpecimen(game, player.id, interaction, planetId, tokenIndex);
                if (result.error) return;
                const reward = SpeciesSystem.takeMascamiteSpecimen(game, player.id, planetId, tokenIndex, 'consult', sequenceId)!;
                const followUp = this.processInteractionQueue(reward.updatedGame, reward.newPendingInteractions, sequenceId, player);
                const value = AIEvaluator.evaluate(followUp.updatedGame, player.id);
                if (!best || value > best.value) best = { result, value };
            });
        }
        return best ? (best as { result: ReturnType<typeof InteractionChoices.takeSpecimen> }).result : null;
    }

    /** Mission déclenchée hors de son tour : recouvre le cercle (ou aucun) qui donne la meilleure position évaluée */
    static bestMissionRequirement(game: Game, player: Player, interaction: Extract<InteractionState, { type: 'CHOOSING_MISSION_REQUIREMENT' }>, sequenceId: string): AIControllerResult {
        const options: ({ missionId: string; requirementId: string } | undefined)[] = [...interaction.options, undefined];
        let best: { result: AIControllerResult; value: number } | null = null;
        for (const option of options) {
            const chosen = InteractionChoices.chooseMissionRequirement(game, player.id, { ...interaction, sequenceId }, option?.missionId, option?.requirementId);
            const followUp = this.processInteractionQueue(chosen.updatedGame, chosen.newPendingInteractions, sequenceId, player);
            const value = AIEvaluator.evaluate(followUp.updatedGame, player.id);
            if (!best || value > best.value) {
                best = { value, result: { ...followUp, historyEntries: [...chosen.historyEntries, ...followUp.historyEntries] } };
            }
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
        let scanFollowUp: ScanFollowUp | undefined;

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
                    scanFollowUp = res.scanFollowUp;
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
                    const res = InteractionChoices.selectScanCard(updatedGame, { ...interaction, sequenceId }, randomCard.id);
                    if (!res.error) {
                        updatedGame = res.updatedGame;
                        newPendingInteractions.push(...res.newPendingInteractions);
                    }
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
                const p = requirePlayer(updatedGame, player.id);
                const hand = [...CardSystem.getHandCards(p)].sort(() => 0.5 - random());
                const res = InteractionChoices.reserveCards(updatedGame, player.id, { ...interaction, sequenceId }, hand.slice(0, interaction.count).map(c => c.id));
                if (!res.error) {
                    updatedGame = res.updatedGame;
                    historyEntries.push(...res.historyEntries);
                    if (res.nextInteraction) newPendingInteractions.push(res.nextInteraction);
                }
                break;
            }
            case 'ACQUIRING_CARD': {
                // Une carte de la rangée ou de la pioche ; les cartes restantes suivent (comme pour le joueur humain)
                const row = updatedGame.decks.cardRow;
                const cardId = row.length > 0 && random() > 0.5 ? row[Math.floor(random() * row.length)].id : undefined;
                let res = InteractionChoices.acquireCard(updatedGame, player.id, { ...interaction, sequenceId }, cardId);
                if (res.error && cardId) res = InteractionChoices.acquireCard(updatedGame, player.id, { ...interaction, sequenceId });
                if (!res.error) {
                    updatedGame = res.updatedGame;
                    historyEntries.push(...res.historyEntries);
                    if (res.nextInteraction) newPendingInteractions.push(res.nextInteraction);
                    newPendingInteractions.push(...res.newPendingInteractions);
                }
                break;
            }
            case 'MOVING_PROBE': {
                const p = requirePlayer(updatedGame, player.id);
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
                        // Même pas de sonde que le joueur humain : les déplacements restants suivent, sauf si le choix
                        // Média / déplacement de la carte 19 les reprend ; un refus du moteur met fin aux déplacements
                        const res = InteractionChoices.moveProbe(updatedGame, p.id, { ...interaction, sequenceId: interaction.sequenceId || sequenceId }, probe.id, disk, sector, interaction.sequenceId || sequenceId);
                        if (!res.error) {
                            updatedGame = res.updatedGame;
                            historyEntries.push(...res.historyEntries);
                            if (res.nextInteraction) newPendingInteractions.push(res.nextInteraction);
                            newPendingInteractions.push(...res.newPendingInteractions);
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
                const p = requirePlayer(updatedGame, player.id);
                const columns = ComputerSystem.TECH_COLUMNS.filter(col => ComputerSystem.canAssignTechnology(p, col).canAssign);
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
                const res = InteractionChoices.observation2(updatedGame, player.id, { ...interaction, sequenceId }, true);
                if (!res.error) {
                    updatedGame = res.updatedGame;
                    historyEntries.push(...res.historyEntries);
                    newPendingInteractions.push(...res.newPendingInteractions);
                }
                break;
            }
            case 'DISCARDING_TOKEN': {
                const res = this.bestTokenDiscard(updatedGame, player, interaction, sequenceId);
                updatedGame = res.updatedGame;
                historyEntries.push(...res.historyEntries.map(e => ({ ...e, sequenceId })));
                newPendingInteractions.push(...res.newPendingInteractions);
                break;
            }
            case 'CHOOSING_MISSION_REQUIREMENT': {
                const res = this.bestMissionRequirement(updatedGame, player, interaction, sequenceId);
                updatedGame = res.updatedGame;
                historyEntries.push(...res.historyEntries.map(e => ({ ...e, sequenceId })));
                newPendingInteractions.push(...res.newPendingInteractions);
                break;
            }
            case 'CHOOSING_ROUND_CARD': {
                const res = this.bestRoundCard(updatedGame, player, { ...interaction, sequenceId });
                updatedGame = res.updatedGame;
                historyEntries.push(...res.historyEntries);
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
                // Même règle que le joueur humain (accepter, puis défausser 1 carte) ; le robot défausse sa première carte
                const p = requirePlayer(updatedGame, player.id);
                const hand = CardSystem.getHandCards(p);
                const discard = InteractionChoices.observation3(updatedGame, { ...interaction, sequenceId }, hand.length > 0).newPendingInteractions[0];
                if (discard?.type === 'DISCARDING_FOR_SIGNAL') {
                    const res = InteractionChoices.discardForSignals(updatedGame, player.id, discard, [hand[0].id]);
                    historyEntries.push(...res.historyEntries);
                    newPendingInteractions.push(...res.newPendingInteractions);
                }
                break;
            }
            case 'CHOOSING_OBS4_ACTION': {
                const p = requirePlayer(updatedGame, player.id);
                const choice = p.energy >= 1 && random() > 0.5 ? 'PROBE' : 'MOVE';
                const res = InteractionChoices.observation4(updatedGame, player.id, { ...interaction, sequenceId }, choice);
                if (!res.error) {
                    updatedGame = res.updatedGame;
                    historyEntries.push(...res.historyEntries);
                    newPendingInteractions.push(...res.newPendingInteractions);
                }
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
                const res = this.bestSpecimen(updatedGame, player, { ...interaction, sequenceId });
                if (res) {
                    updatedGame = res.updatedGame;
                    historyEntries.push(...res.historyEntries);
                    newPendingInteractions.push(...res.newPendingInteractions);
                }
                break;
            }
            case 'DISCARDING_DRAWN_CARD': {
                // ET.15 : chaque carte possible est simulée, la position la mieux évaluée est gardée
                let best: { res: ReturnType<typeof InteractionChoices.discardDrawnCard>; value: number } | null = null;
                for (const cardId of interaction.cardIds) {
                    const res = InteractionChoices.discardDrawnCard(updatedGame, player.id, { ...interaction, sequenceId }, cardId);
                    const value = AIEvaluator.evaluate(res.updatedGame, player.id);
                    if (!best || value > best.value) best = { res, value };
                }
                if (best) {
                    updatedGame = best.res.updatedGame;
                    historyEntries.push(...best.res.historyEntries);
                    if (best.res.nextInteraction) newPendingInteractions.push(best.res.nextInteraction);
                    newPendingInteractions.push(...best.res.newPendingInteractions);
                }
                break;
            }
            case 'DISCARDING_FOR_SIGNAL': {
                // Nombre de cartes tiré au hasard ; un robot stratégique compare les tirages
                const p = requirePlayer(updatedGame, player.id);
                const hand = [...CardSystem.getHandCards(p)].sort(() => 0.5 - random());
                const count = Math.floor(random() * (Math.min(interaction.count, hand.length) + 1));
                const res = InteractionChoices.discardForSignals(updatedGame, player.id, { ...interaction, sequenceId }, hand.slice(0, count).map(c => c.id));
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
                const res = InteractionChoices.chooseMediaOrMove(updatedGame, player.id, { ...interaction, sequenceId }, random() > 0.5 ? 'MEDIA' : 'MOVE');
                updatedGame = res.updatedGame;
                historyEntries.push(...res.historyEntries);
                if (res.nextInteraction) newPendingInteractions.push(res.nextInteraction);
                break;
            }
            case 'REMOVING_ORBITER':
            case 'REMOVING_LANDER': {
                // Le premier orbiteur (ou atterrisseur) du robot
                const state = interaction.type === 'REMOVING_ORBITER' ? ProbeState.IN_ORBIT : ProbeState.LANDED;
                const probe = updatedGame.players.find(p => p.id === player.id)!.probes.find(pr => pr.state === state && pr.planetId);
                const planet = probe ? updatedGame.board.planets.find(pl => pl.id === probe.planetId) : undefined;
                if (probe && planet) {
                    const slots = interaction.type === 'REMOVING_ORBITER' ? planet.orbiters : planet.landers;
                    const slotIndex = slots.findIndex(s => s.id === probe.id);
                    const res = slotIndex === -1 ? null : InteractionChoices.removeProbe(updatedGame, player.id, { ...interaction, sequenceId }, planet.id, slotIndex);
                    if (res && !res.error) {
                        updatedGame = res.updatedGame;
                        historyEntries.push(...res.historyEntries);
                        newPendingInteractions.push(...res.newPendingInteractions);
                    }
                }
                break;
            }
            default:
                addHistory(`AI ne peut pas gérer l'interaction: ${interaction.type}`, player.id);
                break;
        }

        return { updatedGame, historyEntries, newPendingInteractions, scanFollowUp };
    }
}
