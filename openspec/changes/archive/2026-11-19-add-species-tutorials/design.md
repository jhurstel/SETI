# Design

## Context

Voir proposal.md (Why). Le tutoriel existe (changement `add-tutorial`) :

- `src/tutorial/` (TS pur) décrit chaque chapitre : graine, ajustements de scénario (`adjust`), commandes de préparation, étapes (`done`, `onlyIf`, `duringChoice`, `docLink`) et solution vérifiée par `TutorialChapters.test.ts`.
- La progression est dans `localStorage['seti_tutorial']` (`ui/tutorialProgress.ts` : chapitres terminés, refus, aides vues).
- `GameFactory` crée toujours les cinq espèces (`game.species`) et attribue deux d'entre elles aux plateaux Alien (`board.speciesId`) ; la découverte (`SpeciesSystem.placeLifeTrace` → découverte) applique la mise en jeu propre à l'espèce (spécimens, anomalies, planète Oumuamua, paliers centauriens, cartes Exertiens) et donne une carte Alien au premier marqueur de chaque couleur.
- La documentation (`public/docs/documentation.md`) est rendue par `DocumentationModal` (`renderMarkdown`, ancres `slugify` des titres) ; les règles d'espèce sont les sections `### 3.2` à `### 3.6`.
- Le chapitre « Traces de vie et espèces » (graine 2026) fait découvrir la vraie espèce du premier plateau.

## Goals / Non-Goals

**Goals:**
- Cinq chapitres d'espèce dans le même cadre que les chapitres existants (position reproductible, solution testée, textes dans `tutoriel.md`).
- Déblocage par espèce, déduit des parties réellement jouées, sans toucher au moteur.
- Masquage, côté interface, de tout ce qui dévoile une espèce non débloquée : documentation, et pendant le chapitre « Traces de vie et espèces », le plateau révélé, l'annonce, les cartes et les jetons.

**Non-Goals:**
- Aucun changement du moteur, des robots, des sauvegardes ou du protocole en ligne.
- Pas de masquage des espèces dans une vraie partie (une espèce découverte en partie est, par définition, débloquée).

## Decisions

### D1. Choix de l'espèce d'un chapitre par ajustement de scénario (couche tutorial)

Chaque chapitre d'espèce fixe `alienBoards[0].speciesId` à son espèce dans `adjust` (les cinq espèces existent toujours dans `game.species`), puis pose deux traces de découverte du joueur (rouge et jaune) et prépare la troisième (ordinateur prêt à analyser, comme le chapitre « Traces de vie et espèces »). Le joueur découvre donc l'espèce lui-même, par le vrai moteur, et voit sa mise en jeu se produire.
*Alternative écartée :* chercher une graine où l'espèce est déjà sur un plateau (`npm run tutorial:seed`) : possible, mais fragile (la graine change avec la mise en place) et inutile puisque l'ajustement est explicite. La graine reste celle des autres chapitres (2026) sauf si une solution l'exige.

### D2. Contenu des chapitres (une mécanique principale chacun)

| Chapitre | Après la découverte | Ajustements |
|---|---|---|
| Mascamites | Spécimens sur Jupiter et Saturne (infobulle « ? »), 7e sur la piste bleue ; jouer une carte « prélevez un spécimen » avec une sonde sur Jupiter, choisir le spécimen, voir la capsule ; expliquer son retour vers la Terre comme une mission | carte de prélèvement en main, sonde sur Jupiter, crédits |
| Anomalies | Jetons sur le disque D ; ellipse (D7) : deux rotations plus tard, la Terre est à un secteur d'une anomalie et le joueur en tête de la piste de sa couleur ; rechercher une technologie : la rotation amène la Terre sur l'anomalie, le joueur gagne la récompense | 6 Médias ; l'ellipse fait les deux rotations (`performRotation`) et pose la trace du joueur sur la piste de la couleur de l'anomalie atteinte |
| Oumuamua | La planète et son secteur de 3 signaux ; scanner pour couvrir ce secteur (presque plein) et gagner des jetons ; présenter la piste payée en jetons | signaux du joueur dans le secteur d'Oumuamua, ressources du scan |
| Centauriens | Palier de message à score + 15 ; une action fait franchir le palier ; choisir une tuile Message | score ajusté juste sous le palier après la découverte (la découverte pose le palier ; l'action suivante rapporte assez de PV) |
| Exertiens | Cartes Exertiens reçues (hors main), jouer une carte face cachée par marqueur de découverte, danger et piste ; présenter les paliers à + 20 / + 40 et la pénalité de fin de partie | aucun au-delà de la découverte |

Les étapes réutilisent les mécanismes existants (`duringChoice` pour les choix, `onlyIf` pour une étape de secours, `docLink` vers la section de l'espèce, alors débloquée puisque le chapitre l'est). Les positions exactes (secteurs, scores) se calent en écrivant chaque chapitre ; `TutorialChapters.test.ts` vérifie chaque solution.

### D7. Ellipse entre deux étapes

Une rotation n'avance la Terre que d'un secteur, alors que les anomalies sont posées à trois secteurs l'une de l'autre : sans raccourci, le chapitre des Anomalies demanderait trois recherches de technologie. Une étape d'explication peut donc porter une **ellipse** (`TutorialStep.ellipsis(game, humanId)`, couche tutorial, fonction pure qui n'appelle que des opérations du moteur) : quand le joueur clique sur « Suivant », la partie avance d'un coup (« Deux tours plus tard… », expliqué par le texte de l'étape) ; l'historique garde ses entrées et note l'ellipse. `checkSolution` applique l'ellipse de la même façon en validant les explications.
*Alternatives écartées :* jouer la découverte dans la préparation (le joueur ne découvre plus l'espèce) ; trois recherches de technologie (long et répétitif) ; expliquer la règle sans la déclencher.

### D3. Déblocage : relevé des espèces découvertes dans les parties jouées (couche ui)

`tutorialProgress` gagne un champ `species: string[]` (noms d'espèces débloquées), lu avec `[]` par défaut : les progressions existantes restent valides, sans version. Un hook de `BoardUI` relève, à chaque état de partie hors tutoriel (partie locale, en ligne, reprise d'une sauvegarde), les plateaux `isDiscovered` et ajoute leur `speciesId`. Pour une nouvelle espèce, il affiche un message court (toast du jeu) : « Nouveau chapitre du tutoriel : <espèce> ».
*Alternative écartée :* écouter l'annonce de découverte (`discoveryNotice`) : elle ne couvre pas la reprise d'une sauvegarde ni une partie en ligne rejointe en cours ; lire l'état est plus simple et idempotent.
La correspondance chapitre ↔ espèce est une donnée du chapitre (`TutorialChapter.species?: AlienBoardType`) ; un chapitre avec `species` n'est jouable que si l'espèce est débloquée.

### D4. Menu : chapitres verrouillés

`TutorialMenu` reçoit la liste des espèces débloquées. Un chapitre verrouillé s'affiche avec un cadenas, le titre « Espèce inconnue » et le résumé « Découvrez une nouvelle espèce en partie pour débloquer ce chapitre » ; le bouton est désactivé (`aria-disabled`). Les chapitres d'espèce sont regroupés après « Paliers et fin de partie », avant « Première vraie partie ». Le texte d'introduction du menu précise que ces chapitres se débloquent en jouant.

### D5. Documentation : sections d'espèce masquées par une fonction pure (couche tutorial)

Chaque section d'espèce de `documentation.md` porte un marqueur sur la ligne de son titre, invisible au rendu : `### 3.2 Mascamites <!-- espece:Mascamites -->`. Une fonction pure `hideLockedSpecies(markdown, unlocked)` (dans `src/tutorial/`, testée) remplace chaque section marquée d'une espèce non débloquée, du titre jusqu'au titre suivant de même niveau ou supérieur, par un seul encart commun :

> 🔒 **Espèces encore inconnues** : les règles d'une espèce se dévoilent quand vous la découvrez en partie. Le tutoriel propose alors un chapitre pour l'apprendre.

(un seul encart quelle que soit la quantité de sections masquées, pour ne pas révéler combien d'espèces restent : il y en a toujours cinq). `DocumentationModal` applique la fonction avant `renderMarkdown`. Une ancre demandée (`section`) qui n'existe plus après masquage retombe sur l'ancre de l'encart (`especes-inconnues`), ce qui couvre les liens « En savoir plus » et le bouton de documentation d'un plateau Alien.
*Alternative écartée :* masquer après rendu, dans le HTML : plus fragile (structure du HTML) et les titres restent dans le sommaire éventuel.

### D6. Chapitre « Traces de vie et espèces » : espèce masquée dans l'interface (couche ui, piloté par le tutoriel)

Le moteur découvre une vraie espèce ; c'est l'interface qui la cache. Le chapitre déclare `masksSpecies: true` ; quand l'espèce de son plateau n'est pas débloquée, `BoardUI` calcule une liste d'espèces masquées et la transmet aux composants concernés. L'espèce choisie par `adjust` est les **Anomalies** (mise en jeu la plus discrète à cacher : trois jetons sur le disque D), sauf si le joueur a déjà débloqué une espèce : le chapitre prend alors celle-ci, et rien n'est masqué.

Ce qui est caché pour une espèce masquée :

| Élément | Affichage masqué |
|---|---|
| Annonce de découverte | « Nouvelle espèce Alien découverte » sans nom (titre générique déjà prévu par `useAnnouncements`) |
| Plateau Alien | titre « Espèce découverte » sans identifiant, sans bouton de documentation ni symbole propre (spécimens, message, jetons) ; à la place des pistes et de la zone des cartes, un encart « Découvrez cette espèce en partie pour voir ses règles » ; le triangle de découverte reste visible |
| Cartes Alien (main du joueur, cartes gagnées à la découverte, pioche de l'espèce) | dos de carte « Carte Alien » sans nom, texte ni infobulle de contenu ; impossible à jouer pendant ce chapitre (le chapitre se termine à la découverte) |
| Historique | le nom d'une carte de l'espèce masquée est remplacé par « une carte Alien » |
| Système solaire | jetons d'anomalie non dessinés, et sans infobulle |

Une carte appartient à l'espèce masquée si elle figure dans la pioche de cette espèce au départ du chapitre (`species.cards` de la position préparée) ; la liste de ses identifiants est calculée une fois au démarrage du chapitre.
*Alternatives écartées :* faire arrêter le chapitre avant la découverte (on perd le moment pédagogique) ; une espèce factice dans le moteur (modèle et tests du moteur modifiés pour un besoin d'affichage).

## Risks / Trade-offs

- [Une fuite oubliée dans l'interface pendant le chapitre « Traces de vie et espèces » (nouvel élément d'espèce ajouté plus tard)] → test de composant qui rend le plateau, la main et l'historique du chapitre et vérifie l'absence du nom « Anomalies » et des noms de ses cartes ; parcours Playwright du chapitre.
- [Les positions des chapitres d'espèce dépendent de la géométrie (rotation, secteur d'Oumuamua)] → solutions vérifiées par `TutorialChapters.test.ts` et `npm run tutorial:seed` ; ajustements explicites plutôt que dépendance à la graine.
- [Joueur expérimenté gêné par une documentation incomplète] → les livrets PDF restent complets ; une option « tout débloquer » pourra être ajoutée sans changer cette conception.
- [Déblocage local au navigateur] → assumé : la progression du tutoriel l'est déjà.

## Migration Plan

Aucune migration de partie. Le champ `species` de `seti_tutorial` est facultatif (lu `[]` par défaut). Retour arrière : retirer les chapitres et le filtrage ; les données stockées en trop sont ignorées.

## Open Questions

- Faut-il une option « Débloquer toutes les espèces » (paramètres) pour les joueurs qui connaissent déjà le jeu ? Ajout indépendant, sans effet sur la conception.
