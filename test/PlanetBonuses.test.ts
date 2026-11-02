import { ResourceSystem } from '../src/systems/ResourceSystem';
import { createTestGame } from './helpers/gameFixture';

describe('gains des lunes (livret p. 11)', () => {
  test('Jupiter : Io, Europe, Ganymède, Callisto (régression : Callisto donne 13 PV, pas 1)', async () => {
    const game = await createTestGame();
    const moons = Object.fromEntries(game.board.planets.find(p => p.id === 'jupiter')!.satellites!.map(s => [s.id, s.landBonus]));
    expect(moons.io).toMatchObject({ pv: 10, energy: 4 });
    expect(moons.europa).toMatchObject({ pv: 7 });
    expect(moons.ganymede).toMatchObject({ pv: 12, media: 5 });
    expect(moons.callisto).toEqual({ pv: 13, data: 4 });
  });

  test('Phobos et Déimos (Mars) : 8 PV et 2 réservations, à choisir parmi les cartes en main', async () => {
    const game = await createTestGame();
    const phobos = game.board.planets.find(p => p.id === 'mars')!.satellites!.find(s => s.id === 'phobosdeimos')!;
    expect(phobos.landBonus).toEqual({ pv: 8, revenue: 2 });
    const res = ResourceSystem.processBonuses(phobos.landBonus, game, 'player_0', 'phobosdeimos', 's');
    expect(res.newPendingInteractions).toEqual([expect.objectContaining({ type: 'RESERVING_CARD', count: 2 })]);
  });
});
