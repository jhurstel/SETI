import * as path from 'path';
import { GameServer } from './GameServer';
import { GAME_VERSION } from '../src/core/version';

/**
 * Serveur du jeu à distance : `npm run server`. Variables : PORT (8787 par défaut), SETI_DATA_DIR (server/data par
 * défaut, où chaque salle est enregistrée), ALLOWED_ORIGINS (origines des pages autorisées, séparées par des virgules ;
 * vide : toutes).
 */
// Compilé dans server/build/index.js : la racine du projet est deux dossiers au-dessus
const root = path.resolve(__dirname, '..', '..');
const port = Number(process.env.PORT) || 8787;
const server = new GameServer({
  publicDir: path.join(root, 'public'),
  dataDir: process.env.SETI_DATA_DIR || path.join(root, 'server', 'data'),
  allowedOrigins: (process.env.ALLOWED_ORIGINS || '').split(',').map(origin => origin.trim()).filter(Boolean),
});

server.listen(port).then(actual => {
  console.log(`[Serveur] SETI ${GAME_VERSION} : ws://localhost:${actual} (${server.rooms.size} salle(s) reprise(s))`);
});

const stop = () => server.close().then(() => process.exit(0));
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
