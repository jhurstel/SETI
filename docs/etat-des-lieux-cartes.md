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
| ET.2, ET.3, ET.5, ET.6 (Mascamites) | Effets `GAIN_SATELLITE_LANDING_AND_SPECIMEN`, `GAIN_ORBIT_OR_LAND_AND_SPECIMEN`, `GAIN_SPECIMEN_BONUS` traités par le moteur mais jamais lus dans le CSV ; la carte jouée (devenue mission) n'était pas retrouvée pour proposer le spécimen | Lecture des effets ; recherche de la carte source dans les missions |
| ET.21, ET.22, ET.23, ET.27 (Oumuamua) | Conditions de mission `GAIN_IF_PAY_FOR_LIFETRACE`, `GAIN_IF_LANDER`, `GAIN_IF_3_TOKEN`, `GAIN_IF_SIGNAL` non traitées | Conditions implémentées ; le coût en Tokens d'ET.23 est payé (avant : 11 PV gratuits) |
| ET.30 Rover d'Excavation | `GAIN_ON_LAND:oumuamua:pv:3` non lu ; seconde mission absente du CSV | Lecture du format à 4 éléments (limité à Oumuamua) ; ajout de `GAIN_IF_LIFETRACES_ALL_COLORS:oumuamua:token:1` |
| ET.13 Populations Inquiètes | Ses 3 missions (« après avoir acquis une technologie ») absentes du CSV : 3 cercles jamais réalisables | `GAIN_ON_TECH:any:…` (`GAIN_ON_ANY_TECH`) : toute technologie acquise les déclenche |
| ET.17 Sommes-Nous Observés ? | Mission conditionnelle absente du CSV : cercle jamais réalisable | Ajout de `GAIN_IF_LIFETRACES_ALL_COLORS:anomalies:pv:3:media:2` |
| ET.27 Synchronisation Parfaite | « Si vous visitez Oumuamua ce tour-ci » lu comme un cercle de mission permanent | Bonus de visite du tour (`VISIT_PLANET:oumuamua:token:1`, `VISIT_BONUS` à gains) ; la mission reste `GAIN_IF_SIGNAL` |
| 75 Étude sur les Extrêmophiles | Élément `GAIN_LIFETRACE:any:1` redondant avec le gain « 1 Trace » | Retiré du CSV |

## Opérations des robots corrigées

- **Réservation** depuis la piste de l'ordinateur : le robot réservait une carte de la rangée, ce qui échouait sans rien dire. Il réserve maintenant une carte de sa main et en touche le revenu.
- **Traces de vie** : le robot posait toujours sur le plateau Alien 0, sur le triangle une fois sur deux. Il préfère maintenant la piste d'une espèce découverte, puis un triangle où la couleur manque.
- **Défausser pour des signaux** (cartes 67 et 114) : interaction non gérée, désormais traitée.
- **Étude de l'Écosystème** (consulter un spécimen) : le robot choisit Jupiter ou Saturne où il a une sonde.
- **Orbite et atterrissage bonus** : le robot pouvait viser une sonde qui n'était pas sur la planète ; une orbite bonus d'ET.3 ne proposait pas de spécimen.
- **Capsules** : les robots (tous niveaux) les ramènent sur Terre, en simulant leurs déplacements.

## Cartes situationnelles (sans effet hors contexte, comportement attendu)

Ces cartes n'ont pas d'effet visible lors du test automatique, faute de contexte de jeu :
- **15** Rentrée Atmosphérique et **84** Retour d'Échantillons : il faut un orbiteur ou un atterrisseur à retirer.
- **18** Hayabusa : il faut une sonde sur un champ d'astéroïdes.
- **74**, **130**, **ET.11**, **ET.31** : la sonde gagnée n'est pas lancée si la limite de sondes est atteinte.
- **98 à 100** : il faut déjà une trace de cette couleur.
- **ET.5** : il faut une sonde sur Jupiter ou Saturne avec des spécimens.

## Règles complétées (seconde passe)

| Carte / règle | Problème | Correction |
|---|---|---|
| Bonus d'espèces au décompte final | `calculateSpeciesBonuses` marqué « à implémenter » | Vérifié dans les règles (p. 21) et la FAQ : seuls les Exertiens ajoutent une étape (cartes Exertiens et danger, déjà décomptés) ; les exofossiles d'Oumuamua ne rapportent rien (Q42). Rien d'autre à décompter. |
| 113 Congrès Solvay | Effet `SCORE_SOLVAY` absent du CSV ; le calcul ne prenait que la valeur de la case | Effet ajouté ; la meilleure tuile Score sans marqueur est décomptée (séries × case la plus à droite) |
| ET.5 Étude de l'Écosystème, ET.24 Cartographie du Terrain | « 1 PV par trace pour cette espèce » : cible `any` non gérée (ET.5), effet absent (ET.24) | `SCORE_PER_SPECIES_LIFETRACE:<espèce>:1` (traces du joueur sur le plateau de l'espèce, FAQ Q38) |
| ET.5 (joueur humain) | Les jetons Mascamites n'étaient cliquables que pour un prélèvement : la consultation était impossible | Planètes consultables calculées par le moteur (`SpeciesSystem.consultablePlanets`), utilisées par l'interface et les robots |
| ET.8, ET.9, ET.10 | Condition comptée sur toutes les espèces ; récompense « jeton Mascamite » absente | 2 traces de la couleur pour les Mascamites ; récompense d'un jeton de Jupiter ou Saturne au choix (`CONSULTING_SPECIMEN` avec `anyPlanet`) |
| 102 | « 3 couleurs pour une espèce » compté toutes espèces confondues ; trace gagnée sur n'importe quel plateau | Condition par espèce ; trace limitée aux espèces qui remplissent la condition |
| ET.30 Rover d'Excavation | 3 PV pour tout atterrissage sur Oumuamua | Bonus d'atterrissage de la carte (`LAND_BONUS`), seulement avec l'atterrissage qu'elle donne |
| Robots Débutants | Ne déplaçaient pas leurs capsules | Ils rapprochent leurs capsules de la Terre d'une case par tour (énergie) |

## Limites connues

- **Robots** : les trois niveaux simulent et évaluent les cartes de la même façon ; seul leur choix final est plus ou moins hésitant (température).
- **Fiches des espèces** : les règles des espèces viennent des CSV, des règles et de la FAQ. Une règle propre à une fiche Espèce qui n'y figure pas serait à signaler.

<!-- cards:audit:start -->
## Visuel des cartes

Section générée par `npm run cards:audit` (`tools/cards/cardAudit.ts`) à partir des CSV et du relevé de la FAQ (`tools/cards/faq-cards.json`, FAQ BGG 12.2025) ; `test/CardAudit.test.ts` vérifie qu'elle est à jour. Ne pas la modifier à la main.

### Effets sans symbole (38 cartes)

Parties d'effet que la face d'une carte (`ui/components/CardFace`) écrit en texte faute de symbole (tables `EFFECT_SYMBOLS` et `TEXT_EFFECTS` de `cardFaceModel.ts`).

| Carte | Nom | En texte |
|---|---|---|
| 9 | Falcon Heavy | Limite de sondes ignorée |
| 12 | Europa Clipper | Lune sans technologie |
| 15 | Rentrée Atmosphérique | Retirez un orbiteur |
| 17 | OSIRIS-REx | Gains des astéroïdes |
| 19 | Assistance Gravitationnelle | Média ou déplacement |
| 26 | A Travers la Ceinture d'Astéroïdes | Sortie des astéroïdes gratuite |
| 50 | Square Kilometre Array | 2 PV par secteur différent |
| 52 | Observatoire de Parkes | 2 PV par signal rouge |
| 53 | Deep Synoptic Array | 2 PV par signal jaune |
| 54 | Télescope VERITAS | 2 PV par signal bleu |
| 67 | Radiotélescope d'Eupatoria | Défaussez jusqu'à 1 carte pour leur signal |
| 71 | Recherche Ciblée | 2 PV par type de technologie |
| 73 | Initiative Clean Space | Rangée défaussée : actions gratuites |
| 74 | Essais de Prélancement | Cartes Déplacement révélées |
| 75 | Etude sur les Extrêmophiles | PV selon la couleur de la trace |
| 81 | Collaboration Internationale | Technologie déjà prise, sans bonus |
| 84 | Retour d'Echantillons | Retirez un atterrisseur |
| 87 | Projet Longshot | condition « Avoir une sonde à au moins 5 cases de la Terre » |
| 90 | Réservoirs d'Ergols | Énergie par revenu énergie |
| 91 | Réacteur à Fusion | Énergie par revenu énergie, carte réservée |
| 92 | Photo du Jour de la NASA | Média par revenu carte, carte réservée |
| 93 | Financement Public | PV par revenu crédit, carte réservée |
| 95 | Etude des Astéroïdes Géocroiseurs | condition « Avoir une sonde sur un champ d'astéroïdes adjacent à la Terre » |
| 104 | Sonde Rosetta | condition « Avoir une sonde sur une comète » |
| 113 | Congrès Solvay | fin de partie « Résolvez la case la plus à droite d'une tuile Score dorée sur laquelle vous n'avez pas placé de marqueur » ; décompte sans symbole |
| 114 | Chasseurs de Planètes | Défaussez jusqu'à 3 cartes pour leur signal |
| 118 | PLATO | Sans donnée |
| 119 | PIXL | 1 PV par Média |
| 120 | Orbite aux Points de Lagrange | Gardez la carte si elle est seule |
| 133 | Fenêtre de Lancement Optimale | Fenêtre de lancement |
| 136 | Radiotélescope d'Algonquin | Sans donnée |
| ET.5 | Etude de l'Ecosystème | Consultez un spécimen |
| ET.11 | Signes de Vie | Déplacement si Terre sur une anomalie |
| ET.12 | Vue Rapprochée | Sans Média |
| ET.15 | Vie Quotidienne | Cartes piochées : action et revenu |
| ET.16 | Saturation de l'Espace Médiatique | Prenez la rangée |
| ET.17 | Sommes-Nous Observés ? | Récompense de la prochaine anomalie |
| ET.20 | Incertitudes et Stupéfaction | 1 PV par signal sur une anomalie |

### Cartes sans photo dans la FAQ (98 sur 193)

Aucune image de référence dans la FAQ pour vérifier leur visuel (comparer à une vraie carte) :

- Paquet de base : 5-8, 10, 12-14, 18, 31-44, 48, 49, 56, 57, 59, 61-64, 66, 68-72, 74-77, 82, 83, 85-87, 90, 94-97, 102, 104, 105, 108-111, 115, 121, 130-132, 137
- Cartes d'espèce : ET.8-ET.12, ET.16-ET.19, ET.24-ET.26, ET.28, ET.30, ET.34-ET.37, ET.41-ET.55

### Cartes de la FAQ absentes du jeu (1)

| Carte | Nom | Page de la FAQ |
|---|---|---|
| SE FR 01 | Planète naine depuis 2006 | 30 |

### Écarts de nom entre la FAQ et le jeu (3)

| Carte | FAQ | Jeu |
|---|---|---|
| 27 | Télescope Spatial Hubble | Télescope Spatial Huble |
| 54 | Télescopes VERITAS | Télescope VERITAS |
| ET.38 | Concept de l’Esprit de Ruche | Concept de l'Esprit Ruche |
<!-- cards:audit:end -->
