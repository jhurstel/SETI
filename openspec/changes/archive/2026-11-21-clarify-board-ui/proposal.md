# Proposal

## Why

Les premiers joueurs invités sur https://my-seti.netlify.app ont buté sur trois points de l'interface : ils ne voient pas quelles actions principales sont possibles (seule une action possible clignote, une action impossible a le même aspect qu'une action en attente), ils ne comprennent pas les panneaux qu'un clic « épingle » (le clic qui devrait les refermer ne fait rien tant que la souris est dessus), et ils ne savent pas ce que rapporte la couverture d'un secteur sans ouvrir son infobulle. Ces retours arrivent à l'ouverture aux amis : c'est le moment de les corriger.

## What Changes

- **Actions principales impossibles grisées** : sur le plateau joueur, chaque action principale que le joueur ne peut pas faire maintenant (pas son tour, action principale déjà faite, ressources insuffisantes, pas de sonde au bon endroit, aucune carte jouable…) est grisée ; son infobulle du jeu dit pourquoi (comme aujourd'hui, mais avec la même raison que celle du refus par le moteur). L'hexagone de fin du tour est grisé de la même façon tant que le joueur ne peut pas finir son tour.
- **Disponibilité calculée par le moteur** : une seule opération du moteur dit, pour chaque action principale, si elle est possible et sinon pourquoi, en réutilisant les vérifications existantes (`canLaunchProbe`, `canOrbit`, `canLand`, `canScanSector`, `canAnalyzeData`, `canPlayCards`, `canResearchTech`, contrôles généraux de `ActionValidator`). L'interface ne recopie plus ces règles (aujourd'hui `PlayerActions.tsx` recalcule le coût du scan, l'analyse, le coût de recherche et le coût d'atterrissage avec Exploration III).
- **Flèche à la place de l'« épingle »** : le bandeau des panneaux repliables (objectifs, technologies, rangée de cartes, planètes, plateaux Alien, historique) porte une flèche qui montre l'état gardé ouvert ou replié ; un clic bascule cet état, et un clic qui replie referme le panneau tout de suite, même si la souris reste dessus. L'aperçu au survol d'un panneau replié est conservé.
- **Prochain gain de couverture des secteurs** : à côté du nom de chaque secteur du système solaire, le symbole de ce que rapportera la prochaine couverture au joueur majoritaire (récompense de première couverture tant que le secteur n'a jamais été couvert, puis récompense des couvertures suivantes : trace de vie rouge, PV ou les deux selon le secteur), avec les icônes du jeu.
- Mise à jour de `public/docs/documentation.md` (plateau joueur, panneaux, système solaire).

Hors du périmètre :
- Aucune règle du jeu ne change : les gains de couverture restent ceux des données du plateau (`Board.ts`), le bonus de présence (1 Média) n'est pas ajouté à côté du nom (il reste dans l'infobulle du secteur).
- Le secteur d'Oumuamua (sans récompense de couverture propre) n'affiche aucun symbole.
- Les robots gardent leur liste d'actions (`AIBehavior.listMainActions`) : pas de changement de comportement, pas de mesure.
- Les actions gratuites et les autres boutons ne sont pas concernés.
- Pas de changement des sauvegardes ni du protocole en ligne (aucune migration, pas de version mineure).

## Capabilities

### New Capabilities
- `board-display`: affichage des plateaux de jeu (hors faces de cartes) : état des actions principales, panneaux repliables, informations imprimées sur le système solaire.

### Modified Capabilities
- `game-rules`: ajout d'une exigence sur la disponibilité des actions principales, calculée par le moteur et cohérente avec ce que la session accepte.

## Impact

- Moteur : `src/engine/ActionValidator.ts` (disponibilité des actions principales), `src/systems/ProbeSystem.ts` (coût d'atterrissage courant), `src/systems/ScanSystem.ts` (prochaine récompense de couverture d'un secteur, réutilisée par `AIEvaluator`).
- Interface : `src/ui/player/PlayerActions.tsx`, `src/ui/player/PlayerTracks.tsx` (`TrackSlot`), `src/ui/PlayerBoardUI.css`, panneaux repliables (`PlanetBoardUI`, `TechnologyBoardUI`, `ObjectiveBoardUI`, `CardRowUI`, `AlienBoardUI`, `HistoryBoardUI`, `ui/styles.css`, nouveau hook partagé), `src/ui/components/SectorDetails.tsx`.
- Tests : Jest du moteur (`createTestGame`), tests de composants (`test/components/`), test e2e existant du tour humain à vérifier.
- Documentation : `public/docs/documentation.md`, `.claude/rules/ui.md` (hook des panneaux).
