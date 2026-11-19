# Spec Delta

## Purpose

Apprendre SETI à un joueur qui découvre le jeu de société : des chapitres courts, joués sur le vrai plateau, qui présentent l'interface et les règles une à une, puis les règles propres à chaque espèce Alien une fois rencontrée en partie, et renvoient vers la documentation pour le détail.

## ADDED Requirements

### Requirement: Chapitres des espèces
Le tutoriel SHALL proposer un chapitre par espèce Alien (Mascamites, Anomalies, Oumuamua, Centauriens, Exertiens). Chaque chapitre part d'une position reproductible où le joueur découvre lui-même l'espèce en posant la troisième trace de vie, puis pratique sa mécanique principale avant la fin du chapitre.

#### Scenario: Découverte jouée par le joueur
- **WHEN** le joueur démarre un chapitre d'espèce débloqué
- **THEN** deux emplacements de découverte de l'espèce sont déjà occupés, et l'étape suivante lui fait poser la troisième trace, ce qui découvre l'espèce

#### Scenario: Mécanique principale pratiquée
- **WHEN** le joueur suit les étapes du chapitre des Centauriens
- **THEN** il atteint son palier de message et choisit une tuile Message avant la fin du chapitre

#### Scenario: Chapitre terminé
- **WHEN** le joueur termine un chapitre d'espèce
- **THEN** le chapitre est marqué comme terminé, comme les autres chapitres

### Requirement: Déblocage des espèces
Une espèce SHALL être débloquée, dans ce navigateur, dès qu'elle est découverte dans une vraie partie, locale ou en ligne, quel que soit le joueur qui la découvre (robot compris). Une découverte faite dans un chapitre du tutoriel ne débloque rien. Le déblocage est retenu d'une session à l'autre.

#### Scenario: Découverte par un robot
- **WHEN** un robot découvre les Exertiens dans une partie locale
- **THEN** le chapitre des Exertiens est débloqué

#### Scenario: Partie en ligne
- **WHEN** une espèce est découverte dans une partie en ligne
- **THEN** elle est débloquée dans le navigateur de chaque joueur humain de la partie

#### Scenario: Découverte dans le tutoriel
- **WHEN** une espèce est découverte pendant un chapitre du tutoriel
- **THEN** aucune espèce n'est débloquée

#### Scenario: Partie reprise
- **WHEN** le joueur reprend une partie sauvegardée où une espèce était déjà découverte
- **THEN** cette espèce est débloquée

#### Scenario: Stockage indisponible
- **WHEN** le navigateur ne permet pas d'enregistrer la progression
- **THEN** le jeu reste jouable, et les espèces découvertes ne sont pas retenues

### Requirement: Chapitres verrouillés dans le menu
Le menu du tutoriel SHALL afficher un chapitre d'espèce non débloquée comme verrouillé, sans nommer l'espèce ni résumer ses règles, avec l'explication de son déblocage ; un chapitre verrouillé ne peut pas être démarré.

#### Scenario: Chapitre verrouillé
- **WHEN** le joueur ouvre le menu sans avoir rencontré les Mascamites
- **THEN** le chapitre correspondant apparaît comme « Espèce inconnue », avec un cadenas et la mention qu'il se débloque en découvrant une espèce en partie, et un clic ne le démarre pas

#### Scenario: Chapitre débloqué
- **WHEN** le joueur a rencontré les Mascamites en partie et ouvre le menu
- **THEN** le chapitre « Mascamites » apparaît avec son titre et son résumé, et peut être démarré

### Requirement: Annonce d'un déblocage
Quand une espèce est débloquée pour la première fois pendant une partie, le jeu SHALL le signaler au joueur en nommant le nouveau chapitre du tutoriel, sans interrompre la partie.

#### Scenario: Première rencontre
- **WHEN** les Anomalies sont découvertes pour la première fois dans une partie de ce navigateur
- **THEN** un message signale qu'un nouveau chapitre du tutoriel, « Anomalies », est disponible

#### Scenario: Espèce déjà débloquée
- **WHEN** les Anomalies sont découvertes dans une autre partie, plus tard
- **THEN** aucun message de déblocage n'apparaît

### Requirement: Règles des espèces masquées dans la documentation
La documentation SHALL masquer la section de règles de chaque espèce non débloquée : à sa place, un encart sans le nom de l'espèce indique qu'elle se dévoile en la découvrant en partie. Les règles générales de découverte restent visibles.

#### Scenario: Espèce non débloquée
- **WHEN** le joueur ouvre la documentation sans avoir rencontré les Centauriens
- **THEN** ni le nom ni les règles des Centauriens n'apparaissent dans la partie « Les espèces Alien », remplacés par l'encart

#### Scenario: Espèce débloquée
- **WHEN** le joueur a rencontré les Centauriens en partie et ouvre la documentation
- **THEN** la section des Centauriens est affichée en entier

#### Scenario: Lien vers une section masquée
- **WHEN** un lien « En savoir plus » vise la section d'une espèce non débloquée
- **THEN** la documentation s'ouvre sur l'encart de la partie « Les espèces Alien », sans dévoiler l'espèce

### Requirement: Chapitre « Traces de vie et espèces » sans révélation
Le chapitre « Traces de vie et espèces » SHALL enseigner la découverte sans dévoiler une espèce que le joueur n'a pas débloquée : l'espèce découverte reste anonyme à l'écran (annonce, plateau, pistes, cartes Alien, historique, éléments posés sur le système solaire). Si le joueur a déjà débloqué une espèce, le chapitre utilise celle-ci, affichée normalement.

#### Scenario: Joueur qui n'a rencontré aucune espèce
- **WHEN** le joueur termine le chapitre sans avoir débloqué d'espèce
- **THEN** l'annonce dit qu'une nouvelle espèce est découverte sans la nommer, le plateau s'intitule « Espèce découverte » sans pistes ni cartes lisibles, et aucune espèce n'est débloquée

#### Scenario: Cartes Alien gagnées à la découverte
- **WHEN** la découverte donne au joueur une carte Alien de l'espèce masquée
- **THEN** la carte apparaît dans sa main face cachée (« Carte Alien »), sans nom, texte ni infobulle de contenu, et l'historique écrit « une carte Alien » à la place de son nom

#### Scenario: Espèce déjà débloquée
- **WHEN** le joueur a débloqué les Mascamites et démarre le chapitre
- **THEN** le chapitre fait découvrir les Mascamites, affichées normalement
