import { Game, Player, ActionType, GAME_CONSTANTS, AIDifficulty, AIDecision, RevenueType, Card } from '../core/types';
import { ProbeSystem } from '../systems/ProbeSystem';
import { ScanSystem } from '../systems/ScanSystem';
import { ComputerSystem } from '../systems/ComputerSystem';
import { CardSystem } from '../systems/CardSystem';
import { TechnologySystem } from '../systems/TechnologySystem';

export class AIBehavior {

    /** Niveau d'un robot (EASY par défaut, ex. anciennes sauvegardes) */
    static getDifficulty(player: Player): AIDifficulty {
        return player.aiDifficulty ?? 'EASY';
    }

    /** Le robot choisit ses coups en simulant et en évaluant les positions (voir AITurn) */
    static isStrategic(player: Player): boolean {
        const difficulty = this.getDifficulty(player);
        return difficulty === 'MEDIUM' || difficulty === 'EXPERT';
    }

    /**
     * Stratégie Facile : choix aléatoire d'un type d'action valide, puis d'une de ses variantes
     */
    static decideRandomAction(game: Game, player: Player): AIDecision {
        if (this.getDifficulty(player) === 'PASS') return this.createPassDecision(player);

        const possibleActions = this.listMainActions(game, player);
        if (possibleActions.length === 0) {
            console.log(`[AI] ${player.name} has no possible actions, passing.`);
            return this.createPassDecision(player);
        }

        const types = [...new Set(possibleActions.map(a => a.action))];
        const type = types[Math.floor(Math.random() * types.length)];
        const variants = possibleActions.filter(a => a.action === type);
        const decision = variants[Math.floor(Math.random() * variants.length)];
        console.log(`[AI] ${player.name} chose:`, decision.action, decision.data);
        return decision;
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
            // Une seule technologie par pile : on ne propose que les piles que le joueur n'a pas encore
            TechnologySystem.getAvailableTechs(game)
                .filter(tech => {
                    const baseId = tech.id.substring(0, tech.id.lastIndexOf('-'));
                    return !player.technologies.some(t => t.id.startsWith(baseId));
                })
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
            if (found && ProbeSystem.canLand(game, player.id, found.probe.id).canLand) {
                actions.push({ action: ActionType.LAND, data: { probeId: found.probe.id, planetId: satelliteId } });
            }
        });

        return actions;
    }

    /**
     * Crée une décision de passer : un robot stratégique garde les cartes qu'il pourra jouer, les autres au hasard
     */
    static createPassDecision(player: Player): AIDecision {
        const hand = CardSystem.getHandCards(player);
        const keepCount = Math.min(hand.length, GAME_CONSTANTS.HAND_SIZE_AFTER_PASS);
        const ordered = this.isStrategic(player)
            ? [...hand].sort((a, b) => this.cardKeepValue(player, b) - this.cardKeepValue(player, a))
            : [...hand].sort(() => 0.5 - Math.random());
        return {
            action: ActionType.PASS,
            data: { cardsToKeep: ordered.slice(0, keepCount).map(c => c.id) }
        };
    }

    /** Intérêt de garder une carte : jouable avec les crédits de la prochaine manche, et de préférence coûteuse (plus puissante) */
    private static cardKeepValue(player: Player, card: Card): number {
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
        return hand[Math.floor(Math.random() * hand.length)].id;
    }

    /**
     * Vérifie si le robot doit réclamer un palier d'objectif.
     * Retourne le palier et l'ID de la tuile objectif choisie.
     */
    static checkAndClaimMilestone(game: Game, player: Player): { milestone: number, tileId: string } | null {
        const milestones = [25, 50, 70];

        for (const m of milestones) {
            if (player.score >= m && !player.claimedGoldenMilestones.includes(m)) {
                // Trouver les tuiles où le joueur n'a pas encore de marqueur
                const availableTiles = (game.board.objectiveTiles || []).filter(t => !t.markers.includes(player.id));

                if (availableTiles.length > 0) {
                    const randomTile = availableTiles[Math.floor(Math.random() * availableTiles.length)];
                    return { milestone: m, tileId: randomTile.id };
                }
            }
        }
        return null;
    }
}
