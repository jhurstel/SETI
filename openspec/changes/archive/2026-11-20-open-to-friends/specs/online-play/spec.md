# Spec Delta

## ADDED Requirements

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
