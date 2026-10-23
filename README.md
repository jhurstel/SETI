# SETI – Adaptation numérique

Adaptation numérique du jeu de société **SETI** (Iello) en TypeScript et React : partie solo contre 1 à 3 robots, dans le navigateur.

Règles de référence : [`seti-rules-fr.pdf`](./seti-rules-fr.pdf) et [`SETI-FAQ-FR.pdf`](./SETI-FAQ-FR.pdf).

## Démarrage

Prérequis : Node.js ≥ 20.19.

```bash
npm install
npm run dev        # lance le jeu sur http://localhost:5173
```

## Scripts

| Commande | Rôle |
| --- | --- |
| `npm run dev` | Serveur de développement Vite |
| `npm run build` | Vérification de types puis build de production dans `dist/` |
| `npm run preview` | Sert le build de production |
| `npm run typecheck` | Vérification de types TypeScript |
| `npm run lint` / `lint:fix` | ESLint |
| `npm test` | Tests unitaires (Jest, dossier `test/`) |
| `npm run check` | Typecheck + lint + tests + build (comme la CI) |

La CI GitHub Actions (`.github/workflows/ci.yml`) exécute ces vérifications à chaque push sur `main` et à chaque pull request.

## Structure

```
public/cards/      Cartes du jeu (CSV) : main.csv + une feuille par espèce
src/core/          Modèle de données (types.ts), moteur (Game.ts), création de partie, plateau, système solaire, score
src/actions/       Actions principales (lancer, déplacer, orbite, atterrir, scanner, analyser, jouer une carte, technologie, passer)
src/systems/       Règles métier : sondes, cartes, scans, ressources, ordinateur, technologies, espèces
src/ai/            Comportement des robots
src/ui/            Interface React (plateaux, cartes, modales)
test/              Tests Jest
```

Le détail de l'architecture et des conventions est dans [`CLAUDE.md`](./CLAUDE.md).

## Modifier les cartes

Les cartes sont décrites dans `public/cards/*.csv` (séparateur `;`) :

```
Id;Nom;Type;Texte;Action gratuite;Couleur scan;Revenu;Cout;Gain;Contrainte
```

Les colonnes `Gain` et `Contrainte` encodent les effets (par ex. `1 Sonde + 1 Média`, `GAIN_ON_VISIT:jupiter:data:1`). Elles sont interprétées par `src/core/DataLoader.ts`.

## Licence

Projet personnel, adaptation non officielle du jeu SETI (Iello).
