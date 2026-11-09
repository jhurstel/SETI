# Rapport d'architecture — SETI (version 1.2.0, novembre 2026)

Analyse du code au commit `06c6759` (plus les modifications Exertiens non commitées) : modularité, performance, tests, qualité, interface, serveur, sécurité. Les chiffres viennent de mesures faites sur la machine de développement (voir « Méthode » en fin de document).

## En bref

| Domaine | Appréciation | Point principal |
|---|---|---|
| Séparation moteur / interface | Très bonne | Aucun import de React ni de `ui/` dans le moteur ; toute modification passe par `GameSession.dispatch`. |
| Modularité interne du moteur | Moyenne | Un cycle de dépendances relie les 8 systèmes et la géométrie ; `core/` n'est pas une couche de base. |
| Typage et discipline | Très bonne | 0 `any`, 0 `@ts-ignore`, état immuable vérifié, hasard à graine partout. |
| Tests du moteur | Très bonne, avec une fragilité | 865 tests, 99,9 % des lignes ; le seuil de 100 % **échoue déjà sur `main`** et la couverture n'est pas vérifiée en CI. |
| Tests de l'interface | Faible | 12 400 lignes d'interface, un seul scénario Playwright. |
| Performance des robots | Correcte, à surveiller | Expert : étape médiane ~110 ms, mais 10 % des étapes dépassent ~1 s (cadence prévue : 1,5 s). |
| Interface React | Lourde à maintenir | Fichiers de 1 000 à 1 700 lignes, 300 styles en ligne, presque pas de mémoïsation. |
| Serveur en ligne | Fonctionnel, peu durci | Les salles ne sont jamais supprimées ; aucune limite de création. |

## Chiffres clés

| Partie | Fichiers | Lignes |
|---|---|---|
| `core/` | 22 | 5 392 |
| `systems/` | 8 | 5 155 |
| `actions/` | 10 | 386 |
| `session/` | 9 | 1 648 |
| `ai/` | 6 | 1 507 |
| **Moteur (total)** | **55** | **≈ 14 100** |
| `ui/` (TS/TSX) | 67 | 12 446 |
| CSS | — | 5 749 |
| `server/` | 2 | 323 |
| `test/` | 74 | 11 542 |

Plus gros fichiers : `SolarSystemBoardUI.tsx` 1 733, `ProbeSystem.ts` 1 263, `CardSystem.ts` 1 079, `BoardUI.tsx` 1 013, `types.ts` 941, `PlayerBoardUI.tsx` 910, `SpeciesSystem.ts` 801.

## 1. Architecture et modularité

### Points forts

- **Moteur pur.** Aucun fichier de `core/`, `systems/`, `actions/`, `session/` ou `ai/` n'importe React ou `ui/`. Le même moteur tourne dans le navigateur, dans le Web Worker des robots, sur le serveur Node et dans Jest.
- **Un seul point d'entrée.** `GameSession.dispatch(game, joueur, commande)` valide, applique, résout la file d'interactions et termine les tours. L'interface, les robots (`applyRobotStep`) et le serveur (`GameRoom`) passent tous par là. C'est ce qui a permis d'ajouter le jeu en ligne sans dupliquer de règle.
- **État immuable et rejouable.** `cloneGame` au début de chaque opération, effets de cartes figés (une écriture lève une erreur), générateur à graine (`core/random.ts`, `Math.random` absent du moteur), état du générateur dans la partie. Même graine et mêmes choix donnent la même partie : c'est la base des tests, de l'annulation et du serveur.
- **Interactions explicites.** `InteractionState` (36 variantes) est une union discriminée, et la file vit dans la partie elle-même : sauvegarde, annulation et réseau la transportent sans code spécial.
- **Robots honnêtes.** Les robots passent par les mêmes opérations que le joueur (`InteractionChoices`, `InteractionResolver`), donc une règle corrigée l'est pour tous.

### Points faibles

**1. Un cycle de dépendances au cœur des règles.** Neuf modules s'importent mutuellement (à l'exécution, imports de types exclus) :
`CardSystem`, `ComputerSystem`, `PlayCardEffects`, `ProbeSystem`, `ResourceSystem`, `ScanSystem`, `SpeciesSystem`, `TechnologySystem` et `core/SolarSystemPosition`.
- La géométrie (`SolarSystemPosition`) devrait être une feuille. Elle entre dans le cycle à cause de `performRotation`, une **règle** (déplacer les sondes, appliquer les bonus d'anomalie, écrire l'historique) qui appelle `ProbeSystem` et `ResourceSystem`.
- Conséquences : on ne peut ni lire ni tester un système isolément, l'ordre d'initialisation des modules devient fragile, et un changement dans un système se propage dans les 8 autres.

**2. `core/` n'est pas une couche de base.** 9 fichiers de `core/` importent `systems/` ou `actions/` (`InteractionChoices`, `InteractionResolver`, `ScoreManager`, `TurnManager`, `Game`, `Board`, `GameFactory`, `ActionValidator`, `SolarSystemPosition`). `core/` mélange donc le modèle (types, ids, hasard, copie, géométrie) et l'orchestration des règles, qui dépend de tout le reste.

**3. La session dépend des robots.** `GameSession` importe `AIController` et `AITurn` pour résoudre les interactions destinées à un robot. Ce n'est pas faux (le serveur a besoin des robots), mais c'est une inversion : la session devrait recevoir un « résolveur de robot » plutôt que connaître l'IA.

**4. Fichiers « fourre-tout ».**
- `types.ts` (941 lignes) contient tout le modèle et est importé par 92 fichiers.
- `GameSession` aiguille 50 cas, `AIController` 32.
- Ajouter une interaction touche six endroits (variante, libellé, `InteractionChoices`, `Choice`, `GameSession.choose`, `AIController`, plus l'interface) : c'est documenté, mais rien ne le garantit à la compilation.
- Les systèmes sont des classes à méthodes statiques (`ProbeSystem` en a 33, `CardSystem` 29) : ce sont des espaces de noms, pas des modules.

### Recommandations

1. **Casser le cycle** (effort faible, gain fort) : déplacer `performRotation` dans un `systems/RotationSystem.ts`, pour que `SolarSystemPosition` redevienne de la géométrie pure. Ensuite, sortir de `ResourceSystem` ce dont tout le monde a besoin (`processBonuses`, formatage) vers un module de base sans dépendance vers les autres systèmes.
2. **Séparer `core/` en deux** : `model/` (types, ids, random, cloneGame, cardEffects, géométrie : aucune dépendance vers les règles) et `rules/` ou `engine/` (TurnManager, ScoreManager, InteractionChoices, InteractionResolver, Game…).
3. **Découper `types.ts` par domaine** (joueur, plateau, cartes, interactions, constantes) en gardant un fichier qui ré-exporte tout pour ne rien casser.
4. **Registre des interactions** (plus tard) : un descripteur par variante (libellé, choix appliqué, choix du robot), vérifié exhaustivement par le compilateur, au lieu de six `switch` à tenir synchronisés.
5. Ajouter un **contrôle automatique des cycles** (script ou règle ESLint `import/no-cycle`) pour que le cycle ne se reforme pas.

## 2. Performance

### Mesures

Parties complètes entre robots, graine de test fixe (mesures faites pendant que la suite de couverture tournait : chiffres plutôt pessimistes) :

| Partie | Étapes | Calcul total | Étape médiane | p90 | p99 | Max |
|---|---|---|---|---|---|---|
| 2 Débutants | 144 | 14,5 s | 4 ms | 407 ms | 923 ms | 1,1 s |
| 2 Experts | 147 | 46,5 s | 113 ms | 1 020 ms | 1 440 ms | 1,75 s |
| 4 Experts | 253 | 39,9 s | 58 ms | 441 ms | 886 ms | 1,29 s |

| Opération | Coût |
|---|---|
| Taille de l'état (JSON) | 157 Ko au début, 167 Ko en fin de partie (stable) |
| `cloneGame` | 3,8 à 4,2 ms par copie |
| `viewFor` (vue d'un joueur en ligne) | 3,3 ms |
| `JSON.stringify` de la partie | 2,5 ms |

Bundle de production : `index` 531 Ko (minifié), `vendor` 222 Ko, worker des robots 184 Ko, CSS 87 Ko.

### Lecture

- **L'état reste petit et stable** (pas de croissance au fil de la partie) : la suppression de l'ancien `game.history` a réglé le problème.
- **La copie domine le coût des robots.** Un Expert simule chaque action principale et chaque action gratuite, chacune repart d'une copie à ~4 ms, avant même d'appliquer la règle. Une étape à 1 s représente donc des centaines de copies.
- **Les étapes lentes dépassent la cadence.** Le worker évite de figer l'écran, mais 10 % des étapes Expert prennent plus d'1 s, donc le rythme de 1,5 s par étape s'allonge par moments. Sur le serveur, toutes les salles partagent un seul fil : plusieurs salles d'Experts actives en même temps s'attendraient les unes les autres.
- **Bundle en un seul bloc** : la documentation, l'écran de fin et les fenêtres en ligne sont chargés dès l'accueil.

### Recommandations

1. **Profiler une étape Expert** (Chrome DevTools sur le worker, ou `--cpu-prof` sous Node avec `tools/spsa`) pour confirmer la part de `cloneGame` avant d'optimiser.
2. **Copier moins** : partage structurel (ne copier que les branches modifiées, par exemple avec une copie « à l'écriture » sur `board`, `decks` et `players`), ou cloner une fois par simulation au lieu d'une fois par opération enchaînée.
3. **Borner les simulations** de l'Expert (élaguer les actions gratuites manifestement mauvaises avant de les simuler) et mettre en cache les calculs géométriques répétés (`getAllCells` sur un même état de rotation), après profilage.
4. **Serveur** : faire tourner les robots dans un `worker_thread` (le moteur est déjà pur) pour qu'une salle lente ne bloque pas les autres.
5. **Découper le bundle** : `React.lazy` pour la documentation, l'écran de fin et le jeu en ligne.

## 3. Tests

### État

- **865 tests Jest** en 74 fichiers (11 500 lignes), sur de vraies parties (`createTestGame` avec les vraies cartes et une graine fixe). Environ 60 s seuls, 3 min avec la couverture.
- **Couverture du moteur** : 99,87 % des instructions, 99,91 % des lignes, 99,76 % des fonctions, 91,9 % des branches.
- **Tests transverses de valeur** : immutabilité, catalogue complet des cartes (`CardCatalog`), historique privé, parties complètes entre robots (`AITurn`), serveur et client réseau avec de vrais sockets.
- Aucun `test.failing` en attente.

### Problèmes

1. **Le seuil de couverture échoue sur `main`.** `npm run test:coverage` exige 100 % des instructions, lignes et fonctions, et ne passe pas : il manque 9 instructions et 3 fonctions, dans `ScoreManager` (tuile objectif « Autres », face B, lignes 261-266), `GameSession` et `AIController`. Ces lignes n'étaient couvertes que par hasard, par les parties entre robots : quand le comportement d'un robot change, une tuile ou un chemin n'est plus tiré et la couverture tombe.
2. **La couverture n'est pas en CI.** La CI lance `npm test`, pas `test:coverage`, donc la dérive passe inaperçue.
3. **Branches les moins couvertes** (nombre de branches non couvertes) : `ProbeSystem` 52, `CardSystem` 49, `SpeciesSystem` 44, `DataLoader` 37, `ScoreManager` 33 (84,7 %), `AIController` 31.
4. **Interface quasi non testée** : un seul scénario Playwright (un tour humain contre un robot). Le jeu en ligne, l'annulation, la reprise après rechargement, la fin de partie et les fenêtres de choix ne sont testés que dans le moteur.

### Recommandations

1. **Rendre la couverture déterministe** : un test ciblé par tuile objectif et par face (A et B), et pour chaque chemin aujourd'hui atteint seulement par les robots. Puis ajouter `npm run test:coverage` à la CI.
2. **Playwright** : une partie en ligne à deux navigateurs avec le serveur, l'annulation, le rechargement en cours de partie, et la fin de partie (partie préchargée près de la fin).
3. **Tests de composants légers** (Testing Library) pour les fenêtres de choix et les infobulles qui portent de la logique d'affichage (masquage des cartes, coûts affichés).
4. Garder les parties entre robots comme **test de non-régression global**, mais ne plus compter sur elles pour la couverture.

## 4. Qualité du code

- **Très bonne discipline TypeScript** : `strict`, 0 `any`, 0 `@ts-ignore`, 2 `eslint-disable`, 3 avertissements ESLint (refresh rapide de React) et aucune erreur.
- **Conventions claires et suivies** : `RuleCheck` avec raison obligatoire, `requirePlayer`, accesseurs `cardEffects`, `privateText` pour l'historique privé.
- **Documentation interne abondante** : `CLAUDE.md` et `documentation.md` sont détaillés et à jour sur les règles. Quelques passages sont périmés : `BoardUI` y est donné à « ~650 lignes » (1 013 en réalité) et `PlayerView` y est encore décrit « pour le futur serveur ». `CLAUDE.md` dépasse 30 000 caractères : un sommaire, ou un découpage par thème, le rendrait plus facile à parcourir.
- **Traces `console.log`** : 5 dans le moteur, volontaires (débogage des robots). Les passer par `Logger.ts` avec un niveau permettrait de les couper en production et sur le serveur.

## 5. Interface (React)

- **Composants trop gros** : `SolarSystemBoardUI` 1 733 lignes, `BoardUI` 1 013 lignes (15 `useState`, 8 `useEffect`), `PlayerBoardUI` 910 lignes.
- **299 objets `style={{…}}` en ligne**, à côté de 5 700 lignes de CSS. Deux systèmes de style coexistent, ce qui complique le thème (les couleurs de joueur ont dû passer par des variables CSS).
- **Presque pas de mémoïsation** : seuls 2 fichiers utilisent `React.memo`. Chaque changement d'état (160 Ko) redessine tous les plateaux, y compris le SVG du système solaire. Ce n'est pas mesuré ici : un passage au Profiler de React dira si c'est perceptible.
- **Bonne frontière avec le moteur** : les handlers envoient des commandes et ne calculent pas de règles. Les vérifications d'affichage (coûts, cases jouables) lisent les systèmes sans rien modifier.

### Recommandations

1. Sortir de `BoardUI` des hooks par sujet (sélection locale, annonces et tirage, annulation, en ligne) et des sous-composants par panneau.
2. Découper `SolarSystemBoardUI` en couches (disques, sondes, secteurs, surbrillances), chacune mémoïsée sur la partie de l'état qu'elle lit.
3. Remplacer progressivement les styles en ligne par des classes CSS.

## 6. Serveur et jeu en ligne

- **Bien conçu** : `GameRoom` et `RemoteClient` sont purs et testés contre un vrai serveur ; protocole versionné, accusés de réception, battement de cœur, reprise par jeton, vue filtrée par joueur.
- **Les salles ne sont jamais supprimées**, ni en mémoire ni sur disque : ni les parties terminées, ni les salons abandonnés (la liste les masque après un jour, mais ils restent chargés).
- **Aucune limite** sur le nombre de salles créées, ni par connexion.
- **Générateur aléatoire global** : correct grâce à la restauration de `rngState` et à la création des parties une à la fois, mais fragile si du code asynchrone s'intercale un jour.
- **Hébergement** : le disque Render n'est pas conservé, donc toutes les salles sont perdues à chaque redémarrage (limite connue et acceptée).

### Recommandations

1. Purger les salles terminées après quelques heures et les salons inactifs après un jour (mémoire et fichiers).
2. Limiter les créations : nombre maximal de salles, et quelques créations par minute et par connexion.
3. Pour des parties durables : stocker les salles dans une base gratuite (le format `SavedRoom` s'y prête déjà).

## 7. Sécurité

- **`gittoken.txt` est dans l'historique du dépôt public.** S'il s'agit d'un jeton GitHub encore valide, il faut le **révoquer** sur GitHub (Settings › Developer settings › Tokens). Le retirer de l'historique ne suffit pas, puisqu'il a pu être copié.
- Les jetons de place sont des UUID aléatoires, jamais renvoyés aux autres joueurs, et `GET /rooms` n'expose que des noms et des codes.
- Les WebSocket et la liste des salles n'acceptent que les origines autorisées. Les messages reçus sont validés (`parseClientMessage`), avec une taille maximale de 64 Ko.
- Le contenu des commandes n'est vérifié que par la session : un message bien formé mais absurde est refusé par les règles. `GameRoom.command` intercepte les exceptions, donc une commande qui fait planter le moteur est refusée sans casser la salle.

## Plan d'action proposé

| Priorité | Action | Effort | Gain |
|---|---|---|---|
| 1 | Révoquer le jeton publié dans l'historique, s'il est encore valide | Minutes | Sécurité |
| 2 | ~~Tests ciblés pour revenir à 100 % (tuile « Autres » B, `GameSession`, `AIController`) et `test:coverage` en CI~~ **Fait** : tuiles objectif Missions, Revenus et Autres testées sur leurs deux faces, découverte par commande testée, garde inatteignable retirée ; la CI lance `npm run test:coverage` | ½ jour | Fiabilité des tests |
| 3 | Déplacer `performRotation` dans `systems/` et ajouter un contrôle des cycles | ½ jour | Modularité |
| 4 | Purge et limites des salles du serveur | ½ jour | Robustesse en ligne |
| 5 | Profiler une étape Expert, puis réduire le coût des copies | 1 à 2 jours | Fluidité des robots, capacité du serveur |
| 6 | Scénarios Playwright : en ligne à deux, annulation, rechargement, fin de partie | 1 à 2 jours | Couverture de l'interface |
| 7 | Séparer `core/` en modèle et règles, découper `types.ts` | 1 à 2 jours | Lisibilité, temps de compilation |
| 8 | Découper `BoardUI` et `SolarSystemBoardUI`, mémoïser, `React.lazy` | 2 à 3 jours | Maintenance de l'interface, chargement |

## Méthode

- **Tailles** : comptage des lignes des fichiers `.ts` et `.tsx` par dossier.
- **Dépendances** : graphe des imports relatifs exécutés (les `import type` sont exclus), avec recherche des composantes fortement connexes (algorithme de Tarjan).
- **Couverture** : `jest --coverage` sur toute la suite (865 tests).
- **Performance** : test Jest temporaire (supprimé depuis) qui joue des parties complètes entre robots avec `TEST_SEED` et chronomètre chaque `AITurn.playStep`, `cloneGame` (moyenne sur 200 copies), `viewFor` et `JSON.stringify` (moyenne sur 100 appels). Les mesures tournaient en même temps que la couverture : les temps absolus sont surestimés, mais les ordres de grandeur et les proportions tiennent.
- **Bundle** : tailles des fichiers de `dist/assets` après `vite build` (minifiés, avant compression gzip).
