import { Game, HistoryEntry } from '../core/types';
import { findTurnUndoPoint, lastBarrierIndex } from '../core/TurnUndo';
import { uniqueId } from '../core/ids';
import { GameSession } from './GameSession';
import { REVELATION_REASON, revealedTo } from './Revelation';

/** Commande (ou étape de robot) dont on ajoute les entrées : partie obtenue et auteur */
export interface JournalCommand {
  after: Game;
  playerId: string;
  /** Étape de robot : le hasard qu'il tire pour décider n'est pas une révélation */
  robot?: boolean;
}

/**
 * Journal d'une session : l'historique affiché et les états d'annulation.
 * La première entrée de chaque commande garde l'état d'avant (file d'interactions comprise, elle est dans la partie) ;
 * une commande qui n'écrit rien (ouverture d'un achat, renoncement) laisse une entrée technique `silent`, non
 * affichée, pour rester annulable à elle seule. Avec l'annulation stricte (`game.strictUndo`), la première entrée
 * d'une commande qui révèle une information cachée au joueur humain porte une barrière : aucun état d'avant elle
 * n'est plus restauré.
 * Seuls les états depuis le début de l'avant-dernier tour de chaque joueur humain sont gardés : on peut encore
 * revenir au début du tour qu'on vient de finir (robots compris) avant de rejouer, mais pas plus loin,
 * et la mémoire reste bornée (un état complet par commande pèse environ 120 Ko).
 */
export class SessionJournal {
  /**
   * Ajoute les entrées d'une commande (ou d'une étape de robot) jouée depuis l'état `before`. Sans `command`
   * (chargement, outils de débogage), seules les entrées comptent.
   */
  static append(log: HistoryEntry[], entries: HistoryEntry[], before: Game, humanIds: string[], command?: JournalCommand): HistoryEntry[] {
    let added: HistoryEntry[];
    if (entries.length > 0) {
      const now = Date.now();
      added = entries.map((entry, index) => ({
        ...entry,
        id: entry.id ?? uniqueId(),
        timestamp: entry.timestamp ?? now,
        previousState: index === 0 ? before : undefined,
      }));
    } else if (command && command.after !== before) {
      const sequenceId = command.after.interaction?.sequenceId;
      added = [{ id: uniqueId(), message: '', playerId: command.playerId, timestamp: Date.now(), silent: true, previousState: before, ...(sequenceId ? { sequenceId } : {}) }];
    } else {
      return log;
    }
    if (command?.after.strictUndo && revealedTo(before, command.after, humanIds, { actorId: command.playerId, ignoreRng: command.robot })) {
      added[0] = { ...added[0], barrier: true };
    }
    return this.prune([...log, ...added], humanIds);
  }

  /** Retire les états d'annulation antérieurs au début de l'avant-dernier tour de chaque joueur humain */
  static prune(log: HistoryEntry[], humanIds: string[]): HistoryEntry[] {
    const turnStarts = humanIds.map(id => {
      const starts: number[] = [];
      for (let i = log.length - 1; i >= 0 && starts.length < 2; i--) {
        if (log[i].playerId === id && log[i].message.startsWith('--- Tour de')) starts.push(i);
      }
      return starts.length === 2 ? starts[1] : 0;
    });
    const cutoff = Math.min(...turnStarts, log.length);
    if (cutoff === 0 || !log.slice(0, cutoff).some(e => e.previousState)) return log;
    return log.map((entry, index) => (index < cutoff && entry.previousState ? { ...entry, previousState: undefined } : entry));
  }

  /**
   * Annule la dernière commande : tout ce qui suit le début de sa séquence (la première entrée de la séquence
   * qui garde un état), ou à défaut la dernière commande, jamais avant une barrière. Null si rien n'est annulable.
   */
  static undoLast(log: HistoryEntry[]): { game: Game; log: HistoryEntry[] } | null {
    const last = log[log.length - 1];
    if (!last) return null;
    const barrier = lastBarrierIndex(log);
    let index = -1;
    if (last.sequenceId) index = log.findIndex((e, i) => i > barrier && e.sequenceId === last.sequenceId && !!e.previousState);
    if (index === -1) {
      for (let i = log.length - 1; i > barrier && index === -1; i--) if (log[i].previousState) index = i;
    }
    if (index === -1) return null;
    return { game: log[index].previousState!, log: log.slice(0, index) };
  }

  /** Retour au début du dernier tour du joueur (robots compris après lui), null si rien n'est annulable */
  static undoTurn(log: HistoryEntry[], playerId: string): { game: Game; log: HistoryEntry[] } | null {
    const point = findTurnUndoPoint(log, playerId);
    return point ? { game: point.state, log: log.slice(0, point.keepCount) } : null;
  }

  /**
   * « Annuler la dernière action » est-il proposé ? Pas pendant qu'un robot joue (son étape serait rejouée à
   * l'identique), pas juste après un séparateur de tour, ni quand rien n'est annulable.
   */
  static canUndoLast(log: HistoryEntry[], game: Game): boolean {
    const last = log[log.length - 1];
    return !!last && !last.message.startsWith('---') && !GameSession.robotCanPlay(game) && !!this.undoLast(log);
  }

  /** Raison affichée quand l'annulation stricte bloque la dernière action du tour en cours (sinon undefined) */
  static undoBlockedReason(log: HistoryEntry[], game: Game): string | undefined {
    if (!game.strictUndo || GameSession.robotCanPlay(game) || this.canUndoLast(log, game)) return undefined;
    const barrier = lastBarrierIndex(log);
    let turnStart = log.length - 1;
    while (turnStart >= 0 && !log[turnStart].message.startsWith('--- Tour de')) turnStart--;
    return barrier !== -1 && barrier > turnStart ? REVELATION_REASON : undefined;
  }
}
