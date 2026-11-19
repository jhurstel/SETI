# Proposal

## Why

Un chapitre du tutoriel peut se retrouver dans une impasse : le joueur fait un choix permis (dépenser son énergie pour éloigner une sonde de son objectif, poser la trace bleue ailleurs que sur l'espèce à découvrir, envoyer le signal de la carte de la rangée dans un autre secteur que celui prévu, acheter une carte avec les médias qui devaient payer la recherche…) et l'étape attendue devient impossible, sans que la bulle le lui dise. Cinq chapitres ont déjà une étape « annuler » écrite à la main (Sondes, Traces de vie et espèces, Mascamites, Oumuamua, Exertiens), mais l'inventaire des autres chapitres montre des impasses non couvertes, et rien ne garantit qu'une nouvelle impasse soit repérée quand un chapitre change.

## What Changes

- Le tutoriel bascule en **mode annulation** dès que la partie ne permet plus de terminer le chapitre : la bulle explique la cause, met en avant l'historique, désactive les actions principales et la fin du tour (pour que l'erreur reste annulable), et le chapitre reprend à l'étape qui correspond à la partie une fois l'erreur annulée.
- Les impasses deviennent une déclaration du chapitre (une liste de conditions, chacune avec son texte), vérifiée à chaque étape, au lieu d'étapes « annuler » placées à une position précise de la liste ; les cinq étapes « annuler » existantes y sont converties.
- Nouvelles impasses détectées, d'après l'inventaire des chapitres :
  - **Traces de vie et espèces** et les cinq chapitres d'espèce : trace bleue posée sur un autre plateau Alien que celui de l'espèce à découvrir (déjà couvert dans « Traces de vie et espèces », étendu aux chapitres d'espèce).
  - **Atterrir et médias** : sonde éloignée de Mars sans assez d'énergie pour y revenir et atterrir.
  - **Cartes et missions** : carte du chapitre (ISS, Télescope Lovell, Mars Science Laboratory) défaussée ou échangée ; médias dépensés qui empêchent la condition du Télescope Lovell (8 médias) ; crédits insuffisants pour les cartes restantes. Une autre carte que celle de l'étape est refusée par le guidage (comme pour Premier Contact).
  - **Technologies** et **Anomalies** : médias dépensés (achat d'une carte) avant la recherche, qui en coûte 6.
  - **Mascamites** : sonde éloignée de Jupiter, ou crédits dépensés par une autre carte, avant de jouer Premier Contact.
  - **Centauriens** : trace rouge posée ailleurs que sur l'emplacement à 15 PV, ou données dépensées dans l'ordinateur (il en faut 3 pour cet emplacement).
  - **Oumuamua** : énergie ou crédits insuffisants pour le scan (en plus de la mauvaise carte ou du mauvais secteur, déjà couverts).
- Filet de sécurité : en mode annulation, quand l'historique ne permet plus de remonter jusqu'à l'erreur, la bulle propose de **recommencer le chapitre**.
- Vérification systématique : un explorateur joue, depuis chaque étape de chaque chapitre, les écarts possibles du joueur (actions gratuites, actions permises avec chaque carte, chaque réponse aux choix) et signale tout écart qui rend le chapitre impossible à terminer sans déclencher le mode annulation. Il tourne dans les tests (écarts d'un coup) et en outil (écarts plus profonds).

Hypothèse : la demande se termine sur une liste d'exemples interrompue ; l'inventaire ci-dessus, complété par l'explorateur, tient lieu de liste complète. Tout nouvel exemple s'ajoutera comme une impasse de plus.

### Hors du périmètre

- « Première vraie partie » : c'est une vraie partie contre un robot, sans étape à atteindre, donc sans impasse.
- Pas de correction automatique de l'erreur (l'annulation reste un geste du joueur, que le chapitre enseigne).
- Pas de modification des positions de départ des chapitres, sauf si l'explorateur montre qu'une impasse ne peut pas être détectée avant la fin du tour.
- Aucun changement des règles du jeu, des robots ni du jeu en ligne.

### Compatibilité

Aucun changement du format des sauvegardes (les chapitres ne sont jamais sauvegardés) ni du protocole en ligne.

## Capabilities

### New Capabilities

<!-- Aucune -->

### Modified Capabilities

- `tutorial` : nouvelles exigences sur la détection des impasses et le mode annulation (bulle, guidage, retour à l'étape, recommencer le chapitre), et sur la couverture des impasses de chaque chapitre.

## Impact

- `src/tutorial/` : `types.ts` (impasses déclarées par un chapitre), `TutorialRunner.ts` (étape d'impasse prioritaire), `guidance.ts` (fin du tour et actions principales refusées en mode annulation), `chapters.ts`, `speciesChapters.ts`, `scenario.ts` (prédicats d'impasse communs : énergie, médias, crédits, données, trace bleue), nouvel explorateur des écarts (`explore.ts`).
- `src/ui/components/TutorialOverlay.tsx` et `BoardUI.tsx` : bulle du mode annulation, bouton « Recommencer le chapitre ».
- `public/docs/tutoriel.md` : une section de texte par impasse.
- `test/TutorialChapters.test.ts`, `test/TutorialEngine.test.ts` : un test par impasse, test de l'explorateur à un coup sur tous les chapitres.
- `tools/tutorial/` : outil d'exploration profonde (`npm run tutorial:dead-ends`).
