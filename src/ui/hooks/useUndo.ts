import { HistoryEntry } from '../../core/types';
import type { OnlineSession } from './useOnlineSession';
import type { useGameSession } from './useGameSession';

/**
 * Annulation, en local (journal de la session, robots compris) ou en ligne (le serveur n'accepte que l'annulation de
 * ses propres actions de son tour en cours, tant que personne d'autre n'a joué depuis : `online.state.undo`).
 * Le retour au début du tour demande confirmation (`confirm`) ; `onDone` remet l'interface à zéro.
 */
export function useUndo({ isOnline, online, session, me, historyLog, onError, confirm, onDone }: {
  isOnline: boolean;
  online: OnlineSession;
  session: ReturnType<typeof useGameSession>;
  me: string | undefined;
  historyLog: HistoryEntry[];
  onError: (message: string) => void;
  confirm: (message: string, onConfirm: () => void) => void;
  onDone: () => void;
}) {
  const lastEntry = historyLog[historyLog.length - 1];
  const canUndoLast = isOnline
    ? !!online.state.undo?.last
    : !!lastEntry && !lastEntry.message.startsWith('---') && (
      !!lastEntry.previousState || (!!lastEntry.sequenceId && historyLog.some(e => e.sequenceId === lastEntry.sequenceId && !!e.previousState)));
  const canUndoTurn = isOnline ? !!online.state.undo?.turn : session.canUndoTurn(me);

  const undoOnline = async (scope: 'last' | 'turn') => {
    const result = await online.undo(scope);
    if (result.error) onError(result.error);
    onDone();
  };

  const undoTurn = () => {
    if (!me) return;
    confirm(
      isOnline
        ? 'Revenir au début de votre tour ? Toutes vos actions de ce tour seront annulées.'
        : "Revenir au début de votre dernier tour ? Toutes les actions jouées depuis, y compris celles des robots, seront annulées.",
      () => {
        if (isOnline) {
          undoOnline('turn');
          return;
        }
        session.undoTurn(me);
        onDone();
      },
    );
  };

  const undoLast = () => {
    if (isOnline) {
      undoOnline('last');
      return;
    }
    session.undo();
    onDone();
  };

  return {
    /** Annuler la dernière action (absent : rien d'annulable) */
    onUndo: canUndoLast ? undoLast : undefined,
    /** Revenir au début du tour (absent : rien à annuler) */
    onUndoTurn: canUndoTurn ? undoTurn : undefined,
  };
}
