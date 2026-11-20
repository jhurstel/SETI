# Spec Delta

## Purpose

Garder le jeu utilisable quand une erreur survient et permettre au joueur d'envoyer au développeur un rapport qui suffit à reproduire le problème.

## ADDED Requirements

### Requirement: Écran d'erreur
Quand l'affichage du jeu échoue, le jeu SHALL montrer un écran d'erreur lisible, à la place d'une page blanche, qui propose de recharger, de revenir à l'accueil et de signaler le problème. La partie solo sauvegardée automatiquement et la place en ligne SHALL être conservées.

#### Scenario: Erreur pendant l'affichage d'une partie solo
- **WHEN** une erreur survient pendant l'affichage d'une partie solo en cours
- **THEN** un écran d'erreur s'affiche avec les choix « Recharger », « Accueil » et « Signaler le problème »
- **AND** après « Recharger », « Continuer » sur l'écran d'accueil reprend la partie là où l'autosauvegarde l'avait laissée

#### Scenario: Erreur pendant une partie en ligne
- **WHEN** une erreur d'affichage survient pendant une partie en ligne
- **THEN** après « Recharger », le joueur reprend sa place dans la salle sans ressaisir le code

### Requirement: Erreurs non bloquantes
Une erreur survenue hors de l'affichage (action du joueur, tâche de fond, promesse rejetée) SHALL être retenue dans un journal des erreurs de la page et signalée par un message discret qui propose de signaler le problème, sans interrompre la partie.

#### Scenario: Erreur pendant une action
- **WHEN** une erreur non traitée survient pendant que le joueur joue
- **THEN** un message discret « Un problème est survenu » s'affiche avec un lien « Signaler »
- **AND** la partie reste affichée et jouable

#### Scenario: Erreurs répétées
- **WHEN** la même erreur survient plusieurs fois de suite
- **THEN** un seul message est affiché à la fois et le journal garde au plus les 20 dernières erreurs

### Requirement: Signaler un problème
Le joueur SHALL pouvoir signaler un problème depuis l'écran d'accueil, l'écran d'erreur et le message d'erreur : il peut décrire le problème en quelques mots, puis télécharge un fichier de rapport à transmettre lui-même. Le rapport SHALL fonctionner sans partie en cours.

#### Scenario: Signalement depuis l'accueil
- **WHEN** le joueur choisit « Signaler un problème » sur l'écran d'accueil, écrit un commentaire et valide
- **THEN** un fichier de rapport JSON nommé avec la date est téléchargé
- **AND** un message lui indique de l'envoyer au développeur

#### Scenario: Aucune partie
- **WHEN** le joueur signale un problème sans partie en cours ni autosauvegarde
- **THEN** le rapport est produit avec la version, l'environnement, le commentaire et le journal des erreurs

### Requirement: Contenu du rapport
Le rapport SHALL contenir la version du jeu, la date, le navigateur et la taille de l'écran, le mode (solo, tutoriel, en ligne), le commentaire du joueur et le journal des erreurs. En solo et dans le tutoriel, il SHALL contenir la graine et la sauvegarde complète de la partie, rechargeable par « Charger ». En ligne, il SHALL contenir le code de la salle, la place du joueur, sa vue de la partie et son historique.

#### Scenario: Rapport d'une partie solo
- **WHEN** le joueur signale un problème pendant une partie solo
- **THEN** la sauvegarde contenue dans le rapport, extraite dans un fichier, se recharge par « Charger » à l'état de la partie au moment du signalement

#### Scenario: Rapport depuis l'écran d'erreur
- **WHEN** le joueur signale le problème depuis l'écran d'erreur
- **THEN** le rapport contient l'erreur qui a provoqué l'écran et la dernière autosauvegarde de la partie

### Requirement: Confidentialité du rapport
Le rapport SHALL ne jamais contenir le jeton de place en ligne ni aucune donnée que le joueur ne voit pas déjà (mains adverses et pioches en ligne restent masquées comme dans sa vue). Il SHALL n'être envoyé nulle part automatiquement.

#### Scenario: Rapport d'une partie en ligne
- **WHEN** le joueur signale un problème pendant une partie en ligne
- **THEN** le rapport contient le code de la salle mais pas le jeton de sa place
- **AND** aucune requête réseau n'est faite pour produire le rapport
