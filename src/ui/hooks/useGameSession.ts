import { useCallback, useRef, useState } from 'react';
import { Game, HistoryEntry } from '../../core/types';
import { DispatchResult, GameSession, RobotStepInput } from '../../session/GameSession';
import { SessionJournal } from '../../session/SessionJournal';
import { Command } from '../../session/commands';
import { findTurnUndoPoint } from '../../core/TurnUndo';

/** Étape d'un robot et état du générateur atteint par son calcul (ai/robotCompute) */
export type RobotStep = { step: RobotStepInput; rngState: number };

const humanIds = (game: Game) => game.players.filter(p => p.type === 'human').map(p => p.id);

/**
 * Partie en cours côté interface : l'état vient toujours de GameSession (commandes des joueurs, étapes des robots),
 * le journal de SessionJournal (historique et annulation). Les refs donnent l'état le plus récent aux commandes
 * enchaînées dans un même événement (pas d'une sonde, par exemple).
 */
export function useGameSession() {
  const [game, setGameState] = useState<Game | null>(null);
  const [historyLog, setHistoryLog] = useState<HistoryEntry[]>([]);
  const gameRef = useRef<Game | null>(null);
  const logRef = useRef<HistoryEntry[]>([]);

  const show = useCallback((next: Game, log: HistoryEntry[]) => {
    gameRef.current = next;
    logRef.current = log;
    setGameState(next);
    setHistoryLog(log);
  }, []);

  const commit = useCallback((before: Game, result: DispatchResult) => {
    show(result.game, SessionJournal.append(logRef.current, result.entries, before, humanIds(result.game)));
  }, [show]);

  /** Commande d'un joueur ; renvoie le résultat (erreur comprise) pour l'affichage */
  const dispatch = useCallback((playerId: string, command: Command): DispatchResult => {
    const current = gameRef.current;
    if (!current) return { game: current!, entries: [], notifications: [], error: 'Aucune partie en cours' };
    const result = GameSession.dispatch(current, playerId, command);
    if (!result.error) commit(current, result);
    return result;
  }, [commit]);

  /** Étape d'un robot calculée par AITurn (dans le Web Worker) */
  const applyRobotStep = useCallback((step: RobotStep): DispatchResult | null => {
    const current = gameRef.current;
    if (!current) return null;
    const result = GameSession.applyRobotStep(current, step.step, step.rngState);
    if (!result.error) commit(current, result);
    return result;
  }, [commit]);

  /** Nouvelle partie ou partie chargée (avec son journal) */
  const load = useCallback((loaded: Game, log: HistoryEntry[] = []): DispatchResult => {
    const started = GameSession.start(loaded);
    show(started.game, SessionJournal.append(log, started.entries, loaded, humanIds(started.game)));
    return started;
  }, [show]);

  /** Outils de débogage : remplace la partie (annulable) */
  const replace = useCallback((next: Game, message: string, playerId: string) => {
    const current = gameRef.current;
    if (!current) return;
    show(next, SessionJournal.append(logRef.current, [{ message, playerId }], current, humanIds(next)));
  }, [show]);

  const undo = useCallback(() => {
    const undone = SessionJournal.undoLast(logRef.current);
    if (undone) show(undone.game, undone.log);
  }, [show]);

  const undoTurn = useCallback((playerId: string) => {
    const undone = SessionJournal.undoTurn(logRef.current, playerId);
    if (undone) show(undone.game, undone.log);
  }, [show]);

  const canUndoTurn = (playerId: string | undefined) => !!playerId && !!findTurnUndoPoint(historyLog, playerId);

  return { game, gameRef, historyLog, dispatch, applyRobotStep, load, replace, undo, undoTurn, canUndoTurn };
}
