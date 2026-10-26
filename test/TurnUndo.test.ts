import { findTurnUndoPoint } from '../src/core/TurnUndo';
import { Game, HistoryEntry } from '../src/core/types';

const state = (label: string) => ({ id: label } as unknown as Game);
const turn = (playerId: string): HistoryEntry => ({ message: `--- Tour de ${playerId} ---`, playerId });
const action = (playerId: string, label?: string): HistoryEntry => ({ message: `action ${label ?? ''}`, playerId, previousState: label ? state(label) : undefined });

describe('findTurnUndoPoint', () => {
  test("revient avant la première action du dernier tour du joueur et efface la suite (tours des robots compris)", () => {
    const history = [turn('H'), action('H', 's0'), turn('R'), action('R', 'r0'), turn('H'), action('H', 's1'), action('H', 's2'), turn('R'), action('R', 'r1')];
    expect(findTurnUndoPoint(history, 'H')).toEqual({ state: state('s1'), keepCount: 5 });
  });

  test("un tour sans action annulable est ignoré : on remonte au tour précédent", () => {
    const history = [turn('H'), action('H', 's0'), turn('R'), action('R', 'r0'), turn('H'), action('H'), turn('R')];
    expect(findTurnUndoPoint(history, 'H')).toEqual({ state: state('s0'), keepCount: 1 });
  });

  test("une action d'un tour suivant n'est pas prise pour celle du tour du joueur", () => {
    const history = [turn('H'), turn('R'), action('R', 'r0')];
    expect(findTurnUndoPoint(history, 'H')).toBeNull();
  });

  test('rien à annuler : null', () => {
    expect(findTurnUndoPoint([], 'H')).toBeNull();
  });
});
