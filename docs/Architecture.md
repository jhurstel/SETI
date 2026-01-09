# Architecture Technique - SETI

## 1. Vue d'Ensemble

Architecture modulaire avec séparation claire des responsabilités.

## 2. Structure des Modules

### 2.1 Core (Cœur du Jeu)

```
core/
├── Game.ts              # État principal du jeu
├── GameState.ts         # Machine à états
├── Player.ts            # Modèle joueur
├── Board.ts             # Plateau de jeu
└── TurnManager.ts       # Gestion des tours/manches
```

### 2.2 Systems (Systèmes de Jeu)

```
systems/
├── SolarSystem.ts       # Système solaire et rotation
├── ProbeSystem.ts       # Gestion des sondes
├── SectorSystem.ts      # Scans et majorités
├── DataSystem.ts        # Ordinateur et analyse
├── TechnologySystem.ts  # Technologies
├── CardSystem.ts        # Cartes et missions
├── SpeciesSystem.ts     # Espèces extraterrestres
└── MediaSystem.ts       # Couverture médiatique
```

### 2.3 Actions (Actions de Jeu)

```
actions/
├── Action.ts            # Interface de base
├── LaunchProbeAction.ts
├── MoveProbeAction.ts
├── OrbitAction.ts
├── LandAction.ts
├── ScanSectorAction.ts
├── AnalyzeDataAction.ts
├── PlayCardAction.ts
├── ResearchTechAction.ts
└── PassAction.ts
```

### 2.4 Scoring (Décompte)

```
scoring/
├── ScoreManager.ts      # Gestionnaire principal
├── ScoreCalculator.ts    # Calculs de scoring
└── ScoreCategories.ts    # Catégories de scoring
```

### 2.5 Validation (Validation des Actions)

```
validation/
├── ActionValidator.ts    # Validateur principal
└── RuleEngine.ts        # Moteur de règles
```

## 3. Flux de Données

### 3.1 Cycle de Tour

```
Player Input
    ↓
Action Validation
    ↓
Action Execution
    ↓
State Update
    ↓
Event Emission
    ↓
UI Update
```

### 3.2 Gestion d'État

- **État immuable** : Chaque action crée un nouvel état
- **Historique** : Stack d'états pour undo/redo
- **Validation** : Vérification avant chaque modification

## 4. Interfaces Clés

### 4.1 IGameState
```typescript
interface IGameState {
  currentRound: number;
  currentPlayer: number;
  players: IPlayer[];
  board: IBoard;
  // ...
}
```

### 4.2 IAction
```typescript
interface IAction {
  execute(state: IGameState): IGameState;
  validate(state: IGameState): ValidationResult;
  canExecute(state: IGameState): boolean;
}
```

### 4.3 IPlayer
```typescript
interface IPlayer {
  id: string;
  credits: number;
  energy: number;
  mediaCoverage: number;
  probes: IProbe[];
  technologies: ITechnology[];
  // ...
}
```

## 5. Points d'Attention Techniques

### 5.1 Rotation du Système Solaire
- **Module isolé** : `SolarSystemRotation.ts`
- **Calculs pré-calculés** : Cache des positions après rotation
- **Validation** : Vérification des collisions/positions invalides

### 5.2 Gestion des Égalités
- **Timestamp** : Enregistrer l'ordre des actions
- **Règle explicite** : Dernier marqueur posé gagne

### 5.3 Ordre de Résolution
- **Queue d'événements** : Traiter les effets dans l'ordre
- **Paliers** : Système de déclenchement séquentiel

### 5.4 Actions Gratuites
- **Stack d'actions** : Permettre les actions imbriquées
- **Limite de récursion** : Protection contre les boucles infinies

## 6. Tests Recommandés

### 6.1 Tests Unitaires
- Chaque action isolée
- Systèmes de rotation
- Calculs de scoring

### 6.2 Tests d'Intégration
- Scénarios complets de manche
- Découverte d'espèces
- Scoring final

### 6.3 Tests de Performance
- Rotation avec nombreuses sondes
- Calcul de scoring complexe

## 7. Plateau du Système Solaire (Fixe)

Le plateau du système solaire est **fixe** et ne change jamais. Il constitue la base géographique du jeu.

### 7.1 Structure du Plateau

Le plateau est organisé en **5 disques concentriques** (A à E, du centre vers l'extérieur) et **8 secteurs radiaux** (numérotés de 1 à 8 dans le sens anti-horaire, en partant du haut).

#### Dimensions des Disques

- **Soleil** : Centre du plateau, rayon de 4% du conteneur
- **Disque A** : Rayon intérieur 4%, rayon extérieur 12% (largeur 8%)
- **Disque B** : Rayon intérieur 12%, rayon extérieur 20% (largeur 8%)
- **Disque C** : Rayon intérieur 20%, rayon extérieur 28% (largeur 8%)
- **Disque D** : Rayon intérieur 28%, rayon extérieur 36% (largeur 8%)
- **Disque E** : Rayon intérieur 36%, rayon extérieur 44% (largeur 8%)

#### Numérotation des Secteurs

Les secteurs sont numérotés de 1 à 8 dans le sens **anti-horaire** :
- Secteur 1 : En haut (0°)
- Secteur 8 : 45° (sens anti-horaire)
- Secteur 7 : 90°
- Secteur 6 : 135°
- Secteur 5 : 180°
- Secteur 4 : 225°
- Secteur 3 : 270°
- Secteur 2 : 315°

### 7.2 Objets Célestes Fixes

#### Planètes

| Planète | Position | Description |
|---------|----------|-------------|
| **Uranus** | D1 | Planète gazeuse, couleur cyan (#4fd0e7) |
| **Neptune** | D4 | Planète gazeuse, couleur bleue (#4166f5) |

#### Comètes

Les comètes sont positionnées avec leur queue orientée tangentiellement au cercle (sens anti-horaire).

| Position | Queue | Description |
|----------|-------|-------------|
| **D8** | 60px | Comète avec queue longue |
| **D4** | 60px | Comète avec queue longue |
| **C7** | 60px | Comète avec queue longue |
| **B8** | 50px | Comète avec queue moyenne |
| **B5** | 50px | Comète avec queue moyenne |
| **A2** | 30px | Comète avec queue courte |
| **A3** | 30px | Comète avec queue courte |
| **A8** | 30px | Comète avec queue courte |

#### Nuages de Météorites (Astéroïdes)

Les nuages de météorites sont des zones d'obstacles dispersées sur le plateau.

**Disque C :**
- **C8** : Nuage standard (12 particules, 32px)
- **C2** : Nuage standard (12 particules, 32px)
- **C5** : Nuage standard (12 particules, 32px)
- **C6** : Nuage standard (12 particules, 32px)

**Disque B :**
- **B7** : Nuage standard (12 particules, 32px)
- **B3** : Nuage standard (12 particules, 32px)

**Disque A :**
- **A1** : Nuage réduit (8 particules, 24px, particules 3-5px)
- **A5** : Nuage réduit (8 particules, 24px, particules 3-5px)
- **A6** : Nuage réduit (8 particules, 24px, particules 3-5px)

### 7.3 Caractéristiques Visuelles

- **Secteurs** : Délimités par des lignes radiales partant du centre du soleil
- **Disques** : Cercles concentriques avec bordures bleues (#78a0ff)
- **Labels** : Disques (A-E) et secteurs (1-8) affichés avec fond sombre et bordure
- **Objets célestes** : Positionnés au centre de leur zone (disque + secteur)

### 7.4 Notes d'Implémentation

- Le plateau est **statique** : les positions ne changent jamais
- Les objets sont positionnés par calcul trigonométrique (angle du secteur, rayon du disque)
- Les comètes ont leur queue orientée tangentiellement au cercle (angle = secteurCenterAngle + 180°)
- Les nuages de météorites utilisent des particules dispersées avec variation angulaire et radiale

## 8. Plateau du Système Solaire (Rotatif - Niveau 1)

Le plateau rotatif niveau 1 est un **plateau mobile** qui se superpose au plateau fixe. Il peut être tourné pour modifier la disposition des objets célestes et des zones opaques.

### 8.1 Structure du Plateau Rotatif

Le plateau rotatif est composé de **3 disques concentriques** (A, B, C) qui correspondent aux 3 disques intérieurs du plateau fixe. Il utilise les mêmes dimensions que le plateau fixe pour les cercles concentriques.

#### Dimensions des Disques

- **Disque A** : Rayon intérieur 4% (bord du soleil), rayon extérieur 12% (largeur 8%)
- **Disque B** : Rayon intérieur 12%, rayon extérieur 20% (largeur 8%)
- **Disque C** : Rayon intérieur 20%, rayon extérieur 28% (largeur 8%)

#### Zones Creuses (Transparentes)

Le plateau rotatif a des **zones creuses** (transparentes) qui permettent de voir le plateau fixe en dessous :

- **Centre** : Zone transparente circulaire pour le soleil (rayon 4%)
- **Disque A** : Zones creuses en A4, A5
- **Disque B** : Zones creuses en B2, B5, B7
- **Disque C** : Zones creuses en C2, C3, C7, C8

Les zones non creuses sont **opaques** (couleur `rgba(20, 30, 50, 1)`) avec une bordure `rgba(120, 160, 255, 0.4)` et recouvrent complètement le plateau fixe en dessous.

### 8.2 Objets Célestes sur le Plateau Rotatif

#### Planètes

| Planète | Position | Description |
|---------|----------|-------------|
| **Saturne** | C3 | Planète avec anneaux, couleur beige (#fad5a5), taille 36px, anneaux inclinés à 15° |
| **Jupiter** | C7 | Planète avec bandes horizontales, couleur jaune-brun (#d8ca9d), taille 40px, 4 bandes horizontales |

#### Comètes

Les comètes sur le plateau rotatif ont leur queue orientée dans le **sens de rotation** (horaire). Le noyau est positionné à la tête de la queue (vers le centre), et la queue part vers l'extérieur dans le sens horaire.

| Position | Queue | Description |
|----------|-------|-------------|
| **B2** | 50px | Comète avec queue moyenne, noyau à 25px de la tête |
| **A1** | 30px | Comète avec queue courte, noyau à 15px de la tête |

**Orientation** : Les comètes utilisent l'angle `sectorCenterAngle + 180°` pour pointer leur queue dans le sens de rotation (horaire).

#### Nuages de Météorites (Astéroïdes)

Les nuages de météorites sont des zones d'obstacles dispersées sur le plateau rotatif.

**Disque B :**
- **B3** : Nuage standard (12 particules, 32px, particules 4-12px)
- **B6** : Nuage standard (12 particules, 32px, particules 4-12px)

**Disque A :**
- **A3** : Nuage réduit (8 particules, 24px, particules 3-5px)
- **A4** : Nuage réduit (8 particules, 24px, particules 3-5px)
- **A8** : Nuage réduit (8 particules, 24px, particules 3-5px)

### 8.3 Rotation du Plateau

Le plateau rotatif peut être **tourné** pour modifier la disposition des objets célestes et des zones opaques. La rotation est appliquée via la propriété CSS `transform: rotate(angle)`.

#### 8.3.1 Paramètre de Position Initiale

Le composant `SolarSystemBoardUI` accepte deux paramètres optionnels pour définir les positions initiales des plateaux rotatifs :

**`initialSector`** (niveau 1) :
- **Type** : `number` (optionnel, valeur par défaut : `1`)
- **Valeurs possibles** : Entier de 1 à 8, correspondant aux secteurs du plateau fixe
- **Comportement** : Le plateau niveau 1 est positionné initialement sur le secteur spécifié
- **Conversion** : Chaque secteur correspond à un angle de 45° (secteur 1 = 0°, secteur 2 = 45°, etc.)

**`initialSector2`** (niveau 2) :
- **Type** : `number` (optionnel, valeur par défaut : `1`)
- **Valeurs possibles** : Entier de 1 à 8, correspondant aux secteurs du plateau fixe
- **Comportement** : Le plateau niveau 2 est positionné initialement sur le secteur spécifié
- **Conversion** : Chaque secteur correspond à un angle de 45° (secteur 1 = 0°, secteur 2 = 45°, etc.)

**Exemple d'utilisation :**
```typescript
// Positions initiales par défaut (secteur 1 pour les deux niveaux)
<SolarSystemBoardUI game={game} />

// Position initiale niveau 1 au secteur 5
<SolarSystemBoardUI game={game} initialSector={5} />

// Positions initiales différentes pour les deux niveaux
<SolarSystemBoardUI game={game} initialSector={3} initialSector2={7} />
```

#### 8.3.2 Contrôle de la Rotation via Ref

Le composant expose deux fonctions de contrôle via une référence (`ref`) :

**Interface `SolarSystemBoardUIRef` :**
```typescript
interface SolarSystemBoardUIRef {
  resetRotation: () => void;        // Niveau 1
  rotateCounterClockwise: () => void; // Niveau 1
  resetRotation2: () => void;       // Niveau 2
  rotateCounterClockwise2: () => void; // Niveau 2
}
```

**Fonctions disponibles pour le niveau 1 :**

1. **`resetRotation()`**
   - **Description** : Réinitialise la rotation du plateau niveau 1 à sa position initiale (définie par `initialSector`)
   - **Paramètres** : Aucun
   - **Retour** : `void`

2. **`rotateCounterClockwise()`**
   - **Description** : Fait tourner le plateau niveau 1 d'un secteur (45°) dans le sens anti-horaire
   - **Paramètres** : Aucun
   - **Retour** : `void`
   - **Comportement** : L'angle de rotation est décrémenté de 45° à chaque appel. **Par couplage, les niveaux 2 et 3 tournent également** (voir section 10.4)

**Note** : Les fonctions pour le niveau 2 (`resetRotation2()` et `rotateCounterClockwise2()`) sont documentées dans la section 9.3.2. Les fonctions pour le niveau 3 (`resetRotation3()` et `rotateCounterClockwise3()`) sont documentées dans la section 10.3.2.

**Exemple d'utilisation :**
```typescript
import { useRef } from 'react';
import { SolarSystemBoardUI, SolarSystemBoardUIRef } from './SolarSystemBoardUI';

// Dans votre composant
const solarSystemRef = useRef<SolarSystemBoardUIRef>(null);

// Réinitialiser la rotation
solarSystemRef.current?.resetRotation();

// Tourner d'un secteur dans le sens anti-horaire
solarSystemRef.current?.rotateCounterClockwise();

// Dans le JSX
<SolarSystemBoardUI ref={solarSystemRef} game={game} initialSector={3} />
```

#### 8.3.3 Caractéristiques Techniques

- **Position initiale** : Définie par le paramètre `initialSector` (par défaut : secteur 1 = 0°)
- **Rotation** : Par incréments de 45° (un secteur) dans le sens anti-horaire
- **Gestion d'état** : Utilise `useState` pour gérer l'angle de rotation actuel
- **Z-index** : 25 (au-dessus du plateau fixe qui a z-index 2-10, mais en dessous des objets célestes qui ont z-index 30)

### 8.4 Caractéristiques Visuelles

- **Zones opaques** : Couleur `rgba(20, 30, 50, 1)` avec bordure `rgba(120, 160, 255, 0.4)`
- **Zones creuses** : Transparentes, permettent de voir le plateau fixe en dessous
- **Objets célestes** : Positionnés au centre de leur zone (disque + secteur), z-index 30 pour être visibles au-dessus du plateau
- **Labels** : Disques (A, B, C) affichés avec fond sombre et bordure, positionnés au centre radial de chaque disque

### 8.5 Notes d'Implémentation

- Le plateau rotatif est rendu avec des **SVG paths** pour créer les secteurs en forme d'anneaux (tranches de tarte)
- Les zones creuses sont créées en ne rendant pas les secteurs correspondants (`if (isHollow) return null`)
- Les objets célestes sont positionnés de la même manière que sur le plateau fixe (calcul trigonométrique)
- La rotation est appliquée au conteneur principal via `transform: rotate(angle)` avec l'angle stocké dans un état React (`useState`)
- Les comètes ont leur queue orientée dans le sens de rotation (horaire) avec l'angle `sectorCenterAngle + 180°`
- **Contrôle de rotation** :
  - Le composant utilise `forwardRef` pour exposer les fonctions de contrôle
  - `useImperativeHandle` est utilisé pour exposer `resetRotation()` et `rotateCounterClockwise()` via la ref
  - L'angle initial est calculé à partir du paramètre `initialSector` en utilisant la même logique de conversion secteur → index que le reste du code
  - Chaque secteur correspond à 45° de rotation
  - **Couplage** : Quand le niveau 1 tourne, les niveaux 2 et 3 tournent également (voir section 10.4)

## 9. Plateau du Système Solaire (Rotatif - Niveau 2)

Le plateau rotatif niveau 2 est un **plateau mobile** qui se superpose au plateau fixe et au plateau niveau 1. Il recouvre uniquement les disques A et B.

### 9.1 Structure du Plateau Rotatif Niveau 2

Le plateau rotatif niveau 2 est composé de **2 disques concentriques** (A, B) qui correspondent aux 2 disques intérieurs du plateau fixe. Il utilise les mêmes dimensions que le plateau fixe pour ces disques.

#### Dimensions des Disques

- **Disque A** : Rayon intérieur 4% (bord du soleil), rayon extérieur 12% (largeur 8%)
- **Disque B** : Rayon intérieur 12%, rayon extérieur 20% (largeur 8%)

#### Zones Creuses (Transparentes)

Le plateau rotatif niveau 2 a des **zones creuses** (transparentes) qui permettent de voir les plateaux en dessous :

- **Disque B** : Zones creuses en B2, B3, B4, B7, B8
- **Disque A** : Zones creuses en A2, A3, A4

Les zones non creuses sont **opaques** (couleur `rgba(20, 30, 50, 1)`) avec une bordure `rgba(120, 160, 255, 0.4)` et recouvrent complètement les plateaux en dessous.

### 9.2 Objets Célestes sur le Plateau Rotatif Niveau 2

#### Planètes

| Planète | Position | Description |
|---------|----------|-------------|
| **Mars** | B1 | Planète rocheuse, couleur rouge (#cd5c5c), taille 30px |

#### Nuages de Météorites (Astéroïdes)

Les nuages de météorites sont des zones d'obstacles dispersées sur le plateau rotatif niveau 2.

- **B5** : Nuage standard (12 particules, 32px, particules 4-12px)
- **A6** : Nuage réduit (8 particules, 24px, particules 3-5px)
- **A8** : Nuage réduit (8 particules, 24px, particules 3-5px)

### 9.3 Rotation du Plateau Niveau 2

Le plateau rotatif niveau 2 peut être **tourné** indépendamment du plateau niveau 1 pour modifier la disposition des objets célestes et des zones opaques.

#### 9.3.1 Paramètre de Position Initiale

Le composant `SolarSystemBoardUI` accepte un paramètre optionnel `initialSector2` pour définir la position initiale du plateau niveau 2 :

- **Type** : `number` (optionnel, valeur par défaut : `1`)
- **Valeurs possibles** : Entier de 1 à 8, correspondant aux secteurs du plateau fixe
- **Comportement** : Le plateau niveau 2 est positionné initialement sur le secteur spécifié
- **Conversion** : Chaque secteur correspond à un angle de 45° (secteur 1 = 0°, secteur 2 = 45°, etc.)

**Exemple d'utilisation :**
```typescript
// Position initiale niveau 2 au secteur 1 (par défaut)
<SolarSystemBoardUI game={game} initialSector2={1} />

// Position initiale niveau 2 au secteur 5
<SolarSystemBoardUI game={game} initialSector2={5} />
```

#### 9.3.2 Contrôle de la Rotation via Ref

Le composant expose deux fonctions de contrôle spécifiques au niveau 2 via la référence (`ref`) :

**Interface `SolarSystemBoardUIRef` (mise à jour) :**
```typescript
interface SolarSystemBoardUIRef {
  resetRotation: () => void;        // Niveau 1
  rotateCounterClockwise: () => void; // Niveau 1
  resetRotation2: () => void;       // Niveau 2
  rotateCounterClockwise2: () => void; // Niveau 2
}
```

**Fonctions disponibles pour le niveau 2 :**

1. **`resetRotation2()`**
   - **Description** : Réinitialise la rotation du plateau niveau 2 à sa position initiale (définie par `initialSector2`)
   - **Paramètres** : Aucun
   - **Retour** : `void`

2. **`rotateCounterClockwise2()`**
   - **Description** : Fait tourner le plateau niveau 2 d'un secteur (45°) dans le sens anti-horaire
   - **Paramètres** : Aucun
   - **Retour** : `void`
   - **Comportement** : L'angle de rotation est décrémenté de 45° à chaque appel. **Par couplage, le niveau 3 tourne également** (voir section 10.4)

**Exemple d'utilisation :**
```typescript
import { useRef } from 'react';
import { SolarSystemBoardUI, SolarSystemBoardUIRef } from './SolarSystemBoardUI';

// Dans votre composant
const solarSystemRef = useRef<SolarSystemBoardUIRef>(null);

// Réinitialiser la rotation du niveau 2
solarSystemRef.current?.resetRotation2();

// Tourner le niveau 2 d'un secteur dans le sens anti-horaire
solarSystemRef.current?.rotateCounterClockwise2();

// Dans le JSX
<SolarSystemBoardUI ref={solarSystemRef} game={game} initialSector={3} initialSector2={5} />
```

#### 9.3.3 Caractéristiques Techniques

- **Position initiale** : Définie par le paramètre `initialSector2` (par défaut : secteur 1 = 0°)
- **Rotation** : Par incréments de 45° (un secteur) dans le sens anti-horaire
- **Gestion d'état** : Utilise `useState` pour gérer l'angle de rotation actuel (indépendant du niveau 1)
- **Z-index** : 26 (au-dessus du niveau 1 qui a z-index 25, mais en dessous des objets célestes qui ont z-index 30)

### 9.4 Caractéristiques Visuelles

- **Zones opaques** : Couleur `rgba(20, 30, 50, 1)` avec bordure `rgba(120, 160, 255, 0.4)`
- **Zones creuses** : Transparentes, permettent de voir les plateaux en dessous
- **Objets célestes** : Positionnés au centre de leur zone (disque + secteur), z-index 30 pour être visibles au-dessus du plateau
- **Labels** : Disques (A, B) affichés avec fond sombre et bordure, positionnés au centre radial de chaque disque

### 9.5 Notes d'Implémentation

- Le plateau rotatif niveau 2 est rendu avec des **SVG paths** pour créer les secteurs en forme d'anneaux (tranches de tarte)
- Les zones creuses sont créées en ne rendant pas les secteurs correspondants (`if (isHollow) return null`)
- Les objets célestes sont positionnés de la même manière que sur le plateau fixe (calcul trigonométrique)
- La rotation est appliquée au conteneur principal via `transform: rotate(angle)` avec l'angle stocké dans un état React (`useState`) séparé du niveau 1
- **Contrôle de rotation** :
  - Les fonctions `resetRotation2()` et `rotateCounterClockwise2()` sont exposées via `useImperativeHandle`
  - L'angle initial est calculé à partir du paramètre `initialSector2` en utilisant la même logique de conversion secteur → index que le reste du code
  - Chaque secteur correspond à 45° de rotation
  - Le plateau niveau 2 peut être tourné indépendamment du plateau niveau 1
  - **Couplage** : Quand le niveau 2 tourne, le niveau 3 tourne également. Quand le niveau 1 tourne, les niveaux 2 et 3 tournent également (voir section 10.4)

## 10. Plateau du Système Solaire (Rotatif - Niveau 3)

Le plateau rotatif niveau 3 est un **plateau mobile** qui se superpose au plateau fixe, au plateau niveau 1 et au plateau niveau 2. Il recouvre uniquement le disque A.

### 10.1 Structure du Plateau Rotatif Niveau 3

Le plateau rotatif niveau 3 est composé d'**un seul disque** (A) qui correspond au disque intérieur du plateau fixe. Il utilise les mêmes dimensions que le plateau fixe pour ce disque.

#### Dimensions du Disque

- **Disque A** : Rayon intérieur 4% (bord du soleil), rayon extérieur 12% (largeur 8%)

#### Zones Creuses (Transparentes)

Le plateau rotatif niveau 3 a des **zones creuses** (transparentes) qui permettent de voir les plateaux en dessous :

- **Disque A** : Zones creuses en A2, A6, A7

Les zones non creuses sont **opaques** avec une surbrillance bleue (`rgba(60, 100, 160, 0.8)`) et une bordure bleue (`rgba(74, 158, 255, 0.8)`) et recouvrent complètement les plateaux en dessous.

### 10.2 Objets Célestes sur le Plateau Rotatif Niveau 3

#### Planètes

| Planète | Position | Description |
|---------|----------|-------------|
| **Terre** | A3 | Planète bleue (#4a90e2), taille 32px, avec tooltip |
| **Vénus** | A5 | Planète jaune/orange (#ffc649), taille 30px, avec tooltip |
| **Mercure** | A7 | Planète grise/brune (#8c7853), taille 26px, avec tooltip |

### 10.3 Rotation du Plateau Niveau 3

Le plateau rotatif niveau 3 peut être **tourné** indépendamment des autres plateaux, mais il est également affecté par la rotation des plateaux supérieurs (voir section 10.4).

#### 10.3.1 Paramètre de Position Initiale

Le composant `SolarSystemBoardUI` accepte un paramètre optionnel `initialSector3` pour définir la position initiale du plateau niveau 3 :

- **Type** : `number` (optionnel, valeur par défaut : `1`)
- **Valeurs possibles** : Entier de 1 à 8, correspondant aux secteurs du plateau fixe
- **Comportement** : Le plateau niveau 3 est positionné initialement sur le secteur spécifié
- **Conversion** : Chaque secteur correspond à un angle de 45° (secteur 1 = 0°, secteur 2 = 45°, etc.)

**Exemple d'utilisation :**
```typescript
// Position initiale niveau 3 au secteur 1 (par défaut)
<SolarSystemBoardUI game={game} initialSector3={1} />

// Position initiale niveau 3 au secteur 5
<SolarSystemBoardUI game={game} initialSector3={5} />
```

#### 10.3.2 Contrôle de la Rotation via Ref

Le composant expose deux fonctions de contrôle spécifiques au niveau 3 via la référence (`ref`) :

**Interface `SolarSystemBoardUIRef` (mise à jour) :**
```typescript
interface SolarSystemBoardUIRef {
  resetRotation: () => void;        // Niveau 1
  rotateCounterClockwise: () => void; // Niveau 1
  resetRotation2: () => void;       // Niveau 2
  rotateCounterClockwise2: () => void; // Niveau 2
  resetRotation3: () => void;       // Niveau 3
  rotateCounterClockwise3: () => void; // Niveau 3
}
```

**Fonctions disponibles pour le niveau 3 :**

1. **`resetRotation3()`**
   - **Description** : Réinitialise la rotation du plateau niveau 3 à sa position initiale (définie par `initialSector3`)
   - **Paramètres** : Aucun
   - **Retour** : `void`

2. **`rotateCounterClockwise3()`**
   - **Description** : Fait tourner le plateau niveau 3 d'un secteur (45°) dans le sens anti-horaire
   - **Paramètres** : Aucun
   - **Retour** : `void`
   - **Comportement** : L'angle de rotation est décrémenté de 45° à chaque appel

**Exemple d'utilisation :**
```typescript
import { useRef } from 'react';
import { SolarSystemBoardUI, SolarSystemBoardUIRef } from './SolarSystemBoardUI';

// Dans votre composant
const solarSystemRef = useRef<SolarSystemBoardUIRef>(null);

// Réinitialiser la rotation du niveau 3
solarSystemRef.current?.resetRotation3();

// Tourner le niveau 3 d'un secteur dans le sens anti-horaire
solarSystemRef.current?.rotateCounterClockwise3();

// Dans le JSX
<SolarSystemBoardUI ref={solarSystemRef} game={game} initialSector={3} initialSector2={5} initialSector3={1} />
```

#### 10.3.3 Caractéristiques Techniques

- **Position initiale** : Définie par le paramètre `initialSector3` (par défaut : secteur 1 = 0°)
- **Rotation** : Par incréments de 45° (un secteur) dans le sens anti-horaire
- **Gestion d'état** : Utilise `useState` pour gérer l'angle de rotation actuel (indépendant des autres niveaux)
- **Z-index** : 27 (au-dessus du niveau 2 qui a z-index 26, mais en dessous des objets célestes qui ont z-index 36)

### 10.4 Couplage des Rotations

Les plateaux rotatifs sont **couplés** de manière hiérarchique :

- **Quand le niveau 1 tourne** : Les niveaux 2 et 3 tournent également d'un secteur dans le sens anti-horaire
- **Quand le niveau 2 tourne** : Le niveau 3 tourne également d'un secteur dans le sens anti-horaire
- **Quand le niveau 3 tourne** : Seul le niveau 3 tourne (aucun effet sur les niveaux supérieurs)

Cette logique de couplage est implémentée dans les fonctions `rotateCounterClockwise()` et `rotateCounterClockwise2()` :

```typescript
// Rotation niveau 1 : fait aussi tourner les niveaux 2 et 3
const rotateCounterClockwise = () => {
  setRotationAngle((prevAngle) => prevAngle - 45);
  setRotationAngle2((prevAngle) => prevAngle - 45); // Niveau 2 tourne aussi
  setRotationAngle3((prevAngle) => prevAngle - 45); // Niveau 3 tourne aussi
};

// Rotation niveau 2 : fait aussi tourner le niveau 3
const rotateCounterClockwise2 = () => {
  setRotationAngle2((prevAngle) => prevAngle - 45);
  setRotationAngle3((prevAngle) => prevAngle - 45); // Niveau 3 tourne aussi
};
```

### 10.5 Caractéristiques Visuelles

- **Zones opaques** : Couleur `rgba(60, 100, 160, 0.8)` avec bordure bleue `rgba(74, 158, 255, 0.8)` et effet de glow bleu
- **Zones creuses** : Transparentes, permettent de voir les plateaux en dessous
- **Objets célestes** : Positionnés au centre de leur zone (disque + secteur), z-index 36 pour être visibles au-dessus du plateau
- **Bordure du plateau** : Bordure bleue de 3px (`#4a9eff`) avec ombre bleue pour mettre en surbrillance le contour

### 10.6 Notes d'Implémentation

- Le plateau rotatif niveau 3 est rendu avec des **SVG paths** pour créer les secteurs en forme d'anneaux (tranches de tarte)
- Les zones creuses sont créées en ne rendant pas les secteurs correspondants (`if (isHollow) return null`)
- Les planètes sont positionnées de la même manière que sur le plateau fixe (calcul trigonométrique)
- La rotation est appliquée au conteneur principal via `transform: rotate(angle)` avec l'angle stocké dans un état React (`useState`) séparé des autres niveaux
- **Contrôle de rotation** :
  - Les fonctions `resetRotation3()` et `rotateCounterClockwise3()` sont exposées via `useImperativeHandle`
  - L'angle initial est calculé à partir du paramètre `initialSector3` en utilisant la même logique de conversion secteur → index que le reste du code
  - Chaque secteur correspond à 45° de rotation
  - Le plateau niveau 3 peut être tourné indépendamment, mais est également affecté par la rotation des niveaux supérieurs

## 11. Interface de Contrôle des Rotations

Une interface utilisateur permet de contrôler la rotation des trois plateaux rotatifs via des boutons colorés.

### 11.1 Boutons de Rotation

Trois boutons sont affichés en haut à gauche du système solaire pour contrôler la rotation de chaque plateau :

| Bouton | Couleur | Fonction | Description |
|--------|---------|----------|-------------|
| **Tourner Niveau 1** | Jaune (`#ffd700`) | `rotateCounterClockwise()` | Fait tourner le plateau niveau 1 (et par couplage, les niveaux 2 et 3) |
| **Tourner Niveau 2** | Rouge (`#ff6b6b`) | `rotateCounterClockwise2()` | Fait tourner le plateau niveau 2 (et par couplage, le niveau 3) |
| **Tourner Niveau 3** | Bleu (`#4a9eff`) | `rotateCounterClockwise3()` | Fait tourner uniquement le plateau niveau 3 |

### 11.2 Caractéristiques des Boutons

- **Position** : En haut à gauche du système solaire (position absolue, `top: 10px, left: 10px`)
- **Disposition** : Empilés verticalement avec un espacement de 8px
- **Z-index** : 1000 (au-dessus de tous les autres éléments)
- **Effets visuels** :
  - Bordure de 2px de couleur légèrement plus claire que le fond
  - Ombre portée (`box-shadow`) pour donner de la profondeur
  - Effet de survol : éclaircissement de la couleur et légère augmentation de taille (`scale(1.05)`)
  - Transition fluide de 0.2s pour tous les changements

### 11.3 Implémentation

Les boutons sont implémentés dans le composant `BoardUI.tsx` :

```typescript
// Handlers pour les boutons de rotation
const handleRotateLevel1 = () => {
  solarSystemRef.current?.rotateCounterClockwise();
};

const handleRotateLevel2 = () => {
  solarSystemRef.current?.rotateCounterClockwise2();
};

const handleRotateLevel3 = () => {
  solarSystemRef.current?.rotateCounterClockwise3();
};
```

Les boutons sont positionnés dans un conteneur `div` avec position absolue, enveloppant le composant `SolarSystemBoardUI` pour permettre un positionnement relatif au système solaire.


