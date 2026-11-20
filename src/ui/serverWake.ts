import { useEffect, useState } from 'react';
import { healthUrl } from '../session/protocol';
import { SERVER_URL } from './serverUrl';

/**
 * Réveil du serveur du jeu en ligne (offre gratuite de Render : endormi après 15 min sans trafic,
 * environ une minute pour se réveiller). Appelé une fois à l'ouverture du jeu : le temps que le joueur
 * ouvre « Partie en ligne », le serveur est souvent réveillé. Une tâche planifiée le garde aussi éveillé
 * (.github/workflows/keep-awake.yml).
 */

/** Au-delà de ce délai sans réponse, le serveur est annoncé injoignable (comme les reprises de RemoteClient) */
export const WAKE_TIMEOUT_MS = 120_000;

/**
 * Appelle le contrôle de santé du serveur, sans attendre ni signaler d'erreur. `/health` n'envoie pas
 * d'en-têtes CORS : la requête part en `no-cors` (la réponse n'est pas lue, la requête suffit à réveiller).
 */
export function wakeServer(serverUrl: string = SERVER_URL, fetchFn: typeof fetch | undefined = globalThis.fetch): void {
  if (!serverUrl || !fetchFn) return;
  try {
    fetchFn(healthUrl(serverUrl), { mode: 'no-cors', cache: 'no-store' }).catch(() => { /* serveur injoignable : rien à signaler */ });
  } catch {
    /* fetch indisponible : rien à signaler */
  }
}

/** Texte d'attente du serveur, d'après l'instant du premier échec (ou du début de la connexion) */
export function serverWaitText(since: number, now: number): { text: string; givenUp: boolean } {
  const elapsed = Math.max(0, now - since);
  if (elapsed >= WAKE_TIMEOUT_MS) return { text: 'Serveur injoignable pour le moment, réessayez plus tard.', givenUp: true };
  return { text: `Réveil du serveur… (${Math.floor(elapsed / 1000)} s)`, givenUp: false };
}

/** Instant courant, rafraîchi chaque seconde tant que `active` (compteur d'attente) */
export function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}
