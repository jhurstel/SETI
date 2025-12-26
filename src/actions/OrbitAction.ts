/**
 * Action : Mettre une sonde en orbite
 */

import {
  Game,
  ActionType,
  ValidationResult
} from '../core/types';
import { BaseAction } from './Action';
import { ProbeSystem } from '../systems/ProbeSystem';

export class OrbitAction extends BaseAction {
  constructor(
    playerId: string,
    public probeId: string
  ) {
    super(ActionType.ORBIT, playerId);
  }

  validate(game: Game): ValidationResult {
    const validation = ProbeSystem.canOrbit(game, this.playerId, this.probeId);
    
    if (!validation.canOrbit) {
      return this.createInvalidResult(validation.reason || 'Mise en orbite impossible');
    }

    return this.createValidResult();
  }

  execute(game: Game): Game {
    const result = ProbeSystem.orbitProbe(game, this.playerId, this.probeId);
    return result.updatedGame;
  }
}

