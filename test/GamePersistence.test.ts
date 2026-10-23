import { serializeGame, deserializeGame } from '../src/core/GamePersistence';
import { cloneGame } from '../src/core/cloneGame';
import { Game, HistoryEntry } from '../src/core/types';
import { createTestGame } from './helpers/gameFixture';

describe('GamePersistence', () => {
  let game: Game;
  let previous: Game;

  beforeEach(async () => {
    game = await createTestGame();
    previous = cloneGame(game);
    game.history = [{ state: cloneGame(game), timestamp: 1 }];
  });

  const entry = (message: string, sequenceId?: string, withState = true): HistoryEntry => ({
    id: message, message, playerId: 'player_0', timestamp: 1, sequenceId, previousState: withState ? previous : undefined,
  });

  test('aller-retour JSON : la partie est restituée à l\'identique (hors historique moteur)', () => {
    const log = [entry('a'), entry('b')];
    const { game: restored, historyLog } = deserializeGame(JSON.stringify(serializeGame(game, log)));

    expect(restored.players).toEqual(game.players);
    expect(restored.board).toEqual(game.board);
    expect(restored.decks).toEqual(game.decks);
    expect(restored.history).toEqual([]);
    expect(historyLog.map(e => e.message)).toEqual(['a', 'b']);
    expect(historyLog[0].previousInteractionState).toEqual({ type: 'IDLE' });
  });

  test('ne conserve l\'état d\'annulation que pour la dernière séquence', () => {
    const log = [entry('ancien', 'seq-1'), entry('ancien 2', 'seq-1'), entry('dernier', 'seq-2'), entry('dernier bis', 'seq-2')];
    const saved = serializeGame(game, log);

    expect(saved.gameLog.map(e => !!e.previousState)).toEqual([false, false, true, true]);
  });

  test('la dernière entrée sans séquence garde son état d\'annulation', () => {
    const saved = serializeGame(game, [entry('a'), entry('b')]);
    expect(saved.gameLog.map(e => !!e.previousState)).toEqual([false, true]);
  });

  test('les états sauvegardés ne contiennent ni historique moteur ni journal (pas de récursion)', () => {
    const saved = serializeGame(game, [entry('a')]);
    expect('history' in saved).toBe(false);
    expect('history' in saved.gameLog[0].previousState!).toBe(false);
    expect('gameLog' in saved.gameLog[0].previousState!).toBe(false);
  });

  test('ne modifie pas la partie sauvegardée', () => {
    const before = JSON.stringify(game);
    serializeGame(game, [entry('a')]);
    expect(JSON.stringify(game)).toBe(before);
  });
});
