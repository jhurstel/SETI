import { BaseAction } from './Action';
import { Game, ActionType, ValidationResult, GAME_CONSTANTS, InteractionState } from '../core/types';
import { performRotation } from '../core/SolarSystemPosition';
import { ResourceSystem } from '../systems/ResourceSystem';
import { TechnologySystem } from '../systems/TechnologySystem';

export class ResearchTechAction extends BaseAction {
    public historyEntries: { message: string, playerId: string, sequenceId: string }[] = [];
    public newPendingInteractions: InteractionState[] = [];

    constructor(playerId: string) {
        super(playerId, ActionType.RESEARCH_TECH);
    }

    validate(game: Game): ValidationResult {
        const check = TechnologySystem.canResearchTech(game, this.playerId);
        if (!check.canResearch) {
            return { valid: false, errors: [{ code: 'CANNOT_RESEARCH', message: check.reason || 'Recherche impossible' }], warnings: [] };
        }

        return { valid: true, errors: [], warnings: [] };
    }

    execute(game: Game): Game {
        const player = game.players.find(p => p.id === this.playerId)!;
        const sequenceId = `tech-${Date.now()}`;

        // Payer le coût
        player.mediaCoverage -= GAME_CONSTANTS.TECH_RESEARCH_COST_MEDIA;
        const message = `paye ${ResourceSystem.formatResource(GAME_CONSTANTS.TECH_RESEARCH_COST_MEDIA, 'MEDIA')} pour <strong>Rechercher une technologie</strong>`
        this.historyEntries.push({ message, playerId: this.playerId, sequenceId });
  
        // Faire tourner le systeme solaire
        const result = performRotation(game);
        result.logs.forEach(log => this.historyEntries.push({ message: log, playerId: this.playerId, sequenceId }));
  
        this.newPendingInteractions.push({ type: 'ACQUIRING_TECH', isBonus: false, sequenceId })
        return result.updatedGame;
    }
}
