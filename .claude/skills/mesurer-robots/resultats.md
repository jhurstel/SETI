# Robots : mesures et réglages passés

Journal des mesures (déplacé de CLAUDE.md). Ajouter chaque nouvelle mesure ici, datée, avec le nombre de parties et l'écart ± (erreur type). Mettre aussi à jour le tableau de la documentation (1.1, Nouvelle partie, écarts arrondis) quand l'écart entre niveaux change.

## Niveaux

- Mesure (`npm run tune:ai -- levels <joueurs> <graines> <A> <B>`, `NIVEAU@T` pour une autre température ; environ 100 parties en miroir, novembre 2026) : Expert (avec ses suites jouées) − Avancé +17,4 / +17,6 / +12,0 PV à 2 / 3 / 4 joueurs (70 / 70 / 66 % de victoires), Avancé − Débutant +20,7 / +17,2 / +25,1 PV, Expert − Débutant +37,1 / +34,3 / +46,2 PV (tableau : documentation 1.1, Nouvelle partie).
- Découverte d'espèce en fin de tour (changement `defer-species-discovery`, 19 novembre 2026, `levels 2 50` et `levels 3 17`, poids inchangés) : Expert − Avancé +23,5 ± 3,0 PV à 2 joueurs (79 / 20 victoires, 100 parties) et +19,3 ± 2,8 PV à 3 joueurs (75 / 25, 102 parties). L'écart ne baisse pas (avant : +17,4 / +17,6) : pas de réglage nécessaire.

## Anticipation de l'Expert

- Contre l'Expert sans suites (`EXPERT*0` au banc ; `EXPERT*8` pour 8 suites) : +12,2 ± 2,9 / +3,3 ± 3,1 / +8,0 ± 2,1 PV à 2 / 3 / 4 joueurs (8 suites : +13,1 / +5,3 / +10,2, pour un calcul deux fois plus long).
- Coût (`npm run bench:ai`, après les optimisations de la copie de novembre 2026, deux fois plus rapides à 3 joueurs) : 10 % des étapes au-delà de 0,26 s à 2 joueurs, 0,41 s à 3, 0,58 s à 4 (max 1,2 s), dans le Web Worker.
- Sans suites (`LEVEL_ROLLOUTS` 0), réponse du seul adversaire suivant sans carte jouée (`valueAfterReply`, `bestPublicReply`) : +0,1 à +1,7 PV seulement.

## Réglages SPSA des poids

- Protocole : 140 itérations de 48 parties en miroir (mêmes graines, sièges échangés ; à 4 joueurs, 2 contre 2), paramètres en log, moyenne des 70 dernières itérations, puis validation à graines neuves contre les poids précédents. Banc : 13 processus, environ 30 s par itération à 2 joueurs, 45 s à 3, 55 s à 4.
- Dernier réglage complet (novembre 2026, partant de `DEFAULT_WEIGHTS`) : 2 joueurs −1,0 ± 2,1 PV (gardés), 3 joueurs +3,5 ± 1,8 PV (109 victoires contre 92), 4 joueurs +14,9 ± 1,8 PV (141 contre 59).
- Poids par manche seuls (`SPSA_TAG=rounds`, `SPSA_KEYS='endGameRound*,resourceRound*,boardRound*,lastRoundPassFactor,passCost'` : facteurs des ressources, du plateau et du décompte final à chaque manche, valeur après la passe de la dernière manche, coût d'une passe ; `AIEvaluator.passValue`) : +4,4 ± 2,1 PV à 2 joueurs, +2,9 ± 1,7 à 4 joueurs (appliqués), −1,2 ± 2,0 à 3 joueurs (non appliqués).
- Valeur des cartes en main (`ai/CardValue.ts` ; `SPSA_TAG=cards`, `SPSA_START='cardQuality=0.3'`) : +3,2 ± 1,5 PV à 4 joueurs (appliqué), aucun gain à 2 et 3 joueurs (`cardQuality` 0).
- Valeur des récompenses de mission (`missionChance` ; `SPSA_TAG=missions`) : −1,3 ± 2,4 / +1,1 ± 2,1 / +2,1 ± 1,5 PV à 2 / 3 / 4 joueurs, non appliquée (`missionChance` 0).

## Choix ciblés

- Traces de vie, `discoveryClaim` pleine une fois l'espèce découverte : +1,3 ± 3,0 PV à 2 joueurs, +0,8 ± 2,4 à 4 (novembre 2026).
- Secteurs en cours de remplissage (`sectorProspects`) : mesuré neutre sur la force de jeu (96 parties, −0,1 ± 3,3 PV).
- Exertiens, sur 20 parties à 3 Experts contre l'ancien choix (carte la moins dangereuse) : danger moyen 7,6 au lieu de 11,1, 1,1 carte jouée par joueur au lieu de 1,5, mais toujours peu de conditions remplies (18 %).
- Tuile objectif (`AIController.bestObjectiveTile`) contre l'ancien tirage comparé : +3,2 ± 2,8 PV à 2 joueurs, +0,3 ± 2,7 à 3, environ +2 PV de tuiles objectif (120 parties chacun).

## Diagnostic et pistes essayées sans gain

- Diagnostic Expert contre Avancé (`tools/spsa/diagnose.ts`, novembre 2026) : dans ses défaites, plus de la moitié de l'écart avec le vainqueur vient des tuiles objectif (la série finale sur ses tuiles reste faible : il ne construit pas vers elles).
- Compter davantage les points des tuiles où il a déjà un marqueur pendant les 4 premières manches (au moins 50 % ou 100 % au lieu de `endGameRoundN`) le rend plus faible : −1,8 ± 2,8 et −3,7 ± 2,9 PV à 2 joueurs (120 parties chacun, novembre 2026).
- Anticiper le coup suivant : plus lent, surévalue l'épargne.
- Retrancher la position du meilleur adversaire : sans gain.
