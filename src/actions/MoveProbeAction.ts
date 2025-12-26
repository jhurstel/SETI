/**
 * Action : Déplacer une sonde
 */

import {
  Game,
  ActionType,
  ValidationResult,
  Position
} from '../core/types';
import { BaseAction } from './Action';
import { ProbeSystem } from '../systems/ProbeSystem';

export class MoveProbeAction extends BaseAction {
  constructor(
    playerId: string,
    public probeId: string,
    public targetPosition: Position
  ) {
    super(ActionType.MOVE_PROBE, playerId);
  }

  validate(game: Game): ValidationResult {
    const validation = ProbeSystem.canMoveProbe(
      game,
      this.playerId,
      this.probeId,
      this.targetPosition
    );
    
    if (!validation.canMove) {
      return this.createInvalidResult(validation.reason || 'Déplacement impossible');
    }

    return this.createValidResult();
  }

  execute(game: Game): Game {
    return ProbeSystem.moveProbe(
      game,
      this.playerId,
      this.probeId,
      this.targetPosition
    );
  }
}

