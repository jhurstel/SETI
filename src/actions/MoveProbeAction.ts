import { Game, ActionType, ValidationResult, DiskName, SectorNumber } from '../core/types';
import { BaseAction } from './Action';
import { ProbeSystem } from '../systems/ProbeSystem';

export class MoveProbeAction extends BaseAction {
  public executionMessage: string = "";

  constructor(
    playerId: string,
    public probeId: string,
    public targetPosition: { disk: DiskName; sector: SectorNumber },
    public availableFreeMovements: number = 0
  ) {
    super(playerId, ActionType.MOVE_PROBE);
  }

  validate(game: Game): ValidationResult {
    const cost = ProbeSystem.getMovementCost(game, this.playerId, this.probeId);
    const usedFree = Math.min(cost, this.availableFreeMovements);
    const finalCost = cost - usedFree;

    const check = ProbeSystem.canMoveProbe(
      game,
      this.playerId,
      this.probeId,
      finalCost
    );
    
    if (!check.canMove) {
      return { valid: false, errors: [{ code: 'CANNOT_MOVE', message: check.reason || 'Déplacement impossible' }], warnings: [] };
    }

    return { valid: true, errors: [], warnings: [] };
  }

  execute(game: Game): Game {
    const cost = ProbeSystem.getMovementCost(game, this.playerId, this.probeId);
    const usedFree = Math.min(cost, this.availableFreeMovements);
    const finalCost = cost - usedFree;

    const result = ProbeSystem.moveProbe(
      game,
      this.playerId,
      this.probeId,
      finalCost,
      this.targetPosition.disk,
      this.targetPosition.sector
    );
    this.executionMessage = result.message;
    return result.updatedGame;
  }
}
