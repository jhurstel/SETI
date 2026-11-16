# CLAUDE.md

Adaptation numérique du jeu de société **SETI** (Iello) en TypeScript + React (Vite), avec un serveur Node pour le jeu en ligne. Projet solo, code et commentaires en **français**.

- Dépôt GitHub : https://github.com/jhurstel/SETI (remote `origin`, **public**), branche unique `main`. **Toujours faire `git pull` avant d'analyser ou de modifier le code** (le travail se fait sur plusieurs machines). `gh` CLI n'est pas installé ; Git utilise HTTPS.
- Règles officielles : `public/docs/seti-rules-fr.pdf`, FAQ : `public/docs/SETI-FAQ-FR.pdf` (référence pour toute question de règle ; agent `regles-seti`).
- Documentation du jeu : `public/docs/documentation.md` (bouton 📖) : la tenir à jour quand une règle, une action, une interaction ou un poids des robots change (glossaire des symboles : `.claude/rules/docs.md`).

## Où trouver le détail

Ce fichier ne garde que l'essentiel. Le reste se charge à la demande :

- **Règles par chemin** (`.claude/rules/`, chargées quand un fichier correspondant est lu ou modifié) : `engine.md` (core, systems, actions, engine, session : état immuable, historique, interactions, cartes, hasard, persistance, version, traces), `game-rules.md` (espèces, missions, fin de manche, fin de partie), `robots.md` (ai/, banc), `ui.md` (ui/, e2e), `online.md` (serveur, client, hébergement), `tests.md`, `docs.md`.
- **Skills** (`.claude/skills/`) : `ajouter-interaction`, `modifier-carte`, `mesurer-robots` (avec `resultats.md` : historique des mesures), `publier-version` (`/publier-version`, manuel) ; skills OpenSpec `openspec-*`.
- **Agents** (`.claude/agents/`) : `verificateur` (Haiku : `npm run check` et tests, ne rend que les erreurs), `regles-seti` (Sonnet : question de règle dans les PDF).
- **Specs** (`openspec/`, voir `openspec/README.md`) : ce que le jeu doit faire (`game-rules`, `robots`, `online-play`). Évolution notable (nouvelle règle, espèce, interaction, protocole en ligne, comportement des robots) : proposer (`/openspec-propose`), faire valider, appliquer (`/openspec-apply-change`), archiver (`/openspec-archive-change`). Correctif ou réglage : directement.

## Commandes

```bash
npm install          # dépendances (Node >= 20.19 ; OpenSpec : npm i -g @fission-ai/openspec@2.0.0, Node >= 22.12)
npm run dev          # lance le jeu (serveur Vite, alias : dev:ui)
npm run typecheck    # tsc --noEmit (0 erreur attendue)
npm run lint         # ESLint (0 erreur attendue ; les warnings = dette connue)
npm test             # Jest (test/*.test.ts, ts-jest ; composants : test/components/*.test.tsx)
npm run test:coverage # Jest + couverture du moteur (hors ui/, rapport HTML dans coverage/)
npm run test:e2e     # Playwright (e2e/*.spec.ts) dans un vrai navigateur : tour solo, annulation et rechargement, partie en ligne à deux, écran de fin
SETI_DOC_SCREENSHOTS=1 npx playwright test docMenus  # refait les captures des fenêtres de choix de la documentation (public/docs/images/menus/)
npm run check        # typecheck + lint + cycles d'import + tests + build — à lancer avant chaque commit
npm run check:cycles # cycles d'import (tools/check-cycles.mjs) : seuls les systèmes de règles admis
npm run bench:ai -- 3 2  # performance des robots : 3 parties de 2 Experts (tools/bench/aiBench.ts), temps par étape et empreinte des résultats
                     # tools/bench/midGameSave.ts : sauvegarde de milieu de partie à graine fixe (comparer l'affichage avant/après une modification de l'interface)
npm run tune:ai -- tune 3 140 # réglage SPSA des poids des robots à 3 joueurs (tools/spsa/README.md) ; compare <joueurs> <a.json|default> <b.json|default> <graines> pour valider, levels <joueurs> <graines> [A] [B] : écart entre deux niveaux (Expert contre Avancé par défaut)
npm run build        # typecheck puis vite build (→ dist/)
npm run server       # serveur du jeu à distance : server:build (esbuild → server/build) puis server:start (PORT=8787, SETI_DATA_DIR=server/data, ALLOWED_ORIGINS, ROBOT_THREADS=2)
openspec list        # changements OpenSpec en cours (--specs : capacités) ; openspec validate --specs
```

La CI (`.github/workflows/ci.yml`) exécute typecheck, lint, tests avec seuils de couverture (`npm run test:coverage`) et build à chaque push sur `main`, et les tests de bout en bout dans un job séparé (`e2e`).

## Arborescence

```
public/cards/      # Cartes (CSV ';') : main.csv + une feuille par espèce (mascamites, anomalies, oumuamua, centauriens, exertiens)
public/docs/       # Règles et FAQ (PDF), documentation.md du jeu, images
src/core/          # Modèle (types dans core/model/, importés depuis core/types), géométrie, DataLoader, persistance, hasard
src/systems/       # Règles métier (Probe, Card, Scan, Resource, Computer, Technology, Rotation, Species)
src/actions/       # Une classe par action principale
src/engine/        # Orchestration : GameEngine, GameFactory, TurnManager, InteractionResolver, InteractionChoices, ScoreManager
src/session/       # GameSession.dispatch (point d'entrée unique), file d'interactions, journal, salles, protocole, vues filtrées
src/ai/            # Robots : AITurn, AIController, AIEvaluator, AIBehavior, CardValue, Determinize
src/ui/            # React : BoardUI et plateaux mémoïsés, hooks, fenêtres
server/            # Serveur WebSocket du jeu en ligne (GameServer, RobotPool)
test/, e2e/        # Jest (une vraie partie : createTestGame) ; Playwright
tools/             # check-cycles, bench/ (performance des robots), spsa/ (réglage des poids)
openspec/          # Specs et changements (OpenSpec)
docs/              # etat-des-lieux-cartes.md (audit des cartes) ; archive/ obsolète
```

Détail fichier par fichier : en tête de `.claude/rules/engine.md`, `robots.md` et `ui.md`.

## Règles de travail

- **Séparer le moteur de l'affichage.** Toute règle du jeu (coûts, gains, validations, effets de carte, décisions des robots) vit dans le moteur (`core/`, `systems/`, `actions/`, `engine/`, `ai/`), en TypeScript pur, sans React. L'interface (`ui/`) ne fait qu'appeler le moteur, appliquer l'état renvoyé, afficher l'historique, les toasts et les fenêtres. Si un handler de l'UI calcule une règle, la déplacer dans le moteur avant d'y ajouter quoi que ce soit.
- **Tester chaque opération du moteur.** Toute nouvelle opération ou toute correction du moteur s'accompagne d'un test Jest dans `test/` (avec une vraie partie via `createTestGame()`), qui vérifie le résultat et que la partie reçue n'est pas modifiée. Un bug corrigé reçoit un test de non-régression ; un bug connu non corrigé, un `test.failing`.
- **Les robots passent par les mêmes opérations que le joueur humain** (pas de copie des règles dans `ai/`), et chaque opération de robot est testée. Une commande du joueur que la session traite elle-même (pas de déplacement, défausse pour action gratuite…) a son opération dans le moteur (`InteractionChoices.moveProbe`, `CardSystem.discardFromHandForFreeAction`), appelée par `GameSession` et par les robots ; un choix du joueur sur une interaction passe par `InteractionChoices`, robots compris (achat : `acquireCard`, recherche : `acquireTech`, réservation de mise en place : `reserveCards`).
- Lancer `npm run check` avant chaque commit (agent `verificateur` pour ne garder que les erreurs).
- **Cycles d'import** : un seul est admis, entre les systèmes de règles mutuellement récursifs (Card, PlayCardEffects, Probe, Resource, Rotation, Scan, Species, Technology : un bonus peut lancer un scan ou une sonde qui rapporte un bonus). La géométrie, `core/` (modèle et helpers), l'IA, la session et l'interface restent hors de tout cycle ; `npm run check:cycles` (CI comprise) le vérifie. Une fonction pure dont un module hors du groupe a besoin va dans un module sans dépendance vers les règles (comme `core/hand.ts`), pas dans un système.

## Architecture en bref

- **Couches** (de bas en haut) : `core` (modèle) < `systems` (règles) < `actions`, `engine` (orchestration) < `ai` < `session` < `ui` ; une couche n'importe jamais une couche au-dessus (imports de type exceptés).
- **Toute modification de la partie passe par `GameSession.dispatch(game, playerId, command)`** (UI : `run(command)` dans `BoardUI`, asynchrone en ligne ; robots : `GameSession.applyRobotStep`).
- **État immuable** : une opération du moteur rend `{ updatedGame, historyEntries, ... }` sans modifier la partie reçue (`cloneGame`) ; cartes, technologies et autres données figées sont partagées entre les copies et ne se modifient jamais sur place.
- **Hasard** : jamais `Math.random()` dans le moteur ni `ai/`, toujours `random()` de `core/random.ts` (graine dans `game.seed`, état dans `game.rngState`).
- **Interactions** : `InteractionState` + registre `INTERACTIONS` (`core/model/interactions.ts`), file dans la partie ; choix par `InteractionChoices`, résolutions automatiques par `InteractionResolver` (skill `ajouter-interaction`).
- **Cartes Exertiens** : dans `player.cards` mais **pas en main** : pour la main, `CardSystem.getHandCards(player)`.
- Sauvegardes versionnées (`SAVE_VERSION` + migration à tout changement incompatible) ; `GAME_VERSION` = version de `package.json`, à augmenter à chaque version publiée.

## Style

TS `strict`, `noUnusedLocals/Parameters`, `isolatedModules` (module ES, résolution `bundler` pour Vite ; `test/tsconfig.json` repasse en CommonJS pour Jest), `.editorconfig` (2 espaces, LF). Identifiants en anglais, commentaires et messages en français. Les valeurs d'enum sont des libellés FR affichés (`SectorType.YELLOW = "Jaune"`) et utilisés au parsing CSV : ne pas les modifier à la légère. Moteur, robots et session n'appellent jamais `console` (utiliser `trace` de `core/trace.ts`).

## Hébergement

Interface sur Netlify (https://my-seti.netlify.app, `netlify.toml`), serveur sur Render (`render.yaml`, offre gratuite, disque non conservé). Détail : `.claude/rules/online.md`.

## Notes

- `docs/archive/` décrit une structure ancienne ou cible (`validation/`, `scoring/`…). Se fier au code et à ce fichier.
- `gittoken.txt` est ignoré par Git, mais il a été publié dans l'historique du dépôt public : ne jamais le lire ni l'afficher.
- Commits : messages en anglais et descriptifs (« Refactor X to … Update Y … »).
