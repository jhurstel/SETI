import { TechnologySystem } from '../src/systems/TechnologySystem';
import { ScanSystem } from '../src/systems/ScanSystem';
import { Game, Probe, ProbeState, Technology, TechnologyCategory } from '../src/core/types';
import { createTestGame, getPlayer } from './helpers/gameFixture';

const P1 = 'player_0';

const probeInSystem = (id: string): Probe => ({ id, ownerId: P1, position: { x: 0, y: 0 }, solarPosition: { disk: 'B', sector: 1, level: 0 }, state: ProbeState.IN_SOLAR_SYSTEM, isOrbiter: false, isLander: false });

describe('technologies et scan : cas limites', () => {
  let game: Game;
  let logSpy: jest.SpyInstance;

  beforeEach(async () => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    game = await createTestGame();
    game.currentPlayerIndex = 0;
  });
  afterEach(() => logSpy.mockRestore());

  test('Exploration I avec déjà 2 sondes dans le système : la sonde gagnée est perdue', () => {
    const probes = [probeInSystem('a'), probeInSystem('b')];
    getPlayer(game, P1).probes = probes;
    game.board.solarSystem.probes = [...probes];
    const tech = TechnologySystem.acquirableTechs(game, P1, { categories: [TechnologyCategory.EXPLORATION] }).find(t => t.id.startsWith('exploration-1'))!;
    expect(tech.bonus.probe).toBe(1);

    const res = TechnologySystem.acquireTechnology(game, P1, tech);
    expect(res.historyEntries[0].message).toContain('1 Sonde (Perdue: Limite atteinte)');
    expect(getPlayer(res.updatedGame, P1).probes).toHaveLength(2);
  });

  test('Observation IV sans énergie ni sonde dans le système : rien n\'est proposé', () => {
    const player = getPlayer(game, P1);
    player.technologies.push({ id: 'observation-4-test', name: 'IV', type: TechnologyCategory.OBSERVATION, effects: [], bonus: {} } as unknown as Technology);
    player.energy = 0;
    player.probes = [];

    const res = ScanSystem.performScanAction(game, true, 'seq', 'sector_1');
    expect(res.historyEntries.map(e => e.message)).toContain('ne peut pas utiliser Observation IV (conditions non remplies)');
    expect(res.newPendingInteractions.some(i => i.type === 'CHOOSING_OBS4_ACTION')).toBe(false);
  });

  test('Observation IV avec une sonde dans le système : le choix est proposé', () => {
    const player = getPlayer(game, P1);
    player.technologies.push({ id: 'observation-4-test', name: 'IV', type: TechnologyCategory.OBSERVATION, effects: [], bonus: {} } as unknown as Technology);
    player.energy = 0;
    player.probes = [probeInSystem('a')];

    const res = ScanSystem.performScanAction(game, true, 'seq', 'sector_1');
    expect(res.newPendingInteractions).toContainEqual({ type: 'CHOOSING_OBS4_ACTION', sequenceId: 'seq' });
  });
});
