import { Game, GameLogEntry, HistoryEntry } from './types';
import { findTurnUndoPoint } from './TurnUndo';

/**
 * Version du format de sauvegarde. À incrémenter à chaque changement incompatible du modèle,
 * en ajoutant la migration correspondante dans MIGRATIONS.
 * - 1 : sauvegardes sans numéro de version (paliers Centauriens enregistrés comme de simples scores)
 * - 2 : paliers Centauriens enregistrés comme marqueurs { id, score, ... }
 * - 3 : effets des cartes Oumuamua à jetons et à signal (ET.21, ET.22, ET.24, ET.25, ET.28) lus comme effets de la carte
 */
export const SAVE_VERSION = 3;

/** Effets des cartes Oumuamua relus en version 3 (anciens effets permanents jamais traités) */
const OUMUAMUA_CARD_EFFECTS: Record<string, { type: string; target: string; value: string | number }> = {
  'ET.21': { type: 'OUMUAMUA_SIGNAL_BONUS', target: 'each', value: 'pv:2' },
  'ET.22': { type: 'OUMUAMUA_SIGNAL_BONUS', target: 'first', value: 'token:1' },
  'ET.24': { type: 'DISCARD_TOKEN_FOR', target: 'anysignal', value: 1 },
  'ET.25': { type: 'DISCARD_TOKENS_THEN_LAND', target: 'move', value: 2 },
  'ET.28': { type: 'DISCARD_TOKEN_FOR', target: 'data', value: 1 },
};
const OLD_OUMUAMUA_EFFECTS = ['GAIN_ON_OUMUAMUA_SIGNAL', 'GAIN_ON_TOKEN', 'GAIN_ON_TOKEN_AND_LAND'];

type RawEffect = { type: string };
type RawCard = { id?: unknown; passiveEffects?: RawEffect[]; permanentEffects?: RawEffect[]; requirements?: RawEffect[]; permanentBuffs?: RawEffect[] };

/** Parcourt tout l'état (mains, pioches, missions, cartes d'espèce…) et applique `visit` à chaque objet */
function visitObjects(value: unknown, visit: (obj: RawCard) => void): void {
  if (Array.isArray(value)) value.forEach(v => visitObjects(v, visit));
  else if (value && typeof value === 'object') {
    visit(value as RawCard);
    Object.values(value).forEach(v => visitObjects(v, visit));
  }
}

/** Partie sérialisée : le journal est stocké dans gameLog. */
export type SavedGame = Omit<Game, 'gameLog'> & { gameLog: GameLogEntry[]; saveVersion: number };

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
  // Cartes Oumuamua : l'effet est porté par la carte ; l'ancien effet permanent (cercle de mission, buff) disparaît
  2: state => {
    visitObjects(state, obj => {
      const removeOld = (effects?: RawEffect[]) => effects?.filter(e => !OLD_OUMUAMUA_EFFECTS.includes(e.type));
      if (obj.permanentEffects) obj.permanentEffects = removeOld(obj.permanentEffects);
      if (obj.requirements) obj.requirements = removeOld(obj.requirements);
      if (obj.permanentBuffs) obj.permanentBuffs = removeOld(obj.permanentBuffs);
      const effect = typeof obj.id === 'string' ? OUMUAMUA_CARD_EFFECTS[obj.id] : undefined;
      if (effect && obj.passiveEffects && !obj.passiveEffects.some(e => e.type === effect.type)) {
        obj.passiveEffects = [...obj.passiveEffects, { ...effect }];
      }
    });
  },
};

/** Amène un état sauvegardé au format courant. */
function migrateState(state: RawState, fromVersion: number): void {
  for (let v = fromVersion; v < SAVE_VERSION; v++) MIGRATIONS[v]?.(state);
}

/** Retire de l'état les champs récursifs ou volumineux qui n'ont pas leur place dans une sauvegarde. */
function stripForSave(state: Game): Omit<Game, 'gameLog'> {
  const { gameLog, ...rest } = state;
  return rest;
}

/** Nombre de commandes annulables dont l'état est gardé par une sauvegarde (environ 160 Ko chacun) */
export const SAVED_UNDO_STATES = 8;

/**
 * Prépare une partie et son journal pour la sauvegarde (autosave ou fichier).
 *
 * Pour limiter la taille, l'état d'annulation (`previousState`) n'est conservé que pour les `undoStates`
 * dernières commandes annulables et, si on en garde plusieurs, pour le début du dernier tour de chaque
 * joueur humain (« annuler le tour ») : après un rechargement, on peut encore annuler plusieurs actions de suite.
 */
export function serializeGame(game: Game, historyLog: HistoryEntry[], undoStates: number = SAVED_UNDO_STATES): SavedGame {
  const kept = new Set<number>();
  for (let i = historyLog.length - 1; i >= 0 && kept.size < undoStates; i--) {
    if (historyLog[i].previousState) kept.add(i);
  }
  if (undoStates > 1) {
    game.players.filter(p => p.type === 'human').forEach(p => {
      const point = findTurnUndoPoint(historyLog, p.id);
      if (point) kept.add(point.keepCount);
    });
  }

  return {
    ...stripForSave(game),
    saveVersion: SAVE_VERSION,
    gameLog: historyLog.map((entry, index) => {
      const keepState = kept.has(index);
      return {
        id: entry.id ?? '',
        message: entry.message,
        timestamp: entry.timestamp ?? 0,
        playerId: entry.playerId,
        sequenceId: entry.sequenceId,
        ...(entry.mainAction ? { mainAction: true } : {}),
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
  // Parties enregistrées avant sa suppression : historique d'annulation du moteur, inutilisé
  delete raw.history;

  const saved = raw as Partial<SavedGame> & Partial<Game>;
  const game = saved as Game;
  const historyLog: HistoryEntry[] = (saved.gameLog ?? []).map(log => ({
    id: log.id,
    message: log.message,
    playerId: log.playerId ?? '',
    timestamp: log.timestamp,
    previousInteractionState: { type: 'IDLE' },
    previousPendingInteractions: [],
    sequenceId: log.sequenceId,
    ...(log.mainAction ? { mainAction: true } : {}),
    previousState: log.previousState,
  }));
  return { game, historyLog };
}
