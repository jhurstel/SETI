# Tasks

## 1. Impasses déclarées et mode annulation (moteur du tutoriel)

- [x] 1.1 Ajouter `TutorialDeadEnd` et `TutorialChapter.deadEnds` (`src/tutorial/types.ts`) ; `TutorialRunner.currentStep` et `displayIndex` rendent la première impasse vraie avant l'étape courante, sauf pendant un choix en cours ; vérifier par des tests de `test/TutorialEngine.test.ts` (impasse prioritaire sur une étape antérieure, impasse levée après annulation, différée pendant un choix, partie reçue non modifiée)
- [x] 1.2 Ajouter `TUTORIAL_UNDO_REASON` dans `guidance.ts` : actions principales et fin du tour refusées sur une étape d'impasse, actions gratuites et annulation permises ; vérifier par un test de `tutorialBlockReason` et `tutorialCommandBlockReason`
- [x] 1.3 `checkSolution` (`solve.ts`) signale toute impasse rencontrée en jouant la solution ; vérifier par un test « une impasse vraie sur le chemin de la solution est signalée »

## 2. Conversion des étapes « annuler » existantes

- [x] 2.1 Déplacer `blueTraceElsewhere` dans `scenario.ts` et convertir les cinq étapes `annuler` (Sondes, Traces de vie et espèces, Mascamites, Oumuamua, Exertiens) en impasses ; renommer leurs sections dans `public/docs/tutoriel.md` (`annuler-<cause>`) ; vérifier que les tests existants de ces étapes passent, adaptés à l'étape d'impasse
- [x] 2.2 Supprimer `onlyIf` de `TutorialStep` s'il n'a plus d'usage (sinon le garder) et vérifier `npm run typecheck`

## 3. Nouvelles impasses par chapitre

- [x] 3.1 Prédicats communs dans `scenario.ts` : `cannotReachToLand`, `cannotReachPlanet`, `lacks(ressource, besoin)`, `cardGone`, `mainActionWasted` ; vérifier par un test Jest de chaque prédicat sur une vraie partie (`createTestGame` ou chapitre préparé)
- [x] 3.2 `discoverySteps` devient `discovery()` (étapes et impasse « trace bleue ailleurs ») pour les cinq chapitres d'espèce ; vérifier par un test par chapitre d'espèce (trace bleue sur le second plateau → étape d'impasse) et la section de texte associée
- [x] 3.3 Atterrir et médias : sonde éloignée de Mars ; vérifier par un test (déplacements jusqu'à ne plus pouvoir revenir atterrir → impasse ; retour annulé → étape `atterrir`) et le texte
- [x] 3.4 Cartes et missions : carte du chapitre défaussée, médias sous 8 avant Lovell, crédits insuffisants, mauvaise carte jouée ; vérifier par un test pour chaque cause (dont « Lovell défaussée au tour 1 → impasse avant la fin du tour ») et les textes
- [x] 3.5 Technologies et Anomalies : médias sous 6 avant la recherche ; vérifier par un test (achat d'une carte → impasse) dans chacun des deux chapitres et les textes
- [x] 3.6 Mascamites : sonde hors de portée de Jupiter ou crédits insuffisants avant Premier Contact ; vérifier par un test pour chaque cause et les textes
- [x] 3.7 Oumuamua : énergie ou crédits insuffisants pour le scan ; vérifier par un test et le texte
- [x] 3.8 Centauriens : trace rouge hors de l'emplacement à 15 PV, données sous 3 avant de la poser ; vérifier par un test pour chaque cause (pose sur un autre emplacement de la piste, données placées dans l'ordinateur) et les textes

## 4. Explorateur des écarts

- [x] 4.1 `interactionAnswers(game, humanId)` dans `scenario.ts` (toutes les réponses possibles aux choix rencontrés dans les chapitres ; `answerInteraction` = la première) ; vérifier par un test sur des choix de carte, de secteur et de trace de vie
- [x] 4.2 `src/tutorial/explore.ts` : `exploreDeadEnds(chapter, prepared, { depth })` (écarts gratuits, actions permises avec chaque cible, chaque réponse aux choix ; impasse déclarée ou solution rejouée ou rattrapage court ; exceptions `explorerAllows` avec raison) ; vérifier par un test qui retire une impasse d'un chapitre et constate qu'elle est signalée avec l'étape et l'écart
- [x] 4.3 Test Jest : `exploreDeadEnds` à profondeur 1 sur tous les chapitres préparés, aucun écart fautif ; corriger ou déclarer chaque impasse révélée (avec son test et son texte) ; vérifier que la durée du fichier de test reste sous ~20 s
- [x] 4.4 Outil `tools/tutorial/deadEnds.ts` et script `npm run tutorial:dead-ends -- [chapitre] [profondeur]` (bundle esbuild comme `tutorial:seed`) ; lancer la profondeur 2 sur tous les chapitres, traiter chaque écart signalé, et vérifier que l'outil sort sans écart

## 5. Interface

- [x] 5.1 `TutorialOverlay` : bulle d'impasse (cible historique ouverte, texte de la cause) avec « Recommencer le chapitre », mis en avant quand rien n'est annulable ; handler dans `BoardUI` qui reprépare le chapitre comme au démarrage ; vérifier par un test de composant (`test/components/`) et dans le navigateur (Playwright, chapitre « L'écran et le tour » : crédits échangés → bulle, annulation → étape `lancer`, puis « Recommencer »)
- [x] 5.2 Infobulles des actions et de la fin du tour avec `TUTORIAL_UNDO_REASON` en mode annulation ; vérifier dans le navigateur

## 6. Documentation et vérification

- [x] 6.1 Mettre à jour `openspec/specs/tutorial` via l'archivage, `.claude/rules/` si le fichier des règles du tutoriel décrit les étapes `onlyIf`, et `CLAUDE.md` (commande `npm run tutorial:dead-ends`) ; vérifier par relecture
- [x] 6.2 Lancer `npm run check` (agent `verificateur`) et `npm run test:e2e` ; vérifier 0 erreur

## Workflow follow-up

- Archiver le changement (`/openspec-archive-change`) après validation par l'utilisateur.
