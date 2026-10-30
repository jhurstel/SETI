import { CardSystem } from '../src/systems/CardSystem';
import { createRotationState, getAdjacentCells, getCell, getObjectPosition, RotationState } from '../src/core/SolarSystemPosition';
import { AlienBoardType, DiskName, Game, LifeTraceLocation, LifeTraceType, Probe, ProbeState, SectorNumber, SectorType } from '../src/core/types';
import { createTestGame, getPlayer } from './helpers/gameFixture';

const P1 = 'player_0';
const P2 = 'player_1';
const DISKS: DiskName[] = ['A', 'B', 'C', 'D', 'E'];
const ANGLES = [0, -45, -90, -135, -180, -225, -270, -315];

const probe = (id: string, state: ProbeState, extra: Partial<Probe> = {}): Probe => ({
  id, ownerId: P1, position: { x: 0, y: 0 }, solarPosition: { disk: 'A', sector: 1, level: 0 }, state, isOrbiter: false, isLander: false, ...extra,
});

/** Sonde du joueur posée au niveau fixe, sur la case absolue donnée */
const probeOnCell = (disk: DiskName, sector: SectorNumber): Probe => probe('p', ProbeState.IN_SOLAR_SYSTEM, { solarPosition: { disk, sector, level: 0 } });

/** Toutes les cases du plateau */
const allCells = () => DISKS.flatMap(disk => Array.from({ length: 8 }, (_, i) => ({ disk, sector: (i + 1) as SectorNumber })));

describe('Conditions de mission (CardSystem.evaluateMission)', () => {
  let game: Game;

  beforeEach(async () => {
    game = await createTestGame();
    game.currentPlayerIndex = 0;
  });

  const met = (mission: string, skip = false) => CardSystem.evaluateMission(game, P1, `${mission}:pv:3`, skip);
  const rotation = (): RotationState => {
    const s = game.board.solarSystem;
    return createRotationState(s.rotationAngleLevel1 || 0, s.rotationAngleLevel2 || 0, s.rotationAngleLevel3 || 0);
  };
  const setRotation = (l1: number, l2: number, l3: number) => {
    Object.assign(game.board.solarSystem, { rotationAngleLevel1: l1, rotationAngleLevel2: l2, rotationAngleLevel3: l3 });
  };
  const earth = () => {
    const r = rotation();
    return getObjectPosition('earth', r.level1Angle, r.level2Angle, r.level3Angle, game.board.solarSystem.extraCelestialObjects)!;
  };

  test('mission inconnue du joueur, mission vide ou mal écrite : aucune récompense', () => {
    expect(CardSystem.evaluateMission(game, 'inconnu', 'GAIN_IF_8_MEDIA:pv:3')).toBeNull();
    expect(CardSystem.evaluateMission(game, P1, '')).toBeNull();
    expect(CardSystem.evaluateMission(game, P1, 'GAIN_IF_8_MEDIA')).toBeNull();
  });

  test('condition déjà validée par le moteur (skipConditionCheck) : récompense directe', () => {
    getPlayer(game, P1).mediaCoverage = 0;
    expect(met('GAIN_IF_8_MEDIA')).toBeNull();
    expect(met('GAIN_IF_8_MEDIA', true)).toEqual({ pv: 3 });
    expect(met('GAIN_IF_ORBITER_OR_LANDER:mars', true)).toEqual({ pv: 3 });
  });

  test('orbiteur ou atterrisseur : sur chaque planète demandée (mars&venus)', () => {
    const planet = (id: string) => game.board.planets.find(p => p.id === id)!;
    expect(met('GAIN_IF_ORBITER_OR_LANDER:mars')).toBeNull();
    planet('mars').orbiters = [probe('o', ProbeState.IN_ORBIT)];
    expect(met('GAIN_IF_ORBITER_OR_LANDER:mars')).toEqual({ pv: 3 });
    expect(met('GAIN_IF_ORBITER_OR_LANDER:mars&venus')).toBeNull();
    planet('venus').landers = [probe('l', ProbeState.LANDED)];
    expect(met('GAIN_IF_ORBITER_OR_LANDER:mars&venus')).toEqual({ pv: 3 });
    expect(met('GAIN_IF_ORBITER_OR_LANDER:inconnue')).toBeNull();
  });

  test('3 atterrisseurs sur des planètes (les lunes ne comptent pas)', () => {
    const lander = (planetId: string) => probe(`l-${planetId}`, ProbeState.LANDED, { planetId });
    getPlayer(game, P1).probes = [lander('mars'), lander('venus'), lander('phobos')];
    expect(met('GAIN_IF_3_LANDERS')).toBeNull();
    getPlayer(game, P1).probes.push(lander('jupiter'));
    expect(met('GAIN_IF_3_LANDERS')).toEqual({ pv: 3 });
  });

  test('8 Médias, 50 PV', () => {
    const player = getPlayer(game, P1);
    player.mediaCoverage = 7;
    player.score = 49;
    expect(met('GAIN_IF_8_MEDIA')).toBeNull();
    expect(met('GAIN_IF_50_PV')).toBeNull();
    player.mediaCoverage = 8;
    player.score = 50;
    expect(met('GAIN_IF_8_MEDIA')).toEqual({ pv: 3 });
    expect(met('GAIN_IF_50_PV')).toEqual({ pv: 3 });
  });

  test('secteurs couverts jaunes, bleus ou noirs', () => {
    const covered = (color: SectorType, count: number) => {
      game.board.sectors.forEach(s => { s.coveredBy = []; });
      game.board.sectors.filter(s => s.color === color).slice(0, count).forEach(s => { s.coveredBy = [P1]; });
    };
    covered(SectorType.YELLOW, 1);
    expect(met('GAIN_IF_COVERED:yellow')).toBeNull();
    covered(SectorType.YELLOW, 2);
    expect(met('GAIN_IF_COVERED:yellow')).toEqual({ pv: 3 });
    covered(SectorType.BLUE, 2);
    expect(met('GAIN_IF_COVERED:blue')).toEqual({ pv: 3 });
    covered(SectorType.BLACK, 1);
    expect(met('GAIN_IF_COVERED:black')).toEqual({ pv: 3 });
    expect(met('GAIN_IF_COVERED:inconnue')).toBeNull();
  });

  test('trace de vie d\'une couleur sur les deux espèces', () => {
    const trace = (type: LifeTraceType, playerId = P1) => ({ id: `${type}-${playerId}`, type, playerId });
    game.board.alienBoards[0].lifeTraces = [trace(LifeTraceType.YELLOW)];
    game.board.alienBoards[1].lifeTraces = [trace(LifeTraceType.YELLOW, P2)];
    expect(met('GAIN_IF_LIFETRACE_BOTH_SPECIES:yellow')).toBeNull();
    game.board.alienBoards[1].lifeTraces.push(trace(LifeTraceType.YELLOW));
    expect(met('GAIN_IF_LIFETRACE_BOTH_SPECIES:yellow')).toEqual({ pv: 3 });
    expect(met('GAIN_IF_LIFETRACE_BOTH_SPECIES:inconnue')).toBeNull();
  });

  test('ET.8 à ET.10 : 2 traces d\'une couleur pour les Mascamites', () => {
    const board = game.board.alienBoards[0];
    board.speciesId = AlienBoardType.MASCAMITES;
    const trace = (id: string) => ({ id, type: LifeTraceType.RED, playerId: P1, location: LifeTraceLocation.SPECIES, slotIndex: 0 });
    board.lifeTraces = [trace('a')];
    expect(met('GAIN_IF_2_LIFETRACES:red')).toBeNull();
    board.lifeTraces.push(trace('b'));
    expect(met('GAIN_IF_2_LIFETRACES:red')).toEqual({ pv: 3 });
  });

  test('sonde dans l\'espace lointain : une sonde en orbite ne compte pas', () => {
    getPlayer(game, P1).probes = [probe('o', ProbeState.IN_ORBIT)];
    expect(met('GAIN_IF_PROBE_IN_DEEP_SPACE')).toBeNull();
  });

  test('sonde sur une comète', () => {
    const r = rotation();
    const cells = allCells();
    const comet = cells.find(c => getCell(c.disk, c.sector, r, game.board.solarSystem.extraCelestialObjects)?.hasComet)!;
    const empty = cells.find(c => !getCell(c.disk, c.sector, r, game.board.solarSystem.extraCelestialObjects)?.hasComet)!;
    expect(comet).toBeDefined();

    getPlayer(game, P1).probes = [probeOnCell(empty.disk, empty.sector), probe('o', ProbeState.IN_ORBIT)];
    expect(met('GAIN_IF_PROBE_ON_COMET')).toBeNull();
    getPlayer(game, P1).probes = [probeOnCell(comet.disk, comet.sector)];
    expect(met('GAIN_IF_PROBE_ON_COMET')).toEqual({ pv: 3 });
  });

  test('sonde sur un champ d\'astéroïdes voisin de la Terre (et pas sur un champ éloigné)', () => {
    // Rotation où un champ d'astéroïdes touche la Terre
    let neighbour: { disk: DiskName; sector: SectorNumber } | undefined;
    for (const l1 of ANGLES) for (const l2 of ANGLES) for (const l3 of ANGLES) {
      if (neighbour) break;
      setRotation(l1, l2, l3);
      const e = earth();
      neighbour = getAdjacentCells(e.disk, e.absoluteSector).find(c => getCell(c.disk, c.sector, rotation(), game.board.solarSystem.extraCelestialObjects)?.hasAsteroid);
    }
    expect(neighbour).toBeDefined();
    const e = earth();
    const adjacent = getAdjacentCells(e.disk, e.absoluteSector);
    const far = allCells().find(c => getCell(c.disk, c.sector, rotation(), game.board.solarSystem.extraCelestialObjects)?.hasAsteroid
      && !adjacent.some(a => a.disk === c.disk && a.sector === c.sector));

    getPlayer(game, P1).probes = [probe('o', ProbeState.IN_ORBIT)];
    expect(met('GAIN_IF_PROBE_ON_ASTEROID')).toBeNull();
    const plain = allCells().find(c => !getCell(c.disk, c.sector, rotation(), game.board.solarSystem.extraCelestialObjects)?.hasAsteroid)!;
    getPlayer(game, P1).probes = [probeOnCell(plain.disk, plain.sector)];
    expect(met('GAIN_IF_PROBE_ON_ASTEROID')).toBeNull();
    if (far) {
      getPlayer(game, P1).probes = [probeOnCell(far.disk, far.sector)];
      expect(met('GAIN_IF_PROBE_ON_ASTEROID')).toBeNull();
    }
    getPlayer(game, P1).probes = [probeOnCell(neighbour!.disk, neighbour!.sector)];
    expect(met('GAIN_IF_PROBE_ON_ASTEROID')).toEqual({ pv: 3 });
  });

  test('signal dans un secteur absent du plateau (Oumuamua non découvert) : non rempli', () => {
    expect(met('GAIN_IF_SIGNAL:oumuamua')).toBeNull();
  });

  test('3 Tokens : sans Token, non rempli', () => {
    delete (getPlayer(game, P1) as { tokens?: number }).tokens;
    expect(met('GAIN_IF_3_TOKEN')).toBeNull();
  });

  test('ET.21 : trace Oumuamua sur un emplacement payé en Tokens', () => {
    const board = game.board.alienBoards[0];
    board.speciesId = AlienBoardType.OUMUAMUA;
    const trace = (slotIndex: number, playerId = P1) => ({ id: `t${slotIndex}-${playerId}`, type: LifeTraceType.RED, playerId, location: LifeTraceLocation.SPECIES, slotIndex });

    expect(met('GAIN_IF_PAY_FOR_LIFETRACE')).toBeNull();
    board.lifeTraces = [trace(2), trace(0, P2), { ...trace(1), location: LifeTraceLocation.TRIANGLE }];
    expect(met('GAIN_IF_PAY_FOR_LIFETRACE')).toBeNull();
    board.lifeTraces.push(trace(0));
    expect(met('GAIN_IF_PAY_FOR_LIFETRACE')).toEqual({ pv: 3 });
  });

  test('ET.30 : espèce inconnue, non rempli', () => {
    expect(met('GAIN_IF_LIFETRACES_ALL_COLORS:inconnue')).toBeNull();
  });

  test('condition inconnue : non remplie', () => {
    expect(met('GAIN_IF_INCONNUE')).toBeNull();
  });
});
