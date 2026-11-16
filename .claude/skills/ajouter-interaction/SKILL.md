---
name: ajouter-interaction
description: Ajouter ou modifier une interaction à plusieurs étapes du moteur SETI (InteractionState, registre INTERACTIONS, InteractionChoices, CHOICE_HANDLERS, ROBOT_HANDLERS, clic dans l'UI). À utiliser quand une action ou une carte demande un nouveau choix au joueur ou une nouvelle résolution automatique.
---

# Ajouter une interaction

Rappels (détail dans `.claude/rules/engine.md`, section Interactions) : l'interaction en cours et la file sont dans la partie (`game.interaction`, `game.pendingInteractions`, gérées par `session/InteractionQueue.ts`) ; une interaction est `choice` (choix du joueur), `automatic` (résolue par `InteractionResolver`) ou `local` (mode de sélection de l'interface). Les robots passent par les mêmes opérations que le joueur.

Si l'interaction introduit une règle nouvelle (pas seulement un écran), proposer d'abord un changement OpenSpec (`/openspec-propose`) qui modifie `openspec/specs/game-rules`.

## Étapes

1. **Type** : ajouter la variante à l'union `InteractionState` (`src/core/model/interactions.ts`), avec `playerId` si elle peut viser un autre joueur que celui qui a la main.
2. **Registre** : entrée dans `INTERACTIONS` (même fichier) : libellé (`getInteractionLabel`), résolution (`choice` / `automatic` / `local`), genres de `Choice` acceptés (`acceptsChoice`), renoncement (`isSkippable`). Nouveau genre de choix : l'ajouter à `Choice` (`src/session/commands.ts`).
3. **Règle** :
   - `choice` : une fonction dans `src/engine/InteractionChoices.ts` qui prend la partie et le choix, rend `{ updatedGame, historyEntries, nextInteraction? }` sans modifier la partie reçue (commencer par `cloneGame` sauf si elle n'appelle que d'autres opérations du moteur). Une suite (cartes, placements, déplacements restants) se renvoie dans `nextInteraction`.
   - `automatic` : un cas dans `InteractionResolver.resolve` (`src/engine/InteractionResolver.ts`), seule implémentation, appelée par la session et par les robots.
   - Nom d'une carte cachée dans un message : `privateText(propriétaire, texte)`.
4. **Session** : entrée dans `CHOICE_HANDLERS` (`src/session/GameSession.ts`). Le compilateur réclame l'entrée pour toute interaction à choix. Vérifier la place dans la file si l'ordre compte (`InteractionQueue` : menus de gains, résolutions de secteur en dernier, carte de fin de manche après la rotation).
5. **Robots** : entrée dans `AIController.ROBOT_HANDLERS` (`src/ai/AIController.ts`, toutes sauf `local`) : simuler chaque option avec la fonction de l'étape 3 et garder la mieux évaluée (`AIEvaluator.evaluate`), ou comparer 4 tirages pour un choix aléatoire. Jamais d'information cachée lue.
6. **Interface** : le clic appelle `choose(...)` dans `src/ui/BoardUI.tsx` (aucune règle dans le handler) ; une fenêtre de choix passe par `ui/modals/ChoiceModal` (ou `PassModal` / `CardPickModal` pour des cartes de la main) ; une option indisponible dit pourquoi dans son infobulle. Pas de `style={{}}` fixe ni d'attribut `title`.
7. **Tests** (`test/`, avec `createTestGame()`) :
   - la fonction de `InteractionChoices` : résultat, partie reçue intacte, refus avec raison ;
   - le choix par la session (`GameSession.dispatch`) et par un robot (comme dans `test/InteractionChoices*.test.ts`, `test/AIInteractions.test.ts`) ;
   - `test/InteractionRegistry.test.ts` et `test/CardCatalog.test.ts` doivent passer.
8. **Documentation** : décrire l'interaction et sa fenêtre dans `public/docs/documentation.md` ; nouveau symbole → `SymbolGlossary.tsx` ; capture si nouvelle fenêtre (`SETI_DOC_SCREENSHOTS=1 npx playwright test docMenus`).
9. **Sauvegardes** : si l'état sauvegardé change de forme, incrémenter `SAVE_VERSION` et ajouter la migration (`src/core/GamePersistence.ts`, `MIGRATIONS`).
10. `npm run check` (ou l'agent `verificateur`).
