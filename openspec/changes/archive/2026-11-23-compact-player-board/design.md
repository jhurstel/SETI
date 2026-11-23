# Design

## Context

Changement limité à la couche `ui` (aucune règle, aucun état du moteur). Le plateau joueur (`src/ui/PlayerBoardUI.tsx`) empile ses sections dans `.seti-player-layout-container` (colonne flex, défilement vertical, écart 6 px) : Ressources et Actions (dans `.seti-stats-bar`, `display: contents`), Exploration, Observation, Informatique, Main, Mission. Les emplacements de technologie sont des `TechSpot` de 58×82 px (`ui/styles.css`), partagés avec l'ordinateur (`PlayerComputer`) ; sur les pistes, la zone de survol d'un emplacement sans pastille est `.obs-track-slot.ghost` (56×80). Une carte miniature est un `.seti-common-card` de 112×160 px (`ui/styles.css`) dont la face (`CardFace compact` → `CardMini`) est mise à l'échelle de son cadre par un `ResizeObserver` : changer la taille du cadre suffit à réduire la carte. Les cercles d'une mission portent leur `onClick` dans la face, donc aussi dans l'infobulle de la mission (infobulle interactive du plateau).

Mesures de départ (partie `midGameSave`, hauteurs des sections) : Ressources 103, Actions 94, Exploration 138, Observation 138, Informatique 146, Main 208, Mission 208 ; plateau large de 519 px à 1600×900 et de 450 px à 1366×768.

Maquettes (CSS injecté dans l'aperçu, même partie ; captures dans le dossier de notes de la session, `plateau-joueur/planche-*.png`). Contenu du plateau / hauteur visible :

| Variante | 1600×900 (845) | 1366×768 (713) | 1280×720 (665) |
|---|---|---|---|
| Avant | 1083, missions sous le bord | 1080, missions sous le bord | 1080 |
| A : Exploration \| Observation | 910, bas des missions coupé | 907, titre des missions seul | 907 |
| C : A + main \| missions | 845, tout visible | 713, tout visible | 693, bas des cartes coupé |
| **D : A + cartes réduites (retenue)** | 845, tout visible | 827, haut des missions seul | 827 |
| E : C + cartes réduites | 845, tout visible | 713, tout visible | 665, tout visible |

## Goals / Non-Goals

**Goals:**
- Atteindre la disposition D sans toucher à l'ordinateur ni aux sections du haut.
- Garder les cibles du tutoriel (`data-tutorial`) sur des éléments qui existent toujours et entourent la même zone.
- Retour automatique sur deux lignes, sans point de rupture codé en dur pour chaque taille.
- Fenêtre « main en grand » qui réutilise les composants de la main, sans nouvelle logique de commande.

**Non-Goals:**
- Réduire Ressources, Actions, ou les cartes hors du plateau joueur (rangée, fenêtres de choix, plateaux Alien).
- Changer la largeur du plateau joueur dans l'écran (`BoardUI`).

## Decisions

### Variante D (main et missions l'une sous l'autre) plutôt que E
E (main et missions côte à côte, cartes réduites) tenait de 1280×720 à 1600×900 ; elle a été implémentée puis écartée par l'utilisateur, qui préfère garder la main et les missions l'une sous l'autre, sur toute la largeur. D tient sans défilement à 1600×900 ; à 1366×768 (implémentation : contenu 820 px pour 713 visibles), le titre des missions et le haut de leurs cartes restent visibles. La fenêtre « main en grand » compense la réduction des cartes quand le joueur veut lire plusieurs cartes à la fois.

### Une rangée flex qui passe à la ligne, plutôt qu'une grille
Exploration et Observation sont enveloppées dans un `div.seti-player-row` (`display: flex; flex-wrap: wrap; gap: 6px`). Exploration : `flex: 1 0 auto` (au moins la largeur de ses quatre tuiles compactes) ; Observation : `flex: 2 1 200px`. Quand la somme des largeurs minimales dépasse la largeur du plateau, flex passe Observation à la ligne et elle prend toute la largeur : le retour sur deux lignes se fait sans `@media`.
Alternative écartée : grille sur `.seti-player-layout-container` (utilisée pour la maquette) : elle impose des colonnes et un `@media` pour le retour, et `.seti-stats-bar` en `display: contents` y place ses sections dans les colonnes.

### Emplacements compacts par une classe des pistes, sans toucher à `TechSpot`
Rien ne se clique sur ces deux pistes (infobulles seulement) : les emplacements peuvent être petits. Les pistes reçoivent une classe (`.obs-track-container.compact`) qui ramène `.seti-tech-spot` à 32×46 px (proportion de la tuile 56×80 conservée), `.obs-track-slot.ghost` à 30×44, les pastilles des étapes du scan à 22 px (icône 20) et la marge intérieure de la piste à 6 px (10 px sur les côtés pour Exploration), avec un écart de 8 px entre les tuiles Exploration (maquette G, 1366×768 : ligne plus basse d'environ 11 px que des tuiles de 40×57). Le SVG de la tuile s'étire déjà sur son cadre. L'ordinateur n'a pas ces classes : il garde 58×82.

### Cartes réduites par un sélecteur du plateau joueur
`.seti-player-panel .seti-cards-list .seti-common-card` passe à 84×120 px (75 %, proportion 210×300 conservée) ; la pile des missions accomplies recale son chevauchement (`margin-left` : −78 px au lieu de −104). `CardMini` remet la face à l'échelle tout seul. Les boutons Jouer et Défausser (30×20 px, positionnés en ligne dans `HandCard`) gardent leur taille : ils tiennent sur 84 px ; leur style fixe en ligne est l'occasion de passer en classes CSS (convention de `ui.md`). Les cercles des missions rétrécissent avec la carte, d'où l'exigence qu'ils restent cliquables dans l'infobulle, ce qui est déjà le cas.
Alternative écartée : `zoom` ou `transform` sur la liste : la zone de clic et le défilement ne suivent pas toujours, et `CardMini` fait déjà ce travail proprement.

### Fenêtre « main en grand » : `HandModal` réutilise `HandCard`
Bouton (icône d'agrandissement, infobulle du jeu, pas d'attribut `title`) dans le titre de la section Main. Il ouvre `ui/modals/HandModal.tsx`, état local de `PlayerBoardUI` (pas de nouvelle prop, le plateau reste mémoïsé). La fenêtre reprend l'aspect des fenêtres du jeu (`.seti-modal-overlay`, `.seti-choice-modal.wide`) avec un bouton Fermer, Échap et clic hors de la fenêtre ; elle n'utilise pas `ChoiceModal`, fait pour un choix obligatoire (« Voir le plateau » au lieu de fermer). Elle rend les mêmes `HandCard` (ou `CardBack` pour une carte cachée d'un robot) avec les mêmes props que la main du plateau, dans un cadre grand (`.seti-common-card.large`, 168×240), en lignes qui passent à la ligne : jouer, défausser, sélection pendant un choix et infobulles marchent sans code nouveau. Elle se ferme quand la carte quitte la main (effet sur la liste des cartes) ou quand la main devient vide.
Alternative écartée : faces en grande taille (`FullCardFace`) avec des boutons dédiés : il faudrait recopier la logique de `HandCard` (jouabilité, raisons, modes de choix).

### Cibles du tutoriel
`data-tutorial="hand"` et `"missions"` restent sur les sections elles-mêmes (pas sur la rangée), `"computer"` et `"player-board"` ne bougent pas. Aucune étape ne vise Exploration ou Observation. Les textes de `public/docs/tutoriel.md` ne décrivent pas la position des sections (pas de « en bas », « dessous », « faites défiler ») ; ils sont relus après coup. La fenêtre de la main n'est pas une cible du tutoriel.

## Risks / Trade-offs

- [Cartes réduites moins lisibles, petits symboles] → infobulle en grand au survol et fenêtre « main en grand » ; vérification visuelle sur la capture 1366×768.
- [Cercles des missions plus petits à viser] → cliquables aussi dans l'infobulle agrandie ; vérifié sur une mission validable.
- [Fenêtre ouverte pendant une étape du tutoriel qui vise la main] → la fenêtre se ferme par Échap ou clic dehors ; test e2e `tutorial` inchangé (il ne l'ouvre pas).
- [Tuiles compactes moins lisibles (chiffres des tuiles)] → le détail reste dans l'infobulle.
- [Plateau d'un robot : main de dos et révélée, missions] → même disposition ; vérifié sur l'onglet d'un robot.

## Migration Plan

Aucune migration : affichage seul, sauvegardes et protocole en ligne inchangés. Retour arrière : annuler le commit.
