# Spec Delta

## MODIFIED Requirements

### Requirement: Annulation en ligne
Un joueur SHALL pouvoir annuler ses propres commandes de son tour en cours tant que personne d'autre n'a joué ; la commande d'un autre joueur, une étape de robot ou la fin du tour effacent les points d'annulation. Une commande qui révèle une information cachée SHALL ne plus pouvoir être annulée, ni celles d'avant (barrière d'information de la capacité `undo`).

#### Scenario: Annulation après l'action d'un robot
- **WHEN** un robot a joué depuis la dernière commande du joueur
- **THEN** l'annulation est refusée

#### Scenario: Annulation après une pioche
- **WHEN** le joueur a pioché une carte face cachée pendant son tour
- **THEN** le serveur refuse d'annuler cette pioche et les commandes d'avant, et la vue du joueur ne propose plus ces annulations
