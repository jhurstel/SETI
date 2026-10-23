import { DataLoader } from '../src/core/DataLoader';
import { CardType, CostType, FreeActionType, RevenueType, SectorType } from '../src/core/types';
import { mockFetchFromPublic } from './helpers/gameFixture';

const CARD_FILES: [string, number][] = [
  ['main', 138],
  ['mascamites', 10],
  ['anomalies', 10],
  ['oumuamua', 10],
  ['centauriens', 10],
  ['exertiens', 15],
];

describe('DataLoader', () => {
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    fetchSpy = mockFetchFromPublic();
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  describe.each(CARD_FILES)('cards/%s.csv', (file, expectedCount) => {
    test(`charge ${expectedCount} cartes aux identifiants uniques`, async () => {
      const cards = await DataLoader.loadCards(`cards/${file}.csv`);
      expect(cards).toHaveLength(expectedCount);
      expect(new Set(cards.map(c => c.id)).size).toBe(expectedCount);
    });

    test('l\'en-tête (précédé d\'un BOM) n\'est pas lu comme une carte', async () => {
      const cards = await DataLoader.loadCards(`cards/${file}.csv`);
      expect(cards.some(c => /id/i.test(c.id))).toBe(false);
    });
  });

  test('toutes les cartes de base ont un type, une action gratuite, une couleur et un revenu', async () => {
    const cards = await DataLoader.loadCards('cards/main.csv');
    const undefinedFields = cards.filter(c =>
      c.type === CardType.UNDEFINED ||
      c.freeAction === FreeActionType.UNDEFINED ||
      c.scanSector === SectorType.UNDEFINED ||
      c.revenue === RevenueType.UNDEFINED
    );
    expect(undefinedFields.map(c => c.id)).toEqual([]);
  });

  test('parse une mission déclenchable (Pioneer 11)', async () => {
    const card = (await DataLoader.loadCards('cards/main.csv')).find(c => c.id === '1')!;
    expect(card).toMatchObject({
      name: 'Mission Pioneer 11',
      type: CardType.TRIGGERED_MISSION,
      cost: 0,
      costType: CostType.CREDIT,
      freeAction: FreeActionType.MOVEMENT,
      scanSector: SectorType.YELLOW,
      revenue: RevenueType.ENERGY,
    });
    expect(card.permanentEffects.map(e => e.type)).toEqual(['GAIN_ON_VISIT_JUPITER', 'GAIN_ON_VISIT_SATURN']);
  });

  test('parse les gains multiples et un effet passif (Falcon Heavy)', async () => {
    const card = (await DataLoader.loadCards('cards/main.csv')).find(c => c.id === '9')!;
    expect(card.cost).toBe(3);
    expect(card.immediateEffects).toEqual([
      { type: 'GAIN', target: 'PROBE', value: 2 },
      { type: 'GAIN', target: 'MEDIA', value: 1 },
    ]);
    expect(card.passiveEffects).toEqual([{ type: 'IGNORE_PROBE_LIMIT', value: true }]);
  });

  test('parse un bonus de visite (Survol de Mercure)', async () => {
    const card = (await DataLoader.loadCards('cards/main.csv')).find(c => c.id === '20')!;
    expect(card.immediateEffects).toEqual([{ type: 'ACTION', target: 'MOVEMENT', value: 2 }]);
    expect(card.passiveEffects).toEqual([{ type: 'VISIT_BONUS', target: 'mercury', value: 4 }]);
  });

  test('fichier introuvable : renvoie une liste vide', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(DataLoader.loadCards('cards/inexistant.csv')).resolves.toEqual([]);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
