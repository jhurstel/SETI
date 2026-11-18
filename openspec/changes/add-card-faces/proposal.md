# Proposal

## Why

Les cartes s'affichent aujourd'hui comme une fiche de texte (nom, « Coût: », type ACT/MIS/FIN, description, puis une case « Action gratuite / Réservation / Signal ») : on ne les reconnaît pas d'un coup d'œil, alors que les vraies cartes (livret p. « Aperçu des cartes » et photos de la FAQ) se lisent par leurs coins et leurs symboles. Le glossaire 3.2 « Cartes » est encore vide (« La description de chaque carte viendra ici ») et rien ne dit quelles cartes ou quels effets n'ont pas encore de symbole.

## What Changes

- Nouvelle **face de carte** fidèle aux vraies cartes (livret p. 7, photos de la FAQ) : zone d'illustration en haut avec le jeton d'action gratuite (coin supérieur gauche) et le triangle de couleur de secteur (coin supérieur droit) ; badge de coût cranté (doré crédits, vert énergie) et bandeau du nom à la base de l'illustration ; zone blanche avec l'effet **en symboles** (les icônes du glossaire) et sa précision en texte ; panneau de mission (étiquettes et cercles de récompense) ou de fin de partie (doré) ; pied de carte à la couleur du revenu, avec le symbole du revenu en bas à droite ; numéro de la carte en tout petit, à l'horizontale, en bas à droite de l'illustration. Cartes d'espèce à la teinte de leur espèce.
- Cette face remplace le rendu actuel **partout en jeu** : main, rangée de cartes, fenêtres de choix de cartes (réservation, défausse, achat, scan…), infobulle (grande taille), cartes d'espèce (Centauriens, Exertiens avec leur danger) et missions jouées. Dans une fenêtre de choix, le coin utile au choix (revenu, signal ou action gratuite) reste mis en avant.
- **Planches de cartes** dans la documentation : le glossaire 3.2 montre toutes les cartes du paquet de base, par type, avec leur numéro ; chaque section d'espèce de 3.5 montre les cartes de l'espèce (masquées tant que l'espèce n'est pas débloquée, comme ses symboles).
- **Listes des manquantes**, tenues à jour par un outil et publiées dans `docs/etat-des-lieux-cartes.md` :
  - effets sans symbole : parties d'effet que la face ne sait pas encore dessiner (affichées en texte en attendant) ;
  - cartes sans photo dans la FAQ (aucune image de référence pour vérifier le visuel) ;
  - cartes du vrai jeu absentes du jeu (citées par la FAQ mais pas dans `public/cards/*.csv`, par exemple la carte promotionnelle « SE FR 01 – Planète naine depuis 2006 »).
- Hors périmètre : illustrations des cartes (pas d'image d'art : la zone d'illustration reste un fond décoratif), ajout des cartes absentes (seulement listées), modification des effets ou des CSV, du moteur ou des robots.
- Aucun changement des sauvegardes ni du protocole en ligne (affichage seulement).

## Capabilities

### New Capabilities
- `card-display` : présentation des cartes à l'écran et dans la documentation (face de carte, coins, effet en symboles, planches, listes des cartes ou effets non représentés).

### Modified Capabilities

## Impact

- `src/ui/components/` : nouveaux composants de face de carte (complète et compacte) et module pur de description d'une carte en symboles ; `HandCard.tsx` (`CardContent`), `CardTooltip.tsx`, `CardRowUI`, `modals/CardPickModal.tsx`, `AlienBoardUI.tsx`, `PlayedMissionCard.tsx`, `SymbolGlossary.tsx` (nouveaux emplacements `{{cartes}}` et `{{cartes-espece:Nom}}`), `modals/DocumentationModal.tsx`, CSS des cartes.
- `public/docs/documentation.md` (3.2 et sections d'espèce de 3.5), `docs/etat-des-lieux-cartes.md`, `.claude/rules/docs.md` (nouveaux emplacements), `.claude/rules/ui.md`.
- `tools/cards/` : outil d'audit des cartes (listes des manquantes) ; relevé des cartes citées par la FAQ.
- Tests : Jest (description des cartes, composants), e2e Playwright touchant la main et la rangée, captures de la documentation, textes du tutoriel qui décrivent la main ou la rangée (`public/docs/tutoriel.md`, attributs `data-tutorial` conservés).
