# Tasks

> Décisions de l'utilisateur (`proposal.md`) : solo selon le réglage « Annulation stricte », barrière limitée à la commande révélatrice et à celles d'avant, ↩ qui referme seulement l'achat ouvert.

## 1. Détection des révélations (session)

- [x] 1.1 Créer `src/session/Revelation.ts` : connaissance d'un joueur tirée de `viewFor` (cartes visibles, spécimens visibles, espèces nommées) et `revealedTo(before, after, playerIds, { ignoreRng? })` (nouvel élément connu ou `rngState` changé)
- [x] 1.2 Tests `test/Revelation.test.ts` avec `createTestGame` : un cas par zone (pioche vers la main, rangée remplacée, pile de fin de manche ouverte, spécimen regardé, espèce découverte, état du hasard), cas sans révélation (lancer une sonde, échange d'énergie, carte de la main jouée), parties reçues non modifiées

## 2. Barrière et dernière commande en ligne (session)

- [x] 2.1 `GameRoom.recordUndoPoint` : en cas de révélation, vider la pile et retenir la raison ; points avec les séquences des entrées et de l'interaction ouverte
- [x] 2.2 `GameRoom.undo('last')` : partir du dernier point et remonter par séquences partagées, sans lire l'historique
- [x] 2.3 `undoFor` renvoie `reason` ; `UndoAvailability.reason?` dans `protocol.ts` (et `RemoteClient` s'il recopie l'objet)
- [x] 2.4 Dans `test/UndoAudit.test.ts`, retirer `.failing` des tests en ligne (pioche, rangée, passe, achat ouvert) ; ajouter dans `test/OnlineUndo.test.ts` « annulable après une révélation » (échange d'énergie après une pioche) et « raison renvoyée dans la vue »

## 3. Dernière commande en jeu local (session, core)

- [x] 3.1 `SessionJournal.append(log, entries, before, after, humanIds)` : entrée technique `silent` pour une commande sans entrée ; mettre à jour les appelants (`useGameSession`, tutoriel `prepare`, tests)
- [x] 3.2 `undoLast` et `findTurnUndoPoint` prennent en compte les entrées techniques ; `SessionJournal.canUndoLast(log, game)`, qui répond non pendant qu'un robot doit jouer
- [x] 3.3 `HistoryEntry.silent` et `GameLogEntry.silent` (core/model) ; `serializeGame` et `deserializeGame` les gardent ; `historyTimeline` et `viewEntries` les ignorent
- [x] 3.4 Tests : `.failing` retiré de « après l'ouverture d'un achat » (solo) ; la preuve « pendant le tour du robot » devient un test de `canUndoLast` ; `test/SessionJournal.test.ts` (entrée technique) ; `test/GamePersistence.test.ts` (entrée technique gardée, ancienne sauvegarde relue) ; parties reçues non modifiées

## 4. Annulation stricte en jeu local (core, session)

- [x] 4.1 `game.strictUndo?` (core/model) posé par `GameSetup.newGame` (option), absent dans le tutoriel ; gardé par `serializeGame`
- [x] 4.2 `SessionJournal.append` : avec `strictUndo`, marquer `barrier` sur la première entrée d'une commande révélatrice (étapes de robot : `ignoreRng`) ; `undoLast`, `findTurnUndoPoint` et `canUndoLast` ne franchissent pas une barrière ; `undoBlockedReason(log)`
- [x] 4.3 Tests : sans réglage, la passe et la pioche s'annulent (preuves actuelles de `UndoAudit` gardées) ; avec réglage, pioche refusée, retour au début du tour bloqué par une carte de la rangée montrée par un robot, et encore possible après un tour de robot sans révélation ; sauvegarde (`barrier`, `strictUndo`) relue ; ancienne sauvegarde sans réglage

## 5. Interface (ui)

- [x] 5.1 `useUndo` : `canUndoLast` et la raison du refus lus dans la session (local) ou dans `undo` (en ligne) ; exposer `undoBlockedReason`
- [x] 5.2 `HistoryBoardUI` : entrées techniques non affichées ; ↩ grisé avec l'infobulle de la raison quand une barrière bloque
- [x] 5.3 `NewGameModal` : case « Annulation stricte » (désactivée par défaut, courte explication), transmise à `GameSetup.newGame` ; test de composant
- [x] 5.4 Test de composant de l'historique (entrée technique masquée, ↩ grisé avec sa raison) ; vérifier que l'e2e « annulation et rechargement » et « partie en ligne à deux » passent toujours

## 6. Documentation et vérification

- [x] 6.1 `public/docs/documentation.md` : Historique (dernière commande, pas pendant le tour d'un robot, réglage « Annulation stricte »), Nouvelle partie (le réglage), Annuler en ligne (barrière d'information), R3 (la passe ne s'annule plus en ligne ou en annulation stricte)
- [x] 6.2 `public/docs/tutoriel.md` : remplacer « tant que le tour suivant n'est pas joué » par la limite réelle
- [x] 6.3 `.claude/rules/online.md` (annulation en ligne, barrière) et `.claude/rules/engine.md` (Historique : entrées techniques, barrière, `strictUndo`)
- [x] 6.4 `npm run check` (agent `verificateur`), puis `npm run test:e2e`

## Workflow follow-up

- Archiver le changement (`/openspec-archive-change`) une fois le code publié : la capacité `undo` est créée dans `openspec/specs/`.
