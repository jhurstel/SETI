# Tasks

## 1. Exploration et Observation sur une ligne

- [x] 1.1 Dans `src/ui/PlayerBoardUI.tsx`, envelopper les sections Exploration et Observation dans un `div.seti-player-row` ; dans `PlayerBoardUI.css`, la rangée flex qui passe à la ligne (Exploration à la largeur de son contenu, Observation qui prend le reste avec une largeur minimale). Vérifier dans l'aperçu (partie `tools/bench/midGameSave.ts`) qu'à 1280×720, 1366×768 et 1600×900 les deux sections sont sur une ligne sans chevauchement.
- [x] 1.2 Ajouter la classe `compact` aux deux pistes (`src/ui/player/PlayerTracks.tsx`) et ses règles CSS (tuile 32×46, zone de survol 30×44, pastilles du scan 22 px avec icône 20, marge 6 px, écart de 8 px entre les tuiles Exploration), sans modifier `TechSpot` ni `PlayerComputer`. Vérifier que l'ordinateur garde ses emplacements de 58×82 et que les infobulles des emplacements et des étapes du scan s'ouvrent au survol de toute la tuile.

## 2. Main et missions l'une sous l'autre, cartes réduites

- [x] 2.1 Garder les sections Main et Mission l'une sous l'autre, sur toute la largeur (la variante côte à côte, implémentée d'abord, a été retirée à la demande de l'utilisateur), avec `data-tutorial="hand"` et `"missions"` et la référence `cardsListRef` de la main.
- [x] 2.2 Réduire les cartes de la main et des missions du plateau joueur à 84×120 (sélecteur limité à `.seti-player-panel`) et recaler le chevauchement de la pile des missions accomplies ; passer les styles en ligne fixes des boutons Jouer et Défausser de `HandCard` en classes CSS. Vérifier dans l'aperçu : à 1600×900, plateau entier visible sans défilement (`scrollHeight` du conteneur ≤ `clientHeight`) ; à 1366×768, titre et haut des cartes des missions visibles ; à 390×844, Exploration au-dessus d'Observation, sans débordement horizontal.
- [x] 2.3 Vérifier les commandes sur les cartes réduites : bouton Jouer et Défausser, sélection pendant une défausse ou un échange, mission validée par un clic sur son cercle (sur la carte et dans l'infobulle), plusieurs missions et cartes jouées (défilement horizontal, pile à gauche), aucune mission, plateau d'un robot, et l'action « Jouer une carte » qui ramène la main et met en avant les cartes jouables. Lancer `npx playwright test humanTurn` (tour solo qui joue une carte).
- [x] 2.4 Ajouter un test de composant (`test/components/`) qui rend le plateau joueur et vérifie que Exploration et Observation sont dans une même rangée, que Main et Mission n'y sont pas, et que `data-tutorial` `computer`, `hand` et `missions` sont présents ; `npm test` passe.

## 3. Main en grand

- [x] 3.1 Créer `src/ui/modals/HandModal.tsx` (aspect des fenêtres du jeu, bouton Fermer, Échap, clic hors de la fenêtre) qui rend les `HandCard` de la main (et `CardBack` pour une carte cachée d'un autre joueur) dans un cadre `.seti-common-card.large` de 168×240, en lignes qui passent à la ligne ; fermeture automatique quand la carte jouée ou défaussée quitte la main ou que la main est vide.
- [x] 3.2 Ajouter le bouton d'agrandissement dans le titre de la section Main (icône, infobulle du jeu par `handleTooltipHover`, pas d'attribut `title`, désactivé si la main est vide), état d'ouverture local à `PlayerBoardUI`. Vérifier dans l'aperçu : ouverture, jouer une carte depuis la fenêtre (elle se ferme), choix d'une carte pendant une défausse, main d'un robot (cartes cachées de dos, pas de bouton).
- [x] 3.3 Test de composant de `HandModal` (`test/components/HandModal.test.tsx`) : toutes les cartes rendues, fermeture par Échap et par le bouton, clic sur Jouer qui appelle `onPlayCard`, cartes cachées de dos pour un robot ; `npm test` passe.

## 4. Tutoriel et documentation

- [x] 4.1 Relire les étapes du tutoriel qui visent `player-board`, `computer`, `hand` et `missions` (`src/tutorial/chapters.ts`, `speciesChapters.ts`, textes de `public/docs/tutoriel.md`) : bulle bien placée à côté de la section devenue moitié moins large, texte qui ne dépend pas de la position ; mentionner le bouton d'agrandissement à l'étape d'introduction de la main si utile. Vérifier par `npx playwright test tutorial`.
- [x] 4.2 Mettre à jour le paragraphe « Plateau du joueur » de `public/docs/documentation.md` (« Dessous : … ») : Exploration et Observation côte à côte, ordinateur, puis main et missions l'une sous l'autre en cartes réduites, bouton qui montre la main en grand, retour sur deux lignes sur un écran étroit. Ajouter la capture de la fenêtre à `e2e/docMenus.spec.ts`, refaire les captures par `SETI_DOC_SCREENSHOTS=1 npx playwright test docMenus` et vérifier `public/docs/images/ecrans/plateau-joueur.png` (et `jeu.png` si elle montre le plateau).
- [x] 4.3 Mettre à jour `.claude/rules/ui.md` (liste des fichiers : `modals/HandModal` ; plateau joueur en rangées de sections, cartes réduites).

## 5. Vérification d'ensemble

- [x] 5.1 Captures avant/après à 1600×900, 1366×768, 1280×720 et 390×844 sur la partie `midGameSave`, comparées aux maquettes de la variante D ; `npm run check` et `npm run test:e2e` passent.
