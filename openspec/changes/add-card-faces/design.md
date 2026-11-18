# Design

## Context

- Rendu actuel : `CardContent` (`ui/components/HandCard.tsx`) dessine une fiche texte, réutilisée par la main, la rangée (`CardRowUI`), `CardPickModal`, `AlienBoardUI` ; `CardTooltip` et `MissionCard`/`PlayedMissionCard` ont leur propre rendu. Le paramètre `highlightedAttribute` ('revenue' | 'scan' | 'freeAction') choisit la case mise en avant.
- Données : `Card` (`core/model/cards.ts`) porte `cost`/`costType`, `freeAction`, `scanSector`, `revenue`, `danger` et des effets typés (`immediateEffects`, `passiveEffects`, `permanentEffects`) lus depuis les colonnes `Gain` (bonus simples : « 1 Sonde + 1 Rotation ») et `Contrainte` (environ 90 mots-clés : `GAIN_ON_VISIT`, `END_CONDITION`, `SCORE_PER_…`, `ATMOSPHERIC_ENTRY`…) des CSV.
- Icônes : `BonusIcons` dessine un `Bonus` complet (ressources, signaux par secteur, traces, technologies, sonde, déplacements, rotation…) ; `freeActionBonus` et `revenueBonus` (`cardBonus.ts`) convertissent déjà les coins ; `SectorSignalIcon` dessine la couleur de secteur ; `SymbolGlossary.tsx` sert les emplacements `{{glossaire}}`… de la documentation.
- Anatomie observée (livret p. 7 « Aperçu des cartes », FAQ p. 15, 22, 26, 29, 30 rendues en image) :
  - moitié haute : illustration ; coin supérieur gauche : jeton clair de l'action gratuite (« 1 » + symbole) ; coin supérieur droit : triangle à la couleur du secteur avec le symbole signal ;
  - à la base de l'illustration : badge cranté du coût à gauche (doré « n¢ » pour les crédits, vert « n⚡ » pour l'énergie, cartes Centauriens), bandeau gris du nom à sa droite (à la couleur de l'espèce pour une carte d'espèce : sépia Mascamites, violet, vert Centauriens…) ;
  - zone blanche : symboles de l'effet centrés (« 2 Sondes + 1 Média »), précision en texte dessous ;
  - panneau de mission grisé : mission déclenchable = intitulé (« Lorsque vous visitez : », « Lorsque vous marquez un signal dans un secteur de la couleur indiquée : ») et, par cercle, une étiquette (planète, couleur) au-dessus du cercle de récompense ; mission conditionnelle = condition à gauche, récompense à droite ; fin de partie = panneau doré ;
  - pied : texte d'ambiance en italique (absent des CSV), numéro vertical à gauche (dans le jeu : à l'horizontale, en tout petit, en bas à droite de l'illustration, au choix de l'utilisateur), bandeau à la couleur du revenu (doré crédit, vert énergie, gris foncé carte « ? », rouge Média, bleu donnée) avec le symbole du revenu en bas à droite.
  - Aucune carte Exertien n'est photographiée : leur disposition (danger à la place du coût) reste une supposition.
- FAQ : `pdftotext` (Git pour Windows) extrait les entrées « #N Nom » (≈ 95 cartes illustrées, de #1 à #138 et ET.x, plus « SE FR 01 ») ; les pages se rendent en image avec l'API PDF de Windows (`Windows.Data.Pdf` depuis PowerShell), sans outil à installer.

## Goals / Non-Goals

**Goals:**
- Une seule face de carte, deux tailles (compacte pour la main, la rangée et les fenêtres ; grande pour l'infobulle et les planches).
- La description d'une carte en symboles est une fonction pure, testable sans React, qui rend aussi ce qu'elle ne sait pas dessiner.
- Listes des manquantes produites par un outil et vérifiées par un test (pas de liste tenue à la main).

**Non-Goals:**
- Pas d'illustration par carte, pas de reproduction de l'art ni de la maquette d'Iello (on reprend l'organisation des informations, pas les images).
- Pas de changement du moteur, des CSV, des sauvegardes, du protocole ni des robots.

## Decisions

1. **Couche `ui/`, module pur séparé du composant.** `ui/components/cardFaceModel.ts` (TS pur) : `describeCard(card): CardFaceModel` rend les coins (`freeAction`, `sector`, `revenue` sous forme de `Bonus`/secteur), le coût ou le danger, la ligne d'effet (liste de segments `{ kind: 'bonus', bonus } | { kind: 'text', text, effectType }`), les conditions de mission (cercle, déclencheur, récompense) ou de fin de partie. `CardFace.tsx` ne fait que dessiner ce modèle avec `BonusIcons`, `SectorSignalIcon`, `ResourceIcon`. Alternative écartée : tout calculer dans le composant React — impossible à tester sans DOM et à réutiliser par l'outil d'audit. Ce n'est pas une règle du jeu (aucun coût ni gain n'est calculé), donc pas de place dans `systems/`.
2. **Réutiliser les effets déjà lus par `DataLoader`**, pas le texte : `immediateEffects` de type gain → `Bonus` fusionnés dans l'ordre du CSV ; chaque mot-clé de `Contrainte` passe par une table `EFFECT_SYMBOLS: Record<type, (effect) => segment>` (missions `GAIN_ON_VISIT:jupiter:data:1` → planète + récompense ; `END_CONDITION`/`SCORE_PER_…` → symbole de condition + PV). Un type absent de la table produit un segment texte : c'est ce qui alimente la liste « effets sans symbole ». Les symboles manquants s'ajoutent ensuite dans `GameIcons`/`SymbolGlossary` (et au glossaire 3.1, règle de `docs.md`).
3. **Une face, deux tailles via CSS** (`.card-face.compact` / `.large`), disposition de la vraie carte (voir Context) : zone d'illustration (fond spatial teinté par le secteur, pas d'image), jeton d'action gratuite, triangle de secteur, badge de coût cranté, bandeau du nom, zone blanche, panneau de mission ou de fin de partie, pied de carte coloré par le revenu ; numéro en tout petit, à l'horizontale, en bas à droite de l'illustration, juste au-dessus du bandeau du nom. En compact, la zone d'illustration est réduite à une bande, le texte de précision disparaît et le nom est tronqué. Couleurs de pied reprises de `REVENUE_STYLES`, de triangle de `SECTOR_STYLES`, teintes d'espèce dans une table `SPECIES_CARD_TINTS`. `highlightedAttribute` devient `highlight` ('freeAction' | 'sector' | 'revenue') : le jeton, le triangle ou le pied visé grossit et se borde. `CardContent` est remplacé ; les boutons Jouer/Défausser de `HandCard`, les attributs `data-tutorial` et les classes d'état (`seti-card-interact-mode`, `selected`, `seti-card-playable-focus`) sont conservés sur l'enveloppe.
4. **Missions jouées** : `PlayedMissionCard`/`MissionCard` affichent la même face, les cercles de la ligne de mission reçoivent l'état venu de `Mission` (`completedRequirementIds`, `fulfillableRequirementIds`) — le clic sur un cercle réalisable reste celui d'aujourd'hui.
5. **Planches** (`ui/components/CardGlossary.tsx`) : nouveaux emplacements de documentation `{{cartes}}` (paquet de base, groupes Action / Missions déclenchables / Missions conditionnelles / Fin de partie, numéro sur chaque carte) et `{{cartes-espece:Nom}}` (cartes d'une espèce, dans sa section de 3.5 déjà masquée par `<!-- espece:Nom -->`). Cartes lues par `DataLoader` comme le reste du glossaire ; grille responsive en grande taille réduite.
6. **Audit** : `tools/cards/faq-cards.json`, relevé versionné des entrées « #N Nom » de la FAQ, régénérable par `tools/cards/extractFaq.mjs` (appelle `pdftotext`, absent de la CI : le relevé est donc commité). `tools/cards/cardAudit.ts` (`npm run cards:audit`) charge les cartes, applique `describeCard`, croise avec le relevé et écrit la section « Visuel des cartes » de `docs/etat-des-lieux-cartes.md` (trois listes). Un test Jest recalcule les listes et échoue si le document n'est pas à jour. Correspondance FAQ ↔ CSV par numéro (`#12` ↔ `Id 12`, `#ET.5` ↔ `ET.5`), contrôle du nom pour signaler un écart.

## Risks / Trade-offs

- [Cartes compactes plus chargées, main et rangée trop larges] → taille compacte calée sur la largeur actuelle, texte masqué ; vérification visuelle avec `tools/bench/midGameSave.ts` (même sauvegarde avant/après) et captures.
- [Ordre des symboles différent de la vraie carte] → on suit l'ordre du CSV (déjà de gauche à droite selon FAQ Q3) ; écarts relevés en comparant aux photos de la FAQ, corrigés dans la table.
- [Cartes à effet complexe (Contrainte longue) illisibles en symboles] → segment texte assumé et listé ; le texte complet reste dans l'infobulle.
- [Tests e2e et tutoriel qui ciblent les anciennes classes ou textes (« Coût: », « Action gratuite »)] → garder les sélecteurs `data-tutorial`/classes d'enveloppe, adapter les e2e et `public/docs/tutoriel.md`, relancer `npm run test:e2e` et `SETI_DOC_SCREENSHOTS=1 npx playwright test docMenus`.
- [Le relevé FAQ vieillit avec une nouvelle version de la FAQ] → régénération par `extractFaq.mjs`, date de version (« BGG 12.2025 ») inscrite dans le relevé.

## Migration Plan

Affichage seulement : aucune migration de sauvegarde, version de protocole inchangée. Retour arrière = revenir au commit précédent.

## Open Questions

- Disposition réelle des cartes Exertien (non photographiées dans la FAQ ni le livret) : à confirmer sur une vraie carte ; seul l'emplacement du danger en dépend.
- Teintes exactes des espèces Anomalies et Oumuamua (une seule carte photographiée par espèce) : relevées sur les rendus de la FAQ pendant l'implémentation.

## Notes d'implémentation

- Le module pur s'appelle `ui/components/cardFaceModel.ts` (et non `cardFace.ts`) : sous Windows, `cardFace.ts` et `CardFace.tsx` ne se distinguent que par la casse et l'import se résolvait sur le mauvais fichier.
- Un effet que le moteur applique d'après le numéro de la carte, sans colonne du CSV (carte 13, `ProbeSystem`), est décrit dans `CARD_SPECIFIC_SEGMENTS` de `cardFaceModel.ts`.
- Les signaux dans le secteur d'une étoile (Kepler-22, Véga…) sont dessinés avec le symbole signal et le nom de l'étoile en étiquette.
- Aucun nouveau symbole n'a été créé (étiquettes texte courtes + icônes existantes) : le glossaire 3.1 est inchangé.
- Conditions dessinées (`ConditionSymbol` de `cardFaceModel.ts`) : onglets des missions déclenchables (signal, trace, technologie, orbite, atterrissage, lancement, scan, coût d'une carte jouée…), conditions des missions conditionnelles et des décomptes (« Amener le [spécimen] sur Terre », « Pour chaque [secteur couvert] »). Une condition sans symbole reste écrite comme sur la carte et figure dans l'audit (seul Congrès Solvay aujourd'hui).
- Texte de la carte : seulement ce que les symboles ne disent pas (`specificText`) ; intitulé « Lorsque vous… » gardé seulement quand il est nécessaire (visites, cartes jouées, défausses).
