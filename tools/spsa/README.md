# Réglage des poids des robots (SPSA)

Banc de réglage des poids d'évaluation des robots (`WEIGHTS_BY_PLAYER_COUNT` dans `src/ai/AIEvaluator.ts` : un jeu de poids pour 2, 3 et 4 joueurs, `DEFAULT_WEIGHTS` sinon) par parties entre robots Experts.

- `worker.ts` joue une partie complète, chaque siège avec son niveau (Expert par défaut) et ses propres poids (`AIEvaluator.weightOverrides` ; sans poids, ceux du jeu pour ce nombre de joueurs), et renvoie les scores finaux. Il est compilé par esbuild dans `build/` et lancé en parallèle (un processus par cœur moins un, ou `SPSA_WORKERS`).
- `spsa.js` pilote le réglage et les comparaisons, pour un nombre de joueurs donné. Les parties se jouent en miroir : mêmes graines, sièges échangés (à 2 joueurs, les 2 ordres ; à 3, les 6 répartitions de 1 contre 2 ; à 4, les 6 répartitions de 2 contre 2). L'écart de score mesure donc seulement l'effet des poids.

## Commandes

```bash
npm run tune:ai -- tune 3 140                     # réglage SPSA à 3 joueurs (reprend out/p3/state.json s'il existe)
npm run tune:ai -- compare 3 p3/tuned.json default 34   # validation (fichiers lus dans out/, default = poids en place pour ce nombre de joueurs)
npm run tune:ai -- levels 3 17                    # Expert contre Intermédiaire, poids en place
```

`tune` écrit `out/p<joueurs>/state.json` à chaque itération (reprise possible), `out/p<joueurs>/spsa.log`, puis `out/p<joueurs>/tuned.json` : la moyenne des paramètres sur la dernière moitié des itérations. `compare` (`out/compare.log`) et `levels` (`out/levels.log`) utilisent des graines (900000 + 10000 × joueurs et plus) que le réglage n'utilise jamais. Nombre de parties : 2 par graine à 2 joueurs, 6 par graine à 3 ou 4 joueurs.

Options du réglage (variables d'environnement) : `SPSA_KEYS` ne règle que les paramètres nommés (séparés par des virgules, `*` final pour un préfixe : `SPSA_KEYS='endGameRound*,passCost'`), les autres restant fixés à leur valeur en place ; `SPSA_TAG` range le réglage dans `out/p<joueurs>-<tag>/` (sans reprendre l'état d'un autre réglage) ; `SPSA_WORKERS` fixe le nombre de processus ; `SPSA_START='cardQuality=0.3'` donne la valeur de départ d'un paramètre (un poids nul ne bougerait presque pas, le réglage se faisant en logarithme). Pour `compare`, un fichier peut ne donner que quelques poids : les autres sont ceux en place.

## Diagnostic

`diagnose.ts` (compilé avec les autres : `npx esbuild tools/spsa/diagnose.ts --bundle --platform=node --target=node20 --outdir=tools/spsa/build`) joue des parties entre Experts avec les poids en place et écrit une ligne JSON par joueur : détail du score final, score à chaque fin de manche, ressources inutilisées, revenus, missions et cercles restés ouverts, objectifs, cartes Exertiens, actions principales choisies (par type et par manche).

```bash
node tools/spsa/build/diagnose.js 3 810000 8 > tools/spsa/out/diag/p3_0.jsonl   # 8 parties à 3 joueurs à partir de la graine 810000
```

## Réglage SPSA

- Point de départ : les poids en place pour ce nombre de joueurs.
- Paramètres en logarithme (perturbations relatives), bornés : parts entre 0,01 et 1 (`endGameBefore`, `lastRoundFactor`, `exertienStepChance`, `dangerMarginDecay`), `maxUsefulCards` entre 2 et 12, `minPointsPerRound` entre 3 et 40, sinon entre 0,01 et 50. `endGameLastRound` reste fixé à 1.
- Chaque itération : perturbation ±c sur tous les paramètres, 48 parties θ+ contre θ− (24 graines à 2 joueurs, 8 à 3 ou 4 joueurs), gradient estimé sur l'écart moyen de score. Pas a = 0,02, c = 0,15 (décroissances standard 0,602 et 0,101, A = 10).

Les poids réglés ne valent que si la validation sur graines neuves les donne nettement meilleurs que les poids en place : les scores sont très dispersés (écart-type d'environ 25 PV par partie).
