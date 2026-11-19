<!--
Textes du tutoriel. Un chapitre par titre « # Titre {#identifiant} », suivi de sa présentation (menu des chapitres),
puis une section par étape « ## Titre {#identifiant} » : mêmes identifiants que src/tutorial/chapters.ts
(test/TutorialText.test.ts vérifie la correspondance). Relire ce fichier quand une règle ou l'écran change.
-->

# L'écran et le tour {#ecran}
Les zones de l'écran et votre premier tour.

## Bienvenue {#bienvenue}
Bienvenue dans **SETI** ! Votre équipe cherche des signes de vie extraterrestre : explorer le système solaire, scanner le ciel, analyser des données et découvrir des espèces Alien. Le joueur qui a le plus de points de victoire (PV) après **5 manches** gagne.

Ce tutoriel avance pas à pas. Survolez librement les éléments : chaque infobulle détaille ce que vous voyez.

## Le système solaire {#systeme-solaire}
Au centre, le **système solaire** : 5 disques et 8 secteurs, avec la Terre, les planètes, les comètes et les champs d'astéroïdes. Les 3 anneaux supérieurs **tournent** pendant la partie et emportent les sondes posées dessus.

## Votre plateau {#plateau-joueur}
À gauche, votre **plateau de joueur**. Les onglets en haut affichent le plateau de chaque joueur : vous pouvez regarder celui de votre adversaire à tout moment.

## Vos ressources {#ressources}
Vos **ressources** : score, crédits, énergie, cartes en main, médias et données. Sous chacune, sa limite ; leur infobulle propose les échanges possibles. La tuile des revenus montre ce que vous recevrez à chaque nouvelle manche.

## Les actions principales {#actions}
À chaque tour, vous faites **une seule action principale** parmi les 8 hexagones : lancer une sonde, mettre en orbite, atterrir, scanner, analyser, jouer une carte, rechercher une technologie ou passer. L'infobulle d'une action donne son coût, son effet et, si elle est impossible, pourquoi.

## La rangée de cartes {#rangee}
La **rangée de cartes** : on y pioche (achat avec des médias, bonus) et le scan y choisit la couleur d'un signal.

Ce panneau s'ouvre ici tout seul. En partie, cliquez sur son **bandeau titre** pour l'ouvrir et le garder visible ; un clic ailleurs le referme.

## Les technologies {#technologies}
Le **plateau des technologies** : Exploration, Observation et Informatique. Une technologie rend une action plus puissante pour le reste de la partie.

Ce panneau s'ouvre ici tout seul. En partie, cliquez sur son **bandeau titre** pour l'ouvrir et le garder visible ; un clic ailleurs le referme.

## Les objectifs {#objectifs}
Les **tuiles objectif** rapportent des points en fin de partie. Vous y posez un marqueur en franchissant les paliers de score (25, 50 et 70 PV).

Ce panneau s'ouvre ici tout seul. En partie, cliquez sur son **bandeau titre** pour l'ouvrir et le garder visible ; un clic ailleurs le referme.

## Les espèces Alien {#especes}
Les **plateaux des espèces Alien**, face cachée. Les traces de vie que vous découvrez s'y posent ; une espèce est découverte quand ses trois emplacements de couleur sont occupés.

Ce panneau s'ouvre ici tout seul. En partie, cliquez sur son **bandeau titre** pour l'ouvrir et le garder visible ; un clic ailleurs le referme.

## L'historique {#historique}
L'**historique** raconte la partie, action par action. Vous pouvez annuler votre dernière action (et même tout votre tour) tant que le tour suivant n'est pas joué.

Pendant le tutoriel, l'historique reste réduit pour laisser voir le plateau. Cliquez sur son **bandeau titre** pour l'ouvrir et le garder visible.

## Lancez une sonde {#lancer}
À vous ! Cliquez sur l'hexagone **Lancer une sonde** (2 crédits), ou directement sur la **Terre** dans le système solaire : elle clignote. La sonde apparaît sur la Terre.

## Terminez votre tour {#fin-du-tour}
Votre action principale est faite : cliquez sur **Fin du tour**. Avant de finir, vous pouvez toujours faire des actions gratuites (déplacer une sonde, échanger des ressources…).

## Bravo ! {#conclusion}
Vous connaissez l'écran et le déroulement d'un tour. Le chapitre suivant vous emmène sur Mars.

# Sondes {#sondes}
Lancez une sonde et mettez-la en orbite.

## Les sondes {#intro}
Les sondes explorent le système solaire. Arrivées sur une planète, elles peuvent s'y mettre en **orbite** ou s'y **poser** : chacune de ces actions rapporte des gains.

## Lancez une sonde {#lancer}
Cliquez sur l'hexagone **Lancer une sonde**, ou sur la **Terre** dans le système solaire : la sonde part de la Terre. Vous ne pouvez avoir qu'une sonde à la fois dans le système solaire (deux avec la technologie Exploration I).

## Annulez vos déplacements {#annuler}
Votre sonde est trop loin : votre énergie ne suffit plus pour rejoindre **Mars** puis payer la mise en orbite (1 énergie). Pas de panique, un déplacement s'annule.

Ouvrez l'**historique** (il s'ouvre ici tout seul) et cliquez sur la flèche **↩** de son bandeau titre pour annuler votre dernière action. Recommencez jusqu'à ce que la sonde puisse de nouveau atteindre Mars : l'énergie dépensée vous est rendue.

## Déplacez-la jusqu'à Mars {#deplacer}
Déplacer une sonde est une **action gratuite** : 1 énergie par case. Cliquez sur votre sonde, puis sur une case voisine en direction de **Mars**. Mars est à deux cases de la Terre.

## Terminez votre tour {#fin-du-tour}
Votre action principale de ce tour était le lancement. Cliquez sur **Fin du tour** : votre adversaire a déjà passé, vous rejouez aussitôt.

## Mettez-la en orbite {#orbite}
Nouveau tour : cliquez sur l'hexagone **Mettre en orbite** (1 crédit et 1 énergie). La fenêtre de Mars s'ouvre : cliquez alors sur l'**emplacement d'orbiteur** mis en avant (les autres sont grisés). Vous pouvez aussi survoler Mars dans le système solaire pour ouvrir cette fenêtre.

Votre sonde devient un orbiteur et vous recevez les gains de la case. À Mars, le premier orbiteur gagne **3 PV**, puis, comme les suivants : **une carte** (à prendre dans la rangée ou sur la pioche), **un signal** dans le secteur de Mars et **une réservation** (une carte de votre main glissée sous votre plateau, qui augmente vos revenus). Le jeu vous demande dans quel ordre les résoudre : cliquez sur chaque bonus tour à tour, puis faites le choix qu'il demande.

## Bien joué ! {#conclusion}
Le **panneau des planètes** montre vos orbiteurs et atterrisseurs. Un orbiteur rend aussi l'atterrissage moins cher : c'est le sujet du chapitre suivant.

# Atterrir et médias {#atterrir}
Atterrissez sur Mars, achetez une carte.

## Sur Mars {#intro}
Vous avez déjà un orbiteur sur Mars, et une deuxième sonde vient d'y arriver. Le panneau des planètes montre les cases d'orbite et d'atterrissage de chaque planète.

## Atterrissez {#atterrir}
Cliquez sur l'hexagone **Atterrir**, ou, dans la fenêtre de Mars (survolez la planète), sur l'**emplacement d'atterrisseur** mis en avant (les autres sont grisés). Il en coûte 3 énergies, seulement 2 quand un orbiteur est déjà là. Votre atterrisseur prend le premier emplacement libre : son gain est affiché à côté (survolez-le pour le détail). Un gain de trace de vie vous demande ensuite où la poser sur un plateau Alien.

## Posez la trace de vie jaune {#trace-jaune}
Cette case d'atterrissage rapporte une **trace de vie jaune**. Posez-la : cliquez sur l'emplacement **jaune** d'une espèce Alien (les plateaux en bas de l'écran).

La **première** trace d'une couleur posée sur une espèce rapporte son **bonus de découverte** (affiché sur l'emplacement, survolez-le) ; les suivantes, un bonus plus petit. Quand les trois emplacements de l'espèce sont occupés, elle est **découverte** : le joueur qui a posé la première trace d'une couleur reçoit en plus une **carte de cette espèce**.

## Les médias {#medias}
Les **médias** mesurent l'intérêt du public pour votre programme (10 au plus). On en gagne en visitant certaines cases, avec des cartes, en remplissant l'ordinateur… et on les dépense pour acheter des cartes ou rechercher des technologies.

## Achetez une carte {#acheter}
Ouvrez l'infobulle de vos **médias** et achetez une carte (3 médias) : prenez-la dans la rangée ou sur la pioche. C'est une action gratuite : elle ne compte pas comme votre action principale.

## Parfait ! {#conclusion}
Orbiter, atterrir, gagner des médias et des cartes : vous maîtrisez l'exploration. Place à l'observation du ciel.

# Scanner {#scanner}
Posez des signaux, gagnez des données.

## Les secteurs {#intro}
Le système solaire est découpé en 8 **secteurs** de couleur, chacun avec ses cases de signal. Quand toutes les cases d'un secteur sont remplies, le joueur majoritaire en reçoit la récompense (souvent une trace de vie). Ici, le secteur de la Terre est presque plein : vos signaux, et un signal de votre adversaire sur la première case.

## Scannez {#scanner}
Cliquez sur **Scanner** (1 crédit et 2 énergies) : un signal se pose dans le secteur de la Terre, puis vous choisissez une carte de la rangée pour un second signal dans un secteur de sa couleur. La carte est défaussée.

## Posez la trace de vie rouge {#trace-rouge}
Votre signal a rempli le **secteur de la Terre** : vous y étiez majoritaire, vous en recevez la récompense, une **trace de vie rouge** (le secteur est ensuite vidé pour être de nouveau rempli). Posez-la : cliquez sur l'emplacement **rouge** d'une espèce Alien (les plateaux en bas de l'écran).

La **première** trace d'une couleur posée sur une espèce rapporte son **bonus de découverte** (affiché sur l'emplacement, survolez-le) ; les suivantes, un bonus plus petit. Quand les trois emplacements de l'espèce sont occupés, elle est **découverte** : le joueur qui a posé la première trace d'une couleur reçoit en plus une **carte de cette espèce**.

## Secteur couvert {#couverture}
Quand un secteur est couvert, **chaque joueur présent** gagne **1 média**, majoritaire ou non : votre adversaire en a profité aussi.

Le secteur est ensuite vidé, sauf pour le **second** : votre adversaire garde un marqueur sur la **première case**. Il part avec une longueur d'avance pour la prochaine couverture de ce secteur.

## Vos signaux {#signaux}
Vos marqueurs sont maintenant sur le système solaire. Survolez un secteur pour voir ses cases, sa récompense et qui y est majoritaire.

## Les données {#donnees}
Certaines cases de signal rapportent une **donnée** : elle s'ajoute à votre réserve (6 au plus). Les données se placent ensuite dans votre ordinateur, comme vous le verrez au chapitre suivant.

## C'est noté {#conclusion}
Scanner régulièrement vous rapproche des majorités dans les secteurs. Les technologies Observation ajoutent des signaux à chaque scan.

# Ordinateur et analyse {#ordinateur}
Remplissez l'ordinateur, puis analysez.

## L'ordinateur {#intro}
Votre **ordinateur de données** a une ligne du haut à remplir de gauche à droite. Certaines cases rapportent un bonus (média, réservation d'une carte…). Ici, les quatre premières cases sont déjà remplies pour vous : il reste les deux dernières.

## Placez une donnée {#placer}
Transférer une donnée est une **action gratuite** : cliquez sur la prochaine case libre de la ligne du haut de l'ordinateur.

## Remplissez la ligne {#remplir}
Placez votre deuxième donnée sur la dernière case : la ligne du haut est pleine, l'analyse devient possible.

## Analysez {#analyser}
Cliquez sur **Analyser les données** (1 énergie) : l'ordinateur se vide et vous gagnez une **trace de vie bleue**.

## Posez la trace de vie bleue {#trace-bleue}
Posez votre trace : cliquez sur l'emplacement **bleu** d'une espèce Alien (les plateaux en bas de l'écran).

La **première** trace d'une couleur posée sur une espèce rapporte son **bonus de découverte** (affiché sur l'emplacement, survolez-le) ; les suivantes, un bonus plus petit. Quand les trois emplacements de l'espèce sont occupés, elle est **découverte** : le joueur qui a posé la première trace d'une couleur reçoit en plus une **carte de cette espèce**.

Le chapitre « Traces de vie et espèces » va jusqu'à la découverte.

# Cartes et missions {#cartes}
Trois sortes de missions, une défausse.

## Votre main {#intro}
Vos **cartes en main** s'affichent sur votre plateau. Elles se lisent comme les vraies cartes : l'action gratuite en haut à gauche, la couleur de scan dans le triangle en haut à droite, le coût dans le badge à gauche du nom, l'effet en symboles au centre et le revenu dans le bandeau du bas. Une carte se joue en payant son coût. Cliquez sur une carte pour faire apparaître ses deux boutons : **jouer** (bleu) et **défausser** (rouge). Nous vous avons donné trois cartes : **ISS**, **Télescope Lovell** et **Mars Science Laboratory**.

## Jouez ISS {#jouer}
Cliquez sur la carte **ISS**, puis sur son bouton bleu pour la jouer (2 crédits). Vous gagnez 1 média, et la carte reste devant vous comme **mission déclenchée**.

## Les missions déclenchées {#mission}
Une mission déclenchée a des **cercles** : chacun peut être recouvert quand son déclencheur se produit, ici le lancement d'une sonde. Chaque cercle recouvert donne sa récompense.

## Défaussez une carte {#defausser}
Toute carte de la main peut être **défaussée pour son action gratuite**, indiquée dans son coin supérieur gauche : 1 déplacement, 1 donnée ou 1 média. Cliquez sur une carte que vous ne jouerez pas (pas l'une des deux autres cartes données), puis sur son bouton rouge. Une carte dont l'action gratuite est un déplacement demande une sonde dans le système solaire : vous n'en avez pas encore, choisissez-en une autre (l'infobulle du bouton dit pourquoi il est grisé). C'est une action gratuite : elle ne compte pas comme votre action principale.

## Terminez votre tour {#fin-du-tour}
Jouer ISS était votre action principale. Cliquez sur **Fin du tour**.

## Lancez une sonde {#lancer}
Cliquez sur **Lancer une sonde** : c'est le déclencheur de la mission ISS.

## Réclamez la récompense {#valider}
Les cercles réalisables de la carte ISS s'allument : cliquez sur celui que vous voulez recouvrir. Un même déclencheur ne recouvre qu'un seul cercle : choisissez le plus utile, les autres attendront un prochain lancement.

## Terminez votre tour {#fin-du-tour-2}
Cliquez sur **Fin du tour** pour passer à la mission suivante.

## Les missions conditionnelles {#conditionnelle}
Une **mission conditionnelle** a un **carré** : quand sa condition est remplie, vous la réclamez au moment de votre choix (action gratuite). Le Télescope Lovell demande d'avoir au moins 8 médias : avec le média gagné par ISS, c'est votre cas.

## Jouez le Télescope Lovell {#jouer-conditionnelle}
Jouez le **Télescope Lovell** (3 crédits). Il rapporte 1 donnée et un scan : faites le scan (signal, carte de la rangée). Sa condition est déjà remplie : l'historique indique une mission à recouvrir.

## Recouvrez le carré {#carre}
Cliquez sur le **carré** surligné du Télescope Lovell, dans vos missions : vous gagnez sa récompense (3 PV et une carte au choix). C'est vous qui décidez du moment, tant que la condition reste remplie : ici, gardez au moins 8 médias.

## Terminez votre tour {#fin-du-tour-3}
Cliquez sur **Fin du tour** pour jouer la carte Fin de jeu.

## Jouez la carte Fin de jeu {#fin-de-jeu}
Jouez **Mars Science Laboratory** (2 crédits) : vous gagnez tout de suite 1 média et 2 données, et la carte reste devant vous jusqu'à la fin de la partie.

## Le décompte final {#decompte}
Une carte **Fin de jeu** rapporte ses points au décompte final, d'après l'état du plateau à ce moment : ici, 4 PV pour chacun de vos orbiteurs et atterrisseurs sur Mars. Pensez-y dans vos prochaines actions.

# Technologies {#technologies}
Recherchez une technologie.

## Le plateau des technologies {#intro}
Trois familles : **Exploration** (sondes), **Observation** (scan) et **Informatique** (ordinateur). Chaque pile compte 4 tuiles et un joueur n'y prend qu'une technologie.

Chaque tuile rapporte un gain immédiat, affiché en bas : **3 PV**, **1 média**, **1 énergie** ou **une carte au choix**. La tuile du dessus d'une pile rapporte en plus **2 PV** (le badge en haut à droite) : le premier à prendre une pile les gagne.

## Recherchez {#rechercher}
Cliquez sur **Rechercher une technologie** (6 médias). Avant de choisir la technologie, regardez le système solaire : la recherche le fait tourner.

## La rotation {#rotation}
La recherche vient de faire **tourner** un anneau du système solaire : les planètes et les sondes posées dessus ont changé de secteur. Gardez-le en tête pour vos déplacements.

Les **chevrons de couleur** posés sur le plateau montrent l'anneau qui tournera la prochaine fois : **bleu** pour l'anneau de Jupiter et Saturne, **rouge** pour celui de Mars, **jaune** pour celui de la Terre et de Mercure. Après chaque rotation, ils passent à l'anneau suivant (bleu, puis jaune, puis rouge).

Cliquez sur « Suivant » pour choisir votre technologie.

## Choisissez une technologie {#choisir}
Cliquez sur une tuile du plateau des technologies. Selon son gain, le jeu vous demande un choix de plus :

- une **carte au choix** : prenez-la dans la rangée de cartes ou sur la pioche ;
- une technologie **Informatique** : choisissez la colonne de votre ordinateur où la poser.

## Son effet {#effet}
Votre technologie apparaît sur votre plateau. Son infobulle rappelle son effet, actif pour le reste de la partie.

# Traces de vie et espèces {#especes}
Découvrez une espèce Alien.

## La découverte {#intro}
Chaque espèce Alien a un triangle de découverte : un emplacement **rouge**, un **jaune** et un **bleu**. Vos traces rouge et jaune sont déjà posées sur la première espèce : il ne manque que la bleue.

## Remplissez l'ordinateur {#remplir}
Placez vos deux données dans l'ordinateur pour en remplir la ligne du haut.

## Analysez {#analyser}
Cliquez sur **Analyser les données** (1 énergie) : l'ordinateur se vide et vous gagnez une **trace de vie bleue**.

## Annulez la trace {#annuler}
Votre trace bleue est sur la **mauvaise espèce** : la première ne sera pas découverte. Un placement s'annule.

Ouvrez l'**historique** (il s'ouvre ici tout seul) et cliquez sur la flèche **↩** de son bandeau titre pour annuler la pose (relancez l'analyse si elle est annulée avec). Posez ensuite la trace sur l'emplacement **bleu** de la première espèce.

## Posez la trace bleue {#poser}
Cliquez sur l'emplacement **bleu** de la première espèce, celle où vos traces rouge et jaune sont déjà posées : ses trois emplacements seront alors occupés.

## Terminez votre tour {#reveler}
Les trois emplacements sont occupés, mais une découverte se résout **à la fin du tour**, après les éventuels paliers. Cliquez sur **Fin du tour** : l'espèce est révélée.

## Espèce découverte ! {#decouverte}
Le tour est fini, l'espèce est révélée : ses règles s'appliquent désormais. Les joueurs qui ont posé une première trace d'une couleur reçoivent une **carte Alien** de l'espèce, et les traces suivantes iront sur sa **piste**.

Si vous n'avez encore jamais rencontré cette espèce en partie, elle reste ici anonyme : ses pistes et ses cartes sont cachées.

## Les paliers neutres {#paliers-neutres}
À **2 ou 3 joueurs**, la piste de score porte deux **paliers neutres**, à **20** et **30 PV**. Le premier joueur qui franchit l'un d'eux y pose un **marqueur neutre** (à 2 joueurs, les deux premiers) : il prend le premier emplacement libre d'un triangle de découverte (rouge, puis jaune, puis bleu, première espèce d'abord).

Ce marqueur n'appartient à personne : il occupe le bonus de découverte de sa couleur, et peut même compléter un triangle et faire découvrir une espèce. À 4 joueurs, il n'y a pas de palier neutre.

## À vous de chercher {#conclusion}
Chaque espèce a ses propres règles. Découvrez-les en partie : chaque espèce rencontrée débloque son chapitre du tutoriel et ses règles dans la documentation.

# Passer et fin de manche {#manche}
Passez et recevez vos revenus.

## Passer {#intro}
Quand vous ne voulez plus agir de la manche, vous **passez** : vous ne jouez plus jusqu'à la manche suivante. Vous ne gardez que 4 cartes en main.

## Passez {#passer}
Cliquez sur **Passer**. Vous découvrez alors la pile de fin de manche et y choisissez une carte. Votre adversaire passe à son tour : la manche se termine.

## Les revenus {#revenus}
Au début de chaque manche, chacun reçoit ses **revenus** : crédits, énergie et cartes. Ils augmentent avec les cartes que vous réservez (leur revenu, en bas de la carte).

## La rotation {#rotation}
Le premier joueur à passer fait **tourner** le système solaire. Regardez où sont maintenant les planètes : c'est l'anneau que montraient les **chevrons de couleur**, qui indiquent maintenant le prochain.

## Nouvelle manche {#conclusion}
La partie compte 5 manches. Passer tôt fait tourner le système à votre avantage, mais vous laisse moins d'actions.

# Paliers et fin de partie {#fin-de-partie}
Un palier de score, puis la dernière manche.

## Les paliers {#intro}
Nous sommes à la **5ᵉ et dernière manche**, et vous avez 26 PV. Les **paliers dorés** (25, 50 et 70 PV) sont vérifiés à la fin du tour : celui qui les franchit pose un marqueur sur une tuile objectif.

## Franchissez le palier {#palier}
Jouez une action principale (lancez une sonde), puis cliquez sur **Fin du tour** : le palier de 25 PV est atteint, choisissez une tuile objectif.

## Les objectifs {#objectifs}
Chaque tuile rapporte des points au décompte final, selon votre rang dans sa catégorie (technologies, missions, revenus…).

## Terminez la partie {#passer}
Cliquez sur **Passer** : c'est la fin de la dernière manche, le décompte final commence.

## Le décompte final {#conclusion}
L'écran de fin détaille les points de chacun : tuiles objectif, cartes Fin de partie, espèces. Vous êtes prêt pour une vraie partie !

# Mascamites {#mascamites}
Ramenez un spécimen sur Terre.

## Une espèce à découvrir {#intro}
Vos traces rouge et jaune sont déjà posées sur le triangle de découverte de la première espèce : il ne manque que la bleue. Vous découvrirez ici les **Mascamites**.

## Analysez {#analyser}
La ligne du haut de votre ordinateur est pleine : cliquez sur **Analyser les données** (1 énergie) pour gagner une **trace de vie bleue**.

## Posez la trace bleue {#poser}
Cliquez sur l'emplacement **bleu** du triangle de la première espèce : ses trois emplacements seront occupés et l'espèce sera **découverte à la fin du tour**.

## Terminez votre tour {#reveler}
Les trois emplacements sont occupés, mais une découverte se résout **à la fin du tour**, après les éventuels paliers. Cliquez sur **Fin du tour** : l'espèce est révélée.

## Les Mascamites {#decouverte}
L'espèce est révélée : ses **pistes** remplacent le triangle et ses règles s'appliquent. Comme vous avez posé les trois premières traces, vous recevez trois **cartes Alien** de l'espèce. Votre adversaire a passé : c'est déjà à vous de rejouer.

## Les spécimens {#specimens}
À la découverte, 7 **spécimens** sont mélangés : 3 face cachée sur **Jupiter**, 3 sur **Saturne**, et le 7e face visible sur la piste bleue. Survolez Jupiter : vous voyez des « ? », car vous ne savez pas encore ce qu'ils rapportent.

## Prélevez un spécimen {#prelever}
Votre sonde est sur Jupiter. Jouez la carte **Premier Contact** : elle fait atterrir votre sonde (sur Jupiter, sans la déplacer), puis vous laisse **prélever un spécimen** : une fenêtre montre les spécimens de Jupiter et leur récompense. Choisissez-en un.

## La capsule {#capsule}
Le spécimen part dans une **capsule**, posée sur Jupiter. Elle se déplace comme une sonde (énergie ou déplacements gratuits), mais ne compte pas dans votre limite de sondes et ne peut ni se mettre en orbite ni atterrir. Vous seul voyez le spécimen qu'elle transporte.

## Annulez vos déplacements {#annuler}
Votre capsule est trop loin : votre énergie ne suffit plus pour la ramener sur la **Terre**. Un déplacement s'annule.

Ouvrez l'**historique** (il s'ouvre ici tout seul) et cliquez sur la flèche **↩** de son bandeau titre pour annuler votre dernier déplacement. Recommencez jusqu'à ce que la capsule puisse de nouveau atteindre la Terre : l'énergie dépensée vous est rendue.

## Ramenez-la sur Terre {#ramener}
Déplacez la capsule jusqu'à la **Terre** : cliquez dessus, puis sur une case voisine, comme pour une sonde.

## Recouvrez la mission {#mission}
La capsule est arrivée : la mission de **Premier Contact** est réalisable. Cliquez sur son cercle surligné : vous gagnez la récompense de la carte **et** celle du spécimen. Le jeton du spécimen rejoint la piste bleue des Mascamites, où il devient le gain de sa case.

## Bien rapporté ! {#conclusion}
D'autres cartes Mascamites permettent d'**étudier** un spécimen (gagner sa récompense sans le prélever) ou de le ramener sur Mars. La documentation détaille toutes les règles de l'espèce.

# Anomalies {#anomalies}
La Terre rencontre une anomalie.

## Une espèce à découvrir {#intro}
Vos traces rouge et jaune sont déjà posées sur le triangle de découverte de la première espèce : il ne manque que la bleue. Vous découvrirez ici les **Anomalies**.

## Analysez {#analyser}
La ligne du haut de votre ordinateur est pleine : cliquez sur **Analyser les données** (1 énergie) pour gagner une **trace de vie bleue**.

## Posez la trace bleue {#poser}
Cliquez sur l'emplacement **bleu** du triangle de la première espèce : ses trois emplacements seront occupés et l'espèce sera **découverte à la fin du tour**.

## Terminez votre tour {#reveler}
Les trois emplacements sont occupés, mais une découverte se résout **à la fin du tour**, après les éventuels paliers. Cliquez sur **Fin du tour** : l'espèce est révélée.

## Les Anomalies {#decouverte}
L'espèce est révélée : ses **pistes** remplacent le triangle et ses règles s'appliquent. Comme vous avez posé les trois premières traces, vous recevez trois **cartes Alien** de l'espèce. Votre adversaire a passé : c'est déjà à vous de rejouer.

## Les jetons d'anomalie {#jetons}
Trois **anomalies** sont apparues en bordure du système solaire : une dans le secteur de la Terre, les deux autres à trois secteurs de part et d'autre. Chacune a une couleur et une récompense (survolez-les).

Quand une **rotation** amène la Terre dans le secteur d'une anomalie, le joueur le plus haut sur la piste de cette couleur gagne sa récompense.

## Deux tours plus tard… {#ellipse}
Chaque rotation n'avance la Terre que d'un secteur. Avancez de deux tours : le système solaire a tourné deux fois, la Terre n'est plus qu'à un secteur d'une anomalie, et vous avez posé une trace sur la piste de sa couleur. Cliquez sur **Suivant** pour faire ce saut dans le temps.

## Faites tourner le système solaire {#rechercher}
Rechercher une technologie fait d'abord tourner le système solaire. Cliquez sur **Rechercher une technologie** (6 médias) : la Terre arrive sur l'anomalie. Si sa récompense demande un choix, le jeu vous laisse choisir l'ordre : la récompense, puis votre technologie.

## La récompense {#recompense}
L'anomalie a été activée : vous étiez le plus haut sur la piste de sa couleur, vous avez gagné sa récompense. L'historique le raconte.

## Bien vu ! {#conclusion}
Surveillez la position de la Terre et des anomalies : monter sur une piste avant la bonne rotation rapporte. La documentation détaille toutes les règles de l'espèce.

# Oumuamua {#oumuamua}
Couvrez son secteur, gagnez ses jetons.

## Une espèce à découvrir {#intro}
Vos traces rouge et jaune sont déjà posées sur le triangle de découverte de la première espèce : il ne manque que la bleue. Vous découvrirez ici **Oumuamua**.

## Analysez {#analyser}
La ligne du haut de votre ordinateur est pleine : cliquez sur **Analyser les données** (1 énergie) pour gagner une **trace de vie bleue**.

## Posez la trace bleue {#poser}
Cliquez sur l'emplacement **bleu** du triangle de la première espèce : ses trois emplacements seront occupés et l'espèce sera **découverte à la fin du tour**.

## Terminez votre tour {#reveler}
Les trois emplacements sont occupés, mais une découverte se résout **à la fin du tour**, après les éventuels paliers. Cliquez sur **Fin du tour** : l'espèce est révélée.

## Oumuamua {#decouverte}
L'espèce est révélée : ses **pistes** remplacent le triangle et ses règles s'appliquent. Comme vous avez posé les trois premières traces, vous recevez trois **cartes Alien** de l'espèce. Votre adversaire a passé : c'est déjà à vous de rejouer.

## Une nouvelle planète {#planete}
L'astéroïde **Oumuamua** est entré dans le système solaire : c'est une planète (orbite et atterrissage possibles). Il a son propre **secteur de 3 signaux**, où vous avez déjà deux signaux.

## Scannez Oumuamua {#scanner}
Cliquez sur **Scanner** : après le signal du secteur de la Terre, choisissez la première carte de la rangée : sa couleur est celle du secteur où se trouve Oumuamua. Cliquez alors sur le **secteur d'Oumuamua** pour y poser le dernier signal : le secteur est couvert.

## Annulez le scan {#annuler}
Ce n'est pas la bonne carte (ou le signal n'est pas sur Oumuamua) : le secteur d'Oumuamua ne sera pas couvert. Un scan s'annule.

Ouvrez l'**historique** (il s'ouvre ici tout seul) et cliquez sur la flèche **↩** de son bandeau titre pour annuler le scan. Recommencez en choisissant la **première carte** de la rangée, puis le **secteur d'Oumuamua**.

## Les jetons {#jetons}
Couvrir le secteur d'Oumuamua rapporte des **jetons**, au lieu de médias. Ils paient les cases de sa piste (25 PV pour 4 jetons sur la première case) et certaines cartes Oumuamua en défaussent pour un gain.

## Bien couvert ! {#conclusion}
Oumuamua tourne avec son anneau : surveillez la couleur de son secteur pour vos scans. La documentation détaille toutes les règles de l'espèce.

# Centauriens {#centauriens}
Atteignez votre palier de message.

## Une espèce à découvrir {#intro}
Vos traces rouge et jaune sont déjà posées sur le triangle de découverte de la première espèce : il ne manque que la bleue. Vous découvrirez ici les **Centauriens**.

## Analysez {#analyser}
La ligne du haut de votre ordinateur est pleine : cliquez sur **Analyser les données** (1 énergie) pour gagner une **trace de vie bleue**.

## Posez la trace bleue {#poser}
Cliquez sur l'emplacement **bleu** du triangle de la première espèce : ses trois emplacements seront occupés et l'espèce sera **découverte à la fin du tour**.

## Terminez votre tour {#reveler}
Les trois emplacements sont occupés, mais une découverte se résout **à la fin du tour**, après les éventuels paliers. Cliquez sur **Fin du tour** : l'espèce est révélée.

## Les Centauriens {#decouverte}
L'espèce est révélée : ses **pistes** remplacent le triangle et ses règles s'appliquent. Comme vous avez posé les trois premières traces, vous recevez trois **cartes Alien** de l'espèce. Votre adversaire a passé : c'est déjà à vous de rejouer.

## Le palier de message {#palier}
À la découverte, chaque joueur pose un **palier** à son score + 15 PV (sur la piste de score). En l'atteignant, il choisira une **tuile Message** parmi celles qui restent.

## Scannez {#scanner}
Vos signaux remplissent presque le secteur de la Terre. Cliquez sur **Scanner** : votre signal le couvre et vous rapporte une **trace de vie rouge**.

## Montez sur la piste {#piste}
Posez la trace rouge sur la case à **15 PV** de la piste rouge des Centauriens : elle coûte 3 données (vous les avez), et ces 15 PV vous amènent à votre palier.

## Terminez votre tour {#fin-du-tour-2}
Les paliers se vérifient en fin de tour. Cliquez sur **Fin du tour** : vous atteignez votre palier de message.

## Choisissez une tuile Message {#message}
Choisissez une **tuile Message** : chacune ne se prend qu'une fois. Survolez-les pour voir leur récompense.

## Message reçu ! {#conclusion}
Les cartes Centauriens posent aussi un palier : en l'atteignant, leur effet **Réception** s'applique. La documentation détaille toutes les règles de l'espèce.

# Exertiens {#exertiens}
Jouez une carte Exertien face cachée.

## Une espèce à découvrir {#intro}
Vos traces rouge et jaune sont déjà posées sur le triangle de découverte de la première espèce : il ne manque que la bleue. Vous découvrirez ici les **Exertiens**.

## Analysez {#analyser}
La ligne du haut de votre ordinateur est pleine : cliquez sur **Analyser les données** (1 énergie) pour gagner une **trace de vie bleue**.

## Posez la trace bleue {#poser}
Cliquez sur l'emplacement **bleu** du triangle de la première espèce : ses trois emplacements seront occupés et l'espèce sera **découverte à la fin du tour**.

## Terminez votre tour {#reveler}
Les trois emplacements sont occupés, mais une découverte se résout **à la fin du tour**, après les éventuels paliers. Cliquez sur **Fin du tour** : l'espèce est révélée.

## Annulez le refus {#annuler}
Vous avez renoncé à jouer une carte Exertien : ce chapitre a besoin que vous en jouiez une. Un choix s'annule.

Ouvrez l'**historique** (il s'ouvre ici tout seul) et cliquez sur la flèche **↩** de son bandeau titre pour annuler le refus : la fenêtre des cartes Exertiens revient. Choisissez-en au moins une.

## Jouez une carte Exertien {#jouer}
La fin du tour a révélé les **Exertiens** ! Chaque joueur reçoit 3 **cartes Exertiens**, en plus de vos cartes de découverte : elles ne sont pas dans votre main (on ne les défausse pas, on ne les réserve pas).

Vous avez un marqueur sur chaque emplacement de découverte : vous pouvez jouer tout de suite une carte Exertien **face cachée** par marqueur. Choisissez-en au moins une : son **danger** s'ajoute au vôtre, et sa condition rapportera des PV en fin de partie si elle est remplie.

## Le danger {#danger}
Survolez le symbole ☣️ du plateau des Exertiens : il montre votre danger (cartes jouées et cases de la piste). Les cartes de vos adversaires restent cachées jusqu'au décompte final.

## Les paliers Exertiens {#paliers}
Deux **paliers** sont apparus sur la piste de score, au meilleur score + 20 et + 40. À chacun, chaque joueur peut jouer une carte Exertien ; au 2e, elle coûte 1 crédit.

## Attention au danger ! {#conclusion}
En fin de partie, le joueur le plus exposé (le plus de danger) perd 10 % de son total. La documentation détaille toutes les règles de l'espèce.

# Première vraie partie {#premiere-partie}
Contre un robot Débutant, avec conseils.

## C'est parti {#bienvenue}
Une vraie partie commence contre un robot **Débutant**. Le robot joue entre vos tours : son plateau et l'historique montrent ce qu'il fait.

## Des conseils au bon moment {#aides}
Quand une situation importante se présente pour la première fois (analyse possible, palier proche, espèce découverte…), une bulle vous l'explique. Ces aides se coupent dans les paramètres.

# Conseils en partie {#aides-contexte}
Conseils affichés une fois chacun pendant une partie, quand la situation se présente (chapitre « Première vraie partie »).

## Analyse possible {#analyse-possible}
La ligne du haut de votre ordinateur est pleine : l'action **Analyser les données** (1 énergie) vous donne une trace de vie bleue et vide l'ordinateur pour de nouvelles données.

## Réserve de données pleine {#donnees-pleines}
Vous avez 6 données en réserve, le maximum : une donnée de plus serait perdue. Placez-en dans votre ordinateur (action gratuite) avant d'en gagner d'autres.

## Palier en vue {#palier-proche}
Vous approchez d'un **palier doré** (25, 50 ou 70 PV). En le franchissant, vous poserez un marqueur sur une tuile objectif : choisissez celle où vous comptez briller.

## Une espèce découverte {#espece-decouverte}
Une espèce Alien est découverte : son plateau est révélé et ses règles s'appliquent. Survolez-le pour voir ce qu'elle rapporte ; vos prochaines traces de vie iront sur sa piste.

## Dernière manche {#derniere-manche}
C'est la **dernière manche** : les cartes Fin de partie et les tuiles objectif comptent bientôt. Ce que vous ne jouez pas maintenant ne rapportera plus rien.
