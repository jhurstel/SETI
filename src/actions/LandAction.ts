import { BaseAction } from './Action';
import { Game, ActionType, ValidationResult } from '../core/types';
import { ProbeSystem } from '../systems/ProbeSystem';
import { ResourceSystem } from '../systems/ResourceSystem';

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
        // L'exécution réelle est gérée dans l'UI pour les bonus.
        const result = ProbeSystem.landProbe(game, this.playerId, this.probeId, this.planetId);
        const res = ResourceSystem.processBonuses(result.bonuses, result.updatedGame, this.playerId, 'land', `land-${Date.now()}`);
        return res.updatedGame;
    }
}
