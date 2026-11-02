import { ProbeSystem } from '../src/systems/ProbeSystem';
import { ScanSystem } from '../src/systems/ScanSystem';
import { SpeciesSystem } from '../src/systems/SpeciesSystem';
import { AlienBoardType, Game, Probe, ProbeState, SectorType } from '../src/core/types';
import { createTestGame, getPlayer } from './helpers/gameFixture';

const P1 = 'player_0';
const P2 = 'player_1';

/** Sonde de P1 sur la case d'Oumuamua (C3, anneau 1, plateau non tourné) */
function probeOnOumuamua(game: Game): Probe {
  const probe: Probe = { id: 'p-oum', ownerId: P1, position: { x: 0, y: 0 }, solarPosition: { disk: 'C', sector: 3, level: 1 }, state: ProbeState.IN_SOLAR_SYSTEM, isOrbiter: false, isLander: false };
  getPlayer(game, P1).probes = [probe];
  game.board.solarSystem.probes = [probe];
  return probe;
}

const oumuamuaPlanet = (game: Game) => game.species.find(s => s.name === AlienBoardType.OUMUAMUA)!.planet!;

describe('Oumuamua', () => {
  let game: Game;
  let logSpy: jest.SpyInstance;

  beforeEach(async () => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    game = await createTestGame();
    game.currentPlayerIndex = 0;
    const solarSystem = game.board.solarSystem;
    solarSystem.rotationAngleLevel1 = 0;
    solarSystem.rotationAngleLevel2 = 0;
    solarSystem.rotationAngleLevel3 = 0;
    game.board.alienBoards[0].speciesId = AlienBoardType.OUMUAMUA;
    SpeciesSystem['discoverSpecies'](game, 0);
    const player = getPlayer(game, P1);
    player.credits = 10;
    player.energy = 10;
    player.tokens = 0;
  });
  afterEach(() => logSpy.mockRestore());

  test('la découverte place Oumuamua dans le système solaire, en C3', () => {
    expect(game.board.solarSystem.extraCelestialObjects).toContainEqual(expect.objectContaining({ id: 'oumuamua', position: expect.objectContaining({ disk: 'C', sector: 3 }) }));
  });

  describe('planète', () => {
    test('orbite : la sonde sur Oumuamua peut s\'y mettre en orbite ; premier orbiteur : 10 PV, 1 Token', () => {
      const probe = probeOnOumuamua(game);
      expect(ProbeSystem.canOrbit(game, P1, probe.id)).toEqual({ canOrbit: true });
      const score = getPlayer(game, P1).score;

      const res = ProbeSystem.orbitProbe(game, P1, probe.id, 'oumuamua', 'seq');
      expect(res.isFirstOrbiter).toBe(true);
      expect(oumuamuaPlanet(res.updatedGame).orbiters.map(o => o.ownerId)).toEqual([P1]);
      expect(getPlayer(res.updatedGame, P1).score).toBe(score + 10);
      expect(getPlayer(res.updatedGame, P1).tokens).toBe(1);
      expect(oumuamuaPlanet(game).orbiters).toEqual([]);
    });

    test('atterrissage : premier atterrisseur, 3 Données, 9 PV et 2 Tokens ; le joueur y est alors présent', () => {
      const probe = probeOnOumuamua(game);
      expect(ProbeSystem.canLand(game, P1, probe.id).canLand).toBe(true);
      expect(ProbeSystem.hasPresenceOnPlanet(game, P1, 'oumuamua')).toBe(false);
      const player = getPlayer(game, P1);
      player.data = 0;
      const score = player.score;

      const res = ProbeSystem.landProbe(game, P1, probe.id, 'oumuamua');
      const after = getPlayer(res.updatedGame, P1);
      expect(oumuamuaPlanet(res.updatedGame).landers.map(l => l.ownerId)).toEqual([P1]);
      expect(after.data).toBe(3);
      expect(after.score).toBe(score + 9);
      expect(after.tokens).toBe(2);
      expect(ProbeSystem.hasPresenceOnPlanet(res.updatedGame, P1, 'oumuamua')).toBe(true);
      expect(ProbeSystem.hasPresenceOnPlanet(res.updatedGame, P2, 'oumuamua')).toBe(false);
      expect(oumuamuaPlanet(game).landers).toEqual([]);
    });

    test('Oumuamua non découvert : aucune présence possible', async () => {
      const fresh = await createTestGame();
      expect(ProbeSystem.hasPresenceOnPlanet(fresh, P1, 'oumuamua')).toBe(false);
    });
  });

  describe('secteur', () => {
    test('couvert : chaque joueur présent gagne 1 Token au lieu de 1 Média', () => {
      const sector = ScanSystem.getSectorById(game, 'oumuamua')!;
      [P1, P2, P1].forEach((id, i) => { sector.signals[i].marked = true; sector.signals[i].markedBy = id; });
      const media = [P1, P2].map(id => getPlayer(game, id).mediaCoverage);
      getPlayer(game, P2).tokens = 0;

      const res = ScanSystem.coverSector(game, P1, 'oumuamua');
      expect([P1, P2].map(id => getPlayer(res.updatedGame, id).tokens)).toEqual([1, 1]);
      expect([P1, P2].map(id => getPlayer(res.updatedGame, id).mediaCoverage)).toEqual(media);
      expect(res.sharedLogs?.join(' ')).toContain('gagnent chacun 1 Token');
    });

    test('signal d\'une couleur : Oumuamua est valide s\'il se trouve dans un secteur de cette couleur', () => {
      const color = game.board.sectors[2].color;
      const other = [SectorType.RED, SectorType.YELLOW, SectorType.BLUE, SectorType.BLACK].find(c => c !== color)!;
      expect(ScanSystem.validateScanSectorSelection(game, P1, { type: 'SELECTING_SCAN_SECTOR', color }, 'oumuamua').valid).toBe(true);
      expect(ScanSystem.validateScanSectorSelection(game, P1, { type: 'SELECTING_SCAN_SECTOR', color: other }, 'oumuamua').valid).toBe(false);
    });

    test('signal « Oumuamua » : valide aussi dans le secteur du plateau où il se trouve, pas ailleurs', () => {
      const interaction = { type: 'SELECTING_SCAN_SECTOR' as const, color: SectorType.OUMUAMUA };
      expect(ScanSystem.validateScanSectorSelection(game, P1, interaction, 'oumuamua').valid).toBe(true);
      expect(ScanSystem.validateScanSectorSelection(game, P1, interaction, 'sector_3').valid).toBe(true);
      expect(ScanSystem.validateScanSectorSelection(game, P1, interaction, 'sector_5').valid).toBe(false);
    });

    test('« secteur d\'une sonde » : une sonde sur la case d\'Oumuamua compte pour son secteur', () => {
      const interaction = { type: 'SELECTING_SCAN_SECTOR' as const, color: SectorType.PROBE, onlyProbes: true };
      expect(ScanSystem.validateScanSectorSelection(game, P1, interaction, 'oumuamua').valid).toBe(false);
      const probe = probeOnOumuamua(game);
      expect(ScanSystem.validateScanSectorSelection(game, P1, interaction, 'oumuamua')).toEqual({ valid: true, usedProbeId: probe.id });
    });
  });
});
