import { useEffect } from 'react';
import { Game, HistoryEntry } from '../../core/types';
import { serializeGame } from '../../core/GamePersistence';

const AUTOSAVE_KEY = 'seti_autosave';

/** Lit la sauvegarde automatique (JSON) ou null s'il n'y en a pas / si le stockage est inaccessible. */
export function readAutosave(): string | null {
  try {
    return localStorage.getItem(AUTOSAVE_KEY);
  } catch {
    return null;
  }
}

/** Sauvegarde automatiquement la partie et son journal à chaque modification. */
export function useAutosave(game: Game | null, historyLog: HistoryEntry[]): void {
  useEffect(() => {
    if (!game) return;
    try {
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(serializeGame(game, historyLog)));
    } catch (e) {
      console.warn("Erreur lors de la sauvegarde automatique (QuotaExceededError probable) :", e);
    }
  }, [game, historyLog]);
}
