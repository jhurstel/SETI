import { splitSlotBonuses } from '../src/ui/components/bonusLayout';
import { createTestGame } from './helpers/gameFixture';

describe('cases d\'orbite et d\'atterrissage : gain commun affiché une fois, gain propre dans la case', () => {
  test('Neptune (orbite) : 3 PV dans la 1re case, le reste commun', async () => {
    const game = await createTestGame();
    const neptune = game.board.planets.find(p => p.id === 'neptune')!;
    const { common, specific } = splitSlotBonuses(neptune.orbitSlots);
    expect(common).toEqual(neptune.orbitNextBonus);
    expect(specific[0]).toEqual({ pv: 3 });
    expect(specific.slice(1).every(s => Object.keys(s).length === 0)).toBe(true);
  });

  test('Mars (atterrissage) : 2 puis 1 donnée pour les premiers atterrisseurs, 6 PV et la trace jaune communs', async () => {
    const game = await createTestGame();
    const mars = game.board.planets.find(p => p.id === 'mars')!;
    const { common, specific } = splitSlotBonuses(mars.landSlots);
    expect(common).toEqual(mars.landNextBonus);
    expect(specific.map(s => s.data ?? 0)).toEqual([2, 1, 0, 0]);
    expect(specific.every(s => s.pv === undefined)).toBe(true);
  });

  test('une case seule garde tout ; des traces différentes ne sont pas communes', () => {
    expect(splitSlotBonuses([{ pv: 5, data: 1 }])).toEqual({ common: {}, specific: [{ pv: 5, data: 1 }] });
    const split = splitSlotBonuses([{ pv: 4, media: 1 }, { pv: 2 }]);
    expect(split.common).toEqual({ pv: 2 });
    expect(split.specific).toEqual([{ pv: 2, media: 1 }, {}]);
  });
});
