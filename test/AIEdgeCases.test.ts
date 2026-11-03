import { AIController } from '../src/ai/AIController';
import { AIEvaluator } from '../src/ai/AIEvaluator';
import { AIBehavior } from '../src/ai/AIBehavior';
import { AITurn } from '../src/ai/AITurn';
import { GameEngine } from '../src/core/Game';
import { TurnManager } from '../src/core/TurnManager';
import { random, setRandomState } from '../src/core/random';
import { createRotationState, getAllCells } from '../src/core/SolarSystemPosition';
import { ActionType, AlienBoardType, CardType, CelestialObject, DiskName, FreeActionType, Game, GamePhase, LifeTraceLocation, LifeTraceType, Mission, Probe, ProbeState, SectorNumber, TechnologyCategory } from '../src/core/types';
import { createTestGame, getPlayer, makeCard } from './helpers/gameFixture';

const P1 = 'player_0';
const P2 = 'player_1';

const capsule = (disk: DiskName, sector: SectorNumber): Probe => ({
  id: `cap-${disk}${sector}`, ownerId: P1, position: { x: 0, y: 0 }, solarPosition: { disk, sector, level: 0 },
  state: ProbeState.CAPSULE, isOrbiter: false, isLander: false, planetId: 'jupiter', specimen: { bonus: { pv: 3 } },
} as Probe);

/** Place le générateur sur un état dont le prochain tirage est inférieur à `below` */
function nextDrawBelow(below: number) {
  for (let state = 1; ; state++) {
    setRandomState(state);
    if (random() < below) { setRandomState(state); return; }
  }
}

describe('Robots : cas limites', () => {
  let game: Game;
  let logSpy: jest.SpyInstance;

  beforeEach(async () => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    game = await createTestGame();
    game.currentPlayerIndex = 0;
    game.players.forEach(p => { p.type = 'robot'; });
  });
  afterEach(() => logSpy.mockRestore());

  test('2e palier Exertien sans crédit : le robot renonce à jouer sa carte', () => {
    game.exertienMilestones = [30, 50];
    const player = getPlayer(game, P1);
    player.credits = 0;
    player.cards.push(makeCard('ex1', { type: CardType.EXERTIEN, danger: 1 }));
    const res = AIController.bestExertienCard(game, P1, 50);
    expect(getPlayer(res.updatedGame, P1).cards.some(c => c.id === 'ex1')).toBe(true);
    expect(res.historyEntries[0].message).toMatch(/renonce/);
  });

  test('réservation de 2 cartes avec une seule en main : il réserve celle qu\'il a', () => {
    const player = getPlayer(game, P1);
    player.cards = player.cards.slice(0, 1);
    const reserved = player.reservedCards.length;
    const res = AIController.processInteractionQueue(game, [{ type: 'RESERVING_CARD', count: 2, selectedCards: [] }], 'seq', player);
    expect(getPlayer(res.updatedGame, P1).reservedCards).toHaveLength(reserved + 1);
    expect(getPlayer(res.updatedGame, P1).cards).toHaveLength(0);
  });

  test("niveau PASS : la trace qui fait découvrir les Exertiens laisse son choix de carte au joueur humain qui a un marqueur", () => {
    const player = getPlayer(game, P1);
    player.aiDifficulty = 'PASS';
    getPlayer(game, P2).type = 'human';
    game.board.alienBoards.forEach((board, i) => {
      board.lifeTraces = [
        { id: `y${i}`, type: LifeTraceType.YELLOW, playerId: P1, location: LifeTraceLocation.TRIANGLE },
        { id: `b${i}`, type: LifeTraceType.BLUE, playerId: P2, location: LifeTraceLocation.TRIANGLE },
      ];
    });
    game.board.alienBoards[0].speciesId = AlienBoardType.EXERTIENS;

    const res = AIController.processInteractionQueue(game, [{ type: 'PLACING_LIFE_TRACE', color: LifeTraceType.RED }], 'seq', player);

    expect(res.newPendingInteractions).toEqual([{ type: 'CHOOSING_EXERTIEN_CARD', milestone: 0, playerId: P2, sequenceId: 'seq' }]);
  });

  test('mise en place : un robot sans carte attend', () => {
    game.phase = GamePhase.SETUP;
    game.players.forEach(p => { p.cards = []; p.reservedCards = []; });
    expect(AITurn.playStep(game)).toEqual({ kind: 'WAIT' });
  });

  test('distances : le cache est vidé quand il devient trop grand, les résultats ne changent pas', () => {
    const rotation = createRotationState(0, 0, 0);
    const reference = AIEvaluator.distanceToPlanet('E', 1, rotation, [], 'mars');
    for (let i = 0; i < 2100; i++) AIEvaluator.distanceToPlanet('E', 1, createRotationState(i, 0, 0), [], 'mars');
    expect(AIEvaluator.distanceToPlanet('E', 1, rotation, [], 'mars')).toBe(reference);
  });

  test('palier que le robot ne sait pas résoudre : passage forcé au joueur suivant après 5 essais', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const finish = jest.spyOn(TurnManager, 'finishTurn').mockImplementation(g => ({
      updatedGame: g, milestoneEntries: [], turnEntries: [], turnEnded: false,
      pendingInteractions: [{ type: 'MOVING_PROBE', count: 1, playerId: 'inconnu' }],
    }) as unknown as ReturnType<typeof TurnManager.finishTurn>);
    try {
      const res = AITurn.endTurn(game);
      expect(finish).toHaveBeenCalledTimes(5);
      expect(res.updatedGame.currentPlayerIndex).toBe(1);
      expect(res.historyEntries[res.historyEntries.length - 1].message).toBe(`--- Tour de ${game.players[1].name} ---`);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('passage forcé'));
    } finally {
      finish.mockRestore();
      warn.mockRestore();
    }
  });

  describe('action principale simulée', () => {
    const playMainAction = (g: Game, decision: { action: ActionType; data?: unknown }) =>
      AITurn['playMainAction'](g, getPlayer(g, P1), decision as never);

    test('une décision qui n\'est pas une action principale est ignorée', () => {
      expect(playMainAction(game, { action: ActionType.PASS })).toBeNull();
    });

    test('une action qui fait planter le moteur est ignorée (le robot continue)', () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const crash = jest.spyOn(GameEngine.prototype, 'executeAction').mockImplementation(() => { throw new Error('boum'); });
      try {
        expect(playMainAction(game, { action: ActionType.LAUNCH_PROBE })).toBeNull();
        expect(warn).toHaveBeenCalled();
      } finally {
        crash.mockRestore();
        warn.mockRestore();
      }
    });

    test("recherche d'une technologie : la récompense d'une Anomalie activée par la rotation reste à résoudre (régression)", () => {
      const anomalies = game.board.alienBoards[0];
      anomalies.speciesId = AlienBoardType.ANOMALIES;
      anomalies.isDiscovered = true;
      anomalies.lifeTraces = [{ id: 't', type: LifeTraceType.RED, playerId: P2, location: LifeTraceLocation.SPECIES, slotIndex: 1 }];
      game.board.solarSystem.extraCelestialObjects = Array.from({ length: 8 }, (_, i): CelestialObject => ({
        id: `anomaly-${i + 1}`, type: 'anomaly', name: 'Anomalie', level: 0,
        position: { disk: 'D', sector: (i + 1) as SectorNumber, x: 0, y: 0 },
        anomalyData: { color: LifeTraceType.RED, side: 'head', bonus: { anycard: 1 } },
      }));
      getPlayer(game, P2).type = 'human';
      getPlayer(game, P1).mediaCoverage = 10;
      const tech = game.board.technologyBoard.available.find(t => t.type === TechnologyCategory.EXPLORATION)!;

      const res = playMainAction(game, { action: ActionType.RESEARCH_TECH, data: { tech } })!;

      expect(getPlayer(res.updatedGame, P1).technologies.map(t => t.id)).toContain(tech.id);
      expect(res.humanInteractions).toEqual([expect.objectContaining({ type: 'ACQUIRING_CARD', playerId: P2 })]);
    });

    test('meilleure action : celles que le moteur refuse sont écartées, avant comme après une préparation', () => {
      const player = getPlayer(game, P1);
      Object.assign(player, { aiDifficulty: 'MEDIUM', credits: 0, energy: 3 });
      const list = jest.spyOn(AIBehavior, 'listMainActions').mockImplementation(g => g === game
        ? [{ action: ActionType.ORBIT, data: { probeId: 'aucune', planetId: 'mars' } }]
        : [{ action: ActionType.LAND, data: { probeId: 'aucune', planetId: 'mars' } }]);
      try {
        expect(AITurn['chooseBestMainAction'](game, player)).toBeNull();
        expect(list.mock.calls.length).toBeGreaterThan(1);
      } finally {
        list.mockRestore();
      }
    });
  });

  test('achat d\'une carte : sans pioche, seules les cartes de la rangée sont proposées', () => {
    const player = getPlayer(game, P1);
    player.mediaCoverage = 5;
    game.decks.cards = [];
    const options = AITurn['buyCardOptions'](game, player);
    expect(options).toHaveLength(game.decks.cardRow.length);
  });

  describe('robot Débutant', () => {
    beforeEach(() => { getPlayer(game, P1).aiDifficulty = 'EASY'; });

    test('achat au hasard : rien sans carte dans la rangée', () => {
      getPlayer(game, P1).mediaCoverage = 5;
      game.decks.cardRow = [];
      nextDrawBelow(0.1);
      expect(AITurn['tryBuyCard'](game, getPlayer(game, P1))).toBeNull();
    });

    test('défausse au hasard : rien sans carte à action gratuite', () => {
      getPlayer(game, P1).cards = [makeCard('alien', { freeAction: FreeActionType.UNDEFINED })];
      nextDrawBelow(0.1);
      expect(AITurn['tryDiscardForFreeAction'](game, getPlayer(game, P1))).toBeNull();
    });

    test('mission : il réclame la première condition remplie, sans comparer', () => {
      const player = getPlayer(game, P1);
      player.mediaCoverage = 10;
      const mission: Mission = {
        id: 'm1', cardId: 'c1', name: 'Mission test', description: '', ownerId: P1,
        requirements: [
          { id: 'r1', type: 'GAIN_IF_8_MEDIA', value: 'GAIN_IF_8_MEDIA:pv:3' },
          { id: 'r2', type: 'GAIN_IF_8_MEDIA', value: 'GAIN_IF_8_MEDIA:pv:5' },
        ],
        completedRequirementIds: [], fulfillableRequirementIds: [], completed: false,
      };
      player.missions = [mission];
      const res = AITurn['tryClaimMission'](game, player, true)!;
      expect(getPlayer(res.updatedGame, P1).missions[0].completedRequirementIds).toEqual(['r1']);
    });
  });

  test("déplacement gratuit au hasard : une sonde sur un astéroïde, sans énergie, ne peut pas en sortir", () => {
    game.board.solarSystem.rotationAngleLevel1 = 0;
    game.board.solarSystem.rotationAngleLevel2 = 0;
    game.board.solarSystem.rotationAngleLevel3 = 0;
    const asteroid = [...getAllCells(createRotationState(0, 0, 0)).values()].find(c => c.hasAsteroid)!;
    const player = getPlayer(game, P1);
    player.probes = [{ id: 'p', ownerId: P1, position: { x: 0, y: 0 }, solarPosition: { disk: asteroid.disk, sector: asteroid.sector, level: 0 }, state: ProbeState.IN_SOLAR_SYSTEM, isOrbiter: false, isLander: false }];
    player.energy = 0;
    expect(AITurn['moveRandomProbe'](game, player, 's')).toBeNull();
  });

  describe('capsule ramenée vers la Terre', () => {
    const rotation = createRotationState(0, 0, 0);
    const distanceHome = (disk: DiskName, sector: SectorNumber) => AIEvaluator.distanceToPlanet(disk, sector, rotation, [], 'earth');
    const withCapsule = (probe: Probe) => {
      game.board.solarSystem.rotationAngleLevel1 = 0;
      game.board.solarSystem.rotationAngleLevel2 = 0;
      game.board.solarSystem.rotationAngleLevel3 = 0;
      const player = getPlayer(game, P1);
      player.probes = [probe];
      game.board.solarSystem.probes = [probe];
      return player;
    };

    test('sans énergie, ou déjà sur la Terre : elle ne bouge pas', () => {
      const cells = [...getAllCells(rotation).values()];
      const earth = cells.find(c => c.planetId === 'earth')!;
      const far = cells.find(c => distanceHome(c.disk, c.sector) >= 2)!;

      const stuck = withCapsule(capsule(far.disk, far.sector));
      stuck.energy = 0;
      expect(AITurn['tryMoveCapsuleHome'](game, stuck)).toBeNull();

      const home = withCapsule(capsule(earth.disk, earth.sector));
      home.energy = 5;
      expect(AITurn['tryMoveCapsuleHome'](game, home)).toBeNull();
    });
  });
});
