# Tasks

## 1. Déblocage des espèces (progression et relevé)

- [x] 1.1 `ui/tutorialProgress.ts` : champ `species: string[]` (lu `[]` par défaut), `unlockSpecies(nom)` qui renvoie si l'espèce est nouvelle ; tests de composant (progression ancienne sans le champ, stockage indisponible)
- [x] 1.2 `TutorialChapter.species?` (types) et fonction pure `isChapterUnlocked(chapitre, espècesDébloquées)` dans `src/tutorial/` ; test Jest
- [x] 1.3 Hook de `BoardUI` : hors tutoriel, relève les plateaux découverts de la partie affichée (locale, en ligne, reprise) et débloque leur espèce ; message « Nouveau chapitre du tutoriel : … » au premier déblocage ; test de composant (découverte par un robot, partie reprise, partie de tutoriel ignorée)

## 2. Menu du tutoriel

- [x] 2.1 `TutorialMenu` : chapitres d'espèce verrouillés (cadenas, « Espèce inconnue », explication, bouton désactivé), regroupés avant « Première vraie partie » ; texte d'introduction ; test de composant (verrouillé, débloqué, clic sans effet)

## 3. Chapitres des espèces

- [x] 3.0 Ellipse entre deux étapes (`TutorialStep.ellipsis`) : appliquée par « Suivant » dans l'interface et par `checkSolution` ; test Jest
- [x] 3.1 Aide de scénario commune : espèce choisie sur le premier plateau, deux traces de découverte posées, ordinateur prêt pour la trace bleue ; test Jest
- [x] 3.2 Chapitre Mascamites (prélèvement d'un spécimen, capsule) : étapes, solution, textes dans `tutoriel.md`
- [x] 3.3 Chapitre Anomalies (rotation par la recherche d'une technologie, récompense de l'anomalie) : étapes, solution, textes
- [x] 3.4 Chapitre Oumuamua (couverture de son secteur, jetons, piste payée en jetons) : étapes, solution, textes
- [x] 3.5 Chapitre Centauriens (palier de message, choix d'une tuile) : étapes, solution, textes
- [x] 3.6 Chapitre Exertiens (cartes hors main, carte jouée face cachée, danger, paliers) : étapes, solution, textes
- [x] 3.7 `TutorialChapters.test.ts` et `TutorialText.test.ts` couvrent les cinq chapitres ; `npm run tutorial:seed` vérifie leurs graines

## 4. Documentation masquée

- [x] 4.1 Marqueurs `<!-- espece:… -->` sur les titres 3.2 à 3.6 de `documentation.md` ; ancre de l'encart (`especes-inconnues`)
- [x] 4.2 Fonction pure `hideLockedSpecies(markdown, débloquées)` dans `src/tutorial/` (un seul encart, sections débloquées intactes, titre suivant de même niveau) ; tests Jest
- [x] 4.3 `DocumentationModal` : applique le masquage ; une ancre masquée ouvre l'encart ; test de composant (lien « En savoir plus » vers une espèce verrouillée)

## 5. Chapitre « Traces de vie et espèces » sans révélation

- [x] 5.1 Chapitre : `masksSpecies`, espèce choisie à la préparation (une espèce débloquée, sinon Anomalies) ; solution vérifiée dans les deux cas ; textes génériques dans `tutoriel.md`
- [x] 5.2 Liste des espèces masquées et des cartes de leur pioche, calculée au démarrage du chapitre et transmise par `BoardUI`
- [x] 5.3 Masquage dans l'interface : annonce sans nom, plateau « Espèce découverte » (pistes, cartes, symboles et bouton de documentation remplacés par un encart), cartes Alien de dos (main, pioche de l'espèce), noms de cartes dans l'historique, jetons d'anomalie non dessinés
- [x] 5.4 Test de composant : plateau, main et historique du chapitre sans le nom de l'espèce ni de ses cartes ; même chapitre avec une espèce débloquée affichée normalement

## 6. Vérification et documentation

- [x] 6.1 Parcours Playwright : chapitre d'espèce verrouillé puis débloqué (progression injectée), documentation masquée puis visible
- [x] 6.2 `public/docs/documentation.md` (section tutoriel : chapitres d'espèce et déblocage) et `.claude/rules/ui.md` (progression : espèces débloquées)
- [x] 6.3 `npm run check`, couverture et tests de bout en bout

## Workflow follow-up

- Archiver `add-tutorial` avant d'archiver ce changement, pour que la capacité `tutorial` existe dans `openspec/specs/`.
