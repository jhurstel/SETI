import { Game, HistoryEntry } from './types';

/** Point de retour au début d'un tour : état à restaurer et nombre d'entrées d'historique à conserver */
export interface TurnUndoPoint {
  state: Game;
  keepCount: number;
}

/**
 * Retour au début du dernier tour joué par un joueur (bouton « annuler le tour »).
 * On cherche le dernier séparateur « --- Tour de … --- » de ce joueur suivi d'au moins une action annulable :
 * l'état à restaurer est celui d'avant cette première action, et l'historique est coupé juste avant elle
 * (les tours suivants, robots compris, sont effacés). Renvoie null s'il n'y a rien à annuler.
 */
export function findTurnUndoPoint(history: HistoryEntry[], playerId: string): TurnUndoPoint | null {
  for (let start = history.length - 1; start >= 0; start--) {
    const entry = history[start];
    if (!entry.message.startsWith('--- Tour de') || entry.playerId !== playerId) continue;

    const firstAction = history.findIndex((e, i) => i > start && !e.message.startsWith('---') && !!e.previousState);
    if (firstAction === -1) continue;
    // L'action doit appartenir à ce tour (avant le séparateur du tour suivant)
    const nextTurn = history.findIndex((e, i) => i > start && e.message.startsWith('--- Tour de'));
    if (nextTurn !== -1 && firstAction > nextTurn) continue;

    return { state: history[firstAction].previousState!, keepCount: firstAction };
  }
  return null;
}
