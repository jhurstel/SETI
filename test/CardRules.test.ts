import { CardSystem } from '../src/systems/CardSystem';
import { calculateReachableCells, createRotationState, getAdjacentCells, getCell, getObjectPosition } from '../src/core/SolarSystemPosition';
import { AlienBoardType, Card, DiskName, FreeActionType, Game, GAME_CONSTANTS, LifeTraceLocation, LifeTraceType, Mission, Probe, ProbeState, SectorNumber, SectorType, TechnologyCategory } from '../src/core/types';
import { createTestGame, getPlayer, makeCard } from './helpers/gameFixture';

const P1 = 'player_0';

const probe = (id: string, state: ProbeState, extra: Partial<Probe> = {}): Probe => ({
  id, ownerId: P1, position: { x: 0, y: 0 }, solarPosition: { disk: 'A', sector: 1, level: 0 }, state, isOrbiter: false, isLander: false, ...extra,
});

describe('Règles des cartes', () => {
  let game: Game;

  beforeEach(async () => {
    game = await createTestGame();
    game.currentPlayerIndex = 0;
  });

  describe('Défausse d\'une carte pour son action gratuite', () => {
    test.each([
      [FreeActionType.MEDIA, { mediaCoverage: GAME_CONSTANTS.MAX_MEDIA_COVERAGE }, 'Média au maximum'],
      [FreeActionType.TWO_MEDIA, { mediaCoverage: GAME_CONSTANTS.MAX_MEDIA_COVERAGE }, 'Média au maximum'],
      [FreeActionType.DATA, { data: GAME_CONSTANTS.MAX_DATA }, 'Nécessite de transférer des données'],
      [FreeActionType.PV_DATA, { data: GAME_CONSTANTS.MAX_DATA }, 'Nécessite de transférer des données'],
      [FreeActionType.MOVEMENT, { probes: [] }, 'Nécessite une sonde dans le système solaire'],
      [FreeActionType.PV_MOVEMENT, { probes: [] }, 'Nécessite une sonde dans le système solaire'],
    ])('%s : refusée quand le gain est impossible', (freeAction, blocked, reason) => {
      Object.assign(getPlayer(game, P1), blocked);
      expect(CardSystem.canDiscardFreeAction(game, P1, freeAction)).toEqual({ canDiscard: false, reason });
    });

    test.each([FreeActionType.MEDIA, FreeActionType.TWO_MEDIA, FreeActionType.DATA, FreeActionType.PV_DATA, FreeActionType.MOVEMENT, FreeActionType.PV_MOVEMENT])('%s : permise sinon', freeAction => {
      Object.assign(getPlayer(game, P1), { mediaCoverage: 0, data: 0, probes: [probe('p', ProbeState.IN_SOLAR_SYSTEM)] });
      expect(CardSystem.canDiscardFreeAction(game, P1, freeAction).canDiscard).toBe(true);
    });

    test('refusée hors de son tour ou pour un joueur inconnu', () => {
      game.currentPlayerIndex = 1;
      expect(CardSystem.canDiscardFreeAction(game, P1, FreeActionType.MEDIA).canDiscard).toBe(false);
      expect(CardSystem.canDiscardFreeAction(game, 'inconnu', FreeActionType.MEDIA).canDiscard).toBe(false);
    });

    test.each([
      [FreeActionType.MEDIA, { mediaCoverage: 1 }, 0],
      [FreeActionType.TWO_MEDIA, { mediaCoverage: 2 }, 0],
      [FreeActionType.DATA, { data: 1 }, 0],
      [FreeActionType.PV_DATA, { data: 1 }, 1],
    ])('%s : la carte est défaussée et le gain appliqué', (freeAction, gain, points) => {
      const player = getPlayer(game, P1);
      Object.assign(player, { mediaCoverage: 0, data: 0 });
      player.cards.push(makeCard('free', { freeAction }));
      const score = player.score;
      const before = JSON.stringify(game);

      const res = CardSystem.discardCardForFreeAction(game, P1, 'free');
      const after = getPlayer(res.updatedGame, P1);

      expect(after.cards.some(c => c.id === 'free')).toBe(false);
      expect(res.updatedGame.decks.discardPile.some(c => c.id === 'free')).toBe(true);
      Object.entries(gain).forEach(([key, value]) => expect(after[key as 'data' | 'mediaCoverage']).toBe(value));
      expect(after.score).toBe(score + points);
      expect(res.historyEntries[0].message).toContain('défausse carte "Carte free"');
      expect(JSON.stringify(game)).toBe(before);
    });

    test('déplacement gratuit : interaction de déplacement', () => {
      const player = getPlayer(game, P1);
      player.probes = [probe('p', ProbeState.IN_SOLAR_SYSTEM)];
      player.cards.push(makeCard('move', { freeAction: FreeActionType.MOVEMENT }));

      const res = CardSystem.discardCardForFreeAction(game, P1, 'move');

      expect(res.newPendingInteractions).toEqual([expect.objectContaining({ type: 'MOVING_PROBE', count: 1 })]);
    });

    test('mission « après avoir défaussé » : signalée comme à recouvrir', () => {
      const player = getPlayer(game, P1);
      player.cards.push(makeCard('media', { freeAction: FreeActionType.MEDIA }));
      player.missions.push({ id: 'm', cardId: 'c', name: 'Mission test', description: '', ownerId: P1, requirements: [{ id: 'r', type: 'GAIN_ON_DISCARD_MEDIA', value: 'GAIN_ON_DISCARD:media:pv:1' }], completedRequirementIds: [], fulfillableRequirementIds: [], completed: false } as Mission);
      player.permanentBuffs.push({ type: 'GAIN_ON_DISCARD_MEDIA', value: 'GAIN_ON_DISCARD:media:pv:1', id: 'r', source: 'Mission test' });

      const res = CardSystem.discardCardForFreeAction(game, P1, 'media');

      expect(res.historyEntries.some(e => e.message === 'déclenche une mission à recouvrir')).toBe(true);
      expect(getPlayer(res.updatedGame, P1).missions[0].fulfillableRequirementIds).toEqual(['r']);
    });

    test('carte absente ou carte Exertien : rien ne change', () => {
      expect(CardSystem.discardCardForFreeAction(game, P1, 'inconnue').updatedGame).toBe(game);
    });
  });

  describe('canPlayCards', () => {
    test('main vide, cartes trop chères, au moins une carte jouable', () => {
      const player = getPlayer(game, P1);
      const expensive: Card = makeCard('cher', { cost: 99 });
      player.cards = [];
      expect(CardSystem.canPlayCards(game, P1)).toEqual({ canPlay: false, reason: 'Aucune carte en main' });

      player.cards = [expensive];
      expect(CardSystem.canPlayCards(game, P1).canPlay).toBe(false);

      player.credits = 5;
      player.cards = [expensive, makeCard('ok', { cost: 1 })];
      expect(CardSystem.canPlayCards(game, P1).canPlay).toBe(true);
      expect(CardSystem.getPlayableCardIds(game, P1)).toEqual(['ok']);
      expect(CardSystem.canPlayCards(game, 'inconnu').canPlay).toBe(false);
    });
  });

  describe('Conditions de mission (GAIN_IF_…)', () => {
    const met = (mission: string) => CardSystem.evaluateMission(game, P1, `${mission}:pv:3`);

    test('2 orbiteurs', () => {
      getPlayer(game, P1).probes = [probe('o1', ProbeState.IN_ORBIT)];
      expect(met('GAIN_IF_2_ORBITERS')).toBeNull();
      getPlayer(game, P1).probes.push(probe('o2', ProbeState.IN_ORBIT));
      expect(met('GAIN_IF_2_ORBITERS')).toEqual({ pv: 3 });
    });

    test('secteurs couverts : deux fois le même, deux rouges, un noir', () => {
      expect(met('GAIN_IF_COVERED:same')).toBeNull();
      game.board.sectors[0].coveredBy = [P1, P1];
      expect(met('GAIN_IF_COVERED:same')).toEqual({ pv: 3 });

      game.board.sectors.forEach(s => { s.coveredBy = []; });
      const reds = game.board.sectors.filter(s => s.color === SectorType.RED);
      reds[0].coveredBy = [P1];
      expect(met('GAIN_IF_COVERED:red')).toBeNull();
      reds[1].coveredBy = [P1];
      expect(met('GAIN_IF_COVERED:red')).toEqual({ pv: 3 });
    });

    test('signaux dans 4 secteurs', () => {
      game.board.sectors.slice(0, 3).forEach(s => { s.signals[0].markedBy = P1; });
      expect(met('GAIN_IF_4_SIGNALS')).toBeNull();
      game.board.sectors[3].signals[0].markedBy = P1;
      expect(met('GAIN_IF_4_SIGNALS')).toEqual({ pv: 3 });
    });

    test('3 traces bleues, ou 3 couleurs pour une même espèce', () => {
      const trace = (type: LifeTraceType) => ({ id: type, type, playerId: P1, location: LifeTraceLocation.TRIANGLE });
      getPlayer(game, P1).lifeTraces = [trace(LifeTraceType.BLUE), trace(LifeTraceType.BLUE)] as never;
      expect(met('GAIN_IF_3_LIFETRACES:blue')).toBeNull();
      getPlayer(game, P1).lifeTraces.push(trace(LifeTraceType.BLUE) as never);
      expect(met('GAIN_IF_3_LIFETRACES:blue')).toEqual({ pv: 3 });

      expect(met('GAIN_IF_3_LIFETRACES:different')).toBeNull();
      game.board.alienBoards[1].lifeTraces = [trace(LifeTraceType.RED), trace(LifeTraceType.YELLOW), trace(LifeTraceType.BLUE)];
      expect(met('GAIN_IF_3_LIFETRACES:different')).toEqual({ pv: 3 });
    });

    test('ET.30 : une trace de chaque couleur pour l\'espèce nommée', () => {
      const board = game.board.alienBoards[0];
      board.speciesId = AlienBoardType.ANOMALIES;
      const trace = (type: LifeTraceType) => ({ id: type, type, playerId: P1, location: LifeTraceLocation.TRIANGLE });
      board.lifeTraces = [trace(LifeTraceType.RED), trace(LifeTraceType.YELLOW)];
      expect(met('GAIN_IF_LIFETRACES_ALL_COLORS:anomalies')).toBeNull();
      board.lifeTraces.push(trace(LifeTraceType.BLUE));
      expect(met('GAIN_IF_LIFETRACES_ALL_COLORS:anomalies')).toEqual({ pv: 3 });
    });

    test('main vide, 3 technologies Observation, 3 Tokens', () => {
      expect(met('GAIN_IF_EMPTY_HAND')).toBeNull();
      getPlayer(game, P1).cards = [];
      expect(met('GAIN_IF_EMPTY_HAND')).toEqual({ pv: 3 });

      const observation = game.board.technologyBoard.available.filter(t => t.type === TechnologyCategory.OBSERVATION);
      getPlayer(game, P1).technologies = observation.slice(0, 2);
      expect(met('GAIN_IF_3_TECH_OBS')).toBeNull();
      getPlayer(game, P1).technologies.push(observation[2]);
      expect(met('GAIN_IF_3_TECH_OBS')).toEqual({ pv: 3 });

      getPlayer(game, P1).tokens = 2;
      expect(met('GAIN_IF_3_TOKEN')).toBeNull();
      getPlayer(game, P1).tokens = 3;
      expect(met('GAIN_IF_3_TOKEN')).toEqual({ pv: 3 });
    });

    test('orbiteur et atterrisseur sur une même planète, atterrisseur sur une planète donnée', () => {
      const mars = game.board.planets.find(p => p.id === 'mars')!;
      mars.landers = [probe('l', ProbeState.LANDED)];
      expect(met('GAIN_IF_ORBITER_AND_LANDER')).toBeNull();
      expect(met('GAIN_IF_LANDER:mars')).toEqual({ pv: 3 });
      expect(met('GAIN_IF_LANDER:venus')).toBeNull();
      mars.orbiters = [probe('o', ProbeState.IN_ORBIT)];
      expect(met('GAIN_IF_ORBITER_AND_LANDER')).toEqual({ pv: 3 });
    });

    test('signal marqué dans un secteur donné', () => {
      const sector = game.board.sectors[2];
      expect(met(`GAIN_IF_SIGNAL:${sector.id}`)).toBeNull();
      Object.assign(sector.signals[0], { marked: true, markedBy: P1 });
      expect(met(`GAIN_IF_SIGNAL:${sector.id}`)).toEqual({ pv: 3 });
    });

    test('sonde dans l\'espace lointain (5 déplacements ou plus depuis la Terre)', () => {
      const solar = game.board.solarSystem;
      const rotation = createRotationState(solar.rotationAngleLevel1 || 0, solar.rotationAngleLevel2 || 0, solar.rotationAngleLevel3 || 0);
      const earth = getObjectPosition('earth', rotation.level1Angle, rotation.level2Angle, rotation.level3Angle, solar.extraCelestialObjects)!;
      const reachable = calculateReachableCells(earth.disk, earth.absoluteSector, 100, rotation, true);
      const cellAt = (test: (moves: number) => boolean) => [...reachable.entries()].find(([, c]) => test(c.movements))![0];
      const place = (key: string) => {
        getPlayer(game, P1).probes = [probe('p', ProbeState.IN_SOLAR_SYSTEM, { solarPosition: { disk: key[0] as DiskName, sector: Number(key.slice(1)) as SectorNumber, level: 0 } })];
      };

      place(cellAt(m => m > 0 && m < 5));
      expect(met('GAIN_IF_PROBE_IN_DEEP_SPACE')).toBeNull();
      place(cellAt(m => m >= 5));
      expect(met('GAIN_IF_PROBE_IN_DEEP_SPACE')).toEqual({ pv: 3 });
    });

    test('sonde sur un champ d\'astéroïdes voisin de la Terre', () => {
      const solar = game.board.solarSystem;
      const rotation = createRotationState(solar.rotationAngleLevel1 || 0, solar.rotationAngleLevel2 || 0, solar.rotationAngleLevel3 || 0);
      const earth = getObjectPosition('earth', rotation.level1Angle, rotation.level2Angle, rotation.level3Angle, solar.extraCelestialObjects)!;
      const asteroid = getAdjacentCells(earth.disk, earth.absoluteSector).find(c => getCell(c.disk, c.sector, rotation, solar.extraCelestialObjects)?.hasAsteroid);
      expect(met('GAIN_IF_PROBE_ON_ASTEROID')).toBeNull();
      if (!asteroid) return; // Aucun champ d'astéroïdes à côté de la Terre avec cette mise en place
      getPlayer(game, P1).probes = [probe('p', ProbeState.IN_SOLAR_SYSTEM, { solarPosition: { disk: asteroid.disk, sector: asteroid.sector, level: 0 } })];
      expect(met('GAIN_IF_PROBE_ON_ASTEROID')).toEqual({ pv: 3 });
    });
  });
});
