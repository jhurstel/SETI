# tutorial Specification

## Purpose
Apprendre SETI à un joueur qui découvre le jeu de société : des chapitres courts, joués sur le vrai plateau, qui présentent l'interface et les règles une à une et renvoient vers la documentation pour le détail.

## Requirements

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

### Requirement: Chapitres des espèces
Le tutoriel SHALL proposer un chapitre par espèce Alien (Mascamites, Anomalies, Oumuamua, Centauriens, Exertiens). Chaque chapitre part d'une position reproductible où le joueur découvre lui-même l'espèce en posant la troisième trace de vie, puis pratique sa mécanique principale avant la fin du chapitre.

#### Scenario: Découverte jouée par le joueur
- **WHEN** le joueur démarre un chapitre d'espèce débloqué
- **THEN** deux emplacements de découverte de l'espèce sont déjà occupés, et l'étape suivante lui fait poser la troisième trace, ce qui découvre l'espèce

#### Scenario: Mécanique principale pratiquée
- **WHEN** le joueur suit les étapes du chapitre des Centauriens
- **THEN** il atteint son palier de message et choisit une tuile Message avant la fin du chapitre

#### Scenario: Chapitre terminé
- **WHEN** le joueur termine un chapitre d'espèce
- **THEN** le chapitre est marqué comme terminé, comme les autres chapitres

### Requirement: Déblocage des espèces
Une espèce SHALL être débloquée, dans ce navigateur, dès qu'elle est découverte dans une vraie partie, locale ou en ligne, quel que soit le joueur qui la découvre (robot compris). Une découverte faite dans un chapitre du tutoriel ne débloque rien. Le déblocage est retenu d'une session à l'autre.

#### Scenario: Découverte par un robot
- **WHEN** un robot découvre les Exertiens dans une partie locale
- **THEN** le chapitre des Exertiens est débloqué

#### Scenario: Partie en ligne
- **WHEN** une espèce est découverte dans une partie en ligne
- **THEN** elle est débloquée dans le navigateur de chaque joueur humain de la partie

#### Scenario: Découverte dans le tutoriel
- **WHEN** une espèce est découverte pendant un chapitre du tutoriel
- **THEN** aucune espèce n'est débloquée

#### Scenario: Partie reprise
- **WHEN** le joueur reprend une partie sauvegardée où une espèce était déjà découverte
- **THEN** cette espèce est débloquée

#### Scenario: Stockage indisponible
- **WHEN** le navigateur ne permet pas d'enregistrer la progression
- **THEN** le jeu reste jouable, et les espèces découvertes ne sont pas retenues

### Requirement: Chapitres verrouillés dans le menu
Le menu du tutoriel SHALL afficher un chapitre d'espèce non débloquée comme verrouillé, sans nommer l'espèce ni résumer ses règles, avec l'explication de son déblocage ; un chapitre verrouillé ne peut pas être démarré.

#### Scenario: Chapitre verrouillé
- **WHEN** le joueur ouvre le menu sans avoir rencontré les Mascamites
- **THEN** le chapitre correspondant apparaît comme « Espèce inconnue », avec un cadenas et la mention qu'il se débloque en découvrant une espèce en partie, et un clic ne le démarre pas

#### Scenario: Chapitre débloqué
- **WHEN** le joueur a rencontré les Mascamites en partie et ouvre le menu
- **THEN** le chapitre « Mascamites » apparaît avec son titre et son résumé, et peut être démarré

### Requirement: Annonce d'un déblocage
Quand une espèce est débloquée pour la première fois pendant une partie, le jeu SHALL le signaler au joueur en nommant le nouveau chapitre du tutoriel, sans interrompre la partie.

#### Scenario: Première rencontre
- **WHEN** les Anomalies sont découvertes pour la première fois dans une partie de ce navigateur
- **THEN** un message signale qu'un nouveau chapitre du tutoriel, « Anomalies », est disponible

#### Scenario: Espèce déjà débloquée
- **WHEN** les Anomalies sont découvertes dans une autre partie, plus tard
- **THEN** aucun message de déblocage n'apparaît

### Requirement: Règles des espèces masquées dans la documentation
La documentation SHALL masquer la section de règles de chaque espèce non débloquée : à sa place, un encart sans le nom de l'espèce indique qu'elle se dévoile en la découvrant en partie. Les règles générales de découverte restent visibles.

#### Scenario: Espèce non débloquée
- **WHEN** le joueur ouvre la documentation sans avoir rencontré les Centauriens
- **THEN** ni le nom ni les règles des Centauriens n'apparaissent dans la partie « Les espèces Alien », remplacés par l'encart

#### Scenario: Espèce débloquée
- **WHEN** le joueur a rencontré les Centauriens en partie et ouvre la documentation
- **THEN** la section des Centauriens est affichée en entier

#### Scenario: Lien vers une section masquée
- **WHEN** un lien « En savoir plus » vise la section d'une espèce non débloquée
- **THEN** la documentation s'ouvre sur l'encart de la partie « Les espèces Alien », sans dévoiler l'espèce

### Requirement: Chapitre « Traces de vie et espèces » sans révélation
Le chapitre « Traces de vie et espèces » SHALL enseigner la découverte sans dévoiler une espèce que le joueur n'a pas débloquée : l'espèce découverte reste anonyme à l'écran (annonce, plateau, pistes, cartes Alien, historique, éléments posés sur le système solaire). Si le joueur a déjà débloqué une espèce, le chapitre utilise celle-ci, affichée normalement.

#### Scenario: Joueur qui n'a rencontré aucune espèce
- **WHEN** le joueur termine le chapitre sans avoir débloqué d'espèce
- **THEN** l'annonce dit qu'une nouvelle espèce est découverte sans la nommer, le plateau s'intitule « Espèce découverte » sans pistes ni cartes lisibles, et aucune espèce n'est débloquée

#### Scenario: Cartes Alien gagnées à la découverte
- **WHEN** la découverte donne au joueur une carte Alien de l'espèce masquée
- **THEN** la carte apparaît dans sa main face cachée (« Carte Alien »), sans nom, texte ni infobulle de contenu, et l'historique écrit « une carte Alien » à la place de son nom

#### Scenario: Espèce déjà débloquée
- **WHEN** le joueur a débloqué les Mascamites et démarre le chapitre
- **THEN** le chapitre fait découvrir les Mascamites, affichées normalement
