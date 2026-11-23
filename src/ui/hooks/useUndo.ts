import type { OnlineSession } from './useOnlineSession';
import type { useGameSession } from './useGameSession';

/**
 * Annulation, en local (journal de la session, robots compris ; `SessionJournal.canUndoLast`) ou en ligne (le serveur
 * n'accepte que l'annulation de ses propres actions de son tour en cours, tant que personne d'autre n'a joué depuis
 * et après la dernière révélation : `online.state.undo`).
 * Le retour au début du tour demande confirmation (`confirm`) ; `onDone` remet l'interface à zéro.
 */
export function useUndo({ isOnline, online, session, me, onError, confirm, onDone }: {
  isOnline: boolean;
  online: OnlineSession;
  session: ReturnType<typeof useGameSession>;
  me: string | undefined;
  onError: (message: string) => void;
  confirm: (message: string, onConfirm: () => void) => void;
  onDone: () => void;
}) {
  // La session décide (jeu local : SessionJournal, en ligne : le serveur)
  const canUndoLast = isOnline ? !!online.state.undo?.last : session.canUndoLast();
  const canUndoTurn = isOnline ? !!online.state.undo?.turn : session.canUndoTurn(me);
  const blockedReason = isOnline ? online.state.undo?.reason : session.undoBlockedReason();

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
    /** Rien d'annulable à cause d'une révélation (annulation stricte, en ligne) : raison affichée sur ↩ grisé */
    undoBlockedReason: canUndoLast ? undefined : blockedReason,
  };
}
