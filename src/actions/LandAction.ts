import { BaseAction } from './Action';
import { Game, ActionType, ValidationResult } from '../core/types';
import { ProbeSystem } from '../systems/ProbeSystem';

export class LandAction extends BaseAction {
    constructor(public playerId: string, public probeId: string, public planetId: string) {
        super(playerId, ActionType.LAND);
    }

    validate(game: Game): ValidationResult {
        const check = ProbeSystem.canLand(game, this.playerId, this.probeId);
        if (!check.canLand) {
            return { valid: false, errors: [{ code: 'CANNOT_LAND', message: check.reason || 'Atterrissage impossible' }], warnings: [] };
        }
        return { valid: true, errors: [], warnings: [] };
    }

    execute(game: Game): Game {
        const result = ProbeSystem.landProbe(game, this.playerId, this.probeId, this.planetId);
        this.historyEntries = result.historyEntries;
        this.newPendingInteractions = result.newPendingInteractions;
        return result.updatedGame;
    }
}
