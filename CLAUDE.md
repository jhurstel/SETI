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
│   ├── TurnManager.ts       # Joueur suivant, fin de manche, revenus
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
│   └── AIController.ts      # Résout automatiquement la file d'interactions en attente pour un robot
└── ui/
    ├── BoardUI.tsx          # ⚠ Composant « dieu » (~3100 lignes) : état React, orchestration des tours, IA, sauvegarde
    ├── SolarSystemBoardUI.tsx (~1700), PlayerBoardUI, PlanetBoardUI, AlienBoardUI, TechnologyBoardUI, ObjectiveBoardUI, CardRowUI, HistoryBoardUI
    ├── components/          # HandCard, MissionCard, CardTooltip, PlayerComputer, PlanetIcon, SvgBonus, SectorDetails…
    ├── modals/              # NewGame, Settings, Pass, GameModals
    └── styles/celestialStyles.ts
test/                        # GameEngine.test.ts, ProbeSystem.test.ts (jest)
docs/archive/                # Documents de conception initiaux, obsolètes
```

Les visuels sont dessinés en SVG/CSS dans le code (il n'y a plus de dossier `assets/`).

## Architecture et conventions

- **Moteur indépendant de l'UI** : `core/`, `systems/` et `actions/` sont du TS pur. `BoardUI.tsx` passe par `GameEngine.executeAction` pour les actions principales, mais appelle aussi directement les systems pour les bonus et interactions. Suivre le schéma du handler voisin.
- **État quasi-immuable** : les systems prennent un `Game` et renvoient `{ updatedGame, historyEntries, ... }`. Le clonage se fait majoritairement par `structuredClone`, parfois par copie superficielle `{ ...game }` : attention aux mutations partagées.
- **Historique** : `HistoryEntry { message, playerId, sequenceId }`. `sequenceId` regroupe les entrées d'une même action et sert à l'undo. Les messages sont en français et affichés au joueur.
- **Interactions multi-étapes** : union discriminée `InteractionState` (`types.ts`). `BoardUI` tient `interactionState` et la file `pendingInteractions`. Pour en ajouter une : variant dans `InteractionState`, libellé dans `getInteractionLabel` (BoardUI), gestion dans les handlers **et** dans `AIController.processSingleInteraction` pour les robots.
- **Cartes** : CSV `;` avec les colonnes `Id;Nom;Type;Texte;Action gratuite;Couleur scan;Revenu;Cout;Gain;Contrainte`. `Gain` et `Contrainte` encodent les effets (`1 Sonde + 1 Média`, `GAIN_ON_VISIT:jupiter:data:1`, `VISIT_PLANET:mars:4`…), parsés dans `DataLoader`. Modifier une carte = modifier le CSV dans `public/cards/`.
- **Joueurs** : `type: 'human' | 'robot'`. L'humain est piloté par l'UI, les robots par `AIBehavior` et `AIController`, déclenchés depuis `BoardUI`.
- **Persistance** : autosave dans `localStorage['seti_autosave']` + export/import JSON depuis `BoardUI`.
- **Style** : TS `strict`, `noUnusedLocals/Parameters`, `.editorconfig` (2 espaces, LF). Identifiants en anglais, commentaires et messages en français. Les valeurs d'enum sont des libellés FR affichés (`SectorType.YELLOW = "Jaune"`) et utilisés au parsing CSV : ne pas les modifier à la légère.
- **Tests** : dans `test/`, hors `rootDir` de `tsconfig` (non type-checkés par `tsc`, seulement par ts-jest).

## Points d'attention

- `docs/archive/` décrit une structure ancienne ou cible (`validation/`, `scoring/`…). Se fier au code et à ce fichier.
- Les robots et le moteur écrivent encore des traces `console.log` (`[AI]`, `[Game]`) : elles sont volontaires et servent au debug.
- `gittoken.txt` est ignoré par Git, mais il a été publié dans l'historique du dépôt public : ne jamais le lire ni l'afficher.
- Commits : messages en anglais et descriptifs (« Refactor X to … Update Y … »).
