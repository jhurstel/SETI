import { ResourceSystem } from '../src/systems/ResourceSystem';
import { ScanSystem } from '../src/systems/ScanSystem';
import { CardSystem } from '../src/systems/CardSystem';
import { anomalySectors, nextAnomaly } from '../src/core/anomalies';
import { createRotationState, getObjectPosition } from '../src/core/SolarSystemPosition';
import { Bonus, Game, LifeTraceType, SectorNumber, SectorType } from '../src/core/types';
import { createTestGame, getPlayer } from './helpers/gameFixture';

const P1 = 'player_0';

/** Anomalies posées à `offset` secteurs de la Terre (niveau 0 : elles ne tournent pas) ; renvoie le secteur de la Terre */
function addAnomalies(game: Game, offsets: number[]): number {
  const solar = game.board.solarSystem;
  const rotation = createRotationState(solar.rotationAngleLevel1 || 0, solar.rotationAngleLevel2 || 0, solar.rotationAngleLevel3 || 0);
  const earth = getObjectPosition('earth', rotation.level1Angle, rotation.level2Angle, rotation.level3Angle, solar.extraCelestialObjects)!;
  solar.extraCelestialObjects = offsets.map((offset, i) => ({
    id: `anomaly-${i}`, type: 'anomaly' as const, name: 'Anomalie', level: 0 as const,
    position: { disk: 'D' as const, sector: (((earth.absoluteSector - 1 + offset) % 8) + 1) as SectorNumber, x: 0, y: 0 },
    anomalyData: { color: LifeTraceType.RED, side: 'head' as const, bonus: { pv: 1 } as Bonus },
  }));
  return earth.absoluteSector;
}

const sectorAt = (earth: number, offset: number) => `sector_${((earth - 1 + offset) % 8) + 1}`;
const myMarks = (game: Game, sectorId: string) => game.board.sectors.find(s => s.id === sectorId)!.signals.filter(s => s.markedBy === P1).length;

describe('Signaux Anomalie', () => {
  let game: Game;

  beforeEach(async () => {
    game = await createTestGame();
    game.currentPlayerIndex = 0;
  });

  test('prochaine anomalie : la première dans le sens des secteurs à partir de la Terre, celle de la Terre en dernier', () => {
    const earth = addAnomalies(game, [0, 5, 2]);
    expect(nextAnomaly(game)?.id).toBe('anomaly-2');
    expect([...anomalySectors(game)].sort()).toEqual([earth, Number(sectorAt(earth, 5).slice(7)), Number(sectorAt(earth, 2).slice(7))].sort());
    // Aucune anomalie en jeu (espèce non découverte)
    game.board.solarSystem.extraCelestialObjects = [];
    expect(nextAnomaly(game)).toBeUndefined();
  });

  test('signal « prochaine anomalie » (ET.14) : posé directement dans son secteur, sans choix', () => {
    const earth = addAnomalies(game, [0, 5, 2]);
    const target = sectorAt(earth, 2);
    const before = JSON.stringify(game);

    const res = ResourceSystem.processBonuses({ signals: [{ amount: 1, scope: SectorType.NEXT_ANOMALY }] }, game, P1, 'ET.14', 'seq');

    expect(myMarks(res.updatedGame, target)).toBe(myMarks(game, target) + 1);
    expect(res.newPendingInteractions.some(i => i.type === 'SELECTING_SCAN_SECTOR')).toBe(false);
    expect(JSON.stringify(game)).toBe(before);
  });

  test('ET.14 jouée : un scan et un signal dans le secteur de la prochaine anomalie', () => {
    const earth = addAnomalies(game, [3, 6]);
    // Cartes Alien : dans la pioche de leur espèce
    const deck = game.species.find(s => s.cards.some(c => c.id === 'ET.14'))!.cards;
    const card = deck.splice(deck.findIndex(c => c.id === 'ET.14'), 1)[0];
    getPlayer(game, P1).cards.push(card);
    expect(card.immediateEffects).toContainEqual(expect.objectContaining({ target: 'SIGNAL', value: expect.objectContaining({ scope: SectorType.NEXT_ANOMALY }) }));
    getPlayer(game, P1).credits = 10;
    const target = sectorAt(earth, 3);

    const res = CardSystem.playCard(game, P1, card.id);

    expect(myMarks(res.updatedGame, target)).toBe(myMarks(game, target) + 1);
  });

  test('signal « secteur d\'une anomalie » : tout secteur qui contient une anomalie, quelle que soit sa couleur', () => {
    const earth = addAnomalies(game, [1, 4]);
    const interaction = { type: 'SELECTING_SCAN_SECTOR' as const, color: SectorType.ANOMALY };
    for (const offset of [1, 4]) {
      expect(ScanSystem.validateScanSectorSelection(game, P1, interaction, sectorAt(earth, offset))).toEqual({ valid: true });
    }
    // Régression : la couleur du secteur était comparée à « Anomalie » (« Couleur incorrecte » partout)
    const refused = ScanSystem.validateScanSectorSelection(game, P1, interaction, sectorAt(earth, 2));
    expect(refused.valid).toBe(false);
    expect(refused.error).toBe('Sélectionnez un secteur qui contient une anomalie.');
  });
});
