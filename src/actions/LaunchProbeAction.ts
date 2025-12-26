/**
 * Action : Lancer une sonde
 */

import {
  Game,
  ActionType,
  ValidationResult
} from '../core/types';
import { BaseAction } from './Action';
import { ProbeSystem } from '../systems/ProbeSystem';

export class LaunchProbeAction extends BaseAction {
  constructor(playerId: string) {
    super(ActionType.LAUNCH_PROBE, playerId);
  }

  validate(game: Game): ValidationResult {
    const validation = ProbeSystem.canLaunchProbe(game, this.playerId);
    
    if (!validation.canLaunch) {
      return this.createInvalidResult(validation.reason || 'Impossible de lancer une sonde');
    }

    return this.createValidResult();
  }

  execute(game: Game): Game {
    const result = ProbeSystem.launchProbe(game, this.playerId);
    return result.updatedGame;
  }
}

