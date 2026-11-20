# Design

## Context

Voir `proposal.md` (Why) et les specs `error-reporting` et `online-play`.

État actuel observé :
- `RemoteClient` réessaie déjà la connexion pendant 2 minutes (`maxRetryTime` 120 s, délais 1, 2 puis 5 s) et `OnlineModal` affiche « Le serveur peut mettre jusqu'à une minute à se réveiller » pendant la connexion. En revanche, l'onglet Rejoindre (`useRoomList`, `GET /rooms` toutes les 5 s) affiche « Serveur injoignable » dès le premier échec, et rien ne réveille le serveur avant que le joueur ouvre la fenêtre.
- `src/main.tsx` monte `<BoardUI/>` sans limite d'erreur ; il n'existe aucun écouteur `window.onerror` ni `unhandledrejection`.
- La sauvegarde vers un fichier existe déjà (`SettingsModal.handleSaveGame` : `serializeGame` puis `showSaveFilePicker` ou lien `download`), comme l'autosauvegarde (`readAutosave`, `localStorage`), et la place en ligne (`localStorage['seti_online']`, avec son jeton).
- Render (offre gratuite) s'endort après 15 min sans trafic entrant ; 750 h d'instance par mois, soit un mois complet pour un seul service.

Tout se passe dans la couche **ui** (plus un workflow GitHub) : moteur, robots, session et serveur ne changent pas.

## Goals / Non-Goals

**Goals:**
- Aucun écran blanc : toute erreur de rendu aboutit à un écran d'où l'on peut repartir.
- Un rapport unique, autonome, qui suffit à reproduire un bug solo (sauvegarde rechargeable telle quelle).
- Premier ami du soir : serveur déjà réveillé dans le cas courant, attente compréhensible sinon.

**Non-Goals:**
- Collecte centralisée des rapports ou télémétrie.
- Récupération automatique d'une partie dont l'autosauvegarde fait planter l'affichage (le joueur peut signaler, puis lancer une nouvelle partie).

## Decisions

### 1. Ping : workflow GitHub Actions planifié
`.github/workflows/keep-awake.yml`, `on: schedule: cron '*/10 * * * *'` et `workflow_dispatch`, un seul pas : `curl -fsS --max-time 90 --retry 2 https://seti-server.onrender.com/health`. Fichier séparé de `ci.yml`, donc un échec ne colore pas la CI. Dépôt public : minutes d'Actions gratuites.
- Alternatives : UptimeRobot ou cron-job.org (gratuits, intervalle 5 min, plus ponctuels), mais configurés hors du dépôt et liés à un compte tiers ; gardés comme repli documenté si GitHub retarde trop les exécutions.
- Limite connue : GitHub ne garantit pas l'heure des tâches planifiées (retards de 5 à 20 min fréquents) et désactive les workflows planifiés d'un dépôt sans activité depuis 60 jours. D'où le pré-réveil (décision 2), qui couvre les trous.
- L'adresse est écrite en dur dans le workflow (comme `ALLOWED_ORIGINS` dans `render.yaml`) ; commentaire qui renvoie à `.claude/rules/online.md`.

### 2. Pré-réveil : `fetch(/health)` au montage de l'application
Module `ui/serverWake.ts` : `wakeServer()` fait un seul `fetch(healthUrl(SERVER_URL), { mode: 'no-cors' })` sans attendre ni afficher d'erreur, si `SERVER_URL` est défini. Appelé une fois au montage de `BoardUI` (pas dans `main.tsx`, pour rester testable avec les composants). `healthUrl` se construit comme `roomsUrl` (`protocol.ts` : `wss://` → `https://`) ; une fonction pure à côté de `roomsUrl`, sans changement du protocole. `/health` n'envoie pas d'en-têtes CORS (seul `/rooms` en a) : `no-cors` suffit, la réponse n'est pas lue, seule la requête compte pour réveiller Render. Le serveur ne change donc pas.

### 3. Attente affichée dans l'onglet Rejoindre
`useRoomList` mémorise l'instant du premier échec consécutif ; tant que moins de 120 s se sont écoulées, le texte est « Réveil du serveur… (N s) » (rafraîchi chaque seconde), ensuite « Serveur injoignable pour le moment, réessayez plus tard ». Même seuil que `maxRetryTime` du client. L'écran de connexion existant reçoit aussi le compteur de secondes.

### 4. Écran d'erreur : limite d'erreur React autour de `BoardUI`
`ui/components/ErrorBoundary.tsx` (composant de classe, seul moyen en React 18/19), monté dans `main.tsx`. Son écran `CrashScreen` est volontairement autonome : pas de dépendance au contexte ni à l'état de `BoardUI` (qui vient d'échouer), styles en ligne ou CSS minimal. Boutons :
- **Recharger** : `location.reload()`. L'autosauvegarde et `seti_online` sont intacts, donc « Continuer » et la reprise en ligne fonctionnent comme après une fermeture d'onglet.
- **Accueil** : remet la limite à zéro (nouvelle clé de `BoardUI`) ; `BoardUI` démarre sur l'écran d'accueil sans relire la partie.
- **Signaler le problème** : rapport (décision 6) construit depuis l'autosauvegarde, puisque l'état React est perdu.

### 5. Journal des erreurs et message non bloquant
`ui/errorLog.ts` : tampon circulaire de 20 entrées `{ time, message, stack?, source: 'render' | 'error' | 'promise' }`, alimenté par la limite d'erreur et par `window.addEventListener('error' | 'unhandledrejection')` installés dans `main.tsx`. Abonnement minimal (`subscribe`) pour que `BoardUI` montre un message discret avec « Signaler », une seule fois par erreur identique consécutive. Module pur (sans React) et testé.
- En développement, Vite affiche déjà sa propre surcouche d'erreur ; les écouteurs restent actifs mais n'empêchent rien.

### 6. Rapport : construction pure, téléchargement dans l'interface
- `ui/bugReport.ts` (pur, testé) : `buildBugReport({ comment, mode, game?, historyLog?, autosave?, online?, errors, env })` rend un objet `{ reportVersion: 1, gameVersion, date, env: { userAgent, screen, language }, mode, comment, errors, seed?, save?, online?: { code, seat, view, entries } }`. `save` est exactement `serializeGame(game, historyLog)` (ou l'autosauvegarde relue) : le développeur l'extrait dans un fichier et le recharge par « Charger ». Le jeton de place n'est jamais copié (on prend `code` et `playerId`, pas l'objet `seat` entier).
- `ui/download.ts` : la logique de téléchargement de `SettingsModal.handleSaveGame` (sélecteur de fichier puis lien `download`) est extraite et partagée par la sauvegarde et le rapport. Nom : `seti_rapport_<date>.json`.
- `ui/modals/BugReportModal.tsx` : champ de commentaire (facultatif), rappel de ce que contient le rapport, bouton « Télécharger le rapport », puis message « Envoyez ce fichier au développeur ». Ouverte depuis l'accueil (`SettingsModal`), le message d'erreur et l'écran d'erreur (dans ce dernier, version simplifiée sans dépendance à `BoardUI`).
- Pas de copie dans le presse-papier : le fichier contient tout ; un seul geste à expliquer aux amis.

## Risks / Trade-offs

- [Le serveur reste éveillé en permanence et consomme les 750 h gratuites] → un seul service gratuit sur le compte ; si un second est créé, limiter le cron aux heures de jeu (par exemple `*/10 7-23 * * *` en UTC).
- [Exécutions planifiées retardées ou désactivées par GitHub] → pré-réveil côté client ; repli documenté vers cron-job.org.
- [L'autosauvegarde elle-même provoque le plantage : boucle Continuer → écran d'erreur] → le rapport l'emporte quand même ; le joueur peut démarrer une nouvelle partie depuis l'accueil (qui remplace l'autosauvegarde).
- [Rapport volumineux (journal et états d'annulation)] → `serializeGame` garde déjà un nombre limité d'états d'annulation ; quelques centaines de Ko, acceptable pour un fichier envoyé à la main.
- [Rapport en ligne incomplet (vue filtrée)] → accepté (hors périmètre) ; le code de salle permet de retrouver la salle sur le serveur tant qu'il n'a pas redémarré.
- [Noms des joueurs dans le rapport] → données que le joueur voit déjà ; le rapport ne part que par son geste.

## Migration Plan

Aucune migration : pas de changement de sauvegarde ni de protocole. Déploiement : pousser sur `main` (Netlify reconstruit l'interface ; le workflow planifié démarre dès qu'il est sur la branche par défaut). Lancer une fois le workflow à la main (`workflow_dispatch`) pour vérifier. Retour arrière : désactiver le workflow dans l'onglet Actions, revenir sur le commit.
