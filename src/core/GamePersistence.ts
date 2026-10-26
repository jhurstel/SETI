import { Game, GameLogEntry, HistoryEntry } from './types';

/** Partie sérialisée : l'historique d'annulation du moteur est exclu, le journal est stocké dans gameLog. */
export type SavedGame = Omit<Game, 'history' | 'gameLog'> & { gameLog: GameLogEntry[] };

/** Retire de l'état les champs récursifs ou volumineux qui n'ont pas leur place dans une sauvegarde. */
function stripForSave(state: Game): Omit<Game, 'history' | 'gameLog'> {
  const { history, gameLog, ...rest } = state;
  return rest;
}

/**
 * Prépare une partie et son journal pour la sauvegarde (autosave ou fichier).
 *
 * Pour limiter la taille, l'état d'annulation (`previousState`) n'est conservé que pour la
 * dernière entrée et pour les entrées de la dernière séquence : on peut ainsi annuler
 * la dernière action après un rechargement.
 */
export function serializeGame(game: Game, historyLog: HistoryEntry[]): SavedGame {
  const lastSequenceId = historyLog[historyLog.length - 1]?.sequenceId;

  return {
    ...stripForSave(game),
    gameLog: historyLog.map((entry, index) => {
      const isLast = index === historyLog.length - 1;
      const inLastSequence = !!lastSequenceId && entry.sequenceId === lastSequenceId;
      const keepState = !!entry.previousState && (isLast || inLastSequence);
      return {
        id: entry.id ?? '',
        message: entry.message,
        timestamp: entry.timestamp ?? 0,
        playerId: entry.playerId,
        sequenceId: entry.sequenceId,
        previousState: keepState ? (stripForSave(entry.previousState!) as Game) : undefined,
      };
    }),
  };
}

/** Relit une sauvegarde (JSON) : renvoie la partie prête pour le moteur et le journal pour l'interface. */
export function deserializeGame(json: string): { game: Game; historyLog: HistoryEntry[] } {
  const saved = JSON.parse(json) as Partial<Game>;
  const game = { ...saved, history: saved.history ?? [] } as Game;
  const historyLog: HistoryEntry[] = (saved.gameLog ?? []).map(log => ({
    id: log.id,
    message: log.message,
    playerId: log.playerId ?? '',
    timestamp: log.timestamp,
    previousInteractionState: { type: 'IDLE' },
    previousPendingInteractions: [],
    sequenceId: log.sequenceId,
    previousState: log.previousState,
  }));
  return { game, historyLog };
}
