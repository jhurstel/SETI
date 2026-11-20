/**
 * Journal des erreurs de la page : erreurs d'affichage (limite d'erreur), erreurs non traitées et promesses
 * rejetées (écouteurs de `window`, installés par `installErrorListeners` dans main.tsx). Joint au rapport
 * « Signaler un problème » ; chaque nouvelle erreur est annoncée aux abonnés (message discret de BoardUI).
 */

export type ErrorSource = 'render' | 'error' | 'promise';

export interface ErrorLogEntry {
  /** Instant de la dernière occurrence (ISO) */
  time: string;
  source: ErrorSource;
  message: string;
  stack?: string;
  /** Occurrences consécutives identiques regroupées */
  count: number;
}

/** Nombre d'erreurs gardées (les plus récentes) */
export const ERROR_LOG_SIZE = 20;

let entries: ErrorLogEntry[] = [];
const listeners = new Set<(entry: ErrorLogEntry, repeated: boolean) => void>();

/** Message et pile d'une valeur levée (Error, texte ou autre) */
function describe(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) return { message: error.message || error.name, stack: error.stack };
  if (typeof error === 'string') return { message: error };
  try {
    return { message: JSON.stringify(error) ?? String(error) };
  } catch {
    return { message: String(error) };
  }
}

/** Retient une erreur ; une erreur identique à la précédente augmente son compteur au lieu d'une nouvelle entrée */
export function recordError(error: unknown, source: ErrorSource, extraStack?: string): ErrorLogEntry {
  const { message, stack } = describe(error);
  const fullStack = [stack, extraStack].filter(Boolean).join('\n') || undefined;
  const time = new Date().toISOString();
  const last = entries[entries.length - 1];
  let entry: ErrorLogEntry;
  let repeated = false;
  if (last && last.message === message && last.source === source) {
    entry = { ...last, time, count: last.count + 1 };
    entries = [...entries.slice(0, -1), entry];
    repeated = true;
  } else {
    entry = { time, source, message, stack: fullStack, count: 1 };
    entries = [...entries, entry].slice(-ERROR_LOG_SIZE);
  }
  listeners.forEach(listener => listener(entry, repeated));
  return entry;
}

/** Erreurs retenues, de la plus ancienne à la plus récente */
export function listErrors(): ErrorLogEntry[] {
  return entries;
}

/** Abonnement aux nouvelles erreurs (`repeated` : même erreur que la précédente) ; rend la fonction de désabonnement */
export function subscribeErrors(listener: (entry: ErrorLogEntry, repeated: boolean) => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Vide le journal (tests) */
export function clearErrors(): void {
  entries = [];
}

/** Écouteurs globaux : erreurs non traitées et promesses rejetées sans `catch` ; rend la fonction qui les retire */
export function installErrorListeners(target: Window = window): () => void {
  const onError = (event: ErrorEvent) => recordError(event.error ?? event.message, 'error');
  const onRejection = (event: PromiseRejectionEvent) => recordError(event.reason, 'promise');
  target.addEventListener('error', onError);
  target.addEventListener('unhandledrejection', onRejection);
  return () => {
    target.removeEventListener('error', onError);
    target.removeEventListener('unhandledrejection', onRejection);
  };
}
