import { GameSession } from '../src/session/GameSession';
import { CardSystem } from '../src/systems/CardSystem';
import { GamePhase } from '../src/core/types';
import { createTestGame, getPlayer } from './helpers/gameFixture';

describe('fin de manche par la dernière passe', () => {
  test('régression : le dernier à passer qui devient premier joueur peut jouer son action principale', async () => {
    const game = await createTestGame();
    game.phase = GamePhase.PLAYING;
    game.currentRound = 2;
    // Bob a déjà passé ; Alice passe en dernier et le marqueur Premier joueur lui revient (1 → 0)
    game.firstPlayerIndex = 1;
    game.currentPlayerIndex = 0;
    getPlayer(game, 'player_1').hasPassed = true;
    const alice = getPlayer(game, 'player_0');
    alice.credits = 10;

    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const passed = GameSession.dispatch(game, 'player_0', {
      type: 'PASS',
      cardsToKeep: CardSystem.getHandCards(alice).slice(0, 4).map(c => c.id),
    });
    // La carte de fin de manche 2 est choisie après la passe, une fois la manche 3 commencée
    expect(passed.game.interaction).toEqual(expect.objectContaining({ type: 'CHOOSING_ROUND_CARD', round: 2 }));
    const chosen = GameSession.dispatch(passed.game, 'player_0', { type: 'CHOOSE', choice: { kind: 'CARD', cardId: game.decks.roundDecks[2][0].id } });
    logSpy.mockRestore();

    expect(passed.error).toBeUndefined();
    expect(chosen.error).toBeUndefined();
    expect(chosen.game.currentRound).toBe(3);
    expect(chosen.game.currentPlayerIndex).toBe(0);
    expect(getPlayer(chosen.game, 'player_0').hasPerformedMainAction).toBe(false);
    const launched = GameSession.dispatch(chosen.game, 'player_0', { type: 'LAUNCH_PROBE' });
    expect(launched.error).toBeUndefined();
  });

  test('régression : un palier doré atteint avant de passer se déclenche à la passe, avant la fin de la manche', async () => {
    const game = await createTestGame();
    game.phase = GamePhase.PLAYING;
    game.currentRound = 2;
    // Bob a déjà passé ; Alice, à 26 PV, passe à son tour
    game.currentPlayerIndex = 0;
    getPlayer(game, 'player_1').hasPassed = true;
    const alice = getPlayer(game, 'player_0');
    alice.score = 26;
    const before = JSON.stringify(game);

    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const passed = GameSession.dispatch(game, 'player_0', { type: 'PASS', cardsToKeep: CardSystem.getHandCards(alice).slice(0, 4).map(c => c.id) });
    const chosen = GameSession.dispatch(passed.game, 'player_0', { type: 'CHOOSE', choice: { kind: 'CARD', cardId: game.decks.roundDecks[2][0].id } });
    logSpy.mockRestore();

    expect(JSON.stringify(game)).toBe(before);
    expect(chosen.error).toBeUndefined();
    // Le palier 25 attend son marqueur : la manche n'est pas encore finie
    expect(chosen.game.interaction).toEqual(expect.objectContaining({ type: 'PLACING_OBJECTIVE_MARKER', milestone: 25 }));
    expect(chosen.game.currentRound).toBe(2);

    const tile = chosen.game.board.objectiveTiles[0];
    const placed = GameSession.dispatch(chosen.game, 'player_0', { type: 'CHOOSE', choice: { kind: 'OBJECTIVE', tileId: tile.id } });
    expect(placed.error).toBeUndefined();
    expect(placed.game.board.objectiveTiles[0].markers).toContain('player_0');
    expect(getPlayer(placed.game, 'player_0').claimedGoldenMilestones).toContain(25);
    // Puis la manche se termine
    expect(placed.game.currentRound).toBe(3);
    expect(placed.game.endingTurn).toBe(false);
    expect(placed.entries.map(e => e.message)).toContain('--- FIN DE LA MANCHE 2 ---');
  });
});
