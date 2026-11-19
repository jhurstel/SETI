## MODIFIED Requirements

### Requirement: Espèces et traces de vie
Toute découverte d'espèce SHALL passer par la même règle, qu'elle vienne d'une trace de vie ou d'un palier neutre, et produire l'annonce de découverte. La découverte SHALL se résoudre à la fin du tour où les 3 emplacements Découverte se remplissent, après tous les paliers de ce tour (règles, p. 20) : jusque-là, l'espèce reste face cachée. La première trace d'une couleur sur le triangle prend le bonus de découverte, les suivantes le bonus suivant. Les spécimens Mascamites restent face cachée sauf pour le joueur qui les a vus ; le contenu d'une capsule n'est visible que par son propriétaire.

#### Scenario: Découverte par palier neutre
- **WHEN** un palier neutre complète les traces d'une espèce
- **THEN** l'espèce est découverte à la fin de ce tour, avec sa mise en jeu propre et l'annonce de découverte

#### Scenario: Troisième trace posée pendant le tour
- **WHEN** un joueur pose la trace de vie qui occupe le dernier emplacement Découverte d'une espèce, puis continue son tour
- **THEN** l'espèce reste face cachée jusqu'à la fin du tour : ni sa mise en jeu, ni ses cartes Alien, ni sa piste ne sont disponibles pendant ce tour ; le bonus de l'emplacement Découverte est gagné aussitôt

#### Scenario: Paliers résolus avant la découverte
- **WHEN** le tour se termine alors qu'une espèce attend sa découverte et que le joueur a franchi un palier (objectif, palier neutre, palier Centaurien ou Exertien)
- **THEN** le palier est résolu d'abord, puis l'espèce est découverte, avant que le joueur suivant ne commence

#### Scenario: Deux espèces complétées dans le même tour
- **WHEN** les emplacements Découverte des deux espèces se remplissent pendant le même tour
- **THEN** les deux espèces sont découvertes à la fin de ce tour, dans l'ordre où leurs emplacements se sont remplis

#### Scenario: Capsule arrivée à destination
- **WHEN** une capsule de spécimen atteint la Terre (ou Mars pour la carte ET.4)
- **THEN** le joueur peut réclamer la mission en action gratuite : récompense de la carte et du spécimen, puis le spécimen rejoint la piste bleue

### Requirement: Cartes Exertiens
Les cartes Exertiens SHALL rester hors de la main : elles ne comptent pas dans la limite de cartes et ne peuvent être ni défaussées, ni réservées, ni jouées normalement ; chacune se joue face cachée à un palier Exertien, une fois par joueur et par palier (au 2e palier pour 1 crédit). À la découverte des Exertiens, à la fin du tour où elle a lieu, chaque joueur qui a des marqueurs de découverte peut en jouer une aussitôt par marqueur ; le joueur suivant ne commence qu'une fois ces choix faits.

#### Scenario: Deux marqueurs de découverte
- **WHEN** les Exertiens sont découverts et qu'un joueur a posé deux de leurs trois marqueurs de découverte
- **THEN** il peut jouer aussitôt jusqu'à deux cartes Exertiens, choisies dans la même fenêtre

#### Scenario: Choix à la fin du tour
- **WHEN** la troisième trace des Exertiens est posée pendant le tour d'un joueur
- **THEN** les cartes Exertiens ne sont distribuées et proposées qu'à la fin de ce tour, après ses paliers

#### Scenario: Défausse de fin de manche
- **WHEN** un joueur doit défausser jusqu'à la limite de cartes
- **THEN** ses cartes Exertiens ne sont ni comptées ni proposées

#### Scenario: Carte jouée cachée
- **WHEN** un joueur joue une carte Exertien
- **THEN** les adversaires n'en voient que le dos et le danger visible jusqu'au décompte final
