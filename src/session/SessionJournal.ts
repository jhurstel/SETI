import { Game, HistoryEntry } from '../core/types';
import { findTurnUndoPoint } from '../core/TurnUndo';
import { uniqueId } from '../core/ids';

/**
 * Journal d'une session : l'historique affiché et les états d'annulation.
 * La première entrée de chaque commande garde l'état d'avant (file d'interactions comprise, elle est dans la partie).
 * Seuls les états depuis le début du dernier tour de chaque joueur humain sont gardés : l'annulation ne remonte
 * pas plus loin, et la mémoire reste bornée (un état complet par commande pèse environ 120 Ko).
 */
export class SessionJournal {
  /** Ajoute les entrées d'une commande (ou d'une étape de robot) jouée depuis l'état `before` */
  static append(log: HistoryEntry[], entries: HistoryEntry[], before: Game, humanIds: string[]): HistoryEntry[] {
    if (entries.length === 0) return log;
    const now = Date.now();
    const added = entries.map((entry, index) => ({
      ...entry,
      id: entry.id ?? uniqueId(),
      timestamp: entry.timestamp ?? now,
      previousState: index === 0 ? before : undefined,
    }));
    return this.prune([...log, ...added], humanIds);
  }

  /** Retire les états d'annulation antérieurs au début du dernier tour de chaque joueur humain */
  static prune(log: HistoryEntry[], humanIds: string[]): HistoryEntry[] {
    const turnStarts = humanIds.map(id => {
      for (let i = log.length - 1; i >= 0; i--) {
        if (log[i].playerId === id && log[i].message.startsWith('--- Tour de')) return i;
      }
      return 0;
    });
    const cutoff = Math.min(...turnStarts, log.length);
    if (cutoff === 0 || !log.slice(0, cutoff).some(e => e.previousState)) return log;
    return log.map((entry, index) => (index < cutoff && entry.previousState ? { ...entry, previousState: undefined } : entry));
  }

  /**
   * Annule la dernière action : tout ce qui suit le début de sa séquence (la première entrée de la séquence
   * qui garde un état), ou à défaut la dernière commande. Null si rien n'est annulable.
   */
  static undoLast(log: HistoryEntry[]): { game: Game; log: HistoryEntry[] } | null {
    const last = log[log.length - 1];
    if (!last) return null;
    let index = -1;
    if (last.sequenceId) index = log.findIndex(e => e.sequenceId === last.sequenceId && !!e.previousState);
    if (index === -1) {
      for (let i = log.length - 1; i >= 0 && index === -1; i--) if (log[i].previousState) index = i;
    }
    if (index === -1) return null;
    return { game: log[index].previousState!, log: log.slice(0, index) };
  }

  /** Retour au début du dernier tour du joueur (robots compris après lui), null si rien n'est annulable */
  static undoTurn(log: HistoryEntry[], playerId: string): { game: Game; log: HistoryEntry[] } | null {
    const point = findTurnUndoPoint(log, playerId);
    return point ? { game: point.state, log: log.slice(0, point.keepCount) } : null;
  }
}
