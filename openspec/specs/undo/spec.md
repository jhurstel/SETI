# undo Specification

## Purpose
Annulation des actions d'un joueur humain, en jeu local comme en ligne : ce que rendent « Annuler la dernière action » et « Revenir au début du tour », ce qui n'est jamais annulable et ce que l'interface en montre.

## Requirements

### Requirement: Annuler la dernière action
« Annuler la dernière action » SHALL ramener la partie à l'état d'avant la dernière commande du joueur, avec toute la séquence de l'action à laquelle elle appartient (l'action et ses conséquences, en plusieurs commandes s'il le faut), et rien d'antérieur. Une commande qui n'a rien écrit dans l'historique (ouverture d'un achat ou d'un choix) est une commande comme une autre.

#### Scenario: Achat ouvert puis annulé
- **WHEN** le joueur lance une sonde, ouvre un achat de carte sans encore choisir, puis annule sa dernière action
- **THEN** la fenêtre d'achat disparaît et la sonde lancée reste en jeu

#### Scenario: Action en plusieurs commandes
- **WHEN** le joueur échange 2 crédits contre une carte, choisit la carte, puis annule sa dernière action
- **THEN** la partie revient à l'état d'avant l'échange (crédits rendus, carte retirée)

### Requirement: Revenir au début du tour
« Revenir au début du tour » SHALL rétablir l'état d'avant la première action du dernier tour du joueur. En jeu local, juste après le tour des robots et avant d'avoir rejoué, il ramène au début du tour que le joueur vient de finir et annule le tour des robots ; il ne remonte jamais avant le début de l'avant-dernier tour du joueur.

#### Scenario: Après le tour des robots
- **WHEN** en jeu local, le joueur finit son tour, les robots jouent, puis il revient au début du tour sans avoir rejoué
- **THEN** la partie revient avant la première action de son tour précédent et les actions des robots sont effacées

### Requirement: Pas d'annulation pendant le tour d'un robot
Pendant qu'un robot joue en jeu local, « Annuler la dernière action » SHALL ne pas être proposé : une étape de robot annulée serait rejouée à l'identique. « Revenir au début du tour » reste proposé.

#### Scenario: Robot en train de jouer
- **WHEN** un robot a joué au moins une étape de son tour et n'a pas fini
- **THEN** le bouton « Annuler la dernière action » n'apparaît pas, celui du retour au début du tour oui

### Requirement: Barrière d'information en ligne
En ligne, une commande qui fait connaître à un joueur une information jusque-là cachée pour lui SHALL ne pas être annulable, ni aucune commande antérieure du même tour ; les commandes suivantes restent annulables. Cela vaut quelle que soit la commande : carte venue de la pioche (main, rangée, cartes Alien ou d'espèce), pile de fin de manche, spécimen regardé, espèce découverte, tirage au hasard.

#### Scenario: Carte piochée face cachée
- **WHEN** en ligne, le joueur échange 2 crédits contre la carte du dessus de la pioche
- **THEN** l'annulation de cette action et des précédentes est refusée

#### Scenario: Carte révélée dans la rangée
- **WHEN** en ligne, le joueur achète une carte de la rangée et la carte qui la remplace devient visible de tous
- **THEN** l'achat ne s'annule plus

#### Scenario: Passe et pile de fin de manche
- **WHEN** en ligne, le joueur passe et découvre la pile de fin de manche pour y choisir sa carte
- **THEN** la passe ne s'annule plus

#### Scenario: Action annulable après une révélation
- **WHEN** en ligne, après avoir pioché une carte, le joueur échange des crédits contre de l'énergie
- **THEN** il peut annuler l'échange, mais pas la pioche

#### Scenario: Commande sans révélation
- **WHEN** en ligne, le joueur lance une sonde sans que personne n'apprenne rien de caché
- **THEN** il peut annuler le lancement

### Requirement: Hasard rejoué à l'identique
L'annulation SHALL rétablir l'état du hasard avec la partie : une commande annulée puis rejouée à l'identique donne le même résultat.

#### Scenario: Pioche rejouée
- **WHEN** en jeu local, le joueur pioche une carte, annule, puis pioche de nouveau
- **THEN** il reçoit la même carte

### Requirement: Réglage « Annulation stricte » en jeu local
Une nouvelle partie locale SHALL proposer le réglage « Annulation stricte », désactivé par défaut, gardé par la partie (sauvegarde comprise) et non modifiable en cours de partie. Désactivé, une révélation ne bloque pas l'annulation. Le tutoriel joue toujours sans annulation stricte.

#### Scenario: Passe annulée sans annulation stricte
- **WHEN** en jeu local sans annulation stricte, le joueur passe, découvre la pile de fin de manche, puis annule
- **THEN** la partie revient avant la passe

#### Scenario: Ancienne sauvegarde
- **WHEN** le joueur reprend une partie enregistrée avant l'existence du réglage
- **THEN** elle se joue sans annulation stricte

### Requirement: Barrière d'information en jeu local strict
Avec l'annulation stricte, une commande du joueur humain qui lui fait connaître une information cachée, ou une étape de robot qui lui montre une carte jusque-là cachée, SHALL ne pas être annulable, et ni « Annuler » ni « Revenir au début du tour » ne SHALL ramener la partie avant elle. Le hasard consommé par un robot pour décider n'est pas une révélation.

#### Scenario: Pioche en annulation stricte
- **WHEN** en jeu local strict, le joueur pioche une carte face cachée puis demande l'annulation
- **THEN** l'annulation est refusée avec sa raison

#### Scenario: Carte montrée par un robot
- **WHEN** en jeu local strict, un robot achète une carte de la rangée et la carte qui la remplace devient visible
- **THEN** le retour au début du tour précédent du joueur n'est plus proposé

#### Scenario: Tour d'un robot sans révélation
- **WHEN** en jeu local strict, les robots jouent sans montrer de carte cachée au joueur
- **THEN** le joueur peut encore revenir au début du tour qu'il vient de finir

### Requirement: Annulation après un rechargement
En jeu local, après un rechargement de la page, la sauvegarde automatique SHALL permettre encore d'annuler au moins les 8 dernières commandes annulables et de revenir au début du dernier tour du joueur.

#### Scenario: Rechargement en cours de tour
- **WHEN** le joueur lance une sonde, fait un échange, puis recharge la page
- **THEN** il peut annuler l'échange, puis revenir au début de son tour

### Requirement: Raison d'un refus visible
Quand une action ne peut plus être annulée à cause d'une révélation, l'interface SHALL le dire (infobulle de l'historique ou message), au lieu de seulement masquer le bouton.

#### Scenario: Survol de l'historique après une pioche
- **WHEN** en ligne, ou en jeu local strict, le joueur vient de piocher une carte face cachée
- **THEN** l'historique indique que l'action n'est plus annulable parce qu'une information cachée a été révélée
