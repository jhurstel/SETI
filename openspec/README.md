# Spécifications (OpenSpec)

Ce dossier applique le développement piloté par les spécifications avec [OpenSpec](https://github.com/Fission-AI/OpenSpec) 2.x : avant une évolution notable, on écrit ce qui doit changer, on le valide, puis on l'applique.

- `config.yaml` : contexte et conventions du projet (l'ancien `project.md`), règles propres à chaque artefact, consignes pour l'application et l'archivage. OpenSpec les injecte dans ses instructions.
- `specs/<capacité>/spec.md` : la référence, ce que le jeu fait aujourd'hui. Cinq capacités pour l'instant :
  - `game-rules` : règles appliquées par le moteur (commandes, tours, interactions, missions, espèces, fin de partie, sauvegardes) ;
  - `robots` : niveaux, évaluation, information cachée, déterminisme, réglage ;
  - `online-play` : salles, vues filtrées, client, annulation, versions, limites ;
  - `tutorial` : chapitres, étapes guidées, guidage, mode annulation sur une impasse, espèces débloquées ;
  - `card-display` : faces des cartes (coins, coût, effet en symboles, panneaux), en jeu et dans la documentation.
- `changes/<nom>/` : une évolution en cours (`proposal.md` pourquoi et quoi, `specs/` delta `ADDED/MODIFIED/REMOVED Requirements`, `design.md` comment, `tasks.md` liste à cocher) ; `changes/archive/` : les évolutions terminées.

Format d'une exigence : `### Requirement: <nom>`, texte avec SHALL/MUST (mots-clés en anglais, texte en français), au moins un `#### Scenario:` avec **WHEN** / **THEN**. Une spec décrit un comportement observable, pas des classes : le détail d'implémentation reste dans `CLAUDE.md`, `.claude/rules/` et le code.

## Installation

```bash
npm install -g @fission-ai/openspec@2.0.0
```

Node ≥ 22.12 (la CI est en Node 22). Télémétrie coupée sur le poste : `openspec config set telemetry.enabled false` (ou `OPENSPEC_TELEMETRY=0`). Les skills de Claude Code ont été générés par `openspec init --tools claude --language French` dans `.claude/skills/openspec-*` (copie dans `.agents/skills/`) ; `openspec update` les régénère après une mise à jour d'OpenSpec.

## Flux de travail

1. **Explorer** (facultatif) : `/openspec-explore` pour réfléchir à une idée sans rien écrire dans le code.
2. **Proposer** : `/openspec-propose <idée>` crée `openspec/changes/<nom>/` avec proposition, delta de specs, design et tâches. Rien n'est codé à cette étape.
3. **Valider** : relire et corriger les artefacts (`/openspec-update-change`), puis `openspec validate <nom>` ; on ne passe à la suite qu'avec l'accord explicite sur la proposition.
4. **Appliquer** : `/openspec-apply-change <nom>` implémente les tâches une à une (tests Jest compris), en cochant `tasks.md` ; terminer par `npm run check`.
5. **Archiver** : `/openspec-archive-change <nom>` (ou `openspec archive <nom>`) fusionne le delta dans `openspec/specs/` et déplace le dossier dans `changes/archive/`. `/openspec-sync-specs` fusionne les specs sans archiver.

Commandes utiles : `openspec list` (changements en cours), `openspec list --specs`, `openspec show <id>`, `openspec validate --specs`, `openspec view` (tableau de bord).

Quand s'en passer : correctif d'un bug, réglage de poids ou retouche d'interface sans changement de règle. Pour une nouvelle règle, une nouvelle espèce ou interaction, un changement du protocole en ligne ou du comportement des robots, passer par une proposition.
