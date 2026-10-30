import { BaseAction } from './Action';
import { Game, ActionType, ValidationResult, GAME_CONSTANTS, LifeTraceType } from '../core/types';
import { ResourceSystem } from '../systems/ResourceSystem';
import { ComputerSystem } from '../systems/ComputerSystem';
import { cloneGame } from '../core/cloneGame';
import { uniqueId } from '../core/ids';

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

    /** Paie 1 énergie, vide l'ordinateur et donne une trace de vie Bleue à placer */
    execute(game: Game): Game {
        const updatedGame = cloneGame(game);
        const player = updatedGame.players.find(p => p.id === this.playerId)!;
        player.energy -= GAME_CONSTANTS.ANALYZE_COST_ENERGY;
        ComputerSystem.clearComputer(player);
        const sequenceId = `analyze-${uniqueId()}`;
        this.historyEntries = [{ message: `paye ${ResourceSystem.formatResource(GAME_CONSTANTS.ANALYZE_COST_ENERGY, 'ENERGY')} pour <strong>Analyser les données</strong> et gagne une trace de vie Bleu`, playerId: this.playerId, sequenceId }];
        this.newPendingInteractions = [{ type: 'PLACING_LIFE_TRACE', color: LifeTraceType.BLUE, sequenceId }];
        return updatedGame;
    }
}
