# Proposal

## Why

Le jeu révèle aujourd'hui une espèce Alien dès que la troisième trace de vie occupe ses emplacements Découverte, au milieu du tour. Les règles disent autre chose (livret p. 4 et p. 20) : « Si une espèce est découverte pendant votre tour, résolvez la découverte une fois votre tour terminé (s'il y a des paliers à résoudre, résolvez-les avant de résoudre la découverte) ». Ce décalage change le jeu : pendant le reste du tour, le joueur ne connaît pas encore l'espèce, ne reçoit pas encore ses cartes et ne peut pas encore utiliser sa piste. Ce changement aligne le moteur sur la règle.

## What Changes

- **Découverte en fin de tour** (moteur) : l'espèce dont les 3 emplacements Découverte se remplissent pendant un tour, par une trace de vie ou par un palier neutre, reste face cachée jusqu'à la fin du tour. Elle est résolue après tous les paliers du joueur (objectifs, paliers neutres, Centauriens, Exertiens) : plateau retourné, mise en jeu propre à l'espèce, cartes Alien des joueurs qui ont posé les marqueurs de découverte, choix ouverts par la découverte (cartes Exertiens). Le joueur suivant ne commence qu'ensuite.
- **Deux annonces** : l'annonce générique « Découverte d'une nouvelle espèce Alien ! », sans le nom de l'espèce, reste au moment où la troisième trace est posée. Une seconde annonce apparaît à la fin du tour, avec le nom de l'espèce révélée et les joueurs qui l'ont découverte.
- **Chapitre du tutoriel proposé** : dans la seconde annonce, quand l'espèce vient d'être débloquée dans ce navigateur, un bouton propose d'ouvrir son chapitre du tutoriel. Les conditions de déblocage existantes restent les mêmes : une vraie partie, pas un chapitre du tutoriel.
- **Chapitres du tutoriel** : les cinq chapitres d'espèce et le chapitre « Traces de vie et espèces » suivent le nouveau déroulement (trace posée, puis fin du tour, puis espèce révélée). Leurs étapes, leurs textes (`tutoriel.md`) et leurs solutions sont adaptés.
- **Documentation** : les règles des chapitres concernés (2.7 Traces de vie et espèces, 2.9 Paliers et fin de partie, 3.5 Aliens) décrivent la découverte en fin de tour, après les paliers.
- **Infobulle du 2e palier Exertien** (piste de score) : elle indique que jouer une carte à ce palier coûte 1 crédit. Le moteur applique déjà ce coût ; seule l'infobulle le tait aujourd'hui.

Hors du périmètre :

- Les effets de la découverte eux-mêmes (mise en jeu de chaque espèce, bonus des emplacements Découverte, cartes distribuées) ne changent pas ; seul leur moment change.
- Les cartes Action de fin de manche qui vérifient si une espèce est découverte (livret p. 22) ne sont pas concernées : elles se lisent hors du tour d'un joueur.
- Le réglage des poids des robots : on mesure seulement que leur niveau ne baisse pas (voir design).

Compatibilité :

- **Sauvegardes** : la partie garde une découverte en attente (nouveau champ facultatif). Une sauvegarde existante n'en a pas et reste valide sans migration ; `SAVE_VERSION` ne change pas.
- **Jeu en ligne** : le serveur et le client sont publiés ensemble ; le champ ajouté est facultatif et transmis avec la partie. Pas de changement du protocole de messages.

## Capabilities

### New Capabilities

(aucune)

### Modified Capabilities

- `game-rules` : l'exigence « Espèces et traces de vie » précise le moment de la découverte (fin du tour, après les paliers) ; l'exigence « Cartes Exertiens » situe le choix des cartes Exertiens de la découverte à ce moment.
- `tutorial` : ajout de la proposition du chapitre d'espèce dans l'annonce de fin de tour, et du déroulement des chapitres avec la découverte en fin de tour. Cette capacité est introduite par les changements `add-tutorial` et `add-species-tutorials` (terminés, pas encore archivés) : les archiver avant celui-ci pour que ces exigences s'ajoutent à sa spec.

## Impact

- `src/core/` : champ de découverte en attente dans le modèle de la partie.
- `src/systems/SpeciesSystem.ts` : la troisième trace (ou le palier neutre) note la découverte au lieu de la résoudre ; nouvelle opération qui résout les découvertes en attente.
- `src/engine/TurnManager.ts`, `ScoreManager.ts` : résolution des découvertes en attente en fin de tour, après les paliers, avec les choix qu'elle ouvre.
- `src/session/GameSession.ts` : annonce générique au moment de la trace, annonce nommée à la fin du tour.
- `src/ai/` : l'évaluation tient compte d'une découverte en attente (même valeur qu'une découverte faite) ; mesure du niveau des robots.
- `src/ui/` : seconde annonce avec le bouton du chapitre (`useAnnouncements`, `Announcement`, `BoardUI`), infobulle du 2e palier Exertien (`ObjectiveBoardUI`).
- `src/tutorial/` et `public/docs/tutoriel.md` : chapitres d'espèce et « Traces de vie et espèces ».
- `public/docs/documentation.md` : chapitres 2.7, 2.9 et 3.5.
- Tests : moteur (découverte par trace et par palier neutre, ordre avec les paliers, Exertiens), session (deux annonces), solutions des chapitres, composant de l'annonce.
