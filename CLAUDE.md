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
npm run check        # typecheck + lint + tests + build — à lancer avant chaque commit
npm run build        # typecheck puis vite build (→ dist/)
```

La CI (`.github/workflows/ci.yml`) exécute typecheck, lint, tests et build à chaque push sur `main`.

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
│   ├── Game.ts              # GameEngine : validate → saveState → action.execute → flag action principale ; undo
│   ├── GameFactory.ts       # Création de partie (async : charge les CSV), joueurs, espèces, technologies
│   ├── DataLoader.ts        # fetch + parsing CSV des cartes, mini-DSL d'effets (colonne Contrainte)
│   ├── Board.ts             # BoardManager : secteurs, planètes, plateau techno, plateaux alien, objectifs
│   ├── SolarSystemPosition.ts # Géométrie : disques A–E × secteurs 1–8, 3 anneaux rotatifs, rotation, adjacence
│   ├── TurnManager.ts       # Mise en place, fin de tour (paliers), joueur suivant, fin de manche, revenus
│   ├── GamePersistence.ts   # serializeGame / deserializeGame (autosave et fichiers de sauvegarde)
│   ├── InteractionResolver.ts # Interactions automatiques (résolution de secteur, missions, PIXL, pioche+scan) — partagé UI/IA
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
│   ├── AIBehavior.ts        # Choix d'action du robot (EASY = aléatoire), réservation, paliers
│   ├── AIController.ts      # Résout automatiquement la file d'interactions en attente pour un robot
│   └── AITurn.ts            # Tour complet d'un robot, une étape à la fois (pur, testable sans React)
└── ui/
    ├── BoardUI.tsx          # ⚠ Composant principal (~2400 lignes) : état React, interactions du joueur humain
    ├── hooks/               # useAITurn (cadence des robots), useAutosave (localStorage)
    ├── SolarSystemBoardUI.tsx (~1700), PlayerBoardUI, PlanetBoardUI, AlienBoardUI, TechnologyBoardUI, ObjectiveBoardUI, CardRowUI, HistoryBoardUI
    ├── components/          # HandCard, MissionCard, CardTooltip, PlayerComputer, PlanetIcon, SvgBonus, SectorDetails…
    ├── modals/              # NewGame, Settings, Pass, GameModals
    └── styles/celestialStyles.ts
test/                        # Jest : un fichier par module moteur + AITurn (parties complètes entre robots), helpers/gameFixture.ts
docs/archive/                # Documents de conception initiaux, obsolètes
```

Les visuels sont dessinés en SVG/CSS dans le code (il n'y a plus de dossier `assets/`).

## Architecture et conventions

- **Moteur indépendant de l'UI** : `core/`, `systems/` et `actions/` sont du TS pur. `BoardUI.tsx` passe par `GameEngine.executeAction` pour les actions principales, mais appelle aussi directement les systems pour les bonus et interactions. Suivre le schéma du handler voisin.
- **État immuable** : les systems prennent un `Game` et renvoient `{ updatedGame, historyEntries, ... }` **sans jamais modifier la partie reçue**. Dans le moteur, toute fonction qui modifie l'état commence par `cloneGame(game)` (`src/core/cloneGame.ts` : copie profonde, sauf les instantanés de `history`, qui sont partagés). Pas de copie superficielle `{ ...game }` suivie de mutations : c'était la source de bugs d'undo. `test/Immutability.test.ts` vérifie cette règle.
- **Historique** : `HistoryEntry { message, playerId, sequenceId }`. `sequenceId` regroupe les entrées d'une même action et sert à l'undo. Les messages sont en français et affichés au joueur.
- **Interactions multi-étapes** : union discriminée `InteractionState` (`types.ts`). `BoardUI` tient `interactionState` et la file `pendingInteractions`. Pour en ajouter une : variant dans `InteractionState`, libellé dans `getInteractionLabel` (BoardUI), gestion dans les handlers **et** dans `AIController.processSingleInteraction` pour les robots.
- **Cartes** : CSV `;` avec les colonnes `Id;Nom;Type;Texte;Action gratuite;Couleur scan;Revenu;Cout;Gain;Contrainte`. `Gain` et `Contrainte` encodent les effets (`1 Sonde + 1 Média`, `GAIN_ON_VISIT:jupiter:data:1`, `VISIT_PLANET:mars:4`…), parsés dans `DataLoader`. Modifier une carte = modifier le CSV dans `public/cards/`.
- **Effets de carte** : `CardEffect.value` est de type `CardEffectValue` (nombre, booléen, chaîne de mission, `EffectAmount` ou `Bonus`). Le lire avec les accesseurs de `core/cardEffects.ts` (`effectNumber(effect)` pour un calcul, `effectString` pour une mission `GAIN_IF_…`, `effectAmount<Scope>` pour quantité + portée, `effectBonus` pour des gains multiples), jamais avec `effect.value` brut dans une opération.
- **Joueurs** : `type: 'human' | 'robot'`. L'humain est piloté par l'UI. Les robots sont gérés par `AITurn.playStep` / `AITurn.endTurn`, qui s'appuient sur `AIBehavior` et `AIController` ; le hook `useAITurn` appelle une étape toutes les 1,5 s. Toute logique de robot va dans `AITurn` (moteur), pas dans le hook. `test/AITurn.test.ts` joue des parties complètes entre robots : c'est le test de non-régression global du moteur.
- **Interactions automatiques** (`TRIGGER_CARD_EFFECT`, `RESOLVING_SECTOR`, `DRAW_AND_SCAN`, `CLAIMING_MISSION_REQUIREMENT`) : une seule implémentation, `InteractionResolver.resolve`, appelée par `BoardUI` (joueur humain) et par `AIController` (robots). Ne pas réimplémenter ces règles ailleurs. Une interaction destinée à un autre joueur porte son `playerId` ; pendant le tour d'un robot, celles destinées à un humain remontent à l'interface (`AIController` → `AITurn` → `useAITurn.onHumanInteractions`). Pour placer automatiquement une trace de vie, utiliser `SpeciesSystem.placeLifeTraceAuto`.
- **Logique métier hors de l'UI** : quand un handler de `BoardUI` contient de la logique de règles, la déplacer dans le moteur (`TurnManager`, systems, actions) et ne garder dans l'UI que l'application de l'état, l'historique et les toasts.
- **Cartes Exertiens** : stockées dans `player.cards`, mais elles ne sont **pas en main** (règles et FAQ Q40). Elles ne comptent pas dans la limite de 4 cartes et ne peuvent être ni défaussées, ni réservées, ni jouées normalement. Pour tout ce qui concerne « la main » (défausse, passe, choix de l'IA…), utiliser `CardSystem.getHandCards(player)`. Une carte Exertien se joue uniquement à un palier Exertien (`SpeciesSystem.playExertienCard`), une fois par joueur et par palier (`player.claimedExertienMilestones`).
- **Persistance** : `GamePersistence` (pur) + `useAutosave` (`localStorage['seti_autosave']`) + export/import JSON dans `SettingsModal`.
- **Style** : TS `strict`, `noUnusedLocals/Parameters`, `.editorconfig` (2 espaces, LF). Identifiants en anglais, commentaires et messages en français. Les valeurs d'enum sont des libellés FR affichés (`SectorType.YELLOW = "Jaune"`) et utilisés au parsing CSV : ne pas les modifier à la légère.
- **Tests** : Jest + ts-jest dans `test/`, type-checkés via `test/tsconfig.json` (inclus dans `npm run typecheck`).
  - `test/helpers/gameFixture.ts` : `createTestGame()` crée une **vraie** partie (fetch simulé qui sert `public/`, donc les vraies cartes), `makeCard()`, `getPlayer()`. À privilégier plutôt que des mocks d'état écrits à la main.
  - Un bug connu et pas encore corrigé est documenté par un `test.failing(...)`. Retirer `.failing` quand il est corrigé.
  - Couverture : SolarSystemPosition, ScanSystem, CardSystem, DataLoader (tous les CSV), TurnManager/PassAction, GameFactory, GameEngine (undo), GamePersistence, InteractionResolver, Exertiens, orbite/atterrissage, immutabilité, cardEffects, et des parties complètes entre robots (AITurn).

## Points d'attention

- `docs/archive/` décrit une structure ancienne ou cible (`validation/`, `scoring/`…). Se fier au code et à ce fichier.
- Les robots et le moteur écrivent encore des traces `console.log` (`[AI]`, `[Game]`) : elles sont volontaires et servent au debug.
- `gittoken.txt` est ignoré par Git, mais il a été publié dans l'historique du dépôt public : ne jamais le lire ni l'afficher.
- Commits : messages en anglais et descriptifs (« Refactor X to … Update Y … »).
