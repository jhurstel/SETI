# Documentation de SETI (adaptation numérique)

Adaptation numérique du jeu de société **SETI** (Iello) : un joueur humain contre 1 à 3 robots, dans le navigateur, ou à plusieurs en ligne.
Les règles de référence restent celles du livret officiel et de la FAQ :

- [Règles du jeu (PDF)](docs/seti-rules-fr.pdf)
- [FAQ officielle (PDF)](docs/SETI-FAQ-FR.pdf)

Ce document présente l'interface, puis les règles telles qu'elles sont appliquées, chapitre par chapitre comme le tutoriel, et enfin le glossaire : symboles, cartes, technologies, objectifs et espèces Alien.

## 1. Interface

### 1.1 Écran d'accueil

![Écran d'accueil](docs/images/ecrans/accueil.png)

L'écran d'accueil s'ouvre au lancement, et par ⚙️ en cours de partie. Il propose des cartes de menu (continuer, tutoriel, nouvelle partie, partie en ligne) et, en bas, les liens vers les sauvegardes et la documentation. La version du jeu (et le commit du build) est écrite en bas à droite, et dans l'en-tête de cette documentation.

#### Continuer

- Présente quand une partie est sauvegardée dans le navigateur : elle reprend où elle s'était arrêtée.
- Sa barre de progression montre où en est la partie : un trait gris par manche, un trait de la couleur du joueur par tour (l'action principale du tour au survol).
- **Sauvegarde automatique** : l'état est enregistré dans le navigateur après chaque action, et quand la page est quittée.

#### Tutoriel

![Menu du tutoriel](docs/images/ecrans/accueil-tutoriel.png)

- Le tutoriel apprend le jeu en chapitres courts, joués sur le vrai plateau et dans n'importe quel ordre : l'écran et le tour, puis un chapitre par partie des règles (chapitre 2 de cette documentation), puis une première vraie partie. Au tout premier lancement (ni partie sauvegardée, ni tutoriel commencé), l'accueil le propose ; « Plus tard » ne le propose plus.
- **Chapitres des espèces** : un par espèce Alien, verrouillé (« Espèce inconnue ») tant que vous ne l'avez pas rencontrée. Une espèce se débloque dès qu'elle est découverte dans une vraie partie de ce navigateur (locale, en ligne ou reprise, quel que soit le joueur qui la découvre) ; un message annonce le nouveau chapitre, et le glossaire montre alors l'espèce. Les découvertes faites dans le tutoriel ne débloquent rien : dans « Traces de vie et espèces », l'espèce découverte reste anonyme si vous ne l'avez jamais rencontrée.
- Chaque chapitre part toujours de la même position préparée (votre adversaire, un robot passif, ne fait que passer). Une bulle explique chaque étape et met en avant la zone de l'écran concernée : « Suivant » pour une explication (parfois un saut dans le temps : « quelques tours plus tard ») ; pour une action, à vous de jouer. Les actions principales sans rapport avec l'étape sont désactivées (leur infobulle dit pourquoi) ; les infobulles, les actions gratuites, l'annulation et la documentation restent libres. « En savoir plus » ouvre la documentation à la bonne section.
- **Mode annulation** : si une action rend le chapitre impossible à terminer (énergie dépensée loin de l'objectif, trace posée sur la mauvaise espèce, carte du chapitre défaussée, médias dépensés avant une recherche…), la bulle le signale aussitôt et met en avant l'historique : annulez l'action fautive (flèche ↩), ou cliquez sur « Recommencer le chapitre ». En attendant, les actions principales et la fin du tour sont désactivées, pour que l'erreur reste annulable.
- Un chapitre n'est jamais sauvegardé et ne remplace pas votre partie sauvegardée ; recharger la page ramène à l'accueil. Les chapitres terminés sont cochés dans le menu (mémorisé par le navigateur).
- **Première vraie partie** : une partie normale contre un robot Débutant (sauvegardée comme les autres), avec des **conseils en partie** affichés une fois chacun quand une situation clé se présente (analyse possible, réserve de données pleine, palier en vue, espèce découverte, dernière manche). La case « Conseils en partie » de l'accueil les coupe ou les remet.

#### Nouvelle partie

![Nouvelle partie](docs/images/ecrans/accueil-nouvelle-partie.png)

- Votre nom (gardé pour la partie suivante, en solo comme en ligne), puis les places : la vôtre et 1 à 3 robots, chacun à sa couleur et avec son propre niveau (« + Ajouter un robot », ✕ pour en retirer un).
- Le premier joueur est tiré au hasard au démarrage et annoncé par un radar, qui couvre tout l'écran avant que le plateau n'apparaisse : les joueurs sont des signaux autour d'un radiotélescope, le faisceau tourne, ralentit et se verrouille sur le premier joueur (« X commence ! ») ; un clic le ferme.
- La fenêtre garde le fond de l'accueil, même ouverte pendant une partie.

![Tirage du premier joueur](docs/images/ecrans/accueil-tirage.png)

**Niveaux des robots.** Les robots jouent avec les mêmes règles et les mêmes opérations que le joueur humain, sans jamais lire les cartes cachées. Les trois niveaux simulent chaque action avec le vrai moteur et notent la position obtenue de la même façon ; seule change leur hésitation entre les bonnes actions :

- **Expert** (3 barres) : joue toujours l'action la mieux évaluée, après avoir joué plusieurs suites possibles de la partie pour départager ses 3 meilleures actions.
- **Avancé** (2 barres) : joue le plus souvent la meilleure action, parfois une action presque aussi bonne.
- **Débutant** (1 barre) : hésite beaucoup entre ses bonnes actions (jamais un coup absurde).

L'Expert gagne environ 2 parties sur 3 contre l'Avancé, l'Avancé environ 3 sur 4 contre le Débutant. Écart de score moyen mesuré (novembre 2026, environ 100 parties par case) :

| Joueurs | Expert − Avancé | Avancé − Débutant | Expert − Débutant |
|---|---|---|---|
| 2 | +17 PV | +21 PV | +37 PV |
| 3 | +18 PV | +17 PV | +34 PV |
| 4 | +12 PV | +25 PV | +46 PV |

Un robot joue une étape toutes les 1,5 s ; son calcul ne fige pas l'interface.

#### Partie en ligne

![Partie en ligne : créer une salle](docs/images/ecrans/accueil-en-ligne-creer.png)

- Bouton présent quand un serveur est configuré.
- **Créer une salle** : même présentation que Nouvelle partie. Votre nom, puis les places, chacune à sa couleur : la vôtre et les autres (Humain avec sa silhouette, ou robot avec ses barres de niveau), de 2 à 4 joueurs en tout ; le premier joueur est tiré au hasard au démarrage. Le jeu donne un **code de 5 lettres** à transmettre aux autres joueurs.
- **Rejoindre** : votre nom et le code de la salle, ou **Rejoindre** sur une des salles qui attendent des joueurs (liste relue toutes les 5 s : code, places à leurs couleurs, places libres). Les parties en cours sont listées dessous (joueurs, manche). Un salon resté vide plus d'un jour n'est plus listé. La partie commence dès que toutes les places humaines sont prises.

![Partie en ligne : rejoindre une salle](docs/images/ecrans/accueil-en-ligne-rejoindre.png)

![Salon](docs/images/ecrans/accueil-en-ligne-salon.png)

- Pendant le tour d'un autre joueur, le message au-dessus du plateau l'indique (« Tour de Bob », « En attente de Bob » s'il doit faire un choix) et le plateau reste consultable. Les robots jouent sur le serveur.
- Chacun ne voit que ce qu'il a le droit de voir : la main des autres et les cartes qu'ils piochent restent cachées.
- **Reprendre en ligne** : en cas de coupure, le jeu se reconnecte tout seul (pendant 2 minutes), et tout de suite au retour du réseau ou quand la page redevient visible (sortie de veille) ; une connexion restée ouverte mais muette est détectée en moins d'une minute. Après un rechargement de la page, la carte **Reprendre en ligne** retrouve votre place ; **Quitter la partie en ligne** la laisse reprenable. Le serveur gratuit est gardé éveillé et le jeu le réveille dès son ouverture ; s'il dormait quand même, la fenêtre affiche « Réveil du serveur… » avec le temps écoulé (environ une minute), puis le déclare injoignable après deux minutes. Un redémarrage du serveur efface les salles en cours.
- **Annuler en ligne** : seulement vos propres actions de votre tour en cours, tant que personne d'autre n'a joué depuis (fin de votre tour, choix d'un autre joueur, robot). La partie solo (sauvegarde automatique) n'est pas touchée : **Continuer** y revient.

#### Sauvegardes, documentation et options

- **Sauvegarder la partie** enregistre la partie dans un fichier JSON ; **Restaurer une sauvegarde** en recharge une. Une sauvegarde d'une version plus récente du jeu est refusée.
- **Documentation** ouvre ce document (aussi par le bouton 📖 à côté de ⚙️ en cours de partie) ; son en-tête ouvre le livret officiel et la FAQ (PDF).
- **Signaler un problème** : écrivez en quelques mots ce qui s'est passé, puis téléchargez le rapport (fichier `seti_rapport_<date>.json`) et envoyez-le au développeur par le moyen de votre choix. Il contient la version du jeu, votre navigateur, les dernières erreurs et la partie en cours (sauvegarde complète en solo ; en ligne, seulement ce que vous voyez, sans votre jeton de place). Rien n'est envoyé automatiquement.
- **En cas d'erreur** : si une action échoue, un message « Un problème est survenu » propose **Signaler** sans interrompre la partie. Si l'écran ne peut plus s'afficher, un écran d'erreur remplace la page blanche : **Recharger** (la partie reprend par **Continuer** ; en ligne, votre place reste reprenable), **Accueil**, ou **Signaler le problème**.
- **Conseils en partie** : affiche ou coupe les conseils de la première vraie partie.
- **Outils de débogage** (en développement seulement, absents de la version publiée) : un panneau pour modifier les ressources, piocher une carte précise, etc.

### 1.2 Écran de jeu

![Écran de jeu](docs/images/ecrans/jeu.png)

Le plateau du joueur est à gauche, le système solaire occupe le reste de l'écran. Les autres plateaux s'ouvrent depuis les boutons ronds du système solaire : à gauche, de haut en bas, les objectifs (PV), les technologies, la rangée de cartes et les planètes ; en bas à gauche et à droite, les deux espèces Alien. L'historique est en haut à droite. Un panneau s'ouvre le temps du survol ; un clic sur son bandeau le garde ouvert (sa flèche s'inverse : ▲ le replie, ▼ le garde ouvert ; sens contraire pour les plateaux Alien, ouverts vers le haut), un nouveau clic le replie aussitôt et un clic ailleurs le referme. Le message au-dessus du plateau dit ce que le jeu attend (à la couleur du joueur qui a la main), et les éléments cliquables sont mis en avant. Les infobulles (survol) donnent le détail de chaque élément : une action montre son coût et son bonus en symboles (chacun avec son infobulle), puis ce que fait un clic ou la raison qui l'empêche.

#### Système solaire

- 5 disques (A à E, du centre vers l'extérieur) × 8 secteurs, dont les 3 anneaux supérieurs **tournent** ; planètes, Terre, comètes, champs d'astéroïdes, sondes. Une case peut porter un microphone (+1 Média à la visite).
- Autour, les 8 secteurs de signaux, chacun à sa couleur et avec ses cases de signal. Avant le nom de chaque secteur, le symbole de ce que rapportera sa prochaine couverture au joueur majoritaire : la récompense de la première couverture (une trace de vie rouge, plus des PV pour les secteurs noirs), puis, une fois le secteur couvert, celle des suivantes (trace de vie ou PV selon le secteur) ; l'infobulle du secteur détaille les deux.
- **Plusieurs pièces sur une case** : vos sondes et capsules sont dessinées au-dessus des autres ; l'infobulle d'une pièce regroupe toutes celles de la case par joueur. Cliquer sur la case (une planète, la Terre comprise, ou une pièce d'un autre joueur) sélectionne votre sonde ou capsule qui s'y trouve, la suivante à chaque clic ; quand vous en avez une sur la Terre, le lancement se fait par le bouton de l'action.
- Pendant le tour d'un robot ou d'un autre joueur, le cadre du système solaire s'illumine : vos actions sont verrouillées, mais le plateau reste consultable.

#### Plateau du joueur

![Plateau du joueur](docs/images/ecrans/plateau-joueur.png)


- Les onglets en haut affichent le plateau de chaque joueur (devant le nom : silhouette pour un humain, barres de niveau pour un robot ; 👑 pour le premier joueur) ; le contour du plateau prend la couleur du joueur affiché. Seul le plateau défile, sous les onglets.
- **Ressources** : score, crédits, énergie, cartes en main, Médias et données, puis les revenus ; la limite d'une ressource est écrite sous son symbole (cartes : « Fin de tour : 4 », gardées en passant ; Médias : « (max 10) » ; données : « (max 6) »). L'infobulle d'une ressource montre ses actions gratuites (échanges, achat d'une carte), en boutons à icônes. La tuile des revenus montre les cartes réservées et les revenus de chaque manche ; son infobulle liste les cartes réservées.
- **Actions** : les 8 actions principales en hexagones (lancer, orbite, atterrir, scanner, analyser, jouer une carte, rechercher, passer) et, dans son propre cadre, la fin du tour ; leur infobulle donne le coût et le bonus sur une même ligne. Une action possible clignote ; une action impossible maintenant est grisée (pas votre tour, action principale déjà faite, ressources insuffisantes, pas de sonde sur une planète, aucune carte jouable…) et son infobulle dit pourquoi ; la fin du tour aussi, tant que l'action principale n'est pas faite.
- Dessous : les emplacements des technologies Exploration, les étapes du scan et les technologies Observation, l'ordinateur de données, les cartes en main (celles d'un robot qu'on n'a pas vues sont montrées de dos ; une carte Alien porte au dos le symbole de son espèce), les missions et les cartes jouées. Une carte se lit comme la vraie : action gratuite en haut à gauche, couleur de secteur dans le triangle en haut à droite, numéro en petit en bas à droite de l'illustration, coût dans le badge à gauche du nom (doré : crédits, vert : énergie), effet en symboles au centre (en jaune, la partie qui n'a pas encore de symbole), panneau de mission (déclenchable : un onglet au-dessus de chaque cercle de récompense ; conditionnelle : la condition à gauche, la récompense à droite ; cercle recouvert d'un rond à la couleur du joueur ; une mission entièrement accomplie est retournée et empilée à gauche des missions, sa face visible au survol) ou de fin de partie (doré), et revenu en grand dans le coin inférieur droit, sur un liseré à sa couleur ; l'infobulle la montre en grand avec le texte propre à la carte (ce que les symboles ne disent pas). Toutes les cartes sont dans le glossaire (3.2).

#### Actions et tour

- À son tour, un joueur fait **une action principale** et autant d'**actions gratuites** qu'il veut, avant ou après, puis termine son tour (**Fin du tour**). Chaque tour s'ouvre sur une annonce à la couleur du joueur : « À vous de jouer » en grand pour votre tour, une bande plus petite pour celui d'un autre (un clic la ferme).
- Si un objectif de mission peut encore être validé (cercle qui clignote), finir son tour ou passer demande confirmation.
- Actions gratuites (symboles : glossaire 3.1) :

| Action gratuite | Coût | Effet |
|---|---|---|
| **Acheter un déplacement** | 1 énergie par case (ou un déplacement gratuit) | La sonde avance d'une case (voir 2.1). |
| **Échanger des ressources** | 2 crédits, 2 énergies ou 2 cartes | Contre 1 crédit, 1 énergie ou 1 carte (dans l'infobulle de la ressource dépensée). |
| **Acheter une carte** | 3 Médias | Une carte de la rangée ou de la pioche (dans l'infobulle des Médias). |
| **Défausser pour l'action gratuite** | Une carte de la main | Effet du coin de la carte : 1 déplacement, 1 donnée ou 1 Média. |
| **Transférer une donnée** | Une donnée en réserve | Place la donnée dans l'ordinateur (clic sur une case libre, voir 2.4). |
| **Accomplir une mission** | Condition remplie | Recouvre un cercle ou le carré d'une mission jouée et donne sa récompense (voir 2.5). |

#### Rangée de cartes

![Rangée de cartes](docs/images/ecrans/plateau-rangee.png)


- Les 3 cartes face visible et la pioche : on y prend une carte achetée ou gagnée « au choix », et le scan y choisit le secteur de son second signal (voir 2.3). La rangée est complétée après chaque action.

#### Technologies

![Technologies](docs/images/ecrans/plateau-technologies.png)

- Les 12 piles de technologies (Exploration, Observation, Informatique), chacune avec le bonus de son exemplaire du dessus et, tant que personne ne l'a prise, le badge de 2 PV du premier. L'infobulle d'un emplacement montre si la technologie est acquise, le pouvoir actuel du joueur et le bénéfice de la technologie (détail : 3.3).

#### Objectifs

![Objectifs](docs/images/ecrans/plateau-objectifs.png)

- Les 4 tuiles Score dorées, chacune sur sa face A ou B, avec les marqueurs posés aux paliers dorés (détail : 3.4). La piste de score montre les paliers à venir ; plusieurs paliers sur la même case (Centauriens de plusieurs joueurs, palier doré…) sont regroupés, et leur infobulle les liste tous.

#### Espèces Alien

![Espèce Alien](docs/images/ecrans/plateau-especes.png)


- Les deux plateaux d'espèce, face cachée jusqu'à la découverte : le triangle de découverte reçoit les traces de vie (voir 2.7). Une fois l'espèce découverte, le plateau montre sa piste et ses cartes, et le petit livre en exposant de son nom ouvre sa description dans le glossaire.

#### Planètes

![Planètes](docs/images/ecrans/plateau-planetes.png)


- Chaque planète, avec à côté une ligne par type de sonde présente (orbiteurs, atterrisseurs, lunes comprises) et une pastille de la couleur de chaque joueur, dans l'ordre d'arrivée. Son infobulle montre les cases de la planète ; chaque gain posé à côté d'une case a sa propre infobulle.

#### Historique

![Historique](docs/images/ecrans/plateau-historique.png)


- Toutes les actions de la partie, la dernière en bas ; les conséquences d'une action sont indentées sous elle. Les noms des cartes piochées face cachée ne sont visibles que de leur propriétaire.
- **Annuler** revient avant la dernière action (toute la séquence : l'action et ses conséquences).
- **Revenir au début du tour** rétablit l'état d'avant la première action du tour. Juste après le tour des robots, avant d'avoir rejoué, il ramène au début du tour qu'on vient de finir (le tour des robots est annulé lui aussi).
- La mémoire est bornée : l'annulation ne remonte pas plus loin que le début de l'avant-dernier tour du joueur. Après un rechargement de la page, la sauvegarde automatique garde les 8 dernières actions annulables et le début du dernier tour.
- En ligne : voir 1.1, Partie en ligne.

### 1.3 Pop-up

Quand le jeu attend une décision qui ne se prend pas directement sur le plateau, une fenêtre s'ouvre au centre de l'écran. Chaque option y est un symbole dans une tuile ; le survol donne son libellé, son détail et, si elle est grisée, la raison. Un gain d'une ressource montre sa quantité dans le symbole ; renoncer est une option comme les autres, marquée du cercle barré. Le bouton **Voir le plateau** cache la fenêtre le temps de regarder le jeu. Les autres choix (planète, secteur, technologie, emplacement d'une trace de vie, tuile objectif, carte de la rangée, carte Alien) se font sur le plateau, dont les cases possibles clignotent.

#### Sélection de cartes

![Sélection de cartes](docs/images/menus/defausse-fin-de-manche.png)

Les cartes sont dessinées comme sur le plateau joueur, l'attribut utile en surbrillance, sur une seule ligne tant que l'écran le permet ; le compteur des cartes sélectionnées est au-dessus d'elles, le bouton de validation dessous, avec le symbole de l'action. Même fenêtre pour :

- **Réserver une carte** (mise en place, bonus de réservation) : la carte choisie est glissée sous le plateau ; son revenu, en surbrillance, est gagné aussitôt puis à chaque manche.
- **Défausse de fin de manche** : en passant, le joueur ne garde que 4 cartes ; il coche celles à défausser (action gratuite en surbrillance), puis **Défausser**.
- **Carte de fin de manche** : après avoir passé, le joueur découvre la pile de la manche, sélectionne une carte puis **Choisir**.
- **Échanger 2 cartes** (action gratuite) : 2 cartes de la main contre 1 crédit, 1 énergie ou 1 carte (le bouton **Échanger** montre la ressource gagnée) ; la touche Échap renonce à l'échange.
- **Défausser pour des signaux** (effet de carte) : jusqu'au nombre indiqué de cartes, chacune marquant un signal dans un secteur de sa couleur (en surbrillance).
- **Une seule carte à choisir** : quand le choix n'est pas obligatoire, un seul bouton bascule entre le renoncement (cercle barré) et la validation.

#### Choix du bonus

![Choix du bonus](docs/images/menus/recompenses.png)

Une tuile par bonus possible, toutes de même taille sur une ligne. Même fenêtre pour :

- **Récompenses** (plusieurs gains à choix) : une action, une carte ou un secteur peut rapporter plusieurs gains qui demandent chacun un choix (une technologie à prendre, une trace de vie à placer, des déplacements gratuits…). Le joueur clique sur le gain qu'il veut résoudre en premier, fait son choix sur le plateau, puis revient au menu pour le suivant ; un gain résolu est coché. Les gains déjà appliqués d'office par le même bonus (PV, ressources, signal dans un secteur imposé…) sont montrés grisés et cochés, avant les choix. Le cercle barré (**Ne rien faire d'autre**) renonce aux récompenses qui restent ; quand toutes sont résolues, **Terminer** ferme le menu. L'ordre compte : placer une trace de vie avant de prendre une technologie peut débloquer une mission, se déplacer avant d'atterrir…
- **Observation II, III, IV** : à la fin d'un scan, le bonus de chaque technologie Observation acquise, ou le refus (voir 2.3).
- **Assistance gravitationnelle** (carte 19) : en arrivant sur une planète, 1 Média ou 1 déplacement gratuit.
- **Mission déclenchée** pendant le tour d'un autre joueur : le cercle à recouvrir (un seul, avec sa récompense en symboles), ou le cercle barré pour ne pas en profiter (voir 2.5).
- **Tuile à prendre** : les options déjà prises par un autre joueur sont grisées, avec son nom dans l'infobulle.

#### Confirmations

- **Attention** : finir son tour ou passer alors qu'une mission peut encore être recouverte demande confirmation (**Annuler** ou **Continuer quand même**).
- **Piste d'espèce indisponible** : quand une trace de vie est à placer et que la piste des espèces découvertes ne peut pas la recevoir (emplacements occupés, ou coût impayable), un avertissement rappelle qu'il reste les emplacements de découverte et excédentaires (triangles).
- **Bonus perdu** : jouer une carte dont un effet ne peut pas s'appliquer (aucune sonde à retirer…) demande confirmation.

### 1.4 Écran de fin de partie

![Écran de fin de partie](docs/images/ecrans/fin-de-partie.png)

À la fin de la 5ᵉ manche, après le décompte final, l'écran de fin remplace le plateau.

- **Scores** : une ligne par joueur, du meilleur au moins bon. Devant chaque nom, une silhouette pour un humain ou la force d'un robot (barres) ; un trophée suit le nom du ou des vainqueurs. Les colonnes donnent le score avant le décompte (**Base**), les tuiles objectif (**Obj.**), les cartes Fin de partie (**Fin**), les espèces (**Esp.** : cartes Exertiens, moins la pénalité de danger, en rouge) et le **Total**. Le survol d'un nombre en donne le détail.
- **Résumé de la partie** : sous le titre de l'historique, une ligne par manche et une case par tour, à la couleur du joueur, dans l'ordre du jeu. Chaque case porte l'hexagone de l'action principale du tour (lancer une sonde, mise en orbite, atterrissage, scan, analyse, carte, technologie, passe) ; les actions gratuites n'y figurent pas.
- Le survol d'une case nomme le joueur, son action principale et sa cible : la planète d'une mise en orbite ou d'un atterrissage, la carte jouée, le secteur scanné, la technologie acquise (« Alice joue la carte « Observatoire de Vega » »).

![Résumé de la partie](docs/images/ecrans/fin-de-partie-resume.png)

- Un clic sur une case ou sur le nom d'une manche fait défiler l'historique complet, dessous, jusqu'à ce tour ou cette manche.
- **Voir le plateau** cache l'écran le temps de regarder le plateau final ; **Revoir le résumé** le rouvre. **Nouvelle partie** ramène à l'accueil.

## 2. Tutoriel et Règles

Les exigences (**R**) décrivent les règles telles que le jeu les applique ; la partie se joue en **5 manches**, chaque joueur commençant avec 4 crédits, 3 énergies, 4 Médias et 5 cartes, puis **réserve** une carte sous son plateau.

### 2.1 Sondes

Ce chapitre lance une sonde depuis la Terre, la déplace jusqu'à Mars et la met en orbite.

- **R1** Lancer une sonde (action principale) coûte 2 crédits et pose une sonde sur la case de la Terre ; un joueur n'a qu'une sonde à la fois dans le système solaire (2 avec Exploration I, qui rend aussi le lancement gratuit).
- **R2** Déplacer une sonde (action gratuite) l'avance d'une case adjacente pour 1 énergie, ou pour un déplacement gratuit reçu ; les déplacements gratuits d'une carte (« 2 déplacements ») se dépensent sonde par sonde et peuvent être abandonnés.
- **R3** Quitter un champ d'astéroïdes coûte un déplacement de plus (sauf Exploration II) ; une case à microphone ou une comète rapporte 1 Média à la visite.
- **R4** Les 3 anneaux supérieurs tournent (recherche d'une technologie, premier joueur à passer) et entraînent les sondes posées dessus.
- **R5** Une visite de planète déclenche les effets de cartes « quand vous visitez ».
- **R6** Mettre en orbite (action principale) coûte 1 crédit et 1 énergie, avec une sonde sur la case de la planète : elle devient un orbiteur et gagne la case d'orbite (le premier reçoit un bonus en plus). Si plusieurs planètes sont possibles, le jeu demande laquelle.
- **R7** Une planète n'a pas de limite d'orbiteurs : une fois les cases imprimées occupées, les suivants reçoivent le gain de la dernière case.

### 2.2 Atterrir et médias

Ce chapitre pose une sonde sur Mars, place la trace de vie jaune gagnée et achète une carte avec ses Médias.

- **R1** Atterrir (action principale) coûte 3 énergies, 2 si un orbiteur est déjà sur la planète ou avec Exploration III, 1 avec les deux ; l'atterrisseur gagne la case d'atterrissage.
- **R2** Une planète n'a pas de limite d'atterrisseurs (les suivants reçoivent le gain de la dernière case) ; une lune n'accueille qu'un atterrisseur et demande Exploration IV (*Dragonfly* permet de se poser sur une lune occupée).
- **R3** La couverture médiatique est limitée à 10 Médias.
- **R4** Acheter une carte (action gratuite) coûte 3 Médias : une carte de la rangée ou de la pioche.
- **R5** Échanger des ressources (action gratuite) : 2 crédits, 2 énergies ou 2 cartes contre 1 crédit, 1 énergie ou 1 carte.

### 2.3 Scanner

Ce chapitre scanne le ciel, pose des signaux, couvre un secteur et gagne des données.

- **R1** Scanner (action principale) coûte 1 crédit et 2 énergies : un signal dans le secteur de la Terre (ou un secteur adjacent avec Observation I), puis un signal dans le secteur de la couleur d'une carte choisie dans la rangée, qui est défaussée.
- **R2** Après le scan, chaque technologie Observation acquise propose son bonus : Observation II, payer 1 Média pour un signal sur Mercure ; Observation III, défausser une carte pour un signal de sa couleur ; Observation IV, payer 1 énergie pour lancer une sonde, ou gagner 1 déplacement.
- **R3** Chaque secteur a une couleur (jaune, rouge, bleu, noir) et un nombre de cases ; un signal pose un marqueur et, si la case le prévoit, rapporte une **donnée** (réserve de 6 au plus).
- **R4** Un secteur plein est résolu une seule fois, à la fin des actions en cours ; les signaux posés avant (emplacement en pointillé) comptent pour la majorité.
- **R5** Le joueur majoritaire (en cas d'égalité, le dernier à avoir posé un marqueur, pointillé compris) reçoit la récompense du secteur : celle du premier à le couvrir, puis celle des suivants (souvent une trace de vie) ; chaque joueur présent gagne le bonus de présence.
- **R6** Le secteur résolu est vidé ; le deuxième (même départage) garde un marqueur sur la première case, les autres reprennent les leurs.
- **R7** Carte 50 (Square Kilometre Array) : 2 PV pour chaque secteur différent où elle marque un signal ; un 2e signal dans le même secteur ne rapporte pas ces PV.

### 2.4 Ordinateur et analyse

Ce chapitre transfère des données dans l'ordinateur, remplit sa ligne du haut et les analyse pour une trace de vie bleue.

- **R1** Transférer une donnée (action gratuite) la place dans l'ordinateur, ligne du haut d'abord ; certaines cases rapportent un bonus, une case de réservation sans carte en main perd son bonus.
- **R2** Analyser les données (action principale) coûte 1 énergie et n'est possible que si la ligne du haut est pleine : l'ordinateur est vidé et le joueur gagne une trace de vie **bleue**.
- **R3** Une technologie Informatique se pose sur une colonne de l'ordinateur : sa case du haut rapporte 2 PV et la case ajoutée en bas le gain de la technologie, quand une donnée y est transférée.

### 2.5 Cartes et missions

Ce chapitre joue des cartes, accomplit les trois sortes de missions et défausse une carte pour son action gratuite.

- **R1** Jouer une carte (action principale) coûte son prix (crédits ou énergie) et applique ses gains ; une mission reste devant le joueur, une carte Fin de partie est décomptée à la fin.
- **R2** Défausser une carte de la main (action gratuite) donne l'effet de son coin : 1 déplacement, 1 donnée ou 1 Média.
- **R3** La main n'a pas de limite pendant la manche ; au moment de passer, on n'en garde que 4.
- **R4** Mission conditionnelle (carré) : quand sa condition est remplie, le joueur la réclame (action gratuite) et gagne sa récompense, tant que la condition reste remplie.
- **R5** Mission déclenchable (cercles) : un même déclencheur ne recouvre qu'un cercle, toutes cartes confondues, au choix du joueur ; les cercles d'une carte se recouvrent dans l'ordre de son choix (carte 107 : 2 Médias ou 4 PV après une trace bleue). Deux déclencheurs (deux technologies acquises…) recouvrent deux cercles.
- **R6** Pendant son tour, le joueur clique sur le cercle surligné qu'il recouvre (les autres cercles du même déclencheur s'éteignent) ; si l'effet survient pendant le tour d'un autre joueur, une fenêtre lui propose aussitôt les cercles déclenchés, ou de ne pas en profiter.
- **R7** Missions déclenchées et conditionnelles sont indépendantes : recouvrir un cercle n'empêche pas d'accomplir une mission conditionnelle remplie, et inversement.
- **R8** Une carte Fin de partie rapporte ses points au décompte final selon sa condition.

### 2.6 Technologies

Ce chapitre recherche une technologie avec ses Médias et la place.

- **R1** Rechercher une technologie (action principale) coûte 6 Médias : le joueur prend une technologie sur le plateau, puis le système solaire tourne.
- **R2** Un joueur ne prend qu'une technologie par pile.
- **R3** Chaque pile a 4 exemplaires, chacun avec son gain immédiat (3 PV, 1 Média, 1 énergie ou une carte au choix dans la rangée ou la pioche, mélangés à la mise en place) ; l'exemplaire du dessus rapporte en plus 2 PV au premier à prendre la pile.
- **R4** Les effets des 12 technologies sont décrits dans le glossaire (3.3).

| Catégorie | I | II | III | IV |
|---|---|---|---|---|
| Exploration | 2 sondes, lancement gratuit | Astéroïdes : +1 Média, sortie à 1 déplacement | Atterrissage −1 énergie | Atterrissage sur les lunes |
| Observation | Scan d'un secteur adjacent à la Terre | 1 Média : signal sur Mercure | Défausse : signal de la couleur de la carte | 1 énergie : sonde, ou 1 déplacement |
| Informatique | 2 PV + 1 crédit | 2 PV + 1 carte | 2 PV + 1 énergie | 2 PV + 2 Médias |

### 2.7 Traces de vie et espèces

Ce chapitre place une trace de vie sur un plateau d'espèce et découvre une espèce Alien.

- **R1** Une trace de vie (rouge, jaune ou bleue) se place sur le plateau d'une espèce : sur l'emplacement de découverte de sa couleur, sur la piste de l'espèce, ou sur un emplacement excédentaire.
- **R2** Une trace « de la couleur de son choix » prend la couleur de l'emplacement choisi : elle déclenche les missions de cette couleur et celles qui portent sur n'importe quelle trace, pas celles des autres couleurs.
- **R3** Les emplacements de découverte et excédentaires (triangles) acceptent toujours une trace : elle n'est jamais perdue, même quand la piste de l'espèce est pleine ou trop chère.
- **R4** Deux espèces sont en jeu, face cachée ; une espèce est **découverte** quand ses trois emplacements de découverte (rouge, jaune, bleu) sont occupés. Une annonce le signale aussitôt, mais la découverte se résout **à la fin du tour**, après les paliers (livret, p. 20) : le plateau se révèle alors, ses règles s'appliquent, et une seconde annonce donne son nom et les joueurs qui l'ont découverte. Jusque-là, l'espèce reste face cachée : ni cartes Alien, ni piste. La première fois qu'une espèce est révélée dans une partie locale, cette annonce propose d'ouvrir son chapitre du tutoriel (la partie reste sauvegardée : « Continuer » la reprend).
- **R5** Le joueur qui a posé la première trace d'une couleur reçoit une **carte Alien** de l'espèce ; le dos des cartes Alien porte le symbole de leur espèce.
- **R6** Après la découverte, les traces vont sur la **piste** de l'espèce (récompenses dans l'ordre), puis sur l'**emplacement infini** quand l'espèce en a un : les traces déjà posées s'y empilent en pastilles de la couleur de leur joueur (les 3 dernières, « +n » au-delà).

### 2.8 Passer et fin de manche

Ce chapitre passe, prend une carte de fin de manche et reçoit les revenus.

- **R1** Passer (action principale) termine la manche du joueur : il garde au plus 4 cartes en main et défausse le reste ; il ne joue plus jusqu'à la fin de la manche.
- **R2** Le premier joueur à passer fait tourner le système solaire.
- **R3** La pile de fin de manche reste cachée tant qu'on n'a pas passé ; une fois la passe confirmée (elle ne s'annule plus), le joueur la découvre et y prend une carte, que les autres joueurs ne connaissent pas.
- **R4** Passer termine le tour : les paliers de score sont vérifiés comme à la fin d'un tour (voir 2.9).
- **R5** Quand tous les joueurs ont passé, la manche se termine : chacun reçoit ses revenus (crédits, énergie, cartes) et le marqueur Premier joueur passe au joueur suivant.

### 2.9 Paliers et fin de partie

Ce chapitre franchit un palier de score, pose un marqueur sur une tuile objectif et termine la dernière manche.

- **R1** Les paliers sont vérifiés à la fin du tour (passe comprise) ; s'il y a un choix à faire, il est demandé avant le joueur suivant. Les espèces découvertes pendant le tour sont révélées ensuite, après tous les paliers (livret, p. 20).
- **R2** **Paliers dorés** à 25, 50 et 70 PV : le joueur qui les franchit pose un marqueur sur une tuile objectif (Technologies, Missions, Revenus, Autres).
- **R3** **Paliers neutres** à 20 et 30 PV (moins de 4 joueurs) : un marqueur neutre est posé ; sur le triangle d'un plateau Alien, il occupe le bonus de découverte de sa couleur (la trace suivante de cette couleur prend le bonus suivant).
- **R4** Les tuiles objectif rapportent leurs points au décompte final selon le rang du marqueur sur la tuile, pour chaque série ou paire (détail : 3.4).
- **R5** À la fin de la 5ᵉ manche, le décompte final ajoute les points des tuiles objectif et des cartes Fin de partie.
- **R6** L'écran de fin montre le détail des scores de chaque joueur par catégorie, le ou les vainqueurs, le résumé de la partie (action principale de chaque tour) et l'historique complet (voir 1.4).

## 3. Glossaire

### 3.1 Symboles

{{glossaire}}

### 3.2 Cartes

{{cartes}}

### 3.3 Technologies

{{technologies}}

### 3.4 Objectifs

{{objectifs}}

### 3.5 Aliens

<!-- espece:Mascamites -->
#### Mascamites

- **R1** 7 jetons spécimen, mélangés à la découverte : 3 face cachée sur Jupiter, 3 sur Saturne, et le 7e face visible sur la 3e case de la piste bleue : sa récompense est le gain de cette case, gagné en y posant une trace.
- **R2** Certaines cartes permettent de **prélever un spécimen** sur Jupiter, Saturne ou leurs lunes : une fenêtre montre les spécimens restants de la planète et leur récompense, que le joueur voit ensuite seul dans l'infobulle des jetons (les autres joueurs ne les voient pas) ; le jeton choisi part dans une **capsule**, qui se déplace et se comporte comme une sonde : énergie ou déplacements gratuits (défausse d'une carte Déplacement, Observation IV…), coût de sortie d'un champ d'astéroïdes, Médias des cases, visites et missions déclenchées par un déplacement, signaux « dans un secteur où se trouve l'une de vos sondes » (carte 27…). Le spécimen d'une capsule n'est visible que par son propriétaire. Elle ne compte pas dans la limite de sondes et ne peut ni se mettre en orbite ni atterrir. Les robots simulent chaque spécimen et gardent la meilleure récompense.
- **R3** Une capsule arrivée sur la Terre (ou sur Mars pour ET.4) se réclame comme une mission : récompense de la carte plus celle du spécimen. L'historique annonce son arrivée (« déclenche une mission à recouvrir »), comme les autres missions.
- **R4** Une capsule ramenée à destination pose son spécimen sur la première case libre (sans bonus ni trace) de la piste bleue des Mascamites : sa récompense devient le gain de cette case. Une case de la piste bleue qui attend encore son spécimen est indisponible : on ne peut pas y poser de trace.
- **R5** D'autres cartes permettent de **consulter** un spécimen (gagner son bonus sans le retirer), choisi dans la même fenêtre.
- **R6** Pas d'emplacement infini.

{{symboles-espece:Mascamites}}

{{cartes-espece:Mascamites}}

<!-- espece:Anomalies -->
#### Anomalies

- **R1** 3 anomalies sont posées sur le disque D : dans le secteur de la Terre et à 3 secteurs de chaque côté. Chaque jeton montre une des deux faces de sa couleur, tirée au hasard.
- **R2** Quand une rotation amène la Terre sur une anomalie, le joueur dont le marqueur est le plus haut sur la piste de la couleur de l'anomalie reçoit sa récompense (affichée au centre du jeton). Si personne n'a de marqueur sur cette piste, personne ne gagne ; l'historique l'indique.
- **R3** Emplacement infini : 2 PV.

{{symboles-espece:Anomalies}}

{{cartes-espece:Anomalies}}

<!-- espece:Oumuamua -->
#### Oumuamua

- **R1** L'astéroïde entre dans le système solaire : c'est une **planète** (orbite et atterrissage possibles) avec son propre secteur de 3 signaux (1 PV, rien, 2 PV).
- **R2** Couvrir son secteur rapporte des **jetons** Oumuamua, dépensés sur la piste (25 PV pour 4 jetons sur la 1re case).
- **R3** Cartes qui défaussent des jetons : une fenêtre propose « Défausser 1 Token » ou d'y renoncer. *Échantillons d'Exofossiles* : 1 Donnée ; *Cartographie du Terrain* : 1 signal dans n'importe quel secteur ; *Adaptation des Sondes* : 2 Déplacements, autant de fois que voulu, puis 1 Atterrissage (en arrêtant, ou quand il n'y a plus de jeton). Les robots simulent la défausse et le renoncement et gardent le meilleur.
- **R4** *Visiteur Céleste* (2 PV par signal) et *Modification de Trajectoire* (1 jeton au premier signal) ne comptent que les signaux marqués sur Oumuamua pendant l'action de la carte.
- **R5** Emplacement infini : 6 PV pour 1 jeton.

{{symboles-espece:Oumuamua}}

{{cartes-espece:Oumuamua}}

<!-- espece:Centauriens -->
#### Centauriens

- **R1** À la découverte, chaque joueur pose un palier à son score + 15 PV : en l'atteignant, il choisit une **tuile Message** encore disponible (chaque tuile n'est prise qu'une fois ; s'il n'en reste plus, rien). Les 4 tuiles et leur récompense sont dans l'encart du symbole « Émission d'un message », plus bas.
- **R2** Les cartes Centauriens posent aussi un palier : en l'atteignant, l'effet **Réception** de la carte s'applique. Sur la carte, le symbole **+15** (marqueur sur son socle) rappelle ce palier, gain permanent de toutes les cartes Centauriens ; le panneau du bas indique « À réception du message », un chevron, puis ce qu'elle rapporte. Il n'y a rien à cliquer : la carte jouée reste devant le joueur, son étoile grise jusqu'au palier (son infobulle en donne le score). Une fois reçue, une carte « augmentez vos revenus » passe sous les revenus ; les autres sont défaussées (ce ne sont pas des missions).
- **R3** Piste : 15 PV pour 3 données ; emplacement infini : 6 PV pour 1 donnée (il faut avoir ces données pour y poser la trace ; l'infobulle de l'emplacement affiche « Coût » avant « Bonus »).

{{symboles-espece:Centauriens}}

{{cartes-espece:Centauriens}}

<!-- espece:Exertiens -->
#### Exertiens

- **R1** À la découverte, chaque joueur reçoit 3 cartes Exertiens (en plus des cartes des premiers marqueurs).
- **R2** Les cartes Exertiens ne sont pas en main : ni défaussées, ni réservées, ni jouées normalement. Chacune porte un DANGER et une condition de fin de partie.
- **R3** À la fin du tour qui révèle les Exertiens, chaque joueur qui a des marqueurs sur les emplacements de découverte peut **jouer tout de suite** une carte Exertien face cachée **par marqueur** (deux marqueurs : deux cartes, choisies dans la même fenêtre), ou y renoncer.
- **R4** Des **paliers Exertiens** apparaissent au meilleur score + 20 et + 40. À chaque palier, chaque joueur peut jouer une carte Exertien face cachée (une par palier) ; au **2e palier**, jouer sa carte coûte **1 crédit**. Sans crédit, « Prochain joueur » demande confirmation : le palier serait perdu.
- **R5** **Cartes cachées** : les cartes Exertiens des adversaires (en main ou jouées) restent face cachée jusqu'au décompte final, sur leur plateau comme dans l'infobulle ☣️ du plateau des Exertiens (deux piles par adversaire, cartes à jouer et cartes jouées, avec leur nombre ; les adversaires y sont côte à côte) ; leur nom n'apparaît pas dans l'historique quand ils les reçoivent. Leur danger n'y montre que celui de leurs marqueurs sur la piste, suivi de « + ? » s'ils ont joué une carte. Votre propre danger est complet.
- **R6** Les cases de la piste rapportent PV et ressources, mais ajoutent du **danger** (3, 3, 2, 2, 1). Pas d'emplacement infini.
- **R7** Fin de partie : les conditions des cartes jouées sont révélées (PV si remplies). Le joueur le plus exposé (somme du danger de ses cartes et de ses cases, ex aequo compris) perd **10 %** de son total, arrondi à l'inférieur. Aucune pénalité si personne n'a de danger.

{{symboles-espece:Exertiens}}

{{cartes-espece:Exertiens}}
