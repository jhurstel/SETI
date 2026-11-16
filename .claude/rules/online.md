---
paths:
  - "server/**"
  - "src/session/GameRoom.ts"
  - "src/session/protocol.ts"
  - "src/session/RemoteClient.ts"
  - "src/session/PlayerView.ts"
  - "src/ui/hooks/useOnlineSession.ts"
  - "src/ui/modals/OnlineModal.tsx"
  - "src/ui/serverUrl.ts"
  - "render.yaml"
  - "netlify.toml"
  - "test/{GameRoom,GameServer,RemoteClient,RobotPool,ServerLimits,RoomList,OnlineUndo}*.test.ts"
---

# Jeu en ligne et hébergement

Spec : `openspec/specs/online-play/spec.md`. Protocole détaillé pour le joueur : `public/docs/documentation.md` (section serveur).

## Serveur et salles

- **Jeu à distance** : `GameRoom` (pur, `test/GameRoom.test.ts`) tient la partie d'une salle et passe par `GameSession` ; `server/GameServer.ts` (WebSocket `ws`, `test/GameServer.test.ts` avec de vrais clients) gère les connexions, le rythme des robots (1,5 s), l'enregistrement des salles et les vues (`viewFor`, `viewEntries`). `server/` : `GameServer` (ws, salles, robots, fichiers), `RobotPool` + `robotWorker` (robots dans des worker_threads) ; `build/` et `data/` ignorés. Les cartes y sont lues sur disque (`DataLoader.setReader`).
- **Robots du serveur** : `GameRoom.robotStep(computer)` (asynchrone) fait calculer l'étape par un `RobotComputer` (`ai/robotCompute`) : sur place par défaut (tests), dans des `worker_threads` en production (`server/RobotPool.ts`, fil `server/robotWorker.ts` compilé par `server:build`, `ROBOT_THREADS` fils, 2 par défaut ; un fil qui tombe est remplacé et l'étape calculée sur place, `test/RobotPool.test.ts`) ; une étape dont la partie a changé pendant le calcul est abandonnée (`stale`) et recalculée ; une seule étape en calcul par salle (`GameServer.computing`). Plusieurs salles créent leur partie en même temps sans se gêner (voir Hasard dans `.claude/rules/engine.md`).
- **Premier joueur** tiré au hasard (le message `create` accepte un `firstPlayer`, gardé par la sauvegarde de la salle, que l'interface n'envoie plus).
- **Purge** : salles purgées après inactivité (`GameRoom.updatedAt`, `touch`, `isExpired`, `ROOM_EXPIRY` : terminée 6 h, salon 24 h, en cours 7 jours ; `GameServer.purge` au démarrage et toutes les heures, en mémoire et sur disque, jamais avec un joueur connecté) ; créations limitées (`maxRooms` 200, `createLimit` 5 par adresse IP en 10 min ; `test/ServerLimits.test.ts`).
- **Liste des salles** : `GameRoom.summary`, `GameServer.listRooms`, `GET /rooms` (CORS des origines autorisées, `test/RoomList.test.ts`), lue par l'onglet Rejoindre.
- **Annulation en ligne** (`GameRoom.undo`, message `undo`, `test/OnlineUndo.test.ts`) : seulement les commandes du joueur pendant son tour en cours, tant que personne d'autre n'a joué (points d'annulation en mémoire, effacés par la commande d'un autre joueur, une étape de robot ou la fin du tour). Le jeu local n'utilise pas le serveur.
- **Versions** : le serveur refuse un client d'une autre version mineure (`isCompatibleVersion`, `protocol.ts`).
- Lancement local : `npm run server` (server:build esbuild → `server/build`, puis server:start ; `PORT=8787`, `SETI_DATA_DIR=server/data`, `ALLOWED_ORIGINS`, `ROBOT_THREADS=2`).

## Client

- `session/RemoteClient.ts` (pur, `test/RemoteClient.test.ts` contre le vrai serveur : commandes et annulations avec accusé de réception `ack`, reconnexion automatique par le jeton, battement de cœur `ping`/`pong` qui détecte une connexion muette, `reconnectNow` au retour du réseau ou de la page, place perdue oubliée) ; `ui/hooks/useOnlineSession.ts` (place gardée dans `localStorage['seti_online']`), `ui/modals/OnlineModal.tsx` (créer, rejoindre, salon).
- Adresse du serveur : `__SERVER_URL__` injecté par Vite depuis `VITE_SERVER_URL` (en développement `ws://localhost:8787`), lu par `ui/serverUrl.ts` ; vide, le bouton « Partie en ligne » n'apparaît pas.
- Comportement de `BoardUI` en ligne (`run` asynchrone, `game`/`realGame`, attente, annulation par le serveur) : `.claude/rules/ui.md`. La partie solo (autosave) n'est jamais touchée par le jeu en ligne.

## Hébergement

- **Interface (Netlify, offre gratuite)** : https://my-seti.netlify.app (origine autorisée par le serveur, `ALLOWED_ORIGINS` dans `render.yaml`) ; site statique, `netlify.toml` (`npm run build`, publie `dist/`). Rien de plus à faire pour le jeu solo. Netlify ne peut pas héberger le serveur WebSocket (fonctions de courte durée). Pour le jeu en ligne, définir `VITE_SERVER_URL=wss://…` (adresse du serveur, en `wss://` car le site est en HTTPS) dans les variables d'environnement de Netlify. Offre gratuite : environ 300 crédits par mois (environ 10 crédits par Go de bande passante, comptes créés depuis septembre 2025 ; 100 Go par mois pour les plus anciens) ; les PDF de `public/docs` (52 Mo) ne se téléchargent qu'au clic.
- **Serveur (Render, offre gratuite, choisi)** : `render.yaml` (Blueprint : `npm ci && npm run server:build`, `npm run server:start`, `/health`, `ALLOWED_ORIGINS=https://my-seti.netlify.app`). WebSocket pris en charge ; le service s'endort après 15 min sans trafic (HTTP ou message WebSocket) et met environ 1 min à se réveiller. **Disque non conservé** : les salles enregistrées sont perdues à chaque redémarrage ou redéploiement (Render peut redémarrer à tout moment) ; accepté pour l'instant. Pour des parties durables : disque persistant payant, ou enregistrer les salles dans une base gratuite (remplacer l'écriture des salles de `GameServer`).
