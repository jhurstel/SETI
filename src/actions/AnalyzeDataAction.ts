import { BaseAction } from './Action';
import { Game, ActionType, ValidationResult } from '../core/types';
import { ComputerSystem } from '../systems/ComputerSystem';

export class AnalyzeDataAction extends BaseAction {
    constructor(playerId: string) {
        super(playerId, ActionType.ANALYZE_DATA);
    }

    validate(game: Game): ValidationResult {
        const check = ComputerSystem.canAnalyzeData(game, this.playerId);
        if (!check.canAnalyze) {
            return { valid: false, errors: [{ code: 'CANNOT_ANALYZE', message: check.reason || 'Analyse impossible' }], warnings: [] };
        }
        return { valid: true, errors: [], warnings: [] };
    }

    execute(game: Game): Game {
        // L'exécution réelle est gérée dans l'UI pour l'animation et l'interaction.
        // Cette méthode est pour la complétude et une future exécution par le moteur.
        const player = game.players.find(p => p.id === this.playerId)!;
        player.energy -= 1;
        ComputerSystem.clearComputer(player);
        return game;
    }
}
