# Tasks

## 1. Disponibilité des actions principales (moteur)

- [x] 1.1 Extraire de `ActionValidator.validateAction` les contrôles généraux (partie terminée, tour, passe, action principale faite) dans une fonction partagée, sans changer les refus ; vérifier que `test/GameEngine.test.ts`, `test/GameSessionCommands.test.ts` et `test/GameSession.test.ts` passent inchangés
- [x] 1.2 Ajouter `ActionValidator.mainActionAvailability(game, playerId)` (8 actions, raison du moteur, orbite et atterrissage sur l'une des sondes) avec un test Jest `test/MainActionAvailability.test.ts` (`createTestGame`) : chaque raison générale, scan et analyse sans ressources, recherche sans Médias, orbite possible sur la 2e sonde seulement, aucune carte jouable, concordance avec `GameSession.dispatch` (action indiquée possible acceptée, impossible refusée avec la même raison), partie reçue intacte
- [x] 1.3 Ajouter `ProbeSystem.currentLandCost(game, playerId)` (coût de la planète de la sonde, sinon coût de base réduit par Exploration III) avec son test Jest (avec et sans Exploration III, avec orbiteur présent)

## 2. Actions grisées (interface)

- [x] 2.1 Brancher `PlayerActions.tsx` sur `mainActionAvailability` (`useMemo`) et `currentLandCost`, supprimer les règles recopiées (coûts du scan et de l'analyse, médias, sonde « première trouvée »), garder les blocages tutoriel et interaction en cours ; vérifier `npm run typecheck` et `npm run lint`
- [x] 2.2 Ajouter l'état `disabled` à `TrackSlot` (classe `unavailable`, grisé dans `PlayerBoardUI.css`, curseur d'aide, survol conservé pour l'infobulle) ; test de composant `test/components/PlayerActions.test.tsx` : action impossible avec `aria-disabled="true"` et classe `unavailable`, clic sans effet, infobulle avec la raison du moteur au survol, action possible cliquable ; fin du tour grisée avant l'action principale
- [x] 2.3 Mettre à jour `public/docs/documentation.md` (section du plateau joueur : actions grisées et raison au survol) et vérifier le rendu dans la fenêtre Documentation

## 3. Panneaux repliables à flèche

- [x] 3.1 Créer `ui/hooks/useFoldablePanel.ts` (gardé ouvert, repli immédiat sous la souris via `no-hover`, `forcedOpen`, clic ailleurs) et adapter `ui/styles.css` (`:hover:not(.no-hover)`, flèche dont le sens suit l'état gardé, plus de `::after` qui pivote au survol) ; test de composant sur `TechnologyBoardUI` : clic garde ouvert, second clic replie sous la souris (classe `no-hover`, pas `open`), rouverture après `mouseleave` puis `mouseenter`, panneau forcé ouvert pendant le choix d'une technologie
- [x] 3.2 Faire passer `ObjectiveBoardUI`, `CardRowUI`, `HistoryBoardUI` et `TechnologyBoardUI` par le hook ; vérifier dans le navigateur (`npm run dev`) chaque panneau : aperçu au survol, garder ouvert, repli immédiat
- [x] 3.3 Faire passer `PlanetBoardUI` (survol géré en JS, fenêtres des planètes) et `AlienBoardUI` (trace à placer, fenêtre épinglée) par le hook, supprimer `isPinned` ; test de composant du panneau Planètes (repli immédiat au clic sous la souris) et `test/components/Tutorial.test.tsx` vert
- [x] 3.4 Mettre à jour `public/docs/documentation.md` (panneaux : flèche, garder ouvert, repli au clic) et `.claude/rules/ui.md` (hook `useFoldablePanel` dans la liste des hooks et la convention des panneaux)

## 4. Prochain gain de couverture des secteurs

- [x] 4.1 Ajouter `ScanSystem.nextCoverBonus(sector)` et l'utiliser dans `coverSector` et `AIEvaluator` ; test Jest (`createTestGame`) : récompense de première couverture avant, récompense suivante après une couverture, Oumuamua vide, partie reçue intacte ; `npm run bench:ai -- 1 2` donne la même empreinte de résultats qu'avant
- [x] 4.2 Dessiner le symbole avant le nom de chaque secteur dans `SectorDetails.tsx` (position par une fonction pure `sectorNamePrefixAngles` de `ui/solarGeometry.ts`, icônes `LifeTraceIcon`/`VictoryPointsIcon`, rien pour une récompense vide) ; test de composant : symbole trace rouge sur un secteur neuf, PV après couverture, deux symboles pour Beta Pictoris ; capture des 8 secteurs (haut et bas) avec `tools/bench/midGameSave.ts` sans chevauchement du nom ni des pastilles
- [x] 4.3 Mettre à jour `public/docs/documentation.md` (système solaire : symbole du prochain gain à côté du nom des secteurs)

## 5. Vérification d'ensemble

- [x] 5.1 `npm run check` sans erreur (typecheck, lint, cycles, tests avec couverture du moteur, build)
- [x] 5.2 `npm run test:e2e` vert (tour humain, tutoriel, partie en ligne) et contrôle visuel d'une partie locale : actions grisées au tour d'un robot, panneaux, symboles des secteurs

## Workflow follow-up

- Archiver le changement (`/openspec-archive-change`) après relecture et accord de l'utilisateur, en vérifiant que CLAUDE.md, `.claude/rules/` et la documentation du jeu reflètent le code.
