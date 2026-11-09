import { cloneGame } from '../core/cloneGame';
import { Game, InteractionState, Player, ProbeState, DiskName, SectorNumber, HistoryEntry, AlienBoardType, AutomaticInteraction, ChoiceInteractionType, Interaction } from '../core/types';
import { CardSystem } from '../systems/CardSystem';
import { ComputerSystem } from '../systems/ComputerSystem';
import { ProbeSystem } from '../systems/ProbeSystem';
import { ScanFollowUp, ScanSystem } from '../systems/ScanSystem';
import { InteractionResolver } from '../engine/InteractionResolver';
import { SpeciesSystem } from '../systems/SpeciesSystem';
import { TechnologySystem } from '../systems/TechnologySystem';
import { createRotationState, getAbsoluteSectorForProbe, calculateReachableCellsWithEnergy } from '../core/SolarSystemPosition';
import { AIBehavior } from './AIBehavior';
import { AIEvaluator } from './AIEvaluator';
import { random } from '../core/random';
import { InteractionChoices } from '../engine/InteractionChoices';
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

/** Étape d'un robot sur une interaction : la partie de départ, la partie en cours et ce que produit la résolution */
class RobotStep {
    historyEntries: HistoryEntry[] = [];
    newPendingInteractions: InteractionState[] = [];
    scanFollowUp?: ScanFollowUp;
    /** Résultat complet, qui remplace le reste (simulation de tous les choix possibles avec leurs suites) */
    result?: AIControllerResult;
    constructor(readonly game: Game, public updatedGame: Game, readonly player: Player, readonly sequenceId: string) {}
}

/** Interactions que les robots résolvent : toutes, sauf les modes de sélection propres à l'interface (INTERACTIONS : `local`) */
type RobotInteractionType = ChoiceInteractionType | AutomaticInteraction['type'];
type RobotHandler<T extends RobotInteractionType> = (c: RobotStep, interaction: Interaction<T>) => void;

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
        const player = requirePlayer(game, playerId);
        const options: (string | undefined)[] = [undefined, ...player.cards.filter(c => CardSystem.isExertienCard(c)).map(c => c.id)];
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
                // Planète tirée de specimenPlanets : le choix est toujours autorisé
                const result = InteractionChoices.takeSpecimen(game, player.id, interaction, planetId, tokenIndex);
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
        const c = new RobotStep(game, cloneGame(game), player, sequenceId);
        const handler = (AIController.ROBOT_HANDLERS as Partial<Record<string, RobotHandler<RobotInteractionType>>>)[interaction.type];
        if (handler) handler(c, interaction as Interaction<RobotInteractionType>);
        else c.historyEntries.push({ message: `AI ne peut pas gérer l'interaction: ${interaction.type}`, playerId: player.id, sequenceId });
        if (c.result) return c.result;
        return { updatedGame: c.updatedGame, historyEntries: c.historyEntries, newPendingInteractions: c.newPendingInteractions, scanFollowUp: c.scanFollowUp };
    }

    /**
     * Choix du robot pour chaque interaction, par les mêmes opérations que le joueur humain (InteractionChoices,
     * InteractionResolver) : un type d'interaction oublié est une erreur de compilation.
     */
    private static readonly ROBOT_HANDLERS: { [T in RobotInteractionType]: RobotHandler<T> } = {
        SELECTING_SCAN_SECTOR: (c, interaction) => {
            // Mêmes règles que pour le joueur humain : on tire au hasard parmi les secteurs valides
            const validSectors = c.updatedGame.board.sectors.filter(s =>
                !s.isCovered && ScanSystem.validateScanSectorSelection(c.updatedGame, c.player.id, interaction, s.id).valid
            );
            if (validSectors.length > 0) {
                const chosen = validSectors[Math.floor(random() * validSectors.length)];
                const res = ScanSystem.resolveScanSectorSelection(c.updatedGame, c.player.id, interaction, chosen.id, interaction.sequenceId || c.sequenceId);
                c.updatedGame = res.updatedGame;
                c.historyEntries.push(...res.historyEntries);
                c.newPendingInteractions.push(...res.newPendingInteractions);
                c.scanFollowUp = res.scanFollowUp;
            }
        },
        TRIGGER_CARD_EFFECT: (c, interaction) => {
            // Même implémentation que pour le joueur humain
            const res = InteractionResolver.resolve(c.updatedGame, c.player.id, { ...interaction, sequenceId: interaction.sequenceId || c.sequenceId });
            c.updatedGame = res.updatedGame;
            c.historyEntries.push(...res.historyEntries.map(e => ({ ...e, sequenceId: e.sequenceId || c.sequenceId })));
            c.newPendingInteractions.push(...res.newInteractions.map(i => ({ ...i, sequenceId: i.sequenceId || c.sequenceId })));
        },
        DRAW_AND_SCAN: (c, interaction) => AIController.ROBOT_HANDLERS.TRIGGER_CARD_EFFECT(c, interaction as never),
        RESOLVING_SECTOR: (c, interaction) => AIController.ROBOT_HANDLERS.TRIGGER_CARD_EFFECT(c, interaction as never),
        CLAIMING_MISSION_REQUIREMENT: (c, interaction) => AIController.ROBOT_HANDLERS.TRIGGER_CARD_EFFECT(c, interaction as never),
        SELECTING_SCAN_CARD: (c, interaction) => {
            const row = c.updatedGame.decks.cardRow;
            if (row.length > 0) {
                const randomCard = row[Math.floor(random() * row.length)];
                const res = InteractionChoices.selectScanCard(c.updatedGame, { ...interaction, sequenceId: c.sequenceId }, randomCard.id);
                if (!res.error) {
                    c.updatedGame = res.updatedGame;
                    c.newPendingInteractions.push(...res.newPendingInteractions);
                }
            }
        },
        PLACING_LIFE_TRACE: (c, interaction) => {
            if (AIBehavior.getDifficulty(c.player) !== 'PASS') {
                // Chaque emplacement possible est simulé (récompenses et choix qui en découlent compris) et évalué
                const best = AIController.bestLifeTracePlacement(c.updatedGame, c.player, interaction, c.sequenceId);
                if (best) { c.result = best; return; }
            }
            const auto = SpeciesSystem.placeLifeTraceAuto(c.updatedGame, interaction.color, c.player.id, c.sequenceId, interaction.boardIndices);
            const res = InteractionChoices.noteDiscovery(c.updatedGame, { updatedGame: auto.updatedGame, historyEntries: auto.historyEntries, newPendingInteractions: auto.newPendingInteractions || [] });
            c.historyEntries.push(...res.historyEntries);
            c.updatedGame = res.updatedGame;
            c.newPendingInteractions.push(...res.newPendingInteractions.map(i => ({ ...i, sequenceId: c.sequenceId })));
        },
        PLACING_OBJECTIVE_MARKER: (c, interaction) => {
            const availableObjectives = c.updatedGame.board.objectiveTiles.filter(tile => !tile.markers.includes(c.player.id));
            if (availableObjectives.length > 0) {
                const randomObjective = availableObjectives[Math.floor(random() * availableObjectives.length)];
                const result = InteractionChoices.placeObjectiveMarker(c.updatedGame, c.player.id, { ...interaction, sequenceId: c.sequenceId }, randomObjective.id);
                c.updatedGame = result.updatedGame;
                c.historyEntries.push(...result.historyEntries.map(e => ({ ...e, previousState: c.game })));
            }
        },
        RESERVING_CARD: (c, interaction) => {
            const p = requirePlayer(c.updatedGame, c.player.id);
            const hand = [...CardSystem.getHandCards(p)].sort(() => 0.5 - random());
            const res = InteractionChoices.reserveCards(c.updatedGame, c.player.id, { ...interaction, sequenceId: c.sequenceId }, hand.slice(0, interaction.count).map(c => c.id));
            if (!res.error) {
                c.updatedGame = res.updatedGame;
                c.historyEntries.push(...res.historyEntries);
                if (res.nextInteraction) c.newPendingInteractions.push(res.nextInteraction);
            }
        },
        ACQUIRING_CARD: (c, interaction) => {
            // Une carte de la rangée ou de la pioche ; les cartes restantes suivent (comme pour le joueur humain)
            const row = c.updatedGame.decks.cardRow;
            const cardId = row.length > 0 && random() > 0.5 ? row[Math.floor(random() * row.length)].id : undefined;
            let res = InteractionChoices.acquireCard(c.updatedGame, c.player.id, { ...interaction, sequenceId: c.sequenceId }, cardId);
            if (res.error && cardId) res = InteractionChoices.acquireCard(c.updatedGame, c.player.id, { ...interaction, sequenceId: c.sequenceId });
            if (!res.error) {
                c.updatedGame = res.updatedGame;
                c.historyEntries.push(...res.historyEntries);
                if (res.nextInteraction) c.newPendingInteractions.push(res.nextInteraction);
                c.newPendingInteractions.push(...res.newPendingInteractions);
            }
        },
        MOVING_PROBE: (c, interaction) => {
            const p = requirePlayer(c.updatedGame, c.player.id);
            const probes = p.probes.filter(pr => pr.state === ProbeState.IN_SOLAR_SYSTEM && pr.solarPosition);
            if (probes.length > 0) {
                const probe = probes[Math.floor(random() * probes.length)];
                const rotationState = createRotationState(c.updatedGame.board.solarSystem.rotationAngleLevel1, c.updatedGame.board.solarSystem.rotationAngleLevel2, c.updatedGame.board.solarSystem.rotationAngleLevel3);
                const absPos = getAbsoluteSectorForProbe(probe.solarPosition!, rotationState);
                // Une case voisine, payée avec les déplacements gratuits restants puis l'énergie (comme le joueur humain)
                const reachable = calculateReachableCellsWithEnergy(probe.solarPosition!.disk, absPos, interaction.count, p.energy, rotationState, false, undefined, c.updatedGame.board.solarSystem.extraCelestialObjects);
                const destinations = Array.from(reachable.entries()).filter(([, cell]) => cell.path.length === 2).map(([key]) => key);
                if (destinations.length > 0) {
                    const destKey = destinations[Math.floor(random() * destinations.length)];
                    const disk = destKey[0] as DiskName;
                    const sector = parseInt(destKey.substring(1)) as SectorNumber;
                    // Même pas de sonde que le joueur humain : les déplacements restants suivent, sauf si le choix
                    // Média / déplacement de la carte 19 les reprend ; un refus du moteur met fin aux déplacements
                    const res = InteractionChoices.moveProbe(c.updatedGame, p.id, { ...interaction, sequenceId: interaction.sequenceId || c.sequenceId }, probe.id, disk, sector, interaction.sequenceId || c.sequenceId);
                    if (!res.error) {
                        c.updatedGame = res.updatedGame;
                        c.historyEntries.push(...res.historyEntries);
                        if (res.nextInteraction) c.newPendingInteractions.push(res.nextInteraction);
                        c.newPendingInteractions.push(...res.newPendingInteractions);
                    }
                }
            }
        },
        ACQUIRING_TECH: (c, interaction) => {
            // Mêmes technologies que pour le joueur humain (catégories, piles déjà prises, technologie partagée)
            const validTechs = TechnologySystem.acquirableTechs(c.updatedGame, c.player.id, { categories: interaction.categories, sharedOnly: interaction.sharedOnly });
            if (validTechs.length > 0) {
                const tech = validTechs[Math.floor(random() * validTechs.length)];
                // Une technologie Informatique renvoie le choix de la colonne (SELECTING_COMPUTER_SLOT)
                const res = InteractionChoices.acquireTech(c.updatedGame, c.player.id, { ...interaction, sequenceId: c.sequenceId }, tech);
                if (!res.error) {
                    c.updatedGame = res.updatedGame;
                    c.historyEntries.push(...res.historyEntries);
                    c.newPendingInteractions.push(...res.newPendingInteractions);
                }
            }
        },
        SELECTING_COMPUTER_SLOT: (c, interaction) => {
            const p = requirePlayer(c.updatedGame, c.player.id);
            const columns = ComputerSystem.TECH_COLUMNS.filter(col => ComputerSystem.canAssignTechnology(p, col).canAssign);
            const targetCol = columns.length > 0 ? columns[Math.floor(random() * columns.length)] : undefined;
            const res = InteractionChoices.acquireTech(c.updatedGame, c.player.id, { ...interaction, sequenceId: c.sequenceId }, interaction.tech, targetCol);
            if (!res.error) {
                c.updatedGame = res.updatedGame;
                c.historyEntries.push(...res.historyEntries);
                c.newPendingInteractions.push(...res.newPendingInteractions);
            }
        },
        CHOOSING_OBS2_ACTION: (c, interaction) => {
            const res = InteractionChoices.observation2(c.updatedGame, c.player.id, { ...interaction, sequenceId: c.sequenceId }, true);
            if (!res.error) {
                c.updatedGame = res.updatedGame;
                c.historyEntries.push(...res.historyEntries);
                c.newPendingInteractions.push(...res.newPendingInteractions);
            }
        },
        DISCARDING_TOKEN: (c, interaction) => {
            const res = AIController.bestTokenDiscard(c.updatedGame, c.player, interaction, c.sequenceId);
            c.updatedGame = res.updatedGame;
            c.historyEntries.push(...res.historyEntries.map(e => ({ ...e, sequenceId: c.sequenceId })));
            c.newPendingInteractions.push(...res.newPendingInteractions);
        },
        CHOOSING_MISSION_REQUIREMENT: (c, interaction) => {
            const res = AIController.bestMissionRequirement(c.updatedGame, c.player, interaction, c.sequenceId);
            c.updatedGame = res.updatedGame;
            c.historyEntries.push(...res.historyEntries.map(e => ({ ...e, sequenceId: c.sequenceId })));
            c.newPendingInteractions.push(...res.newPendingInteractions);
        },
        CHOOSING_ROUND_CARD: (c, interaction) => {
            const res = AIController.bestRoundCard(c.updatedGame, c.player, { ...interaction, sequenceId: c.sequenceId });
            c.updatedGame = res.updatedGame;
            c.historyEntries.push(...res.historyEntries);
        },
        CHOOSING_EXERTIEN_CARD: (c, interaction) => {
            // Simule chaque carte (et le renoncement) : la position évaluée compte les PV promis
            // selon l'avancement de la condition et la pénalité de danger attendue
            const res = AIController.bestExertienCard(c.updatedGame, c.player.id, interaction.milestone);
            c.updatedGame = res.updatedGame;
            c.historyEntries.push(...res.historyEntries.map(e => ({ ...e, sequenceId: c.sequenceId })));
        },
        CHOOSING_OBS3_ACTION: (c, interaction) => {
            // Même règle que le joueur humain (accepter, puis défausser 1 carte) ; le robot défausse sa première carte
            const p = requirePlayer(c.updatedGame, c.player.id);
            const hand = CardSystem.getHandCards(p);
            const discard = InteractionChoices.observation3(c.updatedGame, { ...interaction, sequenceId: c.sequenceId }, hand.length > 0).newPendingInteractions[0];
            if (discard?.type === 'DISCARDING_FOR_SIGNAL') {
                const res = InteractionChoices.discardForSignals(c.updatedGame, c.player.id, discard, [hand[0].id]);
                c.historyEntries.push(...res.historyEntries);
                c.newPendingInteractions.push(...res.newPendingInteractions);
            }
        },
        CHOOSING_OBS4_ACTION: (c, interaction) => {
            const p = requirePlayer(c.updatedGame, c.player.id);
            const choice = p.energy >= 1 && random() > 0.5 ? 'PROBE' : 'MOVE';
            const res = InteractionChoices.observation4(c.updatedGame, c.player.id, { ...interaction, sequenceId: c.sequenceId }, choice);
            if (!res.error) {
                c.updatedGame = res.updatedGame;
                c.historyEntries.push(...res.historyEntries);
                c.newPendingInteractions.push(...res.newPendingInteractions);
            }
        },
        CHOOSING_BONUS_ACTION: (c, interaction) => {
            // Première action restante, puis le menu revient (sauf après une mission), comme pour le joueur humain
            const chosen = InteractionChoices.chooseBonusAction(interaction, interaction.choices.findIndex(c => !c.done));
            if (chosen) {
                c.newPendingInteractions.push(chosen.next);
                if (chosen.menu) c.newPendingInteractions.push(chosen.menu);
            }
        },
        ACQUIRING_ALIEN_CARD: (c, interaction) => {
            const species = c.updatedGame.species.find(s => s.id === interaction.speciesId);
            if (species) {
                const canPickFromRow = species.cardRow && species.cardRow.length > 0;
                const canPickFromDeck = species.cards && species.cards.length > 0;
                let cardId = 'deck';
                if (canPickFromRow && (!canPickFromDeck || random() > 0.5)) {
                    cardId = species.cardRow[Math.floor(random() * species.cardRow.length)].id;
                }
                // Plusieurs cartes : l'interaction reste en attente avec une carte de moins
                const res = InteractionChoices.acquireAlienCard(c.updatedGame, c.player.id, { ...interaction, sequenceId: c.sequenceId }, cardId);
                if (!res.error) {
                    c.updatedGame = res.updatedGame;
                    c.historyEntries.push(...res.historyEntries.map(e => ({ ...e, previousState: c.game })));
                    c.newPendingInteractions.push(...res.newPendingInteractions);
                }
            }
        },
        ORBITING_PROBE: (c, interaction) => {
            // La sonde du robot posée sur une planète (hors Terre)
            const info = ProbeSystem.probeOnPlanetInfo(c.updatedGame, c.player.id);
            if (info.hasProbe && info.planetId) {
                // Placements restants (count > 1) : la même interaction suit les bonus déclenchés
                const res = InteractionChoices.placeBonusProbe(c.updatedGame, c.player.id, { ...interaction, sequenceId: c.sequenceId }, info.planetId);
                if (!res.error) {
                    c.updatedGame = res.updatedGame;
                    c.historyEntries.push(...res.historyEntries);
                    c.newPendingInteractions.push(...res.newPendingInteractions);
                    if (res.nextInteraction) c.newPendingInteractions.push(res.nextInteraction);
                }
            }
        },
        LANDING_PROBE: (c, interaction) => AIController.ROBOT_HANDLERS.ORBITING_PROBE(c, interaction as never),
        COLLECTING_SPECIMEN: (c, interaction) => {
            const res = AIController.bestSpecimen(c.updatedGame, c.player, { ...interaction, sequenceId: c.sequenceId });
            if (res) {
                c.updatedGame = res.updatedGame;
                c.historyEntries.push(...res.historyEntries);
                c.newPendingInteractions.push(...res.newPendingInteractions);
            }
        },
        CONSULTING_SPECIMEN: (c, interaction) => AIController.ROBOT_HANDLERS.COLLECTING_SPECIMEN(c, interaction as never),
        DISCARDING_DRAWN_CARD: (c, interaction) => {
            // ET.15 : chaque carte possible est simulée, la position la mieux évaluée est gardée
            let best: { res: ReturnType<typeof InteractionChoices.discardDrawnCard>; value: number } | null = null;
            for (const cardId of interaction.cardIds) {
                const res = InteractionChoices.discardDrawnCard(c.updatedGame, c.player.id, { ...interaction, sequenceId: c.sequenceId }, cardId);
                const value = AIEvaluator.evaluate(res.updatedGame, c.player.id);
                if (!best || value > best.value) best = { res, value };
            }
            if (best) {
                c.updatedGame = best.res.updatedGame;
                c.historyEntries.push(...best.res.historyEntries);
                if (best.res.nextInteraction) c.newPendingInteractions.push(best.res.nextInteraction);
                c.newPendingInteractions.push(...best.res.newPendingInteractions);
            }
        },
        DISCARDING_FOR_SIGNAL: (c, interaction) => {
            // Nombre de cartes tiré au hasard ; un robot stratégique compare les tirages
            const p = requirePlayer(c.updatedGame, c.player.id);
            const hand = [...CardSystem.getHandCards(p)].sort(() => 0.5 - random());
            const count = Math.floor(random() * (Math.min(interaction.count, hand.length) + 1));
            const res = InteractionChoices.discardForSignals(c.updatedGame, c.player.id, { ...interaction, sequenceId: c.sequenceId }, hand.slice(0, count).map(c => c.id));
            c.historyEntries.push(...res.historyEntries);
            c.newPendingInteractions.push(...res.newPendingInteractions);
        },
        CHOOSING_CENTAURIEN_REWARD: (c, interaction) => {
            const species = c.updatedGame.species.find(s => s.name === AlienBoardType.CENTAURIENS);
            if (species && species.message) {
                const availableTokens = species.message.map((token, index) => ({ token, index })).filter(item => item.token.isAvailable);
                if (availableTokens.length > 0) {
                    const choice = availableTokens[Math.floor(random() * availableTokens.length)];
                    const res = InteractionChoices.claimCentaurienReward(c.updatedGame, c.player.id, interaction, choice.index);
                    c.updatedGame = res.updatedGame;
                    c.historyEntries.push(...res.historyEntries);
                    c.newPendingInteractions.push(...res.newPendingInteractions);
                }
            }
        },
        CHOOSING_MEDIA_OR_MOVE: (c, interaction) => {
            const res = InteractionChoices.chooseMediaOrMove(c.updatedGame, c.player.id, { ...interaction, sequenceId: c.sequenceId }, random() > 0.5 ? 'MEDIA' : 'MOVE');
            c.updatedGame = res.updatedGame;
            c.historyEntries.push(...res.historyEntries);
            if (res.nextInteraction) c.newPendingInteractions.push(res.nextInteraction);
        },
        REMOVING_ORBITER: (c, interaction) => {
            // Le premier orbiteur (ou atterrisseur) du robot
            const state = interaction.type === 'REMOVING_ORBITER' ? ProbeState.IN_ORBIT : ProbeState.LANDED;
            const probe = c.updatedGame.players.find(p => p.id === c.player.id)!.probes.find(pr => pr.state === state && pr.planetId);
            const planet = probe ? c.updatedGame.board.planets.find(pl => pl.id === probe.planetId) : undefined;
            if (probe && planet) {
                const slots = interaction.type === 'REMOVING_ORBITER' ? planet.orbiters : planet.landers;
                const slotIndex = slots.findIndex(s => s.id === probe.id);
                const res = slotIndex === -1 ? null : InteractionChoices.removeProbe(c.updatedGame, c.player.id, { ...interaction, sequenceId: c.sequenceId }, planet.id, slotIndex);
                if (res && !res.error) {
                    c.updatedGame = res.updatedGame;
                    c.historyEntries.push(...res.historyEntries);
                    c.newPendingInteractions.push(...res.newPendingInteractions);
                }
            }
        },
        REMOVING_LANDER: (c, interaction) => AIController.ROBOT_HANDLERS.REMOVING_ORBITER(c, interaction as never),
    };
}
