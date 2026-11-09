import { AIController } from '../src/ai/AIController';
import { AIEvaluator } from '../src/ai/AIEvaluator';
import { AIBehavior } from '../src/ai/AIBehavior';
import { AITurn } from '../src/ai/AITurn';
import { GameSession } from '../src/session/GameSession';
import { GameEngine } from '../src/engine/Game';
import { TurnManager } from '../src/engine/TurnManager';
import { random, setRandomState } from '../src/core/random';
import { createRotationState, getAllCells } from '../src/core/SolarSystemPosition';
import { ActionType, AlienBoardType, CardType, CelestialObject, DiskName, FreeActionType, Game, GamePhase, LifeTraceLocation, LifeTraceType, Mission, Probe, ProbeState, SectorNumber, TechnologyCategory } from '../src/core/types';
import { createTestGame, getPlayer, makeCard } from './helpers/gameFixture';
import { revealText, textFor } from '../src/core/historyText';

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

  test('robot Débutant : une action impossible à jouer est ignorée (il passe)', () => {
    const player = getPlayer(game, P1);
    player.aiDifficulty = 'EASY';
    const spy = jest.spyOn(AIBehavior, 'listMainActions').mockReturnValue([{ action: 'INCONNUE' } as never]);
    expect(AITurn['chooseEasyMainAction'](game, player)).toBeNull();
    spy.mockRestore();
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

  test("déplacement gratuit : une sonde sur un astéroïde, sans énergie, ne bouge pas et les déplacements s'arrêtent", () => {
    game.board.solarSystem.rotationAngleLevel1 = 0;
    game.board.solarSystem.rotationAngleLevel2 = 0;
    game.board.solarSystem.rotationAngleLevel3 = 0;
    const asteroid = [...getAllCells(createRotationState(0, 0, 0)).values()].find(c => c.hasAsteroid)!;
    const player = getPlayer(game, P1);
    player.probes = [{ id: 'p', ownerId: P1, position: { x: 0, y: 0 }, solarPosition: { disk: asteroid.disk, sector: asteroid.sector, level: 0 }, state: ProbeState.IN_SOLAR_SYSTEM, isOrbiter: false, isLander: false }];
    player.energy = 0;
    const res = AIController.processInteractionQueue(game, [{ type: 'MOVING_PROBE', count: 1 }], 's', player);
    expect(getPlayer(res.updatedGame, P1).probes[0].solarPosition).toEqual(player.probes[0].solarPosition);
    expect(res.historyEntries).toEqual([]);
  });

  describe('mêmes opérations que le joueur humain', () => {
    const history = (res: { historyEntries: { message: string }[] } | null) => res!.historyEntries.map(e => revealText(e.message));

    test('mise en place : la réservation passe par le choix RESERVING_CARD (message du moteur)', () => {
      game.phase = GamePhase.SETUP;
      const step = AITurn.playStep(game);
      expect(step.kind).toBe('SETUP_RESERVED');
      if (step.kind === 'SETUP_RESERVED') {
        expect(getPlayer(step.updatedGame, P1).reservedCards).toHaveLength(1);
        expect(step.historyEntries[0].message).toMatch(/^réserve /);
      }
    });

    test('recherche d\'une technologie Informatique : la colonne de l\'ordinateur est choisie (régression : technologie hors de l\'ordinateur)', () => {
      const player = getPlayer(game, P1);
      player.mediaCoverage = 10;
      const tech = game.board.technologyBoard.available.find(t => t.type === TechnologyCategory.COMPUTING)!;
      const res = AITurn['playMainAction'](game, player, { action: ActionType.RESEARCH_TECH, data: { tech } })!;
      const slots = Object.values(getPlayer(res.updatedGame, P1).dataComputer.slots);
      expect(slots.some(slot => slot.technologyId === tech.id)).toBe(true);
    });

    test('achat d\'une carte : la carte choisie sur ACQUIRING_CARD, payée 3 Médias', () => {
      const player = getPlayer(game, P1);
      player.mediaCoverage = 5;
      const options = AITurn['buyCardOptions'](game, player);
      expect(options).toHaveLength(game.decks.cardRow.length + 1);
      expect(history(options[0])[0]).toMatch(/^paye 3 médias pour acheter ".+" depuis la rangée$/);
      expect(history(options[options.length - 1])[0]).toMatch(/depuis la pioche$/);
      expect(getPlayer(options[0].updatedGame, P1).mediaCoverage).toBe(2);
    });

    test('échange de 2 crédits contre une carte : coût payé, puis carte choisie dans la rangée ou la pioche', () => {
      const player = getPlayer(game, P1);
      Object.assign(player, { credits: 4, energy: 0, mediaCoverage: 0 });
      const hand = player.cards.length;
      const options = AITurn['preparationOptions'](game, player) as { updatedGame: Game; historyEntries: { message: string }[] }[];
      const trade = options.find(o => getPlayer(o.updatedGame, P1).credits === 2 && getPlayer(o.updatedGame, P1).cards.length === hand + 1);
      expect(trade).toBeDefined();
      expect(history(trade!).length).toBeGreaterThan(1);
    });

    test.each([
      [FreeActionType.PV_DATA, { score: 1, data: 1 }],
      [FreeActionType.TWO_MEDIA, { mediaCoverage: 2 }],
    ] as const)('défausse pour action gratuite « %s » : gain du moteur (régression : ignorée par les robots)', (freeAction, gains) => {
      const player = getPlayer(game, P1);
      Object.assign(player, { score: 0, data: 0, mediaCoverage: 0 });
      player.cards = [makeCard('libre', { freeAction })];
      const [option] = AITurn['discardForFreeActionOptions'](game, player);
      const after = getPlayer(option.updatedGame, P1);
      Object.entries(gains).forEach(([field, value]) => expect(after[field as keyof typeof gains]).toBe(value));
      expect(option.updatedGame.decks.discardPile.some(c => c.id === 'libre')).toBe(true);
    });

    test('défausse pour un déplacement : chaque pas de sonde est simulé ; sans sonde, l\'action n\'est pas proposée', () => {
      const player = getPlayer(game, P1);
      player.cards = [makeCard('move', { freeAction: FreeActionType.MOVEMENT })];
      player.probes = [];
      expect(AITurn['discardForFreeActionOptions'](game, player)).toEqual([]);

      game.board.solarSystem.rotationAngleLevel1 = 0;
      game.board.solarSystem.rotationAngleLevel2 = 0;
      game.board.solarSystem.rotationAngleLevel3 = 0;
      const plain = [...getAllCells(createRotationState(0, 0, 0)).values()].find(c => !c.hasAsteroid && c.disk === 'C')!;
      player.probes = [{ id: 'p', ownerId: P1, position: { x: 0, y: 0 }, solarPosition: { disk: plain.disk, sector: plain.sector, level: 0 }, state: ProbeState.IN_SOLAR_SYSTEM, isOrbiter: false, isLander: false }];
      game.board.solarSystem.probes = [...player.probes];
      player.energy = 0;
      const options = AITurn['discardForFreeActionOptions'](game, player);
      expect(options.length).toBeGreaterThan(1);
      options.forEach(o => {
        expect(getPlayer(o.updatedGame, P1).probes[0].solarPosition).not.toEqual(player.probes[0].solarPosition);
        expect(getPlayer(o.updatedGame, P1).energy).toBe(0);
      });
    });

    test.each(['EXPERT', 'EASY', 'PASS'] as const)('passe (%s) : la carte de fin de manche est choisie une fois passé (pile cachée avant), son nom reste privé', difficulty => {
      const player = getPlayer(game, P1);
      player.aiDifficulty = difficulty;
      game.phase = GamePhase.PLAYING;
      const roundDeck = game.decks.roundDecks[game.currentRound];
      expect(roundDeck.length).toBeGreaterThan(1);

      const step = AITurn['pass'](player);
      expect(step).toEqual({ kind: 'PASS', cardsToKeep: expect.any(Array) });

      const applied = GameSession.applyRobotStep(game, step);
      expect(applied.error).toBeUndefined();
      const taken = getPlayer(applied.game, P1).cards.find(c => roundDeck.some(r => r.id === c.id))!;
      expect(taken).toBeDefined();
      if (difficulty === 'PASS') expect(taken.id).toBe(roundDeck[0].id);
      expect(applied.game.decks.roundDecks[game.currentRound]).toHaveLength(roundDeck.length - 1);
      const message = applied.entries.map(e => e.message).find(m => m.includes('de fin de manche'))!;
      expect(revealText(message)).toBe(`prend "${taken.name}" de la pile de fin de manche`);
      expect(textFor(message, P2)).not.toContain(taken.name);
    });

    test.each(['EXPERT', 'EASY'] as const)('passe (%s) avec plus de 4 cartes : les cartes en trop servent d\'abord (défausse pour action gratuite ou échange), une à la fois', difficulty => {
      const player = getPlayer(game, P1);
      player.aiDifficulty = difficulty;
      game.phase = GamePhase.PLAYING;
      player.cards = Array.from({ length: 6 }, (_, i) => makeCard(`c${i}`, { freeAction: FreeActionType.DATA, cost: i }));
      player.data = 0;

      const step = AITurn['passAfterUsingExcessCards'](game, player);

      expect(step.kind).toBe('UPDATED');
      const after = getPlayer((step as Extract<typeof step, { kind: 'UPDATED' }>).updatedGame, P1);
      expect(after.cards.length).toBeLessThan(6);
      // Les cartes gardées pour la manche suivante ne sont pas touchées
      const kept = (AIBehavior.createPassDecision(player).data as { cardsToKeep: string[] }).cardsToKeep;
      kept.forEach(id => expect(after.cards.some(c => c.id === id)).toBe(true));
      expect(player.cards).toHaveLength(6);

      // Avec 4 cartes, le robot passe
      player.cards = player.cards.slice(0, 4);
      expect(AITurn['passAfterUsingExcessCards'](game, player)).toEqual({ kind: 'PASS', cardsToKeep: expect.any(Array) });
    });

    test('robot Débutant : défausse pour « 2 Médias » avec l\'opération du moteur', () => {
      const player = getPlayer(game, P1);
      Object.assign(player, { aiDifficulty: 'EASY', mediaCoverage: 0 });
      player.cards = [makeCard('media2', { freeAction: FreeActionType.TWO_MEDIA })];
      nextDrawBelow(0.1);
      const res = AITurn['tryDiscardForFreeAction'](game, player)!;
      expect(getPlayer(res.updatedGame, P1).mediaCoverage).toBe(2);
      expect(history(res)[0]).toMatch(/^défausse "/);
    });
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

describe('Robots : déplacement gagné sans case atteignable', () => {
  test('défausse pour un déplacement avec une sonde bloquée sur un astéroïde : la défausse reste proposée, le déplacement est perdu', async () => {
    const game = await createTestGame();
    game.currentPlayerIndex = 0;
    Object.assign(game.board.solarSystem, { rotationAngleLevel1: 0, rotationAngleLevel2: 0, rotationAngleLevel3: 0 });
    const asteroid = [...getAllCells(createRotationState(0, 0, 0)).values()].find(c => c.hasAsteroid)!;
    const player = getPlayer(game, P1);
    player.type = 'robot';
    player.aiDifficulty = 'EXPERT';
    player.energy = 0;
    player.cards = [makeCard('move', { freeAction: FreeActionType.MOVEMENT })];
    player.probes = [{ id: 'p', ownerId: P1, position: { x: 0, y: 0 }, solarPosition: { disk: asteroid.disk, sector: asteroid.sector, level: 0 }, state: ProbeState.IN_SOLAR_SYSTEM, isOrbiter: false, isLander: false }];
    game.board.solarSystem.probes = [...player.probes];

    const options = AITurn['discardForFreeActionOptions'](game, player);

    expect(options).toHaveLength(1);
    expect(getPlayer(options[0].updatedGame, P1).probes[0].solarPosition).toEqual(player.probes[0].solarPosition);
    expect(options[0].updatedGame.decks.discardPile.some(c => c.id === 'move')).toBe(true);

    // Avec 1 énergie, elle ne sort pas non plus de l'astéroïde (2 déplacements)
    player.energy = 1;
    expect(AITurn['probeMoveOptions'](game, player)).toEqual([]);
  });
});
