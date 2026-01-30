import { BaseAction } from './Action';
import { Game, ActionType, ValidationResult, InteractionState } from '../core/types';
import { ScanSystem } from '../systems/ScanSystem';

export class ScanSectorAction extends BaseAction {
    public historyEntries: { message: string, playerId: string, sequenceId: string }[] = [];
    public newPendingInteractions: InteractionState[] = [];


    constructor(playerId: string) {
        super(playerId, ActionType.SCAN_SECTOR);
    }

    validate(game: Game): ValidationResult {
        const check = ScanSystem.canScanSector(game, this.playerId);
        if (!check.canScan) {
            return { valid: false, errors: [{ code: 'CANNOT_SCAN', message: check.reason || 'Scan impossible' }], warnings: [] };
        }
        return { valid: true, errors: [], warnings: [] };
    }

    execute(game: Game): Game {
        const result = ScanSystem.performScanAction(game);
        this.historyEntries = result.historyEntries;
        this.newPendingInteractions = result.newPendingInteractions;
        return result.updatedGame;
    }
}
