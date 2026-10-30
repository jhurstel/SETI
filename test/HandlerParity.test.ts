import { AIController } from '../src/ai/AIController';
import { AIBehavior } from '../src/ai/AIBehavior';
import { createRotationState, getAbsoluteSectorForProbe, getCell } from '../src/core/SolarSystemPosition';
import { ActionType, DiskName, Game, Probe, ProbeState, SectorNumber, SectorType } from '../src/core/types';
import { createTestGame, getPlayer } from './helpers/gameFixture';

const P1 = 'player_0';

const probeAt = (id: string, disk: DiskName, sector: SectorNumber, level: number): Probe => ({
  id, ownerId: P1, position: { x: 0, y: 0 }, solarPosition: { disk, sector, level }, state: ProbeState.IN_SOLAR_SYSTEM, isOrbiter: false, isLander: false,
});

/** Sondes du joueur sur le plateau (Mars : disque B, secteur 1, niveau 2) */
function placeProbes(game: Game, probes: Probe[]): void {
  getPlayer(game, P1).probes = probes;
  game.board.solarSystem.probes = [...probes];
}

describe('Même règle pour le joueur humain et les robots', () => {
  let game: Game;

  beforeEach(async () => {
    game = await createTestGame();
    game.currentPlayerIndex = 0;
  });

  test('robot : une orbite bonus ×2 place deux orbiteurs (régression : count ignoré)', () => {
    placeProbes(game, [probeAt('p1', 'B', 1, 2), probeAt('p2', 'B', 1, 2)]);

    const res = AIController.processInteractionQueue(game, [{ type: 'ORBITING_PROBE', count: 2, sequenceId: 's' }], 's', getPlayer(game, P1));

    const mars = res.updatedGame.board.planets.find(p => p.id === 'mars')!;
    expect(mars.orbiters.filter(o => o.ownerId === P1)).toHaveLength(2);
  });

  test('robot : une sonde ne sert qu\'une fois pour les signaux « secteur d\'une sonde » d\'une même action', () => {
    placeProbes(game, [probeAt('p1', 'B', 1, 2)]);
    const scan = { type: 'SELECTING_SCAN_SECTOR' as const, color: SectorType.PROBE, onlyProbes: true, sequenceId: 's' };
    const before = game.board.sectors.reduce((n, s) => n + s.signals.filter(sig => sig.markedBy === P1).length, 0);

    const res = AIController.processInteractionQueue(game, [scan, { ...scan }], 's', getPlayer(game, P1));

    const after = res.updatedGame.board.sectors.reduce((n, s) => n + s.signals.filter(sig => sig.markedBy === P1).length, 0);
    expect(after - before).toBe(1);
  });
  test('robot : 2 déplacements gratuits suffisent pour quitter un champ d\'astéroïdes sans énergie (régression : 1 seul utilisé)', () => {
    const solar = game.board.solarSystem;
    const rotation = createRotationState(solar.rotationAngleLevel1 || 0, solar.rotationAngleLevel2 || 0, solar.rotationAngleLevel3 || 0);
    let asteroid: Probe | undefined;
    for (const disk of ['A', 'B', 'C', 'D', 'E'] as DiskName[]) {
      for (let sector = 1; sector <= 8 && !asteroid; sector++) {
        const probe = probeAt('p1', disk, sector as SectorNumber, 0);
        if (getCell(disk, getAbsoluteSectorForProbe(probe.solarPosition, rotation), rotation, solar.extraCelestialObjects)?.hasAsteroid) asteroid = probe;
      }
    }
    placeProbes(game, [asteroid!]);
    getPlayer(game, P1).energy = 0;

    const res = AIController.processInteractionQueue(game, [{ type: 'MOVING_PROBE', count: 2, sequenceId: 's' }], 's', getPlayer(game, P1));

    const moved = getPlayer(res.updatedGame, P1).probes[0].solarPosition;
    expect(moved).not.toEqual(asteroid!.solarPosition);
    expect(getPlayer(res.updatedGame, P1).energy).toBe(0);
  });

  test('robot : la recherche propose le dessus de chaque pile, pas seulement la première pile de chaque catégorie', () => {
    const player = getPlayer(game, P1);
    Object.assign(player, { mediaCoverage: 10, credits: 10, energy: 10 });
    const exploration1 = game.board.technologyBoard.categorySlots![0].technologies.find(t => t.id.startsWith('exploration-1'))!;
    player.technologies.push(exploration1);

    const researched = AIBehavior.listMainActions(game, player)
      .filter(d => d.action === ActionType.RESEARCH_TECH)
      .map(d => (d.data as { tech: { id: string } }).tech.id.replace(/-\d+$/, ''));

    expect(researched).toEqual(expect.arrayContaining(['exploration-2', 'exploration-3', 'exploration-4', 'observation-1', 'observation-4', 'computing-4']));
    expect(researched).not.toContain('exploration-1');
  });
});
