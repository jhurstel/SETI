import { serializeGame, deserializeGame, SAVE_VERSION, SaveVersionError } from '../src/core/GamePersistence';
import { cloneGame } from '../src/core/cloneGame';
import { Game, HistoryEntry } from '../src/core/types';
import { createTestGame } from './helpers/gameFixture';

describe('GamePersistence', () => {
  let game: Game;
  let previous: Game;

  beforeEach(async () => {
    game = await createTestGame();
    previous = cloneGame(game);
  });

  const entry = (message: string, sequenceId?: string, withState = true): HistoryEntry => ({
    id: message, message, playerId: 'player_0', timestamp: 1, sequenceId, previousState: withState ? previous : undefined,
  });

  test('aller-retour JSON : la partie est restituée à l\'identique', () => {
    const log = [entry('a'), entry('b')];
    const { game: restored, historyLog } = deserializeGame(JSON.stringify(serializeGame(game, log)));

    expect(restored.players).toEqual(game.players);
    expect(restored.board).toEqual(game.board);
    expect(restored.decks).toEqual(game.decks);
    expect(historyLog.map(e => e.message)).toEqual(['a', 'b']);
    expect(historyLog[0].previousInteractionState).toEqual({ type: 'IDLE' });
  });

  test('retire l\'historique d\'annulation du moteur des anciennes sauvegardes', () => {
    const old = { ...serializeGame(game, [entry('a')]), history: [{ state: previous, timestamp: 1 }] };
    const { game: restored } = deserializeGame(JSON.stringify(old));

    expect('history' in restored).toBe(false);
    expect(restored.players).toEqual(game.players);
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

  test('les états sauvegardés ne contiennent pas le journal (pas de récursion)', () => {
    const saved = serializeGame(game, [entry('a')]);
    expect('gameLog' in saved.gameLog[0].previousState!).toBe(false);
  });

  test('la sauvegarde porte la version du format, absente de la partie relue', () => {
    const saved = serializeGame(game, [entry('a')]);
    expect(saved.saveVersion).toBe(SAVE_VERSION);
    const { game: restored } = deserializeGame(JSON.stringify(saved));
    expect('saveVersion' in restored).toBe(false);
  });

  test('migre une sauvegarde sans version (paliers Centauriens en scores), journal compris', () => {
    const saved = serializeGame(game, [entry('a')]) as unknown as Record<string, unknown>;
    delete saved.saveVersion;
    const legacy = JSON.parse(JSON.stringify(saved));
    legacy.players[0].centaurienMilestones = [12, 30];
    legacy.gameLog[0].previousState.players[0].centaurienMilestones = [12];

    const { game: restored, historyLog } = deserializeGame(JSON.stringify(legacy));
    const id = restored.players[0].id;
    expect(restored.players[0].centaurienMilestones).toEqual([
      { id: `centaurien-${id}-0`, score: 12 },
      { id: `centaurien-${id}-1`, score: 30 },
    ]);
    expect(historyLog[0].previousState!.players[0].centaurienMilestones).toEqual([{ id: `centaurien-${id}-0`, score: 12 }]);
  });

  test("refuse une sauvegarde d'un format plus récent", () => {
    const saved = { ...serializeGame(game, []), saveVersion: SAVE_VERSION + 1 };
    expect(() => deserializeGame(JSON.stringify(saved))).toThrow(SaveVersionError);
  });

  test('ne modifie pas la partie sauvegardée', () => {
    const before = JSON.stringify(game);
    serializeGame(game, [entry('a')]);
    expect(JSON.stringify(game)).toBe(before);
  });
});
