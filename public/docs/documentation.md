# Documentation de SETI (adaptation numérique)

Adaptation numérique du jeu de société **SETI** (Iello) : un joueur humain contre 1 à 3 robots, dans le navigateur.
Les règles de référence restent celles du livret officiel et de la FAQ :

- [Règles du jeu (PDF)](docs/seti-rules-fr.pdf)
- [FAQ officielle (PDF)](docs/SETI-FAQ-FR.pdf)

Ce document décrit comment jouer, les règles telles qu'elles sont appliquées, les interactions, les robots et l'architecture du code.

## 1. Jouer

### 1.1 Lancer une partie

- **Accueil** : au lancement (et par ⚙️ en cours de partie), l'écran d'accueil propose de continuer la partie sauvegardée (sa barre de progression montre où elle en est : un trait gris par manche, un trait de la couleur du joueur par tour, l'action principale du tour au survol), d'en commencer une nouvelle, de jouer en ligne, ainsi que la documentation, les règles et la FAQ.
- **Nouvelle partie** : choisir le nombre de robots (1 à 3), leur niveau (Débutant, Intermédiaire, Expert) et qui commence.
- La partie se joue en **5 manches**. Chaque joueur commence avec 4 crédits, 3 énergies, 4 Médias et 5 cartes, puis **réserve** une carte sous son plateau (mise en place).
- **Sauvegarde automatique** : l'état est enregistré dans le navigateur après chaque action (et quand la page est quittée). En rouvrant la page, la partie reprend où elle s'était arrêtée.
- **Export / import** : l'accueil (⚙️ en cours de partie) enregistre la partie dans un fichier JSON ou en recharge une. Une sauvegarde d'une version plus récente du jeu est refusée.

### 1.2 L'écran

- **Système solaire** (centre) : 3 anneaux rotatifs, 8 secteurs, planètes, comètes, champs d'astéroïdes, sondes.
- **Plateau du joueur** (gauche) : les onglets en haut affichent le plateau de chaque joueur. La section Ressources montre le score, les crédits, l'énergie, les cartes en main (4 gardées en passant), les Médias et les données (6 au plus), puis les revenus ; l'infobulle d'une ressource propose ses actions gratuites (échanges, achat d'une carte) en boutons à icônes, chacun avec son infobulle (coût, bonus). La tuile des revenus montre les cartes réservées et les 5 revenus de chaque manche (crédits, énergie, cartes, Médias, données ; un revenu nul est estompé). La section Actions montre les 8 actions principales en hexagones (lancer, orbite, atterrir, scanner, analyser, jouer une carte, rechercher, passer) et, dans son propre cadre, la fin du tour. Seul le plateau défile, sous les onglets. Dessous : les emplacements des technologies Exploration, les étapes du scan et les technologies Observation, l'ordinateur de données (les actions ne sont que dans la section Actions), cartes en main (celles d'un robot qu'on n'a pas vues sont montrées de dos), missions et cartes jouées.
- **Rangée de cartes**, **plateau des technologies**, **tuiles objectif**, **plateaux des espèces Alien** et **historique**.
- **Panneau Planètes** : chaque planète, avec à côté une ligne par type de sonde présente (orbiteurs, atterrisseurs, lunes comprises) et une pastille de la couleur de chaque joueur, dans l'ordre d'arrivée. Son infobulle montre les cases de la planète ; chaque gain posé à côté d'une case a sa propre infobulle.
- Les infobulles (survol) donnent le détail de chaque élément. Une action (principale, fin du tour, étape du scan) montre son coût et son bonus en symboles (chacun avec son infobulle ; sonde en hexagone, orbiteur et atterrisseur en disque comme sur le panneau des planètes, crédit « ? » pour le coût d'une carte), puis ce que fait un clic ou la raison qui l'empêche. Un emplacement de technologie (le cadre, pour Observation I dont la pastille est l'étape de la Terre) montre si elle est acquise, le pouvoir actuel du joueur et, tant qu'elle n'est pas acquise, le bénéfice de la technologie.
- Les fenêtres de choix (récompenses à ordonner, missions déclenchées, tuiles Message, choix des cartes et des observations) montrent chaque option en symboles, dans des tuiles de même taille sur une ligne ; le survol donne son libellé, son détail et, si elle est indisponible, la raison.

### 1.3 Le tour

À son tour, un joueur fait **une action principale** et autant d'**actions gratuites** qu'il veut (avant ou après), puis termine son tour (bouton « Fin du tour »).
Quand une action ouvre un choix (placer une trace de vie, choisir une carte, une technologie…), le jeu affiche ce qu'il attend dans le bandeau et met en avant les éléments cliquables.

À la fin du tour, le jeu vérifie les **paliers de score** (voir 2.7) puis passe au joueur suivant. Un joueur qui a **passé** ne joue plus jusqu'à la fin de la manche.

### 1.4 Actions principales

| Action | Coût | Effet |
|---|---|---|
| **Lancer une sonde** | 2 crédits | Pose une sonde sur la Terre. Une seule sonde dans le système solaire (2 avec Exploration I). |
| **Mettre en orbite** | 1 crédit + 1 énergie | Une sonde sur une planète devient un orbiteur ; gain de la case d'orbite (le premier reçoit un bonus en plus). |
| **Atterrir** | 3 énergies (2 si un orbiteur est déjà là ou avec Exploration III, 1 avec les deux) | Une sonde se pose sur la planète (ou une lune, avec Exploration IV) ; gain de la case d'atterrissage. |
| **Scanner** | 1 crédit + 2 énergies | Un signal dans le secteur de la Terre, puis un signal dans le secteur d'une carte de la rangée (la carte est défaussée). Les technologies Observation ajoutent des signaux. |
| **Analyser les données** | 1 énergie | Possible quand la ligne du haut de l'ordinateur est pleine : vide l'ordinateur et donne une trace de vie **bleue**. |
| **Rechercher une technologie** | 6 Médias | Prend une technologie sur le plateau (avec son bonus) et fait tourner le système solaire. |
| **Jouer une carte** | Coût de la carte (crédits ou énergie) | Applique les gains de la carte ; une mission reste devant le joueur, une carte Fin de partie est décomptée à la fin. |
| **Passer** | — | Garde au plus 4 cartes (défausse le reste). Le premier à passer fait tourner le système solaire. Chaque joueur qui passe découvre ensuite la pile de fin de manche, cachée jusque-là, et y prend une carte. |

#### Détail des étapes

- **Lancer une sonde** : la sonde part de la case de la Terre. Exploration I permet un lancement gratuit et une 2ᵉ sonde.
- **Orbite / atterrissage** : la sonde doit être sur la case de la planète. Si plusieurs planètes ou lunes sont possibles, le jeu demande laquelle. Une planète n'a pas de limite d'orbiteurs ni d'atterrisseurs : une fois les cases imprimées occupées, les suivants reçoivent le gain de la dernière case. Une lune n'accueille qu'un seul atterrisseur (sauf avec *Dragonfly*, qui permet de se poser sur une lune occupée). Mascamites : certains atterrissages permettent de **prélever un spécimen** (voir 3.2).
- **Scanner** : (1) signal dans le secteur de la Terre (ou un secteur adjacent avec Observation I) ; (2) choix d'une carte de la rangée, signal dans le secteur de sa couleur ; (3) Observation II : payer 1 Média pour un signal sur Mercure ; Observation III : défausser une carte pour un signal de sa couleur ; Observation IV : payer 1 énergie pour lancer une sonde, ou gagner 1 déplacement.
- Chaque signal pose un marqueur dans le secteur et, si le secteur le prévoit, rapporte une **donnée**. Un secteur dont toutes les cases sont remplies est **résolu** (voir 2.2).
- **Rechercher une technologie** : une technologie par pile et par joueur. Les technologies Informatique se posent sur l'ordinateur et ajoutent un gain quand la colonne est remplie.
- **Passer** : la pile de fin de manche reste cachée tant qu'on n'a pas passé ; une fois la passe confirmée (elle ne s'annule plus), on la découvre et la carte choisie va dans la main, avant que le tour passe au joueur suivant. Les autres joueurs ne savent pas laquelle. À la fin de la manche, chacun reçoit ses revenus (crédits, énergies, cartes).

### 1.5 Actions gratuites

| Action gratuite | Coût | Effet |
|---|---|---|
| **Déplacer une sonde** | 1 énergie par case (ou un déplacement gratuit) | Avance d'une case adjacente. Quitter un champ d'astéroïdes coûte plus cher (sauf Exploration II). +1 Média sur les cases à microphone et les comètes. |
| **Échanger des ressources** | 2 crédits, 2 énergies ou 2 cartes | Contre 1 crédit, 1 énergie ou 1 carte (dans l'infobulle de la ressource dépensée). |
| **Acheter une carte** | 3 Médias | Prend une carte de la rangée ou de la pioche (dans l'infobulle des Médias). |
| **Défausser pour l'action gratuite** | Une carte de la main | Effet du coin de la carte : 1 déplacement, 1 donnée ou 1 Média. |
| **Transférer une donnée** | Une donnée en réserve | Place la donnée dans l'ordinateur (clic sur une case libre) ; certaines cases rapportent un bonus. |
| **Réclamer une mission** | Condition remplie | Valide une condition d'une mission jouée et donne sa récompense (aussi pour les spécimens arrivés à destination). |

Les déplacements gratuits reçus d'une carte (« 2 déplacements ») se dépensent sonde par sonde ; on peut renoncer à ceux qui restent.

### 1.6 Annuler

- **Annuler** revient avant la dernière action (toute la séquence : l'action et ses conséquences).
- **Revenir au début du tour** rétablit l'état d'avant la première action du tour. Juste après le tour des robots, avant d'avoir rejoué, il ramène au début du tour qu'on vient de finir (le tour des robots est annulé lui aussi).
- La mémoire est bornée : l'annulation ne remonte pas plus loin que le début de l'avant-dernier tour du joueur.
- Après un rechargement de la page, la sauvegarde automatique garde les 8 dernières actions annulables (modifications des outils de débogage comprises) et le début du dernier tour.

### 1.7 Jouer en ligne

- Menu principal → **Partie en ligne** (bouton présent quand un serveur est configuré).
- **Créer une salle** : votre nom, puis les autres places (joueur humain ou robot, de 2 à 4 joueurs en tout). Le jeu donne un **code de 5 lettres** à transmettre aux autres joueurs.
- **Rejoindre** : votre nom et le code de la salle. La partie commence dès que toutes les places humaines sont prises ; le premier joueur est tiré au hasard.
- Pendant le tour d'un autre joueur, l'écran attend (« Tour de Bob », « En attente de Bob » s'il doit faire un choix). Les robots jouent sur le serveur.
- Chacun ne voit que ce qu'il a le droit de voir : la main des autres, les cartes qu'ils piochent et leurs cartes Exertiens restent cachées.
- **Reprise** : en cas de coupure, le jeu se reconnecte tout seul ; après un rechargement de la page, menu → **Reprendre la partie en ligne**. Le serveur gratuit s'endort après 15 min sans joueurs et met environ une minute à se réveiller ; un redémarrage du serveur efface les salles en cours.
- Pas d'annulation en ligne. La partie solo (sauvegarde automatique) n'est pas touchée : **Continuer la partie** y revient.

### 1.8 Paramètres

- Export / import de la partie, nouvelle partie.
- La version du jeu (et le commit du build) est affichée en bas du menu et dans l'en-tête de la documentation.
- **Outils de débogage** (en développement seulement, absents de la version publiée) : affiche un panneau pour modifier les ressources, piocher une carte précise, etc. (à réserver aux tests).

### 1.9 Glossaire des symboles

Les symboles de l'interface reprennent ceux du livret de règles.

{{glossaire}}

## 2. Règles appliquées

### 2.1 Système solaire

- 5 disques (A à E, du centre vers l'extérieur) × 8 secteurs. Les 3 anneaux supérieurs **tournent** (recherche d'une technologie, premier joueur à passer) et entraînent les sondes posées dessus.
- Cases : planètes, Terre, comètes, champs d'astéroïdes, cases vides. Une case peut porter un microphone (+1 Média à la visite).
- Une visite de planète déclenche les effets de cartes « quand vous visitez » (`GAIN_ON_VISIT`).

### 2.2 Signaux et secteurs

- Chaque secteur a une couleur (jaune, rouge, bleu, noir) et un nombre de cases. Les cartes indiquent une couleur de scan.
- Un secteur plein est résolu une seule fois, à la fin des actions en cours. Si d'autres signaux y sont posés avant (emplacement en pointillé), ils comptent pour la majorité. Le joueur majoritaire (en cas d'égalité, le dernier à avoir posé un marqueur, pointillé compris) reçoit la récompense du secteur : celle du premier à le couvrir, puis celle des suivants (souvent une trace de vie).
- Le secteur est vidé ; le deuxième (même départage) garde un marqueur sur la première case, les autres reprennent les leurs.

### 2.3 Ordinateur de données

- Les données en réserve (6 au plus) se transfèrent dans l'ordinateur, ligne du haut d'abord.
- La ligne du haut pleine permet **Analyser** (trace de vie bleue). Les technologies Informatique ajoutent des cases de bonus en bas des colonnes.

### 2.4 Technologies

| Catégorie | I | II | III | IV |
|---|---|---|---|---|
| Exploration | 2 sondes, lancement gratuit | Astéroïdes : +1 Média, sortie à 1 déplacement | Atterrissage −1 énergie | Atterrissage sur les lunes |
| Observation | Scan d'un secteur adjacent à la Terre | 1 Média : signal sur Mercure | Défausse : signal de la couleur de la carte | 1 énergie : sonde, ou 1 déplacement |
| Informatique | 2 PV + 1 crédit | 2 PV + 1 carte | 2 PV + 1 énergie | 2 PV + 2 Médias |

Chaque pile a 4 exemplaires ; le premier pris rapporte 3 PV, les suivants 1 Média, 1 carte ou 1 énergie.

### 2.5 Cartes

- **Action** : gains immédiats.
- **Mission conditionnelle / déclenchable** : restent devant le joueur ; chaque condition remplie se réclame (action gratuite) et donne sa récompense.
- **Mission déclenchée** : un même déclencheur ne recouvre qu'un cercle, toutes cartes confondues, au choix du joueur. Pendant son tour, les cercles possibles sont surlignés sur ses cartes : il clique sur celui qu'il recouvre (les autres cercles du même déclencheur s'éteignent ; deux déclencheurs, par exemple deux technologies acquises, recouvrent deux cercles). Si l'effet survient pendant le tour d'un autre joueur (trace de vie gagnée par une majorité…), une fenêtre lui propose aussitôt les cercles déclenchés ; il peut aussi ne pas en profiter.
- **Fin de partie** : points au décompte final selon une condition.
- La main n'a pas de limite pendant la manche ; au moment de passer, on n'en garde que 4.

### 2.6 Traces de vie

Une trace de vie (rouge, jaune ou bleue) se place sur le plateau d'une espèce Alien : sur l'emplacement de découverte de sa couleur, sur la piste de l'espèce, ou sur un emplacement excédentaire. Voir la partie 3.

Une trace de vie « de la couleur de son choix » prend la couleur de l'emplacement choisi : elle déclenche les missions de cette couleur et celles qui portent sur n'importe quelle trace de vie (ET.29), pas celles des autres couleurs.

### 2.7 Paliers et objectifs

- **Paliers dorés** à 25, 50 et 70 PV : le joueur qui les franchit pose un marqueur sur une tuile objectif (Technologies, Missions, Revenus, Autres).
- **Paliers neutres** à 20 et 30 PV (moins de 4 joueurs) : un marqueur neutre est posé sur une tuile.
- Les tuiles objectif rapportent leurs points au décompte final selon le rang du joueur.
- Les paliers sont vérifiés à la fin du tour ; s'il y a un choix à faire, il est demandé avant le joueur suivant.

### 2.8 Fin de partie

À la fin de la 5ᵉ manche, le décompte final ajoute : tuiles objectif, cartes Fin de partie, cartes Exertiens jouées, puis retire la pénalité de danger (Exertiens). Le détail s'affiche sur l'écran de fin (devant chaque nom : silhouette pour un humain, force du niveau pour un robot ; un trophée après le nom du ou des vainqueurs), suivi de l'historique complet de la partie (défilant). Sous son titre, le résumé montre une ligne par manche et un trait plein de la couleur du joueur par tour, tous de même longueur (action principale au survol) : un clic sur un trait ou sur le nom d'une manche fait défiler l'historique jusqu'à ce tour ou cette manche.

## 3. Les espèces Alien

### 3.1 Découverte

- Deux espèces sont en jeu, face cachée. Chaque plateau a un triangle de découverte avec un emplacement par couleur (rouge, jaune, bleu).
- Une espèce est **découverte** quand ses trois emplacements de découverte sont occupés. Le plateau se révèle et ses règles s'appliquent.
- Le joueur qui a posé la première trace d'une couleur reçoit une **carte Alien** de l'espèce.
- Après la découverte, les traces vont sur la **piste** de l'espèce (récompenses dans l'ordre), puis sur l'**emplacement infini** quand l'espèce en a un : les traces déjà posées s'y empilent en pastilles de la couleur de leur joueur (les 3 dernières, « +n » au-delà).

### 3.2 Mascamites

- 7 jetons spécimen face cachée, mélangés à la découverte : 3 sur Jupiter, 3 sur Saturne, et le 7e sur la 3e case de la piste bleue. Celui-ci reste caché (« ? ») jusqu'à ce qu'une trace y soit posée : sa récompense est alors gagnée.
- Récompenses des 7 spécimens :

| Spécimen | Récompense |
|---|---|
| 1 | 2 crédits |
| 2 | 2 énergies |
| 3 | 3 Médias |
| 4 | 2 données |
| 5 | 2 cartes |
| 6 | 3 PV + 1 carte au choix |
| 7 | 7 PV |

- Certaines cartes permettent de **prélever un spécimen** sur Jupiter, Saturne ou leurs lunes : le jeton part dans une **capsule**, qui se déplace comme une sonde (sans compter comme une sonde).
- Une capsule arrivée sur la Terre (ou sur Mars pour ET.4) se réclame comme une mission : récompense de la carte plus celle du spécimen.
- D'autres cartes permettent de **consulter** un spécimen (gagner son bonus sans le retirer).
- Pas d'emplacement infini.

### 3.3 Anomalies

- 3 anomalies sont posées sur le disque D : dans le secteur de la Terre et à 3 secteurs de chaque côté.
- Quand une rotation amène la Terre sur une anomalie, le joueur dont le marqueur est le plus haut sur la piste de la couleur de l'anomalie reçoit sa récompense (affichée au centre du jeton). Si personne n'a de marqueur sur cette piste, personne ne gagne ; l'historique l'indique.
- Jetons (une face tirée au hasard) : rouge 1 crédit ou 4 PV, jaune 2 Médias ou 1 carte au choix, bleu 1 donnée ou 1 énergie.
- Emplacement infini : 2 PV.

### 3.4 Oumuamua

- L'astéroïde entre dans le système solaire : c'est une **planète** (orbite et atterrissage possibles) avec son propre secteur de 3 signaux (1 PV, rien, 2 PV).
- Couvrir son secteur rapporte des **jetons** Oumuamua, dépensés sur la piste (25 PV pour 4 jetons sur la 1re case).
- Emplacement infini : 6 PV pour 1 jeton.
- Cartes qui défaussent des jetons : une fenêtre propose « Défausser 1 Token » ou d'y renoncer. *Échantillons d'Exofossiles* : 1 Donnée ; *Cartographie du Terrain* : 1 signal dans n'importe quel secteur ; *Adaptation des Sondes* : 2 Déplacements, autant de fois que voulu, puis 1 Atterrissage (en arrêtant, ou quand il n'y a plus de jeton). Les robots simulent la défausse et le renoncement et gardent le meilleur.
- *Visiteur Céleste* (2 PV par signal) et *Modification de Trajectoire* (1 jeton au premier signal) ne comptent que les signaux marqués sur Oumuamua pendant l'action de la carte.

### 3.5 Centauriens

- À la découverte, chaque joueur pose un palier à son score + 15 PV : en l'atteignant, il choisit une **tuile Message** encore disponible (chaque tuile n'est prise qu'une fois ; s'il n'en reste plus, rien) :

| Tuile Message | Récompense |
|---|---|
| 1 | 1 trace de vie de la couleur de son choix |
| 2 | 1 carte Centaurien + 1 énergie |
| 3 | 3 Médias |
| 4 | 8 PV |

- Les cartes Centauriens posent aussi un palier : en l'atteignant, l'effet **Réception** de la carte s'applique. Il n'y a rien à cliquer : la carte jouée reste devant le joueur, son étoile grise jusqu'au palier (son infobulle en donne le score). Une fois reçue, une carte « augmentez vos revenus » passe sous les revenus ; les autres sont défaussées (ce ne sont pas des missions).
- Piste : 15 PV pour 3 données ; emplacement infini : 6 PV pour 1 donnée (il faut avoir ces données pour y poser la trace ; l'infobulle de l'emplacement affiche « Coût » avant « Bonus »).
- Le symbole Message à côté du nom de l'espèce, sur son plateau, montre au survol, en symboles, les paliers de chaque joueur (PV, tuile Message ou carte, coche une fois pris) et les 4 tuiles Message sur une ligne (une tuile prise est grisée, bordée de la couleur du joueur) ; la souris peut entrer dans l'infobulle pour voir l'état et la récompense de chaque tuile.

### 3.6 Exertiens

- À la découverte, chaque joueur reçoit 3 cartes Exertiens (en plus des cartes des premiers marqueurs). Elles ne sont pas en main : ni défaussées, ni réservées, ni jouées normalement.
- Chaque joueur qui a un marqueur sur les emplacements de découverte peut **jouer tout de suite** une carte Exertien face cachée (ou y renoncer).
- Des **paliers Exertiens** apparaissent au meilleur score + 20 et + 40. À chaque palier, chaque joueur peut jouer une carte Exertien face cachée (une par palier) ; au **2e palier**, jouer sa carte coûte **1 crédit**.
- Les cases de la piste rapportent PV et ressources, mais ajoutent du **danger** (3, 3, 2, 2, 1). Pas d'emplacement infini.
- Fin de partie : les conditions des cartes jouées sont révélées (PV si remplies). Le joueur le plus exposé (somme du danger de ses cartes et de ses cases, ex aequo compris) perd **10 %** de son total, arrondi à l'inférieur. Aucune pénalité si personne n'a de danger.

## 4. Les interactions

Une interaction est un choix en attente. Elles sont gardées dans la partie, dans une file : l'interaction en cours, puis les suivantes. Quand une action donne plusieurs gains qui demandent un choix, un **menu** permet de choisir l'ordre. Les résolutions de secteur passent en dernier.

| Interaction | Déclencheur | Choix attendu | Abandon possible |
|---|---|---|---|
| `RESERVING_CARD` | Mise en place | Cartes à réserver (`CARDS`) | Non |
| `MOVING_PROBE` | Déplacements gratuits | Déplacer une sonde (`MOVE_PROBE`) | Oui |
| `ORBITING_PROBE` / `LANDING_PROBE` | Carte ou bonus d'orbite / atterrissage | Planète (`PLANET`) | Non |
| `ACQUIRING_CARD` | Gain de carte au choix | Carte de la rangée ou pioche (`CARD`) | Oui si payante |
| `ACQUIRING_TECH` | Recherche, bonus de technologie | Technologie (`TECH`) | Non |
| `SELECTING_COMPUTER_SLOT` | Technologie Informatique | Colonne de l'ordinateur (`COMPUTER_COLUMN`) | Non |
| `PLACING_LIFE_TRACE` | Trace de vie gagnée | Emplacement (`LIFE_TRACE`) | Non |
| `PLACING_OBJECTIVE_MARKER` | Palier doré | Tuile objectif (`OBJECTIVE`) | Non |
| `SELECTING_SCAN_CARD` | Scan, effet de carte | Carte de la rangée (`CARD`) | Non |
| `SELECTING_SCAN_SECTOR` | Signal au choix | Secteur (`SECTOR`) | Non |
| `CHOOSING_MEDIA_OR_MOVE` | Comète, case à choix | Média ou déplacement (`MEDIA_OR_MOVE`) | Non |
| `CHOOSING_OBS2_ACTION` / `CHOOSING_OBS3_ACTION` | Scan avec Observation II / III | Accepter ou non (`ACCEPT`) | Non |
| `CHOOSING_OBS4_ACTION` | Scan avec Observation IV | Sonde, déplacement ou rien (`OBS4`) | Non |
| `DISCARDING_FOR_SIGNAL` | Effet de carte | Cartes à défausser (`CARDS`) | Non |
| `DISCARDING_DRAWN_CARD` | ET.15 « Vie Quotidienne » | Une des cartes piochées, pour son action gratuite puis pour son revenu (`CARD`) | Non |
| `REMOVING_ORBITER` / `REMOVING_LANDER` | Cartes 15 et 84 | Planète (`PLANET`) | Non |
| `CHOOSING_BONUS_ACTION` | Plusieurs gains à choix | Entrée du menu (`MENU`) | Oui |
| `ACQUIRING_ALIEN_CARD` | Découverte, bonus | Carte Alien (`ALIEN_CARD`) | Non |
| `CHOOSING_CENTAURIEN_REWARD` | Palier Centaurien | Tuile Message (`CENTAURIEN`) | Non |
| `COLLECTING_SPECIMEN` / `CONSULTING_SPECIMEN` | Cartes Mascamites | Spécimen (`SPECIMEN`) | Non |
| `CHOOSING_EXERTIEN_CARD` | Palier Exertien, découverte des Exertiens (palier 0) | Carte ou renoncement (`EXERTIEN`) | Non (renoncer est un choix) |
| `CHOOSING_MISSION_REQUIREMENT` | Mission déclenchée pendant le tour d'un autre joueur | Cercle ou renoncement (`MISSION`) | Non (renoncer est un choix) |
| `RESOLVING_SECTOR`, `TRIGGER_CARD_EFFECT`, `DRAW_AND_SCAN`, `CLAIMING_MISSION_REQUIREMENT` | Secteur plein, effets automatiques | Aucun : résolues par le moteur (`InteractionResolver`) | — |

Une interaction peut viser un autre joueur que le joueur actif (par exemple le gagnant d'un secteur couvert par un robot) : seul ce joueur peut y répondre. Une interaction d'un robot est résolue par le robot lui-même.

## 5. Les robots

### 5.1 Niveaux

- **Débutant (EASY)** : simule chaque action principale et en tire une au hasard parmi les 3 meilleures qui améliorent sa position ; sinon il passe. Actions gratuites occasionnelles.
- **Intermédiaire (MEDIUM)** : simule chaque action principale et chaque action gratuite avec le vrai moteur, note la position obtenue et garde la meilleure. Il passe quand rien n'améliore sa position.
- **Expert (EXPERT)** : comme l'Intermédiaire, mais compte aussi les points du décompte final déjà acquis. Sur 72 parties contre l'Intermédiaire : 61 % de victoires, environ +11 PV.

Pour les choix aléatoires (pioche, spécimen…), un robot compare 4 tirages et garde le meilleur. Chaque placement de trace de vie est simulé.
Les robots jouent avec exactement les mêmes opérations que le joueur humain : mêmes vérifications, mêmes gains, mêmes messages dans l'historique (défausse pour une action gratuite, achat ou échange contre une carte à choisir dans la rangée ou la pioche, déplacements gratuits, colonne de l'ordinateur pour une technologie Informatique, réservation de mise en place). Un robot choisit sa carte de fin de manche comme le joueur humain, une fois passé (il ne voit pas la pile avant) : l'Intermédiaire et l'Expert simulent chaque carte, le Débutant la tire au hasard.
Un robot joue une étape toutes les 1,5 s ; le calcul tourne dans un Web Worker pour ne pas figer l'interface.

### 5.2 Évaluation d'une position

```
valeur = PV
       + f × (ressources + plateau)
       + manches restantes × incomePerRound × (revenus pondérés)
       + endGame × décompte final acquis          (Expert)
       + valeur des cartes Exertiens jouées
       − pénalité de danger attendue
```

- `f` vaut 1, puis `lastRoundFactor` pendant la dernière manche.
- **Ressources** : crédits, énergie, Médias, données et cartes en main (au plus `maxUsefulCards`).
- **Plateau** : cases d'ordinateur, signaux, secteurs en cours (Média et part du bonus si majoritaire), traces de vie, découvertes promises, cartes Alien, technologies, missions ouvertes, cartes jouées, orbiteurs, atterrisseurs, sondes (selon leur distance à une planète), capsules (selon leur distance à la destination).

### 5.3 Poids (`AIEvaluator.DEFAULT_WEIGHTS`)

| Poids | Valeur | Rôle |
|---|---|---|
| `credit` | 1,06 | Un crédit |
| `energy` | 1,1 | Une énergie |
| `media` | 0,66 | Un Média |
| `data` | 0,35 | Une donnée en réserve |
| `card` | 0,66 | Une carte en main |
| `maxUsefulCards` | 10,16 | Nombre de cartes au-delà duquel une carte ne vaut plus rien |
| `computerSlot` | 0,21 | Une case d'ordinateur remplie |
| `signal` | 0,24 | Un signal posé |
| `lifeTrace` | 1,44 | Une trace de vie |
| `technology` | 2,77 | Une technologie |
| `openMission` | 1,23 | Une condition de mission ouverte |
| `playedCard` | 0,4 | Une carte jouée devant soi |
| `probeInSystem` | 1,15 | Une sonde dans le système solaire |
| `probeOnPlanet` | 6,7 | Une sonde sur une planète |
| `probeStep` | 1,13 | Retrait par case qui sépare la sonde d'une planète |
| `orbiter` | 5,59 | Un orbiteur |
| `lander` | 9,37 | Un atterrisseur |
| `capsule` | 2,06 | Une capsule en route |
| `capsuleAtDestination` | 4,97 | Une capsule arrivée |
| `capsuleStep` | 0,88 | Retrait par case restante pour une capsule |
| `incomePerRound` | 2,53 | Valeur d'un revenu par manche restante |
| `discoveryClaim` | 5,66 | Carte Alien promise par une 1re trace d'une couleur |
| `alienCard` | 1,39 | Une carte Alien en main |
| `sectorLead` | 1,27 | Part du bonus de couverture quand on est majoritaire |
| `sectorLifeTraceValue` | 2,24 | Valeur d'une trace de vie promise par un secteur |
| `endGameBefore` | 0,18 | Poids du décompte final avant la dernière manche (Expert) |
| `endGameLastRound` | 1 | Poids du décompte final pendant la dernière manche |
| `lastRoundFactor` | 0,59 | Facteur des ressources pendant la dernière manche |
| `freeActionMinGain` | 0,22 | Gain minimal pour faire une action gratuite |
| `dangerPenalty` | 2,65 | Échelle de la pénalité de danger (Exertiens) |
| `dangerMarginDecay` | 0,9 | Réduction de la pénalité par point d'écart avec le plus exposé |
| `exertienStepChance` | 0,12 | Chance par étape manquante d'une condition Exertien |
| `minPointsPerRound` | 17,04 | Score minimal estimé par manche (pour la pénalité de 10 %) |

### 5.4 Réglage (SPSA)

- Les poids sont réglés ensemble par **SPSA** : on perturbe tous les poids à la fois, on fait jouer deux Experts (poids + et −) l'un contre l'autre, et on déplace les poids vers le côté gagnant.
- Banc : `tools/spsa` (`npm run tune:ai`), parties à 2 et 3 joueurs.
- Dernier réglage : +6,6 ± 1,5 PV contre les anciens poids (229 victoires contre 173, 404 parties).
- Comparer deux niveaux demande au moins une cinquantaine de parties : les scores sont très dispersés.

## 6. Architecture

### 6.1 Organisation

- `core/` : modèle (`types.ts`), moteur, plateau, géométrie, tours, persistance, hasard.
- `actions/` : une classe par action principale (validation, exécution).
- `systems/` : règles métier (sondes, cartes, scan, ressources, ordinateur, technologies, espèces).
- `session/` : la partie comme session (point d'entrée unique des commandes).
- `ai/` : robots (actions possibles, évaluation, interactions, tour).
- `ui/` : React ; affiche la partie et envoie des commandes, sans aucune règle.

### 6.2 Session et commandes

- `GameSession.dispatch(partie, joueur, commande)` vérifie qui joue et ce qui est permis, applique la règle, résout les interactions automatiques et celles des robots, termine les tours, et renvoie `{ game, entries, notifications, error }`.
- Commandes (`session/commands.ts`) : `LAUNCH_PROBE`, `SCAN`, `ANALYZE`, `RESEARCH_TECH`, `ORBIT`, `LAND`, `PLAY_CARD`, `PASS`, `MOVE_PROBE`, `TRADE`, `BUY_CARD`, `DISCARD_FOR_FREE_ACTION`, `TRANSFER_DATA`, `CLAIM_MISSION`, `CHOOSE`, `SKIP`, `END_TURN`. Toutes sérialisables.
- `InteractionQueue` : file d'interactions dans l'état (`game.interaction`, `game.pendingInteractions`).
- `SessionJournal` : historique et annulation.
- `viewFor(partie, joueur)` (`session/PlayerView.ts`) : ce qu'un joueur a le droit de voir. Elle masque la pioche, les mains adverses (sauf les cartes révélées), les cartes Exertiens adverses jusqu'au décompte, les spécimens, les espèces non découvertes, la graine et le détail des interactions d'un autre joueur. Les nombres restent visibles.
- Historique : un passage qu'un seul joueur peut lire (nom d'une carte piochée face cachée) est marqué par le moteur (`privateText` dans `core/historyText.ts`). Le jeu local affiche tout ; `viewEntries(entrées, joueur)` retire les passages des autres joueurs et les états d'annulation.

### 6.3 Principes

- **État immuable** : chaque opération copie la partie (`cloneGame`) et ne modifie jamais celle reçue. Les effets des cartes et des technologies sont figés et partagés entre les copies.
- **Hasard reproductible** : générateur à graine (`core/random.ts`) ; son état (`game.rngState`) est dans la partie. Même graine et mêmes choix donnent la même partie.
- **Les robots passent par les mêmes opérations** que le joueur humain.
- **Persistance** : `GamePersistence` (sauvegardes versionnées avec migrations) et sauvegarde automatique.

### 6.4 Cartes (CSV)

Les cartes sont dans `public/cards/*.csv` (séparateur `;`) :

```
Id;Nom;Type;Texte;Action gratuite;Couleur scan;Revenu;Cout;Gain;Contrainte
```

- `Gain` : gains immédiats, par exemple `1 Sonde + 1 Média`.
- `Contrainte` : effets passifs et missions, par exemple `GAIN_ON_VISIT:jupiter:data:1`, `VISIT_PLANET:mars:4`, `END_CONDITION:<type>:<paramètre>:<seuil>:<PV>` (Exertiens), `RECEPTION:<récompenses>` (Centauriens).

### 6.5 Tests et commandes

```
npm run dev            # lance le jeu
npm run check          # typecheck + lint + tests + build (avant chaque commit)
npm test               # tests Jest du moteur
npm run test:e2e       # tests Playwright dans un navigateur
npm run tune:ai        # banc de réglage des robots
npm run server         # serveur du jeu à distance (server:build puis server:start)
```

## 7. Vers le jeu à distance

| Étape | Contenu | État |
|---|---|---|
| 0 | Session autonome, commandes validées, file d'interactions dans l'état, fin de tour dans le moteur, hasard par partie, annulation bornée | Fait |
| 1 | Vue par joueur `viewFor` et historique filtré `viewEntries` | Fait (pas utilisés par le jeu local) |
| 2 | Serveur Node avec le même moteur et des WebSockets : salles, places, reconnexion, robots côté serveur, enregistrement | Fait |
| 3 | Client réseau : l'interface envoie ses commandes au serveur et affiche la vue reçue | Fait |

Le jeu solo n'est pas concerné : il garde la session dans le navigateur, sans serveur. Le mode en ligne s'ajoutera à côté, derrière la même interface (`useGameSession`).

### 7.1 Le serveur

- Lancement : `npm run server` (port `PORT`, 8787 par défaut ; salles enregistrées dans `SETI_DATA_DIR`, `server/data` par défaut). `GET /health` donne la version et le nombre de salles.
- **Salle** (`session/GameRoom.ts`, sans réseau, testée avec Jest) : un code de 5 lettres, 2 à 4 places (humains ou robots). Le créateur prend la première place humaine, les autres joueurs rejoignent avec le code. La partie démarre quand toutes les places humaines sont prises, avec un premier joueur tiré au hasard.
- **Jeton de place** : chaque joueur reçoit un jeton secret ; avec le code, il permet de reprendre sa place après une coupure (une seule connexion par place).
- **Robots** : ils jouent sur le serveur, une étape toutes les 1,5 s, par les mêmes opérations que dans le jeu local.
- **Enregistrement** : chaque salle est écrite sur disque après chaque changement (un fichier JSON par salle, écriture atomique) et relue au redémarrage.
- **Ce que reçoit chaque joueur** : sa vue de la partie (`viewFor`) et l'historique qu'il peut lire (`viewEntries`), après chaque changement.
- **Pas d'annulation en ligne** : elle reviendrait aussi sur les actions des autres joueurs.

### 7.2 Protocole (`session/protocol.ts`)

Messages JSON sur WebSocket.

| Sens | Message | Rôle |
|---|---|---|
| Client → serveur | `create { version, name, seats }` | Crée une salle (`seats` : `{ type: 'human' }` ou `{ type: 'robot', aiDifficulty }`) |
| Client → serveur | `join { version, code, name }` | Prend une place libre |
| Client → serveur | `resume { version, code, token }` | Reprend sa place |
| Client → serveur | `command { command }` | Une commande de la session (`LAUNCH_PROBE`, `CHOOSE`…) |
| Serveur → client | `welcome { code, token, playerId }` | Place obtenue (garder le jeton) |
| Serveur → client | `state { room, you, game, entries }` | Vue de la partie pour ce joueur |
| Serveur → client | `notification { messages }` | Annonces (découverte d'une espèce…) |
| Serveur → client | `error { message }` | Refus (version, salle, commande non permise…) |

Client et serveur doivent avoir la même version aux deux premiers numéros près (1.1.x). Chaque commande porte un `requestId` ; le serveur répond par `ack { requestId, error? }` après avoir envoyé l'état qui en découle.

### 7.3 Le client (`session/RemoteClient.ts`)

- Pur (testé avec Jest contre le vrai serveur) : création, arrivée, reprise de la place, commandes ; une commande se termine à l'accusé de réception, la partie reçue est alors à jour.
- Reconnexion automatique (reprise de la place par son jeton), pendant 2 minutes au plus ; une place inconnue du serveur (salle perdue) est oubliée.
- Dans l'interface : `useOnlineSession` (place gardée dans le navigateur, `seti_online`), `OnlineModal` (créer, rejoindre, salon). `BoardUI` envoie ses commandes au serveur au lieu de la session locale, n'affiche pas les interactions des autres joueurs, et traite les autres joueurs humains comme des robots pour l'affichage (actions désactivées pendant leur tour).

### 7.4 Déploiement

1. **Serveur sur Render** (offre gratuite) : New → Blueprint, choisir le dépôt ; `render.yaml` crée le service `seti-server` (`npm ci && npm run server:build`, puis `npm run server:start`, vérification `/health`). Renseigner `ALLOWED_ORIGINS` avec l'adresse du site Netlify (ex. `https://mon-seti.netlify.app`).
2. **Site sur Netlify** : variable d'environnement `VITE_SERVER_URL=wss://seti-server.onrender.com` (l'adresse donnée par Render, en `wss://`), puis redéployer : le bouton **Partie en ligne** apparaît.
3. En local : `npm run server` puis `npm run dev` (le jeu se connecte à `ws://localhost:8787`).
