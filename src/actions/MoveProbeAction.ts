import { Game, ActionType, ValidationResult, DiskName, SectorNumber } from '../core/types';
import { BaseAction } from './Action';
import { ProbeSystem } from '../systems/ProbeSystem';
import { createRotationState, getCell, rotateSector } from '../core/SolarSystemPosition';

export class MoveProbeAction extends BaseAction {
  public executionMessage: string = "";

  constructor(
    playerId: string,
    public probeId: string,
    public targetPosition: { disk: DiskName; sector: SectorNumber },
    public useFreeMovement: boolean = false
  ) {
    super(playerId, ActionType.MOVE_PROBE);
  }

  validate(game: Game): ValidationResult {
    const cost = this.calculateCost(game);
    
    // Si on utilise le mouvement gratuit, on déduit 1 du coût
    const finalCost = this.useFreeMovement ? Math.max(0, cost - 1) : cost;

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
    const cost = this.calculateCost(game);
    const finalCost = this.useFreeMovement ? Math.max(0, cost - 1) : cost;

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

  /**
   * Calcule le coût du déplacement en tenant compte des astéroïdes et technologies
   */
  private calculateCost(game: Game): number {
    const player = game.players.find(p => p.id === this.playerId);
    const probe = player?.probes.find(p => p.id === this.probeId);
    
    if (!player || !probe || !probe.solarPosition) return 1; // Fallback

    const rotationState = createRotationState(
      game.board.solarSystem.rotationAngleLevel1 || 0,
      game.board.solarSystem.rotationAngleLevel2 || 0,
      game.board.solarSystem.rotationAngleLevel3 || 0
    );

    // Calculer le secteur absolu de la sonde pour vérifier la case réelle
    let absoluteSector = probe.solarPosition.sector;
    const level = probe.solarPosition.level;
    
    if (level === 1) {
      absoluteSector = rotateSector(probe.solarPosition.sector, rotationState.level1Angle);
    } else if (level === 2) {
      absoluteSector = rotateSector(probe.solarPosition.sector, rotationState.level2Angle);
    } else if (level === 3) {
      absoluteSector = rotateSector(probe.solarPosition.sector, rotationState.level3Angle);
    }

    // On regarde la case de départ (où se trouve la sonde actuellement)
    const currentCell = getCell(probe.solarPosition.disk, absoluteSector, rotationState);
    
    let stepCost = 1;
    
    // Malus si on sort d'un champ d'astéroïdes
    if (currentCell?.hasAsteroid) {
      const hasExploration2 = player.technologies.some(t => t.id.startsWith('exploration-2'));
      if (!hasExploration2) {
        stepCost += 1;
      }
    }
    
    return stepCost;
  }
}
