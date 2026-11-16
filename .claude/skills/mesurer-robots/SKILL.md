---
name: mesurer-robots
description: Mesurer ou régler les robots SETI au banc (npm run tune:ai tune/compare/levels, tools/spsa/diagnose.ts, npm run bench:ai) et consigner les résultats. À utiliser avant et après toute modification de l'évaluation, des niveaux ou de la vitesse des robots.
---

# Mesurer les robots

Fonctionnement des robots : `.claude/rules/robots.md`. Banc détaillé : `tools/spsa/README.md`. Mesures passées et pistes essayées sans gain : [resultats.md](resultats.md) (à lire avant de proposer un réglage, pour ne pas refaire un essai déjà fait).

Les parties sont longues : lancer les commandes en arrière-plan et ne lire que la fin des journaux (`tools/spsa/out/*.log`).

## Choisir la mesure

| Question | Commande |
| --- | --- |
| Une optimisation change-t-elle le jeu des robots ? Combien de temps par étape ? | `npm run bench:ai -- 3 2` (3 parties de 2 Experts, graines fixes) : l'empreinte des résultats doit rester identique |
| Écart entre deux niveaux | `npm run tune:ai -- levels <joueurs> <graines> [A] [B]` (Expert contre Avancé par défaut ; `NIVEAU@T` température, `NIVEAU+K` actions départagées, `'NIVEAU*N'` suites jouées) |
| Un jeu de poids est-il meilleur ? | `npm run tune:ai -- compare <joueurs> <a.json\|default> <b.json\|default> <graines>` (fichiers lus dans `tools/spsa/out/`, un fichier peut ne donner que quelques poids) |
| Régler les poids | `npm run tune:ai -- tune <joueurs> <itérations>` (140 habituellement ; `SPSA_KEYS`, `SPSA_TAG`, `SPSA_START`, `SPSA_WORKERS`) puis `compare` à graines neuves |
| Pourquoi un niveau perd-il ? | `npx esbuild tools/spsa/diagnose.ts --bundle --platform=node --target=node20 --outdir=tools/spsa/build` puis `node tools/spsa/build/diagnose.js <joueurs> <graine> <parties> [NIVEAUX,PAR,SIÈGE]` (une ligne JSON par joueur : détail du score, tuiles objectif, actions) |

## Règles de mesure

- Au moins une cinquantaine de parties en miroir pour comparer deux niveaux ou deux poids (écart-type d'environ 25 PV par partie) ; donner l'écart moyen ± erreur type et les victoires.
- Valider à graines neuves (`compare`, `levels`) : un réglage n'est appliqué que s'il gagne nettement.
- Cibles des niveaux : Expert environ 2 victoires sur 3 contre l'Avancé, Avancé environ 3 sur 4 contre le Débutant.
- Pour mesurer pendant qu'un réglage tourne : compiler dans un autre dossier et passer `SPSA_BUILD` (voir `tools/spsa/README.md`).

## Après la mesure

1. Ajouter le résultat daté dans [resultats.md](resultats.md) (appliqué ou non, et pourquoi).
2. Poids retenus : `WEIGHTS_BY_PLAYER_COUNT` dans `src/ai/AIEvaluator.ts` (un jeu par nombre de joueurs).
3. Écart entre niveaux modifié : tableau de la section 5.1 de `public/docs/documentation.md`.
4. Comportement des robots modifié : `openspec/specs/robots/spec.md` (par un changement OpenSpec si c'est une évolution notable).
5. `npm run check`.
