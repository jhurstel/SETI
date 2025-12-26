# SETI - Adaptation Numérique

Adaptation numérique du jeu de société SETI (Iello) développée en TypeScript.

## Architecture

### Structure du Projet

```
src/
├── core/              # Cœur du jeu
│   ├── Game.ts        # Moteur de jeu principal
│   ├── GameFactory.ts # Factory pour créer des parties
│   ├── TurnManager.ts # Gestion des tours et manches
│   ├── Board.ts       # Gestion du plateau
│   └── types.ts       # Types et interfaces
│
├── systems/           # Systèmes de jeu
│   ├── ProbeSystem.ts      # Gestion des sondes
│   ├── SectorSystem.ts     # Scans et majorités
│   ├── DataSystem.ts       # Ordinateur et analyse
│   ├── TechnologySystem.ts # Technologies
│   ├── CardSystem.ts       # Cartes et missions
│   ├── SpeciesSystem.ts    # Espèces extraterrestres
│   ├── MediaSystem.ts      # Couverture médiatique
│   └── SolarSystemRotation.ts # Rotation du système solaire
│
├── actions/          # Actions de jeu
│   ├── Action.ts            # Interface de base
│   ├── LaunchProbeAction.ts
│   ├── MoveProbeAction.ts
│   ├── OrbitAction.ts
│   ├── LandAction.ts
│   ├── ScanSectorAction.ts
│   ├── AnalyzeDataAction.ts
│   ├── PlayCardAction.ts
│   ├── ResearchTechAction.ts
│   └── PassAction.ts
│
├── validation/       # Validation et règles
│   ├── ActionValidator.ts # Validateur d'actions
│   └── RuleEngine.ts      # Moteur de règles
│
└── scoring/          # Scoring
    └── ScoreManager.ts    # Gestionnaire de scoring
```

## Utilisation

### Créer une partie

```typescript
import { GameFactory, GameEngine } from './src';

// Créer une nouvelle partie avec 2 joueurs
const gameState = GameFactory.createGame(['Alice', 'Bob']);

// Initialiser la partie
const initializedGame = GameFactory.initializeGame(gameState);

// Créer le moteur de jeu
const engine = new GameEngine(initializedGame);
```

### Exécuter une action

```typescript
import { LaunchProbeAction } from './src/actions/LaunchProbeAction';

// Lancer une sonde
const action = new LaunchProbeAction('player_0');
const result = engine.executeAction(action);

if (result.success) {
  console.log('Sonde lancée avec succès !');
} else {
  console.error('Erreur:', result.error);
}
```

### Exemples d'actions

```typescript
// Déplacer une sonde
const moveAction = new MoveProbeAction(
  'player_0',
  'probe_123',
  { x: 5, y: 3 }
);

// Scanner un secteur
const scanAction = new ScanSectorAction(
  'player_0',
  'sector_1',
  ['signal_1', 'signal_2']
);

// Analyser des données
const analyzeAction = new AnalyzeDataAction('player_0');

// Passer son tour
const passAction = new PassAction(
  'player_0',
  ['card_1', 'card_2', 'card_3', 'card_4']
);
```

## Phases de Développement

### Phase 1 – Fondations ✅
- Modèle de données complet
- Gestion basique du tour/manche
- Actions principales (squelettes)
- Système de validation basique

### Phase 2 – Plateau & Déplacements (À venir)
- Système solaire complet
- Rotation fonctionnelle
- Gestion complète des sondes

### Phase 3 – Observation & Données (À venir)
- Système de scans complet
- Gestion des majorités
- Ordinateur et analyse

### Phase 4 – Technologies & Cartes (À venir)
- Technologies actives
- Missions
- Effets combinés

### Phase 5 – Espèces Extraterrestres (À venir)
- Déclenchement de découverte
- Règles spécifiques
- Cartes extraterrestres

### Phase 6 – Scoring & Fin de Partie (À venir)
- Scoring complet
- Décompte final
- Toutes les catégories

## Points d'Attention Techniques

### ⚠️ Rotation du Système Solaire
Système complexe isolé dans `SolarSystemRotation.ts`. Nécessite des tests exhaustifs.

### ⚠️ Gestion des Égalités
En cas d'égalité dans un secteur, le dernier marqueur posé gagne (géré par timestamp).

### ⚠️ Ordre de Résolution
Les effets sont appliqués dans l'ordre : action → règles → limites.

### ⚠️ Actions Gratuites
Les actions gratuites peuvent être exécutées à tout moment (à implémenter).

## Documentation

- [Architecture](./docs/Architecture.md)
- [Cahier des Charges](./docs/CahierDesCharges.md)
- [Modèle de Données](./docs/ModeleDonnees.md)
- [Plan de Développement](./docs/PlanDeveloppement.md)

## Licence

Ce projet est une adaptation numérique du jeu SETI (Iello).

