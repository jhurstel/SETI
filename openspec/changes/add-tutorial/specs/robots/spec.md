# Spec Delta

## ADDED Requirements

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
