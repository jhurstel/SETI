# Proposal

## Why

Le jeu n'offre qu'une aide de référence (documentation 📖, infobulles, glossaire des symboles) : elle répond aux questions de quelqu'un qui connaît déjà SETI, mais un joueur qui découvre le jeu de société n'a aucun parcours pour en apprendre les règles et l'interface. Un tutoriel guidé, en chapitres courts joués sur le vrai plateau, comble ce manque.

## What Changes

- **Tutoriel en chapitres** : 10 chapitres courts et indépendants (l'écran et le tour, sondes, atterrir et Médias, scanner, ordinateur et analyse, cartes et missions, technologies, traces de vie et espèces, passer et fin de manche, paliers et fin de partie), plus un 11ᵉ « Première vraie partie » contre un robot Débutant avec une aide au contexte.
- **Positions préparées** : chaque chapitre part d'une position reproductible (graine fixe, ajustements de scénario déclarés et suite de commandes jouées par le moteur), jamais d'un fichier de sauvegarde écrit à la main.
- **Étapes guidées** : chaque étape affiche un texte dans une bulle, met en avant un élément de l'écran et se termine quand la partie atteint l'état attendu (par exemple, une sonde du joueur en orbite de Mars).
- **Guidage souple** : pendant une étape, les actions principales hors sujet sont désactivées, avec la raison dans leur infobulle ; les infobulles, l'annulation, la documentation et les plateaux des autres joueurs restent libres.
- **Adversaire passif** : dans les chapitres 1 à 10, l'adversaire passe sans rien faire, pour que le plateau ressemble à une vraie partie sans que les coups d'un robot changent le déroulement.
- **Textes dans un fichier Markdown** (`public/docs/tutoriel.md`), relisible sans toucher au code ; chaque étape peut renvoyer vers la section correspondante de la documentation (« En savoir plus »).
- **Accès** : le tutoriel est proposé automatiquement au premier lancement (ni partie sauvegardée ni progression), il peut être ignoré, et il reste accessible depuis l'accueil, avec un menu des chapitres.
- **Progression retenue** dans le navigateur : les chapitres terminés sont cochés.
- **Hors périmètre** :
  - les petits écrans (ordinateur uniquement pour l'instant) ;
  - le jeu en ligne (le tutoriel est local, sans serveur) ;
  - la reprise d'un chapitre après un rechargement de la page : le chapitre recommence au début ;
  - la traduction des textes ;
  - une refonte de la documentation existante, qui reste la référence vers laquelle le tutoriel renvoie.
- **Compatibilité** : les parties du tutoriel ne sont jamais sauvegardées, et la sauvegarde de la partie en cours n'est pas touchée. Aucune migration de sauvegarde (le chapitre 11 est une partie normale) et aucun changement du protocole en ligne.

## Capabilities

### New Capabilities
- `tutorial` : tutoriel guidé du jeu (chapitres, positions préparées, étapes et leur validation, guidage souple, textes, liens vers la documentation, premier lancement, progression).

### Modified Capabilities
- `robots` : nouvel adversaire passif réservé au tutoriel, qui passe sans action gratuite ni recherche.

## Impact

- **Nouvelle couche** `src/tutorial/` (TS pur, sans React) entre `session` et `ui` : définition des chapitres, préparation des positions, prédicats des étapes, filtre des commandes autorisées, lecture du fichier de textes. `tools/check-cycles.mjs`, `CLAUDE.md` et `.claude/rules/` intègrent la nouvelle couche.
- `src/core/model/ai.ts` et `src/ai/` : niveau de l'adversaire passif.
- `src/ui/` : bulle et surbrillance (attributs `data-tutorial` sur les éléments ciblés), menu des chapitres et proposition au premier lancement sur l'accueil, sauvegarde automatique coupée pendant un chapitre, ouverture de la documentation sur une section donnée, aide au contexte du chapitre 11.
- `public/docs/tutoriel.md` (nouveau) et `public/docs/documentation.md` (section sur le tutoriel).
- Tests : Jest (chaque chapitre se prépare et se résout par sa suite de commandes de solution ; cohérence entre étapes et textes ; liens vers la documentation) et Playwright (déroulé des chapitres dans le navigateur, ancrages présents).
