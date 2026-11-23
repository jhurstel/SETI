# Spec Delta

## ADDED Requirements

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
