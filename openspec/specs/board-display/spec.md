# board-display Specification

## Purpose
Affichage des plateaux de jeu hors faces de cartes : état des actions principales du plateau joueur, panneaux repliables autour du système solaire et informations dessinées sur le système solaire, pour que le joueur voie ce qu'il peut faire et ce qu'il peut gagner sans ouvrir d'infobulle.

## Requirements

### Requirement: Actions principales impossibles grisées
Sur le plateau du joueur humain, chaque action principale qu'il ne peut pas faire maintenant, ainsi que la fin du tour, SHALL être grisée et ne pas réagir au clic ; une action possible SHALL garder son aspect actif (mise en avant). Le grisé SHALL suivre la décision du moteur, complétée par les blocages propres à l'écran (étape du tutoriel, choix en cours sur le plateau).

#### Scenario: Ressources insuffisantes
- **WHEN** c'est le tour du joueur, il n'a pas fait d'action principale et il a moins de crédits ou d'énergie que le coût du scan
- **THEN** l'action « Scanner un secteur » est grisée et un clic dessus ne fait rien, tandis que les actions qu'il peut payer restent actives

#### Scenario: Aucune sonde au bon endroit
- **WHEN** le joueur n'a aucune sonde sur une planète autre que la Terre
- **THEN** les actions « Mettre en orbite » et « Poser une sonde » sont grisées

#### Scenario: Action principale déjà faite
- **WHEN** le joueur a fait son action principale du tour
- **THEN** toutes les actions principales, Passer compris, sont grisées jusqu'à son prochain tour

#### Scenario: Tour d'un autre joueur
- **WHEN** c'est le tour d'un autre joueur ou d'un robot
- **THEN** les actions principales du joueur humain sont grisées

#### Scenario: Fin du tour impossible
- **WHEN** le joueur n'a pas encore fait son action principale du tour
- **THEN** l'hexagone de fin du tour est grisé, son infobulle demande d'effectuer d'abord une action principale, et il redevient actif une fois l'action faite

#### Scenario: Action possible
- **WHEN** le joueur peut lancer une sonde
- **THEN** l'action « Lancer une sonde » n'est pas grisée, reste mise en avant et un clic la lance

### Requirement: Raison d'une action grisée
Le survol d'une action principale grisée SHALL ouvrir l'infobulle du jeu (jamais une infobulle native du navigateur) avec son coût, son gain et la raison qui l'empêche, la même que celle que donnerait le moteur s'il refusait la commande.

#### Scenario: Raison affichée
- **WHEN** le joueur survole « Rechercher une technologie » sans avoir assez de Médias
- **THEN** l'infobulle indique le nombre de Médias nécessaires

#### Scenario: Raison générale prioritaire
- **WHEN** le joueur survole une action principale après avoir fait son action principale du tour
- **THEN** l'infobulle indique que l'action principale est déjà effectuée, plutôt qu'une raison propre à l'action

### Requirement: Bascule des panneaux repliables
Le bandeau de chaque panneau repliable autour du système solaire (objectifs, technologies, rangée de cartes, planètes, plateaux Alien, historique) SHALL porter une flèche qui indique s'il est gardé ouvert ou replié. Un clic sur le bandeau SHALL basculer cet état, et la flèche SHALL changer de sens. Aucun symbole d'épingle ne SHALL être affiché.

#### Scenario: Garder un panneau ouvert
- **WHEN** le joueur clique sur le bandeau d'un panneau replié
- **THEN** le panneau reste ouvert quand la souris en sort, et sa flèche indique qu'un nouveau clic le repliera

#### Scenario: Aperçu au survol
- **WHEN** le joueur survole un panneau replié sans cliquer
- **THEN** le panneau s'ouvre le temps du survol et se referme quand la souris en sort

### Requirement: Repli immédiat au clic
Un clic sur le bandeau d'un panneau ouvert SHALL le replier immédiatement, même si la souris reste au-dessus ; le panneau ne SHALL se rouvrir au survol qu'après que la souris en est sortie puis revenue. Un panneau que le jeu force ouvert (choix d'une technologie, trace de vie à placer, étape du tutoriel) SHALL rester ouvert tant que ce choix dure.

#### Scenario: Repli sous la souris
- **WHEN** le joueur clique sur le bandeau d'un panneau gardé ouvert, la souris restant sur le panneau
- **THEN** le panneau se replie aussitôt

#### Scenario: Rouverture après sortie
- **WHEN** après ce repli la souris sort du panneau puis le survole de nouveau
- **THEN** le panneau s'ouvre de nouveau en aperçu

#### Scenario: Panneau forcé ouvert
- **WHEN** le jeu attend le choix d'une technologie et le joueur clique sur le bandeau des technologies
- **THEN** le panneau reste ouvert jusqu'à la fin du choix

### Requirement: Prochain gain de couverture d'un secteur
À côté du nom de chaque secteur du système solaire, le plateau SHALL montrer, avec les icônes du jeu, ce que rapportera au joueur majoritaire la prochaine couverture de ce secteur : la récompense de première couverture tant que le secteur n'a jamais été couvert, puis celle des couvertures suivantes. Un secteur sans récompense de couverture (Oumuamua) SHALL n'afficher aucun symbole.

#### Scenario: Secteur jamais couvert
- **WHEN** un secteur dont la première couverture rapporte une trace de vie rouge n'a pas encore été couvert
- **THEN** le symbole de trace de vie rouge figure à côté de son nom

#### Scenario: Secteur déjà couvert
- **WHEN** un secteur dont les couvertures suivantes rapportent 3 PV a été couvert une fois
- **THEN** le symbole 3 PV remplace la trace de vie à côté de son nom

#### Scenario: Récompense composée
- **WHEN** la prochaine couverture d'un secteur rapporte une trace de vie rouge et des PV
- **THEN** les deux symboles figurent à côté de son nom

#### Scenario: Lisibilité conservée
- **WHEN** un secteur a été couvert par un ou plusieurs joueurs
- **THEN** le nom, les pastilles des joueurs qui l'ont couvert et le symbole du prochain gain restent lisibles sans se chevaucher, et l'infobulle du secteur reste disponible au survol

### Requirement: Exploration et Observation sur une ligne
Le plateau joueur SHALL afficher les sections Exploration et Observation côte à côte sur une même ligne, chacune avec son titre, sous la section Actions et au-dessus de la section Informatique. Les emplacements de technologie de ces deux pistes, qui ne se cliquent pas, SHALL être de même taille, nettement plus petits que ceux de l'ordinateur, et séparés par un écart visible, la tuile de chaque technologie restant reconnaissable.

#### Scenario: Disposition sur un écran d'ordinateur
- **WHEN** le joueur affiche son plateau sur un écran de 1280×720 ou plus
- **THEN** les quatre emplacements Exploration et les étapes du scan avec les quatre emplacements Observation tiennent sur une même ligne, sans se chevaucher

#### Scenario: Tuiles compactes lisibles
- **WHEN** le joueur a acquis une technologie Exploration ou Observation
- **THEN** sa tuile, en couleur, remplit l'emplacement compact et se distingue des emplacements vides, pâles

#### Scenario: Tuiles espacées
- **WHEN** le joueur affiche son plateau sur un écran de 1366×768
- **THEN** les tuiles Exploration et Observation ont la même taille, et chaque tuile Exploration est séparée de sa voisine par un écart

#### Scenario: Infobulles conservées
- **WHEN** le joueur survole un emplacement de technologie ou une étape du scan de ces pistes
- **THEN** la même infobulle qu'avant s'ouvre (pouvoir sans la technologie, puis ce qu'elle apporte ; ou gain de l'étape)

### Requirement: Informatique inchangée
La section Informatique du plateau joueur SHALL garder sa taille, ses emplacements et son comportement : elle occupe toute la largeur du plateau, sous la ligne Exploration et Observation.

#### Scenario: Ordinateur pleine largeur
- **WHEN** le joueur affiche son plateau
- **THEN** l'ordinateur de données occupe toute la largeur, avec des emplacements de technologie de la même taille qu'avant ce changement

### Requirement: Main et missions l'une sous l'autre
Le plateau joueur SHALL afficher la main puis les missions, chacune sur toute la largeur, sous la section Informatique, comme avant ce changement. Chaque liste SHALL défiler horizontalement quand ses cartes ne tiennent pas.

#### Scenario: Plusieurs missions
- **WHEN** le joueur a plus de missions et de cartes jouées que la largeur n'en montre
- **THEN** la liste des missions défile horizontalement, la pile des missions accomplies restant à gauche

#### Scenario: Cartes jouables mises en avant
- **WHEN** le joueur choisit l'action « Jouer une carte »
- **THEN** la main est ramenée à l'écran et ses cartes jouables sont mises en avant, comme avant

### Requirement: Cartes réduites sur le plateau joueur
Les cartes de la main et des missions du plateau joueur SHALL être affichées en taille réduite, face entière mise à l'échelle. Leur infobulle SHALL montrer la carte en grand, et leurs commandes (jouer, défausser, sélection pendant un choix, cercles des missions) SHALL rester utilisables.

#### Scenario: Lecture d'une carte réduite
- **WHEN** le joueur survole une carte de sa main
- **THEN** l'infobulle montre la carte en grand, avec le texte propre à la carte

#### Scenario: Jouer depuis une carte réduite
- **WHEN** le joueur clique sur le bouton Jouer d'une carte réduite de sa main, la carte étant jouable
- **THEN** la carte est jouée comme avant ce changement

#### Scenario: Valider une mission
- **WHEN** un cercle d'une mission peut être validé
- **THEN** il est mis en avant et un clic sur ce cercle, sur la carte réduite ou dans son infobulle, valide la récompense

### Requirement: Main en grand
La section Main du plateau joueur SHALL porter un bouton qui ouvre une fenêtre montrant la main en grand. Les cartes y SHALL offrir les mêmes commandes et infobulles que sur le plateau. La fenêtre SHALL se fermer par son bouton de fermeture, par Échap, par un clic hors de la fenêtre, et après une commande qui retire la carte de la main.

#### Scenario: Ouvrir la main en grand
- **WHEN** le joueur clique sur le bouton d'agrandissement de la section Main
- **THEN** une fenêtre s'ouvre avec toutes les cartes de sa main en grande taille

#### Scenario: Jouer depuis la fenêtre
- **WHEN** le joueur clique sur le bouton Jouer d'une carte jouable dans la fenêtre
- **THEN** la carte est jouée et la fenêtre se ferme

#### Scenario: Choix en cours sur la main
- **WHEN** le jeu attend que le joueur choisisse une carte de sa main (défausse, échange, réservation) et qu'il ouvre la fenêtre
- **THEN** les cartes de la fenêtre se comportent comme celles du plateau : sans bouton Jouer ni Défausser, le choix se faisant dans la fenêtre de choix du jeu

#### Scenario: Main d'un autre joueur
- **WHEN** le joueur ouvre la fenêtre sur le plateau d'un robot ou d'un autre joueur
- **THEN** seules les cartes révélées sont montrées de face, les autres de dos, sans bouton de commande

#### Scenario: Main vide
- **WHEN** la main affichée est vide
- **THEN** le bouton d'agrandissement est désactivé

### Requirement: Missions visibles sans défilement
Sur une partie de milieu de jeu, le plateau joueur SHALL montrer la section des missions entière, sans défilement, sur un écran de 1600×900.

#### Scenario: Écran 1600×900
- **WHEN** le joueur ouvre une partie de milieu de jeu (manche 3, trois cartes en main, une mission) sur un écran de 1600×900
- **THEN** la section des missions et ses cartes sont entièrement visibles sans faire défiler le plateau

### Requirement: Retour sur deux lignes sur un écran étroit
Quand le plateau joueur est trop étroit pour Exploration et Observation côte à côte, elles SHALL passer l'une sous l'autre, dans le même ordre, sans chevauchement ni défilement horizontal du plateau.

#### Scenario: Écran de téléphone
- **WHEN** le joueur affiche son plateau sur un écran de 390 px de large
- **THEN** Exploration et Observation sont l'une sous l'autre et aucune section ne déborde du plateau
