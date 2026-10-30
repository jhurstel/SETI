import { SessionJournal } from '../src/session/SessionJournal';
import { Game, HistoryEntry } from '../src/core/types';
import { createTestGame } from './helpers/gameFixture';

const H = 'player_0';
const R = 'player_1';

describe('SessionJournal', () => {
  let game: Game;
  const state = (n: number): Game => ({ ...game, currentRound: n });
  const entry = (message: string, playerId = H, sequenceId?: string): HistoryEntry => ({ message, playerId, sequenceId });

  beforeEach(async () => {
    game = await createTestGame();
  });

  test('la première entrée d\'une commande garde l\'état d\'avant, avec un identifiant et une date', () => {
    const log = SessionJournal.append([], [entry('a', H, 's'), entry('b', H, 's')], state(1), [H]);
    expect(log[0]).toEqual(expect.objectContaining({ message: 'a', previousState: state(1) }));
    expect(log[0].id).toBeDefined();
    expect(log[0].timestamp).toBeDefined();
    expect(log[1].previousState).toBeUndefined();
    expect(SessionJournal.append(log, [], state(2), [H])).toBe(log);
  });

  test('annuler la dernière action : retour au début de sa séquence', () => {
    let log = SessionJournal.append([], [entry('action 1', H, 's1')], state(1), [H]);
    log = SessionJournal.append(log, [entry('action 2', H, 's2')], state(2), [H]);
    log = SessionJournal.append(log, [entry('choix de l\'action 2', H, 's2')], state(3), [H]);

    const undone = SessionJournal.undoLast(log)!;
    expect(undone.game).toBe(log[1].previousState);
    expect(undone.log.map(e => e.message)).toEqual(['action 1']);
    expect(SessionJournal.undoLast([])).toBeNull();
  });

  test('entrée sans séquence (fin de tour) : la dernière commande est annulée', () => {
    let log = SessionJournal.append([], [entry('action', H, 's1')], state(1), [H]);
    log = SessionJournal.append(log, [entry(`--- Tour de Robot ---`, R)], state(2), [H]);
    expect(SessionJournal.undoLast(log)!.game).toEqual(state(2));
  });

  test('les états antérieurs au dernier tour de chaque humain sont oubliés', () => {
    let log = SessionJournal.append([], [entry('--- Tour de Humain ---')], state(1), [H]);
    log = SessionJournal.append(log, [entry('action tour 1', H, 's1')], state(2), [H]);
    log = SessionJournal.append(log, [entry('--- Tour de Robot ---', R)], state(3), [H]);
    log = SessionJournal.append(log, [entry('--- Tour de Humain ---')], state(4), [H]);
    log = SessionJournal.append(log, [entry('action tour 2', H, 's2')], state(5), [H]);

    expect(log.filter(e => e.previousState).map(e => e.message)).toEqual(['--- Tour de Humain ---', 'action tour 2']);
    expect(SessionJournal.undoTurn(log, H)!.log.map(e => e.message)).toEqual(log.slice(0, 4).map(e => e.message));
    expect(SessionJournal.undoTurn(log, H)!.game).toEqual(state(5));
  });

  test('sans tour d\'humain encore commencé : tout est gardé', () => {
    const log = SessionJournal.append([], [entry('mise en place', H, 's')], state(1), [H]);
    expect(SessionJournal.prune(log, [H])).toBe(log);
  });
});
