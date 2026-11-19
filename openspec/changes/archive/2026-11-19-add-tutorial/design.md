# Design

## Context

Voir proposal.md (Why) pour la motivation et `specs/tutorial`, `specs/robots` pour les exigences.

Ce qui existe et sur quoi le tutoriel s'appuie :

- `GameFactory.createGame(names, humanIsFirstPlayer, seed)` crée une partie à graine fixe, et `tools/bench/midGameSave.ts` montre déjà comment amener une partie à une position donnée en enchaînant de vraies étapes (`GameSession.applyRobotStep`, `TurnManager.advanceSetup`).
- Toute modification passe par `GameSession.dispatch(game, playerId, command)` ; l'interface l'appelle via `run(command)` dans `BoardUI`.
- Les actions principales affichent déjà, dans leur infobulle, la raison qui les empêche (`PlayerActions`).
- `DocumentationModal` charge `public/docs/documentation.md`, rendu par `renderMarkdown`, dont les titres reçoivent un identifiant `slugify(titre)` ; `goTo(id)` sait y défiler.
- `useAutosave` écrit la partie sous la clé `seti_autosave` ; `playerName.ts` montre la lecture protégée du stockage du navigateur.
- Le niveau `PASS` des tests existe (`AIDifficulty = 'PASS' | 'EASY' | 'MEDIUM' | 'EXPERT'`), mais il joue des actions gratuites et garde ses cartes au hasard (`random()`), et son choix de carte de fin de manche passe par l'évaluation : il ne convient pas à un adversaire figé.
- `tools/check-cycles.mjs` code en dur les couches `core < systems < actions, engine < ai < session < ui`.

## Goals / Non-Goals

**Goals:**
- Un chapitre est une donnée (TS pur) testable sans navigateur : préparation, étapes, prédicats et une suite de commandes de solution qui le termine.
- Aucune règle du jeu dans le tutoriel : il lit la partie et envoie des commandes ordinaires ; le filtre des actions n'est pas une règle, c'est une restriction de l'interface.
- Les textes se relisent et se corrigent sans toucher au code.

**Non-Goals:**
- Pas d'éditeur de chapitres, pas de format de script générique au-delà de ce qu'il faut pour les 11 chapitres.
- Pas de reprise d'un chapitre après un rechargement (le chapitre est court, il recommence).
- Pas de mise en page pour les petits écrans.

## Decisions

### 1. Nouvelle couche `tutorial` entre `session` et `ui`

`src/tutorial/` (TS pur, sans React) importe `core`, `engine`, `session` ; `ui` l'importe. `tools/check-cycles.mjs` ajoute la couche (`session: ['tutorial', 'ui']`, `tutorial: ['ui']`), et `CLAUDE.md` et `.claude/rules/` décrivent la nouvelle chaîne.

*Alternative écartée* : tout mettre dans `ui/`. Les chapitres ne pourraient alors pas être testés par Jest sans React, et la préparation des positions (enchaînement de commandes) est de la logique de session, pas d'affichage. Le placer dans `session/` mélangerait un contenu pédagogique avec le point d'entrée des commandes.

### 2. Un chapitre est une donnée

```ts
interface TutorialChapter {
  id: string;                           // ex. 'sondes', aussi clé de la progression et du texte
  seed: number;
  players: TutorialSeat[];              // humain + adversaires passifs (ou Débutant au chapitre 11)
  adjust?: (game: Game, humanId: string) => Game;  // ajustements de scénario, sur une copie, après la mise en place
  prepare: TutorialCommand[];           // commandes jouées par le moteur avant que le joueur prenne la main
  steps: TutorialStep[];
  solution: TutorialCommand[];          // commandes qui terminent toutes les étapes (tests)
}
interface TutorialStep {
  id: string;                           // section du fichier de textes
  target?: string;                      // valeur de data-tutorial de l'élément mis en avant
  done?: (game: Game, playerId: string) => boolean;  // absent : étape d'explication (« Suivant »)
  allowedActions?: ActionType[];        // actions principales permises pendant l'étape
  docLink?: string;                     // identifiant d'un titre de documentation.md
}
```

La préparation passe par `GameSession.dispatch` (et `TurnManager.advanceSetup` pour la mise en place), comme `midGameSave.ts` : la position est recalculée par le moteur à chaque démarrage, donc toujours valide pour la version courante, sans fichier JSON à migrer.

**Ajustements de scénario** : avec 4 crédits et 3 énergies au départ, certaines positions (ordinateur presque plein, 6 Médias, traces de vie posées, manche 5) demanderaient des manches entières de commandes, fragiles et peu lisibles. Après la mise en place (réservations faites), le chapitre peut donc déclarer `adjust`, une fonction pure appliquée à une copie de la partie (`cloneGame`) : ressources, cartes données en main (comme `giveCard` des tests), données sur l'ordinateur, manche, traces de vie. Les ajustements passent par les helpers du moteur quand ils existent ; ils ne remplacent jamais une action que le joueur doit apprendre dans le chapitre, qui reste faite par une commande. Ils s'écrivent sur le modèle courant : un changement du modèle les casse à la compilation ou au test du chapitre, jamais en silence.

*Alternative écartée* : des sauvegardes JSON préparées dans `public/`. Chaque changement de `SAVE_VERSION` ou de carte les casserait, et on ne verrait pas comment elles ont été obtenues.

### 3. Fin d'étape par prédicat sur l'état

Une étape d'action se termine quand `done(game, playerId)` devient vrai après une commande. Le prédicat porte sur le résultat (« une sonde du joueur est en orbite de Mars »), pas sur la commande envoyée : il reste juste si l'interface change de façon d'envoyer la commande, ou si le joueur y arrive par un autre chemin (action gratuite, carte).

`TutorialRunner` (fonctions pures) calcule l'étape courante : l'étape d'explication avance sur « Suivant » ; après chaque nouvel état (commande ou annulation), l'étape courante devient la première étape d'action non satisfaite, sans revenir avant la dernière étape d'explication validée. L'annulation ramène donc naturellement à l'étape correspondante.

*Alternative écartée* : comparer la commande attendue (`{ type: 'ORBIT', planet: 'Mars' }`). Plus simple à écrire, mais fragile, et incapable de reconnaître un chemin équivalent.

### 4. Guidage souple par une liste d'actions permises

Pendant une étape, `allowedActions` liste les actions principales permises. `tutorial/` expose `tutorialBlockReason(chapter, step, action): string | null`. `PlayerActions` l'ajoute aux raisons existantes d'une action indisponible, et `BoardUI.run` refuse la commande avec la même raison (garde-fou si un autre chemin l'envoie). Les actions gratuites, l'annulation, les infobulles et la documentation ne sont jamais filtrées. Le moteur n'est pas touché : la commande refusée n'atteint pas `GameSession.dispatch`.

### 5. Adversaire passif : niveau `IDLE`

`AIDifficulty` reçoit `'IDLE'`. `AITurn.playStep` d'un joueur `IDLE` rend directement l'étape `PASS`, sans simulation ni `random()`. Il garde les 4 premières cartes de sa main dans l'ordre, et choisit la première carte de la pile de fin de manche. Ses choix ne dépendent donc ni des poids ni du générateur. Il est appliqué par `GameSession.applyRobotStep`, comme tout robot, et `useAITurn` le joue sans changement. `IDLE` est absent de `SetupFields` et du choix des niveaux en ligne ; `LEVEL_TEMPERATURE`, `LEVEL_LOOKAHEAD` et `LEVEL_ROLLOUTS` le reçoivent à 0.

Dans la préparation, l'adversaire passe dès son premier tour quand le chapitre le permet. Le joueur joue ensuite seul jusqu'à la fin de la manche, et la rotation du système due au premier passage fait partie de la position préparée.

*Alternative écartée* : réutiliser `PASS`. Ses actions gratuites et son choix des cartes au hasard modifieraient le plateau, et son choix de fin de manche dépend de l'évaluation. Le changer casserait les tests qui s'appuient sur lui.

**Mesure des robots** : `IDLE` ne change ni l'évaluation ni les niveaux existants. `npm run bench:ai` doit garder la même empreinte des parties à graines fixes, et aucune mesure `tune:ai` n'est nécessaire.

### 6. Textes dans `public/docs/tutoriel.md`

Format :

```md
# sondes                       <- identifiant du chapitre
Titre affiché : Sondes

## lancer {#lancer}            <- identifiant de l'étape
Texte Markdown de l'étape…
```

`tutorial/tutorialText.ts` (pur) découpe le fichier en chapitres et étapes ; l'interface rend chaque texte avec `renderMarkdown`. Un test Jest vérifie que chaque étape déclarée a sa section, et que chaque section correspond à une étape.

### 7. Liens vers la documentation

`docLink` est l'identifiant (`slugify` du titre) d'une section de `documentation.md`. `DocumentationModal` reçoit une prop `section?: string` et appelle `goTo(section)` une fois le texte rendu. Un test Jest lit `documentation.md`, calcule les identifiants avec `slugify` (même fonction que le rendu) et vérifie chaque `docLink`.

### 8. Accès, premier lancement et progression

- `ui/tutorialProgress.ts` lit et écrit, sous lecture protégée (try/catch, comme `playerName.ts`), `seti_tutorial` = `{ done: string[], dismissed: boolean }`.
- Au lancement, l'accueil (`SettingsModal`) propose le tutoriel si `seti_autosave` est absent et si `seti_tutorial` n'existe pas. « Plus tard » enregistre `dismissed`.
- L'accueil a un bouton « Tutoriel » qui ouvre le menu des chapitres (`TutorialMenu`), avec les chapitres terminés cochés.

### 9. Mode tutoriel dans l'interface

`BoardUI` reçoit un état `tutorial: { chapterId, stepIndex } | null`. Pendant un chapitre à position préparée :
- `useAutosave` est désactivé (aucune écriture de `seti_autosave`) ;
- au rechargement de la page, rien du chapitre n'est conservé : l'accueil s'ouvre ;
- `TutorialOverlay` affiche la bulle près de l'élément `[data-tutorial="<target>"]` (position calculée par `getBoundingClientRect`, recalculée au redimensionnement) et l'entoure d'une surbrillance. Les boutons « Suivant », « En savoir plus » et « Quitter » y figurent.

Les composants ciblés reçoivent des attributs `data-tutorial` stables (système solaire, plateau du joueur, ressources, actions, ordinateur, rangée de cartes, technologies, objectifs, espèces, historique…).

### 10. Chapitre 11 : partie normale avec aide au contexte

« Première vraie partie » crée une partie normale (humain contre un robot Débutant, graine aléatoire), sauvegardée comme toute partie. Un réglage `contextHelp` (stocké avec la progression, activé par le chapitre et désactivable dans les paramètres) active des déclencheurs purs dans `tutorial/contextHints.ts` : `(game, playerId) => boolean`, par exemple « une analyse est possible pour la première fois ». Chaque aide affichée est notée dans `seti_tutorial.hintsShown` et ne revient plus.

### 11. Recherche des graines

Les chapitres 8 (espèce) et 10 (fin de partie) demandent une position qui dépend de l'espèce tirée et de la manche. Un outil de développement `tools/tutorial/findSeed.ts` essaie des graines jusqu'à trouver une préparation valide (espèce voulue, commandes applicables). La graine trouvée est écrite en dur dans le chapitre ; le test Jest de la solution détecte une graine devenue invalide après un changement de cartes ou de règles.

## Risks / Trade-offs

- [Un changement de règle ou de carte rend une préparation ou une solution invalide] → test Jest par chapitre (préparation sans erreur, premier prédicat faux, solution qui termine toutes les étapes) ; outil `findSeed` pour retrouver une graine.
- [Un attribut `data-tutorial` disparaît lors d'une refonte de l'interface] → test Playwright qui déroule chaque chapitre par sa solution et vérifie la présence de chaque cible ; un test Jest liste les cibles déclarées pour faciliter la recherche.
- [Le texte décrit un comportement que le jeu ne montre plus] → les textes renvoient vers `documentation.md` pour le détail au lieu de le recopier, et la règle `docs.md` demande de relire `tutoriel.md` quand une règle change.
- [La bulle masque l'élément qu'elle décrit sur un écran étroit] → placement automatique du côté qui a le plus de place ; écrans d'ordinateur uniquement (hors périmètre sinon).
- [Le filtre des actions bloque une situation imprévue (aucune action permise possible)] → le test de solution le détecterait ; « Quitter » reste toujours disponible.
- [Ajouter `IDLE` à `AIDifficulty` touche les tables par niveau] → le compilateur exige chaque table (`Record<AIDifficulty, …>`) ; aucune sauvegarde existante ne contient `IDLE`, donc pas de migration.

## Migration Plan

Pas de migration : `seti_autosave` n'est jamais écrit pendant un chapitre à position préparée, `IDLE` n'apparaît dans aucune sauvegarde existante, et le protocole en ligne n'est pas modifié. Déploiement par une version ordinaire (`GAME_VERSION`). Retour arrière : retirer le bouton et la proposition au premier lancement suffit à masquer le tutoriel.

## Open Questions

- Libellés exacts des boutons de la proposition au premier lancement (« Commencer le tutoriel » / « Plus tard ») : à fixer lors de l'implémentation de l'accueil.
- Liste précise des aides au contexte du chapitre 11 au-delà des premières (analyse possible, ordinateur plein, palier proche, première espèce découverte) : peut s'enrichir sans changer l'approche.
