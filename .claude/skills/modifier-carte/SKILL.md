---
name: modifier-carte
description: Ajouter ou modifier une carte SETI (CSV de public/cards/, effets Gain et Contrainte lus par DataLoader, nouvel effet dans le moteur, test du catalogue, migration des sauvegardes). À utiliser pour corriger le texte ou l'effet d'une carte ou en ajouter une.
---

# Ajouter ou modifier une carte

## Données

- Fichiers : `public/cards/main.csv` (base), `mascamites.csv`, `anomalies.csv`, `oumuamua.csv`, `centauriens.csv`, `exertiens.csv` (espèces). Chargés à l'exécution par `fetch` (sur disque côté serveur et outils).
- Format : séparateur `;`, UTF-8 avec BOM (retiré par `DataLoader.parseCSV`, `test/DataLoaderBom.test.ts`). Colonnes `Id;Nom;Type;Texte;Action gratuite;Couleur scan;Revenu;Cout;Gain;Contrainte`. Garder le BOM et les fins de ligne du fichier.
- `Gain` et `Contrainte` encodent les effets (`1 Sonde + 1 Média`, `GAIN_ON_VISIT:jupiter:data:1`, `VISIT_PLANET:mars:4`, `GAIN_IF_…`, `END_CONDITION:<type>:<paramètre>:<seuil>:<PV>` pour les Exertiens, `RECEPTION_REVENUE` / `RECEPTION:<récompenses>` pour les Centauriens, `GAIN_ON_TOKEN`…), parsés dans `src/core/DataLoader.ts` (mini-DSL de la colonne Contrainte). Les valeurs d'enum sont des libellés français (`SectorType.YELLOW = "Jaune"`) utilisés au parsing : ne pas les renommer.
- Vérifier la carte dans le livret et la FAQ (`public/docs/`, agent `regles-seti`).

## Si l'effet existe déjà

1. Modifier la ligne du CSV.
2. `npx jest test/CardCatalog.test.ts test/DataLoader.test.ts` puis un test ciblé si la carte a une particularité (ex. `test/CardRules.test.ts`, `test/CardRewards.test.ts`).

## Si l'effet est nouveau

1. Lecture : nouveau type d'effet dans `DataLoader` (et le type dans `src/core/model/cards.ts`) ; lire sa valeur avec les accesseurs de `src/core/cardEffects.ts` (`effectNumber`, `effectString`, `effectAmount`, `effectBonus`), jamais `effect.value` brut.
2. Règle : dans le système concerné (`CardSystem`, `ScanSystem`, `ProbeSystem`, `SpeciesSystem`…), sans modifier la partie reçue. Un `GAIN_ON_…` laissé en effet permanent devient un cercle de mission ; un effet limité à l'action de la carte devient un effet ponctuel ou un buff portant le `sequenceId` de la carte (exemple Oumuamua dans `.claude/rules/game-rules.md`). Un choix → skill `ajouter-interaction`.
3. Robots : rien à recopier (ils jouent la carte par le moteur), mais vérifier que leur évaluation voit le gain ; `CardCatalog.test.ts` fait jouer chaque carte par un robot.
4. Tests : effet lu (`DataLoader`), effet appliqué (vraie partie), partie reçue intacte ; `CardCatalog.test.ts` vérifie que chaque type d'effet lu est traité.
5. Sauvegardes : elles gardent les effets lus au lancement ; si l'effet d'une carte existante change, ajouter une migration qui réécrit ses effets (`SAVE_VERSION`, `MIGRATIONS` de `GamePersistence`, comme la migration 2 → 3).
6. Historique : tout message qui nomme une carte cachée passe par `privateText`.

## Fin

- Documentation (`public/docs/documentation.md`) si l'effet ou une règle visible change ; `docs/etat-des-lieux-cartes.md` si l'audit des cartes est concerné.
- `npm run check` (ou l'agent `verificateur`).
