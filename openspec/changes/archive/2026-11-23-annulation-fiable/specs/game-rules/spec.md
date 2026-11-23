# Spec Delta

## MODIFIED Requirements

### Requirement: Historique et annulation
Chaque commande SHALL produire des entrées d'historique en français regroupées par action (l'action puis ses conséquences) ; un texte qui nomme une carte cachée SHALL n'être lisible que par son propriétaire. Un joueur humain SHALL pouvoir annuler sa dernière action ou son tour en jeu local, jusqu'au début de son avant-dernier tour, comme le décrit la capacité `undo`.

#### Scenario: Carte piochée par un adversaire
- **WHEN** un robot ou un adversaire pioche une carte face cachée
- **THEN** l'historique affiché aux autres joueurs mentionne la pioche sans nommer la carte

#### Scenario: Annuler le tour
- **WHEN** le joueur humain annule son tour en jeu local
- **THEN** la partie revient au début de ce tour, file d'interactions comprise
