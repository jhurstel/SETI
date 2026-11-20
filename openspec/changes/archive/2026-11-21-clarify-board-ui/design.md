# Design

## Context

Voir proposal.md (Why). État actuel relevé dans le code :

- **Actions principales** : `src/ui/player/PlayerActions.tsx` calcule déjà une table `ruleAvailability` et une raison par action, mais en recopiant des règles : coût du scan et de l'analyse comparé aux ressources, `mediaCoverage >= TECH_RESEARCH_COST_MEDIA` au lieu de `TechnologySystem.canResearchTech`, raison d'orbite et d'atterrissage tirée de la **première** sonde du système solaire (alors que la disponibilité regarde toutes les sondes, d'où des infobulles fausses), coût d'atterrissage avec Exploration III. Les vérifications du moteur existent toutes : `ProbeSystem.canLaunchProbe/canOrbit/canLand`, `ScanSystem.canScanSector`, `ComputerSystem.canAnalyzeData`, `CardSystem.canPlayCards`, `TechnologySystem.canResearchTech` (toutes de la forme `RuleCheck`, `{ canX, reason }`), et les contrôles généraux (partie terminée, tour, passe, action principale faite) sont dans `ActionValidator.validateAction`. Une action indisponible n'a aujourd'hui que l'absence de clignotement (`TrackSlot` sans `clickable` ni `flash`) : rien ne la distingue d'une action en attente.
- **Panneaux** : tous utilisent `.seti-foldable-container` (`ui/styles.css`) : ouverture au survol en CSS (`:hover`), état gardé ouvert par la classe `open`, flèche `▼` en `::after` qui pivote au survol (pas selon l'état gardé). Au clic sur le bandeau, `setIsOpen(!isOpen)` retire `open`, mais `:hover` garde le panneau ouvert tant que la souris est dessus : le repli ne se voit pas, c'est l'effet « épingle » incompris. `PlanetBoardUI` a en plus son propre `isPinned` (survol géré en JS pour les fenêtres des planètes), `AlienBoardUI` un `isPinnedTooltipOpen`. Chaque panneau a ses forçages (technologie à choisir, trace à placer, `useTutorialPanel`) et `useCloseOnOutsideClick`.
- **Secteurs** : `ui/components/SectorDetails.tsx` dessine le nom de chaque secteur sur un `textPath` centré, suivi des pastilles (`tspan ●`) des joueurs qui l'ont couvert ; l'infobulle du secteur liste déjà `firstBonus` et `nextBonus`. Le moteur choisit la récompense par `sector.isCovered ? sector.nextBonus : sector.firstBonus` dans `ScanSystem.coverSector` et la même expression est recopiée dans `AIEvaluator`. Données (`engine/Board.ts`) : première couverture = trace rouge (+ 2 ou 3 PV pour les secteurs noirs), suivantes = trace rouge, 3 PV ou 5 PV selon le secteur ; Oumuamua : récompenses vides (ses jetons viennent du bonus de présence).

## Goals / Non-Goals

**Goals:**
- Une seule source de vérité pour « action principale possible ou non, et pourquoi » : le moteur.
- Un comportement de panneau unique et prévisible, partagé par tous les panneaux.
- Le prochain gain de couverture lisible sur le plateau, calculé par le moteur.

**Non-Goals:**
- Changer la logique des robots (`AIBehavior.listMainActions` énumère des cibles, pas une simple disponibilité ; on n'y touche pas, donc pas de mesure `tune:ai`).
- Refondre les infobulles d'action (coût et gain restent dessinés par l'interface à partir des constantes).
- Vérifier les règles de couverture elles-mêmes : l'affichage montre les données du moteur. L'agent `regles-seti` n'a pas pu lire les PDF (poppler absent) ; les données de `Board.ts` sont celles déjà appliquées et testées.

## Decisions

### 1. Disponibilité des actions principales : `ActionValidator.mainActionAvailability` (couche engine)

`ActionValidator.mainActionAvailability(game, playerId): Record<MainActionType, { available: boolean; reason?: string }>` pour les huit actions du plateau (Lancer, Orbite, Atterrir, Scanner, Analyser, Jouer une carte, Rechercher, Passer).

- Les contrôles généraux sont extraits de `validateAction` dans une fonction privée partagée (`generalCheck(game, playerId, isMainAction)`), pour que la disponibilité et le refus d'une commande donnent exactement la même raison.
- Règle propre : les `canX` existants. Orbite et atterrissage : possibles si **au moins une** sonde le permet ; la raison vient d'une sonde du système solaire (la première qui échoue sur une planète autre que la Terre, sinon « Nécessite une sonde sur une planète »), ce qui corrige l'infobulle actuelle. Passer : contrôles généraux seulement.
- Placée dans `engine/` (et non `systems/`) parce qu'elle combine plusieurs systèmes et les contrôles de tour d'`ActionValidator` ; elle reste hors du cycle admis (engine importe systems).
- Alternative écartée : instancier chaque `BaseAction` et appeler `validate` — les actions Orbite/Atterrir/Jouer une carte exigent une cible (sonde, planète, carte) que l'écran n'a pas encore.

Coût d'atterrissage affiché : la valeur de repli « Exploration III » calculée dans `PlayerActions` passe dans `ProbeSystem` (`currentLandCost(game, playerId)`, réutilisant `probeOnPlanetInfo`), règle de travail oblige puisqu'on modifie ce fichier.

### 2. Grisé dans l'interface (couche ui)

`PlayerActions` lit `mainActionAvailability` (une fois par rendu, `useMemo` sur `game` et `playerId`), puis ajoute les blocages propres à l'écran : étape du tutoriel (`tutorialBlock`) et mode de sélection ou interaction en cours (`isInteractiveMode`, `TurnManager.blocksEndOfTurn`), comme aujourd'hui, avec les mêmes raisons. `TrackSlot` reçoit `disabled` → classe `unavailable` (`.seti-main-actions .obs-track-slot.hex.unavailable` : `filter: grayscale(1)`, opacité réduite, curseur d'aide `help` comme les autres éléments à infobulle), `aria-disabled` déjà présent. Le survol reste actif pour l'infobulle (`ActionTooltip` existant, via `handleTooltipHover` = `setActiveTooltip`, jamais `title`). La fin du tour reçoit le même grisé quand elle n'est pas possible (raison inchangée : pas votre tour, action principale à faire, choix en cours, étape du tutoriel).

### 3. Panneaux : hook partagé `useFoldablePanel` (couche ui)

`ui/hooks/useFoldablePanel.ts` : état `kept` (gardé ouvert), `suppressHover` (repli au clic sous la souris), options `forcedOpen` (choix en cours, tutoriel) et fermeture au clic ailleurs (`useCloseOnOutsideClick`). Il rend `isOpen`, `toggle` (stable) et les props du conteneur (`onMouseLeave` qui lève `suppressHover`) ; le conteneur reçoit la classe `no-hover` tant que `suppressHover` est vrai.

- CSS : les règles `:hover` de `.seti-foldable-container` et `.seti-icon-panel.collapsed:hover` excluent `.no-hover` (`:hover:not(.no-hover)`), ce qui replie tout de suite sous la souris.
- Flèche : le `::after` du bandeau ne pivote plus au survol ; son contenu suit l'état gardé ouvert (classe `open`) (▼ replié : un clic le garde ouvert ; ▲ gardé ouvert : un clic le replie), visible quand le bandeau est déployé (survol ou ouvert), comme aujourd'hui. Le ▲ de l'historique décrit dans la documentation garde son sens.
- `PlanetBoardUI` (survol géré en JS) et `AlienBoardUI` (fenêtre de trace épinglée) passent par le même hook ; leurs états propres (`isPinned`, `isPinnedTooltipOpen`) disparaissent ou deviennent des cas de `forcedOpen`.
- Alternative écartée : supprimer l'aperçu au survol (plus simple, mais les joueurs consultent souvent les panneaux d'un passage de souris ; la demande vise l'épingle, pas le survol).

### 4. Prochain gain de couverture (core/systems puis ui)

- Moteur : `ScanSystem.nextCoverBonus(sector): Bonus` (`isCovered ? nextBonus : firstBonus`), utilisé par `coverSector` et `AIEvaluator` (même résultat, pas de changement de comportement des robots).
- Interface : dans `SectorDetails`, le symbole est dessiné **avant** le nom (à l'opposé des pastilles des joueurs, qui suivent le nom et s'allongent), sur l'arc du nom, tourné comme le texte. Sa position angulaire vient de la largeur estimée du nom (nombre de caractères × avance d'une capitale à cette taille de police et cet espacement), dans une fonction pure de `ui/solarGeometry.ts`. Icônes existantes : `LifeTraceIcon` rouge, `VictoryPointsIcon` chiffré, côte à côte pour une récompense composée (via `BonusIcons` dans un `foreignObject`, ou directement en SVG). Rien pour une récompense vide.
- Alternative écartée : mesurer le texte (`getComputedTextLength`) — demande un effet et un second rendu sur un plateau mémoïsé ; l'estimation suffit pour des noms en capitales d'une seule police.

## Risks / Trade-offs

- [Estimation de largeur du nom imprécise, symbole qui touche le nom ou le couloir] → marge fixe et vérification visuelle des 8 secteurs dans les deux sens (haut et bas du plateau), avec `tools/bench/midGameSave.ts` et une capture.
- [Toutes les actions grisées pendant le tour des autres : plateau plus terne] → c'est l'état réel ; le grisé est léger (le pictogramme reste reconnaissable) et l'infobulle reste disponible.
- [Le hook de panneau touche six composants mémoïsés] → handlers stables (`useCallback`), aucune nouvelle prop calculée passée depuis `BoardUI` ; tests de composants sur deux panneaux (dont Planètes, au survol en JS) et e2e `humanTurn` existant.
- [Les chapitres du tutoriel ouvrent et ferment des panneaux] → `useTutorialPanel` alimente `forcedOpen` ; `npm run test:e2e` (tutorial.spec) et les tests `Tutorial.test.tsx` le vérifient.

## Migration Plan

Aucune migration : pas de changement du modèle sauvegardé ni du protocole en ligne. Déploiement habituel (Netlify à la publication) ; retour arrière par revert du commit.
