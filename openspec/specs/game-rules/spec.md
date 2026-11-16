# game-rules Specification

## Purpose
Règles du jeu SETI telles que le moteur les applique (commandes des joueurs, tours, interactions, cartes, espèces, fin de partie), indépendamment de l'interface et du mode de jeu (local ou en ligne). Référence : livret de règles et FAQ dans `public/docs/`.

## Requirements

### Requirement: Point d'entrée unique des commandes
Toute modification d'une partie SHALL passer par la session de jeu, qui vérifie qui joue et ce qui est permis (tour, interaction en cours et son destinataire, une seule action principale par tour, règles des actions gratuites), applique la règle, résout les interactions automatiques, termine les tours et renvoie les entrées d'historique et les annonces.

#### Scenario: Commande hors de son tour
- **WHEN** un joueur envoie une action principale alors que ce n'est pas son tour
- **THEN** la commande est refusée avec sa raison et la partie n'est pas modifiée

#### Scenario: Deuxième action principale
- **WHEN** un joueur qui a déjà fait son action principale en demande une autre dans le même tour
- **THEN** la commande est refusée

#### Scenario: Refus motivé
- **WHEN** une vérification de règle refuse une action
- **THEN** le refus porte une raison en français, affichable telle quelle

### Requirement: Partie immuable et reproductible
Une opération du moteur SHALL rendre une nouvelle partie sans modifier celle qu'elle a reçue, et tout tirage aléatoire SHALL venir du générateur à graine de la partie, dont l'état est gardé dans la partie et dans ses sauvegardes.

#### Scenario: Même graine, mêmes choix
- **WHEN** deux parties sont créées avec la même graine et reçoivent les mêmes commandes
- **THEN** elles aboutissent au même état

#### Scenario: Partie reçue intacte
- **WHEN** une opération du moteur est appliquée à une partie
- **THEN** la partie d'origine est identique à ce qu'elle était avant l'appel

### Requirement: Mise en place et premier joueur
La création d'une partie SHALL tirer ou fixer le premier joueur, donner les PV de départ dans l'ordre du tour (1 PV pour le premier joueur, selon les règles) et noter la graine de la partie.

#### Scenario: PV de départ
- **WHEN** une partie à 3 joueurs est créée avec le 2e joueur comme premier joueur
- **THEN** l'ordre du tour commence par ce joueur et les PV de départ suivent cet ordre

### Requirement: Interactions à plusieurs étapes
Une action qui demande des choix SHALL créer des interactions placées dans la file de la partie ; une interaction destinée à un autre joueur porte ce joueur et seul lui peut y répondre ; plusieurs gains à choix forment un menu dont le joueur fixe l'ordre ; les résolutions de secteur passent en dernier, et le choix de la carte de fin de manche après celles de la rotation.

#### Scenario: Interaction d'un autre joueur
- **WHEN** une interaction en tête de file est destinée au joueur B
- **THEN** une réponse du joueur A est refusée et celle de B est acceptée

#### Scenario: Interaction automatique
- **WHEN** une interaction sans choix (effet de carte, résolution de secteur, pioche et scan, validation de mission) arrive en tête de file
- **THEN** la session la résout aussitôt avec la même règle pour un humain et pour un robot

#### Scenario: Renoncement
- **WHEN** un joueur renonce à une interaction déclarée facultative
- **THEN** elle quitte la file sans effet ; une interaction obligatoire ne peut pas être ignorée

### Requirement: Historique et annulation
Chaque commande SHALL produire des entrées d'historique en français regroupées par action (l'action puis ses conséquences) ; un texte qui nomme une carte cachée SHALL n'être lisible que par son propriétaire. Un joueur humain SHALL pouvoir annuler sa dernière action ou son tour en jeu local, jusqu'au début de son avant-dernier tour.

#### Scenario: Carte piochée par un adversaire
- **WHEN** un robot ou un adversaire pioche une carte face cachée
- **THEN** l'historique affiché aux autres joueurs mentionne la pioche sans nommer la carte

#### Scenario: Annuler le tour
- **WHEN** le joueur humain annule son tour en jeu local
- **THEN** la partie revient au début de ce tour, file d'interactions comprise

### Requirement: Missions
Un déclencheur de mission SHALL proposer tous les cercles non recouverts qu'il remplit, dans l'ordre choisi par le joueur, un seul par récompense identique sur une carte ; recouvrir un cercle SHALL vider les autres cercles du même déclencheur, toutes cartes confondues. Une mission conditionnelle reste réalisable tant que sa condition est remplie. Finir son tour ou passer avec un objectif encore validable demande confirmation.

#### Scenario: Déclencheur hors de son tour
- **WHEN** l'action d'un autre joueur rend réalisable un cercle de mission du joueur A
- **THEN** A se voit proposer ce cercle aussitôt, avec la possibilité d'y renoncer

#### Scenario: Un seul cercle par déclencheur
- **WHEN** un même déclencheur remplit deux cercles sur deux cartes et que le joueur en recouvre un
- **THEN** l'autre cercle de ce déclencheur n'est plus réalisable, mais ceux d'un autre déclencheur le restent

### Requirement: Cartes Exertiens
Les cartes Exertiens SHALL rester hors de la main : elles ne comptent pas dans la limite de cartes et ne peuvent être ni défaussées, ni réservées, ni jouées normalement ; chacune se joue face cachée à un palier Exertien, une fois par joueur et par palier (au 2e palier pour 1 crédit). À la découverte des Exertiens, chaque joueur qui a un marqueur de découverte peut en jouer une aussitôt.

#### Scenario: Défausse de fin de manche
- **WHEN** un joueur doit défausser jusqu'à la limite de cartes
- **THEN** ses cartes Exertiens ne sont ni comptées ni proposées

#### Scenario: Carte jouée cachée
- **WHEN** un joueur joue une carte Exertien
- **THEN** les adversaires n'en voient que le dos et le danger visible jusqu'au décompte final

### Requirement: Espèces et traces de vie
Toute découverte d'espèce SHALL passer par la même règle, qu'elle vienne d'une trace de vie ou d'un palier neutre, et produire l'annonce de découverte. La première trace d'une couleur sur le triangle prend le bonus de découverte, les suivantes le bonus suivant. Les spécimens Mascamites restent face cachée sauf pour le joueur qui les a vus ; le contenu d'une capsule n'est visible que par son propriétaire.

#### Scenario: Découverte par palier neutre
- **WHEN** un palier neutre complète les traces d'une espèce
- **THEN** l'espèce est découverte avec sa mise en jeu propre et l'annonce de découverte

#### Scenario: Capsule arrivée à destination
- **WHEN** une capsule de spécimen atteint la Terre (ou Mars pour la carte ET.4)
- **THEN** le joueur peut réclamer la mission en action gratuite : récompense de la carte et du spécimen, puis le spécimen rejoint la piste bleue

### Requirement: Fin de manche et carte de fin de manche
Un joueur qui passe SHALL défausser jusqu'à la limite de main puis choisir, pendant son tour, une carte de la pile de la manche, cachée aux autres jusqu'à sa passe ; la manche se termine quand tous les joueurs ont passé.

#### Scenario: Passe avec pile
- **WHEN** un joueur passe et qu'il reste une pile de fin de manche
- **THEN** il choisit sa carte avant que le joueur suivant ne prenne la main

### Requirement: Fin de partie et décompte final
À la fin de la dernière manche, le moteur SHALL calculer le décompte final (tuiles objectif, cartes Fin de partie, espèces, cartes Exertiens jouées et leurs conditions, évaluées une seule fois chacune) puis la pénalité de danger, enregistrer le détail par joueur et désigner le ou les gagnants ; aucune action n'est ensuite acceptée.

#### Scenario: Pénalité de danger
- **WHEN** les Exertiens sont découverts et qu'un ou plusieurs joueurs ont le danger positif le plus élevé
- **THEN** chacun d'eux perd 10 % de son total, arrondi à l'inférieur, après tous les autres PV

#### Scenario: Personne en danger
- **WHEN** aucun joueur n'a de danger positif
- **THEN** aucune pénalité n'est appliquée

#### Scenario: Partie terminée
- **WHEN** une commande arrive après le décompte final
- **THEN** elle est refusée

### Requirement: Cartes décrites par des données
Les cartes SHALL être lues depuis les fichiers CSV de `public/cards/` (avec ou sans BOM) ; chaque effet lu doit être traité par le moteur et chaque carte doit pouvoir être jouée par un robot sans erreur.

#### Scenario: Nouvel effet non géré
- **WHEN** une carte du CSV utilise un type d'effet que le moteur ne traite pas
- **THEN** le test du catalogue des cartes échoue

### Requirement: Sauvegardes versionnées
Une sauvegarde SHALL porter sa version, l'état du générateur aléatoire et être migrée à la lecture si elle est plus ancienne ; une sauvegarde plus récente que le jeu est refusée.

#### Scenario: Ancienne sauvegarde
- **WHEN** le joueur charge une sauvegarde d'une version antérieure du modèle
- **THEN** les migrations sont appliquées (états d'annulation compris) et la partie reprend

#### Scenario: Sauvegarde trop récente
- **WHEN** la sauvegarde vient d'une version plus récente du jeu
- **THEN** elle est refusée avec un message explicite
