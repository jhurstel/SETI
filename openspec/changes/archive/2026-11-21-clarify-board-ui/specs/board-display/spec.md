# Spec Delta

## Purpose

Affichage des plateaux de jeu hors faces de cartes : état des actions principales du plateau joueur, panneaux repliables autour du système solaire et informations dessinées sur le système solaire, pour que le joueur voie ce qu'il peut faire et ce qu'il peut gagner sans ouvrir d'infobulle.

## ADDED Requirements

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
