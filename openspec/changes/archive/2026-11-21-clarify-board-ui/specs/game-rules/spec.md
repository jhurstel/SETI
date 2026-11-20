# Spec Delta

## ADDED Requirements

### Requirement: Disponibilité des actions principales
Le moteur SHALL dire, pour un joueur et chaque action principale, si elle est possible maintenant et sinon pourquoi, avec les mêmes vérifications et la même raison que le refus de la commande : partie terminée, tour d'un autre joueur, joueur qui a passé, action principale déjà faite, puis règle propre à l'action (coût, sonde au bon endroit, carte jouable, ligne d'ordinateur complète…).

#### Scenario: Disponibilité et commande concordent
- **WHEN** le moteur indique qu'une action principale est possible pour le joueur dont c'est le tour
- **THEN** la commande correspondante (avec une cible permise) est acceptée par la session

#### Scenario: Indisponibilité motivée
- **WHEN** le joueur n'a pas assez d'énergie pour analyser ses données
- **THEN** l'action « Analyser les données » est indiquée impossible, avec une raison en français affichable telle quelle, identique à celle du refus de la commande

#### Scenario: Raisons générales d'abord
- **WHEN** ce n'est pas le tour du joueur
- **THEN** toutes ses actions principales sont indiquées impossibles avec la raison « Ce n'est pas votre tour », quelle que soit la règle propre à chaque action

#### Scenario: Orbite et atterrissage sur l'une des sondes
- **WHEN** le joueur a deux sondes dans le système solaire, dont une seule sur une planète où il peut payer la mise en orbite
- **THEN** l'action « Mettre en orbite » est indiquée possible

#### Scenario: Partie reçue intacte
- **WHEN** le moteur calcule la disponibilité des actions principales
- **THEN** la partie reçue n'est pas modifiée
