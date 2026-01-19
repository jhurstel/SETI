/**
 * Action : Scanner un secteur
 */

import {
  Game,
  ActionType,
  ValidationResult
} from '../core/types';
import { BaseAction } from './Action';
import { SectorSystem } from '../systems/SectorSystem';

export class ScanSectorAction extends BaseAction {
  constructor(
    playerId: string,
    public sectorId: string,
    public signalIds: string[] // Au moins 2 signaux à marquer
  ) {
    super(ActionType.SCAN_SECTOR, playerId);
  }

  validate(game: Game): ValidationResult {
    if (this.signalIds.length < 2) {
      return this.createInvalidResult('Au moins 2 signaux doivent être marqués');
    }

    const validation = SectorSystem.canScanSector(
      game,
      this.playerId
    );
    
    if (!validation.canScan) {
      return this.createInvalidResult(validation.reason || 'Scan impossible');
    }

    return this.createValidResult();
  }

  execute(game: Game): Game {
    const result = SectorSystem.scanSector(
      game,
      this.playerId,
      this.sectorId,
      this.signalIds
    );
    return result.updatedGame;
  }
}

