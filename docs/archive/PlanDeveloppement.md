# Plan de Développement - SETI

## Vue d'Ensemble

Développement en 6 phases progressives, chaque phase ajoutant une couche de complexité.

---

## Phase 1 – Fondations

### Objectifs
- Modèle de données complet
- Gestion basique du tour/manche
- Actions principales sans effets avancés

### Livrables
- [ ] Structure de base `Game`, `Player`, `Board`
- [ ] `TurnManager` avec cycle de manche
- [ ] Actions principales (squelettes)
- [ ] Système de validation basique
- [ ] Tests unitaires de base

### Durée estimée
2-3 semaines

### Critères de validation
- Une partie complète peut être jouée (sans effets complexes)
- Les tours s'enchaînent correctement
- Les actions de base fonctionnent

---

## Phase 2 – Plateau & Déplacements

### Objectifs
- Système solaire complet
- Rotation fonctionnelle
- Gestion des sondes (lancement, déplacement, orbite, atterrissage)

### Livrables
- [ ] `SolarSystem` avec toutes les cases
- [ ] `SolarSystemRotation` avec calculs de rotation
- [ ] `ProbeSystem` complet
- [ ] Actions de déplacement validées
- [ ] Gestion des obstacles (astéroïdes, soleil)
- [ ] Tests de rotation complexes

### Durée estimée
3-4 semaines

### Critères de validation
- Les sondes peuvent être lancées et déplacées
- La rotation fonctionne correctement
- Les règles de déplacement sont respectées
- Les bonus de cases sont appliqués

---

## Phase 3 – Observation & Données

### Objectifs
- Système de scans de secteurs
- Gestion des majorités
- Ordinateur et analyse de données
- Traces de vie

### Livrables
- [ ] `ScanSystem` avec scans
- [ ] Système de majorités avec gestion d'égalités
- [ ] `ComputerSystem` avec ordinateur
- [ ] Actions d'analyse
- [ ] Gestion des traces de vie
- [ ] Tests de majorités et égalités

### Durée estimée
2-3 semaines

### Critères de validation
- Les scans fonctionnent correctement
- Les majorités sont calculées juste
- L'analyse de données déclenche les bons effets
- Les traces de vie s'accumulent

---

## Phase 4 – Technologies & Cartes

### Objectifs
- Système de technologies actives
- Gestion des missions
- Effets combinés
- Cartes fin de partie

### Livrables
- [ ] `TechnologySystem` complet
- [ ] Effets de technologies implémentés
- [ ] `CardSystem` avec missions
- [ ] Gestion des effets combinés
- [ ] Tests d'interactions complexes

### Durée estimée
3-4 semaines

### Critères de validation
- Les technologies fonctionnent
- Les missions peuvent être accomplies
- Les effets se combinent correctement
- Pas de bugs d'interaction

---

## Phase 5 – Espèces Extraterrestres

### Objectifs
- Déclenchement de découverte
- Règles spécifiques par espèce
- Cartes extraterrestres
- Impact sur le jeu

### Livrables
- [ ] `SpeciesSystem` avec déclenchement
- [ ] Règles spécifiques implémentées
- [ ] Cartes extraterrestres
- [ ] Modifications de scoring
- [ ] Tests de découverte

### Durée estimée
2-3 semaines

### Critères de validation
- La découverte se déclenche au bon moment
- Les règles spécifiques fonctionnent
- L'impact sur le jeu est correct

---

## Phase 6 – Scoring & Fin de Partie

### Objectifs
- Scoring complet
- Décompte final
- Toutes les catégories
- Paliers et combinaisons

### Livrables
- [ ] `ScoreManager` complet
- [ ] Toutes les catégories de scoring
- [ ] Calculs de paires
- [ ] Effets d'espèces sur scoring
- [ ] Interface de décompte
- [ ] Tests exhaustifs de scoring

### Durée estimée
2-3 semaines

### Critères de validation
- Le scoring est correct dans tous les cas
- Les paires sont calculées juste
- Le décompte final est complet
- Pas d'erreurs de calcul

---

## Points de Contrôle Inter-Phases

### Après Phase 1
- Revue d'architecture
- Validation du modèle de données
- Ajustements si nécessaire

### Après Phase 2
- Tests de performance (rotation)
- Optimisations si besoin
- Validation des règles complexes

### Après Phase 3
- Tests d'intégration complets
- Validation des majorités
- Ajustements UX

### Après Phase 4
- Tests de régression
- Validation des interactions
- Documentation des effets

### Après Phase 5
- Tests de scénarios complets
- Validation de l'équilibrage
- Ajustements finaux

### Après Phase 6
- Tests finaux complets
- Validation du scoring
- Préparation release

---

## Risques Identifiés

### Risque 1 : Complexité de la Rotation
- **Mitigation** : Module isolé, tests exhaustifs
- **Détection** : Phase 2

### Risque 2 : Gestion des Égalités
- **Mitigation** : Système de timestamp, règles explicites
- **Détection** : Phase 3

### Risque 3 : Performance du Scoring
- **Mitigation** : Calculs optimisés, cache si nécessaire
- **Détection** : Phase 6

### Risque 4 : Interactions Complexes
- **Mitigation** : Tests d'intégration, documentation
- **Détection** : Phase 4

---

## Métriques de Succès

- **Couverture de tests** : > 80%
- **Performance** : Rotation < 100ms, Scoring < 500ms
- **Stabilité** : 0 bugs critiques en production
- **Complétude** : 100% des règles implémentées


