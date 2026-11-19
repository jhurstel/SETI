## ADDED Requirements

### Requirement: Annonces de découverte en deux temps
Le jeu SHALL annoncer une découverte en deux temps : une annonce générique, sans nom d'espèce, au moment où le dernier emplacement Découverte est occupé ; puis, à la fin du tour, une annonce qui nomme l'espèce révélée et les joueurs qui l'ont découverte.

#### Scenario: Troisième trace posée
- **WHEN** un joueur pose la troisième trace de vie d'une espèce pendant son tour
- **THEN** l'annonce « Découverte d'une nouvelle espèce Alien ! » s'affiche sans nommer l'espèce

#### Scenario: Fin du tour
- **WHEN** ce tour se termine et que ses paliers sont résolus
- **THEN** une seconde annonce nomme l'espèce révélée et les joueurs qui l'ont découverte

#### Scenario: Découverte pendant le tour d'un robot
- **WHEN** un robot complète les emplacements Découverte d'une espèce pendant son tour
- **THEN** les deux annonces s'affichent aussi, la seconde à la fin du tour du robot

### Requirement: Chapitre proposé à la découverte
Quand l'annonce de fin de tour révèle une espèce débloquée pour la première fois dans ce navigateur, elle SHALL proposer d'ouvrir le chapitre du tutoriel de cette espèce. La proposition suit les conditions de déblocage : jamais dans un chapitre du tutoriel, ni pour une espèce déjà débloquée. Accepter ouvre le chapitre ; la partie en cours reste sauvegardée et « Continuer » la reprend.

#### Scenario: Première découverte en partie locale
- **WHEN** les Anomalies sont révélées à la fin d'un tour, pour la première fois dans ce navigateur, dans une partie locale
- **THEN** l'annonce propose d'ouvrir le chapitre « Anomalies », et le joueur peut l'ignorer pour continuer la partie

#### Scenario: Chapitre ouvert puis partie reprise
- **WHEN** le joueur accepte la proposition, joue le chapitre puis revient à l'accueil
- **THEN** « Continuer » reprend la partie au début du tour du joueur suivant, l'espèce révélée

#### Scenario: Espèce déjà débloquée
- **WHEN** une espèce déjà débloquée est révélée dans une autre partie
- **THEN** l'annonce de fin de tour ne propose pas de chapitre

#### Scenario: Partie en ligne
- **WHEN** une espèce est révélée pour la première fois pendant une partie en ligne
- **THEN** l'annonce signale le nouveau chapitre sans proposer de l'ouvrir, car quitter la partie abandonnerait la salle

### Requirement: Découverte en fin de tour dans les chapitres
Les chapitres où le joueur découvre une espèce (les cinq chapitres d'espèce et « Traces de vie et espèces ») SHALL suivre la règle de la découverte en fin de tour : une étape pose la troisième trace, une étape termine le tour, puis l'espèce révélée est présentée avant la suite du chapitre.

#### Scenario: Chapitre d'espèce
- **WHEN** le joueur pose la troisième trace dans un chapitre d'espèce
- **THEN** l'étape suivante lui fait terminer son tour, et l'espèce n'est présentée qu'une fois révélée

#### Scenario: Chapitre des Exertiens
- **WHEN** le joueur termine le tour où il a posé la troisième trace des Exertiens
- **THEN** le choix des cartes Exertiens s'ouvre à ce moment, et l'étape qui le présente s'affiche pendant ce choix

#### Scenario: Solutions des chapitres
- **WHEN** la solution d'un de ces chapitres est jouée de bout en bout
- **THEN** le chapitre se termine, la découverte ayant eu lieu à la fin du tour
