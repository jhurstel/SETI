import { Game, HistoryEntry } from '../core/types';
import { serializeGame, SavedGame } from '../core/GamePersistence';
import { GAME_VERSION } from '../core/version';
import { ErrorLogEntry } from './errorLog';
import { versionLabel } from './version';

/**
 * Rapport « Signaler un problème » : tout ce qu'il faut pour reproduire un bug, dans un seul fichier JSON
 * que le joueur télécharge et envoie lui-même (rien n'est envoyé automatiquement).
 * En solo et dans le tutoriel, `save` est une sauvegarde complète : extraite dans un fichier, elle se recharge
 * par « Restaurer une sauvegarde ». En ligne, le client n'a que la vue du joueur : le jeton de place n'y est jamais.
 */

export type BugReportMode = 'solo' | 'tutorial' | 'online' | 'none';

export interface BugReportEnv {
  userAgent: string;
  screen: string;
  language: string;
}

export interface BugReportInput {
  comment: string;
  mode: BugReportMode;
  /** Partie locale affichée (solo, tutoriel) et son journal */
  game?: Game | null;
  historyLog?: HistoryEntry[];
  /** Autosauvegarde (JSON) : utilisée faute de partie affichée (écran d'erreur, accueil) */
  autosave?: string | null;
  /** Partie en ligne : code de la salle, joueur de cet écran, sa vue et son historique (jamais le jeton) */
  online?: { code: string; playerId: string; game?: Game | null; entries: HistoryEntry[] };
  errors: ErrorLogEntry[];
  env: BugReportEnv;
  now?: Date;
}

export interface BugReport {
  reportVersion: 1;
  gameVersion: string;
  build: string;
  date: string;
  env: BugReportEnv;
  mode: BugReportMode;
  comment: string;
  errors: ErrorLogEntry[];
  seed?: number;
  /** Sauvegarde complète (partie locale ou autosauvegarde) */
  save?: SavedGame | unknown;
  online?: { code: string; playerId: string; view?: SavedGame; };
}

/** Environnement du navigateur (hors tests : `window`, `navigator`) */
export function browserEnv(): BugReportEnv {
  return {
    userAgent: navigator.userAgent,
    screen: `${window.innerWidth}x${window.innerHeight} @${window.devicePixelRatio || 1}`,
    language: navigator.language,
  };
}

/** Construit le rapport (pur) */
export function buildBugReport(input: BugReportInput): BugReport {
  const report: BugReport = {
    reportVersion: 1,
    gameVersion: GAME_VERSION,
    build: versionLabel(),
    date: (input.now ?? new Date()).toISOString(),
    env: input.env,
    mode: input.mode,
    comment: input.comment.trim(),
    errors: input.errors,
  };
  if (input.online) {
    // Seuls le code et le joueur : la place (et son jeton) n'est jamais recopiée
    const { code, playerId, game, entries } = input.online;
    // La vue envoyée par le serveur n'a ni graine ni état du hasard (PlayerView) : rien de caché n'y figure
    report.online = { code, playerId, ...(game ? { view: serializeGame(game, entries, 0) } : {}) };
    return report;
  }
  if (input.game) {
    report.save = serializeGame(input.game, input.historyLog ?? []);
    if (input.game.seed !== undefined) report.seed = input.game.seed;
  } else if (input.autosave) {
    try {
      const save = JSON.parse(input.autosave) as { seed?: unknown };
      report.save = save;
      if (typeof save.seed === 'number') report.seed = save.seed;
    } catch {
      report.save = input.autosave;
    }
  }
  return report;
}

/** Nom du fichier du rapport : seti_rapport_2026-11-20-14-05-33.json */
export function bugReportFileName(now: Date = new Date()): string {
  return `seti_rapport_${now.toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
}
