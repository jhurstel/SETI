import { Game, Player, ActionType, GAME_CONSTANTS, AIDifficulty, AIDecision, RevenueType, Card } from '../core/types';
import { ProbeSystem } from '../systems/ProbeSystem';
import { ScanSystem } from '../systems/ScanSystem';
import { ComputerSystem } from '../systems/ComputerSystem';
import { CardSystem } from '../systems/CardSystem';
import { TechnologySystem } from '../systems/TechnologySystem';
import { random } from '../core/random';

/**
 * Température de chaque niveau : tous les robots évaluent les positions de la même façon (AIEvaluator),
 * le niveau ne fixe que leur hésitation entre les bonnes actions (AIBehavior.pickWithNoise).
 * Réglée pour atteindre des écarts cibles entre niveaux (npm run tune:ai -- levels, docs : 5.1).
 */
export const LEVEL_TEMPERATURE: Record<AIDifficulty, number> = { PASS: 0, EASY: 12, MEDIUM: 2, EXPERT: 0 };
/** Les options à plus de NOISE_WINDOW températures de la meilleure ne sont jamais choisies */
export const NOISE_WINDOW = 3;
/**
 * Anticipation de chaque niveau : nombre de meilleures actions principales départagées par la réponse simulée
 * de l'adversaire suivant (AITurn.withOpponentReply) ; 0 : aucune anticipation.
 */
export const LEVEL_LOOKAHEAD: Record<AIDifficulty, number> = { PASS: 0, EASY: 0, MEDIUM: 0, EXPERT: 3 };
/**
 * Suites jouées (rollouts) pour chacune de ces actions : 0, réponse du seul adversaire suivant ; sinon, autant de
 * suites jusqu'à la prochaine action principale du robot, cartes cachées redistribuées (AITurn.rolloutValue).
 */
export const LEVEL_ROLLOUTS: Record<AIDifficulty, number> = { PASS: 0, EASY: 0, MEDIUM: 0, EXPERT: 4 };

export class AIBehavior {

    /** Niveau d'un robot (EASY par défaut, ex. anciennes sauvegardes) */
    static getDifficulty(player: Player): AIDifficulty {
        return player.aiDifficulty ?? 'EASY';
    }

    /**
     * Le robot choisit ses coups en simulant et en évaluant les positions (voir AITurn) : tous les niveaux,
     * avec la même évaluation ; seul le niveau PASS des tests ne le fait pas.
     */
    static isStrategic(player: Player): boolean {
        return this.getDifficulty(player) !== 'PASS';
    }

    /** Nombre de tirages comparés pour un choix aléatoire (secteur, technologie, carte…) */
    static choiceSamples(player: Player): number {
        return this.isStrategic(player) ? 4 : 1;
    }

    /** Température imposée à un joueur, pour comparer des réglages (banc tools/spsa ; vide en jeu) */
    static temperatureOverrides = new Map<string, number>();

    /** Anticipation imposée à un joueur, pour comparer des réglages (banc tools/spsa ; vide en jeu) */
    static lookaheadOverrides = new Map<string, number>();

    /** Nombre de meilleures actions que le robot départage en simulant la réponse de l'adversaire suivant */
    static lookahead(player: Player): number {
        return this.lookaheadOverrides.get(player.id) ?? LEVEL_LOOKAHEAD[this.getDifficulty(player)];
    }

    /** Suites jouées imposées à un joueur, pour comparer des réglages (banc tools/spsa ; vide en jeu) */
    static rolloutOverrides = new Map<string, number>();

    /** Nombre de suites jouées pour chaque action départagée (0 : réponse de l'adversaire suivant seulement) */
    static rollouts(player: Player): number {
        return this.rolloutOverrides.get(player.id) ?? LEVEL_ROLLOUTS[this.getDifficulty(player)];
    }

    /** Hésitation du robot (température du choix de ses actions, en points d'évaluation ; 0 : toujours la meilleure) */
    static temperature(player: Player): number {
        return this.temperatureOverrides.get(player.id) ?? LEVEL_TEMPERATURE[this.getDifficulty(player)];
    }

    /**
     * Choix d'une option selon sa valeur : la meilleure à température nulle (la première en cas d'égalité),
     * sinon un tirage où une option vaut exp(−écart / température) fois la meilleure. Les options à plus de
     * NOISE_WINDOW températures de la meilleure ne sont jamais tirées : le robot hésite entre de bons coups,
     * il ne joue pas un coup absurde.
     */
    static pickWithNoise<T>(options: { value: number; item: T }[], temperature: number): T | null {
        if (options.length === 0) return null;
        const best = options.reduce((a, b) => (b.value > a.value ? b : a));
        if (temperature <= 0) return best.item;
        const close = options.filter(o => o.value >= best.value - NOISE_WINDOW * temperature);
        const weights = close.map(o => Math.exp((o.value - best.value) / temperature));
        let draw = random() * weights.reduce((a, b) => a + b, 0);
        // La dernière option prend le reste du tirage (arrondis compris)
        let i = 0;
        while (i < close.length - 1) {
            draw -= weights[i];
            if (draw < 0) break;
            i++;
        }
        return close[i].item;
    }

    /**
     * Toutes les actions principales jouables (une entrée par technologie, carte ou planète possible)
     */
    static listMainActions(game: Game, player: Player): AIDecision[] {
        const actions: AIDecision[] = [];

        if (ProbeSystem.canLaunchProbe(game, player.id).canLaunch) {
            actions.push({ action: ActionType.LAUNCH_PROBE });
        }

        if (ScanSystem.canScanSector(game, player.id).canScan) {
            actions.push({ action: ActionType.SCAN_SECTOR });
        }

        if (ComputerSystem.canAnalyzeData(game, player.id).canAnalyze) {
            actions.push({ action: ActionType.ANALYZE_DATA });
        }

        if (TechnologySystem.canResearchTech(game, player.id).canResearch) {
            // Mêmes technologies que pour le joueur humain : le dessus de chaque pile qu'il n'a pas encore
            TechnologySystem.acquirableTechs(game, player.id)
                .forEach(tech => actions.push({ action: ActionType.RESEARCH_TECH, data: { tech } }));
        }

        CardSystem.getHandCards(player)
            .filter(c => CardSystem.canPlayCard(game, player.id, c).canPlay)
            .forEach(card => actions.push({ action: ActionType.PLAY_CARD, data: { cardId: card.id } }));

        // Orbite et atterrissage : planètes (hors Terre) et satellites où le joueur a une sonde
        const planetIds = game.board.planets.filter(p => p.id !== 'earth').map(p => p.id);
        const satelliteIds = game.board.planets.flatMap(p => (p.satellites || []).map(s => s.id));
        planetIds.forEach(planetId => {
            const found = ProbeSystem.findProbeAtPlanet(game, player.id, planetId);
            if (!found) return;
            if (ProbeSystem.canOrbit(game, player.id, found.probe.id).canOrbit) {
                actions.push({ action: ActionType.ORBIT, data: { probeId: found.probe.id, planetId } });
            }
            if (ProbeSystem.canLand(game, player.id, found.probe.id).canLand) {
                actions.push({ action: ActionType.LAND, data: { probeId: found.probe.id, planetId } });
            }
        });
        satelliteIds.forEach(satelliteId => {
            const found = ProbeSystem.findProbeAtPlanet(game, player.id, satelliteId);
            if (found && ProbeSystem.canLand(game, player.id, found.probe.id).canLand && ProbeSystem.canLandOnSatellite(game, player.id, satelliteId).canLand && ProbeSystem.canLandOnSlot(game, satelliteId).canLand) {
                actions.push({ action: ActionType.LAND, data: { probeId: found.probe.id, planetId: satelliteId } });
            }
        });

        return actions;
    }

    /**
     * Crée une décision de passer : le robot garde les cartes qu'il pourra jouer (au hasard pour le niveau PASS des tests)
     */
    static createPassDecision(player: Player): AIDecision {
        const hand = CardSystem.getHandCards(player);
        const keepCount = Math.min(hand.length, GAME_CONSTANTS.HAND_SIZE_AFTER_PASS);
        const ordered = this.getDifficulty(player) !== 'PASS'
            ? [...hand].sort((a, b) => this.cardKeepValue(player, b) - this.cardKeepValue(player, a))
            : [...hand].sort(() => 0.5 - random());
        return {
            action: ActionType.PASS,
            data: { cardsToKeep: ordered.slice(0, keepCount).map(c => c.id) }
        };
    }

    /** Intérêt de garder une carte : jouable avec les crédits de la prochaine manche, et de préférence coûteuse (plus puissante) */
    static cardKeepValue(player: Player, card: Card): number {
        const nextRoundCredits = player.credits + player.revenueCredits;
        const affordable = card.cost <= nextRoundCredits ? 10 : 0;
        return affordable + card.cost;
    }

    /**
     * Décide quelle carte réserver (Setup) : un robot stratégique privilégie le revenu en crédits
     */
    static decideReservation(_game: Game, player: Player): string | null {
        const hand = CardSystem.getHandCards(player);
        if (hand.length === 0) return null;
        if (this.isStrategic(player)) {
            const preference = [RevenueType.CREDIT, RevenueType.ENERGY, RevenueType.CARD];
            const rank = (c: Card) => {
                const index = preference.indexOf(c.revenue);
                return index === -1 ? preference.length : index;
            };
            return [...hand].sort((a, b) => rank(a) - rank(b))[0].id;
        }
        return hand[Math.floor(random() * hand.length)].id;
    }
}
