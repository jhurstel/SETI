# Proposal

## Why

Sur un écran d'ordinateur courant, les missions du plateau joueur sont hors de vue : il faut faire défiler le plateau pour les voir, alors qu'on les surveille à chaque tour. Mesure sur une partie de milieu de jeu (`tools/bench/midGameSave.ts`, manche 3) : le contenu du plateau fait 1083 px pour 845 px visibles à 1600×900, et 1080 px pour 713 px à 1366×768 ; les missions commencent 24 px (1600×900) et 153 px (1366×768) sous le bas du plateau. Retours de l'utilisateur : « Regroupe Exploration et Observation sur la même ligne, en compactant un peu les technologies. Informatique reste pareil. » puis « Et si on réduit la taille des cartes ? De toute manière on a le tooltip. Et on peut aussi imaginer un bouton qui affiche la main en grand dans une fenêtre type pop-up. »

Regrouper Exploration et Observation et réduire les cartes (variante D des maquettes, design.md) montre tout le plateau sans défilement à 1600×900. La variante E (main et missions aussi côte à côte), qui tenait jusqu'à 1280×720, a été implémentée puis écartée par l'utilisateur : main et missions restent l'une sous l'autre, comme avant.

## What Changes

- Les sections Exploration et Observation du plateau joueur sont affichées côte à côte sur une même ligne, chacune avec son titre. Leurs emplacements de technologie, qui ne se cliquent pas, sont plus petits (32×46 px au lieu de 58×82, pastilles des étapes du scan de 22 px) et les tuiles Exploration sont espacées ; les étapes du scan restent rondes.
- La section Informatique ne change pas.
- La main et les missions restent l'une sous l'autre, sur toute la largeur, comme avant.
- Les cartes de la main et des missions du plateau joueur sont réduites (84×120 px au lieu de 112×160). L'infobulle montre toujours la carte en grand ; les boutons Jouer et Défausser et les cercles des missions restent cliquables (sur la carte et dans l'infobulle de la mission).
- Nouveau bouton dans le titre de la section Main : il ouvre une fenêtre qui montre la main en grand, avec les mêmes boutons et les mêmes choix que sur le plateau.
- Sur un plateau trop étroit pour Exploration et Observation côte à côte (écran de téléphone), elles passent l'une sous l'autre.
- Résultat mesuré sur la même partie : tout le plateau visible sans défilement à 1600×900 ; à 1366×768, le titre des missions et le haut de leurs cartes sont visibles (107 px à faire défiler), à 1280×720 le titre seul.
- Documentation (`public/docs/documentation.md`, Plateau du joueur) et capture `plateau-joueur.png` mises à jour.

Hors périmètre : sections Ressources, Actions et Informatique ; taille des cartes ailleurs (rangée, fenêtres de choix, plateaux Alien) ; panneaux autour du système solaire ; largeur du plateau joueur dans l'écran. Aucun changement du moteur, des sauvegardes (pas de migration) ni du protocole en ligne.

## Capabilities

### New Capabilities

(aucune)

### Modified Capabilities

- `board-display` : ajoute la disposition du plateau joueur (Exploration et Observation sur une ligne, Informatique inchangée, main et missions l'une sous l'autre avec des cartes réduites, missions visibles sans défilement à 1600×900, retour sur deux lignes sur un écran étroit) et la fenêtre qui montre la main en grand.

## Impact

- `src/ui/PlayerBoardUI.tsx` et `PlayerBoardUI.css` : rangée Exploration | Observation, cartes réduites dans la main et les missions, bouton d'agrandissement de la main.
- `src/ui/player/PlayerTracks.tsx` : classe des pistes compactes ; `TechSpot` et `PlayerComputer` inchangés.
- Nouvelle fenêtre `src/ui/modals/HandModal.tsx` (main en grand, réutilise `HandCard` et `CardBack`).
- Attributs `data-tutorial` (`player-board`, `computer`, `hand`, `missions`) conservés sur les mêmes sections ; étapes du tutoriel qui les pointent relues (`public/docs/tutoriel.md`, `e2e/tutorial.spec.ts`).
- Captures : `public/docs/images/ecrans/plateau-joueur.png` (et `jeu.png` si elle montre le plateau), refaites par `SETI_DOC_SCREENSHOTS=1 npx playwright test docMenus` ; capture de la nouvelle fenêtre ajoutée à la documentation.
