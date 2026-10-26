# État des lieux des cartes et des opérations des robots

Dernière mise à jour : octobre 2026. Ce document résume l'audit de toutes les cartes (`public/cards/*.csv`) et des opérations des robots. Les vérifications sont automatisées dans `test/CardCatalog.test.ts` : relancer `npm test` pour les rejouer.

## Méthode

1. **Lecture des cartes (statique).** Pour chaque carte des 6 CSV (193 cartes), chaque élément des colonnes `Gain` et `Contrainte` doit être lu par `DataLoader`, et chaque effet produit doit être traité quelque part dans le moteur. Une carte sans aucun effet codé est signalée.
2. **Jeu des cartes (dynamique).** Chaque carte hors Exertiens (178 cartes) est jouée par un joueur robot riche, puis toutes les interactions qu'elle déclenche sont résolues par `AIController`. Aucune erreur ni interaction « que l'IA ne sait pas gérer » n'est tolérée. Les 15 cartes Exertiens sont testées dans `test/FinalScoring.test.ts` (conditions de fin de partie et danger).
3. **Couverture des robots.** Chaque type d'interaction que le moteur peut confier à un robot doit être traité par `AIController`. Seules les interactions créées par l'interface du joueur humain (`IDLE`, `ANALYZING`, `DISCARDING_CARD`, `TRADING_CARD`, `SELECTING_MISSION`) en sont exclues.

## Cartes corrigées

| Carte | Problème | Correction |
|---|---|---|
| 98, 99, 100 (Spectrographe Coronal, Microscope Électronique, Supercalculateur Exascale) | Effet `GAIN_LIFETRACE_IF_ALREADY` jamais lu : la carte ne faisait rien | Trace de vie de la couleur, limitée aux espèces où le joueur en a déjà une (`PLACING_LIFE_TRACE.boardIndices`, respecté par l'interface et les robots) |
| 108 SETI@home | Effet `GAIN_LIFETRACE_IF_MEDIA` jamais lu | Trace Rouge si le joueur a au moins 8 Médias |
| ET.16 Saturation de l'Espace Médiatique | Aucun effet codé dans le CSV | Nouvel effet `TAKE_CARD_ROW` : les cartes de la rangée vont en main |
| ET.26, ET.29 | Gain « 1 Token » non lu | Lecture des gains en Tokens |
| ET.1, ET.3, ET.5, ET.6 (Mascamites) | Effets `GAIN_SATELLITE_LANDING_AND_SPECIMEN`, `GAIN_ORBIT_OR_LAND_AND_SPECIMEN`, `GAIN_SPECIMEN_BONUS` traités par le moteur mais jamais lus dans le CSV ; la carte jouée (devenue mission) n'était pas retrouvée pour proposer le spécimen | Lecture des effets ; recherche de la carte source dans les missions |
| ET.21, ET.22, ET.23, ET.27 (Oumuamua) | Conditions de mission `GAIN_IF_PAY_FOR_LIFETRACE`, `GAIN_IF_LANDER`, `GAIN_IF_3_TOKEN`, `GAIN_IF_SIGNAL` non traitées | Conditions implémentées ; le coût en Tokens d'ET.23 est payé (avant : 11 PV gratuits) |
| ET.30 Rover d'Excavation | `GAIN_ON_LAND:oumuamua:pv:3` non lu ; seconde mission absente du CSV | Lecture du format à 4 éléments (limité à Oumuamua) ; ajout de `GAIN_IF_LIFETRACES_ALL_COLORS:oumuamua:token:1` |
| 75 Étude sur les Extrêmophiles | Élément `GAIN_LIFETRACE:any:1` redondant avec le gain « 1 Trace » | Retiré du CSV |

## Opérations des robots corrigées

- **Réservation** depuis la piste de l'ordinateur : le robot réservait une carte de la rangée, ce qui échouait sans rien dire. Il réserve maintenant une carte de sa main et en touche le revenu.
- **Traces de vie** : le robot posait toujours sur le plateau Alien 0, sur le triangle une fois sur deux. Il préfère maintenant la piste d'une espèce découverte, puis un triangle où la couleur manque.
- **Défausser pour des signaux** (cartes 67 et 114) : interaction non gérée, désormais traitée.
- **Étude de l'Écosystème** (consulter un spécimen) : le robot choisit Jupiter ou Saturne où il a une sonde.
- **Orbite et atterrissage bonus** : le robot pouvait viser une sonde qui n'était pas sur la planète ; une orbite bonus d'ET.3 ne proposait pas de spécimen.
- **Capsules** : les robots Intermédiaires les ramènent sur Terre. Les robots Débutants ne les déplacent pas.

## Cartes situationnelles (sans effet hors contexte, comportement attendu)

Ces cartes n'ont pas d'effet visible lors du test automatique, faute de contexte de jeu :
- **15** Rentrée Atmosphérique et **84** Retour d'Échantillons : il faut un orbiteur ou un atterrisseur à retirer.
- **18** Hayabusa : il faut une sonde sur un champ d'astéroïdes.
- **74**, **130**, **ET.11**, **ET.31** : la sonde gagnée n'est pas lancée si la limite de sondes est atteinte.
- **98 à 100** : il faut déjà une trace de cette couleur.
- **ET.5** : il faut une sonde sur Jupiter ou Saturne avec des spécimens.

## Limites connues

- **Bonus des espèces au décompte final** (`ScoreManager.calculateSpeciesBonuses`) : non implémenté, règles à fournir.
- **ET.30** : « si vous posez une sonde sur Oumuamua grâce à cette action » est traité comme une mission déclenchable (atterrissage sur Oumuamua après avoir joué la carte), pas uniquement avec l'atterrissage gagné par la carte.
- **ET.8, ET.9, ET.10** : la récompense « jeton Mascamite de la planète » (`specimen:1`) n'est pas appliquée.
- **Robots Débutants** : ils ne déplacent pas les capsules et ne prennent les cartes qu'au hasard. Le niveau Expert joue comme le niveau Intermédiaire.
