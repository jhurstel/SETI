import { ActionType, HistoryEntry } from './types';

/** Tour d'un joueur dans l'historique : entrée « --- Tour de … --- » et première entrée de son action principale */
export interface TimelineTurn {
  playerId: string;
  /** Indice du séparateur du tour dans l'historique */
  entryIndex: number;
  /** Message de l'action principale du tour (absent : tour sans action principale marquée) */
  action?: string;
  /** Type de l'action principale (absent dans les sauvegardes d'avant son ajout) */
  actionType?: ActionType;
  /** Cible de l'action : planète (orbite, atterrissage), carte jouée, secteur scanné, technologie acquise */
  target?: string;
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

type TimelineEntry = Pick<HistoryEntry, 'message' | 'playerId' | 'mainAction' | 'mainActionType' | 'sequenceId'>;

/**
 * Cible d'une action principale lue dans les messages du moteur : dans le message de l'action (planète, carte),
 * ou dans une conséquence de la même séquence (premier secteur scanné, technologie acquise).
 */
const TARGET_PATTERNS: Partial<Record<ActionType, { inAction: boolean; pattern: RegExp }>> = {
  [ActionType.ORBIT]: { inAction: true, pattern: /autour de (.+?)(?: \(|$)/ },
  [ActionType.LAND]: { inAction: true, pattern: / sur (.+?)(?: \(|$)/ },
  [ActionType.PLAY_CARD]: { inAction: true, pattern: /jouer "([^"]+)"/ },
  [ActionType.SCAN_SECTOR]: { inAction: false, pattern: /dans le secteur (.+?)(?:,|$)/ },
  [ActionType.RESEARCH_TECH]: { inAction: false, pattern: /acquiert technologie "([^"]+)"/ },
};

/**
 * Découpe l'historique en manches et en tours (barre de progression de l'historique et de l'accueil).
 * Les entrées d'avant le premier tour (réservation de mise en place) et le décompte final sont ignorés.
 */
export function historyTimeline(entries: TimelineEntry[]): TimelineRound[] {
  const rounds: TimelineRound[] = [];
  let turn: TimelineTurn | undefined;
  // Séquence de l'action principale du tour, tant que sa cible reste à trouver dans ses conséquences
  let targetSequence: string | undefined;

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
      targetSequence = undefined;
      turn = { playerId: entry.playerId, entryIndex: index };
      round.turns.push(turn);
      return;
    }
    if (!turn) return;
    const target = turn.actionType && TARGET_PATTERNS[turn.actionType];
    if (target && targetSequence !== undefined && entry.sequenceId === targetSequence) {
      const found = entry.message.match(target.pattern);
      if (found) {
        turn.target = found[1];
        targetSequence = undefined;
      }
      return;
    }
    // Seule l'action principale du tour compte (pas les actions gratuites ni leurs conséquences)
    if (turn.action || !entry.mainAction || entry.playerId !== turn.playerId) return;
    turn.action = entry.message;
    targetSequence = undefined;
    if (!entry.mainActionType) return;
    turn.actionType = entry.mainActionType;
    const pattern = TARGET_PATTERNS[entry.mainActionType];
    if (!pattern) return;
    const found = pattern.inAction ? entry.message.match(pattern.pattern) : null;
    if (found) turn.target = found[1];
    else if (!pattern.inAction) targetSequence = entry.sequenceId;
  });

  return rounds;
}
