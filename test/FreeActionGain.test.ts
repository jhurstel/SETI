import { CardSystem } from '../src/systems/CardSystem';
import { CostType, FreeActionType } from '../src/core/types';
import { cloneGame } from '../src/core/cloneGame';
import { createTestGame, mockFetchFromPublic } from './helpers/gameFixture';

describe('Défausse et jeu d\'une carte : gain et raisons affichés', () => {
  let fetchSpy: jest.SpyInstance;
  beforeAll(() => { fetchSpy = mockFetchFromPublic(); });
  afterAll(() => fetchSpy.mockRestore());

  test('gain de l\'action gratuite, le même que celui de la défausse', async () => {
    expect(CardSystem.freeActionGain(FreeActionType.PV_MOVEMENT)).toEqual({ pv: 1, movements: 1 });
    expect(CardSystem.freeActionGain(FreeActionType.TWO_MEDIA)).toEqual({ media: 2 });
    const game = await createTestGame();
    const player = game.players[game.currentPlayerIndex];
    const card = player.cards.find(c => c.freeAction === FreeActionType.MEDIA || c.freeAction === FreeActionType.DATA)!;
    const { updatedGame } = CardSystem.discardCardForFreeAction(game, player.id, card.id);
    const after = updatedGame.players.find(p => p.id === player.id)!;
    const gain = CardSystem.freeActionGain(card.freeAction)!;
    expect(after.mediaCoverage - player.mediaCoverage).toBe(gain.media ?? 0);
    expect(after.data - player.data).toBe(gain.data ?? 0);
  });

  test('carte trop chère : la raison donne ce qu\'elle nécessite', async () => {
    const game = cloneGame(await createTestGame());
    const player = game.players[game.currentPlayerIndex];
    const card = player.cards.find(c => c.cost > 0)!;
    player.credits = 0;
    player.energy = 0;
    const unit = card.costType === CostType.ENERGY ? 'énergie' : 'crédit';
    expect(CardSystem.canPlayCard(game, player.id, card)).toEqual({ canPlay: false, reason: `Nécessite ${card.cost} ${unit}${card.cost > 1 ? 's' : ''}` });
  });
});
