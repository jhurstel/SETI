import { BaseAction } from './Action';
import { Game, ActionType, ValidationResult, GAME_CONSTANTS } from '../core/types';
import { SectorSystem } from '../systems/SectorSystem';

export class ScanSectorAction extends BaseAction {
    constructor(playerId: string) {
        super(playerId, ActionType.SCAN_SECTOR);
    }

    validate(game: Game): ValidationResult {
        const check = SectorSystem.canScanSector(game, this.playerId);
        if (!check.canScan) {
            return { valid: false, errors: [{ code: 'CANNOT_SCAN', message: check.reason || 'Scan impossible' }], warnings: [] };
        }
        return { valid: true, errors: [], warnings: [] };
    }

    execute(game: Game): Game {
        const player = game.players.find(p => p.id === this.playerId)!;
        player.credits -= GAME_CONSTANTS.SCAN_COST_CREDITS;
        player.energy -= GAME_CONSTANTS.SCAN_COST_ENERGY;
        return game;
    }
}
