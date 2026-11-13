import { AIController } from '../src/ai/AIController';
import { ScoreManager } from '../src/engine/ScoreManager';
import { Game, LifeTraceType, ObjectiveCategory, ObjectiveTile } from '../src/core/types';
import { createTestGame, getPlayer } from './helpers/gameFixture';

const P1 = 'player_0';
const P2 = 'player_1';

/** Les 4 tuiles objectif avec des faces fixées (la mise en place les tire au hasard) */
function setTiles(game: Game, sides: Record<ObjectiveCategory, 'A' | 'B'>) {
  const rewards: Record<string, ObjectiveTile['rewards']> = {
    TECHNOLOGY_A: { first: 11, second: 8, others: 5 }, TECHNOLOGY_B: { first: 7, second: 5, others: 3 },
    MISSION_A: { first: 4, second: 3, others: 2 }, MISSION_B: { first: 8, second: 6, others: 4 },
    REVENUE_A: { first: 11, second: 8, others: 5 }, REVENUE_B: { first: 5, second: 4, others: 3 },
    OTHER_A: { first: 8, second: 6, others: 4 }, OTHER_B: { first: 8, second: 6, others: 4 },
  };
  game.board.objectiveTiles = game.board.objectiveTiles.map(tile => ({
    ...tile, side: sides[tile.category], rewards: rewards[`${tile.category}_${sides[tile.category]}`], markers: [],
  }));
}

const tileOf = (game: Game, category: ObjectiveCategory) => game.board.objectiveTiles.find(t => t.category === category)!;

/**
 * Choix de la tuile objectif par les robots (AIController.bestObjectiveTile) : la tuile qui promet le plus de points
 * en fin de partie, série actuelle plus progression habituelle, × récompense du rang obtenu.
 */
describe('Robots : choix de la tuile objectif', () => {
  let game: Game;
  let before: string;
  const freeze = () => { before = JSON.stringify(game); };
  const unchanged = () => expect(JSON.stringify(game)).toBe(before);

  beforeEach(async () => {
    game = await createTestGame();
    game.currentPlayerIndex = 0;
    game.currentRound = 2;
    game.players.forEach(p => { p.type = 'robot'; p.aiDifficulty = 'EXPERT'; });
    setTiles(game, { TECHNOLOGY: 'A', MISSION: 'A', REVENUE: 'A', OTHER: 'A' });
  });

  test('points projetés : série actuelle + progression habituelle de la manche, × récompense du rang', () => {
    const other = tileOf(game, ObjectiveCategory.OTHER);
    const p1 = getPlayer(game, P1);
    p1.lifeTraces = [LifeTraceType.RED, LifeTraceType.YELLOW, LifeTraceType.BLUE].map((type, i) => ({ id: `t${i}`, type, playerId: P1 }));
    expect(ScoreManager.objectiveTileSeries(p1, game.board, other)).toBe(1);
    freeze();
    // Manche 2 : la tuile « Autres A » gagne encore 1,06 série en moyenne ; 1re place : 8 PV par série
    expect(AIController.projectedObjectivePoints(game, p1, other)).toBeCloseTo((1 + 1.06) * 8);
    // Un adversaire déjà premier : 2e place, 6 PV par série
    other.markers = [P2];
    expect(AIController.projectedObjectivePoints(game, p1, other)).toBeCloseTo((1 + 1.06) * 6);
    // Dernière manche : presque plus de progression
    other.markers = [];
    game.currentRound = 5;
    expect(AIController.projectedObjectivePoints(game, p1, other)).toBeCloseTo((1 + 0.28) * 8);
  });

  test('séries nulles partout : la tuile au plus fort potentiel, pas une tuile au hasard', () => {
    freeze();
    // Manche 2, faces A : Technologies 0,77 × 11 = 8,5 ; Autres 1,06 × 8 = 8,5 ; Missions 0,98 × 4 = 3,9 ; Revenus 0,53 × 11 = 5,8
    const res = AIController.processInteractionQueue(game, [{ type: 'PLACING_OBJECTIVE_MARKER', milestone: 25 }], 's', getPlayer(game, P1));
    const chosen = res.updatedGame.board.objectiveTiles.find(t => t.markers.includes(P1))!;
    expect([ObjectiveCategory.TECHNOLOGY, ObjectiveCategory.OTHER]).toContain(chosen.category);
    expect(getPlayer(res.updatedGame, P1).claimedGoldenMilestones).toContain(25);
    unchanged();
  });

  test('une série déjà acquise l\'emporte, et une tuile où le joueur a déjà un marqueur est exclue', () => {
    getPlayer(game, P1).lifeTraces = [LifeTraceType.RED, LifeTraceType.YELLOW, LifeTraceType.BLUE, LifeTraceType.RED, LifeTraceType.YELLOW, LifeTraceType.BLUE]
      .map((type, i) => ({ id: `t${i}`, type, playerId: P1 }));
    expect(AIController.bestObjectiveTile(game, getPlayer(game, P1)).category).toBe(ObjectiveCategory.OTHER);

    tileOf(game, ObjectiveCategory.OTHER).markers = [P1];
    freeze();
    const res = AIController.processInteractionQueue(game, [{ type: 'PLACING_OBJECTIVE_MARKER', milestone: 50 }], 's', getPlayer(game, P1));
    const placed = res.updatedGame.board.objectiveTiles.filter(t => t.markers.includes(P1)).map(t => t.category);
    expect(placed).toHaveLength(2);
    expect(placed).toContain(ObjectiveCategory.TECHNOLOGY);
    unchanged();
  });

  test('niveau PASS (tests) : une tuile au hasard, toujours une tuile libre', () => {
    getPlayer(game, P1).aiDifficulty = 'PASS';
    tileOf(game, ObjectiveCategory.TECHNOLOGY).markers = [P1];
    freeze();
    const res = AIController.processInteractionQueue(game, [{ type: 'PLACING_OBJECTIVE_MARKER', milestone: 25 }], 's', getPlayer(game, P1));
    expect(res.updatedGame.board.objectiveTiles.filter(t => t.markers.includes(P1))).toHaveLength(2);
    unchanged();
  });
});
