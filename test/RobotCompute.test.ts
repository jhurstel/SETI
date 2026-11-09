import { GameFactory } from '../src/engine/GameFactory';
import { GameSession } from '../src/session/GameSession';
import { GameRoom } from '../src/session/GameRoom';
import { computeEndTurn, computeStep, answerRobotRequest, localRobotComputer, RobotComputer } from '../src/ai/robotCompute';
import { getRandomState, random, setRandomState, withRandomState } from '../src/core/random';
import { Game, GamePhase } from '../src/core/types';
import { createTestGame, mockFetchFromPublic, TEST_SEED } from './helpers/gameFixture';

/** Partie de robots Experts, mise en place finie (c'est au premier robot de jouer son tour) */
async function robotGame(): Promise<Game> {
  let game = await createTestGame(['R1', 'R2']);
  game = { ...game, players: game.players.map(p => ({ ...p, type: 'robot' as const, aiDifficulty: 'EXPERT' as const })) };
  // Réservations de mise en place des robots
  for (let i = 0; i < 4; i++) {
    const { step, rngState } = computeStep(game);
    if (step.kind !== 'SETUP_RESERVED') break;
    game = GameSession.applyRobotStep(game, step, rngState).game;
  }
  return game;
}

/** Empreinte d'une partie : ce qui change d'une partie à l'autre selon les tirages */
const fingerprint = (game: Game) => JSON.stringify({
  deck: game.decks.cards.map(c => c.id), row: game.decks.cardRow.map(c => c.id),
  hands: game.players.map(p => p.cards.map(c => c.id)), first: game.firstPlayerIndex, rng: game.rngState,
});

describe('Générateur aléatoire de chaque partie', () => {
  let logSpy: jest.SpyInstance;
  beforeEach(() => { logSpy = jest.spyOn(console, 'log').mockImplementation(() => {}); });
  afterEach(() => logSpy.mockRestore());

  test('withRandomState repart de l\'état donné et rend l\'état atteint', () => {
    setRandomState(123);
    const first = random();
    const after = getRandomState();
    setRandomState(999);
    expect(withRandomState(123, () => random())).toEqual({ result: first, rngState: after });
    // Sans état connu : la suite en cours continue
    setRandomState(123);
    expect(withRandomState(undefined, () => random()).result).toBe(first);
  });

  test('deux parties créées en même temps sont celles de leur graine (pas de tirage entre deux attentes)', async () => {
    const fetchSpy = mockFetchFromPublic();
    try {
      const alone = [fingerprint(GameFactory.initializeGame(await GameFactory.createGame(['A', 'B'], true, 1))),
        fingerprint(GameFactory.initializeGame(await GameFactory.createGame(['A', 'B'], true, 2)))];
      const together = await Promise.all([GameFactory.createGame(['A', 'B'], true, 1), GameFactory.createGame(['A', 'B'], true, 2)]);
      // Un tirage étranger entre la création et la mise en place ne change rien non plus
      random();
      expect(together.map(game => fingerprint(GameFactory.initializeGame(game)))).toEqual(alone);
    } finally {
      fetchSpy.mockRestore();
    }
  });

  test('étape de robot appliquée plus tard : le générateur reprend l\'état du calcul, pas celui du moment', async () => {
    const game = await robotGame();
    // Calcul et application à la suite (le générateur continue)
    const direct = GameSession.applyRobotStep(game, computeStep(game).step);
    // Calcul, puis d'autres tirages (une autre salle), puis application avec l'état du calcul
    const { step, rngState } = computeStep(game);
    for (let i = 0; i < 50; i++) random();
    const later = GameSession.applyRobotStep(game, step, rngState);
    expect(later.error).toBeUndefined();
    expect(later.game.rngState).toBe(direct.game.rngState);
    expect(later.entries.map(e => e.message)).toEqual(direct.entries.map(e => e.message));
  });

  test('fin de tour calculée à part, et réponse d\'un fil de calcul', async () => {
    const game = await robotGame();
    const end = computeEndTurn(game);
    expect(end.end.updatedGame).toBeDefined();
    // Mêmes tirages (les identifiants, datés, diffèrent d'un calcul à l'autre)
    expect(answerRobotRequest({ id: 1, kind: 'endTurn', game, rngState: game.rngState! })).toMatchObject({ id: 1, kind: 'endTurn', rngState: end.rngState });
    const step = computeStep(game);
    expect(answerRobotRequest({ id: 2, kind: 'playStep', game, rngState: game.rngState! })).toMatchObject({ id: 2, kind: 'playStep', step: { kind: step.step.kind }, rngState: step.rngState });
    // Calcul qui échoue : l'erreur est renvoyée au lieu de faire tomber le fil
    const broken = { ...game, players: [] } as unknown as Game;
    const failed = answerRobotRequest({ id: 3, kind: 'playStep', game: broken, rngState: 7 });
    expect(failed).toEqual({ id: 3, kind: 'playStep', error: expect.any(String), rngState: 7 });
    expect((await localRobotComputer.endTurn(game)).rngState).toBe(end.rngState);
  });
});

describe('GameRoom : étape de robot calculée ailleurs', () => {
  let logSpy: jest.SpyInstance;
  beforeEach(() => { logSpy = jest.spyOn(console, 'log').mockImplementation(() => {}); });
  afterEach(() => logSpy.mockRestore());

  async function robotTurnRoom(): Promise<GameRoom> {
    const fetchSpy = mockFetchFromPublic();
    try {
      const room = GameRoom.create('ROBOT', 'Alice', 'tok', [{ type: 'human' }, { type: 'robot', aiDifficulty: 'EXPERT' }], ['HAL'], 1);
      await room.start(TEST_SEED);
      // Mise en place : Alice réserve, le robot aussi
      for (let i = 0; i < 6 && room.game!.phase === GamePhase.SETUP; i++) {
        if (room.robotToPlay) { await room.robotStep(); continue; }
        const alice = room.game!.players[0];
        room.command('tok', { type: 'CHOOSE', choice: { kind: 'CARDS', cardIds: [alice.cards[0].id] } });
      }
      return room;
    } finally {
      fetchSpy.mockRestore();
    }
  }

  test('même étape qu\'en local, même si d\'autres tirages ont lieu pendant le calcul', async () => {
    const room = await robotTurnRoom();
    expect(room.robotToPlay).toBe(true);
    const expected = GameSession.applyRobotStep(room.game!, computeStep(room.game!).step);
    const busy: RobotComputer = {
      playStep: async game => { const result = computeStep(game); for (let i = 0; i < 20; i++) random(); return result; },
      endTurn: localRobotComputer.endTurn,
    };
    expect((await room.robotStep(busy)).played).toBe(true);
    expect(room.game!.rngState).toBe(expected.game.rngState);
  });

  test('partie changée pendant le calcul : l\'étape est abandonnée (stale)', async () => {
    const room = await robotTurnRoom();
    const before = room.game!;
    const interrupted: RobotComputer = {
      playStep: async game => { room.game = { ...room.game! }; return computeStep(game); },
      endTurn: localRobotComputer.endTurn,
    };
    expect(await room.robotStep(interrupted)).toEqual({ played: false, notifications: [], stale: true });
    expect(room.log.length).toBeGreaterThan(0);
    expect(room.game!.players).toBe(before.players);
  });

  test('fin de tour : la partie changée pendant son calcul l\'abandonne aussi', async () => {
    const room = await robotTurnRoom();
    const endTurn: RobotComputer = {
      playStep: async () => ({ step: { kind: 'END_TURN' }, rngState: 1 }),
      endTurn: async game => { room.game = { ...room.game! }; return computeEndTurn(game); },
    };
    expect(await room.robotStep(endTurn)).toEqual({ played: false, notifications: [], stale: true });
    // Sans changement : la fin de tour calculée est appliquée
    const ended: RobotComputer = { playStep: endTurn.playStep, endTurn: localRobotComputer.endTurn };
    const robotId = room.game!.players[room.game!.currentPlayerIndex].id;
    await room.robotStep(ended);
    expect(room.game!.players[room.game!.currentPlayerIndex].id).not.toBe(robotId);
  });
});
