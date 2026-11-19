# Tasks

## 1. Description d'une carte en symboles (module pur)

- [x] 1.1 Créer `src/ui/components/cardFaceModel.ts` : `describeCard(card)` rend les coins (action gratuite, secteur, revenu), le coût ou le danger (Exertien) et la ligne d'effet à partir de `immediateEffects` (bonus simples dans l'ordre du CSV) ; test Jest `test/CardFaceModel.test.ts` sur les cartes 1, 2 et une carte payée en énergie (coins, coût, ordre des symboles)
- [x] 1.2 Ajouter la table `EFFECT_SYMBOLS` des mots-clés de `Contrainte` (missions `GAIN_ON_…`/`GAIN_IF_…` → condition + récompense par cercle ; `END_CONDITION`/`SCORE_PER_…` → condition + PV) ; un type absent rend un segment texte ; test : la carte 2 donne deux cercles (Mercure → 1 carte, Vénus → 1 Média), un type inconnu donne un segment texte non vide
- [x] 1.3 Test de catalogue : chaque carte de `public/cards/*.csv` (193 cartes) produit un modèle sans erreur et sans partie d'effet perdue (chaque effet chargé apparaît en symbole ou en texte)

## 2. Composant de face de carte

- [x] 2.1 Créer `src/ui/components/CardFace.tsx` (+ CSS) selon la disposition relevée dans design.md : zone d'illustration, jeton d'action gratuite, triangle de secteur, badge de coût cranté (doré/vert), bandeau du nom, zone blanche (symboles centrés + précision en grande taille), pied de carte coloré par le revenu, numéro en tout petit en bas à droite de l'illustration ; prop `highlight` ; test `test/components/CardFace.test.tsx` (coins, couleur du pied selon le revenu, badge vert pour un coût en énergie, Exertien sans coins avec son danger, élément mis en avant)
- [x] 2.2 Panneaux : mission déclenchable (intitulé + étiquette au-dessus de chaque cercle), mission conditionnelle (condition à gauche, récompense à droite), fin de partie (panneau doré) ; teintes d'espèce (`SPECIES_CARD_TINTS`, relevées sur les rendus de la FAQ) ; test sur les cartes 2, une conditionnelle, une Fin de partie et une Centaurien ; comparer visuellement aux pages 15, 22, 26 et 29 de la FAQ (rendu `Windows.Data.Pdf`)
- [x] 2.3 Ajouter au glossaire 3.1 (`SymbolGlossary.tsx`) tout nouveau symbole créé pour les conditions de mission ou de fin de partie ; vérifier dans la documentation (bouton 📖) qu'il apparaît

## 3. Intégration en jeu

- [x] 3.1 Remplacer `CardContent` par `CardFace` (compact) dans `HandCard`, `CardRowUI`, `CardPickModal` et `AlienBoardUI`, en gardant boutons, classes d'état et attributs `data-tutorial` ; mapper `highlightedAttribute` vers `highlight` ; `npm test` (tests de composants existants) vert
- [x] 3.2 Afficher `CardFace` grande taille dans `CardTooltip` ; vérifier au survol dans le navigateur (preview) sur une carte de la main et de la rangée
- [x] 3.3 Afficher les missions jouées (`PlayedMissionCard`, `MissionCard`) avec la face et l'état des cercles (recouvert, réalisable, clic conservé) ; test de composant sur une mission à un cercle recouvert
- [x] 3.4 Contrôle visuel avant/après avec `tools/bench/midGameSave.ts` (main, rangée, fenêtre de réservation, Exertiens) ; ajuster la taille compacte pour que la main et la rangée gardent leur largeur
- [x] 3.5 Adapter les e2e (`e2e/*.spec.ts`) et `public/docs/tutoriel.md` aux nouveaux libellés ; `npm run test:e2e` et `test/TutorialText.test.ts` verts

## 4. Planches de la documentation

- [x] 4.1 Ajouter les emplacements `{{cartes}}` et `{{cartes-espece:Nom}}` (`CardGlossary.tsx`, `DocumentationModal.tsx`) : planche par type, triée par numéro, numéro sur chaque carte ; test de composant (138 cartes de base, regroupement par type)
- [x] 4.2 Remplacer le texte d'attente de 3.2 par `{{cartes}}` et ajouter `{{cartes-espece:Nom}}` dans chaque section d'espèce de 3.5 (`public/docs/documentation.md`) ; vérifier qu'une espèce non débloquée garde sa planche masquée (`tutorial/docMask.ts`, test existant ou nouveau)
- [x] 4.3 Mettre à jour `.claude/rules/docs.md` (nouveaux emplacements) et `.claude/rules/ui.md` (CardFace, cardFaceModel.ts) ; relire le texte

## 5. Listes des manquantes

- [x] 5.1 Créer `tools/cards/extractFaq.mjs` (pdftotext → entrées « #N Nom ») et commiter `tools/cards/faq-cards.json` (version « BGG 12.2025 ») ; vérifier qu'il contient #1 à #4, ET.1 et « SE FR 01 »
- [x] 5.2 Créer `tools/cards/cardAudit.ts` et le script `npm run cards:audit` : écrit dans `docs/etat-des-lieux-cartes.md` la section « Visuel des cartes » (effets sans symbole par carte, cartes sans photo dans la FAQ, cartes de la FAQ absentes du jeu, écarts de nom) ; lancer le script et relire les trois listes
- [x] 5.3 Test Jest qui recalcule les listes et échoue si `docs/etat-des-lieux-cartes.md` n'est pas à jour ; vérifier qu'il échoue après ajout d'un symbole sans régénération puis passe après `npm run cards:audit`

## 6. Vérification d'ensemble

- [x] 6.1 Refaire les captures de la documentation (`SETI_DOC_SCREENSHOTS=1 npx playwright test docMenus`) et vérifier les fenêtres de choix de cartes
- [x] 6.2 `npm run check` vert (typecheck, lint, cycles, tests, build)

## Workflow follow-up

- Archiver le changement (`/openspec-archive-change`) après relecture, en vérifiant que CLAUDE.md, `.claude/rules/` et la documentation reflètent le code.
