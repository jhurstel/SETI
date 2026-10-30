import { ScanSystem } from '../src/systems/ScanSystem';
import { createRotationState, getObjectPosition } from '../src/core/SolarSystemPosition';
import { Game, Mission, SectorType } from '../src/core/types';
import { createTestGame, getPlayer } from './helpers/gameFixture';

const P1 = 'player_0';
const P2 = 'player_1';

/** Mission « déclenchable » du joueur, avec son buff permanent */
function addTriggeredMission(game: Game, buffType: string): void {
  const player = getPlayer(game, P1);
  player.missions.push({ id: 'm', cardId: 'c', name: 'Mission test', description: '', ownerId: P1, requirements: [{ id: 'r', type: buffType, value: `${buffType}:pv:1` }], completedRequirementIds: [], fulfillableRequirementIds: [], completed: false } as Mission);
  player.permanentBuffs.push({ type: buffType, value: `${buffType}:pv:1`, id: 'r', source: 'Mission test' });
}

describe('Scan et couverture de secteur : cas limites', () => {
  let game: Game;

  beforeEach(async () => {
    game = await createTestGame();
    game.currentPlayerIndex = 0;
  });

  /** Marque tous les signaux d'un secteur : les premiers pour P1, `others` derniers pour P2 */
  const fill = (sectorIndex: number, others = 0) => {
    const sector = game.board.sectors[sectorIndex];
    sector.signals.forEach((s, i) => Object.assign(s, { marked: true, markedBy: i >= sector.signals.length - others ? P2 : P1 }));
    return sector;
  };

  test('refus : joueur inconnu, scan sans crédits, secteur inconnu', () => {
    expect(ScanSystem.canScanSector(game, 'inconnu').reason).toBe('Joueur introuvable');
    getPlayer(game, P1).credits = 0;
    expect(() => ScanSystem.scanSector(game, P1, game.board.sectors[0].id)).toThrow();
    expect(ScanSystem.scanSector(game, P1, 'inconnu', false).logs).toEqual([]);
  });

  test('couverture sans joueur, secteur ou signal : rien', () => {
    const sector = game.board.sectors[0];
    expect(ScanSystem.coverSector(game, 'inconnu', sector.id).logs).toEqual([]);
    expect(ScanSystem.coverSector(game, P1, 'inconnu').logs).toEqual([]);
    expect(ScanSystem.coverSector(game, P1, sector.id).logs).toEqual([]);
  });

  test('couverture : chaque joueur présent gagne 1 Média, le gagnant le bonus de sa carte (consommé)', () => {
    const sector = fill(0, 1);
    game.players.forEach(p => { p.mediaCoverage = 0; });
    getPlayer(game, P1).activeBuffs.push(
      { type: 'BONUS_IF_COVERED', target: 'energy', value: 1, source: 'Carte 45' },
      { type: 'BONUS_IF_COVERED', target: 'draw', value: 1, source: 'Carte 46' },
      { type: 'BONUS_IF_COVERED', target: 'data', value: 2, source: 'Carte 47' },
    );
    const before = JSON.stringify(game);

    const res = ScanSystem.coverSector(game, P1, sector.id);

    expect(res.winnerId).toBe(P1);
    expect(res.bonuses).toEqual(expect.objectContaining({ energy: 1, card: 1, data: 2 }));
    expect(res.updatedGame.players.map(p => p.mediaCoverage)).toEqual([1, 1]);
    expect(res.sharedLogs?.[0]).toContain('les joueurs présents');
    expect(getPlayer(res.updatedGame, P1).activeBuffs.some(b => b.type === 'BONUS_IF_COVERED')).toBe(false);
    expect(res.updatedGame.board.sectors[0].coveredBy).toEqual([P1]);
    expect(ScanSystem.getCoveredSectorCount(res.updatedGame, P1)).toBe(1);
    expect(ScanSystem.getCoveredSectors(res.updatedGame, P2)).toEqual([]);
    expect(JSON.stringify(game)).toBe(before);
  });

  test('couverture par un adversaire : le bonus de carte du gagnant ne profite pas au joueur qui scanne', () => {
    const sector = game.board.sectors[1];
    sector.signals.forEach(s => Object.assign(s, { marked: true, markedBy: P2 }));
    getPlayer(game, P2).activeBuffs.push({ type: 'BONUS_IF_COVERED', target: 'energy', value: 1, source: 'Carte 45' });

    const res = ScanSystem.coverSector(game, P1, sector.id);

    expect(res.winnerId).toBe(P2);
    expect(res.bonuses.energy).toBeUndefined();
    expect(res.sharedLogs?.[0]).toContain('le joueur présent');
  });

  test('mission « signal rouge » : signalée comme à recouvrir', () => {
    addTriggeredMission(game, 'GAIN_ON_RED_SIGNAL');
    const red = game.board.sectors.find(s => s.color === SectorType.RED)!;

    const res = ScanSystem.performSignalAndCover(game, P1, red.id, [], false, 's');

    expect(res.historyEntries.some(e => e.message === 'déclenche une mission à recouvrir')).toBe(true);
  });

  describe('validateScanSectorSelection', () => {
    test('secteur inconnu', () => {
      expect(ScanSystem.validateScanSectorSelection(game, P1, { type: 'SELECTING_SCAN_SECTOR', color: SectorType.RED }, 'inconnu'))
        .toEqual({ valid: false, error: 'Secteur introuvable' });
    });

    test('secteur d\'une planète : seulement celui où elle se trouve', () => {
      const s = game.board.solarSystem;
      const r = createRotationState(s.rotationAngleLevel1 || 0, s.rotationAngleLevel2 || 0, s.rotationAngleLevel3 || 0);
      const mars = getObjectPosition('mars', r.level1Angle, r.level2Angle, r.level3Angle, s.extraCelestialObjects)!;
      const scan = { type: 'SELECTING_SCAN_SECTOR' as const, color: SectorType.MARS };
      const marsSector = `sector_${mars.absoluteSector}`;
      const other = game.board.sectors.find(sec => sec.id !== marsSector)!.id;

      expect(ScanSystem.validateScanSectorSelection(game, P1, scan, marsSector).valid).toBe(true);
      expect(ScanSystem.validateScanSectorSelection(game, P1, scan, other).valid).toBe(false);
    });
  });
});
