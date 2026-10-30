import { useEffect, useRef } from 'react';
import { Game, HistoryEntry } from '../../core/types';
import { serializeGame } from '../../core/GamePersistence';

const AUTOSAVE_KEY = 'seti_autosave';
/** Délai d'écriture : plusieurs changements rapprochés (étapes d'un robot, bonus en chaîne) n'écrivent qu'une fois */
const AUTOSAVE_DELAY_MS = 500;

/** Lit la sauvegarde automatique (JSON) ou null s'il n'y en a pas / si le stockage est inaccessible. */
export function readAutosave(): string | null {
  try {
    return localStorage.getItem(AUTOSAVE_KEY);
  } catch {
    return null;
  }
}

function writeAutosave(game: Game, historyLog: HistoryEntry[]): void {
  try {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(serializeGame(game, historyLog)));
  } catch (e) {
    console.warn("Erreur lors de la sauvegarde automatique (QuotaExceededError probable) :", e);
  }
}

/**
 * Sauvegarde automatiquement la partie et son journal après chaque modification
 * (écriture différée, faite immédiatement si la page est quittée).
 */
export function useAutosave(game: Game | null, historyLog: HistoryEntry[]): void {
  const latest = useRef<{ game: Game; historyLog: HistoryEntry[] } | null>(null);

  useEffect(() => {
    if (!game) return;
    latest.current = { game, historyLog };
    const timer = setTimeout(() => {
      writeAutosave(game, historyLog);
      latest.current = null;
    }, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [game, historyLog]);

  // Page fermée ou masquée avant l'écriture différée : sauvegarde immédiate
  useEffect(() => {
    const flush = () => {
      if (!latest.current) return;
      writeAutosave(latest.current.game, latest.current.historyLog);
      latest.current = null;
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', flush);
    };
  }, []);
}
