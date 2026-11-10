import { SpeciesSystem } from '../src/systems/SpeciesSystem';
import { AIController } from '../src/ai/AIController';
import { Game, LifeTraceLocation, LifeTraceType } from '../src/core/types';
import { createTestGame, getPlayer } from './helpers/gameFixture';

const P1 = 'player_0';

/** Partie où un palier neutre a posé son marqueur sur la 1re couleur libre : le rouge du premier plateau */
async function gameWithNeutralRed(): Promise<Game> {
  const game = await createTestGame();
  game.board.alienBoards.forEach(board => { board.lifeTraces = []; });
  game.neutralMilestonesAvailable = { 20: 1 };
  const placed = SpeciesSystem.placeNeutralMilestone(game, 20);
  expect(placed.data).toEqual({ color: LifeTraceType.RED, boardIndex: 0 });
  return placed.updatedGame;
}

describe('Marqueur neutre sur le triangle d\'un plateau Alien', () => {
  test('régression : le marqueur neutre occupe le bonus de découverte, la trace suivante prend le bonus suivant', async () => {
    const game = await gameWithNeutralRed();
    const board = game.board.alienBoards[0];
    expect(board.lifeTraces[0]).toMatchObject({ playerId: 'neutral', location: LifeTraceLocation.TRIANGLE });
    const { score } = getPlayer(game, P1);

    const res = SpeciesSystem.placeLifeTrace(game, 0, LifeTraceType.RED, P1, 's', LifeTraceLocation.TRIANGLE);

    // Bonus suivant (3 PV), pas celui de découverte (5 PV et 1 Média)
    expect(getPlayer(res.updatedGame, P1).score).toBe(score + board.nextBonus.pv!);
    expect(board.firstBonus.pv).not.toBe(board.nextBonus.pv);
  });

  test('marqueur neutre d\'une ancienne sauvegarde (sans emplacement noté) : compté aussi', async () => {
    const game = await gameWithNeutralRed();
    delete game.board.alienBoards[0].lifeTraces[0].location;
    const { score } = getPlayer(game, P1);
    const res = SpeciesSystem.placeLifeTrace(game, 0, LifeTraceType.RED, P1, 's', LifeTraceLocation.TRIANGLE);
    expect(getPlayer(res.updatedGame, P1).score).toBe(score + game.board.alienBoards[0].nextBonus.pv!);
  });

  test('robot : il pose sa trace rouge sur le plateau dont le bonus de découverte est libre', async () => {
    const game = await gameWithNeutralRed();
    const robot = getPlayer(game, P1);
    robot.type = 'robot';
    robot.aiDifficulty = 'EXPERT';
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const res = AIController.processInteractionQueue(game, [{ type: 'PLACING_LIFE_TRACE', color: LifeTraceType.RED }], 'seq', robot);
      const mine = res.updatedGame.board.alienBoards.map(b => b.lifeTraces.filter(t => t.playerId === P1).length);
      expect(mine).toEqual([0, 1]);
    } finally {
      logSpy.mockRestore();
    }
  });
});
