# Design

## Context

- Le déroulement d'un chapitre est sans état caché (`TutorialRunner`) : l'étape courante est la première étape non passée, une étape d'action est passée quand son prédicat `done` est vrai. Une annulation ramène donc naturellement à la bonne étape.
- Les impasses sont aujourd'hui des étapes de secours `onlyIf` (identifiant `annuler`, cible `history`) placées à une position fixe de la liste : Sondes (`marsOutOfReach`), Traces de vie et espèces (`blueTraceElsewhere`), Mascamites (`earthOutOfReach`), Oumuamua (`wrongScanCard`), Exertiens (`exertienRefused`). Une impasse créée *avant* la position de son étape n'est pas vue : le joueur reste sur une étape antérieure qu'il ne peut plus finir.
- Une étape sans `allowedActions` refuse déjà les actions principales et la fin du tour (`tutorialBlockReason`) ; c'est ce qui garde l'erreur annulable.
- L'annulation : `SessionJournal.prune` ne garde les états précédents que depuis le début de l'avant-dernier tour du joueur ; « annuler » (`undoLast`) et « annuler le tour » (`undoTurn`). Une erreur faite deux tours plus tôt n'est plus annulable.
- `checkSolution` (`solve.ts`) rejoue la solution d'un chapitre ; `answerInteraction` (`scenario.ts`) ne donne que le premier choix possible. Aucun énumérateur des coups légaux n'existe dans le moteur (les robots choisissent dans leurs propres handlers).

Couches : tout ce changement vit dans `tutorial/` (TS pur, au-dessus de `session`) et `ui/` ; rien dans `core/`, `systems/`, `engine/`, `ai/` ni `session/`.

## Goals / Non-Goals

**Goals :**
- Une impasse est détectée à l'instant où l'action fautive est jouée, quelle que soit l'étape en cours, tant que l'erreur est encore dans le tour.
- Les impasses d'un chapitre sont une déclaration lisible (condition + texte), pas une position dans la liste des étapes.
- Une vérification automatique dit, pour chaque chapitre, quel écart crée une impasse non déclarée.

**Non-Goals :**
- Prouver qu'un chapitre est terminable depuis n'importe quel état (recherche complète) : l'explorateur vérifie des écarts bornés.
- Changer les règles de l'annulation dans les vraies parties.

## Decisions

### 1. Impasses déclarées par le chapitre, prioritaires sur les étapes

`TutorialChapter.deadEnds?: TutorialDeadEnd[]`, avec `TutorialDeadEnd = { id: string; when: (context) => boolean; target?: string; docLink?: string }`. `TutorialRunner.currentStep` (et `displayIndex`) renvoie la première impasse vraie, sous la forme d'une étape d'impasse (`{ id, target: target ?? 'history', deadEnd: true }`), **avant** de chercher la première étape non passée. `currentIndex` reste celui des étapes (progression), l'étape d'impasse s'y superpose.

- Pendant un choix en cours (`game.interaction`), l'impasse n'est évaluée qu'une fois le choix résolu, sauf si le choix lui-même ne peut plus mener nulle part : la bulle ne doit pas recouvrir une fenêtre de choix au milieu d'une action (cohérent avec `displayIndex`). Les prédicats existants qui tiennent compte de l'interaction (`wrongScanCard`, `exertienRefused`) restent tels quels.
- Les cinq étapes `annuler` existantes deviennent des impasses ; leurs textes restent dans la section du chapitre de `tutoriel.md`, renommés par cause (`annuler-energie`, `annuler-trace-bleue`, `annuler-scan`, `annuler-capsule`, `annuler-refus`…). Le champ `onlyIf` disparaît s'il n'a plus d'usage (sinon il reste pour les étapes de secours qui ne sont pas des impasses).
- Alternative écartée : garder des étapes `onlyIf` et les dupliquer à chaque position possible. Fragile, et c'est précisément ce qui laisse passer les impasses créées tôt.

### 2. Guidage en mode annulation

`tutorialBlockReason` reçoit l'étape d'impasse : toute action principale et la fin du tour sont refusées avec `TUTORIAL_UNDO_REASON` (« Tutoriel : annulez l'erreur signalée dans la bulle »). Les actions gratuites restent permises (comme aujourd'hui pendant toute étape) : elles ne font pas sortir du tour, donc ne rendent pas l'erreur inannulable ; l'explorateur vérifie qu'aucune ne transforme une impasse annulable en impasse définitive. `tutorialFinishedReason` ne change pas.

### 3. Recommencer le chapitre

La bulle d'une étape d'impasse a deux boutons : l'annulation reste le geste enseigné (la flèche ↩ de l'historique, ouvert automatiquement), et « Recommencer le chapitre » rejoue la préparation (`prepareChapter`, même chemin que le démarrage depuis le menu) avec un `TutorialState` neuf. Quand `SessionJournal.undoLast` rend null (rien d'annulable), le texte de la bulle le dit et « Recommencer » est le bouton principal. Côté interface seulement (`TutorialOverlay`, handler de `BoardUI` déjà utilisé pour démarrer un chapitre) ; aucune règle dans l'UI.

### 4. Prédicats d'impasse communs dans `scenario.ts`

Les impasses se décrivent avec des prédicats réutilisables, purs :
- `cannotReachOrbit` / `cannotReachWithCapsule` (existants), plus `cannotReachToLand(planet)` (chemin + coût d'atterrissage, réduit par l'orbiteur) et `cannotReachPlanet(planet, extra)` générique ;
- `blueTraceElsewhere(boardIndex)` (déplacé de `chapters.ts`), ajouté aux étapes communes de découverte (`discoverySteps` devient `discovery()` qui rend étapes **et** impasses) ;
- `lacks(resource, amount)` : ressource du joueur sous le besoin restant ; le besoin dépend de l'avancement (ex. Technologies : 6 médias tant que la technologie n'est pas prise) ;
- `cardGone(cardId)` : carte du chapitre absente de la main et non jouée (défaussée, réservée) ;
- (abandonné à l'implémentation) `mainActionWasted` : sans compteur de tours dans la partie, « l'action principale du tour a servi à autre chose » ne se lit pas sur l'état. À la place, une étape qui fait jouer une carte déclare `allowedCards` : le guidage refuse toute autre carte (`TUTORIAL_CARD_REASON`), l'erreur n'arrive plus.
- `resourceDeadEnds({ ressource: besoin })` : une impasse par ressource (`annuler-credits`, `annuler-energie`, `annuler-medias`, `annuler-donnees`), besoin calculé sur l'avancement sans les gains à venir. Les échanges (2 crédits, 2 énergies ou 2 cartes contre 1) permettent de vider une ressource dans presque tous les chapitres.

Catalogue retenu (inventaire fait sur le code des chapitres) :

| Chapitre | Impasse | Condition |
|---|---|---|
| Sondes | énergie (existante) | `cannotReachOrbit('mars')` |
| Atterrir | sonde éloignée de Mars | `cannotReachToLand('mars')` tant qu'aucun atterrisseur |
| Cartes | carte perdue | `cardGone` pour ISS, Lovell, MSL tant que leur étape n'est pas passée |
| Cartes | médias de Lovell | médias < 8 avant de jouer Lovell (ISS jouée) |
| Cartes | crédits | crédits < somme des coûts des cartes restantes |
| Cartes, Mascamites | mauvaise carte | refusée par `allowedCards` (pas d'impasse) |
| Technologies, Anomalies | médias de la recherche | médias < 6 tant que la recherche n'est pas faite |
| Traces de vie et 5 espèces | trace bleue ailleurs | `blueTraceElsewhere(0)` tant que l'espèce n'est pas découverte |
| Mascamites | sonde ou crédits | sonde hors de portée de Jupiter avant Premier Contact ; crédits < coût de Premier Contact ; capsule (existante) |
| Oumuamua | scan | mauvaise carte ou secteur (existante) ; énergie ou crédits < coût du scan |
| Centauriens | trace rouge | trace rouge de la piste ailleurs que sur l'emplacement à 15 PV ; données < 3 avant de la poser |
| Exertiens | refus (existante) | `exertienRefused` |

Ajouts révélés par l'explorateur (décision 5) : crédits du lancement (Écran, Sondes), énergie avant le lancement (Sondes), énergie du scan (Scanner ; ses crédits ne descendent pas sous 1), énergie de l'analyse (chapitres d'espèce), Premier Contact jouée sans prélever (Mascamites, `annuler-prelevement`), recherche lancée sans technologie (Anomalies, `annuler-recherche`), Premier Contact défaussée (`annuler-carte`). L'étape « acheter » d'Atterrir attend désormais une nouvelle carte en main (la taille de la main ne suffit pas si le joueur a défaussé ou échangé des cartes). Ordinateur, Traces de vie et espèces (hors trace bleue), Passer et fin de manche, Paliers et fin de partie : aucune impasse à profondeur 2.

### 5. Explorateur des écarts (`tutorial/explore.ts`)

Fonction pure `exploreDeadEnds(chapter, prepared, { depth })` qui rend la liste des écarts fautifs `{ stepId, deviation: Command[], reason }` :
1. Rejoue la solution ; avant chaque commande de la solution (donc à chaque étape d'action), énumère les écarts du joueur : actions gratuites (`BUY_CARD`, `DISCARD_FOR_FREE_ACTION` de chaque carte, `TRANSFER_DATA` vers chaque case, `MOVE_PROBE` vers chaque case voisine), commandes principales permises par l'étape avec chaque carte ou cible, puis **chaque** réponse aux choix ouverts (nouvel `interactionAnswers(game, humanId)` dans `scenario.ts`, qui généralise `answerInteraction` : toutes les cartes, secteurs, emplacements de trace, cases d'ordinateur, technologies…). Les commandes refusées par le guidage ou par le moteur sont ignorées.
2. Après l'écart (profondeur 1 dans les tests, `depth` dans l'outil, écarts enchaînés) : si une impasse du chapitre est vraie → correct. Sinon, le chapitre doit encore être terminable : on rejoue la suite de la solution (commandes recalculées sur la partie, choix par défaut puis `answer` du chapitre), et si elle échoue, une courte recherche de rattrapage (les écarts inverses : déplacement retour, etc., bornée à 2 coups) avant de déclarer l'écart fautif.
3. Une liste d'exceptions par chapitre (`explorerAllows`, avec une raison) absorbe les faux positifs connus, pour garder le test exigeant sans rendre l'explorateur parfait. Aucun chapitre n'en a besoin à ce jour : la reprise saute les commandes de la solution devenues inutiles et essaie jusqu'à 3 déplacements de rattrapage.

- Test Jest : profondeur 1, tous les chapitres préparés, aucun écart fautif. Si la durée dépasse ~20 s, l'énumération des déplacements est limitée aux cases voisines de la sonde, et les cartes défaussées aux cartes distinctes par effet de coin.
- Outil : `tools/tutorial/deadEnds.ts` (`npm run tutorial:dead-ends -- [chapitre] [profondeur]`, bundle esbuild comme `tutorial:seed`), pour les écarts de profondeur 2 ou 3 (énergie dépensée en plusieurs déplacements).
- Alternative écartée : un solveur complet (recherche exhaustive jusqu'à la fin du chapitre) : coûteux, et inutile pour des chapitres de quelques commandes.

### 6. Textes

Une section `## … {#annuler-<cause>}` par impasse dans la section du chapitre de `public/docs/tutoriel.md` ; le test existant « chaque étape a son texte » couvre aussi les impasses. Chaque texte nomme la cause, ce qui a été perdu, et rappelle la flèche ↩ et « Recommencer le chapitre ».

## Risks / Trade-offs

- [Une impasse se déclenche à tort et bloque un joueur qui avait une autre voie] → chaque impasse a un test positif (l'écart la déclenche) et l'explorateur vérifie que la solution, jouée normalement, ne la déclenche jamais (`checkSolution` signale toute étape d'impasse rencontrée).
- [Impasse détectée seulement au tour suivant, hors d'atteinte de l'annulation] → les conditions portent sur l'état créé par l'erreur (ressource, carte, trace), pas sur l'étape qui échoue ; l'explorateur vérifie que l'impasse est vraie juste après l'écart. Le bouton « Recommencer » couvre le reste.
- [Durée des tests] → profondeur 1 dans Jest, profondeur plus grande dans l'outil seulement.
- [Bulle d'impasse qui masque une fenêtre de choix] → évaluation différée tant qu'un choix est en cours (décision 1).

## Migration Plan

Aucune sauvegarde ni protocole touché. La progression du tutoriel (chapitres terminés) n'est pas modifiée : les identifiants de chapitres ne changent pas.
