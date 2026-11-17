---
paths:
  - "src/core/**"
  - "src/systems/**"
  - "src/actions/**"
  - "src/engine/**"
  - "src/session/**"
---

# Moteur : modèle, règles, orchestration, session

## Fichiers

```
src/core/                    # Modèle, sans aucune dépendance vers les règles (vérifié par npm run check:cycles)
│   ├── types.ts             # Point d'entrée du modèle : réexporte core/model/* (importer depuis core/types)
│   ├── model/               # Modèle par domaine : enums, constants, board, cards, species, player, game, interactions (InteractionState, getInteractionLabel), ai
│   ├── DataLoader.ts        # fetch + parsing CSV des cartes, mini-DSL d'effets (colonne Contrainte)
│   ├── SolarSystemPosition.ts # Géométrie pure : disques A–E × secteurs 1–8, 3 anneaux rotatifs, positions, adjacence
│   ├── hand.ts              # Main d'un joueur (handCards, isExertienCard)
│   ├── GamePersistence.ts   # serializeGame / deserializeGame (autosave et fichiers de sauvegarde)
│   ├── cloneGame.ts         # Copie profonde de l'état (voir « État immuable »)
│   ├── cardEffects.ts       # Accesseurs typés de CardEffect.value (effectNumber, effectString, effectAmount, effectBonus)
│   ├── random.ts, ids.ts, players.ts, historyText.ts, historyTimeline.ts, TurnUndo.ts, version.ts, Logger.ts
src/engine/                  # Orchestration des règles (au-dessus de systems/ et actions/)
│   ├── Game.ts              # GameEngine : validate → action.execute → flag action principale
│   ├── GameFactory.ts       # Création de partie (async : charge les CSV), joueurs, espèces, technologies
│   ├── Board.ts             # BoardManager : secteurs, planètes, plateau techno, plateaux alien, objectifs
│   ├── TurnManager.ts       # Mise en place, fin de tour (paliers), joueur suivant, fin de manche, revenus
│   ├── InteractionResolver.ts # Interactions automatiques (résolution de secteur, missions, PIXL, pioche+scan) — partagé UI/IA
│   ├── InteractionChoices.ts  # Choix sur une interaction en attente (toutes les interactions à choix du joueur) — partagé UI/IA
│   ├── ActionValidator.ts   # Règles génériques (tour, passé, 1 action principale/tour) puis action.validate()
│   └── ScoreManager.ts      # Décompte final
src/actions/                 # Une classe par action principale (BaseAction) ; exposent historyEntries / newPendingInteractions
src/systems/                 # Règles métier, classes à méthodes statiques
│   ├── ProbeSystem.ts       # Lancer / déplacer / orbite / atterrir, visites, missions, repositionnement après rotation
│   ├── CardSystem.ts        # Pioche, réserve, jouer une carte (effets), défausse, rangée, buffs GAIN_ON_PLAY/DISCARD
│   ├── ScanSystem.ts        # Signaux, couverture de secteur, majorités
│   ├── ResourceSystem.ts    # Ressources, échanges, achat, processBonuses(), formatBonus/formatResource
│   ├── ComputerSystem.ts    # Ordinateur de données du joueur
│   ├── TechnologySystem.ts  # Recherche/acquisition de technologies
│   ├── RotationSystem.ts    # performRotation : rotation du système solaire (sondes entraînées, anomalies activées)
│   └── SpeciesSystem.ts     # Traces de vie, découverte et mécaniques des 5 espèces (Mascamites, Anomalies, Oumuamua, Centauriens, Exertiens)
src/session/                 # La partie comme session : point d'entrée unique des commandes (prérequis client/serveur)
│   ├── GameSession.ts       # dispatch(game, joueur, commande) : validation, règle, file d'interactions, fin de tour, étapes des robots
│   ├── commands.ts          # Command / Choice : tout ce qu'un joueur peut demander (sérialisable)
│   ├── InteractionQueue.ts  # File d'interactions dans l'état (game.interaction, game.pendingInteractions), ordre de résolution
│   ├── SessionJournal.ts    # Historique et annulation (états gardés depuis le début de l'avant-dernier tour de chaque humain)
│   ├── GameSetup.ts         # newGame(places, options) : création d'une partie (types, niveaux, premier joueur, journal de départ)
│   ├── GameRoom.ts          # Salle d'une partie à distance (pure) : places, jetons, commandes, étapes des robots, vues, sauvegarde
│   ├── protocol.ts          # Messages client/serveur (WebSocket), compatibilité des versions, lecture des messages reçus
│   ├── RemoteClient.ts      # Client du jeu en ligne (pur) : connexion, salle, commandes avec accusé de réception, reconnexion
│   └── PlayerView.ts        # viewFor(game, joueur), viewEntries(entrées, joueur) : ce qu'un joueur a le droit de voir (pioches, mains adverses, cartes piochées… masquées) ; pour le futur serveur
```

## Session et couches

- **Moteur indépendant de l'UI** : `core/`, `systems/`, `actions/`, `engine/`, `session/` (et le tutoriel, `tutorial/`) sont du TS pur. **Couches** (de bas en haut) : `core` (modèle) < `systems` (règles) < `actions`, `engine` (orchestration) < `ai` < `session` < `tutorial` < `ui` ; une couche n'importe jamais une couche au-dessus (imports de type exceptés), vérifié par `npm run check:cycles`. Un nouveau type va dans le fichier de son domaine de `core/model/`, importé depuis `core/types`. **Toute modification de la partie passe par `GameSession.dispatch(game, playerId, command)`** (dans l'UI : `useGameSession().dispatch`, via `run(command)` dans `BoardUI`) : la session vérifie qui joue et ce qui est permis (tour, interaction en cours et son joueur, règles des actions gratuites), applique la règle, résout les interactions automatiques et celles des robots, termine les tours (paliers compris, `game.endingTurn`) et renvoie les entrées d'historique et les annonces. Les robots passent par `GameSession.applyRobotStep`. L'UI garde seulement ses modes de sélection (défausse de fin de manche, échange de cartes, cartes cochées), les fenêtres de confirmation et les animations ; elle peut lire les systems pour afficher (coûts, cases jouables), jamais pour modifier la partie.
- **Logique métier hors de l'UI** : un handler de `BoardUI` ne fait qu'envoyer une commande (`run`, `choose`) ; une règle qui manque va dans le moteur (systems, actions, `InteractionChoices`, `GameSession`), avec son test.

## État immuable

Les systems prennent un `Game` et renvoient `{ updatedGame, historyEntries, ... }` **sans jamais modifier la partie reçue**. Dans le moteur, toute fonction qui modifie l'état commence par `cloneGame(game)` (`src/core/cloneGame.ts`, copie profonde ; à utiliser aussi dans l'UI plutôt que `structuredClone`). Pour la performance (la copie fait l'essentiel du temps des robots), la copie est faite à la main (`deepCopy`, pas `structuredClone`, environ 6 fois plus lent : 87 % du temps des robots avant le changement), et les données qui ne changent jamais sur place sont **figées et partagées** entre les copies : les cartes et les technologies entières (une carte révélée est remplacée : `{ ...carte, isRevealed: true }`), bonus des emplacements des planètes, satellites, secteurs et signaux, `fixedSlots` et `infiniteSlots` des espèces, prérequis des missions. Ne jamais les modifier sur place (une modification lève une `TypeError`) : les remplacer d'un bloc (ex. `species.fixedSlots = { ...species.fixedSlots, bluelifetrace: … }`). Les autres champs variables (sondes, signaux marqués…) restent copiés. Une opération qui n'appelle que d'autres opérations du moteur ne copie pas la partie elle-même (`AIController.processSingleInteraction` : 20 % du temps des robots), ni une partie qu'une opération vient de lui rendre sans erreur (`CardSystem.acquireCard` après `buyCard`). La partie relue d'une sauvegarde ne garde pas le journal (`deserializeGame` : `gameLog` vide, sinon recopié à chaque copie). La géométrie du système solaire (`getAllCells`) est mise en cache par état de rotation, cases figées. Mesure : `npm run bench:ai` (parties d'Experts à graines fixes, temps par étape et empreinte des résultats : une optimisation ne doit pas changer l'empreinte). Pas de copie superficielle `{ ...game }` suivie de mutations : c'était la source de bugs d'undo. `test/Immutability.test.ts` vérifie cette règle.

## Historique

- `HistoryEntry { message, playerId, sequenceId, previousState }`. `sequenceId` regroupe les entrées d'une même action et sert à l'undo. Le journal est tenu par `SessionJournal` : la première entrée de chaque commande garde l'état d'avant (file d'interactions comprise), seulement depuis le début de l'avant-dernier tour de chaque joueur humain (on peut encore revenir au tour qu'on vient de finir, robots compris) ; `undoLast` revient au début de la séquence, `undoTurn` au début du tour. Le moteur ne garde pas d'instantanés (l'ancien `game.history`, jamais utilisé, faisait passer l'état de 170 Ko à plus de 10 Mo en fin de partie). Les messages sont en français et affichés au joueur.
- Un passage qu'un seul joueur a le droit de lire (nom d'une carte piochée face cachée : pioche, achat dans la pioche, échange, bonus, réservation, carte Alien de la pioche, cartes de découverte) s'écrit `privateText(propriétaire, texte)` (`core/historyText.ts`) : l'historique affiché le montre au seul joueur humain qui en est propriétaire (`textFor` dans `HistoryBoardUI`, jeu local compris : les noms des cartes reçues ou piochées par un robot n'y apparaissent pas), `viewEntries` (`session/PlayerView.ts`) le retire pour les autres joueurs en ligne. Tout nouveau message qui nomme une carte cachée doit l'utiliser (`test/PrivateHistory.test.ts`).
- La première entrée de l'action principale d'un tour porte `mainAction` (posé par `GameSession`, joueur et robot, gardé par la sauvegarde) ; `core/historyTimeline.ts` découpe l'historique en manches et en tours pour la barre de progression (`ui/components/HistoryProgressBar` : fenêtre de fin de partie, carte « Continuer » de l'accueil).
- Le moteur rédige le message de chaque action (y compris orbite et atterrissage) puis ses conséquences avec le même `sequenceId` ; l'historique indente ces conséquences sous l'action.

## Interactions

- **Interactions multi-étapes** : union discriminée `InteractionState` (`core/model/interactions.ts`). L'interaction en cours et la file sont dans la partie (`game.interaction`, `game.pendingInteractions`, gérées par `InteractionQueue` : plusieurs gains à choix forment un menu, les résolutions de secteur passent en dernier). **Registre `INTERACTIONS`** (même fichier) : pour chaque type, son libellé (`getInteractionLabel`), sa résolution (`choice` : choix du joueur ; `automatic` : `InteractionResolver` ; `local` : mode de sélection de l'interface), les genres de `Choice` qui y répondent (`acceptsChoice`) et le renoncement (`isSkippable`). Les opérations sont dans des tables indexées par type, que le compilateur vérifie complètes : `CHOICE_HANDLERS` (`GameSession`, une entrée par interaction à choix) et `AIController.ROBOT_HANDLERS` (robots, toutes sauf `local`). Pour en ajouter une : skill `ajouter-interaction`.
- **Menu des récompenses** (`CHOOSING_BONUS_ACTION`) : les interactions créées par un même bonus (`ResourceSystem.processBonuses`, au moins deux) portent `autoGains`, la part du bonus appliquée d'office (`ResourceSystem.automaticGains` : PV, ressources, pioche, sonde, rotation, signaux à secteur imposé) ; `InteractionQueue.enqueue` les reprend sur le menu (une fois par bonus), qui les montre grisés. Renoncer au menu (`SKIP`, « Ne rien faire d'autre ») abandonne les choix restants (`test/BonusMenuAutoGains.test.ts`).
- **Interactions automatiques** (`TRIGGER_CARD_EFFECT`, `RESOLVING_SECTOR`, `DRAW_AND_SCAN`, `CLAIMING_MISSION_REQUIREMENT`) : une seule implémentation, `InteractionResolver.resolve`, appelée par `GameSession` (dès qu'une telle interaction arrive en tête de file) et par `AIController` (robots). Ne pas réimplémenter ces règles ailleurs.
- De même, toutes les interactions à choix passent par `InteractionChoices` : cartes (`acquireCard`, `selectScanCard`, `reserveCards`, `discardForSignals`, `playExertienCard`), sondes (`chooseMediaOrMove`, `removeProbe`, `takeSpecimen` et `specimenPlanets`), observations (`observation2`, `observation3`, `observation4`), ainsi que `placeLifeTrace`, `acquireAlienCard`, `placeObjectiveMarker`, `acquireTech` (technologies autorisées par `TechnologySystem.acquirableTechs`, colonne d'ordinateur, `noTileBonus`), `placeBonusProbe` (placements restants dans `nextInteraction`), `claimCentaurienReward` (palier `markerId`), `chooseMissionRequirement`, `chooseBonusAction`, `applyScanFollowUp` (signaux « secteur d'une sonde » d'une même carte, `ScanSystem.scanFollowUp` : tous dans le même secteur, sauf la carte 30 : une sonde par signal), `noteDiscovery` pour annoncer une découverte d'espèce ; déplacements gratuits consommés : `ProbeSystem.freeMovementsUsed` ; défausse en passant : `CardSystem.cardsToDiscardAtPass`, vérifiée par `PassAction`) : l'UI fournit le choix du clic, le robot celui de sa simulation ou de son tirage ; une nouvelle interaction à choix y ajoute sa fonction (avec son test), plutôt qu'une règle dans un handler ou dans `AIController`. Une fonction qui laisse une suite (cartes, placements ou déplacements restants) la renvoie dans `nextInteraction`.
- Une interaction destinée à un autre joueur porte son `playerId` ; pendant le tour d'un robot, celles destinées à un humain entrent dans la file de la partie (`AIController` → `AITurn` → `GameSession.applyRobotStep`) et seul ce joueur peut y répondre ; une interaction destinée à un robot est résolue par `AIController` dans la session. Les choix ouverts en fin de tour remontent en liste (`TurnManager.finishTurn` → `pendingInteractions`, `AITurn.endTurn` → `humanInteractions`).
- Pour placer automatiquement une trace de vie, utiliser `SpeciesSystem.placeLifeTraceAuto` (ordre de `lifeTraceOptions` : couleur manquante d'une espèce non découverte, puis n'importe quel emplacement libre de la piste d'une espèce découverte, plus l'emplacement infini suivant si l'espèce en a (`SpeciesSystem.hasInfiniteSlot` : ni Mascamites ni Exertiens), puis emplacements excédentaires) ; choix des robots : `.claude/rules/robots.md`.

## Cartes et effets

- **Cartes** : CSV `;` (UTF-8 avec BOM, retiré par `DataLoader.parseCSV` : `fetch` le retire mais pas une lecture sur disque, serveur et outils, `test/DataLoaderBom.test.ts`) avec les colonnes `Id;Nom;Type;Texte;Action gratuite;Couleur scan;Revenu;Cout;Gain;Contrainte`. `Gain` et `Contrainte` encodent les effets (`1 Sonde + 1 Média`, `GAIN_ON_VISIT:jupiter:data:1`, `VISIT_PLANET:mars:4`…), parsés dans `DataLoader`. Modifier une carte = modifier le CSV dans `public/cards/` (skill `modifier-carte`).
- **Effets de carte** : `CardEffect.value` est de type `CardEffectValue` (nombre, booléen, chaîne de mission, `EffectAmount` ou `Bonus`). Le lire avec les accesseurs de `core/cardEffects.ts` (`effectNumber(effect)` pour un calcul, `effectString` pour une mission `GAIN_IF_…`, `effectAmount<Scope>` pour quantité + portée, `effectBonus` pour des gains multiples), jamais avec `effect.value` brut dans une opération.

## Vérifications, hasard, premier joueur

- **Vérifications** : un joueur inconnu est une erreur de programmation, `requirePlayer(game, id)` (`core/players.ts`) lève une exception plutôt que de renvoyer une valeur par défaut. Les vérifications `canX` renvoient un `RuleCheck<'canX'>` (`core/model/game.ts`) : un refus porte toujours sa raison, affichée telle quelle. Pas de garde (`|| []`, `if (!x)`) sur un champ que les types garantissent.
- **Hasard** : jamais de `Math.random()` dans le moteur ni dans `ai/`, toujours `random()` de `core/random.ts` (générateur à graine). `GameFactory.createGame(noms, humainPremier, graine)` part de la graine (tirée au hasard si absente) et la note dans `game.seed` : même graine et mêmes choix = même partie. L'UI garde `Math.random` pour ce qui n'est pas du jeu (infobulles, noms des robots). Le générateur est partagé par tout le programme, mais chaque partie garde son état (`game.rngState`) : tout calcul aléatoire repart de cet état et rend l'état atteint (`withRandomState` ; `GameSession.dispatch`, `ai/robotCompute` : `computeStep`, `computeEndTurn`), et ne tire jamais avant un `await` pour continuer après (un autre calcul pourrait tirer entre-temps) : `createGame` lit toutes les cartes d'abord, puis fait la mise en place d'un trait ; une étape de robot calculée ailleurs (Web Worker, worker_thread) revient avec son état, que `GameSession.applyRobotStep(partie, étape, rngState)` reprend (`test/RobotCompute.test.ts`). Identifiants : `uniqueId()` de `core/ids.ts`, pas `Date.now()` seul.
- **Premier joueur** : `GameFactory.setFirstPlayer(game, index)` fixe le premier joueur et les PV de départ dans l'ordre du tour (1 PV pour le premier, règles) ; `createGame` et `GameSetup.newGame` passent par elle.

## Persistance, version, traces

- **Persistance** : `GamePersistence` (pur) + `useAutosave` (`localStorage['seti_autosave']`, écriture différée de 500 ms, immédiate si la page est quittée) + export/import JSON dans `SettingsModal`. Les sauvegardes portent `saveVersion` : tout changement incompatible du modèle incrémente `SAVE_VERSION` et ajoute une migration dans `MIGRATIONS` (appliquée aussi aux états d'annulation du journal). Une sauvegarde plus récente que le jeu est refusée (`SaveVersionError`). Elle enregistre aussi l'état du générateur aléatoire (`rngState`), rétabli au chargement.
- **Version** : `GAME_VERSION` (`core/version.ts`) = version de `package.json` (vérifié par `test/Version.test.ts`), affichée dans le menu et la documentation avec le commit du build (`__BUILD_COMMIT__`, injecté par Vite). Le serveur refuse un client d'une autre version mineure. L'augmenter à chaque version publiée (skill `publier-version`).
- **Traces** : le moteur, les robots et la session n'appellent jamais `console` directement, mais `trace.info/warn/error` (`core/trace.ts`) : `[AI]` décisions des robots et `[Game]` action exécutée (info), passe forcée ou action impossible d'un robot (warn), erreurs de chargement des cartes ou de la session (error). Niveau `warn` par défaut (serveur, tests, version publiée) ; `info` en développement (`main.tsx` et `ai/aiWorker.ts`, d'après `__DEBUG_TOOLS__`). L'interface et le serveur gardent `console` pour leurs propres messages ; `core/Logger.ts` est le journal de partie, pas la console.
