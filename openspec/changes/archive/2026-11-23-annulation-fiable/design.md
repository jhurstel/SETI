# Design

## Context

Il existe deux mécanismes d'annulation, écrits séparément (constat : `proposal.md`).

- **Jeu local** : `SessionJournal` (session) garde l'état d'avant chaque commande sur la **première entrée d'historique** qu'elle produit (`previousState`). Une commande sans entrée (`BUY_CARD`, `SKIP`) n'a donc pas de point d'annulation. `undoLast` lit la séquence de la dernière entrée ; `findTurnUndoPoint` (core) cherche le dernier séparateur « --- Tour de » du joueur. `useUndo` (ui) décide lui-même si ↩ est proposé, en relisant le journal.
- **En ligne** : `GameRoom` (session) tient une pile de points d'annulation en mémoire, un par commande, effacée par un autre joueur, un robot ou la fin du tour. `undo('last')` lit lui aussi la séquence sur la **dernière entrée de l'historique**, pas sur la dernière commande : d'où l'écart n° 4. Aucune vérification ne porte sur ce que la commande a montré.
- `viewFor` (session, `PlayerView.ts`) sait déjà ce que chaque joueur a le droit de voir : pioche, piles de fin de manche, mains et cartes Exertiens adverses, spécimens (`canSeeSpecimens`), espèces non découvertes, graine et état du hasard.
- Pendant un tour, seule la découverte d'une espèce tire au hasard, et elle se résout à la fin du tour (`TurnManager`) ; les robots tirent dans leurs propres étapes.

## Goals / Non-Goals

**Goals:**
- Une seule règle pour la dernière action : la dernière **commande** et sa séquence, en solo comme en ligne.
- Une barrière d'information en ligne, détectée de façon générale, sans liste de commandes à tenir à jour.
- La décision « ↩ est-il proposé ? » quitte l'interface pour la session (règle de `CLAUDE.md` : pas de règle dans l'UI).

**Non-Goals:**
- Fusionner `SessionJournal` et les points d'annulation de `GameRoom` en une seule structure : le format des sauvegardes locales (états sur les entrées) reste tel quel.
- Changer les robots : ils n'annulent jamais. Pas de mesure `tune:ai` à prévoir, l'empreinte de `bench:ai` doit rester la même.

## Decisions

### 1. Détection des révélations : comparer les vues (session)

Un nouveau module pur `session/Revelation.ts`, à côté de `PlayerView`, fournit `revealedTo(before, after, playerIds)`. Pour chaque joueur humain, il calcule ce que sa vue (`viewFor`) laisse connaître : identifiants des cartes visibles (main, rangée, piles de fin de manche, cartes d'espèce et Alien, cartes jouées des adversaires), spécimens visibles (planète, rang, contenu), espèces nommées. Il y a révélation si un élément connu après ne l'était pas avant, ou si `rngState` a changé. Une carte que l'auteur de la commande tenait déjà (main, réserve, cartes jouées) et qu'il montre aux autres (défausse pour une action gratuite) n'est pas une révélation : ce n'est pas lui qui apprend quelque chose, et compter ce cas rendrait toute défausse non annulable.
- *Pourquoi* : une nouvelle carte ou une nouvelle espèce qui révèle quelque chose est couverte sans y penser, et la règle suit exactement ce que le serveur montre.
- *Alternative écartée* : marquer chaque opération révélatrice dans le moteur (`revealsHiddenInfo` sur les résultats de `CardSystem`, `SpeciesSystem`…). C'est plus rapide, mais un oubli recrée la fuite et on toucherait des dizaines de chemins des `systems`.
- *Coût* : deux `viewFor` par joueur humain et par commande (une copie de la partie chacun), en ligne et en annulation stricte, jamais pour les robots du serveur ni en jeu local libre. Pas de cache de la connaissance d'une commande à l'autre : il ne se justifierait qu'après une mesure (suite `GameServer`).

### 2. Barrière dans `GameRoom` (session)

`recordUndoPoint` appelle `revealedTo`. En cas de révélation, il vide la pile (ni ce point ni les précédents) et retient une raison (`blockedReason`). Les commandes suivantes empilent de nouveau des points. `undoFor` renvoie `{ last, turn, reason? }` ; `reason` est présent quand la pile est vide à cause d'une barrière de ce tour.
- *Alternative écartée* : bloquer toute annulation jusqu'à la fin du tour (question ouverte n° 2). C'est plus simple, mais cela pénalise un échange d'énergie joué après une pioche.

### 3. Dernière action fondée sur la commande (session)

- **En ligne** : chaque point retient ses séquences : celles de ses entrées, plus celle de l'interaction laissée ouverte (`after.interaction?.sequenceId`). `undo('last')` part du **dernier point** et remonte tant que le point précédent partage une séquence ; l'historique n'est plus lu.
- **Jeu local** : `SessionJournal.append` reçoit la partie d'après. Une commande sans entrée ajoute une entrée technique `{ message: '', silent: true, playerId, sequenceId: séquence de l'interaction ouverte, previousState }`. `undoLast` et `findTurnUndoPoint` la traitent comme une commande ; l'historique affiché (`HistoryList`), la frise (`historyTimeline`) et `viewEntries` l'ignorent.
- *Alternative écartée* : faire écrire une ligne d'historique à `BUY_CARD` (« ouvre un achat »). Cela ajoute du bruit à l'historique et ne règle pas `SKIP` ni les commandes à venir.
- **Sauvegarde** (core) : `serializeGame` garde `silent` (champ facultatif de `GameLogEntry`). Une ancienne sauvegarde n'en a pas, d'où pas de migration ni de `SAVE_VERSION` à changer.

### 4. « ↩ proposé ? » dans la session

`SessionJournal.canUndoLast(log, game)` (local) remplace le calcul de `useUndo`. Il répond non quand un robot doit jouer (`GameSession.robotCanPlay`) ou quand la dernière entrée est un séparateur. En ligne, `useUndo` lit `undo.last` et `undo.reason` du serveur.

### 5. Interface (ui)

`useUndo` expose `undoBlockedReason`. `HistoryBoardUI` affiche alors ↩ grisé, avec l'infobulle « Action non annulable : une information cachée a été révélée ». Le style existe déjà pour les actions grisées (`board-display`).

### 6. Annulation stricte en jeu local (core, session, ui)

- **Réglage** : `game.strictUndo?: boolean` (core/model), posé par `GameSetup.newGame` d'après la fenêtre Nouvelle partie (ui) ; absent = désactivé, pour les anciennes sauvegardes et le tutoriel (`tutorial/prepare`). Pas de bouton en cours de partie : le réglage ne se change pas en cours de route.
  - *Alternative écartée* : une préférence de l'interface (`localStorage`), qu'on pourrait couper le temps d'annuler une pioche.
- **Barrière du journal** : avec `strictUndo`, `SessionJournal.append` appelle `revealedTo(before, after, [humain])`. Pour une étape de robot, il ignore le critère du hasard (`{ ignoreRng: true }`). En cas de révélation, il marque la première entrée de la commande `barrier: true`. `undoLast`, `findTurnUndoPoint` et `canUndoLast` ne restaurent jamais un état antérieur ou égal à une barrière. La raison est rendue par `SessionJournal.undoBlockedReason(log)`.
- **Sauvegarde** : `barrier` et `strictUndo` sont des champs facultatifs gardés par `serializeGame`, sans migration. `SAVED_UNDO_STATES` ne garde pas d'état d'avant une barrière (inutile).
- **Une seule règle** : `GameRoom` et `SessionJournal` appellent le même `revealedTo`. En ligne, le critère du hasard reste actif : une étape de robot vide déjà toute la pile d'annulation.

### 7. Protocole (session)

`UndoAvailability.reason?: string` est un champ facultatif d'un message serveur → client. Un client de la même version mineure qui ne le lit pas garde le comportement d'aujourd'hui (bouton masqué). Pas de changement de version mineure.

## Risks / Trade-offs

- [Faux positif : la vue change sans vraie révélation, par exemple une carte qui passe de la main à la rangée] → On ne compte que les éléments **nouvellement connus**, jamais ceux qui changent de place ; un test par zone (main, rangée, pile de fin de manche, spécimen, espèce, hasard) et un test « lancer une sonde reste annulable ».
- [Faux négatif : une information cachée hors de `viewFor`] → La barrière ne vaut que ce que vaut `viewFor`. Toute information cachée doit déjà y être masquée, sinon elle fuit de toute façon par la vue. Le test des révélations parcourt les zones masquées par `viewFor`.
- [Performance du serveur] → Une copie de la partie par humain et par commande, sans effet sur les robots ; à mesurer sur `test/GameServer.test.ts` (temps de la suite).
- [Annulation stricte désactivée par défaut] → La « triche » par connaissance reste possible en solo tant que le joueur ne choisit pas le réglage. C'est voulu (bac à sable) et dit dans la fenêtre Nouvelle partie et la documentation.
- [Robots et hasard en mode strict] → Une étape de robot change presque toujours `rngState`. Ne compter que la vue du joueur pour les étapes de robot, sinon chaque tour de robot deviendrait une barrière et le retour au début du tour disparaîtrait.
- [Entrées techniques dans le journal local] → Un affichage qui oublierait de les filtrer montrerait une ligne vide ; elles sont filtrées en un seul endroit (`HistoryList`), et un test de composant le vérifie.

## Migration Plan

Pas de migration des sauvegardes. Déploiement habituel : Netlify (interface) et Render (serveur) avec la même version. Les salles en cours au moment du redéploiement perdent de toute façon leurs points d'annulation, qui ne sont qu'en mémoire.
