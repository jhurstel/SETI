# Proposal

## Constat

Chaque écart est reproduit par `test/UndoAudit.test.ts` : `test.failing` pour un bug encore présent, test ordinaire pour la preuve d'un comportement à revoir. Les 11 tests passent sur `main` (8614bcd).

| # | Mode | Ce qui est annoncé | Ce qui se passe | Test |
|---|------|--------------------|-----------------|------|
| 1 | En ligne | La partie est filtrée par joueur (`viewFor`), et une carte piochée n'est connue que de son propriétaire | Une carte piochée face cachée (échange contre une carte, achat dans la pioche) s'annule. Après l'annulation, la carte vue est de nouveau au-dessus de la pioche, cachée par la vue : le joueur connaît la prochaine carte et peut choisir de ne pas la piocher | `failing` « carte piochée face cachée », preuve « la carte vue est de nouveau au-dessus » |
| 2 | En ligne | Idem ; la rangée est publique | Acheter une carte de la rangée la remplace par la carte du dessus de la pioche, que **tous** les joueurs voient. L'achat s'annule quand même, et la carte révélée retourne, cachée, au-dessus de la pioche | `failing` « carte de la rangée remplacée » |
| 3 | En ligne et solo | Documentation, R3 : « une fois la passe confirmée (elle ne s'annule plus), le joueur découvre [la pile de fin de manche] » | Pendant le choix de la carte de fin de manche, la pile est visible et la passe s'annule encore (↩ proposé), en ligne comme en solo | `failing` « pile de fin de manche découverte », preuve « la passe s'annule encore » |
| 4 | Solo et en ligne | Infobulle « Annuler la dernière action » ; documentation : « revient avant la dernière action » | Ouvrir un achat (`BUY_CARD`) n'écrit rien dans l'historique. ↩ annule alors aussi l'action d'avant (la sonde lancée disparaît), en solo (pas de point d'annulation sans entrée) comme en ligne (la séquence visée est lue sur la dernière entrée de l'historique, pas sur la dernière commande) | `failing` « après l'ouverture d'un achat » (solo et en ligne), preuve « la sonde lancée disparaît » |
| 5 | Solo | Infobulle « Annuler la dernière action » | Pendant le tour d'un robot, ↩ est proposé et annule une **étape du robot**, qu'il rejoue aussitôt à l'identique (même état du hasard) : le bouton semble ne rien faire | preuve « pendant le tour du robot » |
| 6 | Solo | Tutoriel : « annuler votre dernière action (et même tout votre tour) tant que le tour suivant n'est pas joué » | Le retour au début du tour marche encore après le tour des robots, jusqu'à l'avant-dernier tour du joueur (ce que dit la documentation, mais pas le tutoriel) | `test/SessionUndo.test.ts` (existant) |

Vérifié conforme :
- En ligne, seules les commandes du joueur pendant son tour s'annulent ; une commande d'un autre joueur, une étape de robot ou la fin du tour effacent les points d'annulation (`test/OnlineUndo.test.ts`).
- Après un rechargement en solo, la dernière action et le début du tour s'annulent encore (`SAVED_UNDO_STATES`, test « après un rechargement »).
- Le hasard ne se « re-tire » pas : l'état du générateur est dans la partie, et l'annulation le restaure. Une commande rejouée redonne le même tirage (test « rejouée, la même carte revient »). Pendant le tour d'un joueur, seule la découverte d'une espèce tire au hasard (spécimens Mascamites, anomalies), et elle a lieu à la fin du tour, ce qui efface déjà l'annulation en ligne. La triche possible n'est donc pas un nouveau tirage. C'est la **connaissance** gagnée : carte du dessus de la pioche, rangée, pile de fin de manche, spécimens regardés, cartes Alien piochées.
- Le livret et la FAQ ne disent rien de l'annulation numérique (l'agent `regles-seti` n'a pas pu lire les PDF sur ce poste, faute de `pdftoppm`) : ce sont des choix du jeu numérique, à fixer dans la spec.

## Why

Le jeu en ligne vient d'être ouvert à des amis. Aujourd'hui, un joueur peut regarder une carte cachée puis revenir en arrière, et ses adversaires peuvent voir une carte de la rangée qui disparaît ensuite. Il faut faire de l'annulation une barrière d'information avant que des parties sérieuses ne se jouent. Il faut aussi que ↩ fasse exactement ce que dit son infobulle.

## What Changes

- **En ligne** : une commande qui révèle une information jusque-là cachée à un joueur devient une **barrière**. Cela couvre une carte venue de la pioche (main, rangée, cartes Alien ou d'espèce), la pile de fin de manche, un spécimen regardé, une espèce découverte, ou tout tirage au hasard. Ni cette commande ni les précédentes ne s'annulent ; les suivantes, si. La détection est générale : on compare ce que chaque joueur voit avant et après la commande, pas une liste de commandes. Une nouvelle carte qui révèle quelque chose est donc couverte d'office.
- **Interface** : quand la barrière bloque, le bouton ↩ disparaît (comme aujourd'hui quand rien n'est annulable). Son infobulle, ou un message, en donne la raison : « Action non annulable : une information cachée a été révélée ».
- **Dernière action** (solo et en ligne) : ↩ annule la dernière **commande** et sa séquence, même quand elle n'a rien écrit dans l'historique (ouverture d'un achat, d'un choix). L'action d'avant n'est plus emportée.
- **Tour d'un robot en solo** : ↩ n'est plus proposé pendant qu'un robot joue (il ne ferait rien d'utile) ; le retour au début du tour reste proposé.
- **Solo, réglage « Annulation stricte »** : il est choisi dans la fenêtre Nouvelle partie, désactivé par défaut, gardé par la partie et non modifiable en cours de partie. Activé, il applique la même barrière qu'en ligne : une commande du joueur qui lui révèle quelque chose, ou une étape de robot qui lui montre une carte (rangée remplacée…), ne s'annule plus, et on ne revient plus avant elle. Désactivé, l'annulation reste libre comme aujourd'hui. Le tutoriel est toujours libre (mode annulation). La documentation décrit les deux cas, y compris pour la passe (R3).
- **Textes** : la documentation (Historique, Annuler en ligne, R3) et le tutoriel décrivent le comportement réel.
- Pas de changement incompatible des sauvegardes : la marque d'une commande sans entrée, la barrière du journal et le réglage de la partie sont des champs facultatifs, absents des anciennes sauvegardes (annulation libre). Le protocole en ligne garde ses messages ; `UndoAvailability` gagne un champ facultatif (`reason`), compatible dans la même version mineure.

## Décisions de l'utilisateur

1. **Solo** : l'annulation dépend d'un réglage (« Annulation stricte », désactivé par défaut).
2. **Portée de la barrière** : seulement la commande révélatrice et celles d'avant ; les commandes suivantes restent annulables.
3. **Achat ouvert** : ↩ referme seulement la fenêtre ouverte.

## Hors du périmètre

- Garder les points d'annulation en ligne après un redémarrage du serveur (ils restent en mémoire).
- Annuler une commande d'un autre joueur, ou revenir sur un tour déjà fini en ligne.
- Le « mode annulation » du tutoriel (impasses), qui garde son fonctionnement.
- Les révélations dues à un autre joueur ou à un robot : elles effacent déjà l'annulation.

## Capabilities

### New Capabilities
- `undo`: annulation en jeu local et en ligne. Elle dit ce que ↩ et le retour au début du tour rendent, ce qui n'est jamais annulable (barrière d'information en ligne) et ce que l'interface en montre. Elle regroupe les exigences aujourd'hui dispersées entre `game-rules` et `online-play`.

### Modified Capabilities
- `game-rules`: l'exigence « Historique et annulation » garde l'historique et renvoie l'annulation à la capacité `undo`.
- `online-play`: l'exigence « Annulation en ligne » renvoie à `undo` et ajoute la barrière d'information.

## Impact

- `src/session/` : `GameRoom` (points d'annulation fondés sur les commandes, barrière), `SessionJournal` (point d'annulation pour une commande sans entrée), nouveau module pur de détection des révélations (à côté de `PlayerView`), `protocol.ts` (`UndoAvailability.reason`).
- `src/core/TurnUndo.ts`, `src/core/GamePersistence.ts` (entrée technique du journal, gardée par la sauvegarde) ; `src/core/model/game.ts` (`HistoryEntry` : champ facultatif).
- `src/ui/hooks/useUndo.ts`, `src/ui/HistoryBoardUI.tsx` (entrées techniques non affichées, infobulle de refus), `src/ui/modals/NewGameModal.tsx` (réglage), `src/session/GameSetup.ts` et `src/core/model/game.ts` (réglage gardé par la partie).
- Tests : `test/UndoAudit.test.ts` (les `test.failing` passent en tests ordinaires), `test/OnlineUndo.test.ts`, `test/SessionJournal.test.ts`, `test/GamePersistence.test.ts`.
- Documentation : `public/docs/documentation.md`, `public/docs/tutoriel.md`, `.claude/rules/online.md`, `.claude/rules/engine.md`.
