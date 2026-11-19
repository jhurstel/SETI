# robots Specification

## Purpose
Joueurs robots : niveaux de difficulté, façon de choisir leurs actions avec les règles du moteur, information à laquelle ils ont droit, rythme de jeu et réglage de leur évaluation par des parties entre robots.

## Requirements

### Requirement: Mêmes règles que le joueur humain
Un robot SHALL jouer par les mêmes opérations du moteur que le joueur humain (actions, actions gratuites, choix sur les interactions) ; aucune règle n'est recopiée dans le code des robots.

#### Scenario: Interaction résolue par un robot
- **WHEN** une interaction à choix est destinée à un robot
- **THEN** elle est résolue par la même opération que le clic d'un humain, avec le choix issu de la simulation du robot

#### Scenario: Toute interaction est gérée
- **WHEN** une nouvelle interaction est ajoutée au moteur
- **THEN** le compilateur et le test du catalogue exigent sa prise en charge par les robots

### Requirement: Niveaux de difficulté
Les niveaux Débutant, Avancé et Expert SHALL partager la même évaluation et la même simulation ; seuls diffèrent leur hésitation (température : Expert 0, Avancé 2, Débutant 12 points d'évaluation, jamais au-delà de 3 températures de la meilleure option) et, pour l'Expert, l'anticipation par suites jouées. Un niveau de test (PASS) joue des actions gratuites au hasard puis passe. Cibles : l'Expert gagne environ 2 parties sur 3 contre l'Avancé, l'Avancé environ 3 sur 4 contre le Débutant.

#### Scenario: Robot Expert sans bruit
- **WHEN** un Expert a plusieurs actions évaluées
- **THEN** il choisit toujours la mieux notée (après départage de ses 3 meilleures actions principales par 4 suites jouées)

#### Scenario: Passer
- **WHEN** aucune action n'améliore la position du robot
- **THEN** le robot passe

### Requirement: Évaluation d'une position
Un robot SHALL noter une position par les PV, les ressources et le potentiel pondérés selon les manches restantes, plus les points du décompte final déjà acquis, avec des poids qui dépendent du nombre de joueurs.

#### Scenario: Dernière manche
- **WHEN** la partie est à sa dernière manche
- **THEN** les points du décompte final comptent pleinement dans l'évaluation

### Requirement: Information cachée
Un robot SHALL ne jamais lire une information cachée à son joueur : mains adverses, pioche, piles de fin de manche et cartes Exertiens jouées sont redistribuées de son point de vue avant ses simulations, et il ne prévoit jamais de jouer une carte qu'il ne connaissait pas avant de la piocher face cachée.

#### Scenario: Échange contre la pioche
- **WHEN** le robot prépare une action en échangeant contre une carte de la pioche
- **THEN** son plan ne suppose pas qu'il jouera la carte piochée

### Requirement: Déterminisme et rythme
Le calcul d'une étape de robot SHALL partir de l'état du générateur aléatoire de la partie et le rendre avec l'étape, qu'il soit fait sur place, dans un Web Worker ou dans un fil du serveur ; une étape est jouée toutes les 1,5 s environ et le robot attend tant qu'une interaction attend un humain.

#### Scenario: Calcul déporté
- **WHEN** une même étape est calculée dans un fil séparé puis appliquée
- **THEN** la partie obtenue est identique à celle d'un calcul sur place

#### Scenario: Humain sollicité pendant le tour d'un robot
- **WHEN** l'action d'un robot crée une interaction destinée à un humain
- **THEN** le robot attend que l'humain y réponde avant de continuer

### Requirement: Réglage et mesure
Les poids de l'évaluation SHALL être réglés et validés par des parties entre robots en miroir (mêmes graines, sièges échangés), un réglage par nombre de joueurs ; un changement n'est appliqué que si sa validation à graines neuves montre un gain, et une optimisation de performance ne doit pas changer l'empreinte des résultats du banc.

#### Scenario: Optimisation de vitesse
- **WHEN** une optimisation du moteur ou des robots est mesurée au banc de performance
- **THEN** l'empreinte des parties à graines fixes est inchangée

### Requirement: Adversaire passif du tutoriel
Un niveau d'adversaire passif, réservé au tutoriel et absent du choix des niveaux d'une nouvelle partie, SHALL passer à chacun de ses tours sans action gratuite et sans tirer au hasard ; il passe par la même opération que le joueur humain.

#### Scenario: Tour de l'adversaire passif
- **WHEN** c'est au tour d'un adversaire passif
- **THEN** il passe, garde au plus 4 cartes comme tout joueur qui passe, et ne fait rien d'autre

#### Scenario: Partie reproductible
- **WHEN** une même position est jouée deux fois avec un adversaire passif
- **THEN** ses tours donnent la même partie les deux fois, quels que soient les poids des robots

#### Scenario: Nouvelle partie
- **WHEN** le joueur choisit les niveaux des robots d'une nouvelle partie ou d'une salle en ligne
- **THEN** l'adversaire passif ne figure pas parmi les niveaux proposés
