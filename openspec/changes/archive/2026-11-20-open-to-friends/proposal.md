# Proposal

## Why

Le jeu va être ouvert à des amis (https://my-seti.netlify.app). Trois défauts gâcheraient leurs premières parties : le serveur gratuit de Render s'endort après 15 minutes et met environ une minute à se réveiller, une erreur de l'interface laisse une page blanche sans issue, et un ami qui rencontre un bug n'a aucun moyen simple de m'envoyer de quoi le reproduire.

## What Changes

- **Serveur gardé éveillé** : une tâche planifiée gratuite (GitHub Actions, toutes les 10 minutes) appelle `GET /health` pour que le serveur Render ne s'endorme pas.
- **Pré-réveil** : dès l'écran d'accueil (si le jeu en ligne est configuré), le client appelle `GET /health` en tâche de fond, pour que le serveur soit réveillé quand le joueur ouvre « Partie en ligne ».
- **Attente lisible** : pendant que le serveur se réveille, la fenêtre « Partie en ligne » (création, onglet Rejoindre) affiche un état explicite (« Réveil du serveur… » avec le temps écoulé) au lieu de « Serveur injoignable ».
- **Écran d'erreur** : une erreur de rendu de l'interface affiche un écran « Oups » avec trois choix (recharger, revenir à l'accueil, signaler le problème) au lieu d'une page blanche ; la partie solo sauvegardée automatiquement et la place en ligne sont conservées.
- **Erreurs non bloquantes** : une erreur hors du rendu (`window.onerror`, promesse rejetée non traitée) est retenue dans un journal d'erreurs et signalée par un message discret proposant de signaler le problème.
- **Signaler un problème** : un bouton (écran d'accueil, écran d'erreur, message d'erreur) produit un rapport à télécharger, avec un commentaire facultatif du joueur, la version, la graine, le mode (solo, tutoriel, en ligne), les dernières erreurs, le journal et la sauvegarde complète de la partie (en ligne : la vue du joueur, son historique et le code de la salle, jamais son jeton).

Aucun changement de format de sauvegarde (pas de migration) ni du protocole en ligne (pas de nouvelle version mineure).

## Hors périmètre

- Conservation des salles en ligne après un redémarrage de Render (disque persistant ou base de données) : changement séparé.
- Envoi automatique des rapports vers un service (serveur, GitHub Issues, e-mail) : le joueur transmet lui-même le fichier.
- Rapport en ligne contenant la partie complète (mains et pioches cachées) : le client n'en a que sa vue filtrée.
- Notification « à vous de jouer », adaptation au téléphone, revanche, discussion.

## Capabilities

### New Capabilities
- `error-reporting` : comportement du jeu face à une erreur (écran d'erreur, journal des erreurs, message non bloquant) et signalement d'un problème par un rapport téléchargeable.

### Modified Capabilities
- `online-play` : réveil du serveur (tâche planifiée qui le garde éveillé, pré-réveil depuis l'accueil, attente affichée pendant le réveil).

## Impact

- `src/main.tsx` : enveloppe `BoardUI` dans une limite d'erreur ; installe les écouteurs globaux.
- `src/ui/` : nouveaux modules (limite d'erreur et écran « Oups », journal des erreurs, construction et téléchargement du rapport), bouton dans l'écran d'accueil (`SettingsModal`), attente du réveil dans `OnlineModal`, pré-réveil.
- `.github/workflows/` : nouveau workflow planifié (ping du serveur).
- `public/docs/documentation.md` : signaler un problème ; `.claude/rules/online.md` : ping et pré-réveil.
- Moteur, robots, session, serveur : inchangés.
