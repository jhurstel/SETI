import { Game, GamePhase, InteractionState, SectorType } from '../../core/types';
import { calculateAbsolutePosition, createRotationState, getObjectPosition } from '../../core/SolarSystemPosition';
import { ScanSystem } from '../../systems/ScanSystem';

/**
 * Secteurs à mettre en surbrillance (flash vert) : ceux où le joueur peut marquer le signal demandé, ou, au début du
 * tour, le secteur de la Terre (et ses voisins avec Observation I) ; Oumuamua avec le secteur où il se trouve.
 */
export function highlightedSectors(game: Game, interactionState: InteractionState): string[] {
  const currentPlayer = game.players[game.currentPlayerIndex];
  let sectors: string[] = [];

  if (interactionState.type === 'SELECTING_SCAN_SECTOR') {
    if (interactionState.onlyProbes) {
      // Secteurs d'une sonde encore utilisable (carte 30), ou secteur imposé des signaux suivants (28, 88, 118)
      sectors = game.board.sectors
        .filter(s => ScanSystem.validateScanSectorSelection(game, currentPlayer.id, interactionState, s.id).valid)
        .map(s => s.id);
    } else if (interactionState.adjacents) {
      const rotationState = createRotationState(
        game.board.solarSystem.rotationAngleLevel1 || 0,
        game.board.solarSystem.rotationAngleLevel2 || 0,
        game.board.solarSystem.rotationAngleLevel3 || 0
      );
      const earthPos = getObjectPosition('earth', rotationState.level1Angle, rotationState.level2Angle, rotationState.level3Angle, game.board.solarSystem.extraCelestialObjects);
      if (earthPos) {
        sectors = game.board.sectors.filter(s => Math.abs(parseInt(s.id.split('_')[1]) - earthPos.absoluteSector) <= 1 || Math.abs(parseInt(s.id.split('_')[1]) - earthPos.absoluteSector) === 7).map(s => s.id);
      }
    } else if (interactionState.color === SectorType.ANY) {
      sectors = game.board.sectors.map(s => s.id);
    } else if (interactionState.color === SectorType.OUMUAMUA) {
      sectors.push('oumuamua');
      const oumuamua = (game.board.solarSystem.extraCelestialObjects || []).find(o => o.id === 'oumuamua');
      if (oumuamua) {
        const rotationState = createRotationState(
          game.board.solarSystem.rotationAngleLevel1 || 0,
          game.board.solarSystem.rotationAngleLevel2 || 0,
          game.board.solarSystem.rotationAngleLevel3 || 0
        );
        const absPos = calculateAbsolutePosition(oumuamua, rotationState, game.board.solarSystem.extraCelestialObjects);
        sectors.push(`sector_${absPos.absoluteSector}`);
      } 
    } else if (interactionState.color === SectorType.ANOMALY) {
      const anomalies = (game.board.solarSystem.extraCelestialObjects || []).filter(o => o.type === 'anomaly');
      const anomalySectors = new Set<number>();
      anomalies.forEach(a => {
          const rotationState = createRotationState(
            game.board.solarSystem.rotationAngleLevel1 || 0,
            game.board.solarSystem.rotationAngleLevel2 || 0,
            game.board.solarSystem.rotationAngleLevel3 || 0
          );
          const aPos = calculateAbsolutePosition(a, rotationState, game.board.solarSystem.extraCelestialObjects);
          anomalySectors.add(aPos.absoluteSector);
      });
      sectors = game.board.sectors.filter(s => anomalySectors.has(parseInt(s.id.split('_')[1]))).map(s => s.id);
    } else {
      sectors = game.board.sectors.filter(s => s.color === interactionState.color).map(s => s.id);
    }
  } else if (interactionState.type === 'IDLE' && !currentPlayer.hasPerformedMainAction && game.phase !== GamePhase.SETUP) {
    // Earth sector
    const earthPos = getObjectPosition('earth', game.board.solarSystem.rotationAngleLevel1 || 0, game.board.solarSystem.rotationAngleLevel2 || 0, game.board.solarSystem.rotationAngleLevel3 || 0, game.board.solarSystem.extraCelestialObjects);
    if (earthPos) {
      sectors = [`sector_${earthPos.absoluteSector}`];

      const currentPlayer = game.players[game.currentPlayerIndex];
      const hasObs1 = currentPlayer.technologies.some(t => t.id.startsWith('observation-1'));

      if (hasObs1) {
        const prev = earthPos.absoluteSector === 1 ? 8 : earthPos.absoluteSector - 1;
        const next = earthPos.absoluteSector === 8 ? 1 : earthPos.absoluteSector + 1;
        sectors.push(`sector_${prev}`);
        sectors.push(`sector_${next}`);
      }
    }
  }

  // Check Oumuamua
  if (sectors.length > 0) {
    const oumuamua = (game.board.solarSystem.extraCelestialObjects || []).find(o => o.id === 'oumuamua');
    if (oumuamua) {
      const rotationState = createRotationState(
        game.board.solarSystem.rotationAngleLevel1 || 0,
        game.board.solarSystem.rotationAngleLevel2 || 0,
        game.board.solarSystem.rotationAngleLevel3 || 0
      );
      const absPos = calculateAbsolutePosition(oumuamua, rotationState, game.board.solarSystem.extraCelestialObjects);
      if (sectors.includes(`sector_${absPos.absoluteSector}`)) {
        sectors.push('oumuamua');
      }
    }
  }

  return sectors;
}
