## ADDED Requirements

### Requirement: Mode annulation sur une impasse
Dans un chapitre à position préparée, dès que la partie ne permet plus de terminer le chapitre, le tutoriel SHALL passer en mode annulation, quelle que soit l'étape en cours : la bulle nomme la cause et demande d'annuler, l'historique est mis en avant, et le chapitre MUST reprendre à l'étape qui correspond à la partie une fois l'impasse levée.

#### Scenario: Énergie dépensée loin de l'objectif
- **WHEN** dans le chapitre « Sondes », le joueur éloigne sa sonde de Mars jusqu'à ne plus avoir assez d'énergie pour la rejoindre et s'y mettre en orbite
- **THEN** la bulle explique que la sonde ne peut plus atteindre Mars et demande d'annuler les déplacements

#### Scenario: Erreur annulée
- **WHEN** le joueur annule l'action qui avait créé l'impasse
- **THEN** la bulle du mode annulation disparaît et l'étape affichée correspond de nouveau à la partie

#### Scenario: Impasse avant l'étape qui la concerne
- **WHEN** le joueur dépense ses médias à acheter une carte alors que l'étape suivante demande une recherche de technologie (6 médias)
- **THEN** le tutoriel passe en mode annulation sans attendre que l'étape de la recherche s'affiche

### Requirement: Erreur toujours annulable
En mode annulation, les actions principales et la fin du tour SHALL être désactivées, avec la cause dans leur infobulle, pour que l'erreur reste dans la partie du tour que l'historique permet d'annuler ; l'annulation, les infobulles, la documentation et l'affichage des autres plateaux MUST rester disponibles.

#### Scenario: Fin du tour refusée
- **WHEN** le tutoriel est en mode annulation et le joueur survole « Fin du tour »
- **THEN** le bouton est désactivé et son infobulle demande d'annuler l'erreur signalée

### Requirement: Recommencer le chapitre
En mode annulation, la bulle SHALL proposer de recommencer le chapitre depuis sa position de départ ; quand l'historique ne permet plus d'annuler, ce choix MUST être mis en avant comme la seule issue.

#### Scenario: Annulation impossible
- **WHEN** le chapitre est en mode annulation et l'historique n'a plus d'action annulable
- **THEN** la bulle propose « Recommencer le chapitre », qui remet la position de départ du chapitre à sa première étape

#### Scenario: Recommencer plutôt qu'annuler
- **WHEN** le joueur choisit « Recommencer le chapitre » alors qu'il pouvait encore annuler
- **THEN** le chapitre reprend à sa position de départ, sans être marqué comme terminé

### Requirement: Impasses couvertes dans chaque chapitre
Chaque chapitre à position préparée SHALL, après n'importe quel écart du joueur permis par l'étape en cours (action gratuite, action permise avec une autre carte, autre réponse à un choix), soit rester terminable, soit passer en mode annulation ; les tests du projet MUST le vérifier pour les écarts d'un coup depuis chaque étape de chaque chapitre.

#### Scenario: Trace bleue posée ailleurs
- **WHEN** dans un chapitre où le joueur découvre une espèce, il pose la trace bleue de son analyse sur l'autre plateau Alien
- **THEN** le tutoriel passe en mode annulation et explique que l'espèce à découvrir ne le sera pas

#### Scenario: Signal envoyé dans un autre secteur
- **WHEN** dans le chapitre « Oumuamua », le joueur scanne avec la carte prévue mais pose son signal hors du secteur d'Oumuamua
- **THEN** le tutoriel passe en mode annulation

#### Scenario: Carte du chapitre perdue
- **WHEN** dans le chapitre « Cartes et missions », le joueur défausse le Télescope Lovell pour son action gratuite
- **THEN** le tutoriel passe en mode annulation, avant la fin du tour

#### Scenario: Mauvaise carte jouée
- **WHEN** dans le chapitre « Cartes et missions », le joueur essaie de jouer une autre carte que celle que l'étape demande
- **THEN** le jeu refuse la carte en indiquant de jouer la carte de l'étape, et l'action principale du tour n'est pas gâchée

#### Scenario: Trace rouge mal placée
- **WHEN** dans le chapitre « Centauriens », le joueur pose la trace rouge ailleurs que sur l'emplacement de la piste qui fait franchir le palier de message
- **THEN** le tutoriel passe en mode annulation

#### Scenario: Ressource dépensée
- **WHEN** le joueur dépense par une action gratuite la ressource (énergie, médias, crédits, données) dont une étape restante du chapitre a besoin
- **THEN** le tutoriel passe en mode annulation

#### Scenario: Nouvelle impasse non détectée
- **WHEN** une modification d'un chapitre crée un écart d'un coup qui rend le chapitre impossible à terminer sans passer en mode annulation
- **THEN** les tests du projet échouent en nommant le chapitre, l'étape et l'écart
