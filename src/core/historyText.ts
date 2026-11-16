/**
 * Passages privés des messages d'historique : ce qu'un seul joueur a le droit de lire (nom d'une carte
 * piochée face cachée…). Le moteur les marque avec `privateText` ; l'historique affiché ne montre à chaque joueur
 * que les siens (`textFor`, jeu local compris), `revealText` donne le message complet (fin de partie, outils).
 */

const PRIVATE = /⟦([^|⟧]+)\|([^|⟧]*)(?:\|([^⟧]*))?⟧/g;

/** Marque `text` comme lisible par le seul joueur `ownerId` ; les autres lisent `publicText` (rien par défaut, « une carte »…) */
export const privateText = (ownerId: string, text: string, publicText?: string): string =>
  publicText === undefined ? `⟦${ownerId}|${text}⟧` : `⟦${ownerId}|${text}|${publicText}⟧`;

/** Nom d'un joueur cité dans un message (« les joueurs présents (A et B) ») : l'historique l'écrit dans sa couleur */
export const PLAYER_NAME = /⟪([^|⟫]+)\|([^⟫]*)⟫/g;
/** Même marque, sans groupe capturant (découpage d'un message par `split`) */
export const PLAYER_NAME_PART = /⟪[^|⟫]+\|[^⟫]*⟫/;

/** Marque le nom `name` du joueur `playerId` dans un message, pour l'écrire dans sa couleur */
export const playerText = (playerId: string, name: string): string => `⟪${playerId}|${name}⟫`;

/** Message sans marque de nom de joueur (texte simple : résumé d'un menu, journal) */
export const plainNames = (message: string): string => message.replace(PLAYER_NAME, '$2');

/** Message complet, marqueurs retirés */
export const revealText = (message: string): string => plainNames(message.replace(PRIVATE, '$2'));

/** Message tel que `viewerId` peut le lire : les passages privés des autres joueurs sont retirés */
export const textFor = (message: string, viewerId: string): string =>
  message
    .replace(PRIVATE, (_match, ownerId: string, text: string, publicText?: string) => (ownerId === viewerId ? text : publicText ?? ''))
    .replace(/ {2,}/g, ' ')
    .replace(/ ([,)])/g, '$1')
    .trim();
