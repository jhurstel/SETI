import { Game, ActionType, ValidationResult } from '../core/types';
import { BaseAction } from './Action';
import { ProbeSystem } from '../systems/ProbeSystem';

export class LaunchProbeAction extends BaseAction {
  constructor(playerId: string) {
    super(playerId, ActionType.LAUNCH_PROBE);
  }

  validate(game: Game): ValidationResult {
    const check = ProbeSystem.canLaunchProbe(game, this.playerId);
    if (!check.canLaunch) return { valid: false, errors: [{ code: 'CANNOT_LAUNCH', message: check.reason || 'Lancement impossible' }], warnings: [] };
    return { valid: true, errors: [], warnings: [] };
  }

  execute(game: Game): Game {
    const result = ProbeSystem.launchProbe(game, this.playerId);
    this.historyEntries = result.historyEntries;
    return result.updatedGame;
  }
}
