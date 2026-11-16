---
paths:
  - "public/docs/**"
  - "src/ui/components/SymbolGlossary.tsx"
  - "src/ui/modals/Documentation*"
---

# Documentation du jeu

- `public/docs/documentation.md` est affichée par le bouton 📖 à côté des paramètres (et par l'accueil). La tenir à jour quand une règle, une action, une interaction ou un poids des robots change (tableau des niveaux : section 5.1, mesures dans `.claude/skills/mesurer-robots/resultats.md`).
- Une ligne `{{glossaire}}` y insère le glossaire des symboles (`ui/components/SymbolGlossary.tsx`, vraies icônes de l'interface) : y ajouter tout nouveau symbole.
- Captures des fenêtres de choix (`public/docs/images/menus/`) : `SETI_DOC_SCREENSHOTS=1 npx playwright test docMenus`.
- Règles officielles `seti-rules-fr.pdf` et FAQ `SETI-FAQ-FR.pdf` : référence pour toute question de règle (agent `regles-seti` pour les consulter sans charger les PDF dans la conversation). Ces PDF et leurs images font 52 Mo : ils ne se téléchargent qu'au clic.
- `docs/etat-des-lieux-cartes.md` (racine) : audit des cartes et des opérations des robots (corrigé / situationnel / limites). `docs/archive/` : documents de conception initiaux, obsolètes (structure ancienne ou cible : `validation/`, `scoring/`…) ; se fier au code.
