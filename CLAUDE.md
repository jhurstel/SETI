# CLAUDE.md

Adaptation numérique du jeu de société **SETI** (Iello) en TypeScript + React (Vite). Projet solo, code et commentaires en **français**.

- Dépôt GitHub : https://github.com/jhurstel/SETI (remote `origin`, **public**), branche unique `main`.
- Règles officielles : `seti-rules-fr.pdf`, FAQ : `SETI-FAQ-FR.pdf` (référence pour toute question de règle).
- `gh` CLI n'est pas installé sur la machine ; Git utilise HTTPS.

## Commandes

```bash
npm install          # dépendances
npm run dev:ui       # UI React (Vite) — le vrai point d'entrée du jeu
npm run build:ui     # build de production Vite
npx tsc --noEmit     # vérification de types (actuellement ~36 erreurs, toutes dans src/ui/)
npm run dev          # exemple console (src/examples/basic-game.ts, via ts-node) — obsolète
```

Il n'y a **aucun test** ni linter configuré. `npm run build` (tsc → `dist/`) échoue à cause des erreurs de types UI ; Vite, lui, n'effectue pas de type-check et fonctionne.

## Arborescence

```
src/
├── main.tsx                 # Point d'entrée Vite : crée une partie (GameFactory) et monte <BoardUI>
├── index.ts                 # Barrel d'export (usage librairie)
├── core/
│   ├── types.ts             # TOUT le modèle de données : Game, Player, Board, Card, Bonus, InteractionState, GAME_CONSTANTS…
│   ├── Game.ts              # GameEngine : validate → saveState → action.execute → flag action principale ; undo
│   ├── GameFactory.ts       # Création/initialisation de partie, decks, technologies ; parsing CSV des cartes (embarqué)
│   ├── Board.ts             # BoardManager : secteurs, planètes, plateau techno, plateaux alien, tuiles objectif
│   ├── SolarSystemPosition.ts # Géométrie du système solaire : disques A–E × secteurs 1–8, 3 anneaux rotatifs, rotation, cases atteignables
│   ├── TurnManager.ts       # Joueur suivant, fin de manche, revenus
│   ├── ActionValidator.ts   # Règles génériques (tour, passé, 1 action principale/tour) puis action.validate()
│   ├── ScoreManager.ts      # Décompte final
│   └── Logger.ts            # Ajoute des entrées à game.gameLog
├── actions/                 # Une classe par action principale (BaseAction : validate/execute) — fines, délèguent aux systems
├── systems/                 # Logique de règles, classes à méthodes statiques
│   ├── ProbeSystem.ts       # Lancer / déplacer / orbite / atterrir, bonus de visite, missions, repositionnement après rotation
│   ├── CardSystem.ts        # Pioche, réserve, jouer une carte (effets), défausse, rangée
│   ├── ScanSystem.ts        # Signaux, couverture de secteur, majorités
│   ├── ResourceSystem.ts    # Crédits/énergie/média/données, échanges, achat de carte, processBonuses()
│   ├── ComputerSystem.ts    # Ordinateur de données du joueur (slots top/bottom)
│   ├── TechnologySystem.ts  # Recherche/acquisition de technologies
│   └── SpeciesSystem.ts     # Paliers neutres / espèces (embryonnaire)
├── ai/AIBehavior.ts         # IA « robot » : actions aléatoires (EASY), réservation, paliers
├── ui/
│   ├── BoardUI.tsx          # ⚠ Composant « dieu » (~2800 lignes) : état React, orchestration des tours, IA, interactions, sauvegarde
│   ├── SolarSystemBoardUI.tsx # Rendu SVG du système solaire (~2000 lignes)
│   ├── PlayerBoardUI.tsx, TechnologyBoardUI.tsx, AlienBoardUI.tsx, ObjectiveBoardUI.tsx, CardRowUI.tsx, HistoryBoardUI.tsx, PlayerComputerUI.tsx…
│   └── modals/              # NewGame, Settings, Pass, GameModals (choix bonus, Obs2/3/4, fin de partie…)
└── examples/basic-game.ts   # Ancien exemple console
assets/                      # Servi comme publicDir Vite : SVG des plateaux, icônes, Cartes.csv
docs/                        # Architecture.md, PlanDeveloppement.md, diagrammes Mermaid (en partie obsolètes)
```

## Architecture et conventions

- **Moteur indépendant de l'UI** : `core/` + `systems/` + `actions/` sont du TS pur ; l'UI React consomme ces systèmes. En pratique, `BoardUI.tsx` appelle souvent les systems **directement** (pas uniquement via `GameEngine.executeAction`) — suivre le schéma déjà utilisé par le handler voisin.
- **État quasi-immuable** : les fonctions de system prennent un `Game` et renvoient un nouvel objet, typiquement `{ updatedGame, historyEntries, ... }`. Le clonage se fait par `structuredClone(game)` (Card/Scan systems) ou par copie superficielle `{ ...game }` (ProbeSystem) — attention aux mutations partagées dans ce dernier cas.
- **Historique** : les systems renvoient des `HistoryEntry { message, playerId, sequenceId }` ; `sequenceId` regroupe les entrées d'une même action (utilisé par l'undo dans `BoardUI`). Les messages sont en français et affichés au joueur.
- **Interactions multi-étapes** : modélisées par l'union discriminée `InteractionState` (`types.ts`). `BoardUI` tient `interactionState` (courant) et une file `pendingInteractions`. Ajouter une nouvelle interaction = ajouter un variant à `InteractionState`, un libellé dans `getInteractionLabel` (BoardUI) et la gestion dans les handlers.
- **Bonus** : type `Bonus` (credits, energy, media, data, pv, movements, signals, technologies, lifetraces…) ; appliqués via `ResourceSystem.processBonuses` / `ProbeSystem.applyBonus`, qui produisent éventuellement de nouvelles interactions en attente.
- **Cartes** : définies dans un CSV `;` (colonnes `Id;Nom;Type;Texte;Action gratuite;Couleur scan;Revenu;Cout;Gain;Contrainte`). La colonne `Contrainte` encode les effets passifs/permanents en mini-DSL (`GAIN_ON_VISIT:jupiter:data:1 + …`, `VISIT_PLANET:mars:4`, `IGNORE_PROBE_LIMIT`…) parsé par `GameFactory.parsePassiveEffects/parsePermanentEffects`.
  ⚠ Le CSV est **dupliqué** : `assets/Cartes.csv` **et** une chaîne embarquée dans `GameFactory.createActionDeck()` — c'est la version embarquée qui est utilisée au runtime. Modifier les deux.
- **Système solaire** : positions logiques `{ disk: 'A'..'E', sector: 1..8 }` ; 3 anneaux rotatifs (`rotationAngleLevel1..3`, `nextRingLevel`). `SolarSystemPosition.ts` est la source de vérité pour les positions absolues, la visibilité entre niveaux, les cases creuses et l'adjacence.
- **Joueurs** : `type: 'human' | 'robot'` ; le joueur humain est géré par l'UI, les robots par `AIBehavior` déclenché depuis `BoardUI`.
- **Persistance** : autosave dans `localStorage['seti_autosave']` + export/import JSON (File System Access API) depuis `BoardUI`.
- Style : TS `strict`, `noUnusedLocals/Parameters`. Indentation 2 espaces (4 dans `CardSystem`/`SpeciesSystem`). Identifiants en anglais, commentaires/messages en français.

## Points d'attention

- Le `README.md` et `docs/Architecture.md` décrivent une structure **cible/ancienne** (dossiers `validation/`, `scoring/`, `MediaSystem.ts`, `SolarSystemRotation.ts`, `CahierDesCharges.md`… qui n'existent pas). Se fier au code.
- `src/core/types.ts` contient des enums dont les valeurs sont des libellés FR affichés (`SectorType.YELLOW = "Jaune"`) : ne pas les renommer sans vérifier l'UI et le parsing CSV.
- `gittoken.txt` est **versionné** dans un dépôt public — ne jamais le lire, l'afficher ni le committer à nouveau.
- Messages de commit : en anglais, descriptifs (style existant : « Refactor X to … Update Y … »).
