# online-play Specification

## Purpose
Jeu à distance : salles tenues par un serveur WebSocket, places humaines et robots, vues filtrées par joueur, client avec accusés de réception et reconnexion, limites et purge des salles. Le jeu local n'utilise pas le serveur.

## Requirements

### Requirement: Salles et places
Le serveur SHALL créer des salles avec des places humaines et robots, tirer le premier joueur au hasard (ou accepter celui demandé à la création), donner à chaque humain un jeton de place et lister les salles ouvertes aux origines autorisées.

#### Scenario: Rejoindre une salle
- **WHEN** un joueur rejoint une place libre d'une salle en attente
- **THEN** il reçoit un jeton qui lui permet de reprendre cette place après une déconnexion

### Requirement: Commandes par la session de jeu
Une salle SHALL appliquer les commandes des joueurs par la même session que le jeu local et faire jouer ses robots au même rythme (environ 1,5 s par étape), une seule étape en calcul à la fois par salle ; une étape dont la partie a changé pendant le calcul est abandonnée puis recalculée.

#### Scenario: Commande d'un autre joueur pendant un calcul de robot
- **WHEN** la partie change pendant le calcul d'une étape de robot
- **THEN** l'étape calculée n'est pas appliquée et une nouvelle étape est calculée

#### Scenario: Fil de calcul en panne
- **WHEN** le fil qui calcule les robots tombe
- **THEN** il est remplacé et l'étape est calculée sur place

### Requirement: Vue propre à chaque joueur
Le serveur SHALL n'envoyer à un joueur que ce qu'il a le droit de voir : pioches, mains adverses, piles de fin de manche non encore ouvertes, spécimens non vus, cartes Exertiens jouées et leur danger, noms des cartes piochées par les autres dans l'historique.

#### Scenario: Main adverse
- **WHEN** le serveur envoie l'état de la partie au joueur A
- **THEN** les cartes en main des autres joueurs y sont masquées

### Requirement: Client fiable
Le client SHALL attendre l'accusé de réception de chaque commande, se reconnecter automatiquement avec son jeton, détecter une connexion muette par un battement de cœur et se reconnecter aussitôt au retour du réseau ou de la page ; une place perdue est oubliée.

#### Scenario: Coupure réseau
- **WHEN** la connexion est coupée puis revient
- **THEN** le client reprend sa place sans action du joueur et reçoit l'état courant

### Requirement: Annulation en ligne
Un joueur SHALL pouvoir annuler ses propres commandes de son tour en cours tant que personne d'autre n'a joué ; la commande d'un autre joueur, une étape de robot ou la fin du tour effacent les points d'annulation.

#### Scenario: Annulation après l'action d'un robot
- **WHEN** un robot a joué depuis la dernière commande du joueur
- **THEN** l'annulation est refusée

### Requirement: Compatibilité des versions
Le serveur SHALL refuser un client d'une autre version mineure du jeu.

#### Scenario: Client obsolète
- **WHEN** un client de version 1.1 demande à créer, rejoindre ou reprendre une salle sur un serveur 1.2
- **THEN** la demande est refusée avec un message qui indique les deux versions

### Requirement: Limites et purge
Le serveur SHALL limiter le nombre de salles (200) et les créations par adresse IP (5 en 10 minutes), et purger au démarrage puis toutes les heures les salles inactives (terminée 6 h, salon 24 h, en cours 7 jours), jamais une salle où un joueur est connecté.

#### Scenario: Trop de créations
- **WHEN** une même adresse IP crée une 6e salle en moins de 10 minutes
- **THEN** la création est refusée

#### Scenario: Salle abandonnée
- **WHEN** une partie en cours n'a reçu aucune activité depuis plus de 7 jours et qu'aucun joueur n'y est connecté
- **THEN** elle est supprimée de la mémoire et du disque
