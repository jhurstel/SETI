# Instructions pour lancer SETI

## Prérequis

- Node.js (version 18 ou supérieure)
- npm (inclus avec Node.js)

## Installation

1. **Installer les dépendances** :
```bash
npm install
```

## Méthodes de lancement

### Méthode 1 : Avec ts-node (recommandé pour le développement)

```bash
npm run dev
```

Cette commande lance directement le fichier TypeScript sans compilation.

### Méthode 2 : Compiler puis exécuter

```bash
# Compiler le projet
npm run build

# Lancer l'exemple compilé
npm start
```

### Méthode 3 : Avec VS Code

1. Ouvrir VS Code dans le dossier du projet
2. Appuyer sur `F5` ou aller dans le menu **Run > Start Debugging**
3. Choisir la configuration **"Lancer SETI (exemple)"**

## Structure des commandes

- `npm run build` : Compile le TypeScript en JavaScript dans le dossier `dist/`
- `npm start` : Lance l'exemple compilé
- `npm run dev` : Lance directement avec ts-node (sans compilation)
- `npm run watch` : Compile en mode watch (recompile automatiquement)

## Résolution de problèmes

### Erreur "ts-node not found"
```bash
npm install --save-dev ts-node typescript @types/node
```

### Erreur de compilation TypeScript
Vérifiez que `tsconfig.json` est présent et correct.

### Erreur "Cannot find module"
Assurez-vous d'avoir installé les dépendances :
```bash
npm install
```

## Prochaines étapes

Une fois le projet lancé, vous verrez un exemple de partie avec :
- Création d'une partie à 2 joueurs
- Lancement d'une sonde
- Passage de tour

Vous pouvez modifier `src/examples/basic-game.ts` pour tester d'autres actions.

