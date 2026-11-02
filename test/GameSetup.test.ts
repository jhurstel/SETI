import { GameSetup, SeatConfig } from '../src/session/GameSetup';
import { GameFactory } from '../src/core/GameFactory';
import { GamePhase } from '../src/core/types';
import { mockFetchFromPublic, TEST_SEED } from './helpers/gameFixture';

const SEATS: SeatConfig[] = [
  { name: 'Alice', type: 'human' },
  { name: 'Bob', type: 'robot', aiDifficulty: 'EXPERT' },
  { name: 'Carol', type: 'robot' },
];

describe('GameSetup.newGame et premier joueur', () => {
  let fetchSpy: jest.SpyInstance;
  let logSpy: jest.SpyInstance;
  beforeEach(() => {
    fetchSpy = mockFetchFromPublic();
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => {
    fetchSpy.mockRestore();
    logSpy.mockRestore();
  });

  test('places, niveaux des robots, mise en place faite et journal de départ', async () => {
    const { game, entries } = await GameSetup.newGame(SEATS, { seed: TEST_SEED });
    expect(game.players.map(p => [p.name, p.type, p.aiDifficulty])).toEqual([['Alice', 'human', undefined], ['Bob', 'robot', 'EXPERT'], ['Carol', 'robot', 'EASY']]);
    expect(game.phase).toBe(GamePhase.SETUP);
    expect(game.decks.cardRow.length).toBeGreaterThan(0);
    expect(game.rngState).toBeDefined();
    expect(entries.map(e => e.message)).toEqual(expect.arrayContaining([expect.stringContaining('Alice a rejoint la partie (1er joueur) avec 1 PV')]));
  });

  test('régression : les PV de départ suivent l\'ordre du tour, pas l\'ordre des places (1 PV pour le premier joueur)', async () => {
    const { game, entries } = await GameSetup.newGame(SEATS, { seed: TEST_SEED, firstPlayer: 2 });
    expect(game.firstPlayerIndex).toBe(2);
    expect(game.currentPlayerIndex).toBe(2);
    expect(game.players.map(p => p.score)).toEqual([2, 3, 1]);
    expect(entries.slice(0, 3).map(e => e.message)).toEqual([
      'Carol a rejoint la partie (1er joueur) avec 1 PV',
      'Alice a rejoint la partie (2ème joueur) avec 2 PV',
      'Bob a rejoint la partie (3ème joueur) avec 3 PV',
    ]);
  });

  test('régression (jeu local) : quand l\'humain ne commence pas, le robot qui commence a 1 PV', async () => {
    const game = await GameFactory.createGame(['Alice', 'Bob', 'Carol'], false, TEST_SEED);
    expect(game.firstPlayerIndex).not.toBe(0);
    expect(game.players[game.firstPlayerIndex].score).toBe(1);
    expect(game.players[0].score).toBe(game.players.length - game.firstPlayerIndex + 1);
  });

  test('premier joueur tiré au hasard : reproductible avec la graine ; « randomOther » ne choisit jamais la première place', async () => {
    const a = await GameSetup.newGame(SEATS, { seed: 7, firstPlayer: 'random' });
    const b = await GameSetup.newGame(SEATS, { seed: 7, firstPlayer: 'random' });
    expect(b.game.firstPlayerIndex).toBe(a.game.firstPlayerIndex);
    for (const seed of [1, 2, 3, 4, 5]) {
      expect((await GameSetup.newGame(SEATS, { seed, firstPlayer: 'randomOther' })).game.firstPlayerIndex).not.toBe(0);
    }
  });

  test('premier joueur invalide refusé ; setFirstPlayer ne modifie pas la partie reçue', async () => {
    await expect(GameSetup.newGame(SEATS, { firstPlayer: 3 })).rejects.toThrow('Premier joueur invalide');
    const game = await GameFactory.createGame(['Alice', 'Bob'], true, TEST_SEED);
    const before = JSON.stringify(game);
    const updated = GameFactory.setFirstPlayer(game, 1);
    expect(JSON.stringify(game)).toBe(before);
    expect(updated.players.map(p => p.score)).toEqual([2, 1]);
    expect(updated.gameLog.filter(l => l.message.includes('a rejoint'))).toHaveLength(2);
  });
});
