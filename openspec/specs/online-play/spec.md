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

### Requirement: Protection contre les abus
L'adresse IP du client SHALL être celle ajoutée par le proxy de l'hébergeur (dernière valeur de `X-Forwarded-For` ou en-tête configuré), jamais une valeur choisie par le client. Le serveur SHALL limiter les connexions simultanées par adresse (20) et le débit de messages par connexion (40 d'affilée, 10 par seconde).

#### Scenario: Adresse falsifiée
- **WHEN** un client envoie un `X-Forwarded-For` qui commence par une autre adresse
- **THEN** la limite de création s'applique à l'adresse ajoutée par le proxy

#### Scenario: Trop de messages
- **WHEN** une connexion envoie plus de messages que le débit permis
- **THEN** elle est fermée

### Requirement: Serveur gardé éveillé
Une tâche planifiée gratuite SHALL appeler le contrôle de santé du serveur hébergé environ toutes les 10 minutes, pour qu'il ne s'endorme pas faute de trafic ; elle SHALL pouvoir être lancée à la main et ne SHALL pas faire échouer l'intégration continue du jeu.

#### Scenario: Aucun joueur depuis une heure
- **WHEN** personne n'a joué en ligne depuis une heure
- **THEN** le serveur répond au contrôle de santé en moins de quelques secondes

#### Scenario: Serveur injoignable
- **WHEN** le contrôle de santé échoue
- **THEN** l'exécution de la tâche planifiée est marquée en échec, sans effet sur la CI du dépôt

### Requirement: Pré-réveil depuis l'accueil
Quand le jeu en ligne est configuré, le client SHALL appeler le contrôle de santé du serveur une fois à l'ouverture du jeu, en tâche de fond, sans bloquer l'accueil ni afficher d'erreur si le serveur ne répond pas.

#### Scenario: Ouverture du jeu avec un serveur endormi
- **WHEN** un joueur ouvre le jeu alors que le serveur dort
- **THEN** le réveil du serveur commence aussitôt, avant que le joueur ouvre « Partie en ligne »

#### Scenario: Jeu en ligne non configuré
- **WHEN** aucune adresse de serveur n'est configurée
- **THEN** aucune requête n'est faite

### Requirement: Attente du réveil affichée
Tant que le serveur ne répond pas, la fenêtre « Partie en ligne » SHALL indiquer qu'il se réveille, avec le temps d'attente écoulé, dans l'onglet Rejoindre comme pendant la connexion ; elle SHALL n'annoncer le serveur injoignable qu'après environ deux minutes sans réponse.

#### Scenario: Onglet Rejoindre pendant le réveil
- **WHEN** le joueur ouvre l'onglet Rejoindre et que la liste des salles ne répond pas encore
- **THEN** il lit « Réveil du serveur… » suivi du nombre de secondes écoulées, et la liste apparaît dès que le serveur répond

#### Scenario: Serveur hors service
- **WHEN** le serveur ne répond toujours pas après environ deux minutes
- **THEN** la fenêtre annonce que le serveur est injoignable et invite à réessayer plus tard
