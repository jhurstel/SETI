import { BaseAction } from './Action';
import { Game, ActionType, ValidationResult, GAME_CONSTANTS } from '../core/types';

export class ResearchTechAction extends BaseAction {
    constructor(playerId: string) {
        super(playerId, ActionType.RESEARCH_TECH);
    }

    validate(game: Game): ValidationResult {
        const player = game.players.find(p => p.id === this.playerId);
        if (!player) {
            return { valid: false, errors: [{ code: 'PLAYER_NOT_FOUND', message: 'Joueur introuvable' }], warnings: [] };
        }

        if (player.mediaCoverage < GAME_CONSTANTS.TECH_RESEARCH_COST_MEDIA) {
            return { valid: false, errors: [{ code: 'INSUFFICIENT_MEDIA', message: `Couverture médiatique insuffisante (Requis: ${GAME_CONSTANTS.TECH_RESEARCH_COST_MEDIA})` }], warnings: [] };
        }

        return { valid: true, errors: [], warnings: [] };
    }

    execute(game: Game): Game {
        // L'exécution réelle est gérée dans l'UI pour la rotation et l'interaction.
        const player = game.players.find(p => p.id === this.playerId)!;
        player.mediaCoverage -= GAME_CONSTANTS.TECH_RESEARCH_COST_MEDIA;
        // La rotation est une conséquence gérée par l'UI.
        return game;
    }
}
