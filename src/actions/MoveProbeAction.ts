import { Game, ActionType, ValidationResult, DiskName, SectorNumber } from '../core/types';
import { BaseAction } from './Action';
import { ProbeSystem } from '../systems/ProbeSystem';

export class MoveProbeAction extends BaseAction {
  constructor(
    playerId: string,
    public probeId: string,
    public targetPosition: { disk: DiskName; sector: SectorNumber },
    public availableFreeMovements: number = 0,
    public sequenceId?: string
  ) {
    super(playerId, ActionType.MOVE_PROBE);
  }

  validate(game: Game): ValidationResult {
    const check = ProbeSystem.canMoveProbe(game, this.playerId, this.probeId, this.availableFreeMovements);
    if (!check.canMove) {
      return { valid: false, errors: [{ code: 'CANNOT_MOVE', message: check.reason || 'Déplacement impossible' }], warnings: [] };
    }
    return { valid: true, errors: [], warnings: [] };
  }

  execute(game: Game): Game {
    const result = ProbeSystem.moveProbe(game, this.playerId, this.probeId, this.targetPosition.disk, this.targetPosition.sector, this.availableFreeMovements, this.sequenceId);
    this.historyEntries = result.historyEntries;
    this.newPendingInteractions = result.newPendingInteractions;
    return result.updatedGame;
  }
}
