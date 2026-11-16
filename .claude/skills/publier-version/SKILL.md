---
name: publier-version
description: Publier une nouvelle version du jeu SETI (numéro de version, vérifications, commit, push qui déclenche Netlify et Render).
disable-model-invocation: true
argument-hint: "[correctif|fonction|rupture]"
---

# Publier une version ($ARGUMENTS)

Publier pousse sur `main` : Netlify reconstruit l'interface (https://my-seti.netlify.app) et Render le serveur (`render.yaml`). Demander l'accord de l'utilisateur avant le commit et avant le push.

1. `git pull`, puis `git status` : partir d'un arbre propre ou ne publier que les changements voulus.
2. Choisir le numéro : correctif `1.2.x`, nouvelle fonction `1.x.0`, rupture `x.0.0`. Une nouvelle version mineure rend les clients en ligne de l'ancienne version incompatibles avec le serveur (comparaison des deux premiers numéros) : à signaler.
3. Mettre le même numéro dans `package.json` (`version`), `package-lock.json` (`npm version <n> --no-git-tag-version` met les deux à jour) et `src/core/version.ts` (`GAME_VERSION`) ; `test/Version.test.ts` vérifie l'égalité.
4. Sauvegardes : si le modèle a changé de façon incompatible depuis la dernière version, vérifier que `SAVE_VERSION` et la migration sont là (`src/core/GamePersistence.ts`).
5. Documentation : `public/docs/documentation.md` à jour (règles, actions, interactions, robots) ; `openspec list` : aucun changement OpenSpec appliqué mais non archivé.
6. Vérifications : `npm run check` puis `npm run test:e2e` (Playwright, Chrome installé), ou l'agent `verificateur`.
7. Commit en anglais, descriptif, terminant par « release <n> » (ex. « Add online undo, room list and heartbeat reconnection, release 1.2.0 »).
8. `git push` (HTTPS ; `gh` n'est pas installé). La CI (`.github/workflows/ci.yml`) relance typecheck, lint, couverture, build et e2e.
9. Après le déploiement : vérifier la version affichée en bas du menu du site, et `GET /health` du serveur Render (version et nombre de salles ; réveil d'environ 1 min après 15 min d'inactivité).
