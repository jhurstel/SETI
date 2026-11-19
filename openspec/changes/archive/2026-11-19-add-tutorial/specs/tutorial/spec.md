# Spec Delta

## Purpose

Apprendre SETI à un joueur qui découvre le jeu de société : des chapitres courts, joués sur le vrai plateau, qui présentent l'interface et les règles une à une et renvoient vers la documentation pour le détail.

## ADDED Requirements

### Requirement: Chapitres du tutoriel
Le tutoriel SHALL proposer des chapitres indépendants, jouables dans n'importe quel ordre : l'écran et le tour, sondes, atterrir et Médias, scanner, ordinateur et analyse, cartes et missions, technologies, traces de vie et espèces, passer et fin de manche, paliers et fin de partie, puis « Première vraie partie ».

#### Scenario: Choix d'un chapitre
- **WHEN** le joueur ouvre le menu du tutoriel et choisit un chapitre
- **THEN** ce chapitre démarre, quels que soient les chapitres déjà faits

#### Scenario: Quitter un chapitre
- **WHEN** le joueur quitte un chapitre en cours
- **THEN** il revient à l'accueil, et le chapitre n'est pas marqué comme terminé

### Requirement: Position de départ reproductible
Chaque chapitre (sauf « Première vraie partie ») SHALL démarrer d'une position toujours identique, obtenue à partir d'une graine fixe, d'ajustements de scénario déclarés par le chapitre (ressources, cartes en main, données, manche) et d'une suite de commandes de jeu appliquées par le moteur.

#### Scenario: Rejouer un chapitre
- **WHEN** le joueur démarre deux fois le même chapitre
- **THEN** le plateau, les mains, la rangée de cartes et les ressources sont identiques les deux fois

#### Scenario: Évolution du jeu
- **WHEN** une nouvelle version du jeu change le format des sauvegardes
- **THEN** les positions des chapitres restent valides, sans fichier de position à migrer

### Requirement: Étapes guidées
Un chapitre SHALL se dérouler en étapes ; chaque étape affiche son texte dans une bulle, met en avant l'élément de l'écran qu'elle décrit, et se termine quand la partie atteint l'état qu'elle attend, quel que soit le chemin suivi pour y arriver.

#### Scenario: Étape terminée par une action
- **WHEN** l'étape demande de mettre une sonde en orbite de Mars et le joueur le fait
- **THEN** l'étape suivante s'affiche

#### Scenario: Étape d'explication
- **WHEN** une étape ne demande aucune action (présentation d'une zone de l'écran)
- **THEN** elle se termine quand le joueur clique sur « Suivant »

#### Scenario: Choix en cours
- **WHEN** une action ouvre un choix (carte de la rangée, secteur, trace de vie, bonus)
- **THEN** la bulle s'efface pour laisser cliquer les éléments proposés, puis revient sur l'étape suivante, sans jamais réafficher une étape déjà faite

#### Scenario: Zone décrite et action attendue
- **WHEN** une étape décrit un panneau repliable ou attend une action
- **THEN** le panneau décrit s'ouvre (les autres se referment, l'historique reste réduit) et seuls les éléments de l'action attendue clignotent (la Terre pour un lancement, l'emplacement d'orbiteur pour une mise en orbite)

#### Scenario: Fin du chapitre
- **WHEN** la dernière étape d'un chapitre est terminée
- **THEN** le chapitre est marqué comme terminé et le joueur peut passer au chapitre suivant ou revenir au menu

### Requirement: Guidage souple
Pendant une étape qui attend une action, les actions principales qui n'y mènent pas SHALL être désactivées, avec la raison dans leur infobulle ; les infobulles, l'annulation, la documentation et l'affichage des plateaux des autres joueurs MUST rester disponibles.

#### Scenario: Action hors sujet
- **WHEN** l'étape attend un scan et le joueur survole l'action « Lancer une sonde »
- **THEN** l'action est désactivée et son infobulle indique de suivre l'étape en cours

#### Scenario: Annulation pendant un chapitre
- **WHEN** le joueur annule sa dernière action pendant un chapitre
- **THEN** la partie revient en arrière et l'étape affichée correspond de nouveau à l'état de la partie

### Requirement: Adversaire du tutoriel
Dans les chapitres à position préparée, les adversaires SHALL être des adversaires passifs ; dans « Première vraie partie », l'adversaire MUST être un robot Débutant.

#### Scenario: Tour de l'adversaire passif
- **WHEN** c'est au tour de l'adversaire pendant un chapitre
- **THEN** il passe sans rien changer d'autre au plateau

### Requirement: Textes du tutoriel
Les textes des étapes SHALL venir d'un fichier Markdown du jeu, une section par étape, et chaque étape déclarée MUST avoir son texte.

#### Scenario: Texte manquant
- **WHEN** une étape n'a pas de section dans le fichier des textes
- **THEN** les tests du projet échouent

### Requirement: Liens vers la documentation
Une étape SHALL pouvoir renvoyer vers une section de la documentation du jeu (« En savoir plus ») ; le lien ouvre la documentation sur cette section, et chaque lien MUST pointer vers une section existante.

#### Scenario: En savoir plus
- **WHEN** le joueur clique sur « En savoir plus » dans une étape sur le scan
- **THEN** la documentation s'ouvre sur la section du scan, et le chapitre reprend à la même étape quand il la ferme

#### Scenario: Section renommée
- **WHEN** une section de la documentation visée par une étape est renommée ou supprimée
- **THEN** les tests du projet échouent

### Requirement: Proposition au premier lancement
Au lancement, le jeu SHALL proposer le tutoriel quand le navigateur n'a ni partie sauvegardée, ni progression du tutoriel, ni refus enregistré ; le joueur MUST pouvoir l'ignorer, et le tutoriel reste accessible depuis l'accueil.

#### Scenario: Nouveau joueur
- **WHEN** un joueur ouvre le jeu pour la première fois
- **THEN** le jeu lui propose de commencer le tutoriel

#### Scenario: Joueur existant
- **WHEN** le navigateur a une partie sauvegardée
- **THEN** le tutoriel n'est pas proposé automatiquement

#### Scenario: Tutoriel ignoré
- **WHEN** le joueur ignore la proposition
- **THEN** elle ne revient pas aux lancements suivants

### Requirement: Progression du tutoriel
Les chapitres terminés SHALL être retenus par le navigateur et cochés dans le menu ; si le navigateur ne peut rien enregistrer, le tutoriel MUST rester jouable.

#### Scenario: Retour au menu
- **WHEN** le joueur revient au menu après avoir terminé deux chapitres, même après avoir fermé la page
- **THEN** ces deux chapitres sont cochés

#### Scenario: Stockage indisponible
- **WHEN** le navigateur refuse l'enregistrement (navigation privée, données bloquées)
- **THEN** les chapitres se jouent normalement, sans progression retenue

### Requirement: Partie sauvegardée préservée
Un chapitre à position préparée MUST ne jamais être sauvegardé ni remplacer la partie sauvegardée ; après un rechargement de la page pendant un chapitre, le jeu revient à l'accueil.

#### Scenario: Chapitre puis reprise
- **WHEN** le joueur a une partie sauvegardée, joue un chapitre puis revient à l'accueil
- **THEN** « Continuer » reprend sa partie sauvegardée telle qu'il l'avait laissée

### Requirement: Aide au contexte de la première vraie partie
Dans « Première vraie partie », le jeu SHALL afficher une courte aide la première fois qu'une situation clé se présente (par exemple, une analyse des données devient possible), une seule fois par situation.

#### Scenario: Analyse possible
- **WHEN** l'ordinateur du joueur permet pour la première fois d'analyser les données
- **THEN** une bulle explique l'action « Analyser les données » et renvoie vers la documentation

#### Scenario: Situation déjà expliquée
- **WHEN** la même situation se présente de nouveau
- **THEN** aucune bulle ne s'affiche
