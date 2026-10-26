import { Game, GameLogEntry, HistoryEntry } from './types';

/**
 * Version du format de sauvegarde. À incrémenter à chaque changement incompatible du modèle,
 * en ajoutant la migration correspondante dans MIGRATIONS.
 * - 1 : sauvegardes sans numéro de version (paliers Centauriens enregistrés comme de simples scores)
 * - 2 : paliers Centauriens enregistrés comme marqueurs { id, score, ... }
 */
export const SAVE_VERSION = 2;

/** Partie sérialisée : l'historique d'annulation du moteur est exclu, le journal est stocké dans gameLog. */
export type SavedGame = Omit<Game, 'history' | 'gameLog'> & { gameLog: GameLogEntry[]; saveVersion: number };

/** Sauvegarde illisible par cette version du jeu (format plus récent ou inconnu). */
export class SaveVersionError extends Error {}

/** État brut d'une sauvegarde, avant migration (les anciens formats ne respectent pas les types actuels). */
type RawState = Record<string, unknown>;

/**
 * Migrations successives : MIGRATIONS[v] fait passer un état du format v au format v + 1.
 * Elles s'appliquent à la partie et aux états d'annulation conservés dans le journal.
 */
const MIGRATIONS: Record<number, (state: RawState) => void> = {
  // Paliers Centauriens : simples scores → marqueurs
  1: state => {
    const players = (state.players ?? []) as { id: string; centaurienMilestones?: unknown[] }[];
    players.forEach(p => {
      p.centaurienMilestones = (p.centaurienMilestones || []).map((m, i) =>
        typeof m === 'number' ? { id: `centaurien-${p.id}-${i}`, score: m } : m);
    });
  },
};

/** Amène un état sauvegardé au format courant. */
function migrateState(state: RawState, fromVersion: number): void {
  for (let v = fromVersion; v < SAVE_VERSION; v++) MIGRATIONS[v]?.(state);
}

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
    saveVersion: SAVE_VERSION,
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
  const raw = JSON.parse(json) as RawState;
  const version = typeof raw.saveVersion === 'number' ? raw.saveVersion : 1;
  if (version > SAVE_VERSION) {
    throw new SaveVersionError(`Sauvegarde créée par une version plus récente du jeu (format ${version}, format géré : ${SAVE_VERSION}).`);
  }
  migrateState(raw, version);
  ((raw.gameLog ?? []) as GameLogEntry[]).forEach(log => {
    if (log.previousState) migrateState(log.previousState as unknown as RawState, version);
  });
  delete raw.saveVersion;

  const saved = raw as Partial<SavedGame> & Partial<Game>;
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
