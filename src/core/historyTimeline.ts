import { HistoryEntry } from './types';

/** Tour d'un joueur dans l'historique : entrée « --- Tour de … --- » et première entrée de son action principale */
export interface TimelineTurn {
  playerId: string;
  /** Indice du séparateur du tour dans l'historique */
  entryIndex: number;
  /** Message de l'action principale (à défaut, la première action du joueur pendant le tour) */
  action?: string;
}

/** Manche de l'historique et ses tours, dans l'ordre */
export interface TimelineRound {
  round: number;
  /** Indice du séparateur « --- Manche … --- » dans l'historique */
  entryIndex: number;
  turns: TimelineTurn[];
  /** La manche est terminée (« --- FIN DE LA MANCHE … --- ») */
  complete: boolean;
}

type TimelineEntry = Pick<HistoryEntry, 'message' | 'playerId' | 'mainAction'>;

/**
 * Découpe l'historique en manches et en tours (barre de progression de l'historique et de l'accueil).
 * Les entrées d'avant le premier tour (réservation de mise en place) et le décompte final sont ignorés.
 */
export function historyTimeline(entries: TimelineEntry[]): TimelineRound[] {
  const rounds: TimelineRound[] = [];
  let turn: TimelineTurn | undefined;
  // L'action principale marquée du tour a été trouvée (elle remplace la première action notée)
  let marked = false;

  entries.forEach((entry, index) => {
    // Historique sans en-tête de la première manche (partie commencée sans mise en place) : le premier tour l'ouvre
    if (rounds.length === 0 && entry.message.startsWith('--- Tour de')) rounds.push({ round: 1, entryIndex: index, turns: [], complete: false });
    const round = rounds[rounds.length - 1];
    const roundStart = entry.message.match(/^--- Manche (\d+)/);
    if (roundStart) {
      rounds.push({ round: Number(roundStart[1]), entryIndex: index, turns: [], complete: false });
      turn = undefined;
      return;
    }
    if (!round) return;
    if (entry.message.startsWith('--- FIN DE LA MANCHE') || entry.message.startsWith('--- DÉCOMPTE FINAL')) {
      round.complete = true;
      turn = undefined;
      return;
    }
    if (entry.message.startsWith('--- Tour de')) {
      turn = { playerId: entry.playerId, entryIndex: index };
      marked = false;
      round.turns.push(turn);
      return;
    }
    if (!turn || entry.message.startsWith('---') || entry.playerId !== turn.playerId) return;
    if (entry.mainAction && !marked) {
      turn.action = entry.message;
      marked = true;
    } else if (!turn.action) {
      turn.action = entry.message;
    }
  });

  return rounds;
}
