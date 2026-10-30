import { GAME_VERSION } from '../core/version';

/** Commit du build (injecté par Vite, absent hors build) */
declare const __BUILD_COMMIT__: string | undefined;

/** « Version 1.1.0 (38e9f6e) » */
export const versionLabel = (): string => {
  const commit = typeof __BUILD_COMMIT__ === 'string' && __BUILD_COMMIT__ ? ` (${__BUILD_COMMIT__})` : '';
  return `Version ${GAME_VERSION}${commit}`;
};
