/** Adresse du serveur du jeu en ligne (injectée par Vite, voir vite.config.ts) ; vide : pas de jeu en ligne */
declare const __SERVER_URL__: string | undefined;

export const SERVER_URL: string = typeof __SERVER_URL__ === 'string' ? __SERVER_URL__ : '';
