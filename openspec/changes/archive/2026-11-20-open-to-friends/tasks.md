# Tasks

## 1. Serveur gardé éveillé et pré-réveil

- [x] 1.1 Ajouter `.github/workflows/keep-awake.yml` (cron toutes les 10 min + `workflow_dispatch`, `curl -fsS --max-time 90 --retry 2` sur `https://seti-server.onrender.com/health`) ; vérifier la syntaxe avec `npx --yes @action-validator/cli` ou par une exécution manuelle depuis l'onglet Actions après le push
- [x] 1.2 Ajouter `healthUrl(serverUrl)` à côté de `roomsUrl` dans `src/session/protocol.ts` ; test Jest (`wss://…/` → `https://…/health`, `ws://localhost:8787` → `http://localhost:8787/health`)
- [x] 1.3 Créer `src/ui/serverWake.ts` (`wakeServer` : un seul `fetch` `no-cors`, erreurs ignorées, rien sans `SERVER_URL`) et l'appeler une fois au montage de `BoardUI` ; test de composant ou Jest avec `fetch` simulé : un appel avec l'adresse attendue, aucun sans adresse, pas d'erreur si le `fetch` échoue
- [x] 1.4 Dans `OnlineModal`, afficher « Réveil du serveur… (N s) » dans l'onglet Rejoindre tant que `/rooms` échoue depuis moins de 120 s, puis « Serveur injoignable pour le moment, réessayez plus tard » ; ajouter le compteur de secondes à l'écran de connexion ; test de composant (`test/components/`) avec horloge simulée
- [x] 1.5 Documenter le ping et le pré-réveil dans `.claude/rules/online.md` (Hébergement : workflow, limite des 750 h, repli cron-job.org) et vérifier que la spec `online-play` du changement correspond

## 2. Journal des erreurs et écran d'erreur

- [x] 2.1 Créer `src/ui/errorLog.ts` (tampon de 20 entrées, `record`, `list`, `subscribe`, regroupement des erreurs identiques consécutives) ; test Jest : limite de 20, ordre, regroupement, désabonnement
- [x] 2.2 Installer dans `src/main.tsx` les écouteurs `error` et `unhandledrejection` qui alimentent le journal ; test Jest (événements simulés sur `window` en jsdom)
- [x] 2.3 Créer `src/ui/components/ErrorBoundary.tsx` et son écran autonome (Recharger, Accueil, Signaler le problème), monté autour de `BoardUI` dans `main.tsx` ; test de composant : un enfant qui lève une erreur affiche l'écran et l'erreur est dans le journal, « Accueil » remonte l'application sur l'écran d'accueil, l'autosauvegarde et `seti_online` restent dans `localStorage`
- [x] 2.4 Afficher dans `BoardUI` un message discret « Un problème est survenu — Signaler » à chaque nouvelle erreur du journal (une seule fois par erreur identique) ; test de composant

## 3. Rapport de problème

- [x] 3.1 Créer `src/ui/bugReport.ts` (`buildBugReport` pur : version, date, environnement, mode, commentaire, erreurs ; solo et tutoriel : graine et `serializeGame` ; écran d'erreur : autosauvegarde relue ; en ligne : code, joueur, vue, historique, jamais le jeton) ; tests Jest avec `createTestGame()` : la sauvegarde du rapport passe par `deserializeGame` et redonne la même partie, aucun champ `token` dans un rapport en ligne, rapport sans partie valide
- [x] 3.2 Extraire le téléchargement de `SettingsModal.handleSaveGame` dans `src/ui/download.ts`, partagé par la sauvegarde et le rapport ; vérifier que la sauvegarde manuelle fonctionne toujours (test existant ou `npm run test:e2e`)
- [x] 3.3 Créer `src/ui/modals/BugReportModal.tsx` (commentaire, contenu du rapport, téléchargement `seti_rapport_<date>.json`, message de confirmation) et la brancher sur l'écran d'accueil, le message d'erreur et l'écran d'erreur ; test de composant : le téléchargement est demandé avec un JSON qui contient le commentaire, aucun `fetch` n'est fait
- [x] 3.4 Documenter « Signaler un problème » dans `public/docs/documentation.md` (où trouver le bouton, que contient le rapport, à qui l'envoyer) et, pour le développeur, comment recharger la sauvegarde d'un rapport (extraire `save` dans un fichier, « Charger ») dans `.claude/rules/ui.md`

## 4. Vérification d'ensemble

- [x] 4.1 `npm run check` sans erreur (agent `verificateur`) et `npm run test:e2e` vert
- [x] 4.2 Dans le navigateur (`npm run dev` + `npm run server`) : pré-réveil visible dans l'onglet réseau, erreur provoquée (console : `throw` dans un gestionnaire, et erreur de rendu forcée en développement) → message puis écran d'erreur, rapport téléchargé et sa sauvegarde rechargée par « Charger »
- [ ] 4.3 Après le push : lancer `keep-awake` à la main dans l'onglet Actions et vérifier une exécution verte, puis, une heure plus tard, que `/health` répond aussitôt

## Workflow follow-up

- Archiver le changement (`/openspec-archive-change`) une fois les tâches faites et la spec `error-reporting` créée dans `openspec/specs/`.
