import { ActionValidator } from '../src/engine/ActionValidator';
import { GameSession } from '../src/session/GameSession';
import { ProbeSystem } from '../src/systems/ProbeSystem';
import { ScanSystem } from '../src/systems/ScanSystem';
import { ActionType, GAME_CONSTANTS, Game, GamePhase, LifeTraceType, Probe, ProbeState } from '../src/core/types';
import { createTestGame, getPlayer, makeCard } from './helpers/gameFixture';

const P1 = 'player_0';
const P2 = 'player_1';

const probeAt = (id: string, disk: 'A' | 'B' | 'C' | 'D' | 'E', sector: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8, level: number): Probe => ({
  id, ownerId: P1, position: { x: 0, y: 0 }, solarPosition: { disk, sector, level }, state: ProbeState.IN_SOLAR_SYSTEM, isOrbiter: false, isLander: false,
});
/** Sonde sur Mars dans la partie de test (même position que GameSessionCommands.test) */
const onMars = (id = 'mars-probe') => probeAt(id, 'B', 1, 2);
/** Sonde hors de toute planète */
const inSpace = (id = 'space-probe') => probeAt(id, 'A', 3, 0);

const setProbes = (game: Game, probes: Probe[]) => {
  getPlayer(game, P1).probes = probes;
  game.board.solarSystem.probes = probes;
};

/** Partie en cours, P1 actif, P2 robot ; la session est démarrée */
async function sessionGame(): Promise<Game> {
  const game = await createTestGame();
  game.phase = GamePhase.PLAYING;
  game.currentPlayerIndex = 0;
  game.players[1].type = 'robot';
  return GameSession.start(game).game;
}

describe('ActionValidator.mainActionAvailability', () => {
  let game: Game;
  beforeEach(async () => { game = await sessionGame(); });
  const availability = (g: Game = game, playerId = P1) => ActionValidator.mainActionAvailability(g, playerId);

  test('les huit actions principales sont décrites, la partie reçue reste intacte', () => {
    const before = JSON.stringify(game);
    const result = availability();
    expect(Object.keys(result).sort()).toEqual([
      ActionType.LAUNCH_PROBE, ActionType.ORBIT, ActionType.LAND, ActionType.SCAN_SECTOR,
      ActionType.ANALYZE_DATA, ActionType.PLAY_CARD, ActionType.RESEARCH_TECH, ActionType.PASS,
    ].sort());
    expect(result[ActionType.PASS]).toEqual({ available: true });
    expect(JSON.stringify(game)).toBe(before);
  });

  describe('raisons générales, avant la règle propre à l\'action', () => {
    const expectAll = (g: Game, reason: string, playerId = P1) => {
      Object.values(availability(g, playerId)).forEach(a => expect(a).toEqual({ available: false, reason }));
    };

    test('tour d\'un autre joueur', () => expectAll(game, "Ce n'est pas votre tour", P2));
    test('partie terminée', () => expectAll({ ...game, phase: GamePhase.FINAL_SCORING }, 'La partie est terminée'));
    test('partie pas commencée', () => expectAll({ ...game, phase: GamePhase.SETUP }, "La partie n'a pas commencé"));
    test('tour invalide', () => expectAll({ ...game, currentPlayerIndex: -1 }, 'Tour invalide'));
    test('joueur qui a passé', () => {
      getPlayer(game, P1).hasPassed = true;
      expectAll(game, 'Vous avez déjà passé ce tour');
    });
    test('action principale déjà faite, même avec les ressources', () => {
      Object.assign(getPlayer(game, P1), { hasPerformedMainAction: true, credits: 20, energy: 20 });
      expectAll(game, 'Vous avez déjà effectué votre action principale pour ce tour');
    });
    test('interaction en cours', () => {
      expectAll({ ...game, interaction: { type: 'PLACING_LIFE_TRACE', color: LifeTraceType.RED } }, "Terminez d'abord l'action en cours");
    });
  });

  describe('règles propres aux actions', () => {
    test('scan, analyse, lancement et recherche sans ressources : raisons du moteur', () => {
      Object.assign(getPlayer(game, P1), { credits: 0, energy: 0, mediaCoverage: 0 });
      const result = availability();
      expect(result[ActionType.SCAN_SECTOR]).toEqual({ available: false, reason: ScanSystem.canScanSector(game, P1).reason });
      expect(result[ActionType.ANALYZE_DATA].available).toBe(false);
      expect(result[ActionType.ANALYZE_DATA].reason).toMatch(/Nécessite/);
      expect(result[ActionType.LAUNCH_PROBE]).toEqual({ available: false, reason: `Nécessite ${GAME_CONSTANTS.PROBE_LAUNCH_COST} crédits` });
      expect(result[ActionType.RESEARCH_TECH]).toEqual({ available: false, reason: `Nécessite ${GAME_CONSTANTS.TECH_RESEARCH_COST_MEDIA} médias` });
    });

    test('scan et recherche possibles avec les ressources', () => {
      Object.assign(getPlayer(game, P1), { credits: 10, energy: 10, mediaCoverage: 10 });
      const result = availability();
      expect(result[ActionType.SCAN_SECTOR]).toEqual({ available: true });
      expect(result[ActionType.RESEARCH_TECH]).toEqual({ available: true });
      expect(result[ActionType.LAUNCH_PROBE]).toEqual({ available: true });
    });

    test('aucune carte en main, puis aucune carte jouable', () => {
      const player = getPlayer(game, P1);
      player.cards = [];
      expect(availability()[ActionType.PLAY_CARD]).toEqual({ available: false, reason: 'Aucune carte en main' });
      player.cards = [makeCard('c1', { cost: 2 }), makeCard('c2', { cost: 3 })];
      Object.assign(player, { credits: 1, energy: 0 });
      expect(availability()[ActionType.PLAY_CARD]).toEqual({ available: false, reason: 'Aucune carte ne peut être jouée' });
    });

    test('orbite et atterrissage sans sonde dans le système solaire', () => {
      setProbes(game, []);
      const result = availability();
      expect(result[ActionType.ORBIT]).toEqual({ available: false, reason: 'Nécessite une sonde dans le système solaire' });
      expect(result[ActionType.LAND]).toEqual({ available: false, reason: 'Nécessite une sonde dans le système solaire' });
    });

    test('orbite et atterrissage avec une sonde hors des planètes', () => {
      setProbes(game, [inSpace()]);
      Object.assign(getPlayer(game, P1), { credits: 10, energy: 10 });
      const result = availability();
      expect(result[ActionType.ORBIT]).toEqual({ available: false, reason: 'La sonde doit être sur une planète autre que la Terre' });
      expect(result[ActionType.LAND]).toEqual({ available: false, reason: 'La sonde doit être sur une planète autre que la Terre' });
    });

    test('orbite et atterrissage possibles grâce à la deuxième sonde', () => {
      setProbes(game, [inSpace(), onMars()]);
      Object.assign(getPlayer(game, P1), { credits: 10, energy: 10 });
      const result = availability();
      expect(result[ActionType.ORBIT]).toEqual({ available: true });
      expect(result[ActionType.LAND]).toEqual({ available: true });
    });

    test('sonde sur une planète sans assez de ressources : raison du coût', () => {
      setProbes(game, [onMars()]);
      Object.assign(getPlayer(game, P1), { credits: 0, energy: 0 });
      const result = availability();
      expect(result[ActionType.ORBIT].available).toBe(false);
      expect(result[ActionType.ORBIT].reason).toMatch(/Nécessite/);
      expect(result[ActionType.LAND]).toEqual({ available: false, reason: `Nécessite ${GAME_CONSTANTS.LAND_COST_ENERGY} énergies` });
    });
  });

  describe('concordance avec la session', () => {
    const dispatch = (g: Game, command: Parameters<typeof GameSession.dispatch>[2]) => GameSession.dispatch(g, P1, command);

    test('action indiquée possible : acceptée', () => {
      Object.assign(getPlayer(game, P1), { credits: 10, energy: 10 });
      expect(availability()[ActionType.LAUNCH_PROBE].available).toBe(true);
      expect(dispatch(game, { type: 'LAUNCH_PROBE' }).error).toBeUndefined();
      setProbes(game, [onMars()]);
      expect(availability()[ActionType.ORBIT].available).toBe(true);
      expect(dispatch(game, { type: 'ORBIT', planetId: 'mars' }).error).toBeUndefined();
    });

    test('action indiquée impossible : refusée avec la même raison', () => {
      Object.assign(getPlayer(game, P1), { credits: 0, energy: 0, mediaCoverage: 0 });
      const result = availability();
      expect(dispatch(game, { type: 'SCAN' }).error).toBe(result[ActionType.SCAN_SECTOR].reason);
      expect(dispatch(game, { type: 'ANALYZE' }).error).toBe(result[ActionType.ANALYZE_DATA].reason);
      expect(dispatch(game, { type: 'LAUNCH_PROBE' }).error).toBe(result[ActionType.LAUNCH_PROBE].reason);
      expect(dispatch(game, { type: 'RESEARCH_TECH' }).error).toBe(result[ActionType.RESEARCH_TECH].reason);
      const other = availability(game, P2)[ActionType.LAUNCH_PROBE].reason;
      expect(GameSession.dispatch(game, P2, { type: 'LAUNCH_PROBE' }).error).toBe(other);
    });

    test('action principale déjà faite : même raison que le refus', () => {
      Object.assign(getPlayer(game, P1), { credits: 10, energy: 10 });
      const launched = dispatch(game, { type: 'LAUNCH_PROBE' }).game;
      const reason = availability(launched)[ActionType.SCAN_SECTOR].reason;
      expect(reason).toBe('Vous avez déjà effectué votre action principale pour ce tour');
      expect(dispatch(launched, { type: 'SCAN' }).error).toBe(reason);
    });
  });
});

describe('ProbeSystem.currentLandCost', () => {
  let game: Game;
  beforeEach(async () => { game = await sessionGame(); });
  const withExploration3 = () => {
    const player = getPlayer(game, P1);
    player.technologies = [...player.technologies, { ...game.board.technologyBoard.categorySlots![0].technologies[0], id: 'exploration-3-test' }];
  };

  test('sans sonde sur une planète : coût de base, réduit par Exploration III', () => {
    setProbes(game, []);
    const before = JSON.stringify(game);
    expect(ProbeSystem.currentLandCost(game, P1)).toBe(GAME_CONSTANTS.LAND_COST_ENERGY);
    expect(JSON.stringify(game)).toBe(before);
    withExploration3();
    expect(ProbeSystem.currentLandCost(game, P1)).toBe(GAME_CONSTANTS.LAND_COST_ENERGY_WITH_TECHNOLOGY);
  });

  test('sonde sur une planète : coût de la planète (orbiteur présent, Exploration III)', () => {
    setProbes(game, [onMars()]);
    expect(ProbeSystem.currentLandCost(game, P1)).toBe(GAME_CONSTANTS.LAND_COST_ENERGY);
    const mars = game.board.planets.find(p => p.id === 'mars')!;
    mars.orbiters = [{ ...onMars('orbiter'), ownerId: P2, isOrbiter: true, state: ProbeState.IN_ORBIT }];
    expect(ProbeSystem.currentLandCost(game, P1)).toBe(GAME_CONSTANTS.LAND_COST_ENERGY_WITH_ORBITER);
    withExploration3();
    expect(ProbeSystem.currentLandCost(game, P1)).toBe(GAME_CONSTANTS.LAND_COST_ENERGY_WITH_TECHNOLOGY_AND_ORBITER);
  });
});

describe('ScanSystem.nextCoverBonus', () => {
  test('première couverture, puis couvertures suivantes ; Oumuamua sans récompense', async () => {
    const game = await createTestGame();
    const sector = game.board.sectors[0];
    const before = JSON.stringify(game);
    expect(ScanSystem.nextCoverBonus(sector)).toBe(sector.firstBonus);
    expect(ScanSystem.nextCoverBonus({ ...sector, isCovered: true })).toBe(sector.nextBonus);
    expect(JSON.stringify(game)).toBe(before);
    // Chaque secteur du plateau donne une trace de vie rouge à sa première couverture
    game.board.sectors.forEach(s => expect(ScanSystem.nextCoverBonus(s).lifetraces?.[0].scope).toBe(LifeTraceType.RED));
    const oumuamua = game.species.flatMap(s => s.sector ? [s.sector] : [])[0];
    expect(oumuamua).toBeDefined();
    expect(ScanSystem.nextCoverBonus(oumuamua)).toEqual({});
  });

  test('après une couverture réelle, la récompense suivante', async () => {
    const game = await createTestGame();
    const sector = game.board.sectors[0];
    sector.signals.forEach(s => { s.marked = true; s.markedBy = P1; });
    const { updatedGame } = ScanSystem.coverSector(game, P1, sector.id);
    const covered = updatedGame.board.sectors[0];
    expect(ScanSystem.nextCoverBonus(covered)).toEqual(covered.nextBonus);
  });
});
