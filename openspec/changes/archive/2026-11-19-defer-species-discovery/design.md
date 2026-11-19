# Design

## Context

État actuel observé dans le code :

- `SpeciesSystem.placeLifeTrace` (trace posée par un joueur) et `SpeciesSystem.placeNeutralMilestone` (palier neutre, appelé par `ScoreManager.checkScoreMilestones`) appellent `discoverSpecies` dès que le triangle d'un plateau a ses trois couleurs. `discoverSpecies` retourne le plateau (`isDiscovered`), distribue les cartes Alien des marqueurs de découverte, met l'espèce en jeu (spécimens, Oumuamua, anomalies, paliers Centauriens et Exertiens) et renvoie les choix des cartes Exertiens (`CHOOSING_EXERTIEN_CARD`, palier 0).
- La fin du tour passe par `TurnManager.finishTurn` : `ScoreManager.checkScoreMilestones` résout les paliers dans l'ordre (objectifs, neutres, Centauriens, Exertiens). S'il ouvre un choix, le tour attend (`endingTurn`) et `GameSession` rappelle `finishTurn` une fois la file vide. `PassAction` et les robots (`AITurn`) passent par le même chemin.
- Annonces : `GameSession` transforme l'entrée d'historique `DISCOVERY_MESSAGE` en annonce `DISCOVERY_NOTICE`, puis `namedNotifications` la remplace par le nom de l'espèce découverte pendant la commande. L'interface (`useAnnouncements`) affiche la bande « Nouvelle espèce ». `useSpeciesUnlock` débloque l'espèce et affiche « Nouveau chapitre du tutoriel : … » (message simple).
- Tutoriel : `speciesChapters.ts` enchaîne `discoverySteps` (poser la trace ; étape terminée quand `isDiscovered`), puis une étape de fin de tour. La découverte des Exertiens ouvre aussitôt le choix des cartes.
- `AIEvaluator` mesure la progression d'une espèce avec `board.isDiscovered`.

## Goals / Non-Goals

**Goals:**

- Une seule règle de découverte différée, quelle que soit la source (trace de vie ou palier neutre), résolue au même endroit de la fin de tour, pour le joueur humain comme pour les robots.
- L'interface ne calcule rien : le moteur décide quand l'espèce est révélée ; la session émet les deux annonces.

**Non-Goals:**

- Pas de changement des effets de `discoverSpecies` ni des bonus des emplacements Découverte.
- Pas de réglage des poids des robots (mesure seulement).

## Decisions

### 1. Découvertes en attente dans la partie (core)

Nouveau champ facultatif `pendingDiscoveries?: number[]` sur la partie : indices des plateaux Alien complétés pendant le tour, dans l'ordre où ils l'ont été. Un plateau en attente garde `isDiscovered === false`.

- Alternative écartée : un drapeau sur chaque plateau. Une liste garde l'ordre quand deux espèces sont complétées dans le même tour, sans comparer d'horodatage.
- Champ facultatif : une sauvegarde existante n'en a pas (aucune découverte en attente), donc pas de migration ni de changement de `SAVE_VERSION`.

### 2. La troisième trace note la découverte (systems)

`placeLifeTrace` et `placeNeutralMilestone` ajoutent l'indice du plateau à `pendingDiscoveries` au lieu d'appeler `discoverSpecies`. Ils gardent l'entrée `DISCOVERY_MESSAGE`, qui produit l'annonce générique. Le bonus de l'emplacement Découverte reste gagné aussitôt. Le code de retour `DISCOVERED` de `placeNeutralMilestone` devient « complété » : l'historique écrit que l'espèce sera révélée en fin de tour.

Nouvelle opération `SpeciesSystem.resolvePendingDiscoveries(game)` : pour chaque indice en attente, dans l'ordre, elle appelle `discoverSpecies`, puis vide la liste. Elle renvoie la partie, l'historique et les choix ouverts (cartes Exertiens). Elle ne modifie pas la partie reçue.

### 3. Résolution après les paliers (engine)

Dans `TurnManager.finishTurn`, une fois que `checkScoreMilestones` ne demande plus de choix, `resolvePendingDiscoveries` s'applique avant `advance`. S'il ouvre des choix (Exertiens), le tour attend comme pour un palier : les choix sont renvoyés en `pendingInteractions`, et `finishTurn` est rappelé une fois la file vide. Comme la liste est vidée, ce second passage ne redécouvre rien.

- L'ordre « paliers, puis découvertes » est garanti par cette position unique. Les paliers créés par la découverte (palier Centaurien à +15, Exertiens à +20 et +40) ne peuvent pas être atteints dans le même tour : ils sont au-dessus du score.
- `finishTurn` renvoie `discoveryNotification` avec le nom de chaque espèce révélée.
- Alternative écartée : résoudre dans `checkScoreMilestones`, comme une 5e sorte de palier. Ce serait plus court, mais la découverte n'est pas un palier, et la fonction est appelée aussi hors de la fin de tour.

### 4. Annonces (session)

- Pendant la commande qui pose la troisième trace : l'annonce générique `DISCOVERY_NOTICE` reste générique, car aucune espèce n'est révélée pendant cette commande. `namedNotifications` ne la renomme plus.
- À la fin du tour : `discoveryNotice(nom)` pour chaque espèce révélée, via `discoveryNotification` de `finishTurn` (fin de tour du joueur, `PassAction`, tour d'un robot).

### 5. Annonce de fin de tour et chapitre proposé (ui)

- `useAnnouncements` reçoit la liste des espèces débloquées pour la première fois (`useSpeciesUnlock`). La bande « Nouvelle espèce » de cette espèce porte alors un bouton « Voir le chapitre du tutoriel ». Elle reste affichée tant que la souris est dessus, et le bouton se clique sans fermer la partie par erreur. Le message séparé « Nouveau chapitre du tutoriel » disparaît quand la bande porte ce bouton.
- Conditions : pas dans un chapitre (les découvertes d'un chapitre ne débloquent rien) ; pas en ligne, où la bande garde le message sans bouton, car quitter abandonnerait la salle ; espèce débloquée pour la première fois dans ce navigateur.
- Clic : la sauvegarde automatique est écrite tout de suite (`useAutosave` diffère de 500 ms ; on force l'écriture avant de remplacer la partie), puis `startChapter(chapitre de l'espèce)`. « Continuer » reprend ensuite la partie.

### 6. Robots (ai)

`AIEvaluator` compte un plateau en attente comme découvert (progression 1) : la valeur d'avoir complété une espèce ne doit pas tomber à zéro entre la trace et la fin du tour. Rien d'autre : les robots finissent leur tour par le même `finishTurn`.

Mesure : `npm run tune:ai -- levels 2 60`, puis `levels 3 60`, avant et après le changement (écart Expert contre Avancé). Résultats consignés dans `.claude/skills/mesurer-robots/resultats.md`.

### 7. Tutoriel (tutorial)

`discoverySteps` devient : présentation, analyse, « poser » (terminée quand le plateau est en attente de découverte), « fin du tour » (terminée quand l'espèce est révélée), puis « découverte » (présentation de l'espèce révélée). Les étapes `endTurnAfterDiscovery` qui suivaient la découverte se décalent, et les solutions (`solution`) gardent leur `END_TURN`, qui révèle maintenant l'espèce. Les Exertiens : l'étape qui présente le choix des cartes s'affiche pendant ce choix, ouvert à la fin du tour. Le chapitre « Traces de vie et espèces » suit le même schéma. Les textes de `tutoriel.md` sont réécrits en conséquence, et `npm run tutorial:seed` vérifie chaque graine.

### 8. Infobulle du 2e palier Exertien (ui)

`ObjectiveBoardUI` ajoute au texte du palier le coût donné par `SpeciesSystem.exertienCardCost(game, palier)`, par exemple « Jouer une carte coûte 1 crédit ». Aucune règle n'est recalculée dans l'interface.

## Risks / Trade-offs

- [Trace posée sur un plateau complété mais pas encore révélé] → C'est le comportement d'un plateau face cachée : sa piste n'est pas disponible, et le choix d'emplacement propose ce qu'il proposait avant la découverte. Un test le vérifie.
- [Sauvegarde prise entre la troisième trace et la fin du tour] → `pendingDiscoveries` est sauvegardé avec la partie. Une sauvegarde d'avant ce changement ne peut pas être dans cet état, car l'ancienne règle découvrait aussitôt.
- [Fin de manche ou de partie dans le même tour] → `finishTurn` résout la découverte avant `advance`, donc avant les revenus et le décompte final.
- [Robots un peu moins efficaces] → mesure avant/après ; si l'écart Expert/Avancé baisse nettement, on en tient compte dans l'évaluation (décision 6).
- [Bande d'annonce cliquable] → La bande devient interactive pendant quelques secondes. Elle reste à l'écart des boutons du plateau, et Échap la ferme.

## Migration Plan

Pas de migration de sauvegarde. Publication habituelle (`/publier-version`) : interface et serveur ensemble, car le serveur exécute le moteur.
