/**
 * Traces du moteur et des robots dans la console, filtrées par niveau.
 *
 * - `info` : traces de développement (décision de chaque robot, action jouée). Masquées par défaut (production,
 *   serveur, tests) ; l'interface les affiche en développement (`setTraceLevel('info')` dans main.tsx).
 * - `warn` : un cas imprévu dont le moteur s'est sorti (robot qui passe faute de pouvoir résoudre un palier…).
 * - `error` : une vraie erreur (cartes introuvables, exception pendant une commande).
 *
 * Le journal de la partie (gameLog, historique affiché au joueur) est autre chose : core/Logger.ts.
 */
export type TraceLevel = 'info' | 'warn' | 'error' | 'silent';

const ORDER: Record<TraceLevel, number> = { info: 0, warn: 1, error: 2, silent: 3 };
let current: TraceLevel = 'warn';

/** Niveau minimal des traces affichées (`warn` par défaut) */
export function setTraceLevel(level: TraceLevel): void {
  current = level;
}

export function traceLevel(): TraceLevel {
  return current;
}

const shown = (level: Exclude<TraceLevel, 'silent'>) => ORDER[level] >= ORDER[current];

export const trace = {
  info: (...args: unknown[]): void => { if (shown('info')) console.log(...args); },
  warn: (...args: unknown[]): void => { if (shown('warn')) console.warn(...args); },
  error: (...args: unknown[]): void => { if (shown('error')) console.error(...args); },
};
