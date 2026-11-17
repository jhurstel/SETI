# Proposal

## Why

Le tutoriel enseigne l'interface et les règles communes, mais les cinq espèces Alien ont chacune leurs propres mécaniques (spécimens, anomalies, jetons d'Oumuamua, messages centauriens, cartes et danger des Exertiens), aujourd'hui seulement décrites dans la documentation. Or découvrir une espèce et ses règles fait partie du plaisir du jeu : la documentation les dévoile toutes d'emblée. On veut un chapitre par espèce, qui se débloque quand le joueur la rencontre en partie, et des règles d'espèce cachées tant qu'elle n'a pas été découverte.

## What Changes

- Cinq nouveaux chapitres du tutoriel, un par espèce (Mascamites, Anomalies, Oumuamua, Centauriens, Exertiens). Chacun part d'une position préparée où le joueur découvre l'espèce lui-même (troisième trace de vie), puis pratique sa mécanique principale.
- Ces chapitres sont **verrouillés** au départ. Une espèce est débloquée, dans ce navigateur, dès qu'elle est découverte (par n'importe quel joueur, robot compris) dans une vraie partie, locale ou en ligne. Les découvertes faites dans le tutoriel ne débloquent rien.
- Le menu du tutoriel montre les chapitres verrouillés sans nommer l'espèce (« Espèce inconnue », cadenas, explication du déblocage).
- Le premier déblocage d'une espèce en partie est signalé (« Nouveau chapitre du tutoriel : … »).
- La documentation masque les sections des espèces non débloquées (sections 3.2 à 3.6) : à la place, un encart sans le nom de l'espèce explique comment la débloquer. Les liens « En savoir plus » et le bouton de documentation d'un plateau Alien ne mènent qu'à des sections débloquées.
- Le chapitre existant « Traces de vie et espèces » ne dévoile plus d'espèce réelle à un joueur qui ne l'a pas débloquée (voir design).

Hors du périmètre :

- Les livrets PDF (règles et FAQ) restent accessibles en entier : ce sont les règles officielles.
- Les autres mentions des espèces dans la documentation (tableau des interactions, glossaire des symboles) ne sont pas masquées dans ce changement.
- Pas d'option pour tout débloquer d'un coup (question ouverte dans le design).
- Aucun changement du moteur de jeu ni des robots : pas de migration de sauvegarde, pas de changement du protocole en ligne.

## Capabilities

### New Capabilities

- `tutorial` : exigences ajoutées sur les chapitres d'espèce, leur déblocage et le masquage des règles d'espèce dans la documentation. Cette capacité est introduite par le changement `add-tutorial` (terminé, pas encore archivé) : l'archiver avant celui-ci pour que ces exigences s'ajoutent à sa spec.

### Modified Capabilities

(aucune parmi `game-rules`, `robots`, `online-play`)

## Impact

- `src/tutorial/` : cinq chapitres (préparation, étapes, solution), aides de scénario propres aux espèces, fonction pure de masquage des sections de documentation.
- `public/docs/tutoriel.md` : textes des cinq chapitres ; `public/docs/documentation.md` : marquage des sections d'espèce.
- `src/ui/` : progression (`tutorialProgress.ts` : espèces débloquées), enregistrement des découvertes en partie, menu du tutoriel (chapitres verrouillés), fenêtre de documentation (sections masquées), annonce du déblocage.
- Tests : solutions des cinq chapitres (`TutorialChapters.test.ts`), masquage de la documentation, menu et progression (tests de composant), un parcours Playwright.
- Stockage local `seti_tutorial` : nouveau champ, lu avec une valeur par défaut (les progressions existantes restent valides).
