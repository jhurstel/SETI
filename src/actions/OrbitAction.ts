import { BaseAction } from './Action';
import { Game, ActionType, ValidationResult } from '../core/types';
import { ProbeSystem } from '../systems/ProbeSystem';

export class OrbitAction extends BaseAction {
    constructor(public playerId: string, public probeId: string, public planetId: string) {
        super(playerId, ActionType.ORBIT);
    }

    validate(game: Game): ValidationResult {
        const check = ProbeSystem.canOrbit(game, this.playerId, this.probeId);
        if (!check.canOrbit) {
            return { valid: false, errors: [{ code: 'CANNOT_ORBIT', message: check.reason || 'Mise en orbite impossible' }], warnings: [] };
        }
        return { valid: true, errors: [], warnings: [] };
    }

    execute(game: Game): Game {
        // L'exécution réelle est gérée dans l'UI pour les bonus.
        const result = ProbeSystem.orbitProbe(game, this.playerId, this.probeId, this.planetId);
        return result.updatedGame;
    }
}
