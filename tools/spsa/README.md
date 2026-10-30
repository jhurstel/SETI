# Réglage des poids des robots (SPSA)

Banc de réglage des poids d'évaluation des robots (`DEFAULT_WEIGHTS` dans `src/ai/AIEvaluator.ts`) par parties entre robots Experts.

- `worker.ts` joue une partie complète, chaque siège avec ses propres poids (`AIEvaluator.weightOverrides`), et renvoie les scores finaux. Il est compilé par esbuild dans `build/` et lancé en parallèle (un processus par cœur moins un).
- `spsa.js` pilote le réglage et les comparaisons. Les parties se jouent en miroir : mêmes graines, sièges échangés (à 3 joueurs, les 6 répartitions de deux jeux de poids). L'écart de score mesure donc seulement l'effet des poids.

## Commandes

```bash
npm run tune:ai -- tune 140                              # réglage SPSA (reprend out/state.json s'il existe)
npm run tune:ai -- compare tuned.json default 100         # validation (fichiers lus dans out/) : 100 graines à 2 joueurs, 34 à 3 joueurs
```

`tune` écrit `out/state.json` à chaque itération (reprise possible), `out/spsa.log`, puis `out/tuned.json` : la moyenne des paramètres sur la dernière moitié des itérations. `compare` utilise des graines (900000 et plus) que le réglage n'utilise jamais.

## Réglage SPSA

- Paramètres en logarithme (perturbations relatives), bornés : parts entre 0,01 et 1 (`endGameBefore`, `lastRoundFactor`, `exertienStepChance`, `dangerMarginDecay`), `maxUsefulCards` entre 2 et 12, `minPointsPerRound` entre 3 et 40, sinon entre 0,01 et 50. `endGameLastRound` reste fixé à 1.
- Chaque itération : perturbation ±c sur tous les paramètres, 48 parties θ+ contre θ− (24 à 2 joueurs, 24 à 3 joueurs), gradient estimé sur l'écart moyen de score. Pas a = 0,02, c = 0,15 (décroissances standard 0,602 et 0,101, A = 10).
- Ordres de grandeur (14 cœurs) : environ 55 s par itération, 140 itérations en un peu plus de 2 h, 7 min pour une validation de 400 parties.

Les poids réglés ne valent que si la validation sur graines neuves les donne nettement meilleurs que les poids en place : les scores sont très dispersés (écart-type d'environ 25 PV par partie).
