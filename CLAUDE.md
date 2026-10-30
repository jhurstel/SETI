# CLAUDE.md

Adaptation numérique du jeu de société **SETI** (Iello) en TypeScript + React (Vite). Projet solo, code et commentaires en **français**.

- Dépôt GitHub : https://github.com/jhurstel/SETI (remote `origin`, **public**), branche unique `main`. **Toujours faire `git pull` avant d'analyser ou de modifier le code** (le travail se fait sur plusieurs machines).
- Règles officielles : `seti-rules-fr.pdf`, FAQ : `SETI-FAQ-FR.pdf` (référence pour toute question de règle).
- `gh` CLI n'est pas installé sur la machine ; Git utilise HTTPS.

## Commandes

```bash
npm install          # dépendances (Node >= 20.19)
npm run dev          # lance le jeu (serveur Vite, alias : dev:ui)
npm run typecheck    # tsc --noEmit (0 erreur attendue)
npm run lint         # ESLint (0 erreur attendue ; les warnings = dette connue)
npm test             # Jest (test/*.test.ts, ts-jest)
npm run test:coverage # Jest + couverture du moteur (hors ui/, rapport HTML dans coverage/)
npm run test:e2e     # Playwright (e2e/*.spec.ts) : tour d'un joueur humain dans un vrai navigateur
npm run check        # typecheck + lint + tests + build — à lancer avant chaque commit
npm run build        # typecheck puis vite build (→ dist/)
```

La CI (`.github/workflows/ci.yml`) exécute typecheck, lint, tests et build à chaque push sur `main`, et les tests de bout en bout dans un job séparé (`e2e`). En local sous Windows, Playwright utilise le Chrome installé (`PW_CHANNEL` pour en choisir un autre ; Edge est bloqué sur certains postes).

## Arborescence

```
public/cards/                # Données des cartes (CSV ';') chargées à l'exécution par fetch
│   main.csv                 #   cartes de base
│   mascamites.csv, anomalies.csv, oumuamua.csv, centauriens.csv, exertiens.csv  # cartes d'espèces
src/
├── main.tsx                 # Point d'entrée Vite : monte <BoardUI/> (la partie est créée depuis l'UI)
├── index.ts                 # Barrel d'export
├── core/
│   ├── types.ts             # TOUT le modèle : Game, Player, Board, Card, Bonus, InteractionState, enums, GAME_CONSTANTS…
│   ├── Game.ts              # GameEngine : validate → action.execute → flag action principale
│   ├── GameFactory.ts       # Création de partie (async : charge les CSV), joueurs, espèces, technologies
│   ├── DataLoader.ts        # fetch + parsing CSV des cartes, mini-DSL d'effets (colonne Contrainte)
│   ├── Board.ts             # BoardManager : secteurs, planètes, plateau techno, plateaux alien, objectifs
│   ├── SolarSystemPosition.ts # Géométrie : disques A–E × secteurs 1–8, 3 anneaux rotatifs, rotation, adjacence
│   ├── TurnManager.ts       # Mise en place, fin de tour (paliers), joueur suivant, fin de manche, revenus
│   ├── GamePersistence.ts   # serializeGame / deserializeGame (autosave et fichiers de sauvegarde)
│   ├── InteractionResolver.ts # Interactions automatiques (résolution de secteur, missions, PIXL, pioche+scan) — partagé UI/IA
│   ├── InteractionChoices.ts  # Choix sur une interaction en attente (toutes les interactions à choix du joueur) — partagé UI/IA
│   ├── cloneGame.ts         # Copie profonde de l'état (voir « État immuable »)
│   ├── cardEffects.ts       # Accesseurs typés de CardEffect.value (effectNumber, effectString, effectAmount, effectBonus)
│   ├── ActionValidator.ts   # Règles génériques (tour, passé, 1 action principale/tour) puis action.validate()
│   ├── ScoreManager.ts      # Décompte final
│   └── Logger.ts
├── actions/                 # Une classe par action principale (BaseAction) ; exposent historyEntries / newPendingInteractions
├── systems/                 # Règles métier, classes à méthodes statiques
│   ├── ProbeSystem.ts       # Lancer / déplacer / orbite / atterrir, visites, missions, repositionnement après rotation
│   ├── CardSystem.ts        # Pioche, réserve, jouer une carte (effets), défausse, rangée, buffs GAIN_ON_PLAY/DISCARD
│   ├── ScanSystem.ts        # Signaux, couverture de secteur, majorités
│   ├── ResourceSystem.ts    # Ressources, échanges, achat, processBonuses(), formatBonus/formatResource
│   ├── ComputerSystem.ts    # Ordinateur de données du joueur
│   ├── TechnologySystem.ts  # Recherche/acquisition de technologies
│   └── SpeciesSystem.ts     # Traces de vie, découverte et mécaniques des 5 espèces (Mascamites, Anomalies, Oumuamua, Centauriens, Exertiens)
├── ai/
│   ├── AIBehavior.ts        # Actions possibles, choix aléatoire (EASY), cartes gardées, réservation, paliers
│   ├── AIEvaluator.ts       # Évaluation heuristique d'une position (robots MEDIUM/EXPERT)
│   ├── AIController.ts      # Résout automatiquement la file d'interactions en attente pour un robot
│   └── AITurn.ts            # Tour complet d'un robot, une étape à la fois (pur, testable sans React)
└── ui/
    ├── BoardUI.tsx          # ⚠ Composant principal (~2400 lignes) : état React, interactions du joueur humain
    ├── hooks/               # useAITurn (cadence des robots, calcul dans le Web Worker via aiWorkerClient), useAutosave (localStorage, écriture différée)
    ├── SolarSystemBoardUI.tsx (~1700), PlayerBoardUI, PlanetBoardUI, AlienBoardUI, TechnologyBoardUI, ObjectiveBoardUI, CardRowUI, HistoryBoardUI
    ├── components/          # HandCard, MissionCard, CardTooltip, PlayerComputer, PlanetIcon, SvgBonus, SectorDetails…
    ├── modals/              # NewGame, Settings, Pass, GameModals
    └── styles/celestialStyles.ts
e2e/                         # Playwright : parties pilotées dans le navigateur (serveur Vite lancé par playwright.config.ts)
test/                        # Jest : un fichier par module moteur + AITurn (parties complètes entre robots), helpers/gameFixture.ts
docs/etat-des-lieux-cartes.md # Audit des cartes et des opérations des robots (corrigé / situationnel / limites)
docs/archive/                # Documents de conception initiaux, obsolètes
```

Les visuels sont dessinés en SVG/CSS dans le code (il n'y a plus de dossier `assets/`).

## Règles de travail

- **Séparer le moteur de l'affichage.** Toute règle du jeu (coûts, gains, validations, effets de carte, décisions des robots) vit dans le moteur (`core/`, `systems/`, `actions/`, `ai/`), en TypeScript pur, sans React. L'interface (`ui/`) ne fait qu'appeler le moteur, appliquer l'état renvoyé, afficher l'historique, les toasts et les fenêtres. Si un handler de l'UI calcule une règle, la déplacer dans le moteur avant d'y ajouter quoi que ce soit.
- **Tester chaque opération du moteur.** Toute nouvelle opération ou toute correction du moteur s'accompagne d'un test Jest dans `test/` (avec une vraie partie via `createTestGame()`), qui vérifie le résultat et que la partie reçue n'est pas modifiée. Un bug corrigé reçoit un test de non-régression ; un bug connu non corrigé, un `test.failing`.
- **Les robots passent par les mêmes opérations que le joueur humain** (pas de copie des règles dans `ai/`), et chaque opération de robot est testée.
- Lancer `npm run check` avant chaque commit.

## Architecture et conventions

- **Moteur indépendant de l'UI** : `core/`, `systems/` et `actions/` sont du TS pur. `BoardUI.tsx` passe par `GameEngine.executeAction` pour les actions principales, mais appelle aussi directement les systems pour les bonus et interactions. Suivre le schéma du handler voisin.
- **État immuable** : les systems prennent un `Game` et renvoient `{ updatedGame, historyEntries, ... }` **sans jamais modifier la partie reçue**. Dans le moteur, toute fonction qui modifie l'état commence par `cloneGame(game)` (`src/core/cloneGame.ts`, copie profonde ; à utiliser aussi dans l'UI plutôt que `structuredClone`). Pour la performance (la copie fait l'essentiel du temps des robots), les effets des cartes et les effets et bonus des technologies sont **figés et partagés** entre les copies : ne jamais les modifier (une modification lève une `TypeError`) ; les champs variables d'une carte (`ownerId`, `isRevealed`, `completed`…) restent copiés. Pas de copie superficielle `{ ...game }` suivie de mutations : c'était la source de bugs d'undo. `test/Immutability.test.ts` vérifie cette règle.
- **Historique** : `HistoryEntry { message, playerId, sequenceId, previousState }`. `sequenceId` regroupe les entrées d'une même action et sert à l'undo, qui est géré uniquement par l'UI : chaque entrée du journal (`historyLog`) garde l'état d'avant l'action (`previousState`). Le moteur ne garde pas d'instantanés (l'ancien `game.history`, jamais utilisé, faisait passer l'état de 170 Ko à plus de 10 Mo en fin de partie). Les messages sont en français et affichés au joueur.
- **Interactions multi-étapes** : union discriminée `InteractionState` (`types.ts`). `BoardUI` tient `interactionState` et la file `pendingInteractions`. Pour en ajouter une : variant dans `InteractionState`, libellé dans `getInteractionLabel` (BoardUI), gestion dans les handlers **et** dans `AIController.processSingleInteraction` pour les robots.
- **Cartes** : CSV `;` avec les colonnes `Id;Nom;Type;Texte;Action gratuite;Couleur scan;Revenu;Cout;Gain;Contrainte`. `Gain` et `Contrainte` encodent les effets (`1 Sonde + 1 Média`, `GAIN_ON_VISIT:jupiter:data:1`, `VISIT_PLANET:mars:4`…), parsés dans `DataLoader`. Modifier une carte = modifier le CSV dans `public/cards/`.
- **Effets de carte** : `CardEffect.value` est de type `CardEffectValue` (nombre, booléen, chaîne de mission, `EffectAmount` ou `Bonus`). Le lire avec les accesseurs de `core/cardEffects.ts` (`effectNumber(effect)` pour un calcul, `effectString` pour une mission `GAIN_IF_…`, `effectAmount<Scope>` pour quantité + portée, `effectBonus` pour des gains multiples), jamais avec `effect.value` brut dans une opération.
- **Joueurs** : `type: 'human' | 'robot'`, niveau du robot dans `player.aiDifficulty` (absent = EASY). L'humain est piloté par l'UI. Les robots sont gérés par `AITurn.playStep` / `AITurn.endTurn`, qui s'appuient sur `AIBehavior` et `AIController` ; le hook `useAITurn` appelle une étape toutes les 1,5 s, calculée dans un Web Worker (`ai/aiWorker.ts`, `ui/hooks/aiWorkerClient.ts` ; repli sur le fil principal si le Worker est indisponible) pour ne pas figer l'interface ; l'état du générateur aléatoire fait l'aller-retour avec la partie. Toute logique de robot va dans `AITurn` (moteur), pas dans le hook. `test/AITurn.test.ts` joue des parties complètes entre robots : c'est le test de non-régression global du moteur.
  - **Niveaux** : EASY (Débutant) simule chaque action principale, sans préparation, et en tire une au hasard parmi les 3 meilleures qui améliorent sa position (`AITurn.chooseEasyMainAction`), sinon il passe ; il compare 2 tirages pour ses choix aléatoires (`AIBehavior.choiceSamples`) et garde/défausse ses cartes selon leur coût jouable. Ses actions gratuites restent occasionnelles et au hasard. MEDIUM simule chaque action principale et chaque action gratuite avec le vrai moteur (`AITurn.chooseBestMainAction`, `tryBestFreeAction`), note la position obtenue avec `AIEvaluator.evaluate` (PV + ressources et potentiel pondérés par les manches restantes) et garde la meilleure ; il passe quand aucune action n'améliore sa position. EXPERT joue comme MEDIUM, mais son évaluation ajoute les points du décompte final déjà acquis (`ScoreManager.calculateFinalScore` : tuiles objectif, cartes Fin de partie ; poids `endGameBefore` avant la dernière manche, 100 % pendant) : sur 72 parties contre MEDIUM, 61 % de victoires et environ +11 PV en moyenne. Pistes essayées sans gain : anticiper le coup suivant (plus lent, surévalue l'épargne), retrancher la position du meilleur adversaire. Comparer deux niveaux demande au moins une cinquantaine de parties (scores très dispersés). Les poids de `AIEvaluator` (`DEFAULT_WEIGHTS`, partagés par tous les niveaux) ont été réglés ensemble par SPSA en faisant jouer des Experts entre eux, à 2 et 3 joueurs (dont le facteur de dernière manche `lastRoundFactor` et le seuil des actions gratuites `freeActionMinGain`) ; `AIEvaluator.weightOverrides` permet de donner d'autres poids à un joueur pour ce genre de comparaison (vide en jeu). Pour les interactions à choix aléatoire, `AIController` compare 4 tirages et garde le meilleur. Pour renforcer l'IA, ajuster d'abord les poids de `AIEvaluator`.
- **Interactions automatiques** (`TRIGGER_CARD_EFFECT`, `RESOLVING_SECTOR`, `DRAW_AND_SCAN`, `CLAIMING_MISSION_REQUIREMENT`) : une seule implémentation, `InteractionResolver.resolve`, appelée par `BoardUI` (joueur humain) et par `AIController` (robots). Ne pas réimplémenter ces règles ailleurs. De même, toutes les interactions à choix passent par `InteractionChoices` : cartes (`acquireCard`, `selectScanCard`, `reserveCards`, `discardForSignals`, `playExertienCard`), sondes (`chooseMediaOrMove`, `removeProbe`, `takeSpecimen` et `specimenPlanets`), observations (`observation2`, `observation4`), ainsi que `placeLifeTrace`, `acquireAlienCard`, `placeObjectiveMarker`, `acquireTech` (technologies autorisées par `TechnologySystem.acquirableTechs`, colonne d'ordinateur, `noTileBonus`), `placeBonusProbe` (placements restants dans `nextInteraction`), `claimCentaurienReward` (palier `markerId`), `chooseBonusAction`, `markProbeUsed` (une sonde par action pour les signaux « secteur d'une sonde »), `noteDiscovery` pour annoncer une découverte d'espèce ; déplacements gratuits consommés : `ProbeSystem.freeMovementsUsed` ; défausse en passant : `CardSystem.cardsToDiscardAtPass`, vérifiée par `PassAction`) : l'UI fournit le choix du clic, le robot celui de sa simulation ou de son tirage ; une nouvelle interaction à choix y ajoute sa fonction (avec son test), plutôt qu'une règle dans un handler ou dans `AIController`. Une fonction qui laisse une suite (cartes, placements ou déplacements restants) la renvoie dans `nextInteraction`. Une interaction destinée à un autre joueur porte son `playerId` ; pendant le tour d'un robot, celles destinées à un humain remontent à l'interface (`AIController` → `AITurn` → `useAITurn.onHumanInteractions`). Pour placer automatiquement une trace de vie, utiliser `SpeciesSystem.placeLifeTraceAuto` (ordre de `lifeTraceOptions` : couleur manquante d'une espèce non découverte, puis n'importe quel emplacement libre de la piste d'une espèce découverte, plus l'emplacement infini suivant si l'espèce en a (`SpeciesSystem.hasInfiniteSlot` : ni Mascamites ni Exertiens), puis emplacements excédentaires) ; les robots (tous niveaux) simulent chaque emplacement et gardent le mieux évalué (`AIController.bestLifeTracePlacement`), l'évaluation comptant la carte Alien promise par une 1re trace (`discoveryClaim`) et les cartes Alien en main (`alienCard`). L'évaluation compte aussi les secteurs en cours de remplissage (`sectorProspects` : 1 Média si présent, part du bonus de couverture si majoritaire, selon le remplissage) ; mesuré neutre sur la force de jeu (96 parties, −0,1 ± 3,3 PV). Exertiens : l'évaluation (tous niveaux) retire la pénalité de danger attendue (10 % du score final estimé, pleine si le joueur est le plus exposé, réduite par point d'écart : `dangerPenalty`, `dangerMarginDecay`, `minPointsPerRound`) et compte les PV des cartes Exertiens jouées (pleins si la condition est remplie, sinon × `exertienStepChance` par étape manquante, via `ScoreManager.exertienCardProgress`) ; à un palier, le robot simule chaque carte et le renoncement (`AIController.bestExertienCard`). Sur 20 parties à 3 Experts contre l'ancien choix (carte la moins dangereuse) : danger moyen 7,6 au lieu de 11,1, 1,1 carte jouée par joueur au lieu de 1,5, mais toujours peu de conditions remplies (18 %).
- **Logique métier hors de l'UI** : quand un handler de `BoardUI` contient de la logique de règles, la déplacer dans le moteur (`TurnManager`, systems, actions) et ne garder dans l'UI que l'application de l'état, l'historique et les toasts.
- **Cartes Exertiens** : stockées dans `player.cards`, mais elles ne sont **pas en main** (règles et FAQ Q40). Elles ne comptent pas dans la limite de 4 cartes et ne peuvent être ni défaussées, ni réservées, ni jouées normalement. Pour tout ce qui concerne « la main » (défausse, passe, choix de l'IA…), utiliser `CardSystem.getHandCards(player)`. Une carte Exertien se joue uniquement à un palier Exertien (`SpeciesSystem.playExertienCard`), une fois par joueur et par palier (`player.claimedExertienMilestones`).
- **Spécimens Mascamites** : prélever un spécimen (cartes « … et prélevez un spécimen », sur Jupiter, Saturne ou leurs lunes) le place dans une **capsule** : une `Probe` à l'état `ProbeState.CAPSULE` portant `specimen`, posée sur la case de la planète d'origine. Elle se déplace comme une sonde (énergie ou déplacements, +1 Média sur les cases à microphone) mais n'est jamais comptée comme une sonde (filtres `IN_SOLAR_SYSTEM`). Arrivée sur sa destination (Terre, ou Mars pour ET.4), la mission `GAIN_IF_SPECIMEN` se réclame en action gratuite : récompense de la carte + celle du spécimen, puis la capsule disparaît (`InteractionResolver.claimMissionRequirement`).
- **Fin de partie** : à la fin de la dernière manche, `TurnManager.endRound` appelle `ScoreManager.applyFinalScoring`, qui calcule les catégories (objectifs, cartes fin de partie, espèces, cartes Exertiens jouées), puis la pénalité de danger, et enregistre le détail dans `game.finalScores`. L'écran de fin (`EndGameModal`) et `GameEngine.determineWinner` lisent ce détail sans rien recalculer. Une fois en `FINAL_SCORING`, plus aucune action n'est acceptée (`ActionValidator`) et les robots attendent.
  - Conditions des cartes Exertiens : `END_CONDITION:<type>:<paramètre>:<seuil>:<PV>` dans `public/cards/exertiens.csv`, évaluées par `ScoreManager.revealExertienCards` (une seule fois par carte, FAQ Q45).
  - Danger : DANGER des cartes Exertiens jouées + danger des emplacements occupés par les marqueurs du joueur sur la piste Exertiens (`calculateExertienDanger`). Si les Exertiens sont découverts, le plus exposé (ex aequo compris) perd 10 % de son total arrondi à l'inférieur, après tous les autres PV. Aucune pénalité si personne n'a de danger positif.
  - Bonus des autres espèces (`calculateSpeciesBonuses`) : aucun selon les règles et la FAQ (seuls les Exertiens ajoutent une étape) ; les cartes Fin de partie des espèces (ET.5, ET.24 : `SCORE_PER_SPECIES_LIFETRACE`) sont décomptées avec les autres cartes Fin de partie.
- **Centauriens** : `player.centaurienMilestones` est une liste de `CentaurienMarker` (score, carte source éventuelle, `resolved` une fois atteint) qui restent affichés sur la piste de score. Palier du message de l'espèce : choix d'une tuile Message (`claimedBy` retient qui l'a prise). Palier d'une carte : effet « Réception » de la carte (`RECEPTION_REVENUE` ou `RECEPTION:<récompenses>` dans le CSV), sans choix (`SpeciesSystem.receiveCentaurienCard`).
- **Fenêtres et infobulles** : toute fenêtre de choix utilise `ui/modals/ChoiceModal` (`ChoiceModal`, `ChoiceOption`, `ChoiceFooterButton`), qui inclut le bouton « Voir le plateau » ; les choix de cartes de la main passent par `PassModal` (une carte : réservation, fin de manche) ou `CardPickModal` (plusieurs : défausse de fin de manche, défausse pour signaux, échange de 2 cartes), qui dessinent les cartes comme sur le plateau joueur (`ChoiceCardTile`, `CardContent`) avec l'attribut utile en surbrillance ; une option indisponible explique pourquoi dans son infobulle. Pas d'attribut HTML `title` : utiliser `setActiveTooltip` ou `components/HoverTooltip` pour garder l'aspect des infobulles du jeu (classe `.seti-tooltip`).
- **Historique** : le moteur rédige le message de chaque action (y compris orbite et atterrissage) puis ses conséquences avec le même `sequenceId` ; l'historique indente ces conséquences sous l'action.
- **Persistance** : `GamePersistence` (pur) + `useAutosave` (`localStorage['seti_autosave']`, écriture différée de 500 ms, immédiate si la page est quittée) + export/import JSON dans `SettingsModal`. Les sauvegardes portent `saveVersion` : tout changement incompatible du modèle incrémente `SAVE_VERSION` et ajoute une migration dans `MIGRATIONS` (appliquée aussi aux états d'annulation du journal). Une sauvegarde plus récente que le jeu est refusée (`SaveVersionError`). Elle enregistre aussi l'état du générateur aléatoire (`rngState`), rétabli au chargement.
- **Hasard** : jamais de `Math.random()` dans le moteur ni dans `ai/`, toujours `random()` de `core/random.ts` (générateur à graine). `GameFactory.createGame(noms, humainPremier, graine)` part de la graine (tirée au hasard si absente) et la note dans `game.seed` : même graine et mêmes choix = même partie. L'UI garde `Math.random` pour ce qui n'est pas du jeu (infobulles, noms des robots). Identifiants : `uniqueId()` de `core/ids.ts`, pas `Date.now()` seul.
- **Outils de débogage** : le `DebugPanel` n'est affiché que si la case « Outils de débogage » du menu Paramètres est cochée (`useDebugSetting`, `localStorage['seti_show_debug']`).
- **Style** : TS `strict`, `noUnusedLocals/Parameters`, `isolatedModules` (module ES, résolution `bundler` pour Vite ; `test/tsconfig.json` repasse en CommonJS pour Jest), `.editorconfig` (2 espaces, LF). Identifiants en anglais, commentaires et messages en français. Les valeurs d'enum sont des libellés FR affichés (`SectorType.YELLOW = "Jaune"`) et utilisés au parsing CSV : ne pas les modifier à la légère.
- **Tests** : Jest + ts-jest dans `test/`, type-checkés via `test/tsconfig.json` (inclus dans `npm run typecheck`).
  - `test/helpers/gameFixture.ts` : `createTestGame()` crée une **vraie** partie (fetch simulé qui sert `public/`, donc les vraies cartes ; graine fixe `TEST_SEED`, donc la même partie à chaque exécution), `makeCard()`, `getPlayer()`. À privilégier plutôt que des mocks d'état écrits à la main.
  - Un bug connu et pas encore corrigé est documenté par un `test.failing(...)`. Retirer `.failing` quand il est corrigé.
  - `CardCatalog.test.ts` vérifie toutes les cartes des CSV (effets lus et traités, jouées par un robot sans erreur) et que les robots gèrent toutes les interactions du moteur. Une nouvelle carte ou un nouvel effet doit le faire passer.
  - Couverture : SolarSystemPosition, ScanSystem, CardSystem, DataLoader (tous les CSV), TurnManager/PassAction, GameFactory, GameEngine, GamePersistence, InteractionResolver, Exertiens, orbite/atterrissage, immutabilité, cardEffects, et des parties complètes entre robots (AITurn).

## Points d'attention

- `docs/archive/` décrit une structure ancienne ou cible (`validation/`, `scoring/`…). Se fier au code et à ce fichier.
- Les robots et le moteur écrivent encore des traces `console.log` (`[AI]`, `[Game]`) : elles sont volontaires et servent au debug.
- `gittoken.txt` est ignoré par Git, mais il a été publié dans l'historique du dépôt public : ne jamais le lire ni l'afficher.
- Commits : messages en anglais et descriptifs (« Refactor X to … Update Y … »).
