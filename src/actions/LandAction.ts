/**
 * Action : Faire atterrir une sonde
 */

import {
  Game,
  ActionType,
  ValidationResult
} from '../core/types';
import { BaseAction } from './Action';
import { ProbeSystem } from '../systems/ProbeSystem';

export class LandAction extends BaseAction {
  constructor(
    playerId: string,
    public probeId: string
  ) {
    super(ActionType.LAND, playerId);
  }

  validate(game: Game): ValidationResult {
    const validation = ProbeSystem.canLand(game, this.playerId, this.probeId);
    
    if (!validation.canLand) {
      return this.createInvalidResult(validation.reason || 'Atterrissage impossible');
    }

    return this.createValidResult();
  }

  execute(game: Game): Game {
    const result = ProbeSystem.landProbe(game, this.playerId, this.probeId);
    return result.updatedGame;
  }
}

