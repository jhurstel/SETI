# Tasks

## 1. Moteur : découverte en attente

- [x] 1.1 Ajouter le champ facultatif `pendingDiscoveries?: number[]` au modèle de la partie (`core/model`), copié par `cloneGame` ; vérifier qu'une sauvegarde sans ce champ se charge (test `GamePersistence`)
- [x] 1.2 `SpeciesSystem.placeLifeTrace` : la troisième couleur du triangle ajoute le plateau aux découvertes en attente au lieu de le découvrir ; le bonus de l'emplacement et l'entrée `DISCOVERY_MESSAGE` restent. Test : après la trace, le plateau n'est pas découvert, aucune carte Alien distribuée, la partie reçue intacte
- [x] 1.3 `SpeciesSystem.placeNeutralMilestone` : même changement pour un palier neutre ; message d'historique « sera révélée en fin de tour ». Test
- [x] 1.4 Nouvelle opération `SpeciesSystem.resolvePendingDiscoveries` : découvre chaque plateau en attente dans l'ordre, vide la liste, renvoie historique et choix (Exertiens). Tests : une espèce, deux espèces dans le même tour, Exertiens (choix ouverts), partie reçue intacte
- [x] 1.5 `TurnManager.finishTurn` : résoudre les découvertes en attente après `checkScoreMilestones`, avant `advance` ; attendre les choix ouverts, puis finir le tour au rappel suivant ; renvoyer l'annonce nommée. Tests : palier objectif et découverte dans le même tour (palier d'abord), palier neutre qui complète une espèce, Exertiens (le joueur suivant attend les choix), fin de manche dans le même tour
- [x] 1.6 Test : un plateau complété mais pas encore révélé ne propose pas sa piste pour une trace posée plus tard dans le tour
- [x] 1.7 Vérifier `PassAction` (passer après avoir complété une espèce) et mettre à jour les tests existants qui attendaient une découverte immédiate (`Species*`, `Exertiens`, `Centauriens`, `Anomalies`, `CardCatalog`…)

## 2. Session : deux annonces

- [x] 2.1 `GameSession` : l'annonce générique reste générique pendant la commande qui pose la trace ; l'annonce nommée vient de la fin de tour (joueur, passe, robot). Tests de session pour les trois cas

## 3. Robots

- [x] 3.1 `AIEvaluator` : un plateau en attente compte comme découvert dans la progression d'une espèce ; test
- [x] 3.2 Mesurer avant/après avec `npm run tune:ai -- levels 2 60` et `levels 3 60` ; consigner les résultats dans `.claude/skills/mesurer-robots/resultats.md`

## 4. Interface

- [x] 4.1 `useAnnouncements` / `Announcement` : bande « Nouvelle espèce » de fin de tour avec le bouton « Voir le chapitre du tutoriel » pour une espèce débloquée pour la première fois (pas dans un chapitre ; en ligne, le message sans bouton) ; la bande reste affichée au survol, Échap la ferme ; plus de message séparé « Nouveau chapitre du tutoriel » quand le bouton est présent
- [x] 4.2 `BoardUI` : le clic force l'écriture de la sauvegarde automatique puis ouvre le chapitre de l'espèce ; « Continuer » reprend la partie. Test de composant de la bande (bouton présent ou absent selon les conditions)
- [x] 4.3 `ObjectiveBoardUI` : infobulle du palier Exertien avec le coût de la carte (`SpeciesSystem.exertienCardCost`), « Jouer une carte coûte 1 crédit » au 2e palier
- [x] 4.4 Vérifier dans l'aperçu une partie où une espèce est complétée : annonce générique, puis bande nommée en fin de tour avec le bouton, puis reprise par « Continuer »

## 5. Tutoriel

- [x] 5.1 `speciesChapters.ts` : `discoverySteps` avec « poser » (en attente), « fin du tour » (révélée), « découverte » ; décaler les étapes qui suivaient, adapter les Exertiens (choix ouvert en fin de tour)
- [x] 5.2 Chapitre « Traces de vie et espèces » : même déroulement
- [x] 5.3 `public/docs/tutoriel.md` : textes des étapes des six chapitres
- [x] 5.4 `npm run tutorial:seed` et `TutorialChapters.test.ts` : chaque chapitre se prépare et se termine par sa solution

## 6. Documentation et vérification

- [x] 6.1 `public/docs/documentation.md` : 2.7 (découverte en fin de tour), 2.9 (ordre de la fin de tour : paliers puis découvertes), 3.5 (Exertiens : cartes jouées à la découverte, en fin de tour), annonce et chapitre proposé en 1.2 si décrits
- [x] 6.2 Captures de la documentation si une fenêtre a changé (`SETI_DOC_SCREENSHOTS=1 npx playwright test docMenus`)
- [x] 6.3 `npm run check`

## Workflow follow-up

- Archiver `add-tutorial` et `add-species-tutorials` avant ce changement, pour que la spec `tutorial` existe quand ses exigences ajoutées s'y appliquent.
