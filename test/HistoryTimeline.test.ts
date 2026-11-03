import { historyTimeline } from '../src/core/historyTimeline';
import { GameSession } from '../src/session/GameSession';
import { serializeGame, deserializeGame } from '../src/core/GamePersistence';
import { ActionType, GamePhase, HistoryEntry } from '../src/core/types';
import { AITurn, AIStep } from '../src/ai/AITurn';
import { createTestGame, getPlayer } from './helpers/gameFixture';

const entry = (message: string, playerId = '', mainAction?: boolean): HistoryEntry => ({ message, playerId, ...(mainAction ? { mainAction } : {}) });

describe('historyTimeline : manches et tours de l\'historique', () => {
  test('manches, tours, action principale marquée (sinon la première action du joueur), manche terminée', () => {
    const log = [
      entry('--- DÉBUT DE LA PARTIE ---'),
      entry('réserve "X"', 'a'),
      entry('--- Manche 1 / 5 ---'),
      entry('--- Tour de A ---', 'a'),
      entry('transfère 1 donnée', 'a'),
      entry('lance une sonde', 'a', true),
      entry('gagne 1 Média', 'b'),
      entry('--- Tour de B ---', 'b'),
      entry('passe', 'b'),
      entry('--- FIN DE LA MANCHE 1 ---'),
      entry('--- Manche 2 / 5 ---'),
      entry('--- Tour de A ---', 'a'),
    ];
    expect(historyTimeline(log)).toEqual([
      { round: 1, entryIndex: 2, complete: true, turns: [
        { playerId: 'a', entryIndex: 3, action: 'lance une sonde' },
        { playerId: 'b', entryIndex: 7, action: 'passe' },
      ] },
      { round: 2, entryIndex: 10, complete: false, turns: [{ playerId: 'a', entryIndex: 11 }] },
    ]);
  });

  test('sans en-tête de la première manche : le premier tour ouvre la manche 1', () => {
    const rounds = historyTimeline([entry('--- Tour de A ---', 'a'), entry('passe', 'a', true), entry('--- FIN DE LA MANCHE 1 ---'), entry('--- Manche 2 / 5 ---')]);
    expect(rounds.map(r => [r.round, r.entryIndex, r.turns.length, r.complete])).toEqual([[1, 0, 1, true], [2, 3, 0, false]]);
  });

  test('historique vide ou sans manche : aucune manche', () => {
    expect(historyTimeline([])).toEqual([]);
    expect(historyTimeline([entry('--- PHASE DE RÉSERVATION ---'), entry('réserve "X"', 'a')])).toEqual([]);
  });

  test('la session marque l\'action principale du joueur et celle du robot ; la sauvegarde garde la marque', async () => {
    const game = await createTestGame();
    game.phase = GamePhase.PLAYING;
    game.currentPlayerIndex = 0;
    getPlayer(game, 'player_0').credits = 10;
    const launched = GameSession.dispatch(game, 'player_0', { type: 'LAUNCH_PROBE' });
    expect(launched.error).toBeUndefined();
    expect(launched.entries.filter(e => e.mainAction)).toHaveLength(1);
    expect(launched.entries.find(e => e.mainAction)!.message).toContain('sonde');

    const transfer = GameSession.dispatch(launched.game, 'player_0', { type: 'END_TURN' });
    expect(transfer.entries.some(e => e.mainAction)).toBe(false);

    const { historyLog } = deserializeGame(JSON.stringify(serializeGame(game, launched.entries)));
    expect(historyLog.filter(e => e.mainAction)).toHaveLength(1);
  });

  test("robot : seule l'étape de son action principale est marquée", async () => {
    const game = await createTestGame();
    game.phase = GamePhase.PLAYING;
    game.currentPlayerIndex = 0;
    const robot = getPlayer(game, 'player_0');
    robot.type = 'robot';
    robot.credits = 10;
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    type Step = Omit<Extract<AIStep, { kind: 'UPDATED' }>, 'kind'>;
    const step = (AITurn as unknown as { playMainAction(g: unknown, p: unknown, d: unknown): Step }).playMainAction(game, robot, { action: ActionType.LAUNCH_PROBE });
    const played = GameSession.applyRobotStep(game, { kind: 'UPDATED', ...step });
    logSpy.mockRestore();
    expect(played.entries.filter(e => e.mainAction)).toHaveLength(1);
    expect(played.entries[0].mainAction).toBe(true);

    // Étape sans action principale (rien de neuf) : pas de marque
    const idle = GameSession.applyRobotStep(played.game, { kind: 'UPDATED', updatedGame: played.game, historyEntries: [entry('transfère 1 donnée', 'player_0')] });
    expect(idle.entries.some(e => e.mainAction)).toBe(false);
  });
});
