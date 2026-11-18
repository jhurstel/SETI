# Spec Delta

## Purpose

Présenter chaque carte du jeu comme les vraies cartes de SETI (coins, coût, effet en symboles, bandeau de revenu), en jeu comme dans la documentation, et signaler les cartes ou effets que le jeu ne sait pas encore représenter.

## ADDED Requirements

### Requirement: Disposition de la carte
Une carte SHALL suivre la disposition des vraies cartes (livret p. 7, photos de la FAQ) : moitié haute réservée à l'illustration (fond décoratif), bandeau du nom à sa base, zone blanche de l'effet, panneau de mission ou de fin de partie le cas échéant, bandeau de pied de carte ; le numéro de la carte est écrit en tout petit, à l'horizontale, en bas à droite de l'illustration.

#### Scenario: Carte Action
- **WHEN** la carte 9 (Falcon Heavy) est affichée en grande taille
- **THEN** on voit de haut en bas : la zone d'illustration, le bandeau « Falcon Heavy », la zone blanche de l'effet, puis le pied de carte, et le numéro 9 en petit en bas à droite de l'illustration

### Requirement: Coins de la carte
Une carte SHALL montrer son action gratuite dans un jeton du coin supérieur gauche et, dans le coin supérieur droit, un triangle à la couleur de son secteur (jaune, rouge, bleu ou noir) portant le symbole signal.

#### Scenario: Carte Mission Pioneer 11
- **WHEN** la carte 1 (action gratuite 1 Déplacement, secteur jaune) est affichée
- **THEN** le jeton « 1 Déplacement » est en haut à gauche et un triangle jaune avec le symbole signal en haut à droite

### Requirement: Revenu en pied de carte
Le pied de carte SHALL prendre la couleur du revenu de la carte (doré pour un crédit, vert pour une énergie, gris foncé pour une carte, rouge pour un Média, bleu pour une donnée) et montrer le symbole du revenu dans le coin inférieur droit.

#### Scenario: Revenu énergie
- **WHEN** la carte 1 (revenu 1 énergie) est affichée
- **THEN** son pied de carte est vert avec le symbole énergie en bas à droite

#### Scenario: Revenu carte
- **WHEN** une carte au revenu « 1 Pioche » est affichée
- **THEN** son pied de carte est gris foncé avec le symbole carte au hasard en bas à droite

### Requirement: Coût de la carte
Une carte jouable SHALL afficher son coût dans un badge à gauche, à la jonction de l'illustration et du bandeau du nom : doré avec le symbole crédit, ou vert avec le symbole énergie, suivi du montant (0 compris).

#### Scenario: Carte gratuite
- **WHEN** la carte 1 (coût 0 crédit) est affichée
- **THEN** le badge doré affiche 0 et le symbole crédit

#### Scenario: Carte payée en énergie
- **WHEN** une carte Centaurien coûtant 2 énergies est affichée
- **THEN** le badge est vert et affiche 2 et le symbole énergie

### Requirement: Cartes Exertien
Une carte Exertien SHALL afficher son danger à la place du coût et ne montrer ni action gratuite, ni secteur, ni revenu.

#### Scenario: Danger d'une carte Exertien
- **WHEN** la carte ET.41 (danger 6) est affichée
- **THEN** le danger 6 apparaît à la place du coût et aucun coin d'action gratuite, de secteur ou de revenu n'est dessiné

### Requirement: Effet en symboles
La zone blanche SHALL montrer l'effet immédiat en symboles du glossaire, centrés, dans l'ordre de résolution (de gauche à droite), puis la précision en texte quand la carte en a une. Une partie d'effet sans symbole SHALL être rendue par son texte, sans être omise.

#### Scenario: Effet entièrement symbolisé
- **WHEN** la carte 9 (2 Sondes + 1 Média, limite de sondes ignorée) est affichée
- **THEN** la zone blanche montre deux symboles Sonde puis le symbole Média, et la précision « Ignorez la limite de sondes… » en dessous

#### Scenario: Effet sans symbole
- **WHEN** une carte porte un effet que le jeu ne sait pas dessiner
- **THEN** ce morceau d'effet s'affiche en texte dans la zone blanche et la carte figure dans la liste des effets sans symbole

### Requirement: Panneau de mission
Une carte Mission SHALL montrer un panneau grisé sous l'effet. Mission déclenchable : un intitulé (« Lorsque vous visitez : »…) puis, pour chaque cercle, une étiquette de condition (planète, couleur…) au-dessus du cercle de récompense. Mission conditionnelle : la condition à gauche et la récompense à droite.

#### Scenario: Mission déclenchable à deux conditions
- **WHEN** la carte 2 (Mariner 10 : visiter Mercure pour 1 carte, Vénus pour 1 Média) est affichée
- **THEN** le panneau montre « Lorsque vous visitez : » et deux cercles, étiquetés Mercure et Vénus, avec le symbole de leur récompense

#### Scenario: Mission jouée
- **WHEN** un joueur a recouvert le premier cercle d'une mission jouée
- **THEN** la mission jouée, affichée avec la même face, montre ce cercle recouvert de son marqueur

### Requirement: Panneau de fin de partie
Une carte Fin de partie SHALL montrer un panneau doré avec sa condition de décompte et ses points.

#### Scenario: Carte de fin de partie
- **WHEN** une carte Fin de partie est affichée
- **THEN** sa condition et ses PV apparaissent dans un panneau doré sous l'effet

### Requirement: Cartes d'espèce
Les cartes d'une espèce SHALL garder la même disposition, avec le bandeau du nom et les panneaux à la couleur de l'espèce.

#### Scenario: Carte Centaurien
- **WHEN** une carte Centaurien est affichée
- **THEN** son bandeau du nom et son panneau de mission ont la teinte des Centauriens, ses coins et son pied de carte restent ceux de son secteur et de son revenu

### Requirement: Même face partout en jeu
La même face de carte SHALL servir dans la main, la rangée de cartes, les fenêtres de choix de cartes, l'infobulle d'une carte et les plateaux d'espèce, en taille compacte ou grande. Une fenêtre de choix SHALL mettre en avant l'élément utile au choix en cours.

#### Scenario: Choix d'une carte à réserver
- **WHEN** le joueur choisit une carte à réserver sous ses revenus
- **THEN** chaque carte proposée met en avant son pied de carte (revenu)

#### Scenario: Choix d'une carte de la rangée pour un scan
- **WHEN** le joueur doit défausser une carte de la rangée pour marquer un signal
- **THEN** chaque carte de la rangée met en avant son coin de secteur

#### Scenario: Survol d'une carte de la main
- **WHEN** le joueur survole une carte compacte de sa main
- **THEN** l'infobulle montre la même carte en grande taille, texte compris

### Requirement: Planches de cartes dans la documentation
Le glossaire 3.2 SHALL montrer toutes les cartes du paquet de base, regroupées par type et classées par numéro. La section de chaque espèce SHALL montrer les cartes de cette espèce, cachées tant que l'espèce n'est pas débloquée.

#### Scenario: Planche du paquet de base
- **WHEN** le joueur ouvre la section 3.2 de la documentation
- **THEN** les 138 cartes du paquet de base apparaissent, avec leur numéro, regroupées en Action, Missions et Fin de partie

#### Scenario: Espèce non débloquée
- **WHEN** l'espèce Oumuamua n'a jamais été rencontrée dans ce navigateur
- **THEN** sa section et sa planche de cartes restent masquées

### Requirement: Listes des cartes et effets manquants
Le projet SHALL publier, à partir des données des cartes et du relevé de la FAQ, trois listes tenues à jour : les parties d'effet sans symbole (par carte), les cartes sans photo dans la FAQ, et les cartes citées par la FAQ mais absentes du jeu.

#### Scenario: Carte promotionnelle absente
- **WHEN** la FAQ cite « SE FR 01 – Planète naine depuis 2006 » et aucun fichier de cartes ne la contient
- **THEN** elle figure dans la liste des cartes absentes du jeu

#### Scenario: Liste à jour
- **WHEN** un symbole est ajouté pour un effet jusque-là affiché en texte
- **THEN** la vérification des listes échoue tant que la liste des effets sans symbole n'a pas été régénérée
