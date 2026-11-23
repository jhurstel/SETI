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
    expect(SessionJournal.undoLast([entry('trop ancienne', H, 's0')])).toBeNull();
  });

  test('entrée sans séquence (fin de tour) : la dernière commande est annulée', () => {
    let log = SessionJournal.append([], [entry('action', H, 's1')], state(1), [H]);
    log = SessionJournal.append(log, [entry(`--- Tour de Robot ---`, R)], state(2), [H]);
    expect(SessionJournal.undoLast(log)!.game).toEqual(state(2));
  });

  test('les états antérieurs à l\'avant-dernier tour de chaque humain sont oubliés', () => {
    let log: HistoryEntry[] = [];
    [1, 2, 3].forEach(turn => {
      log = SessionJournal.append(log, [entry('--- Tour de Humain ---')], state(turn * 10), [H]);
      log = SessionJournal.append(log, [entry(`action tour ${turn}`, H, `s${turn}`)], state(turn * 10 + 1), [H]);
      log = SessionJournal.append(log, [entry('--- Tour de Robot ---', R)], state(turn * 10 + 2), [H]);
    });

    // Tours 2 et 3 gardés, tour 1 oublié
    expect(log.filter(e => e.previousState).map(e => e.message)).toEqual([
      '--- Tour de Humain ---', 'action tour 2', '--- Tour de Robot ---', '--- Tour de Humain ---', 'action tour 3', '--- Tour de Robot ---',
    ]);
    expect(SessionJournal.undoTurn(log, H)!.game).toEqual(state(31));
  });

  test('sans tour d\'humain encore commencé : tout est gardé', () => {
    const log = SessionJournal.append([], [entry('mise en place', H, 's')], state(1), [H]);
    expect(SessionJournal.prune(log, [H])).toBe(log);
  });

  test('commande sans entrée : entrée technique silencieuse, avec la séquence de l\'interaction ouverte', () => {
    const opened: Game = { ...state(2), interaction: { type: 'ACQUIRING_CARD', count: 1, sequenceId: 'buy' } };
    let log = SessionJournal.append([], [entry('lance une sonde', H, 'launch')], state(1), [H]);
    log = SessionJournal.append(log, [], state(2), [H], { after: opened, playerId: H });
    expect(log[1]).toEqual(expect.objectContaining({ message: '', silent: true, playerId: H, sequenceId: 'buy', previousState: state(2) }));
    expect(SessionJournal.undoLast(log)!.game).toEqual(state(2));
    // Sans changement de la partie, ou sans commande connue : rien n'est ajouté
    expect(SessionJournal.append(log, [], opened, [H], { after: opened, playerId: H })).toBe(log);
    expect(SessionJournal.append(log, [], state(3), [H])).toBe(log);
  });

  test('barrière : aucun état d\'avant elle n\'est restauré', () => {
    let log = SessionJournal.append([], [entry('--- Tour de Humain ---')], state(1), [H]);
    log = SessionJournal.append(log, [entry('action 1', H, 's1')], state(2), [H]);
    log = [...log, { ...entry('pioche', H, 's2'), previousState: state(3), barrier: true }];
    expect(SessionJournal.undoLast(log)).toBeNull();
    expect(SessionJournal.undoTurn(log, H)).toBeNull();
    log = SessionJournal.append(log, [entry('échange', H, 's3')], state(4), [H]);
    expect(SessionJournal.undoLast(log)!.game).toEqual(state(4));
    expect(SessionJournal.undoTurn(log, H)!.game).toEqual(state(4));
  });

  test('raison du blocage : seulement en annulation stricte, pour une barrière du tour en cours', () => {
    const strict: Game = { ...state(5), strictUndo: true };
    const blocked = [{ ...entry('--- Tour de Humain ---') }, { ...entry('pioche', H, 's'), previousState: state(4), barrier: true }];
    expect(SessionJournal.undoBlockedReason(blocked, strict)).toBeDefined();
    expect(SessionJournal.undoBlockedReason(blocked, state(5))).toBeUndefined();
    // Barrière d'un tour précédent : pas de raison au début du tour suivant
    expect(SessionJournal.undoBlockedReason([...blocked, entry('--- Tour de Robot ---', R)], strict)).toBeUndefined();
    expect(SessionJournal.undoBlockedReason([entry('--- Tour de Humain ---')], strict)).toBeUndefined();
  });
});
