# Tasks

## 1. Adversaire passif (ai)

- [x] 1.1 Ajouter `'IDLE'` à `AIDifficulty` (`core/model/ai.ts`) et aux tables par niveau de `AIBehavior` (valeurs à 0) ; vérifier que `npm run typecheck` passe
- [x] 1.2 Dans `AITurn.playStep`, faire passer directement un joueur `IDLE` (4 premières cartes gardées dans l'ordre, première carte de la pile de fin de manche, aucun appel à `random()`) ; test Jest (`createTestGame`) : le tour d'un `IDLE` appliqué par `GameSession.applyRobotStep` donne la partie attendue, ne modifie pas la partie reçue, laisse `rngState` inchangé et reste identique quand les poids changent
- [x] 1.3 Vérifier que `IDLE` n'est proposé ni dans `SetupFields` ni dans le choix des niveaux en ligne (test de composant ou e2e existant), et que `npm run bench:ai -- 3 2` garde la même empreinte qu'avant

## 2. Couche tutorial (TS pur)

- [x] 2.1 Créer `src/tutorial/` (types `TutorialChapter`, `TutorialStep`, `TutorialCommand`) et ajouter la couche à `tools/check-cycles.mjs` entre `session` et `ui` ; vérifier que `npm run check:cycles` passe et qu'un import de `ui/` depuis `tutorial/` y est refusé
- [x] 2.2 Écrire `prepareChapter(chapter)` (création à graine fixe, mise en place, commandes de préparation par `GameSession.dispatch`) ; test Jest : deux préparations du même chapitre donnent des parties identiques
- [x] 2.3 Écrire `TutorialRunner` (étape courante, « Suivant », réévaluation après une commande ou une annulation) ; tests Jest : avancée par prédicat, avancée par « Suivant », retour à l'étape correspondante après annulation, état reçu non modifié
- [x] 2.4 Écrire `tutorialBlockReason` (actions principales permises par étape) ; test Jest : action hors sujet refusée avec sa raison, action permise acceptée, actions gratuites jamais filtrées
- [x] 2.5 Écrire `tutorialText.ts` (découpe de `tutoriel.md` en chapitres et étapes) ; test Jest sur un texte d'exemple (titres, identifiants, section manquante signalée)

## 3. Chapitres

- [x] 3.1 Écrire l'outil `tools/tutorial/findSeed.ts` (essaie des graines jusqu'à une préparation valide) et vérifier qu'il trouve une graine pour un chapitre d'exemple
- [x] 3.2 Chapitres 1 à 4 (l'écran et le tour, sondes, atterrir et Médias, scanner) : préparation, étapes, solution, textes dans `public/docs/tutoriel.md` ; test Jest commun à tous les chapitres : préparation sans erreur, premier prédicat d'action faux, la solution termine chaque étape dans l'ordre sans action refusée
- [x] 3.3 Chapitres 5 à 7 (ordinateur et analyse, cartes et missions, technologies) avec leurs textes ; vérifiés par le test commun
- [x] 3.4 Chapitres 8 à 10 (traces de vie et espèces, passer et fin de manche, paliers et fin de partie), graines trouvées par `findSeed`, avec leurs textes ; vérifiés par le test commun
- [x] 3.5 Test Jest de cohérence : chaque étape a sa section dans `tutoriel.md` et inversement, et chaque `docLink` correspond à un titre de `documentation.md` (identifiant calculé par `slugify`)

## 4. Interface

- [x] 4.1 Ajouter les attributs `data-tutorial` aux zones ciblées (système solaire, plateau du joueur, ressources, actions, ordinateur, rangée de cartes, technologies, objectifs, espèces, historique, planètes) ; test de composant : chaque cible déclarée par les chapitres est rendue
- [x] 4.2 `ui/tutorialProgress.ts` (lecture et écriture protégées de `seti_tutorial` : chapitres terminés, refus, aides vues) ; test : stockage indisponible sans erreur, progression relue
- [x] 4.3 Mode tutoriel dans `BoardUI` : démarrage d'un chapitre, sauvegarde automatique coupée, `run` refusant une commande bloquée, raison ajoutée dans l'infobulle des actions (`PlayerActions`), retour à l'accueil au rechargement ; test de composant : action bloquée désactivée avec sa raison
- [x] 4.4 `TutorialOverlay` : bulle placée près de la cible, surbrillance, boutons « Suivant », « En savoir plus », « Quitter » ; fin de chapitre (marqué terminé, chapitre suivant ou menu) ; test de composant de la bulle
- [x] 4.5 `DocumentationModal` : prop `section` qui ouvre la documentation sur une section, et retour à la même étape à la fermeture ; test de composant
- [x] 4.6 Accueil : bouton « Tutoriel », menu des chapitres avec les chapitres terminés cochés, proposition au premier lancement (ni sauvegarde, ni progression, ni refus) et « Plus tard » ; test de composant des trois cas (nouveau joueur, sauvegarde présente, refus enregistré)
- [x] 4.7 Test Playwright `e2e/tutorial.spec.ts` : proposition du premier lancement, chapitre « L'écran et le tour » joué au clic jusqu'au bout (coché dans le menu), chaque chapitre préparé démarré avec sa bulle et toutes ses cibles à l'écran, partie sauvegardée intacte après un chapitre et retour à l'accueil au rechargement, « Première vraie partie » lancée (les solutions de tous les chapitres sont vérifiées par Jest, `TutorialChapters.test.ts`)

## 5. Première vraie partie et aide au contexte

- [x] 5.1 `tutorial/contextHints.ts` : déclencheurs purs (analyse possible, ordinateur plein, palier proche, première espèce découverte) ; tests Jest de chaque déclencheur sur une vraie partie
- [x] 5.2 Chapitre 11 : partie normale contre un robot Débutant avec l'aide au contexte, une seule fois par aide (`hintsShown`), réglage désactivable dans les paramètres ; test de composant : aide affichée une fois puis plus

## 6. Documentation et vérification

- [x] 6.1 Mettre à jour `CLAUDE.md` et `.claude/rules/` (nouvelle couche `tutorial`, niveau `IDLE`, relecture de `tutoriel.md` quand une règle change dans `docs.md`) ; vérifier la cohérence avec `tools/check-cycles.mjs`
- [x] 6.2 Ajouter à `public/docs/documentation.md` une section sur le tutoriel (accès, chapitres, progression) et l'adversaire passif dans la section des robots ; vérifier son affichage dans la fenêtre 📖
- [x] 6.3 Lancer `npm run check` puis `npm run test:e2e` : 0 erreur, couverture du moteur maintenue

## 7. Retours sur le tutoriel

- [x] 7.1 Étape figée pendant un choix en cours et bulle masquée (plus de retour à une étape déjà faite, rangée de cartes dégagée) : prédicats sans « partie au repos », `TutorialRunner.displayIndex` et son test
- [x] 7.2 Panneau décrit ouvert et gardé ouvert, autres panneaux refermés, historique réduit pendant un chapitre (`ui/tutorialFocus.ts`, `useTutorialPanel`) ; test de composant
- [x] 7.3 Seuls les éléments de l'action permise clignotent : Terre, planètes, emplacements d'orbite et d'atterrissage, panneaux des planètes et des technologies ; vérifié dans le navigateur
- [x] 7.4 Textes : bandeau titre des panneaux, Terre cliquable (chapitres 1 et 2), emplacement d'orbiteur et bonus de Mars (chapitre 2), hexagone ou emplacement d'atterrisseur et gain de la case (chapitre 3) ; npm run check et e2e du tutoriel
- [x] 7.5 Pendant une étape, plus aucun autre élément ne clignote : case de signal du secteur de la Terre (et d'Oumuamua) seulement si l'étape demande un scan, cercles de mission seulement à l'étape des missions ; vérifié dans le navigateur (animations en cours à chaque étape du chapitre 1)
- [x] 7.6 Chapitre Cartes et missions en 4 tours : mission déclenchée (ISS) et défausse d'une carte pour son action gratuite, recouvrement d'un cercle, mission conditionnelle (Télescope Lovell, accomplie dès qu'elle est jouée), carte Fin de jeu (Mars Science Laboratory) et décompte ; zone décrite amenée à l'écran ; solution vérifiée par Jest et parcours fait dans le navigateur
- [x] 7.7 Menu : coche discrète, résumés sur une ligne (raccourcis) ; chapitre Technologies : rotation montrée pendant le choix de la technologie (étapes duringChoice, panneau replié jusqu'à « Suivant »), gains des tuiles et choix supplémentaires expliqués ; texte de l'ordinateur ; documentation 2.4 corrigée (gains des piles, 2 PV de la tuile du dessus) ; vérifié dans le navigateur
- [x] 7.8 Bulle placée sous les zones du plateau joueur (système solaire dégagé) ; texte de l'atterrissage corrigé (premier emplacement libre) ; chevrons de rotation expliqués
- [x] 7.9 Étapes trace de vie jaune (chapitre Atterrir) et rouge (chapitre Scanner : secteur de la Terre presque rempli d'avance, couvert par le scan) : bonus de découverte et carte de l'espèce à sa découverte ; chapitre terminé sans commande possible ; « médias » en minuscule

## Workflow follow-up

- Archiver le changement (`/openspec-archive-change`) une fois validé, puis vérifier que `CLAUDE.md`, `.claude/rules/` et la documentation reflètent le code.
