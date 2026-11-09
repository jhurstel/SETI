import { ScoreManager } from '../src/engine/ScoreManager';
import { SpeciesSystem } from '../src/systems/SpeciesSystem';
import { AlienBoardType, Game, GAME_CONSTANTS, ObjectiveCategory, ObjectiveTile } from '../src/core/types';
import { createTestGame, getPlayer } from './helpers/gameFixture';

const P1 = 'player_0';

describe('décompte et paliers : cas limites', () => {
  let game: Game;

  beforeEach(async () => {
    game = await createTestGame();
  });

  /** Revenus glissés au-delà du départ : 1 crédit, 3 énergies, 0 carte */
  function reserveRevenues() {
    const player = getPlayer(game, P1);
    player.revenueCredits = GAME_CONSTANTS.INITIAL_REVENUE_CREDITS + 1;
    player.revenueEnergy = GAME_CONSTANTS.INITIAL_REVENUE_ENERGY + 3;
    player.revenueCards = GAME_CONSTANTS.INITIAL_REVENUE_CARDS;
    return player;
  }
  const revenueTile = (side: 'A' | 'B'): ObjectiveTile => ({ ...game.board.objectiveTiles.find(t => t.category === ObjectiveCategory.REVENUE)!, side });

  test('tuile Revenus : face A, séries des 3 types ; face B, le type le plus réservé', () => {
    const player = reserveRevenues();
    expect(ScoreManager.objectiveTileSeries(player, game.board, revenueTile('A'))).toBe(0);
    expect(ScoreManager.objectiveTileSeries(player, game.board, revenueTile('B'))).toBe(3);
  });

  test('tuile objectif : le 3e marqueur et les suivants reçoivent la récompense « autres »', () => {
    const player = reserveRevenues();
    const tile = revenueTile('B');
    game.board.objectiveTiles = [{ ...tile, markers: ['x', 'y', P1] }];
    const details: string[] = [];
    const total = ScoreManager['calculateObjectiveTiles'](player, game.board, details);
    expect(total).toBe(3 * tile.rewards.others);
    expect(details).toEqual([`${tile.name} B : 3 × ${tile.rewards.others} PV = ${3 * tile.rewards.others} PV`]);
  });

  test('palier Centaurien atteint quand plus aucune tuile Message n\'est libre : résolu sans choix', () => {
    const species = game.species.find(s => s.name === AlienBoardType.CENTAURIENS)!;
    species.message!.forEach(token => (token.isAvailable = false));
    SpeciesSystem.addCentaurienMarker(getPlayer(game, P1));
    const marker = getPlayer(game, P1).centaurienMilestones[0];
    getPlayer(game, P1).score = marker.score;

    const check = ScoreManager.checkScoreMilestones(game, P1);
    expect(check.newInteraction).toBeUndefined();
    expect(getPlayer(check.updatedGame, P1).centaurienMilestones[0].resolved).toBe('Message décodé : plus aucune tuile Message disponible');
    expect(marker.resolved).toBeUndefined();
  });
});
