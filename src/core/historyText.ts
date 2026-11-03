/**
 * Passages privés des messages d'historique : ce qu'un seul joueur a le droit de lire (nom d'une carte
 * piochée face cachée…). Le moteur les marque avec `privateText` ; le journal local les révèle tous
 * (`revealText`, un joueur humain contre des robots), une vue réseau les retire pour les autres joueurs (`textFor`).
 */

const PRIVATE = /⟦([^|⟧]+)\|([^|⟧]*)(?:\|([^⟧]*))?⟧/g;

/** Marque `text` comme lisible par le seul joueur `ownerId` ; les autres lisent `publicText` (rien par défaut, « une carte »…) */
export const privateText = (ownerId: string, text: string, publicText?: string): string =>
  publicText === undefined ? `⟦${ownerId}|${text}⟧` : `⟦${ownerId}|${text}|${publicText}⟧`;

/** Message complet, marqueurs retirés */
export const revealText = (message: string): string => message.replace(PRIVATE, '$2');

/** Message tel que `viewerId` peut le lire : les passages privés des autres joueurs sont retirés */
export const textFor = (message: string, viewerId: string): string =>
  message
    .replace(PRIVATE, (_match, ownerId: string, text: string, publicText?: string) => (ownerId === viewerId ? text : publicText ?? ''))
    .replace(/ {2,}/g, ' ')
    .replace(/ ([,)])/g, '$1')
    .trim();
