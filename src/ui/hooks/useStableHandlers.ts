import { useLayoutEffect, useRef } from 'react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Handler = (...args: any[]) => unknown;

/**
 * Handlers stables pour les plateaux mémoïsés (React.memo) : chaque fonction garde la même identité d'un rendu à
 * l'autre et appelle la dernière version reçue. Un plateau ne se redessine donc plus quand seul un handler a changé
 * (message, annonce, fenêtre de confirmation…). Une valeur absente reste absente (bouton masqué).
 * À n'appeler que depuis des événements (clics, survols), jamais pendant le rendu.
 */
export function useStableHandlers<T extends Record<string, Handler | undefined>>(handlers: T): T {
  const latest = useRef(handlers);
  useLayoutEffect(() => { latest.current = handlers; });
  const stable = useRef<Record<string, Handler>>({});
  const result = {} as Record<string, Handler | undefined>;
  for (const key of Object.keys(handlers)) {
    if (!handlers[key]) {
      result[key] = undefined;
      continue;
    }
    stable.current[key] ??= (...args: unknown[]) => latest.current[key]?.(...args);
    result[key] = stable.current[key];
  }
  return result as T;
}
